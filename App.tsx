
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Track, AuthState, AppTheme, AppLanguage, Playlist, ReleaseType } from './types';
import { storageService } from './services/storageService';
import { Logo, APP_NAME } from './constants';
import { translations } from './translations';
import { 
  Upload, 
  LogOut, 
  User as UserIcon, 
  Music, 
  ShieldCheck, 
  Home, 
  PlusCircle, 
  Volume2,
  X,
  Settings,
  Camera,
  Image as ImageIcon,
  CheckCircle,
  Play,
  Pause,
  Search,
  Loader2,
  Lock,
  Mic2,
  ListMusic,
  Eye,
  EyeOff,
  Plus,
  Crown,
  UserPlus,
  UserMinus,
  Sparkles,
  Library,
  Heart
} from 'lucide-react';
import TrackCard from './components/TrackCard';
import SecretGame from './components/SecretGame';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => storageService.getAuth());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(storageService.getUsers());
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [view, setView] = useState<'home' | 'upload' | 'admin' | 'profile' | 'settings' | 'playlist' | 'library' | 'moderators'>('home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Audio Player Logic
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);

  // Upload States
  const [uploadTitle, setUploadTitle] = useState('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [trackCover, setTrackCover] = useState<string | null>(null);
  const [trackAudio, setTrackAudio] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadReleaseType, setUploadReleaseType] = useState<ReleaseType>('single');

  // Playlist States
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [newPlaylistVisible, setNewPlaylistVisible] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [trackToAdd, setTrackToAdd] = useState<string | null>(null);

  // Secret Game
  const [isSecretGameOpen, setIsSecretGameOpen] = useState(false);
  const keySequence = useRef<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const trackCoverRef = useRef<HTMLInputElement>(null);
  const trackAudioRef = useRef<HTMLInputElement>(null);

  const t = translations[auth.language];

  // Load data and Sync Session
  useEffect(() => {
    const syncSession = () => {
      const currentUsers = storageService.getUsers();
      if (auth.isAuthenticated && auth.user) {
        const freshUserData = currentUsers.find(u => u.id === auth.user?.id);
        if (freshUserData) {
          const updatedAuth = { ...auth, user: freshUserData };
          setAuth(updatedAuth);
          storageService.setAuth(updatedAuth);
        } else {
          handleLogout();
        }
      }
    };

    const loadInitialData = async () => {
      try {
        const [storedTracks, storedPlaylists] = await Promise.all([
          storageService.getTracks(),
          storageService.getPlaylists()
        ]);
        setTracks(storedTracks);
        setPlaylists(storedPlaylists);
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setIsLoadingTracks(false);
      }
    };

    syncSession();
    loadInitialData();
  }, []);

  // Easter Egg Listener
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (view !== 'profile') return;
      
      const char = e.key.toUpperCase();
      keySequence.current += char;
      if (keySequence.current.length > 4) {
        keySequence.current = keySequence.current.slice(-4);
      }

      if (keySequence.current === 'YTWD' || keySequence.current === 'НЕЦВ') {
        setIsSecretGameOpen(true);
        keySequence.current = '';
      }
    };

    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [view]);

  useEffect(() => {
    const applyTheme = (theme: AppTheme) => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      let effectiveTheme = theme;
      if (theme === 'system') effectiveTheme = isDark ? 'red-black' : 'red-white';
      
      document.body.classList.remove('theme-red-white');
      if (effectiveTheme === 'red-white') {
        document.body.classList.add('theme-red-white');
      }
    };
    applyTheme(auth.theme);
  }, [auth.theme]);

  useEffect(() => {
    if (nowPlaying) {
      if (!audioRef.current) audioRef.current = new Audio();
      if (audioRef.current.src !== nowPlaying.audioFile) {
        audioRef.current.src = nowPlaying.audioFile;
      }
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);

      const updateTime = () => setCurrentTime(audioRef.current?.currentTime || 0);
      const updateDuration = () => setDuration(audioRef.current?.duration || 0);
      const handleEnded = () => setIsPlaying(false);

      audioRef.current.addEventListener('timeupdate', updateTime);
      audioRef.current.addEventListener('loadedmetadata', updateDuration);
      audioRef.current.addEventListener('ended', handleEnded);

      return () => {
        audioRef.current?.removeEventListener('timeupdate', updateTime);
        audioRef.current?.removeEventListener('loadedmetadata', updateDuration);
        audioRef.current?.removeEventListener('ended', handleEnded);
      };
    }
  }, [nowPlaying]);

  const togglePlay = () => {
    if (audioRef.current) {
      isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => {});
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);

    setTimeout(() => {
      const users = storageService.getUsers();
      
      if (authMode === 'login') {
        const user = users.find(u => 
          u.username.toLowerCase() === loginUsername.toLowerCase() && 
          (u as any).password === loginPassword
        );
        if (user) {
          const newAuth: AuthState = { ...auth, user, isAuthenticated: true };
          setAuth(newAuth);
          storageService.setAuth(newAuth);
          setIsLoginModalOpen(false);
          resetAuthForm();
        } else {
          alert(t.authError);
        }
      } else {
        if (users.some(u => u.username.toLowerCase() === loginUsername.toLowerCase())) {
          alert("Username already taken");
          setIsAuthenticating(false);
          return;
        }

        const normalizedUsername = loginUsername.toLowerCase();
        const isEletro = normalizedUsername === 'eletro';
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          username: loginUsername,
          password: loginPassword,
          avatar: tempAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginUsername}`,
          isAdmin: isEletro || normalizedUsername.includes('admin'),
          isDeveloper: isEletro,
          savedTrackIds: [],
          savedArtistIds: []
        } as any;
        
        storageService.saveUser(newUser);
        setAllUsers(storageService.getUsers());
        const newAuth: AuthState = { ...auth, user: newUser, isAuthenticated: true };
        setAuth(newAuth);
        storageService.setAuth(newAuth);
        setIsLoginModalOpen(false);
        resetAuthForm();
      }
      setIsAuthenticating(false);
    }, 1000);
  };

  const resetAuthForm = () => {
    setLoginUsername('');
    setLoginPassword('');
    setTempAvatar(null);
  };

  const handleLogout = () => {
    storageService.logout();
    setAuth(prev => ({ ...prev, user: null, isAuthenticated: false }));
    setView('home');
    setNowPlaying(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !trackCover || !trackAudio || !auth.user) return;
    setIsUploading(true);
    try {
      const newTrack: Track = {
        id: Math.random().toString(36).substr(2, 9),
        title: uploadTitle,
        artistId: auth.user.id,
        artistName: auth.user.username,
        artistAvatar: auth.user.avatar,
        coverImage: trackCover,
        audioFile: trackAudio,
        isExplicit: isExplicit,
        releaseType: uploadReleaseType,
        status: 'pending',
        createdAt: Date.now()
      };
      await storageService.saveTrack(newTrack);
      setTracks(await storageService.getTracks());
      setUploadTitle('');
      setIsExplicit(false);
      setTrackCover(null);
      setTrackAudio(null);
      setView('profile');
    } catch (e) {
      alert("Error saving track.");
    } finally { setIsUploading(false); }
  };

  const handleTrackDelete = async (id: string) => {
    await storageService.deleteTrack(id);
    setTracks(await storageService.getTracks());
    if (nowPlaying?.id === id) {
      setNowPlaying(null);
      audioRef.current?.pause();
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle || !auth.user) return;
    const newP: Playlist = {
      id: Math.random().toString(36).substr(2, 9),
      title: newPlaylistTitle,
      ownerId: auth.user.id,
      trackIds: [],
      isVisible: newPlaylistVisible,
      createdAt: Date.now()
    };
    await storageService.savePlaylist(newP);
    setPlaylists(await storageService.getPlaylists());
    setNewPlaylistTitle('');
    setIsPlaylistModalOpen(false);
  };

  const addTrackToPlaylist = async (playlistId: string) => {
    if (!trackToAdd) return;
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && !playlist.trackIds.includes(trackToAdd)) {
      playlist.trackIds.push(trackToAdd);
      await storageService.savePlaylist(playlist);
      setPlaylists(await storageService.getPlaylists());
    }
    setIsAddToPlaylistModalOpen(false);
    setTrackToAdd(null);
  };

  const handleToggleSaveTrack = (trackId: string) => {
    if (!auth.user) return;
    storageService.toggleSavedTrack(auth.user.id, trackId);
    setAuth(storageService.getAuth());
    setAllUsers(storageService.getUsers());
  };

  const handleToggleSaveArtist = (artistId: string) => {
    if (!auth.user) return;
    storageService.toggleSavedArtist(auth.user.id, artistId);
    setAuth(storageService.getAuth());
    setAllUsers(storageService.getUsers());
  };

  const handleUserRoleToggle = (userId: string, currentIsAdmin: boolean) => {
    storageService.updateUserRole(userId, !currentIsAdmin);
    setAllUsers(storageService.getUsers());
  };

  const handleStatusChange = async (id: string, status: Track['status']) => {
    const updatedTracks = await storageService.updateTrackStatus(id, status);
    setTracks(updatedTracks);
  };

  const updateTheme = (newTheme: AppTheme) => {
    const newAuth = { ...auth, theme: newTheme };
    setAuth(newAuth);
    storageService.setAuth(newAuth);
  };

  const updateLanguage = (newLang: AppLanguage) => {
    const newAuth = { ...auth, language: newLang };
    setAuth(newAuth);
    storageService.setAuth(newAuth);
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let baseTracks = tracks;
    
    if (view === 'home') baseTracks = tracks.filter(t => t.status === 'approved');
    else if (view === 'profile') baseTracks = tracks.filter(t => t.artistId === auth.user?.id);
    else if (view === 'admin') baseTracks = tracks.filter(t => t.status === 'pending');
    else if (view === 'library') {
      baseTracks = tracks.filter(t => 
        t.artistId === auth.user?.id || 
        auth.user?.savedTrackIds?.includes(t.id)
      );
    }
    else if (view === 'playlist' && selectedPlaylist) {
      baseTracks = tracks.filter(t => selectedPlaylist.trackIds.includes(t.id));
    }

    const artistData = new Map();
    baseTracks.forEach(t => {
      if (!artistData.has(t.artistId)) {
        const fullUser = allUsers.find(u => u.id === t.artistId);
        artistData.set(t.artistId, { 
          id: t.artistId, 
          name: t.artistName, 
          avatar: t.artistAvatar,
          isAdmin: fullUser?.isAdmin || false,
          isDeveloper: fullUser?.isDeveloper || false
        });
      }
    });

    // Add followed artists to the artist list if in Home or Search
    if ((view === 'home' || q) && auth.user?.savedArtistIds) {
      auth.user.savedArtistIds.forEach(id => {
        if (!artistData.has(id)) {
          const u = allUsers.find(user => user.id === id);
          if (u) {
            artistData.set(id, {
              id: u.id,
              name: u.username,
              avatar: u.avatar,
              isAdmin: u.isAdmin,
              isDeveloper: u.isDeveloper
            });
          }
        }
      });
    }

    let songs = baseTracks;
    let artists = Array.from(artistData.values());
    let visiblePlaylists = playlists;
    
    if (view === 'library') {
      visiblePlaylists = playlists.filter(p => p.ownerId === auth.user?.id);
    } else {
      visiblePlaylists = playlists.filter(p => p.isVisible || p.ownerId === auth.user?.id);
    }

    if (q) {
      songs = baseTracks.filter(t => t.title.toLowerCase().includes(q));
      artists = artists.filter(a => a.name.toLowerCase().includes(q));
      visiblePlaylists = visiblePlaylists.filter(p => p.title.toLowerCase().includes(q));
    }

    return { songs, artists, playlists: visiblePlaylists };
  }, [tracks, playlists, view, auth.user, searchQuery, selectedPlaylist, allUsers]);

  const moderators = useMemo(() => {
    return allUsers.filter(u => u.isAdmin && !u.isDeveloper);
  }, [allUsers]);

  const nonAdminUsers = useMemo(() => {
    return allUsers.filter(u => !u.isAdmin);
  }, [allUsers]);

  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="flex flex-col min-h-screen pb-32">
      {isSecretGameOpen && <SecretGame onClose={() => setIsSecretGameOpen(false)} />}
      
      <header className="sticky top-0 z-40 bg-red-600 text-white shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => { setView('home'); setSearchQuery(''); }}>
            <Logo className="w-10 h-10 drop-shadow-lg group-hover:rotate-12 transition-transform" />
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">{APP_NAME}</h1>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setView('home')} className={`font-black uppercase italic text-xs ${view === 'home' ? 'opacity-100 underline decoration-4' : 'opacity-70 hover:opacity-100'}`}>{t.home}</button>
            {auth.isAuthenticated && (
              <>
                <button onClick={() => setView('library')} className={`font-black uppercase italic text-xs ${view === 'library' ? 'opacity-100 underline decoration-4' : 'opacity-70 hover:opacity-100'}`}>{t.library}</button>
                <button onClick={() => setView('profile')} className={`font-black uppercase italic text-xs ${view === 'profile' ? 'opacity-100 underline decoration-4' : 'opacity-70 hover:opacity-100'}`}>{t.stage}</button>
                {auth.user?.isAdmin && (
                  <button onClick={() => setView('admin')} className={`font-black uppercase italic text-xs ${view === 'admin' ? 'opacity-100 underline decoration-4' : 'opacity-70 hover:opacity-100'}`}>{t.moderation}</button>
                )}
                {auth.user?.isDeveloper && (
                  <button onClick={() => setView('moderators')} className={`font-black uppercase italic text-xs ${view === 'moderators' ? 'opacity-100 underline decoration-4' : 'opacity-70 hover:opacity-100'}`}>{t.moderators}</button>
                )}
              </>
            )}
            <button onClick={() => setView('settings')} className={`font-black uppercase italic text-xs ${view === 'settings' ? 'opacity-100 underline decoration-4' : 'opacity-70 hover:opacity-100'}`}>{t.settings}</button>
          </nav>

          <div className="flex items-center gap-4">
            {auth.isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setView('upload')} className="bg-white text-red-600 px-4 py-1.5 rounded-full font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform">{t.upload}</button>
                <div className="w-10 h-10 rounded-full border-2 border-white/50 cursor-pointer overflow-hidden shadow-lg relative" onClick={() => setView('profile')}>
                  <img src={auth.user?.avatar} className="w-full h-full object-cover" alt="avatar" />
                  {auth.user?.isDeveloper && <div className="absolute -top-1 -right-1 bg-yellow-400 p-0.5 rounded-full"><Sparkles className="w-2.5 h-2.5 text-red-600 fill-red-600" /></div>}
                </div>
                <button onClick={handleLogout} className="p-2 opacity-70 hover:opacity-100 transition-opacity"><LogOut className="w-5 h-5" /></button>
              </div>
            ) : (
              <button onClick={() => setIsLoginModalOpen(true)} className="bg-white text-red-600 px-6 py-2 rounded-full font-black text-xs uppercase shadow-lg hover:scale-105 transition-transform">{t.login}</button>
            )}
          </div>
        </div>
      </header>

      {(view === 'home' || view === 'profile' || view === 'playlist' || view === 'library') && (
        <div className="bg-red-600/5 py-8 border-b border-red-500/10 mb-8">
          <div className="max-w-4xl mx-auto px-4">
            <div className="relative group">
               <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                  <Search className="w-6 h-6 opacity-30 group-focus-within:opacity-100 group-focus-within:text-red-600 transition-all" />
               </div>
               <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="w-full pl-16 pr-6 py-6 rounded-[32px] app-card font-black text-xl outline-none focus:ring-8 ring-red-500/10 transition-all placeholder-red-900/20"
               />
               {searchQuery && (
                 <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-6 flex items-center p-2 opacity-40 hover:opacity-100"><X className="w-6 h-6" /></button>
               )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {isLoadingTracks ? (
          <div className="flex items-center justify-center py-40"><Loader2 className="w-12 h-12 text-red-600 animate-spin" /></div>
        ) : (view === 'home' || view === 'playlist' || view === 'library') ? (
          <section>
            <div className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <h2 className="text-6xl font-black italic uppercase tracking-tighter mb-4" style={{ color: 'var(--accent-red)' }}>
                  {view === 'library' ? t.library : view === 'playlist' ? selectedPlaylist?.title : searchQuery ? `${t.searchResults} "${searchQuery}"` : t.topCharts}
                </h2>
                <p className="opacity-40 text-xl font-medium">{view === 'playlist' ? t.collection : view === 'library' ? t.myLibrary : t.chartsSub}</p>
              </div>
              {auth.isAuthenticated && (
                <button 
                  onClick={() => setIsPlaylistModalOpen(true)}
                  className="bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border-2 border-red-600 px-6 py-3 rounded-full font-black uppercase text-xs flex items-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" /> {t.createPlaylist}
                </button>
              )}
            </div>

            <div className="space-y-16">
              {filteredData.playlists.length > 0 && (
                <div>
                  <h3 className="text-3xl font-black uppercase italic mb-8 flex items-center gap-3" style={{ color: 'var(--accent-red)' }}>
                    <ListMusic className="w-8 h-8" /> {t.playlists}
                  </h3>
                  <div className="flex gap-6 overflow-x-auto pb-6 -mx-4 px-4 scrollbar-hide">
                    {filteredData.playlists.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => { setSelectedPlaylist(p); setView('playlist'); }}
                        className={`app-card flex-shrink-0 w-48 p-6 rounded-[32px] cursor-pointer group transition-all ${selectedPlaylist?.id === p.id ? 'border-red-600 bg-red-600/5' : ''}`}
                      >
                        <div className="w-full aspect-square bg-red-900/10 rounded-2xl flex items-center justify-center mb-4 relative">
                          <Music className="w-12 h-12 text-red-600/20 group-hover:scale-110 transition-transform" />
                          <div className="absolute top-2 right-2">
                             {p.isVisible ? <Eye className="w-4 h-4 opacity-30" /> : <EyeOff className="w-4 h-4 text-red-600" />}
                          </div>
                        </div>
                        <p className="font-black uppercase italic text-sm truncate">{p.title}</p>
                        <p className="text-[10px] font-bold opacity-30 uppercase mt-1">{p.trackIds.length} {t.songs}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredData.artists.length > 0 && (view === 'home' || searchQuery) && (
                <div>
                  <h3 className="text-3xl font-black uppercase italic mb-8 flex items-center gap-3" style={{ color: 'var(--accent-red)' }}>
                    <Mic2 className="w-8 h-8" /> {t.artists}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {filteredData.artists.map(artist => {
                      const isFollowed = auth.user?.savedArtistIds?.includes(artist.id);
                      return (
                        <div key={artist.id} className="app-card p-6 rounded-[32px] text-center group transition-all relative">
                          <div className="relative w-24 h-24 mx-auto mb-4">
                            <img src={artist.avatar} className="w-full h-full rounded-full object-cover border-4 border-red-500/20 group-hover:border-red-500 transition-all" alt="" />
                            {artist.isDeveloper && <Crown className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 fill-yellow-400 drop-shadow-lg" />}
                            {artist.isAdmin && !artist.isDeveloper && <ShieldCheck className="absolute -top-1 -right-1 w-6 h-6 text-red-600 fill-white" />}
                            
                            {/* Follow Button */}
                            {auth.isAuthenticated && auth.user?.id !== artist.id && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleSaveArtist(artist.id); }}
                                className={`absolute -bottom-1 -right-1 p-2 rounded-full border-2 border-white transition-all shadow-xl ${isFollowed ? 'bg-red-600 text-white' : 'bg-white text-red-600 hover:scale-110'}`}
                                title={isFollowed ? t.unfollow : t.follow}
                              >
                                <Heart className={`w-3 h-3 ${isFollowed ? 'fill-white' : ''}`} />
                              </button>
                            )}
                          </div>
                          <p className="font-black uppercase italic text-sm truncate">{artist.name}</p>
                          {auth.user?.isDeveloper && !artist.isDeveloper && (
                            <div className="mt-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUserRoleToggle(artist.id, artist.isAdmin); }}
                                className={`p-2 rounded-full transition-all ${artist.isAdmin ? 'bg-black/10 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-red-600 text-white hover:scale-110'}`}
                                title={artist.isAdmin ? t.removeAdmin : t.makeAdmin}
                              >
                                {artist.isAdmin ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-3xl font-black uppercase italic mb-8 flex items-center gap-3" style={{ color: 'var(--accent-red)' }}>
                  <Music className="w-8 h-8" /> {t.songs}
                </h3>
                {filteredData.songs.length === 0 ? (
                  <p className="opacity-40 italic font-medium">{t.noTracks}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {filteredData.songs.map(track => (
                      <TrackCard 
                        key={track.id} 
                        track={track} 
                        onPlay={setNowPlaying} 
                        onDelete={handleTrackDelete}
                        onAddToPlaylist={(tid) => { setTrackToAdd(tid); setIsAddToPlaylistModalOpen(true); }}
                        onToggleSave={handleToggleSaveTrack}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : view === 'moderators' && auth.user?.isDeveloper ? (
          <section>
            <h2 className="text-5xl font-black italic uppercase mb-12 tracking-tighter" style={{ color: 'var(--accent-red)' }}>{t.moderators}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
               <div>
                  <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3 opacity-50"><ShieldCheck className="w-6 h-6" /> {t.moderatorList}</h3>
                  <div className="space-y-4">
                    {moderators.length === 0 ? <p className="italic opacity-30">{t.noModerators}</p> : moderators.map(u => (
                      <div key={u.id} className="app-card p-4 rounded-2xl flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <img src={u.avatar} className="w-12 h-12 rounded-full border-2 border-red-500/20" alt="" />
                            <span className="font-black uppercase italic text-lg">{u.username}</span>
                         </div>
                         <button onClick={() => handleUserRoleToggle(u.id, true)} className="p-3 bg-red-600/10 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all"><UserMinus className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
               </div>
               <div>
                  <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3 opacity-50"><UserIcon className="w-6 h-6" /> {t.allUsers}</h3>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-hide">
                    {nonAdminUsers.map(u => (
                      <div key={u.id} className="app-card p-4 rounded-2xl flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                         <div className="flex items-center gap-4">
                            <img src={u.avatar} className="w-12 h-12 rounded-full grayscale hover:grayscale-0 transition-all" alt="" />
                            <span className="font-black uppercase italic text-sm">{u.username}</span>
                         </div>
                         <button onClick={() => handleUserRoleToggle(u.id, false)} className="p-3 bg-red-600 text-white hover:scale-110 rounded-xl transition-all shadow-lg"><UserPlus className="w-5 h-5" /></button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </section>
        ) : view === 'settings' ? (
          <section className="max-w-2xl mx-auto">
            <h2 className="text-5xl font-black uppercase italic mb-12 tracking-tighter" style={{ color: 'var(--accent-red)' }}>{t.settings}</h2>
            <div className="app-card p-10 rounded-[40px] space-y-12 shadow-2xl">
              <div>
                <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3"><Settings className="w-6 h-6" /> {t.interfaceTheme}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {(['system', 'red-black', 'red-white'] as AppTheme[]).map(themeType => (
                    <button
                      key={themeType}
                      onClick={() => updateTheme(themeType)}
                      className={`p-6 rounded-3xl border-2 transition-all font-black uppercase text-[10px] flex flex-col items-center gap-4 ${auth.theme === themeType ? 'border-red-600 bg-red-600/10' : 'border-transparent bg-black/5 hover:bg-black/10'}`}
                    >
                      <div className={`w-12 h-12 rounded-full shadow-2xl ${themeType === 'red-black' ? 'bg-[#080808]' : themeType === 'red-white' ? 'bg-white' : 'bg-gradient-to-br from-[#080808] to-white'}`}></div>
                      {themeType.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3"><Music className="w-6 h-6" /> {t.language}</h3>
                <div className="grid grid-cols-2 gap-6">
                   <button onClick={() => updateLanguage('ru')} className={`p-6 rounded-3xl border-2 font-black uppercase text-sm transition-all ${auth.language === 'ru' ? 'border-red-600 bg-red-600/10 shadow-lg' : 'border-transparent bg-black/5'}`}>Русский</button>
                   <button onClick={() => updateLanguage('en')} className={`p-6 rounded-3xl border-2 font-black uppercase text-sm transition-all ${auth.language === 'en' ? 'border-red-600 bg-red-600/10 shadow-lg' : 'border-transparent bg-black/5'}`}>English</button>
                </div>
              </div>
              <div className="pt-8 border-t border-red-500/10 text-[10px] font-black uppercase opacity-30 text-center tracking-[0.2em]">
                {t.version}
              </div>
            </div>
          </section>
        ) : view === 'upload' ? (
           <section className="max-w-xl mx-auto">
            <div className="app-card p-10 rounded-[50px] shadow-2xl relative overflow-hidden">
              <h2 className="text-4xl font-black mb-10 uppercase italic flex items-center gap-4" style={{ color: 'var(--accent-red)' }}>
                <Upload className="w-10 h-10" /> {t.dropTrack}
              </h2>
              <form onSubmit={handleUpload} className="space-y-8">
                <div className="flex flex-col items-center gap-6">
                  <div onClick={() => trackCoverRef.current?.click()} className="w-56 h-56 rounded-3xl bg-black/5 border-2 border-dashed border-red-500/30 flex flex-col items-center justify-center cursor-pointer hover:bg-red-500/5 transition-all overflow-hidden relative group">
                    {trackCover ? (
                      <img src={trackCover} className="w-full h-full object-cover" alt="Cover" />
                    ) : (
                      <><ImageIcon className="w-12 h-12 mb-3 opacity-20" /><span className="text-[10px] font-black uppercase opacity-30 tracking-widest">{t.addCover}</span></>
                    )}
                  </div>
                  <input type="file" hidden ref={trackCoverRef} accept="image/*" onChange={(e) => handleFileChange(e, setTrackCover)} />
                </div>
                
                <div>
                   <label className="block text-[10px] font-black uppercase mb-3 opacity-40 tracking-widest">{t.releaseType}</label>
                   <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => setUploadReleaseType('single')} className={`py-4 rounded-2xl font-black uppercase text-xs transition-all border-2 ${uploadReleaseType === 'single' ? 'bg-red-600 text-white border-red-400' : 'bg-black/5 border-transparent opacity-50'}`}>{t.single}</button>
                      <button type="button" onClick={() => setUploadReleaseType('album')} className={`py-4 rounded-2xl font-black uppercase text-xs transition-all border-2 ${uploadReleaseType === 'album' ? 'bg-red-600 text-white border-red-400' : 'bg-black/5 border-transparent opacity-50'}`}>{t.album}</button>
                   </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase mb-3 opacity-40 tracking-widest">{t.trackTitle}</label>
                  <input type="text" required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="NEON RED" className="w-full rounded-2xl p-5 font-black text-xl outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase mb-3 opacity-40 tracking-widest">{t.audioFile}</label>
                  <div onClick={() => trackAudioRef.current?.click()} className="w-full p-5 rounded-2xl bg-black/5 border-2 border-red-500/20 text-center cursor-pointer hover:bg-red-500/5 transition-all flex items-center justify-center gap-3">
                    <Music className="w-6 h-6 opacity-30" /><span className="font-black text-sm">{trackAudio ? t.audioSelected : t.selectFile}</span>
                  </div>
                  <input type="file" hidden ref={trackAudioRef} accept="audio/*" onChange={(e) => handleFileChange(e, setTrackAudio)} />
                </div>
                <div className="flex items-center justify-between p-5 bg-black/5 rounded-2xl border border-red-500/10">
                  <span className="font-black text-xs uppercase italic flex items-center gap-3">
                    <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] border border-red-400">18+</span>{t.explicit}
                  </span>
                  <input type="checkbox" checked={isExplicit} onChange={(e) => setIsExplicit(e.target.checked)} className="w-8 h-8 accent-red-600 rounded-lg cursor-pointer" />
                </div>
                <button type="submit" disabled={isUploading} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3">
                  {isUploading ? <><Loader2 className="animate-spin" /> Uploading...</> : t.sendMod}
                </button>
              </form>
            </div>
           </section>
        ) : view === 'admin' ? (
          <section>
             <h2 className="text-5xl font-black italic uppercase mb-12 tracking-tighter" style={{ color: 'var(--accent-red)' }}>{t.modRoom}</h2>
             {filteredData.songs.length === 0 ? (
                <div className="app-card py-32 rounded-[60px] text-center opacity-30">
                  <ShieldCheck className="w-20 h-20 mx-auto mb-6" />
                  <p className="text-3xl font-black uppercase italic tracking-tighter">{t.cleanDesk}</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredData.songs.map(track => (
                    <TrackCard key={track.id} track={track} isAdmin onStatusChange={handleStatusChange} onDelete={handleTrackDelete} onToggleSave={handleToggleSaveTrack} />
                  ))}
                </div>
             )}
          </section>
        ) : view === 'profile' ? (
          <section>
            <div className="app-card flex flex-col md:flex-row items-center gap-12 mb-20 p-12 rounded-[60px] shadow-2xl relative overflow-hidden">
              <div className="relative group">
                <img src={auth.user?.avatar} className="w-48 h-48 rounded-full border-[6px] border-red-600 shadow-2xl object-cover bg-red-900/10" alt="avatar" />
                {auth.user?.isDeveloper && <Crown className="absolute -top-4 -right-4 w-12 h-12 text-yellow-400 fill-yellow-400 drop-shadow-xl animate-bounce" />}
              </div>
              <div className="text-center md:text-left flex-1">
                <h2 className="text-7xl font-black uppercase italic tracking-tighter mb-4" style={{ color: 'var(--accent-red)' }}>{auth.user?.username}</h2>
                <div className="mt-8 flex flex-wrap gap-4 justify-center md:justify-start">
                  {auth.user?.isDeveloper ? (
                    <span className="bg-gradient-to-r from-yellow-400 to-red-600 text-white px-8 py-3 rounded-full text-xs font-black uppercase italic shadow-2xl flex items-center gap-2">
                       <Sparkles className="w-4 h-4 fill-white" /> {t.developer}
                    </span>
                  ) : (
                    <span className="bg-red-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase italic shadow-2xl">{t.verifiedMusician}</span>
                  )}
                  {auth.user?.isAdmin && !auth.user?.isDeveloper && <span className="bg-white text-red-600 border border-red-500 px-6 py-2 rounded-full text-xs font-black uppercase italic shadow-2xl">{t.adminOverlord}</span>}
                </div>
              </div>
              <div className="text-center p-8 bg-black/5 rounded-[32px] border border-red-500/10">
                <div className="text-4xl font-black uppercase italic leading-none" style={{ color: 'var(--accent-red)' }}>{filteredData.songs.length}</div>
                <div className="text-[10px] font-black uppercase opacity-30 mt-2 tracking-widest">{t.uploadsCount}</div>
              </div>
            </div>

            {/* Followed Artists in Profile */}
            {auth.user?.savedArtistIds && auth.user.savedArtistIds.length > 0 && (
              <div className="mb-16">
                 <h3 className="text-3xl font-black italic uppercase mb-8 tracking-tighter" style={{ color: 'var(--accent-red)' }}>{t.followedArtists}</h3>
                 <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
                    {auth.user.savedArtistIds.map(id => {
                       const artist = allUsers.find(u => u.id === id);
                       if (!artist) return null;
                       return (
                        <div key={id} onClick={() => setSearchQuery(artist.username)} className="app-card flex-shrink-0 w-40 p-6 rounded-[32px] text-center cursor-pointer group hover:border-red-600 transition-all">
                           <img src={artist.avatar} className="w-20 h-20 mx-auto rounded-full object-cover mb-4 group-hover:scale-105 transition-transform" alt="" />
                           <p className="font-black uppercase italic text-xs truncate">{artist.username}</p>
                        </div>
                       );
                    })}
                 </div>
              </div>
            )}

            <h3 className="text-4xl font-black italic uppercase mb-10 tracking-tighter" style={{ color: 'var(--accent-red)' }}>
              {searchQuery ? t.searchResults : t.myTracks}
            </h3>
            {filteredData.songs.length === 0 ? (
               <div className="text-center py-20 opacity-30 italic">
                 <p className="text-2xl font-black mb-8 uppercase tracking-tighter">{t.emptyStage}</p>
                 <button onClick={() => setView('upload')} className="bg-red-600 text-white px-10 py-4 rounded-full font-black uppercase italic shadow-2xl hover:scale-105 transition-transform">{t.firstUpload}</button>
               </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredData.songs.map(track => (
                  <TrackCard key={track.id} track={track} onPlay={setNowPlaying} onDelete={handleTrackDelete} onToggleSave={handleToggleSaveTrack} />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </main>

      {/* Music Player */}
      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-player">
          <div className="bg-red-600 border-t-2 border-white/20 p-5 shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5 flex-1 min-w-0 w-full md:w-auto">
                <img src={nowPlaying.coverImage} className="w-16 h-16 rounded-2xl object-cover shadow-2xl border-2 border-white/20" alt="" />
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="bg-white/20 text-white text-[8px] px-1 rounded uppercase font-black">{t[nowPlaying.releaseType]}</span>
                    <h4 className="font-black text-white truncate text-xl uppercase italic leading-none tracking-tighter">{nowPlaying.title}</h4>
                  </div>
                  <p className="text-red-100 text-xs font-black uppercase opacity-70 mt-2 tracking-wider">{nowPlaying.artistName}</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1 w-full md:max-w-xl">
                 <div className="flex items-center gap-10">
                    <button className="text-white opacity-40 hover:opacity-100 transition-opacity"><Music className="w-6 h-6" /></button>
                    <button onClick={togglePlay} className="bg-white text-red-600 p-5 rounded-full hover:scale-110 active:scale-95 transition-all shadow-2xl">
                      {isPlaying ? <Pause className="w-8 h-8 fill-red-600" /> : <Play className="w-8 h-8 fill-red-600 ml-1" />}
                    </button>
                    <button className="text-white opacity-40 hover:opacity-100 transition-opacity"><Volume2 className="w-6 h-6" /></button>
                 </div>
                 <div className="w-full flex items-center gap-4 mt-3">
                    <span className="text-[10px] text-white/60 font-black font-mono">{formatTime(currentTime)}</span>
                    <input type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek} className="flex-1" />
                    <span className="text-[10px] text-white/60 font-black font-mono">{formatTime(duration)}</span>
                 </div>
              </div>
              <div className="hidden md:flex items-center justify-end gap-6 flex-1">
                 <button onClick={() => { setNowPlaying(null); audioRef.current?.pause(); }} className="p-3 hover:bg-red-700 text-white rounded-full transition-colors"><X className="w-8 h-8" /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Creation Modal */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-red-600 w-full max-w-md p-10 rounded-[40px] shadow-2xl relative">
            <button onClick={() => setIsPlaylistModalOpen(false)} className="absolute top-8 right-8 text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
            <h2 className="text-3xl font-black uppercase italic text-white mb-8 tracking-tighter">{t.createPlaylist}</h2>
            <form onSubmit={handleCreatePlaylist} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-white/60 mb-2 tracking-widest">{t.playlistTitle}</label>
                <input type="text" required value={newPlaylistTitle} onChange={(e) => setNewPlaylistTitle(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-black text-white outline-none focus:border-white transition-all" />
              </div>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                 <span className="font-black text-xs text-white uppercase italic">{t.visibility} ({newPlaylistVisible ? t.public : t.private})</span>
                 <button type="button" onClick={() => setNewPlaylistVisible(!newPlaylistVisible)} className="p-2 bg-white/10 rounded-lg">
                    {newPlaylistVisible ? <Eye className="text-white w-5 h-5" /> : <EyeOff className="text-white w-5 h-5" />}
                 </button>
              </div>
              <button type="submit" className="w-full bg-white text-red-600 py-4 rounded-2xl font-black uppercase text-xl shadow-2xl hover:scale-105 transition-all">{t.createPlaylist}</button>
            </form>
          </div>
        </div>
      )}

      {/* Add to Playlist Modal */}
      {isAddToPlaylistModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-red-600 w-full max-w-md p-10 rounded-[40px] shadow-2xl relative">
            <button onClick={() => setIsAddToPlaylistModalOpen(false)} className="absolute top-8 right-8 text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
            <h2 className="text-3xl font-black uppercase italic text-white mb-8 tracking-tighter">{t.addToPlaylist}</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-hide">
              {playlists.filter(p => p.ownerId === auth.user?.id).map(p => (
                <button 
                  key={p.id} 
                  onClick={() => addTrackToPlaylist(p.id)}
                  className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-between group transition-all"
                >
                  <span className="font-black uppercase italic text-white">{p.title}</span>
                  <Plus className="w-5 h-5 text-white opacity-40 group-hover:opacity-100" />
                </button>
              ))}
              {playlists.filter(p => p.ownerId === auth.user?.id).length === 0 && (
                <p className="text-white/40 italic text-sm text-center py-4">{t.emptyStage}</p>
              )}
            </div>
            <button onClick={() => { setIsAddToPlaylistModalOpen(false); setIsPlaylistModalOpen(true); }} className="w-full mt-6 py-4 border-2 border-white/20 rounded-2xl text-white font-black uppercase text-xs flex items-center justify-center gap-2">
              <PlusCircle className="w-4 h-4" /> {t.createPlaylist}
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-red-600 w-full max-w-lg p-12 rounded-[60px] shadow-[0_40px_120px_rgba(220,38,38,0.4)] relative border-t-[8px] border-red-400/30">
            <button onClick={() => { setIsLoginModalOpen(false); resetAuthForm(); }} className="absolute top-10 right-10 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"><X className="w-6 h-6" /></button>
            <div className="text-center mb-10 text-white">
              <Logo className="w-24 h-24 mx-auto mb-6 drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] animate-pulse" />
              <h2 className="text-6xl font-black uppercase italic tracking-tighter leading-none">{t.theRedDoor}</h2>
              <p className="text-red-100 font-black mt-4 opacity-90 uppercase text-[10px] tracking-[0.3em]">{t.musiciansOnly}</p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div onClick={() => fileInputRef.current?.click()} className="w-28 h-28 rounded-full bg-white/10 border-4 border-dashed border-white/30 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-all overflow-hidden relative group">
                    {tempAvatar ? <img src={tempAvatar} className="w-full h-full object-cover" alt="Profile" /> : <Camera className="text-white/40 w-10 h-10" />}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity uppercase font-black text-[10px] text-white">Change</div>
                  </div>
                  <input type="file" hidden ref={fileInputRef} accept="image/*" onChange={(e) => handleFileChange(e, setTempAvatar)} />
                </div>
              )}
              <div className="relative">
                <UserIcon className="absolute left-6 top-6 w-6 h-6 text-white/30" />
                <input type="text" placeholder={t.stageName} required value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 pl-16 font-black text-white outline-none focus:border-white transition-all placeholder-white/30 uppercase italic text-xl" />
              </div>
              <div className="relative">
                <Lock className="absolute left-6 top-6 w-6 h-6 text-white/30" />
                <input type="password" placeholder={t.password} required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 pl-16 font-black text-white outline-none focus:border-white transition-all placeholder-white/30 uppercase italic text-xl" />
              </div>
              <button type="submit" disabled={isAuthenticating} className="w-full bg-white text-red-600 py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-[1.05] transition-transform mt-6 flex items-center justify-center gap-3">
                {isAuthenticating ? <Loader2 className="w-8 h-8 animate-spin" /> : (authMode === 'login' ? t.loginAction : t.registerAction)}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-white text-sm font-black uppercase italic opacity-60 hover:opacity-100 transition-opacity tracking-widest mt-4">
                {authMode === 'login' ? t.switchToRegister : t.switchToLogin}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-red-600 border-t-2 border-white/10 px-8 py-6 z-40 flex justify-around text-white">
          <button onClick={() => setView('home')} className={`p-3 rounded-2xl ${view === 'home' ? 'bg-white/20' : ''}`}><Home className="w-8 h-8" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('library') : setIsLoginModalOpen(true)} className={`p-3 rounded-2xl ${view === 'library' ? 'bg-white/20' : ''}`}><Library className="w-8 h-8" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('upload') : setIsLoginModalOpen(true)} className={`p-3 rounded-2xl ${view === 'upload' ? 'bg-white/20' : ''}`}><PlusCircle className="w-8 h-8" /></button>
          <button onClick={() => setView('settings')} className={`p-3 rounded-2xl ${view === 'settings' ? 'bg-white/20' : ''}`}><Settings className="w-8 h-8" /></button>
      </footer>
    </div>
  );
};

export default App;
