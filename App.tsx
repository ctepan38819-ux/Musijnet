
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Track, AuthState, AppTheme, AppLanguage, Playlist, ReleaseType } from './types';
import { storageService } from './services/storageService';
import { Logo, APP_NAME } from './constants';
import { translations } from './translations';
// Corrected import to include Type from @google/genai
import { GoogleGenAI, Type } from "@google/genai";
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
  Heart,
  Cloud,
  Key,
  ClipboardCheck,
  Globe,
  Wifi,
  WifiOff,
  Database,
  RefreshCw
} from 'lucide-react';
import TrackCard from './components/TrackCard';
import SecretGame from './components/SecretGame';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => storageService.getAuth());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>(storageService.getUsers());
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [view, setView] = useState<'home' | 'upload' | 'admin' | 'profile' | 'settings' | 'playlist' | 'library' | 'moderators'>('home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [tempAvatar, setTempAvatar] = useState<string | null>(null);

  const [uploadTitle, setUploadTitle] = useState('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [trackCover, setTrackCover] = useState<string | null>(null);
  const [trackAudio, setTrackAudio] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadReleaseType, setUploadReleaseType] = useState<ReleaseType>('single');

  const [isSecretGameOpen, setIsSecretGameOpen] = useState(false);
  const keySequence = useRef<string>('');

  const trackCoverRef = useRef<HTMLInputElement>(null);
  const trackAudioRef = useRef<HTMLInputElement>(null);

  const t = translations[auth.language];

  const [globalTracks, setGlobalTracks] = useState<Track[]>([]);
  const [isFetchingGlobal, setIsFetchingGlobal] = useState(false);

  // Automatic connection on start
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingTracks(true);
      const storedTracks = await storageService.getTracks();
      setTracks(storedTracks);
      // Simulate fetching users/state from server
      setAllUsers(storageService.getUsers());
      setIsLoadingTracks(false);
    };
    loadData();
    fetchGlobalDiscovery();
  }, []);

  const fetchGlobalDiscovery = async () => {
    setIsFetchingGlobal(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using responseMimeType and responseSchema for structured data extraction
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Generate a list of 5 trending futuristic professional musician names and track titles for a centralized music platform.',
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                artistName: { type: Type.STRING },
                genre: { type: Type.STRING }
              },
              propertyOrdering: ["title", "artistName", "genre"],
              required: ["title", "artistName", "genre"]
            }
          }
        }
      });
      // Corrected extracting text from response
      const textOutput = response.text || '[]';
      const data = JSON.parse(textOutput);
      const mocked: Track[] = data.map((d: any, i: number) => ({
        id: `srv-${i}`,
        title: d.title,
        artistId: `artist-${i}`,
        artistName: d.artistName,
        artistAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.artistName}`,
        coverImage: `https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80&sig=${i}`,
        audioFile: '', 
        isExplicit: i % 3 === 0,
        releaseType: 'single',
        status: 'approved',
        createdAt: Date.now() - i * 1000
      }));
      setGlobalTracks(mocked);
    } catch (e) {
      console.error("Global fetch failed", e);
    } finally {
      setIsFetchingGlobal(false);
    }
  };

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (view !== 'profile') return;
      const char = e.key.toUpperCase();
      keySequence.current = (keySequence.current + char).slice(-4);
      if (keySequence.current === 'YTWD' || keySequence.current === 'НЕЦВ') {
        setIsSecretGameOpen(true);
        keySequence.current = '';
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [view]);

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = auth.theme === 'system' ? (isDark ? 'red-black' : 'red-white') : auth.theme;
    document.body.classList.toggle('theme-red-white', theme === 'red-white');
  }, [auth.theme]);

  useEffect(() => {
    if (nowPlaying) {
      if (!audioRef.current) audioRef.current = new Audio();
      if (nowPlaying.audioFile && audioRef.current.src !== nowPlaying.audioFile) {
        audioRef.current.src = nowPlaying.audioFile;
      }
      if (nowPlaying.audioFile) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        setIsPlaying(true); 
        const timer = setInterval(() => setCurrentTime(c => (c + 1) % 180), 1000);
        return () => clearInterval(timer);
      }

      const updateTime = () => setCurrentTime(audioRef.current?.currentTime || 0);
      const updateDuration = () => setDuration(audioRef.current?.duration || 180);
      const handleEnded = () => setIsPlaying(false);

      audioRef.current?.addEventListener('timeupdate', updateTime);
      audioRef.current?.addEventListener('loadedmetadata', updateDuration);
      audioRef.current?.addEventListener('ended', handleEnded);

      return () => {
        audioRef.current?.removeEventListener('timeupdate', updateTime);
        audioRef.current?.removeEventListener('loadedmetadata', updateDuration);
        audioRef.current?.removeEventListener('ended', handleEnded);
      };
    }
  }, [nowPlaying]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setTimeout(() => {
      const users = storageService.getUsers();
      if (authMode === 'login') {
        const user = users.find(u => u.username.toLowerCase() === loginUsername.toLowerCase());
        if (user) {
          const newAuth: AuthState = { ...auth, user, isAuthenticated: true };
          setAuth(newAuth);
          storageService.setAuth(newAuth);
          setIsLoginModalOpen(false);
        } else alert(t.authError);
      } else {
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          username: loginUsername,
          avatar: tempAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginUsername}`,
          isAdmin: loginUsername.toLowerCase().includes('admin'),
          savedTrackIds: [],
          savedArtistIds: []
        };
        storageService.saveUser(newUser);
        setAuth({ ...auth, user: newUser, isAuthenticated: true });
        setIsLoginModalOpen(false);
      }
      setIsAuthenticating(false);
    }, 800);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !trackCover || !trackAudio || !auth.user) return;
    setIsUploading(true);
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
    setView('profile');
    setIsUploading(false);
  };

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let base = tracks;
    if (view === 'home') base = tracks.filter(t => t.status === 'approved');
    else if (view === 'profile') base = tracks.filter(t => t.artistId === auth.user?.id);
    else if (view === 'library') base = tracks.filter(t => auth.user?.savedTrackIds?.includes(t.id));
    
    if (q) return base.filter(t => t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q));
    return base;
  }, [tracks, view, searchQuery, auth.user]);

  return (
    <div className="flex flex-col min-h-screen pb-32">
      {isSecretGameOpen && <SecretGame onClose={() => setIsSecretGameOpen(false)} />}
      
      <header className="sticky top-0 z-40 bg-red-600 text-white shadow-2xl h-16 flex items-center px-4">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
            <Logo className="w-10 h-10 group-hover:rotate-12 transition-transform" />
            <div className="flex flex-col">
               <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none">{APP_NAME}</h1>
               <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span className="text-[7px] font-black uppercase opacity-60 tracking-widest">{t.serverStatus}</span>
               </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setView('home')} className={`text-[10px] font-black uppercase italic ${view === 'home' ? 'text-white' : 'text-white/60'}`}>{t.home}</button>
            {auth.isAuthenticated && (
              <>
                <button onClick={() => setView('library')} className={`text-[10px] font-black uppercase italic ${view === 'library' ? 'text-white' : 'text-white/60'}`}>{t.library}</button>
                <button onClick={() => setView('profile')} className={`text-[10px] font-black uppercase italic ${view === 'profile' ? 'text-white' : 'text-white/60'}`}>{t.stage}</button>
              </>
            )}
            <button onClick={() => setView('settings')} className={`text-[10px] font-black uppercase italic ${view === 'settings' ? 'text-white' : 'text-white/60'}`}>{t.settings}</button>
          </nav>

          <div className="flex items-center gap-4">
            {auth.isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setView('upload')} className="bg-white text-red-600 px-4 py-1.5 rounded-full font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-transform">{t.upload}</button>
                <img src={auth.user?.avatar} className="w-9 h-9 rounded-full border-2 border-white/50 cursor-pointer shadow-lg" onClick={() => setView('profile')} />
                <button onClick={() => { storageService.logout(); window.location.reload(); }}><LogOut className="w-5 h-5 opacity-60 hover:opacity-100" /></button>
              </div>
            ) : (
              <button onClick={() => setIsLoginModalOpen(true)} className="bg-white text-red-600 px-6 py-2 rounded-full font-black text-[10px] uppercase shadow-lg">{t.login}</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {view === 'home' && (
          <div className="mb-12">
            <div className="relative mb-12 group">
              <input 
                type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.search} className="w-full bg-red-600/5 p-8 rounded-[40px] font-black text-2xl outline-none border-2 border-transparent focus:border-red-600/20 transition-all placeholder-red-900/20 shadow-inner" 
              />
              <Search className="absolute right-8 top-1/2 -translate-y-1/2 w-8 h-8 opacity-10" />
            </div>

            <div className="space-y-16">
              <div>
                 <h3 className="text-4xl font-black uppercase italic mb-8 flex items-center gap-4 text-red-600">
                    <Globe className="w-10 h-10" /> {t.globalDiscovery}
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                    {isFetchingGlobal ? <Loader2 className="animate-spin" /> : globalTracks.map(track => (
                      <TrackCard key={track.id} track={track} onPlay={setNowPlaying} onToggleSave={() => storageService.toggleSavedTrack(auth.user?.id || '', track.id)} />
                    ))}
                 </div>
              </div>

              <div>
                 <h3 className="text-4xl font-black uppercase italic mb-8 flex items-center gap-4 text-red-600">
                    <Database className="w-10 h-10" /> {t.topCharts}
                 </h3>
                 {filteredTracks.length === 0 ? <p className="opacity-30 italic">{t.noTracks}</p> : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                      {filteredTracks.map(track => (
                        <TrackCard key={track.id} track={track} onPlay={setNowPlaying} onToggleSave={() => storageService.toggleSavedTrack(auth.user?.id || '', track.id)} />
                      ))}
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-12">
             <h2 className="text-6xl font-black uppercase italic tracking-tighter text-red-600">{t.settings}</h2>
             
             <div className="app-card p-10 rounded-[50px] space-y-10 shadow-2xl">
                <div className="bg-red-600/5 p-8 rounded-[32px] border-2 border-dashed border-red-500/20 relative overflow-hidden">
                   <Cloud className="absolute -bottom-6 -right-6 w-32 h-32 opacity-5 text-red-600" />
                   <div className="flex items-center gap-3 mb-4">
                      <RefreshCw className="w-6 h-6 text-green-500 animate-spin-slow" />
                      <h3 className="text-2xl font-black uppercase">{t.autoSyncEnabled}</h3>
                   </div>
                   <p className="text-xs opacity-50 font-medium italic mb-2">Connected to: vercel.com/ctepan38819-uxs-projects/musijnet</p>
                   <p className="text-[10px] opacity-40 font-black uppercase tracking-widest">Database persistence across all nodes active.</p>
                </div>

                <div className="space-y-6">
                   <h3 className="text-xl font-black uppercase opacity-40">{t.interfaceTheme}</h3>
                   <div className="grid grid-cols-3 gap-4">
                      {(['system', 'red-black', 'red-white'] as AppTheme[]).map(theme => (
                        <button key={theme} onClick={() => { storageService.setAuth({...auth, theme}); setAuth({...auth, theme}); }} className={`p-6 rounded-3xl border-2 transition-all font-black uppercase text-[9px] ${auth.theme === theme ? 'border-red-600 bg-red-600/10' : 'border-transparent bg-black/5'}`}>
                           {theme.replace('-', ' ')}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="pt-8 border-t border-red-500/10">
                   <h3 className="text-xl font-black uppercase opacity-40 mb-4">{t.language}</h3>
                   <div className="flex gap-4">
                      {(['en', 'ru'] as AppLanguage[]).map(lang => (
                        <button key={lang} onClick={() => { storageService.setAuth({...auth, language: lang}); setAuth({...auth, language: lang}); }} className={`px-8 py-4 rounded-2xl border-2 transition-all font-black uppercase text-xs ${auth.language === lang ? 'border-red-600 bg-red-600/10' : 'border-transparent bg-black/5'}`}>
                           {lang}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="text-center opacity-20 pt-8">
                   <p className="text-[10px] font-black uppercase tracking-widest">{t.version}</p>
                </div>
             </div>
          </div>
        )}

        {view === 'profile' && auth.user && (
          <div className="space-y-16">
             <div className="app-card p-12 rounded-[60px] flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
                <Sparkles className="absolute -bottom-10 -left-10 w-48 h-48 opacity-5 text-red-600 rotate-12" />
                <img src={auth.user.avatar} className="w-48 h-48 rounded-full border-[8px] border-red-600 shadow-2xl relative z-10 object-cover" />
                <div className="flex-1 text-center md:text-left relative z-10">
                   <h2 className="text-7xl font-black uppercase italic tracking-tighter text-red-600 mb-4">{auth.user.username}</h2>
                   <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <span className="bg-red-600 text-white px-8 py-2 rounded-full font-black text-[10px] uppercase italic shadow-xl">{t.verifiedMusician}</span>
                      <span className="bg-black/5 border border-red-500/20 px-8 py-2 rounded-full font-black text-[10px] uppercase italic">{filteredTracks.length} {t.uploadsCount}</span>
                   </div>
                </div>
             </div>

             <h3 className="text-5xl font-black uppercase italic text-red-600 tracking-tighter">{t.myTracks}</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredTracks.map(track => (
                  <TrackCard key={track.id} track={track} onPlay={setNowPlaying} onDelete={() => { storageService.deleteTrack(track.id); window.location.reload(); }} onToggleSave={() => storageService.toggleSavedTrack(auth.user?.id || '', track.id)} />
                ))}
                {filteredTracks.length === 0 && <button onClick={() => setView('upload')} className="aspect-square rounded-[40px] border-4 border-dashed border-red-500/20 flex flex-col items-center justify-center gap-4 group hover:border-red-600 transition-all opacity-40 hover:opacity-100">
                   <PlusCircle className="w-16 h-16 group-hover:scale-110 transition-transform" />
                   <span className="font-black uppercase text-xs">{t.firstUpload}</span>
                </button>}
             </div>
          </div>
        )}

        {view === 'upload' && (
          <div className="max-w-xl mx-auto">
             <div className="app-card p-12 rounded-[50px] shadow-2xl">
                <h2 className="text-4xl font-black uppercase italic text-red-600 mb-10">{t.dropTrack}</h2>
                <form onSubmit={handleUpload} className="space-y-8">
                   <div onClick={() => trackCoverRef.current?.click()} className="w-64 h-64 mx-auto bg-black/5 border-2 border-dashed border-red-500/20 rounded-[40px] flex items-center justify-center cursor-pointer group hover:bg-red-500/5 transition-all overflow-hidden relative">
                      {trackCover ? <img src={trackCover} className="w-full h-full object-cover" /> : <ImageIcon className="w-16 h-16 opacity-10 group-hover:opacity-30 transition-opacity" />}
                   </div>
                   <input type="file" hidden ref={trackCoverRef} accept="image/*" onChange={e => {
                     const f = e.target.files?.[0];
                     if (f) { const r = new FileReader(); r.onloadend = () => setTrackCover(r.result as string); r.readAsDataURL(f); }
                   }} />

                   <div className="grid grid-cols-2 gap-4">
                      <button type="button" onClick={() => setUploadReleaseType('single')} className={`py-5 rounded-2xl font-black uppercase text-xs border-2 ${uploadReleaseType === 'single' ? 'bg-red-600 text-white border-red-400' : 'bg-black/5 border-transparent'}`}>{t.single}</button>
                      <button type="button" onClick={() => setUploadReleaseType('album')} className={`py-5 rounded-2xl font-black uppercase text-xs border-2 ${uploadReleaseType === 'album' ? 'bg-red-600 text-white border-red-400' : 'bg-black/5 border-transparent'}`}>{t.album}</button>
                   </div>

                   <input type="text" required value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder={t.trackTitle} className="w-full p-6 bg-white/5 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-red-600/20" />
                   
                   <div onClick={() => trackAudioRef.current?.click()} className="w-full p-6 bg-red-600/5 border-2 border-red-500/20 rounded-2xl text-center cursor-pointer font-black uppercase text-sm hover:bg-red-600/10 transition-all flex items-center justify-center gap-3">
                      <Music className="w-5 h-5 opacity-40" /> {trackAudio ? t.audioSelected : t.selectFile}
                   </div>
                   <input type="file" hidden ref={trackAudioRef} accept="audio/*" onChange={e => {
                     const f = e.target.files?.[0];
                     if (f) { const r = new FileReader(); r.onloadend = () => setTrackAudio(r.result as string); r.readAsDataURL(f); }
                   }} />

                   <div className="flex items-center gap-3 bg-red-600/5 p-4 rounded-xl">
                      <input type="checkbox" id="explicit-check" checked={isExplicit} onChange={e => setIsExplicit(e.target.checked)} className="accent-red-600 w-5 h-5" />
                      <label htmlFor="explicit-check" className="font-black uppercase text-[10px] italic cursor-pointer">{t.explicit}</label>
                   </div>

                   <button type="submit" disabled={isUploading} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-[1.02] transition-transform">
                      {isUploading ? <Loader2 className="animate-spin mx-auto" /> : t.sendMod}
                   </button>
                </form>
             </div>
          </div>
        )}
      </main>

      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-player">
          <div className="bg-red-600 p-6 shadow-2xl border-t-2 border-white/20">
             <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
                <div className="flex items-center gap-4 flex-1 min-w-0 text-white">
                   <img src={nowPlaying.coverImage} className="w-16 h-16 rounded-2xl shadow-xl object-cover" />
                   <div className="truncate">
                      <h4 className="font-black text-xl uppercase italic leading-none">{nowPlaying.title}</h4>
                      <p className="text-[10px] font-black uppercase opacity-60 mt-2">{nowPlaying.artistName}</p>
                   </div>
                </div>
                <div className="flex flex-col items-center gap-3 flex-1 w-full">
                   <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="bg-white text-red-600 p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all">
                      {isPlaying ? <Pause className="w-6 h-6 fill-red-600" /> : <Play className="w-6 h-6 fill-red-600 ml-1" />}
                   </button>
                   <div className="w-full flex items-center gap-3 text-white">
                      <span className="text-[9px] font-mono opacity-60">{formatTime(currentTime)}</span>
                      <input type="range" min={0} max={duration || 180} value={currentTime} onChange={e => audioRef.current && (audioRef.current.currentTime = Number(e.target.value))} className="flex-1" />
                      <span className="text-[9px] font-mono opacity-60">{formatTime(duration || 180)}</span>
                   </div>
                </div>
                <button onClick={() => { setNowPlaying(null); audioRef.current?.pause(); }} className="p-2 hover:bg-black/10 rounded-full text-white"><X className="w-8 h-8" /></button>
             </div>
          </div>
        </div>
      )}

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-red-600 w-full max-w-lg p-12 rounded-[60px] shadow-2xl relative border-t-[8px] border-red-400/30">
            <button onClick={() => setIsLoginModalOpen(false)} className="absolute top-10 right-10 text-white/40 hover:text-white transition-colors"><X className="w-8 h-8" /></button>
            <div className="text-center mb-10 text-white">
              <Logo className="w-24 h-24 mx-auto mb-6 drop-shadow-lg animate-pulse" />
              <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{t.theRedDoor}</h2>
              <p className="text-red-100 text-[9px] font-black uppercase mt-4 tracking-widest opacity-60">{t.musiciansOnly}</p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder={t.stageName} required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 font-black text-white outline-none focus:border-white transition-all uppercase placeholder-white/20 italic text-xl" />
              <input type="password" placeholder={t.password} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 font-black text-white outline-none focus:border-white transition-all uppercase placeholder-white/20 italic text-xl" />
              <button type="submit" disabled={isAuthenticating} className="w-full bg-white text-red-600 py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-[1.02] transition-transform mt-6">
                {isAuthenticating ? <Loader2 className="animate-spin mx-auto" /> : (authMode === 'login' ? t.loginAction : t.registerAction)}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-white/60 font-black uppercase text-[10px] italic mt-4 hover:text-white">
                {authMode === 'login' ? t.switchToRegister : t.switchToLogin}
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-red-600 border-t-2 border-white/10 px-8 py-4 z-40 flex justify-around text-white">
          <button onClick={() => setView('home')} className={`p-4 rounded-2xl ${view === 'home' ? 'bg-white/20' : ''}`}><Home className="w-7 h-7" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('library') : setIsLoginModalOpen(true)} className={`p-4 rounded-2xl ${view === 'library' ? 'bg-white/20' : ''}`}><Library className="w-7 h-7" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('upload') : setIsLoginModalOpen(true)} className={`p-4 rounded-2xl ${view === 'upload' ? 'bg-white/20' : ''}`}><PlusCircle className="w-7 h-7" /></button>
          <button onClick={() => setView('settings')} className={`p-4 rounded-2xl ${view === 'settings' ? 'bg-white/20' : ''}`}><Settings className="w-7 h-7" /></button>
      </footer>
    </div>
  );
};

export default App;