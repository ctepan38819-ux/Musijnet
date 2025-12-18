
import { User, Track, AuthState } from '../types';

const AUTH_KEY = 'musijnet_session';
const USERS_KEY = 'musijnet_local_users';
const BUCKET_URL = 'https://kvdb.io/Mo7Xz5P6eE6zVqY1HqNqfU';
const MANIFEST_KEY = 'musijnet_manifest_v3';

export const storageService = {
  // Remote Fetching with robust options
  getRemoteManifest: async (): Promise<{ tracks: Track[], users: User[] }> => {
    try {
      const response = await fetch(`${BUCKET_URL}/${MANIFEST_KEY}`, {
        mode: 'cors',
        credentials: 'omit'
      });
      if (response.status === 404) return { tracks: [], users: [] };
      if (!response.ok) throw new Error('Cloud manifest offline');
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
      audioFile: '', // Never store audio in manifest
      // Keep cover image but maybe check size?
    }));
    
    try {
      const response = await fetch(`${BUCKET_URL}/${MANIFEST_KEY}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: cleanTracks, users: data.users }),
      });
      if (!response.ok) throw new Error(`Manifest save error: ${response.status}`);
      
      localStorage.setItem('musijnet_fallback_tracks', JSON.stringify(cleanTracks));
      localStorage.setItem('musijnet_fallback_users', JSON.stringify(data.users));
    } catch (err) {
      console.error("Failed to save manifest", err);
      throw new Error("Ошибка синхронизации списка песен.");
    }
  },

  saveAudioBlob: async (trackId: string, audioData: string): Promise<void> => {
    try {
      const response = await fetch(`${BUCKET_URL}/audio_${trackId}`, {
        method: 'PUT',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' }, // Send as plain text for max compatibility
        body: audioData,
      });
      
      if (!response.ok) {
        if (response.status === 413) throw new Error('Файл слишком велик для облака (лимит 1.5MB)');
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error("Ошибка сети: файл слишком велик или сервер недоступен.");
      }
      throw err;
    }
  },

  getAudioBlob: async (trackId: string): Promise<string> => {
    const response = await fetch(`${BUCKET_URL}/audio_${trackId}`, {
      mode: 'cors'
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
    if (!remote.users.find(u => u.id === user.id)) {
      remote.users.push(user);
      await storageService.saveRemoteManifest(remote);
    }
    const localUsers = storageService.getUsers();
    localUsers.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
  },

  getTracks: async (): Promise<Track[]> => {
    const remote = await storageService.getRemoteManifest();
    return remote.tracks;
  },

  saveTrack: async (track: Track): Promise<void> => {
    // 1. Save audio first (the heavy part)
    await storageService.saveAudioBlob(track.id, track.audioFile);
    // 2. Then save metadata to manifest
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
