
import { User, Track, AuthState, Playlist } from '../types';

const AUTH_KEY = 'musijnet_session';
const USERS_KEY = 'musijnet_local_users';
// This bucket ID is unique to Musijnet global synchronization
const CLOUD_STORAGE_URL = 'https://kvdb.io/Mo7Xz5P6eE6zVqY1HqNqfU/musijnet_global_v2';

export const storageService = {
  isServerConnected: (): boolean => {
    return true; 
  },

  // Remote Fetching Logic
  getRemoteData: async (): Promise<{ tracks: Track[], users: User[] }> => {
    try {
      const response = await fetch(CLOUD_STORAGE_URL);
      if (!response.ok) throw new Error('Cloud offline');
      return await response.json();
    } catch (e) {
      console.warn("Cloud sync failed, falling back to local simulation", e);
      // Fallback to local if server is down
      const localTracks = localStorage.getItem('musijnet_fallback_tracks');
      const localUsers = localStorage.getItem('musijnet_fallback_users');
      return {
        tracks: localTracks ? JSON.parse(localTracks) : [],
        users: localUsers ? JSON.parse(localUsers) : []
      };
    }
  },

  saveRemoteData: async (data: { tracks: Track[], users: User[] }): Promise<void> => {
    try {
      await fetch(CLOUD_STORAGE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      // Save backup locally
      localStorage.setItem('musijnet_fallback_tracks', JSON.stringify(data.tracks));
      localStorage.setItem('musijnet_fallback_users', JSON.stringify(data.users));
    } catch (e) {
      console.error("Critical: Failed to push to Cloud Node", e);
    }
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: async (user: User) => {
    const remote = await storageService.getRemoteData();
    if (!remote.users.find(u => u.username.toLowerCase() === user.username.toLowerCase())) {
      remote.users.push(user);
      await storageService.saveRemoteData(remote);
    }
    // Also keep in local users for quick lookup
    const localUsers = storageService.getUsers();
    localUsers.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(localUsers));
  },

  getTracks: async (): Promise<Track[]> => {
    const remote = await storageService.getRemoteData();
    return remote.tracks;
  },

  saveTrack: async (track: Track): Promise<void> => {
    const remote = await storageService.getRemoteData();
    remote.tracks.push(track);
    await storageService.saveRemoteData(remote);
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    const remote = await storageService.getRemoteData();
    remote.tracks = remote.tracks.filter(t => t.id !== trackId);
    await storageService.saveRemoteData(remote);
  },

  updateTrackStatus: async (trackId: string, status: Track['status']): Promise<Track[]> => {
    const remote = await storageService.getRemoteData();
    const track = remote.tracks.find(t => t.id === trackId);
    if (track) {
      track.status = status;
      await storageService.saveRemoteData(remote);
    }
    return remote.tracks;
  },

  toggleSavedTrack: async (userId: string, trackId: string) => {
    const remote = await storageService.getRemoteData();
    const userIndex = remote.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const user = remote.users[userIndex];
      if (!user.savedTrackIds) user.savedTrackIds = [];
      const trackIndex = user.savedTrackIds.indexOf(trackId);
      if (trackIndex === -1) user.savedTrackIds.push(trackId);
      else user.savedTrackIds.splice(trackIndex, 1);
      await storageService.saveRemoteData(remote);
      
      // Update local session if it's the current user
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
