
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Track, AuthState, AppTheme, AppLanguage, ReleaseType } from './types';
import { storageService } from './services/storageService';
import { Logo, APP_NAME } from './constants';
import { translations } from './translations';
import { 
  Music, 
  ShieldCheck, 
  Home, 
  PlusCircle, 
  X,
  Settings as SettingsIcon,
  ImageIcon,
  CheckCircle,
  Play,
  Pause,
  Search,
  Loader2,
  Crown,
  Sparkles,
  Library,
  Database,
  AlertCircle,
  LogOut,
  ChevronRight,
  Wifi,
  Users,
  Moon,
  Sun,
  Globe,
  Zap,
  Activity
} from 'lucide-react';
import TrackCard from './components/TrackCard';
import SecretGame from './components/SecretGame';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const dataURLtoBlob = (dataurl: string) => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
};

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(() => storageService.getAuth());
  const [tracks, setTracks] = useState<Track[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [view, setView] = useState<'home' | 'upload' | 'profile' | 'settings' | 'library' | 'moderation'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [uploadTitle, setUploadTitle] = useState('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [trackCover, setTrackCover] = useState<string | null>(null);
  const [trackAudio, setTrackAudio] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isSecretGameOpen, setIsSecretGameOpen] = useState(false);

  const trackCoverRef = useRef<HTMLInputElement>(null);
  const trackAudioRef = useRef<HTMLInputElement>(null);

  const t = translations[auth.language];

  useEffect(() => {
    document.body.classList.remove('theme-red-white');
    if (auth.theme === 'red-white') {
      document.body.classList.add('theme-red-white');
    }
  }, [auth.theme]);

  const syncData = async (silent = false) => {
    if (!silent) setIsLoadingTracks(true);
    setIsSyncing(true);
    try {
      const [remoteTracks, remoteUsers] = await Promise.all([
        storageService.getTracks(),
        storageService.getAllUsers()
      ]);
      setTracks(remoteTracks);
      setAllUsers(remoteUsers);
      
      if (auth.user) {
        const freshUser = remoteUsers.find(u => u.id === auth.user?.id);
        if (freshUser) {
          const newAuth = { ...auth, user: freshUser };
          setAuth(newAuth);
          storageService.setAuth(newAuth);
        }
      }
    } catch (e) {
      console.error("V13 ULTRA: Sync Delay", e);
    } finally {
      setIsLoadingTracks(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(() => syncData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePlayTrack = async (track: Track) => {
    setNowPlaying(track);
    setIsBuffering(true);
    setIsPlaying(false);

    try {
      const audioSource = await storageService.getBlob(`audio_${track.id}`);
      if (!audioSource) throw new Error("Audio buffer failure");
      
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audioSource;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch(() => setIsBuffering(false));
      }
    } catch (err) {
      setIsBuffering(false);
      alert("V13 Node: Ошибка буферизации сегмента. Попробуйте еще раз.");
    }
  };

  useEffect(() => {
    if (audioRef.current) {
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    try {
      const remoteUsers = await storageService.getAllUsers();
      const normalizedUsername = loginUsername.toLowerCase().trim();
      const isEletro = normalizedUsername === 'eletro';

      if (authMode === 'login') {
        let user = remoteUsers.find(u => u.username.toLowerCase() === normalizedUsername);
        if (user) {
          if (isEletro) { user.isDeveloper = true; user.isAdmin = true; }
          const newAuth: AuthState = { ...auth, user, isAuthenticated: true };
          setAuth(newAuth);
          storageService.setAuth(newAuth);
          setIsLoginModalOpen(false);
        } else alert(t.authError);
      } else {
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          username: loginUsername,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${loginUsername}`,
          isAdmin: isEletro || loginUsername.toLowerCase().includes('admin'),
          isDeveloper: isEletro,
          savedTrackIds: [],
          savedArtistIds: []
        };
        await storageService.saveUser(newUser);
        setAuth({ ...auth, user: newUser, isAuthenticated: true });
        setIsLoginModalOpen(false);
      }
    } catch (err) {
      alert("V13 Node Auth Failure.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !trackCover || !trackAudio || !auth.user) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUploadStep('Protocol Initializing...');

    const trackId = Math.random().toString(36).substr(2, 9);
    const audioBlob = dataURLtoBlob(trackAudio);
    const coverBlob = dataURLtoBlob(trackCover);

    const newTrack: Track = {
      id: trackId,
      title: uploadTitle,
      artistId: auth.user.id,
      artistName: auth.user.username,
      artistAvatar: auth.user.avatar,
      coverImage: '',
      audioFile: '',
      isExplicit: isExplicit,
      releaseType: 'single',
      status: auth.user.isDeveloper ? 'approved' : 'pending',
      createdAt: Date.now()
    };

    try {
      await storageService.saveTrack(newTrack, audioBlob, coverBlob, (step) => {
        setUploadStep(step);
      });
      setUploadStep('Committing Index...');
      await syncData(true); 
      setView('profile');
      setUploadTitle('');
      setTrackCover(null);
      setTrackAudio(null);
    } catch (err: any) {
      setUploadError("V13 Ultra Failure: Сеть слишком нестабильна для подтвержденной передачи. Попробуйте сменить сеть.");
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  const handleUpdateTheme = (theme: AppTheme) => {
    const newAuth = { ...auth, theme };
    setAuth(newAuth);
    storageService.setAuth(newAuth);
  };

  const handleUpdateLanguage = (language: AppLanguage) => {
    const newAuth = { ...auth, language };
    setAuth(newAuth);
    storageService.setAuth(newAuth);
  };

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let base = tracks;
    if (view === 'home') base = tracks.filter(t => t.status === 'approved');
    else if (view === 'profile') base = tracks.filter(t => t.artistId === auth.user?.id);
    else if (view === 'library') base = tracks.filter(t => auth.user?.savedTrackIds?.includes(t.id));
    else if (view === 'moderation') base = tracks.filter(t => t.status === 'pending');
    
    if (q) return base.filter(t => t.title.toLowerCase().includes(q) || t.artistName.toLowerCase().includes(q));
    return base;
  }, [tracks, view, searchQuery, auth.user]);

  const canModerate = auth.user?.isAdmin || auth.user?.isDeveloper;

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
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-yellow-300 animate-ping' : 'bg-blue-400 animate-pulse'}`} />
                  <span className="text-[7px] font-black uppercase opacity-60 tracking-widest">{isSyncing ? 'Linking...' : 'ULTRA STABLE V13 NODE'}</span>
               </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => setView('home')} className={`text-[10px] font-black uppercase italic ${view === 'home' ? 'opacity-100 underline underline-offset-4' : 'opacity-60 hover:opacity-100'}`}>{t.home}</button>
            {auth.isAuthenticated && (
              <>
                <button onClick={() => setView('library')} className={`text-[10px] font-black uppercase italic ${view === 'library' ? 'opacity-100 underline underline-offset-4' : 'opacity-60 hover:opacity-100'}`}>{t.library}</button>
                <button onClick={() => setView('profile')} className={`text-[10px] font-black uppercase italic ${view === 'profile' ? 'opacity-100 underline underline-offset-4' : 'opacity-60 hover:opacity-100'}`}>{t.stage}</button>
                {canModerate && (
                  <button onClick={() => setView('moderation')} className={`text-[10px] font-black uppercase italic flex items-center gap-1.5 ${view === 'moderation' ? 'text-yellow-300' : 'opacity-60 hover:opacity-100'}`}>
                    <ShieldCheck className="w-3 h-3" /> {t.moderation}
                  </button>
                )}
              </>
            )}
          </nav>

          <div className="flex items-center gap-4">
            {auth.isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setView('upload')} className="bg-white text-red-600 px-4 py-1.5 rounded-full font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-transform">{t.upload}</button>
                <img src={auth.user?.avatar} className="w-9 h-9 rounded-full border-2 border-white/50 cursor-pointer shadow-lg" onClick={() => setView('profile')} />
                <button onClick={() => { storageService.logout(); window.location.reload(); }} className="p-2 hover:bg-white/10 rounded-full transition-colors"><LogOut className="w-5 h-5 opacity-60 hover:opacity-100" /></button>
              </div>
            ) : (
              <button onClick={() => setIsLoginModalOpen(true)} className="bg-white text-red-600 px-6 py-2 rounded-full font-black text-[10px] uppercase shadow-lg hover:bg-red-50 transition-colors">{t.login}</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {view === 'home' && (
          <div className="mb-12">
            <div className="relative mb-12 group">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t.search} className="w-full bg-red-600/5 p-8 rounded-[40px] font-black text-2xl outline-none border-2 border-transparent focus:border-red-600/20 transition-all placeholder-red-900/20 shadow-inner" />
              <Search className="absolute right-8 top-1/2 -translate-y-1/2 w-8 h-8 opacity-10" />
            </div>

            <div className="space-y-16">
              <div>
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-4xl font-black uppercase italic flex items-center gap-4 text-red-600"><Activity className="w-10 h-10 animate-pulse" /> {t.topCharts}</h3>
                    <div className="flex items-center gap-4 bg-red-600/5 px-6 py-3 rounded-2xl border border-red-600/10">
                       <div className="flex items-center gap-1.5 text-blue-500">
                          <Zap className="w-4 h-4 animate-bounce" />
                          <span className="text-[10px] font-black uppercase">V13 PROTECTED</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-red-600">
                          <Users className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase">{allUsers.length} Artists</span>
                       </div>
                    </div>
                 </div>
                 {isLoadingTracks ? (
                   <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin w-12 h-12 mb-4" /><p className="font-black uppercase text-xs tracking-widest">CONNECTING TO ULTRA-STABLE RELAY...</p></div>
                 ) : (
                   filteredTracks.length === 0 ? (
                     <div className="flex flex-col items-center gap-6 py-20">
                        <p className="opacity-30 italic text-center">{t.noTracks}</p>
                        <button onClick={() => setView('upload')} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase italic text-xs shadow-2xl hover:scale-105 transition-transform">Start V13 Wave</button>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {filteredTracks.map(track => (
                          <TrackCard key={track.id} track={track} onPlay={handlePlayTrack} onDelete={async (id) => {
                             await storageService.deleteTrack(id);
                             await syncData(true);
                          }} onToggleSave={async (id) => {
                            if (!auth.user) return;
                            await storageService.toggleSavedTrack(auth.user.id, id);
                            await syncData(true);
                          }} />
                        ))}
                     </div>
                   )
                 )}
              </div>
            </div>
          </div>
        )}

        {view === 'upload' && (
          <div className="max-w-xl mx-auto">
             <div className="app-card p-12 rounded-[50px] shadow-2xl border-2 border-red-600/30">
                <h2 className="text-4xl font-black uppercase italic text-red-600 mb-10">{t.dropTrack}</h2>
                <form onSubmit={handleUpload} className="space-y-8">
                   {uploadError && (
                     <div className="bg-red-600/20 border-2 border-red-600 p-6 rounded-3xl text-red-600 font-bold text-xs uppercase shadow-inner flex items-center gap-3 animate-pulse">
                        <AlertCircle className="w-6 h-6 flex-shrink-0" /> 
                        <span>{uploadError}</span>
                     </div>
                   )}
                   <div onClick={() => trackCoverRef.current?.click()} className="w-64 h-64 mx-auto bg-black/5 border-2 border-dashed border-red-500/20 rounded-[40px] flex items-center justify-center cursor-pointer overflow-hidden relative shadow-inner group transition-all hover:bg-red-600/5">
                      {trackCover ? <img src={trackCover} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-2 opacity-10"><ImageIcon className="w-12 h-12" /><span className="text-[10px] font-black uppercase">ARTWORK PACK</span></div>}
                   </div>
                   <input type="file" hidden ref={trackCoverRef} accept="image/*" onChange={e => {
                     const f = e.target.files?.[0];
                     if (f) { const r = new FileReader(); r.onloadend = () => setTrackCover(r.result as string); r.readAsDataURL(f); }
                   }} />
                   
                   <input type="text" required value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder={t.trackTitle} className="w-full p-6 bg-red-600/5 rounded-2xl font-black text-xl outline-none focus:bg-red-600/10 transition-colors" />
                   
                   <div onClick={() => trackAudioRef.current?.click()} className="w-full p-8 bg-white border-2 border-dashed border-red-500/20 rounded-[32px] text-center cursor-pointer font-black uppercase text-sm hover:bg-red-600/5 transition-all flex flex-col items-center gap-2">
                      <Music className="w-8 h-8 opacity-30" /> 
                      {trackAudio ? <span className="text-green-600">Payload Locked ✓</span> : t.selectFile}
                   </div>
                   <input type="file" hidden ref={trackAudioRef} accept="audio/*" onChange={e => {
                     const f = e.target.files?.[0];
                     if (f) { 
                       const r = new FileReader(); r.onloadend = () => setTrackAudio(r.result as string); r.readAsDataURL(f); 
                     }
                   }} />

                   <div className="flex flex-col gap-2">
                      <button type="submit" disabled={isUploading || !trackCover || !trackAudio || !uploadTitle} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl disabled:opacity-20 transition-all active:scale-95 flex items-center justify-center gap-4">
                        {isUploading ? <><Loader2 className="animate-spin" /> {uploadStep}</> : t.sendMod}
                      </button>
                      {isUploading && <p className="text-[9px] font-black uppercase text-center text-red-600/60 mt-4 animate-pulse">Protocol V13: Не закрывайте страницу. Идет подтвержденная передача.</p>}
                   </div>
                </form>
             </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-12">
            <h2 className="text-6xl font-black uppercase italic tracking-tighter text-red-600">{t.settings}</h2>
            
            <section className="app-card p-10 rounded-[40px] space-y-8">
              <div className="flex items-center gap-4 text-red-600">
                <Sun className="w-8 h-8" />
                <h3 className="text-2xl font-black uppercase italic">{t.interfaceTheme}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleUpdateTheme('red-black')} className={`p-6 rounded-2xl border-4 font-black uppercase italic text-sm transition-all ${auth.theme === 'red-black' ? 'bg-red-600 text-white border-red-400' : 'bg-black/20 text-red-600/60 border-transparent hover:bg-red-600/10'}`}>Red & Black</button>
                <button onClick={() => handleUpdateTheme('red-white')} className={`p-6 rounded-2xl border-4 font-black uppercase italic text-sm transition-all ${auth.theme === 'red-white' ? 'bg-white text-red-600 border-red-400' : 'bg-black/20 text-red-600/60 border-transparent hover:bg-red-600/10'}`}>Red & White</button>
              </div>
            </section>

            <section className="app-card p-10 rounded-[40px] space-y-8">
              <div className="flex items-center gap-4 text-red-600">
                <Globe className="w-8 h-8" />
                <h3 className="text-2xl font-black uppercase italic">{t.language}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleUpdateLanguage('en')} className={`p-6 rounded-2xl border-4 font-black uppercase italic text-sm transition-all ${auth.language === 'en' ? 'bg-red-600 text-white border-red-400' : 'bg-black/20 text-red-600/60 border-transparent hover:bg-red-600/10'}`}>English</button>
                <button onClick={() => handleUpdateLanguage('ru')} className={`p-6 rounded-2xl border-4 font-black uppercase italic text-sm transition-all ${auth.language === 'ru' ? 'bg-red-600 text-white border-red-400' : 'bg-black/20 text-red-600/60 border-transparent hover:bg-red-600/10'}`}>Русский</button>
              </div>
            </section>
          </div>
        )}

        {view === 'profile' && auth.user && (
          <div className="space-y-16">
             <div className="app-card p-12 rounded-[60px] flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
                <div className="relative">
                  <img src={auth.user.avatar} className="w-48 h-48 rounded-full border-[8px] border-red-600 shadow-2xl relative z-10 object-cover bg-red-600" />
                  {auth.user.isDeveloper && <Crown className="absolute -top-6 -right-6 w-16 h-16 text-yellow-400 fill-yellow-400 z-20 drop-shadow-2xl animate-bounce" />}
                </div>
                <div className="flex-1 text-center md:text-left relative z-10">
                   <h2 className="text-7xl font-black uppercase italic tracking-tighter text-red-600 mb-4">{auth.user.username}</h2>
                   <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <span className="bg-red-600 text-white px-8 py-2 rounded-full font-black text-[10px] uppercase italic">{auth.user.isDeveloper ? t.developer : t.verifiedMusician}</span>
                      <span className="bg-black/5 border border-red-500/20 px-8 py-2 rounded-full font-black text-[10px] uppercase italic">STABLE V13 RELAY</span>
                   </div>
                </div>
             </div>
             <h3 className="text-5xl font-black uppercase italic text-red-600 tracking-tighter flex items-center gap-4">{t.myTracks} <ChevronRight className="w-10 h-10 opacity-20" /></h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredTracks.map(track => (
                  <TrackCard key={track.id} track={track} onPlay={handlePlayTrack} onDelete={async (id) => {
                    await storageService.deleteTrack(id);
                    await syncData(true);
                  }} />
                ))}
             </div>
          </div>
        )}
      </main>
      
      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-player">
          <div className="bg-red-600 p-6 shadow-2xl border-t-2 border-white/20">
             <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
                <div className="flex items-center gap-4 flex-1 min-w-0 text-white">
                   <div className="truncate">
                      <h4 className="font-black text-xl uppercase italic leading-none">{nowPlaying.title}</h4>
                      <p className="text-[10px] font-black uppercase opacity-60 mt-2">{nowPlaying.artistName}</p>
                   </div>
                </div>
                <div className="flex flex-col items-center gap-3 flex-1 w-full">
                   <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="bg-white text-red-600 p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-transform" disabled={isBuffering}>
                      {isBuffering ? <Loader2 className="animate-spin w-8 h-8" /> : (isPlaying ? <Pause className="w-8 h-8 fill-red-600" /> : <Play className="w-8 h-8 fill-red-600 ml-1" />)}
                   </button>
                   <div className="w-full flex items-center gap-3 text-white">
                      <span className="text-[9px] font-mono opacity-60">{formatTime(currentTime)}</span>
                      <input type="range" min={0} max={duration || 180} value={currentTime} onChange={e => audioRef.current && (audioRef.current.currentTime = Number(e.target.value))} className="flex-1 cursor-pointer" />
                      <span className="text-[9px] font-mono opacity-60">{formatTime(duration || 180)}</span>
                   </div>
                </div>
                <button onClick={() => { setNowPlaying(null); audioRef.current?.pause(); }} className="p-2 hover:bg-black/10 rounded-full text-white transition-colors"><X className="w-8 h-8" /></button>
             </div>
          </div>
        </div>
      )}

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className="bg-red-600 w-full max-w-lg p-12 rounded-[60px] shadow-2xl relative">
            <button onClick={() => setIsLoginModalOpen(false)} className="absolute top-10 right-10 text-white/40 hover:text-white transition-colors"><X className="w-8 h-8" /></button>
            <div className="text-center mb-10 text-white">
              <Logo className="w-24 h-24 mx-auto mb-6" />
              <h2 className="text-4xl font-black uppercase italic leading-none">{t.theRedDoor}</h2>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder={t.stageName} required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 font-black text-white outline-none uppercase italic text-xl focus:border-white transition-all" />
              <input type="password" placeholder={t.password} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 font-black text-white outline-none uppercase italic text-xl focus:border-white transition-all" />
              <button type="submit" disabled={isAuthenticating} className="w-full bg-white text-red-600 py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-105 transition-all">
                {isAuthenticating ? <Loader2 className="animate-spin mx-auto" /> : (authMode === 'login' ? t.loginAction : t.registerAction)}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-white/60 font-black uppercase text-[10px] italic mt-4">{authMode === 'login' ? t.switchToRegister : t.switchToLogin}</button>
            </form>
          </div>
        </div>
      )}

      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-red-600 border-t-2 border-white/10 px-8 py-4 z-40 flex justify-around text-white">
          <button onClick={() => setView('home')} className={`p-4 rounded-2xl ${view === 'home' ? 'bg-white/20' : 'opacity-60'}`}><Home className="w-7 h-7" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('library') : setIsLoginModalOpen(true)} className={`p-4 rounded-2xl ${view === 'library' ? 'bg-white/20' : 'opacity-60'}`}><Library className="w-7 h-7" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('upload') : setIsLoginModalOpen(true)} className={`p-4 rounded-2xl ${view === 'upload' ? 'bg-white/20' : 'opacity-60'}`}><PlusCircle className="w-7 h-7" /></button>
          <button onClick={() => setView('settings')} className={`p-4 rounded-2xl ${view === 'settings' ? 'bg-white/20' : 'opacity-60'}`}><SettingsIcon className="w-7 h-7" /></button>
      </footer>
    </div>
  );
};

export default App;
