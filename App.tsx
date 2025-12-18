
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Track, AuthState, AppTheme, AppLanguage, ReleaseType } from './types';
import { storageService } from './services/storageService';
import { Logo, APP_NAME } from './constants';
import { translations } from './translations';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Music, 
  ShieldCheck, 
  Home, 
  PlusCircle, 
  X,
  Settings,
  ImageIcon,
  CheckCircle,
  Play,
  Pause,
  Search,
  Loader2,
  Crown,
  Sparkles,
  Library,
  Globe,
  Database,
  RefreshCw,
  AlertCircle,
  LogOut,
  ChevronRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import TrackCard from './components/TrackCard';
import SecretGame from './components/SecretGame';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MAX_BINARY_SIZE = 980 * 1024; 

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
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [view, setView] = useState<'home' | 'upload' | 'admin' | 'profile' | 'settings' | 'playlist' | 'library' | 'moderation'>('home');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [uploadTitle, setUploadTitle] = useState('');
  const [isExplicit, setIsExplicit] = useState(false);
  const [trackCover, setTrackCover] = useState<string | null>(null);
  const [trackAudio, setTrackAudio] = useState<string | null>(null);
  const [trackAudioSize, setTrackAudioSize] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadReleaseType, setUploadReleaseType] = useState<ReleaseType>('single');

  const [isSecretGameOpen, setIsSecretGameOpen] = useState(false);
  const keySequence = useRef<string>('');

  const trackCoverRef = useRef<HTMLInputElement>(null);
  const trackAudioRef = useRef<HTMLInputElement>(null);

  const t = translations[auth.language];

  const syncData = async (silent = false) => {
    if (!silent) setIsLoadingTracks(true);
    setIsSyncing(true);
    try {
      const remote = await storageService.getRemoteManifest();
      setTracks(remote.tracks);
      
      if (auth.user) {
        const freshUser = remote.users.find(u => u.id === auth.user?.id);
        if (freshUser) {
          const newAuth = { ...auth, user: freshUser };
          setAuth(newAuth);
          storageService.setAuth(newAuth);
        }
      }
    } catch (e) {
      console.error("Cloud Sync Failed", e);
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

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = auth.theme === 'system' ? (isDark ? 'red-black' : 'red-white') : auth.theme;
    document.body.classList.toggle('theme-red-white', theme === 'red-white');
  }, [auth.theme]);

  const handlePlayTrack = async (track: Track) => {
    setNowPlaying(track);
    setIsBuffering(true);
    setIsPlaying(false);

    try {
      let audioSource = track.audioFile;
      if (!audioSource) {
        audioSource = await storageService.getBlob(`audio_${track.id}`);
      }

      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audioSource;
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch(() => {
          setIsBuffering(false);
        });
      }
    } catch (err) {
      console.error("Playback error", err);
      setIsBuffering(false);
      alert("Не удалось загрузить аудио. Возможно, файл удален или поврежден.");
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      const updateTime = () => setCurrentTime(audioRef.current?.currentTime || 0);
      const updateDuration = () => setDuration(audioRef.current?.duration || 180);
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
      const remote = await storageService.getRemoteManifest();
      const normalizedUsername = loginUsername.toLowerCase().trim();
      const isEletro = normalizedUsername === 'eletro';

      if (authMode === 'login') {
        let user = remote.users.find(u => u.username.toLowerCase() === normalizedUsername);
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
      alert("Ошибка сети. Попробуйте еще раз.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !trackCover || !trackAudio || !auth.user) return;
    
    setIsUploading(true);
    setUploadError(null);
    setUploadStep('Упаковка данных...');

    const trackId = Math.random().toString(36).substr(2, 9);
    const audioBlob = dataURLtoBlob(trackAudio);
    const coverBlob = dataURLtoBlob(trackCover);

    const newTrack: Track = {
      id: trackId,
      title: uploadTitle,
      artistId: auth.user.id,
      artistName: auth.user.username,
      artistAvatar: auth.user.avatar,
      coverImage: '', // Will be stored as blob
      audioFile: '', // Will be stored as blob
      isExplicit: isExplicit,
      releaseType: uploadReleaseType,
      status: 'pending',
      createdAt: Date.now()
    };

    try {
      setUploadStep('Загрузка обложки...');
      // Note: storageService.saveTrack now takes both blobs
      await storageService.saveTrack(newTrack, audioBlob, coverBlob);
      setUploadStep('Финальная синхронизация...');
      await syncData(true); 
      setView('profile');
      setUploadTitle('');
      setTrackCover(null);
      setTrackAudio(null);
      setIsExplicit(false);
      setTrackAudioSize(0);
    } catch (err: any) {
      setUploadError(err.message || "Ошибка загрузки. Проверьте размер файла или статус сервера.");
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  const handleDeleteTrack = async (id: string) => {
    setIsSyncing(true);
    try {
      await storageService.deleteTrack(id);
      await syncData(true);
      if (nowPlaying?.id === id) {
        setNowPlaying(null);
        audioRef.current?.pause();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusUpdate = async (trackId: string, status: Track['status']) => {
    setIsSyncing(true);
    try {
      const updatedTracks = await storageService.updateTrackStatus(trackId, status);
      setTracks(updatedTracks);
    } finally {
      setIsSyncing(false);
    }
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
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-yellow-300 animate-ping' : 'bg-green-300 animate-pulse'}`} />
                  <span className="text-[7px] font-black uppercase opacity-60 tracking-widest">{isSyncing ? 'Syncing...' : t.serverStatus}</span>
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
            <button onClick={() => setView('settings')} className={`text-[10px] font-black uppercase italic ${view === 'settings' ? 'opacity-100 underline underline-offset-4' : 'opacity-60 hover:opacity-100'}`}>{t.settings}</button>
          </nav>

          <div className="flex items-center gap-4">
            {auth.isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button onClick={() => setView('upload')} className="bg-white text-red-600 px-4 py-1.5 rounded-full font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-transform">{t.upload}</button>
                <div className="relative group">
                  <img src={auth.user?.avatar} className="w-9 h-9 rounded-full border-2 border-white/50 cursor-pointer shadow-lg group-hover:border-white transition-all" onClick={() => setView('profile')} />
                  {auth.user?.isDeveloper && <div className="absolute -top-1 -right-1 bg-yellow-400 p-0.5 rounded-full shadow-lg border border-red-600"><Sparkles className="w-2 h-2 text-red-600 fill-red-600" /></div>}
                </div>
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
                 <h3 className="text-4xl font-black uppercase italic mb-8 flex items-center gap-4 text-red-600"><Database className="w-10 h-10" /> {t.topCharts}</h3>
                 {isLoadingTracks ? (
                   <div className="flex flex-col items-center py-20 opacity-20"><Loader2 className="animate-spin w-12 h-12 mb-4" /><p className="font-black uppercase text-xs">Accessing Cloud Node...</p></div>
                 ) : (
                   filteredTracks.length === 0 ? <p className="opacity-30 italic text-center py-20">{t.noTracks}</p> : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {filteredTracks.map(track => (
                          <TrackCard key={track.id} track={track} onPlay={handlePlayTrack} onDelete={handleDeleteTrack} onToggleSave={async () => {
                            await storageService.toggleSavedTrack(auth.user?.id || '', track.id);
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

        {view === 'moderation' && (
          <div className="space-y-12">
            <div className="flex items-center justify-between">
              <h2 className="text-6xl font-black uppercase italic tracking-tighter text-red-600">{t.modRoom}</h2>
              <div className="bg-yellow-500/10 border-2 border-yellow-500/20 px-6 py-3 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-yellow-600" />
                <span className="text-xs font-black uppercase">{filteredTracks.length} {t.pending}</span>
              </div>
            </div>
            {filteredTracks.length === 0 ? (
              <div className="app-card p-20 rounded-[60px] text-center opacity-40"><CheckCircle className="w-20 h-20 mx-auto mb-6 opacity-20" /><p className="text-2xl font-black uppercase italic">{t.cleanDesk}</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredTracks.map(track => (
                  <TrackCard key={track.id} track={track} isAdmin={canModerate} onStatusChange={handleStatusUpdate} onPlay={handlePlayTrack} onDelete={handleDeleteTrack} />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'upload' && (
          <div className="max-w-xl mx-auto">
             <div className="app-card p-12 rounded-[50px] shadow-2xl">
                <h2 className="text-4xl font-black uppercase italic text-red-600 mb-10">{t.dropTrack}</h2>
                <form onSubmit={handleUpload} className="space-y-8">
                   {uploadError && (
                     <div className="bg-red-600/20 border-2 border-red-600 p-6 rounded-3xl flex items-start gap-3 text-red-600 font-bold text-xs uppercase animate-shake shadow-inner">
                        <AlertCircle className="w-6 h-6 flex-shrink-0" />
                        <div className="flex flex-col gap-1">
                           <span className="text-sm font-black italic">Ошибка (500/База переполнена)</span>
                           <span className="opacity-70 leading-relaxed font-medium">{uploadError}</span>
                        </div>
                     </div>
                   )}
                   <div onClick={() => trackCoverRef.current?.click()} className="w-64 h-64 mx-auto bg-black/5 border-2 border-dashed border-red-500/20 rounded-[40px] flex items-center justify-center cursor-pointer group hover:bg-red-500/5 transition-all overflow-hidden relative shadow-inner">
                      {trackCover ? <img src={trackCover} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-2 opacity-10 group-hover:opacity-30 transition-opacity"><ImageIcon className="w-12 h-12" /><span className="text-[10px] font-black uppercase">JPG/PNG</span></div>}
                   </div>
                   <input type="file" hidden ref={trackCoverRef} accept="image/*" onChange={e => {
                     const f = e.target.files?.[0];
                     if (f) { const r = new FileReader(); r.onloadend = () => setTrackCover(r.result as string); r.readAsDataURL(f); }
                   }} />
                   
                   <input type="text" required value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder={t.trackTitle} className="w-full p-6 bg-red-600/5 rounded-2xl font-black text-xl outline-none border-2 border-transparent focus:border-red-600/20 transition-all placeholder-red-900/20" />
                   
                   <div onClick={() => trackAudioRef.current?.click()} className="w-full p-8 bg-white border-2 border-dashed border-red-500/20 rounded-[32px] text-center cursor-pointer font-black uppercase text-sm hover:bg-red-600/5 transition-all flex flex-col items-center justify-center gap-3">
                      <Music className="w-8 h-8 opacity-30" /> 
                      <div className="flex flex-col gap-1">
                        <span>{trackAudio ? "Аудио выбрано ✓" : t.selectFile}</span>
                        {trackAudioSize > 0 && (
                          <span className={`text-[10px] font-bold ${trackAudioSize > MAX_BINARY_SIZE ? 'text-red-600' : 'text-green-600 opacity-60'}`}>
                            Размер: {(trackAudioSize/1024).toFixed(1)} КБ {trackAudioSize > MAX_BINARY_SIZE ? '(Слишком велик!)' : ''}
                          </span>
                        )}
                        {!trackAudio && <span className="text-[8px] opacity-40 font-medium">Макс. 950 КБ</span>}
                      </div>
                   </div>
                   <input type="file" hidden ref={trackAudioRef} accept="audio/*" onChange={e => {
                     const f = e.target.files?.[0];
                     if (f) { 
                       setTrackAudioSize(f.size);
                       if (f.size > MAX_BINARY_SIZE) {
                         alert(`Файл слишком большой (${(f.size/1024).toFixed(0)} КБ). Лимит хранилища - 980 КБ. Пожалуйста, сожмите аудио.`);
                       }
                       const r = new FileReader(); 
                       r.onloadend = () => setTrackAudio(r.result as string); 
                       r.readAsDataURL(f); 
                     }
                   }} />

                   <div className="flex items-center gap-3 bg-red-600/5 p-4 rounded-xl">
                      <input type="checkbox" id="explicit-check" checked={isExplicit} onChange={e => setIsExplicit(e.target.checked)} className="accent-red-600 w-5 h-5 cursor-pointer" />
                      <label htmlFor="explicit-check" className="font-black uppercase text-[10px] italic cursor-pointer flex-1">{t.explicit}</label>
                   </div>
                   <button type="submit" disabled={isUploading || !trackCover || !trackAudio || !uploadTitle || trackAudioSize > MAX_BINARY_SIZE} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex flex-col items-center gap-2">
                      {isUploading ? (
                        <>
                          <Loader2 className="animate-spin w-8 h-8" />
                          <span className="text-xs italic animate-pulse">{uploadStep}</span>
                        </>
                      ) : t.sendMod}
                   </button>
                </form>
             </div>
          </div>
        )}

        {view === 'profile' && auth.user && (
          <div className="space-y-16">
             <div className="app-card p-12 rounded-[60px] flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
                <Sparkles className="absolute -bottom-10 -left-10 w-48 h-48 opacity-5 text-red-600 rotate-12" />
                <div className="relative">
                  <img src={auth.user.avatar} className="w-48 h-48 rounded-full border-[8px] border-red-600 shadow-2xl relative z-10 object-cover" />
                  {auth.user.isDeveloper && <Crown className="absolute -top-6 -right-6 w-16 h-16 text-yellow-400 fill-yellow-400 z-20 drop-shadow-2xl animate-bounce" />}
                </div>
                <div className="flex-1 text-center md:text-left relative z-10">
                   <h2 className="text-7xl font-black uppercase italic tracking-tighter text-red-600 mb-4">{auth.user.username}</h2>
                   <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                      <span className="bg-red-600 text-white px-8 py-2 rounded-full font-black text-[10px] uppercase italic shadow-xl">{auth.user.isDeveloper ? t.developer : t.verifiedMusician}</span>
                      <span className="bg-black/5 border border-red-500/20 px-8 py-2 rounded-full font-black text-[10px] uppercase italic">{filteredTracks.length} {t.uploadsCount}</span>
                      <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                        {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : (tracks.length > 0 ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />)}
                        <span className="text-[8px] font-black uppercase opacity-60">Node Status: {tracks.length > 0 ? 'Online' : 'Initialize'}</span>
                      </div>
                   </div>
                </div>
             </div>
             <h3 className="text-5xl font-black uppercase italic text-red-600 tracking-tighter flex items-center gap-4">{t.myTracks} <ChevronRight className="w-10 h-10 opacity-20" /></h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredTracks.map(track => (
                  <TrackCard key={track.id} track={track} onPlay={handlePlayTrack} onDelete={handleDeleteTrack} onToggleSave={async () => {
                    await storageService.toggleSavedTrack(auth.user?.id || '', track.id);
                    await syncData(true);
                  }} />
                ))}
                {filteredTracks.length === 0 && <button onClick={() => setView('upload')} className="aspect-square rounded-[40px] border-4 border-dashed border-red-500/20 flex flex-col items-center justify-center gap-4 group hover:border-red-600 transition-all opacity-40 hover:opacity-100">
                   <PlusCircle className="w-16 h-16 group-hover:scale-110 transition-transform" /><span className="font-black uppercase text-xs">{t.firstUpload}</span>
                </button>}
             </div>
          </div>
        )}
      </main>
      
      {nowPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-player">
          <div className="bg-red-600 p-6 shadow-2xl border-t-2 border-white/20">
             <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
                <div className="flex items-center gap-4 flex-1 min-w-0 text-white">
                   <img src={nowPlaying.coverImage} className="w-16 h-16 rounded-2xl shadow-xl object-cover bg-black/20" />
                   <div className="truncate">
                      <h4 className="font-black text-xl uppercase italic leading-none">{nowPlaying.title}</h4>
                      <p className="text-[10px] font-black uppercase opacity-60 mt-2">{nowPlaying.artistName}</p>
                   </div>
                </div>
                <div className="flex flex-col items-center gap-3 flex-1 w-full">
                   <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="bg-white text-red-600 p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50" disabled={isBuffering}>
                      {isBuffering ? <Loader2 className="animate-spin w-8 h-8" /> : (isPlaying ? <Pause className="w-8 h-8 fill-red-600" /> : <Play className="w-8 h-8 fill-red-600 ml-1" />)}
                   </button>
                   {isBuffering && <span className="text-[8px] font-black uppercase text-white animate-pulse">Syncing Audio Cluster...</span>}
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
          <div className="bg-red-600 w-full max-w-lg p-12 rounded-[60px] shadow-2xl relative border-t-[8px] border-red-400/30">
            <button onClick={() => setIsLoginModalOpen(false)} className="absolute top-10 right-10 text-white/40 hover:text-white transition-colors"><X className="w-8 h-8" /></button>
            <div className="text-center mb-10 text-white">
              <Logo className="w-24 h-24 mx-auto mb-6 drop-shadow-lg" />
              <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{t.theRedDoor}</h2>
              <p className="text-red-100 text-[9px] font-black uppercase mt-4 opacity-60 tracking-[0.3em]"> Handshake Protocol </p>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              <input type="text" placeholder={t.stageName} required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 font-black text-white outline-none focus:border-white transition-all uppercase italic text-xl" />
              <input type="password" placeholder={t.password} required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full bg-white/10 border-2 border-white/20 rounded-3xl p-6 font-black text-white outline-none focus:border-white transition-all uppercase italic text-xl" />
              <button type="submit" disabled={isAuthenticating} className="w-full bg-white text-red-600 py-6 rounded-3xl font-black uppercase text-2xl shadow-2xl hover:scale-[1.02] mt-6">{isAuthenticating ? <Loader2 className="animate-spin mx-auto" /> : (authMode === 'login' ? t.loginAction : t.registerAction)}</button>
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-white/60 font-black uppercase text-[10px] italic mt-4">{authMode === 'login' ? t.switchToRegister : t.switchToLogin}</button>
            </form>
          </div>
        </div>
      )}

      <footer className="md:hidden fixed bottom-0 left-0 right-0 bg-red-600 border-t-2 border-white/10 px-8 py-4 z-40 flex justify-around text-white">
          <button onClick={() => setView('home')} className={`p-4 rounded-2xl transition-all ${view === 'home' ? 'bg-white/20 scale-110' : 'opacity-60'}`}><Home className="w-7 h-7" /></button>
          <button onClick={() => auth.isAuthenticated ? setView('library') : setIsLoginModalOpen(true)} className={`p-4 rounded-2xl transition-all ${view === 'library' ? 'bg-white/20 scale-110' : 'opacity-60'}`}><Library className="w-7 h-7" /></button>
          {canModerate && <button onClick={() => setView('moderation')} className={`p-4 rounded-2xl transition-all ${view === 'moderation' ? 'bg-white/20 text-yellow-300 scale-110' : 'opacity-60'}`}><ShieldCheck className="w-7 h-7" /></button>}
          <button onClick={() => auth.isAuthenticated ? setView('upload') : setIsLoginModalOpen(true)} className={`p-4 rounded-2xl transition-all ${view === 'upload' ? 'bg-white/20 scale-110' : 'opacity-60'}`}><PlusCircle className="w-7 h-7" /></button>
          <button onClick={() => setView('settings')} className={`p-4 rounded-2xl transition-all ${view === 'settings' ? 'bg-white/20 scale-110' : 'opacity-60'}`}><Settings className="w-7 h-7" /></button>
      </footer>

    </div>
  );
};

export default App;
