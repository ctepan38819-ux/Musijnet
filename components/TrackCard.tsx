
import React, { useState, useEffect } from 'react';
import { Track } from '../types';
import { translations } from '../translations';
import { Play, ShieldAlert, CheckCircle, Clock, Trash2, ListPlus, X, Download, Heart, HeartOff, Loader2 } from 'lucide-react';
import { storageService } from '../services/storageService';

interface TrackCardProps {
  track: Track;
  isAdmin?: boolean;
  onStatusChange?: (id: string, status: Track['status']) => void;
  onPlay?: (track: Track) => void;
  onDelete?: (id: string) => void;
  onAddToPlaylist?: (trackId: string) => void;
  onToggleSave?: (trackId: string) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ 
  track, 
  isAdmin, 
  onStatusChange, 
  onPlay, 
  onDelete, 
  onAddToPlaylist,
  onToggleSave 
}) => {
  const auth = storageService.getAuth();
  const lang = (auth as any).language || 'ru';
  const t = translations[lang as keyof typeof translations];
  const [showConfirm, setShowConfirm] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string>(track.coverImage);
  const [isCoverLoading, setIsCoverLoading] = useState(!track.coverImage);

  // Load cover blob if not present in track metadata
  useEffect(() => {
    if (!track.coverImage) {
      setIsCoverLoading(true);
      storageService.getBlob(`cover_${track.id}`).then(url => {
        setCoverUrl(url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop');
        setIsCoverLoading(false);
      }).catch(() => {
        setCoverUrl('https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop');
        setIsCoverLoading(false);
      });
    }
  }, [track.id, track.coverImage]);

  const canDelete = auth.user && (
    auth.user.isDeveloper || 
    auth.user.isAdmin || 
    auth.user.id === track.artistId
  );
  
  const isSaved = auth.user?.savedTrackIds?.includes(track.id);

  const statusColors = {
    pending: 'bg-yellow-500',
    approved: 'bg-green-600',
    rejected: 'bg-gray-500'
  };

  const statusIcons = {
    pending: <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <ShieldAlert className="w-3 h-3" />
  };

  const statusLabels = {
    pending: t.pending,
    approved: t.approved,
    rejected: t.rejected
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const audioSource = await storageService.getBlob(`audio_${track.id}`);
      const link = document.createElement('a');
      link.href = audioSource;
      link.download = `${track.artistName} - ${track.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Не удалось извлечь файл.");
    }
  };

  return (
    <div className="app-card p-4 rounded-2xl hover:border-red-500 transition-all group shadow-sm relative overflow-hidden">
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-red-900/20 flex items-center justify-center">
          {isCoverLoading && <Loader2 className="w-8 h-8 animate-spin text-red-600 opacity-20" />}
          <img 
            src={coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop'} 
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isCoverLoading ? 'opacity-0' : 'opacity-100'}`} 
            alt={track.title} 
          />
          <button 
            onClick={() => onPlay?.(track)}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="bg-red-600 p-4 rounded-full shadow-2xl scale-75 group-hover:scale-100 transition-transform">
              <Play className="fill-white text-white w-8 h-8" />
            </div>
          </button>
          
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
            {track.isExplicit && (
              <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-lg border border-red-400">18+</span>
            )}
            <span className={`${statusColors[track.status]} text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase font-bold shadow-md`}>
               {statusIcons[track.status]}
               {statusLabels[track.status]}
             </span>
          </div>

          <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {auth.isAuthenticated && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleSave?.(track.id); }}
                  className={`p-2 rounded-full backdrop-blur-md transition-colors ${isSaved ? 'bg-red-600 text-white' : 'bg-white/20 hover:bg-white/40 text-white'}`}
                  title={isSaved ? t.removeFromCollection : t.saveToCollection}
                >
                  {isSaved ? <Heart className="w-4 h-4 fill-white" /> : <Heart className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleDownload}
                  className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md"
                  title={t.download}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onAddToPlaylist?.(track.id); }}
                  className="p-2 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md"
                  title={t.addToPlaylist}
                >
                  <ListPlus className="w-4 h-4" />
                </button>
              </>
            )}
            {canDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
                className="p-2 bg-red-600/60 hover:bg-red-600 text-white rounded-full backdrop-blur-md"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-black truncate text-lg leading-tight uppercase italic" style={{ color: 'var(--accent-red)' }}>{track.title}</h3>
          <div className="flex items-center gap-2 mt-1">
             <img src={track.artistAvatar} className="w-5 h-5 rounded-full bg-red-400 object-cover" alt="" />
             <p className="text-sm truncate font-medium opacity-80" style={{ color: 'var(--text-main)' }}>{track.artistName}</p>
          </div>
        </div>

        {isAdmin && track.status === 'pending' && (
          <div className="flex gap-2 pt-2 border-t border-red-500/20">
            <button 
              onClick={() => onStatusChange?.(track.id, 'approved')}
              className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 uppercase"
            >
              <CheckCircle className="w-3 h-3" /> {t.approve}
            </button>
            <button 
              onClick={() => onStatusChange?.(track.id, 'rejected')}
              className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 uppercase"
            >
              <ShieldAlert className="w-3 h-3" /> {t.reject}
            </button>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="absolute inset-0 bg-red-600/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 text-center">
          <ShieldAlert className="w-12 h-12 text-white mb-2 animate-bounce" />
          <p className="text-white font-black uppercase text-xs mb-4 italic tracking-tighter leading-tight">{t.confirmDelete}</p>
          <div className="flex gap-3 w-full">
            <button 
              onClick={() => { onDelete?.(track.id); setShowConfirm(false); }}
              className="flex-1 py-2 bg-white text-red-600 font-black uppercase text-[10px] rounded-full shadow-2xl"
            >
              {t.delete}
            </button>
            <button 
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-2 bg-black/20 text-white font-black uppercase text-[10px] rounded-full"
            >
              <X className="w-4 h-4 mx-auto" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackCard;
