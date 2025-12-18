
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
const USERS_KEY = 'musijnet_local_users';
// Standard-like bucket ID for better reliability with KVDB
const BUCKET_URL = 'https://kvdb.io/N4m9xR2pW5tQ8vK1zL7j';
const MANIFEST_KEY = 'musijnet_manifest_v6';

const fetchWithTimeout = async (url: string, options: any = {}, timeout = 45000) => {
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
  getRemoteManifest: async (): Promise<{ tracks: Track[], users: User[] }> => {
    try {
      const response = await fetchWithTimeout(`${BUCKET_URL}/${MANIFEST_KEY}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });
      if (response.status === 404) return { tracks: [], users: [] };
      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      const text = await response.text();
      return text ? JSON.parse(text) : { tracks: [], users: [] };
    } catch (e) {
      console.warn("Manifest sync failed, using local fallback", e);
      const localTracks = localStorage.getItem('musijnet_fallback_tracks');
      const localUsers = localStorage.getItem('musijnet_fallback_users');
      return {
        tracks: localTracks ? JSON.parse(localTracks) : [],
        users: localUsers ? JSON.parse(localUsers) : []
      };
    }
  },

  saveRemoteManifest: async (data: { tracks: Track[], users: User[] }): Promise<void> => {
    // Ensure we don't store large base64 data in the manifest
    const cleanTracks = data.tracks.map(t => ({ 
      ...t, 
      audioFile: '', 
      coverImage: t.coverImage?.startsWith('data:') ? '' : t.coverImage // Only keep references or empty
    }));
    
    try {
      const response = await fetchWithTimeout(`${BUCKET_URL}/${MANIFEST_KEY}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: cleanTracks, users: data.users }),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сохранения манифеста (${response.status}). Возможно, база данных переполнена.`);
      }
      
      localStorage.setItem('musijnet_fallback_tracks', JSON.stringify(cleanTracks));
      localStorage.setItem('musijnet_fallback_users', JSON.stringify(data.users));
    } catch (err: any) {
      console.error("Failed to save manifest", err);
      throw new Error(err.message || "Ошибка синхронизации базы данных.");
    }
  },

  saveBlob: async (id: string, blob: Blob): Promise<void> => {
    try {
      const response = await fetchWithTimeout(`${BUCKET_URL}/${id}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
      }, 60000);
      
      if (!response.ok) {
        if (response.status === 413) throw new Error('Файл слишком велик (лимит 1МБ)');
        throw new Error(`Ошибка сервера при загрузке контента: ${response.status}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error("Таймаут загрузки.");
      throw err;
    }
  },

  getBlob: async (id: string): Promise<string> => {
    const response = await fetchWithTimeout(`${BUCKET_URL}/${id}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    });
    if (!response.ok) return '';
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: async (user: User) => {
    const remote = await storageService.getRemoteManifest();
    const existing = remote.users.findIndex(u => u.id === user.id);
    if (existing === -1) {
      remote.users.push(user);
    } else {
      remote.users[existing] = user;
    }
    await storageService.saveRemoteManifest(remote);
    
    const localUsers = storageService.getUsers();
    const lIdx = localUsers.findIndex(u => u.id === user.id);
    if (lIdx === -1) localUsers.push(user); else localUsers[lIdx] = user;
    localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
  },

  getTracks: async (): Promise<Track[]> => {
    const remote = await storageService.getRemoteManifest();
    return remote.tracks;
  },

  saveTrack: async (track: Track, audioBlob: Blob, coverBlob: Blob): Promise<void> => {
    // 1. Upload cover image
    await storageService.saveBlob(`cover_${track.id}`, coverBlob);
    // 2. Upload audio
    await storageService.saveBlob(`audio_${track.id}`, audioBlob);
    // 3. Save metadata
    const remote = await storageService.getRemoteManifest();
    // In manifest, we just clear the fields that are now in separate blobs
    const trackMetadata = { ...track, audioFile: '', coverImage: '' };
    remote.tracks.push(trackMetadata);
    await storageService.saveRemoteManifest(remote);
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    const remote = await storageService.getRemoteManifest();
    remote.tracks = remote.tracks.filter(t => t.id !== trackId);
    await storageService.saveRemoteManifest(remote);
    // Blobs will remain orphans on the server but we keep the manifest clean
  },

  updateTrackStatus: async (trackId: string, status: Track['status']): Promise<Track[]> => {
    const remote = await storageService.getRemoteManifest();
    const track = remote.tracks.find(t => t.id === trackId);
    if (track) {
      track.status = status;
      await storageService.saveRemoteManifest(remote);
    }
    return remote.tracks;
  },

  toggleSavedTrack: async (userId: string, trackId: string) => {
    const remote = await storageService.getRemoteManifest();
    const userIndex = remote.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const user = remote.users[userIndex];
      if (!user.savedTrackIds) user.savedTrackIds = [];
      const trackIndex = user.savedTrackIds.indexOf(trackId);
      if (trackIndex === -1) user.savedTrackIds.push(trackId);
      else user.savedTrackIds.splice(trackIndex, 1);
      await storageService.saveRemoteManifest(remote);
      
      const auth = storageService.getAuth();
      if (auth.user?.id === userId) {
        auth.user = user;
        storageService.setAuth(auth);
      }
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
