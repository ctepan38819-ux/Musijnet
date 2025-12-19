
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
// New dedicated production node
const BUCKET_URL = 'https://kvdb.io/MN_PROD_NODE_V8_STABLE';

// Keys for indexing
const TRACK_INDEX_KEY = 'index_tracks';
const USER_INDEX_KEY = 'index_users';

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
  // Helper to get index (list of IDs)
  getIndex: async (key: string): Promise<string[]> => {
    try {
      const res = await fetchWithTimeout(`${BUCKET_URL}/${key}`);
      if (res.status === 404) return [];
      const text = await res.text();
      return text ? JSON.parse(text) : [];
    } catch { return []; }
  },

  // Helper to save index
  saveIndex: async (key: string, ids: string[]): Promise<void> => {
    await fetchWithTimeout(`${BUCKET_URL}/${key}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(ids)
    });
  },

  // Get all users from the server
  getAllUsers: async (): Promise<User[]> => {
    const ids = await storageService.getIndex(USER_INDEX_KEY);
    const users = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetchWithTimeout(`${BUCKET_URL}/u_${id}`);
        return await res.json();
      } catch { return null; }
    }));
    return users.filter(u => u !== null) as User[];
  },

  // Get all approved tracks from the server
  getTracks: async (): Promise<Track[]> => {
    const ids = await storageService.getIndex(TRACK_INDEX_KEY);
    const tracks = await Promise.all(ids.map(async (id) => {
      try {
        const res = await fetchWithTimeout(`${BUCKET_URL}/t_${id}`);
        const data = await res.json();
        return data;
      } catch { return null; }
    }));
    return tracks.filter(t => t !== null) as Track[];
  },

  saveUser: async (user: User) => {
    // 1. Save user object
    await fetchWithTimeout(`${BUCKET_URL}/u_${user.id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(user)
    });
    // 2. Update index
    const ids = await storageService.getIndex(USER_INDEX_KEY);
    if (!ids.includes(user.id)) {
      ids.push(user.id);
      await storageService.saveIndex(USER_INDEX_KEY, ids);
    }
  },

  saveBlob: async (id: string, blob: Blob): Promise<void> => {
    const res = await fetchWithTimeout(`${BUCKET_URL}/${id}`, {
      method: 'PUT',
      mode: 'cors',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    });
    if (!res.ok) throw new Error(`Server Error: ${res.status}`);
  },

  getBlob: async (id: string): Promise<string> => {
    const res = await fetchWithTimeout(`${BUCKET_URL}/${id}`);
    if (!res.ok) return '';
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  saveTrack: async (track: Track, audioBlob: Blob, coverBlob: Blob): Promise<void> => {
    // 1. Upload blobs
    await storageService.saveBlob(`audio_${track.id}`, audioBlob);
    await storageService.saveBlob(`cover_${track.id}`, coverBlob);
    
    // 2. Save metadata (cleaned)
    const metadata = { ...track, audioFile: '', coverImage: '' };
    await fetchWithTimeout(`${BUCKET_URL}/t_${track.id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(metadata)
    });

    // 3. Update global track index
    const ids = await storageService.getIndex(TRACK_INDEX_KEY);
    if (!ids.includes(track.id)) {
      ids.push(track.id);
      await storageService.saveIndex(TRACK_INDEX_KEY, ids);
    }
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    // We just remove it from the index for speed
    const ids = await storageService.getIndex(TRACK_INDEX_KEY);
    const newIds = ids.filter(id => id !== trackId);
    await storageService.saveIndex(TRACK_INDEX_KEY, newIds);
    // Real deletion of individual keys can be done as a cleanup task
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

  // Fix error on file App.tsx on line 338: Toggle track in user's saved list
  toggleSavedTrack: async (userId: string, trackId: string): Promise<void> => {
    const res = await fetchWithTimeout(`${BUCKET_URL}/u_${userId}`);
    if (res.ok) {
      const user: User = await res.json();
      if (!user.savedTrackIds) user.savedTrackIds = [];
      
      const index = user.savedTrackIds.indexOf(trackId);
      if (index === -1) {
        user.savedTrackIds.push(trackId);
      } else {
        user.savedTrackIds.splice(index, 1);
      }
      
      await storageService.saveUser(user);
    }
  },

  getAuth: (): AuthState => {
    const data = localStorage.getItem(AUTH_KEY);
    return data ? JSON.parse(data) : { user: null, isAuthenticated: false, theme: 'system', language: 'ru' };
  },

  setAuth: (auth: AuthState) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
  }
};
