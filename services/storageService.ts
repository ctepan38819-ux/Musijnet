
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
// Incremented node version to ensure clean start and avoid 404 on legacy indexes
const BUCKET_URL = 'https://kvdb.io/MN_PROD_NODE_V9_ATOMIC';

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
  getIndex: async (key: string): Promise<string[]> => {
    try {
      const res = await fetchWithTimeout(`${BUCKET_URL}/${key}`, { cache: 'no-store' });
      if (res.status === 404) return [];
      const text = await res.text();
      return text ? JSON.parse(text) : [];
    } catch { return []; }
  },

  saveIndex: async (key: string, ids: string[]): Promise<void> => {
    await fetchWithTimeout(`${BUCKET_URL}/${key}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(ids)
    });
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

  saveBlob: async (id: string, blob: Blob): Promise<void> => {
    const res = await fetchWithTimeout(`${BUCKET_URL}/${id}`, {
      method: 'PUT',
      mode: 'cors',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blob,
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
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
    await storageService.saveBlob(`audio_${track.id}`, audioBlob);
    await storageService.saveBlob(`cover_${track.id}`, coverBlob);
    const metadata = { ...track, audioFile: '', coverImage: '' };
    await fetchWithTimeout(`${BUCKET_URL}/t_${track.id}`, {
      method: 'PUT',
      mode: 'cors',
      body: JSON.stringify(metadata)
    });
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
