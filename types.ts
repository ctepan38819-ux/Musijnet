
export interface User {
  id: string;
  username: string;
  avatar: string;
  isAdmin: boolean;
  isDeveloper?: boolean;
  savedTrackIds?: string[]; // IDs of tracks saved to collection
  savedArtistIds?: string[]; // IDs of artists followed
}

export type TrackStatus = 'pending' | 'approved' | 'rejected';
export type ReleaseType = 'single' | 'album';

export interface Track {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  artistAvatar: string;
  coverImage: string; // Base64 image
  audioFile: string;  // Base64 audio
  isExplicit: boolean;
  status: TrackStatus;
  releaseType: ReleaseType;
  createdAt: number;
}

export interface Playlist {
  id: string;
  title: string;
  ownerId: string;
  trackIds: string[];
  isVisible: boolean; // Public/Private
  createdAt: number;
}

export type AppTheme = 'red-black' | 'red-white' | 'system';
export type AppLanguage = 'en' | 'ru';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  theme: AppTheme;
  language: AppLanguage;
}

export interface SyncData {
  users: User[];
  tracks: Track[];
  playlists: Playlist[];
  timestamp: number;
}
