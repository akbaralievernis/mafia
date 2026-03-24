import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from '../utils/i18n';
import PhaseTimer from './PhaseTimer';
import PlayerCard from './PlayerCard';

// Static Role Metadata moved outside to prevent re-creation on every render
const getRoleData = (t) => ({
  roleNames: {
    don: t('role_don'),
    mafia: t('role_mafia'),
    doctor: t('role_doctor'),
    detective: t('role_detective'),
    maniac: t('role_maniac'),
    citizen: t('role_citizen')
  },
  roleDescriptions: {
    don: t('desc_don'),
    mafia: t('desc_mafia'),
    doctor: t('desc_doctor'),
    detective: t('desc_detective'),
    maniac: t('desc_maniac'),
    citizen: t('desc_citizen'),
    spectator: t('desc_spectator')
  }
});

const Game = React.memo(({ gameState, myId, onAction, isHost }) => {
  const { t } = useTranslation();
  const { socket } = useSocket();
  const [selectedId, setSelectedId] = useState(null);
  const [hasActed, setHasActed] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({});
  const [revoteData, setRevoteData] = useState(null);

  // Memoized role names and descriptions
  const { roleNames, roleDescriptions } = useMemo(() => getRoleData(t), [t]);

  // Reset local state on phase change
  useEffect(() => {
    setHasActed(false);
    setSelectedId(null);
    setCurrentVotes({});
    setRevoteData(null);
  }, [gameState?.phase]);

  useEffect(() => {
    if (!socket) return;
    
    const handleVotes = (votes) => {
      const counts = {};
      Object.values(votes).forEach(suspectId => {
        counts[suspectId] = (counts[suspectId] || 0) + 1;
      });
      setCurrentVotes(counts);
    };

    const handleRevote = (data) => {
      setRevoteData(data);
      setCurrentVotes({});
      setHasActed(false);
      setSelectedId(null);
    };

    socket.on('votes_updated', handleVotes);
    socket.on('revote_started', handleRevote);

    return () => {
      socket.off('votes_updated', handleVotes);
      socket.off('revote_started', handleRevote);
    };
  }, [socket]);

  const { phase, round, roles, gameOverData } = gameState || {};
  const alivePlayers = gameState?.alivePlayers || [];
  const players = gameState?.players || [];
  const myRole = roles ? (roles[myId] || 'citizen') : 'citizen';
  const amIAlive = alivePlayers.includes(myId);

  // Phase logic
  const isNight = phase === 'night';
  const isVoting = phase === 'vote';
  const canSelect = amIAlive && ((isNight && gameState?.subPhase === myRole) || isVoting);

  // Event handlers
  const handleSelect = useCallback((targetId) => {
    if (!canSelect) return;
    if (targetId === myId && isVoting) return;
    if (!alivePlayers.includes(targetId)) return;
    if (revoteData && !revoteData.candidates.includes(targetId)) return;

    setSelectedId(targetId);
  }, [canSelect, myId, isVoting, alivePlayers, revoteData]);

  const confirmAction = useCallback(() => {
    if (selectedId) {
      onAction(selectedId);
      setHasActed(true);
    }
  }, [selectedId, onAction]);

  if (!gameState || !roles) return null;

  if (phase === 'end') {
    const isMafiaWin = gameOverData?.winners === 'mafia';
    return (
      <div className="container-center" style={{ minHeight: '80vh' }}>
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: 'var(--glass-bg)',
            border: `2px solid ${isMafiaWin ? 'var(--accent-red)' : 'var(--accent-blue)'}`,
            padding: '3rem 2rem',
            borderRadius: '24px',
            textAlign: 'center'
          }}
        >
          <h1 style={{ color: isMafiaWin ? 'var(--accent-red)' : 'var(--accent-blue)', fontSize: '3rem' }}>{t('game_over')}</h1>
          <h2>{isMafiaWin ? t('winners_mafia') : t('winners_citizens')}</h2>
          <p className="text-secondary" style={{ margin: '1rem 0 2rem 0' }}>{gameOverData?.message}</p>
          <button className="btn-primary" onClick={() => window.location.href = '/'}>{t('return_to_lobby')}</button>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Optimized Header with Isolated Timer */}
      <motion.div layout className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {isNight ? <Moon size={28} color="var(--accent-purple)" /> : <Sun size={28} color="#FFD700" />}
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {isNight ? t('phase_night') : phase === 'vote' ? t('phase_vote') : t('phase_day')}
            </h2>
          </div>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{t('round')} {round}</p>
          
          {/* ISOLATED TIMER: DOES NOT RE-RENDER THE WHOLE GRID */}
          <PhaseTimer socket={socket} initialTime={null} phase={phase} />
        </div>

        <div style={{ textAlign: 'right' }}>
          <p className="text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('your_role')}</p>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-red)' }}>{roleNames[myRole] || myRole}</h3>
          {!amIAlive && <span style={{ fontSize: '0.75rem', color: 'gray' }}>{t('dead')}</span>}
        </div>
      </motion.div>

      {/* Role Rule Card */}
      <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderLeft: '4px solid var(--accent-purple)', padding: '1rem', borderRadius: '0 8px 8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {roleDescriptions[myRole] || t('desc_spectator')}
      </div>

      <AnimatePresence mode="popLayout">
        {canSelect && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ padding: '1rem', border: '1px solid var(--accent-red)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <ShieldAlert size={24} color="var(--accent-red)" />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('action_required')}</p>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>{isNight ? t('action_night') : t('action_vote')}</p>
            </div>
          </motion.div>
        )}

        {isNight && !canSelect && amIAlive && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {gameState.subPhase === 'don' ? 'Дон мафии ищет комиссара...' : 
               gameState.subPhase === 'mafia' ? 'Мафия делает выбор...' : 
               gameState.subPhase === 'doctor' ? 'Доктор спешит на помощь...' : 
               gameState.subPhase === 'detective' ? 'Комиссар ищет мафию...' : 
               gameState.subPhase === 'maniac' ? 'Маньяк вышел на охоту...' : 
               t('city_sleeps')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MEMOIZED PLAYER GRID */}
      <div className="grid-players">
        {players.map((p, index) => (
          <PlayerCard 
            key={p.id}
            player={p}
            index={index}
            isDead={!alivePlayers.includes(p.id)}
            isSelected={selectedId === p.id}
            onSelect={handleSelect}
            canSelect={canSelect}
            roleName={roles[p.id] ? roleNames[roles[p.id]] : null}
            votes={currentVotes[p.id] || 0}
            isVoting={isVoting}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedId && canSelect && !hasActed && (
          <motion.div initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }} style={{ position: 'fixed', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100 }}>
            <button className="btn-primary" onClick={confirmAction} style={{ padding: '1rem 3rem', borderRadius: '30px' }}>
              {t('confirm_choice')}
            </button>
          </motion.div>
        )}
        
        {hasActed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: 'fixed', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'var(--glass-bg)', padding: '0.8rem 2rem', borderRadius: '30px', border: '1px solid var(--accent-purple)' }}>
               {t('action_accepted')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Game;
