
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
const BUCKET_URL = 'https://kvdb.io/MN_STABLE_V11_CHUNKED';

const TRACK_INDEX_KEY = 'index_tracks';
const USER_INDEX_KEY = 'index_users';
const CHUNK_SIZE = 60 * 1024; // 60KB to stay safely under kvdb's 64KB limit

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 60000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
};

export const storageService = {
  getIndex: async (key: string): Promise<string[]> => {
    try {
      const res = await fetchWithTimeout(`${BUCKET_URL}/${key}`, { cache: 'no-store' });
      if (res.status === 404) return [];
      if (!res.ok) return [];
      const text = await res.text();
      return text ? JSON.parse(text) : [];
    } catch { return []; }
  },

  saveIndex: async (key: string, ids: string[]): Promise<void> => {
    try {
      await fetchWithTimeout(`${BUCKET_URL}/${key}`, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(Array.from(new Set(ids)))
      });
    } catch (e) { console.error("Index update failed", e); }
  },

  getAllUsers: async (): Promise<User[]> => {
    const ids = await storageService.getIndex(USER_INDEX_KEY);
    const users = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetchWithTimeout(`${BUCKET_URL}/u_${id}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }));
    return users.filter(u => u !== null) as User[];
  },

  getTracks: async (): Promise<Track[]> => {
    const ids = await storageService.getIndex(TRACK_INDEX_KEY);
    const tracks = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetchWithTimeout(`${BUCKET_URL}/t_${id}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }));
    return tracks.filter(t => t !== null) as Track[];
  },

  saveUser: async (user: User) => {
    await fetchWithTimeout(`${BUCKET_URL}/u_${user.id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(user)
    });
    const ids = await storageService.getIndex(USER_INDEX_KEY);
    if (!ids.includes(user.id)) {
      ids.push(user.id);
      await storageService.saveIndex(USER_INDEX_KEY, ids);
    }
  },

  // NEW: Robust Chunked Upload
  saveBlob: async (id: string, blob: Blob, onProgress?: (p: number) => void): Promise<void> => {
    const buffer = await blob.arrayBuffer();
    const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
    
    // 1. Save manifest
    await fetchWithTimeout(`${BUCKET_URL}/m_${id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify({ totalChunks, mimeType: blob.type, size: blob.size })
    });

    // 2. Save chunks sequentially to avoid rate limiting
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(start, end);
      
      const res = await fetchWithTimeout(`${BUCKET_URL}/c_${id}_${i}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      });

      if (!res.ok) throw new Error(`Chunk ${i} upload failed: ${res.status}`);
      if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
  },

  // NEW: Robust Chunked Fetch
  getBlob: async (id: string): Promise<string> => {
    try {
      // 1. Get manifest
      const mRes = await fetchWithTimeout(`${BUCKET_URL}/m_${id}`);
      if (!mRes.ok) return '';
      const manifest = await mRes.json();

      // 2. Fetch all chunks
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < manifest.totalChunks; i++) {
        const cRes = await fetchWithTimeout(`${BUCKET_URL}/c_${id}_${i}`);
        if (!cRes.ok) throw new Error(`Chunk ${i} fetch failed`);
        const chunkBuffer = await cRes.arrayBuffer();
        chunks.push(new Uint8Array(chunkBuffer));
      }

      // 3. Reassemble
      const totalLength = chunks.reduce((acc, val) => acc + val.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([combined], { type: manifest.mimeType });
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Blob reassembly failed", e);
      return '';
    }
  },

  saveTrack: async (track: Track, audioBlob: Blob, coverBlob: Blob, onProgress?: (step: string) => void): Promise<void> => {
    if (onProgress) onProgress("Uploading Cover...");
    await storageService.saveBlob(`cover_${track.id}`, coverBlob);
    
    if (onProgress) onProgress("Uploading Audio Segments...");
    await storageService.saveBlob(`audio_${track.id}`, audioBlob);
    
    const metadata = { ...track, audioFile: '', coverImage: '' };
    const res = await fetchWithTimeout(`${BUCKET_URL}/t_${track.id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(metadata)
    });
    
    if (!res.ok) throw new Error("Metadata sync failed");

    const ids = await storageService.getIndex(TRACK_INDEX_KEY);
    if (!ids.includes(track.id)) {
      ids.push(track.id);
      await storageService.saveIndex(TRACK_INDEX_KEY, ids);
    }
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    const ids = await storageService.getIndex(TRACK_INDEX_KEY);
    const newIds = ids.filter(id => id !== trackId);
    await storageService.saveIndex(TRACK_INDEX_KEY, newIds);
  },

  updateTrackStatus: async (trackId: string, status: Track['status']): Promise<void> => {
    const res = await fetchWithTimeout(`${BUCKET_URL}/t_${trackId}`);
    if (res.ok) {
      const track = await res.json();
      track.status = status;
      await fetchWithTimeout(`${BUCKET_URL}/t_${trackId}`, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(track)
      });
    }
  },

  toggleSavedTrack: async (userId: string, trackId: string): Promise<void> => {
    const res = await fetchWithTimeout(`${BUCKET_URL}/u_${userId}`);
    if (res.ok) {
      const user: User = await res.json();
      if (!user.savedTrackIds) user.savedTrackIds = [];
      const index = user.savedTrackIds.indexOf(trackId);
      if (index === -1) user.savedTrackIds.push(trackId);
      else user.savedTrackIds.splice(index, 1);
      await storageService.saveUser(user);
    }
  },

  getAuth: (): AuthState => {
    const data = localStorage.getItem(AUTH_KEY);
    if (data) return JSON.parse(data);
    return { user: null, isAuthenticated: false, theme: 'red-black', language: 'ru' };
  },

  setAuth: (auth: AuthState) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
  }
};
