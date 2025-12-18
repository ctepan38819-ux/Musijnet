
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
const USERS_KEY = 'musijnet_local_users';
const BUCKET_URL = 'https://kvdb.io/Mo7Xz5P6eE6zVqY1HqNqfU';
const MANIFEST_KEY = 'musijnet_manifest_v3';

// Helper for fetch with timeout
const fetchWithTimeout = async (url: string, options: any = {}, timeout = 15000) => {
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
      if (!response.ok) throw new Error('Сервер манифеста недоступен');
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
    const cleanTracks = data.tracks.map(t => ({ 
      ...t, 
      audioFile: '', 
    }));
    
    try {
      const response = await fetchWithTimeout(`${BUCKET_URL}/${MANIFEST_KEY}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: cleanTracks, users: data.users }),
      });
      if (!response.ok) throw new Error(`Ошибка сохранения: ${response.status}`);
      
      localStorage.setItem('musijnet_fallback_tracks', JSON.stringify(cleanTracks));
      localStorage.setItem('musijnet_fallback_users', JSON.stringify(data.users));
    } catch (err) {
      console.error("Failed to save manifest", err);
      throw new Error("Ошибка синхронизации базы данных.");
    }
  },

  saveAudioBlob: async (trackId: string, audioData: string): Promise<void> => {
    try {
      const response = await fetchWithTimeout(`${BUCKET_URL}/audio_${trackId}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: audioData,
      }, 30000); // 30s for audio upload
      
      if (!response.ok) {
        if (response.status === 413) throw new Error('Файл превышает лимит сервера (1МБ)');
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error("Время ожидания истекло. Файл слишком большой?");
      if (err instanceof TypeError) throw new Error("Ошибка сети: проверьте подключение или размер файла (лимит 1МБ).");
      throw err;
    }
  },

  getAudioBlob: async (trackId: string): Promise<string> => {
    const response = await fetchWithTimeout(`${BUCKET_URL}/audio_${trackId}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Аудио не найдено на сервере');
    return await response.text();
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

  saveTrack: async (track: Track): Promise<void> => {
    // 1. Save audio first
    await storageService.saveAudioBlob(track.id, track.audioFile);
    // 2. Then save to manifest
    const remote = await storageService.getRemoteManifest();
    remote.tracks.push(track);
    await storageService.saveRemoteManifest(remote);
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    const remote = await storageService.getRemoteManifest();
    remote.tracks = remote.tracks.filter(t => t.id !== trackId);
    await storageService.saveRemoteManifest(remote);
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
