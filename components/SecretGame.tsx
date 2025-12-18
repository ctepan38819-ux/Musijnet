
import React, { useEffect, useRef, useState } from 'react';
import { X, Trophy } from 'lucide-react';
import { translations } from '../translations';
import { storageService } from '../services/storageService';

const SecretGame: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const auth = storageService.getAuth();
  const t = translations[auth.language];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let player = { x: 50, y: 200, width: 30, height: 30, dy: 0, jumpStrength: -8, gravity: 0.4, grounded: false };
    let obstacles: { x: number, y: number, width: number, height: number }[] = [];
    let frame = 0;
    let currentScore = 0;

    const spawnObstacle = () => {
      obstacles.push({ x: canvas.width, y: canvas.height - 40, width: 20, height: 40 });
    };

    const update = () => {
      if (gameOver) return;

      frame++;
      if (frame % 100 === 0) spawnObstacle();

      player.dy += player.gravity;
      player.y += player.dy;

      if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        player.grounded = true;
      } else {
        player.grounded = false;
      }

      obstacles.forEach((obs, index) => {
        obs.x -= 4 + Math.floor(currentScore / 10);
        
        // Collision
        if (
          player.x < obs.x + obs.width &&
          player.x + player.width > obs.x &&
          player.y < obs.y + obs.height &&
          player.y + player.height > obs.y
        ) {
          setGameOver(true);
        }

        if (obs.x + obs.width < 0) {
          obstacles.splice(index, 1);
          currentScore++;
          setScore(currentScore);
        }
      });

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Ground
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.stroke();

      // Player
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(player.x, player.y, player.width, player.height);
      
      // Obstacles
      ctx.fillStyle = '#ffffff';
      obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      });

      animationFrameId = requestAnimationFrame(update);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && player.grounded) {
        player.dy = player.jumpStrength;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    update();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameOver]);

  const resetGame = () => {
    setScore(0);
    setGameOver(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4">
      <div className="bg-red-600 w-full max-w-2xl p-8 rounded-[40px] shadow-[0_0_100px_rgba(220,38,38,0.5)] border-4 border-white/20 relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors">
          <X className="w-8 h-8" />
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white">{t.secretGame}</h2>
          <div className="flex items-center justify-center gap-2 text-white/80 font-black mt-2">
            <Trophy className="w-5 h-5" /> {t.score}: {score}
          </div>
        </div>

        <div className="relative bg-black rounded-3xl overflow-hidden shadow-inner border-4 border-red-900/50">
          <canvas ref={canvasRef} width={600} height={300} className="w-full h-auto" />
          
          {gameOver && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-6">
              <h3 className="text-4xl font-black text-red-600 uppercase italic mb-6">{t.gameOver}</h3>
              <p className="text-white/60 text-xs mb-8 uppercase font-bold tracking-widest">{t.score}: {score}</p>
              <button 
                onClick={resetGame}
                className="bg-red-600 text-white px-12 py-4 rounded-full font-black uppercase text-xl hover:scale-110 transition-transform shadow-2xl"
              >
                {t.restart}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mt-6">Press SPACE to GLITCH (jump)</p>
      </div>
    </div>
  );
};

export default SecretGame;
