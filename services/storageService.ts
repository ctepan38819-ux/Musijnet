
import { User, Track, AuthState, Playlist, SyncData } from '../types';

const USERS_KEY = 'musijnet_users';
const AUTH_KEY = 'musijnet_session';
const DB_NAME = 'musijnet_db';
const TRACKS_STORE = 'tracks';
const PLAYLISTS_STORE = 'playlists';

// IndexedDB Initialization for large audio/image data
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4); 
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
  // Now returns true by default to simulate immediate server connection
  isServerConnected: (): boolean => {
    return true; 
  },

  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveUser: (user: User) => {
    const users = storageService.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    storageService.syncToServer();
  },

  updateUserRole: (userId: string, isAdmin: boolean) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      users[userIndex].isAdmin = isAdmin;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      storageService.syncToServer();
    }
  },

  toggleSavedTrack: (userId: string, trackId: string) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const user = users[userIndex];
      if (!user.savedTrackIds) user.savedTrackIds = [];
      const trackIndex = user.savedTrackIds.indexOf(trackId);
      if (trackIndex === -1) user.savedTrackIds.push(trackId);
      else user.savedTrackIds.splice(trackIndex, 1);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      storageService.syncToServer();
    }
  },

  toggleSavedArtist: (userId: string, artistId: string) => {
    const users = storageService.getUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      const user = users[userIndex];
      if (!user.savedArtistIds) user.savedArtistIds = [];
      const artistIndex = user.savedArtistIds.indexOf(artistId);
      if (artistIndex === -1) user.savedArtistIds.push(artistId);
      else user.savedArtistIds.splice(artistIndex, 1);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      storageService.syncToServer();
    }
  },

  getTracks: async (): Promise<Track[]> => {
    const db = await initDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(TRACKS_STORE, 'readonly');
      const store = transaction.objectStore(TRACKS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  },

  saveTrack: async (track: Track): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction(TRACKS_STORE, 'readwrite');
    transaction.objectStore(TRACKS_STORE).put(track);
    return new Promise((resolve) => {
      transaction.oncomplete = () => {
        storageService.syncToServer();
        resolve();
      };
    });
  },

  deleteTrack: async (trackId: string): Promise<void> => {
    const db = await initDB();
    const transaction = db.transaction(TRACKS_STORE, 'readwrite');
    transaction.objectStore(TRACKS_STORE).delete(trackId);
    return new Promise((resolve) => {
      transaction.oncomplete = () => {
        storageService.syncToServer();
        resolve();
      };
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

  // AUTOMATIC SYNC - Simulates background push to the central Vercel node
  syncToServer: async (): Promise<void> => {
    console.log("Pushing updates to Musijnet Central Node...");
    // In a production environment, this would call a Vercel Serverless Function
    // for now we ensure state consistency locally to simulate the persistence.
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
