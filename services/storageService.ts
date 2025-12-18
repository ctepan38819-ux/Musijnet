
import { User, Track, AuthState, Playlist, SyncData } from '../types';

const USERS_KEY = 'musijnet_users';
const AUTH_KEY = 'musijnet_session';
const DB_NAME = 'musijnet_db';
const TRACKS_STORE = 'tracks';
const PLAYLISTS_STORE = 'playlists';
const GLOBAL_SYNC_KEY = 'musijnet_global_sync_key';

// IndexedDB Initialization
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2); 
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACKS_STORE)) {
        db.createObjectStore(TRACKS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storageService = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: (user: User) => {
    const users = storageService.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  updateUserRole: (userId: string, isAdmin: boolean) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].isAdmin = isAdmin;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      const currentAuth = storageService.getAuth();
      if (currentAuth.user && currentAuth.user.id === userId) {
        currentAuth.user.isAdmin = isAdmin;
        storageService.setAuth(currentAuth);
      }
    }
  },

  toggleSavedTrack: (userId: string, trackId: string) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const user = users[userIndex];
      if (!user.savedTrackIds) user.savedTrackIds = [];
      
      const trackIndex = user.savedTrackIds.indexOf(trackId);
      if (trackIndex === -1) {
        user.savedTrackIds.push(trackId);
      } else {
        user.savedTrackIds.splice(trackIndex, 1);
      }
      
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      const currentAuth = storageService.getAuth();
      if (currentAuth.user && currentAuth.user.id === userId) {
        currentAuth.user = { ...user };
        storageService.setAuth(currentAuth);
      }
    }
  },

  toggleSavedArtist: (userId: string, artistId: string) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const user = users[userIndex];
      if (!user.savedArtistIds) user.savedArtistIds = [];
      
      const artistIndex = user.savedArtistIds.indexOf(artistId);
      if (artistIndex === -1) {
        user.savedArtistIds.push(artistId);
      } else {
        user.savedArtistIds.splice(artistIndex, 1);
      }
      
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      
      const currentAuth = storageService.getAuth();
      if (currentAuth.user && currentAuth.user.id === userId) {
        currentAuth.user = { ...user };
        storageService.setAuth(currentAuth);
      }
    }
  },

  // Track Methods
  getTracks: async (): Promise<Track[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  saveTrack: async (track: Track): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.put(track);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TRACKS_STORE, 'readwrite');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.delete(trackId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  updateTrackStatus: async (trackId: string, status: Track['status']): Promise<Track[]> => {
    const db = await initDB();
    const tracks = await storageService.getTracks();
    const track = tracks.find(t => t.id === trackId);
    
    if (track) {
      track.status = status;
      await storageService.saveTrack(track);
    }
    
    return storageService.getTracks();
  },

  // Playlist Methods
  getPlaylists: async (): Promise<Playlist[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readonly');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  savePlaylist: async (playlist: Playlist): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.put(playlist);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  deletePlaylist: async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = transaction.objectStore(PLAYLISTS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // Cloud Sync Logic (Server Simulation)
  getGlobalSyncKey: (): string | null => {
    return localStorage.getItem(GLOBAL_SYNC_KEY);
  },

  setGlobalSyncKey: (key: string) => {
    localStorage.setItem(GLOBAL_SYNC_KEY, key);
  },

  exportCloudData: async (): Promise<string> => {
    const users = storageService.getUsers();
    const tracks = await storageService.getTracks();
    const playlists = await storageService.getPlaylists();
    
    const data: SyncData = {
      users,
      tracks,
      playlists,
      timestamp: Date.now()
    };
    
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  },

  importCloudData: async (syncKey: string): Promise<boolean> => {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(syncKey)))) as SyncData;
      if (!decoded.users || !decoded.tracks) return false;
      
      // Save users to localStorage
      localStorage.setItem(USERS_KEY, JSON.stringify(decoded.users));
      
      // Save tracks/playlists to IndexedDB
      const db = await initDB();
      
      const clearTracks = db.transaction(TRACKS_STORE, 'readwrite').objectStore(TRACKS_STORE).clear();
      const clearPlaylists = db.transaction(PLAYLISTS_STORE, 'readwrite').objectStore(PLAYLISTS_STORE).clear();
      
      await new Promise(r => clearTracks.onsuccess = r);
      await new Promise(r => clearPlaylists.onsuccess = r);
      
      const trackTx = db.transaction(TRACKS_STORE, 'readwrite');
      decoded.tracks.forEach(t => trackTx.objectStore(TRACKS_STORE).put(t));
      
      const playlistTx = db.transaction(PLAYLISTS_STORE, 'readwrite');
      decoded.playlists.forEach(p => playlistTx.objectStore(PLAYLISTS_STORE).put(p));
      
      storageService.setGlobalSyncKey(syncKey);
      return true;
    } catch (e) {
      console.error("Sync Error:", e);
      return false;
    }
  },

  getAuth: (): AuthState => {
    const data = localStorage.getItem(AUTH_KEY);
    if (!data) return { user: null, isAuthenticated: false, theme: 'system', language: 'ru' };
    try {
      return JSON.parse(data);
    } catch {
      return { user: null, isAuthenticated: false, theme: 'system', language: 'ru' };
    }
  },

  setAuth: (auth: AuthState) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
  }
};
