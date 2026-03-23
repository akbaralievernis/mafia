import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Tv } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from '../utils/i18n';

export default function SpectatorScreen({ gameState }) {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!socket) return;
    socket.on('timer_update', (data) => {
      setTimeLeft(data.timeLeft);
    });

    return () => {
      socket.off('timer_update');
    };
  }, [socket]);

  const phase = gameState?.phase || 'day';
  const round = gameState?.round || 1;
  const alivePlayers = gameState.alivePlayers || [];
  const players = gameState.players || [];
  const amIAlive = alivePlayers.includes(myId);

  if (phase === 'end') {
    const isMafiaWin = gameState.gameOverData?.winners === 'mafia';
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }}>
          <h1 style={{ fontSize: '3rem', color: isMafiaWin ? 'var(--accent-red)' : 'var(--accent-blue)', marginBottom: '1rem', textTransform: 'uppercase' }}>
            {t('game_over')}
          </h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>
            {isMafiaWin ? t('winners_mafia') : t('winners_citizens')}
          </h2>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '3rem', padding: '0 2rem' }}>
            {gameState.gameOverData?.message}
          </p>
          <button className="btn-primary" onClick={() => window.location.href = '/'} style={{ padding: '1rem 3rem', borderRadius: '30px' }}>
            {t('return_to_lobby')}
          </button>
        </motion.div>
      </div>
    );
  }

  const isNight = phase === 'night';

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Шапка ТВ Экрана */}
      <motion.div 
        layout
        className="glass-panel" 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', border: '1px solid var(--accent-purple)' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {isNight ? <Moon size={32} color="var(--accent-purple)" /> : <Sun size={32} color="#FFD700" />}
            <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>
              {isNight ? t('spectator_title_night') : phase === 'vote' ? t('spectator_title_vote') : t('spectator_title_day')}
            </h2>
          </div>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '1rem' }}>{t('round')} {round}</p>
          {timeLeft !== null && (
            <p style={{ marginTop: '0.3rem', fontSize: '1.2rem', fontWeight: 'bold', color: timeLeft <= 10 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
              {t('time_left')} {timeLeft} {t('sec')}
            </p>
          )}
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <Tv size={30} color="var(--text-secondary)" opacity={0.5} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '2px' }}>{t('spectator_main_screen')}</h3>
        </div>
      </motion.div>

      {/* Описание для зрителей */}
      {isNight ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--accent-purple)' }}>{t('spectator_active_roles')}</h3>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <motion.p 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ color: 'var(--text-secondary)' }}
            >{t('spectator_don_chooses')}</motion.p>
            <motion.p 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              style={{ color: 'var(--text-secondary)' }}
            >{t('spectator_mafia_chooses')}</motion.p>
            <motion.p 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
              style={{ color: 'var(--text-secondary)' }}
            >{t('spectator_doctor_chooses')}</motion.p>
            <motion.p 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0 }}
              style={{ color: 'var(--text-secondary)' }}
            >{t('spectator_detective_chooses')}</motion.p>
            <motion.p 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6 }}
              style={{ color: 'var(--text-secondary)' }}
            >{t('spectator_maniac_chooses')}</motion.p>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--accent-blue)' }}>{t('spectator_discussion')}</h3>
        </div>
      )}

      {/* Сетка игроков */}
      <div className="grid-players" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <AnimatePresence>
          {players.map((p, index) => {
            const isDead = !alivePlayers.includes(p.id);
            
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: isDead ? 0.4 : 1, scale: 1 }}
                style={{
                  background: 'var(--glass-bg)',
                  border: isDead ? '1px solid rgba(255,0,0,0.3)' : '1px solid var(--glass-border)',
                  padding: '1.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{index + 1}</div>
                
                <div style={{ 
                  width: '70px', height: '70px', 
                  borderRadius: '50%', 
                  background: isDead ? '#222' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.3))',
                  margin: '0 auto 1rem auto',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                  overflow: 'hidden',
                  border: isDead ? '2px solid var(--accent-red)' : '2px solid transparent'
                }}>
                  {isDead ? (
                    <span style={{ fontSize: '1.5rem' }}>💀</span>
                  ) : p.avatar ? (
                    <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                
                <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{p.name}</h4>
                {isDead && <p style={{ fontSize: '0.85rem', color: 'var(--accent-red)', fontWeight: 'bold' }}>{t('exiled')}</p>}
                {!isDead && <p style={{ fontSize: '0.85rem', color: 'var(--accent-blue)' }}>{t('in_game')}</p>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}
