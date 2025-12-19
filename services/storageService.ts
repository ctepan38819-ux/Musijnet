
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
// V13 ULTRA: Fresh node with enhanced stability protocol
const BUCKET_URL = 'https://kvdb.io/MUSIJNET_V13_ULTRA';

const TRACK_INDEX_KEY = 'index_tracks';
const USER_INDEX_KEY = 'index_users';
const CHUNK_SIZE = 48 * 1024; // Smaller 48KB chunks for extreme stability
const THROTTLE_MS = 250; // Pause between chunks to prevent 429 errors

const fetchWithRetry = async (url: string, options: any = {}, timeout = 60000) => {
  const maxRetries = 5;
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(id);

      if (response.status === 429) {
        // Wait longer on rate limits
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Server status ${response.status}`);
      }
      
      return response;
    } catch (e) {
      clearTimeout(id);
      lastError = e;
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  
  throw lastError || new Error("Connection Timeout after 5 retries");
};

export const storageService = {
  getIndex: async (key: string): Promise<string[]> => {
    try {
      const res = await fetchWithRetry(`${BUCKET_URL}/${key}`, { cache: 'no-store' });
      if (res.status === 404) return [];
      const text = await res.text();
      return text ? JSON.parse(text) : [];
    } catch { return []; }
  },

  saveIndex: async (key: string, ids: string[]): Promise<void> => {
    try {
      await fetchWithRetry(`${BUCKET_URL}/${key}`, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(Array.from(new Set(ids)))
      });
    } catch (e) { console.error("Index sync failure", e); }
  },

  getAllUsers: async (): Promise<User[]> => {
    const ids = await storageService.getIndex(USER_INDEX_KEY);
    const users = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetchWithRetry(`${BUCKET_URL}/u_${id}`, { cache: 'no-store' });
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
        const res = await fetchWithRetry(`${BUCKET_URL}/t_${id}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }));
    return tracks.filter(t => t !== null) as Track[];
  },

  saveUser: async (user: User) => {
    await fetchWithRetry(`${BUCKET_URL}/u_${user.id}`, {
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

  saveBlob: async (id: string, blob: Blob, onProgress?: (p: string) => void): Promise<void> => {
    const buffer = await blob.arrayBuffer();
    const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
    
    // Save Manifest
    await fetchWithRetry(`${BUCKET_URL}/m_${id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify({ totalChunks, mimeType: blob.type, size: blob.size })
    });

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, buffer.byteLength);
      const chunk = buffer.slice(start, end);
      
      if (onProgress) onProgress(`SNC: ${i + 1}/${totalChunks}`);

      await fetchWithRetry(`${BUCKET_URL}/c_${id}_${i}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
      });

      // Verification Step: ensure chunk exists
      const verify = await fetchWithRetry(`${BUCKET_URL}/c_${id}_${i}`, { method: 'HEAD' });
      if (!verify.ok) throw new Error(`Verification failed for segment ${i}`);

      // Respect the throttle to avoid 429
      await new Promise(r => setTimeout(r, THROTTLE_MS));
    }
  },

  getBlob: async (id: string): Promise<string> => {
    try {
      const mRes = await fetchWithRetry(`${BUCKET_URL}/m_${id}`);
      if (!mRes.ok) return '';
      const manifest = await mRes.json();

      const chunks: Uint8Array[] = [];
      for (let i = 0; i < manifest.totalChunks; i++) {
        const cRes = await fetchWithRetry(`${BUCKET_URL}/c_${id}_${i}`);
        if (!cRes.ok) throw new Error(`Segment ${i} missing from buffer`);
        const chunkBuffer = await cRes.arrayBuffer();
        chunks.push(new Uint8Array(chunkBuffer));
      }

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
      console.error("Relay reconstruction failure", e);
      return '';
    }
  },

  saveTrack: async (track: Track, audioBlob: Blob, coverBlob: Blob, onProgress?: (step: string) => void): Promise<void> => {
    if (onProgress) onProgress("Syncing Meta...");
    // 1. Save Meta first to reserve space
    await fetchWithRetry(`${BUCKET_URL}/t_${track.id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify({ ...track, audioFile: '', coverImage: '', status: 'pending' })
    });

    // 2. Heavy Lifting
    if (onProgress) onProgress("Artwork...");
    await storageService.saveBlob(`cover_${track.id}`, coverBlob);
    
    if (onProgress) onProgress("Audio Streams...");
    await storageService.saveBlob(`audio_${track.id}`, audioBlob, onProgress);
    
    // 3. Register in Index
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
    const res = await fetchWithRetry(`${BUCKET_URL}/t_${trackId}`);
    if (res.ok) {
      const track = await res.json();
      track.status = status;
      await fetchWithRetry(`${BUCKET_URL}/t_${trackId}`, {
        method: 'PUT',
        mode: 'cors',
        body: JSON.stringify(track)
      });
    }
  },

  toggleSavedTrack: async (userId: string, trackId: string): Promise<void> => {
    const res = await fetchWithRetry(`${BUCKET_URL}/u_${userId}`);
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
