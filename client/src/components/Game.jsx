import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, ShieldAlert, Check, AlertTriangle } from 'lucide-react';
import SpectatorScreen from './SpectatorScreen';
import { useSocket } from '../context/SocketContext';

export default function Game({ gameState, myId, onAction, isHost }) {
  const { socket } = useSocket();
  const [selectedId, setSelectedId] = useState(null);
  const [hasActed, setHasActed] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({});
  const [revoteData, setRevoteData] = useState(null);

  // Сброс выбора при смене фазы
  useEffect(() => {
    setHasActed(false);
    setSelectedId(null);
    setCurrentVotes({});
    setRevoteData(null);
  }, [gameState?.phase]);

  // Слушаем ставки (голоса)
  useEffect(() => {
    if (!socket) return;
    socket.on('votes_updated', (votes) => {
      // votes - это словарь { voterId: suspectId }
      // Преобразуем его для удобного отображения: сколько у кого голосов
      const counts = {};
      Object.values(votes).forEach(suspectId => {
        counts[suspectId] = (counts[suspectId] || 0) + 1;
      });
      setCurrentVotes(counts);
    });

    socket.on('revote_started', (data) => {
      setRevoteData(data);
      setCurrentVotes({}); // Сброс голосов для переголосования
      setHasActed(false); // Игроки могут снова голосовать
      setSelectedId(null);
    });

    return () => {
      socket.off('votes_updated');
      socket.off('revote_started');
    };
  }, [socket]);

  if (!gameState || !gameState.roles || !gameState.alivePlayers) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <h2 style={{ color: 'var(--accent-red)', animation: 'pulse 2s infinite' }}>Подготовка ролей...</h2>
      </div>
    );
  }

  const { phase, round, alivePlayers, players, roles } = gameState;
  const myRole = roles[myId] || 'Скрыто';
  const amIAlive = alivePlayers.includes(myId);

  const isNight = phase === 'night';
  const isVoting = phase === 'vote';

  const isActiveRole = ['mafia', 'doctor', 'detective'].includes(myRole);

  // Разрешено ли выбирать: жив + (ночь и активная роль) или голосование
  const canSelect = amIAlive && ((isNight && isActiveRole) || isVoting);

  const handleSelect = (targetId) => {
    if (!canSelect) return;
    if (targetId === myId && isVoting) return; // Нельзя голосовать против себя
    if (!alivePlayers.includes(targetId)) return; // Цель мертва

    // Ограничение при переголосовании
    if (revoteData && !revoteData.candidates.includes(targetId)) {
      return;
    }

    setSelectedId(targetId);
  };

  const confirmAction = () => {
    if (selectedId) {
      onAction(selectedId);
      setHasActed(true);
    }
  };

  const roleNames = {
    mafia: 'Мафия',
    doctor: 'Доктор',
    detective: 'Комиссар',
    citizen: 'Мирный '
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Шапка: фаза и роль */}
      <motion.div 
        layout
        className="glass-panel" 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {isNight ? <Moon size={28} color="var(--accent-purple)" /> : <Sun size={28} color="#FFD700" />}
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
              {isNight ? 'Ночь' : phase === 'vote' ? 'Голосование' : 'День'}
            </h2>
          </div>
          <p className="text-secondary" style={{ marginTop: '0.3rem', fontSize: '0.9rem' }}>Раунд {round}</p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p className="text-secondary" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Ваша роль</p>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-red)' }}>{roleNames[myRole] || myRole}</h3>
          {!amIAlive && <span style={{ fontSize: '0.8rem', color: 'gray' }}>Убит</span>}
        </div>
      </motion.div>

      {/* Информационный тост действий */}
      <AnimatePresence mode="popLayout">
        {canSelect && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid var(--accent-red)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'var(--accent-glow)'
            }}
          >
            <ShieldAlert size={24} color="var(--accent-red)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600 }}>Действие требуется</p>
              <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                {isNight ? 'Выберите вашу цель на эту ночь.' : 'Выберите, кого изгнать на дневном голосовании.'}
              </p>
            </div>
          </motion.div>
        )}
        
        {revoteData && isVoting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ 
              background: 'rgba(255, 0, 0, 0.1)', 
              border: '1px solid var(--accent-red)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem',
              boxShadow: 'var(--accent-glow)'
            }}
          >
            <AlertTriangle size={24} color="var(--accent-red)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: 'var(--accent-red)' }}>Переголосование!</p>
              <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                {revoteData.message}
              </p>
            </div>
          </motion.div>
        )}
        
        {/* Сообщение для мирных жителей ночью */}
        {isNight && !isActiveRole && amIAlive && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
          >
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Город засыпает...</p>
              <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Подождите, пока активные роли сделают свой выбор. Сохраняйте тишину.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Сетка игроков */}
      <div className="grid-players">
        <AnimatePresence>
          {players.map((p, index) => {
            const isDead = !alivePlayers.includes(p.id);
            const isSelected = selectedId === p.id;
            
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isDead ? 0.4 : 1, y: 0 }}
                className={`player-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(p.id)}
                whileTap={{ scale: canSelect && !isDead ? 0.95 : 1 }}
              >
                <div className="player-number">{index + 1}</div>
                
                {/* Аватар или заглушка */}
                <div style={{ 
                  width: '60px', height: '60px', 
                  borderRadius: '50%', 
                  background: isDead ? '#333' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.2))',
                  margin: '0 auto 1rem auto',
                  border: isSelected ? '2px solid var(--accent-red)' : '1px solid var(--glass-border)',
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDead ? 0.3 : 1 }} />
                  ) : null}
                </div>
                
                <h4 style={{ fontWeight: 600, fontSize: '1rem' }}>{p.name}</h4>
                
                {roles[p.id] && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', marginTop: '0.3rem', fontWeight: 600 }}>
                    {roleNames[roles[p.id]] || roles[p.id]}
                  </p>
                )}

                {/* Отображение голосов (днем в фазе vote) */}
                {isVoting && currentVotes[p.id] > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    style={{ marginTop: '0.5rem', background: 'rgba(255, 42, 95, 0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem', color: 'var(--accent-red)', fontWeight: 'bold' }}
                  >
                    Голосов: {currentVotes[p.id]}
                  </motion.div>
                )}

                {isSelected && (
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    style={{ position: 'absolute', top: 10, right: 10, background: 'var(--accent-red)', borderRadius: '50%', padding: '4px' }}
                  >
                    <Check size={14} color="#fff" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Кнопка подтверждения действий, если игрок кого-то выбрал */}
      <AnimatePresence>
        {selectedId && canSelect && !hasActed && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            style={{ position: 'fixed', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100 }}
          >
            <button className="btn-primary" style={{ padding: '1rem 3rem', borderRadius: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(255, 42, 95, 0.4)' }} onClick={confirmAction}>
              Подтвердить выбор
            </button>
          </motion.div>
        )}
        
        {hasActed && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{ position: 'fixed', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100 }}
          >
            <div style={{ background: 'var(--glass-bg)', padding: '1rem 2rem', borderRadius: '30px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontWeight: 600 }}>
               Действие принято. Ожидаем остальных...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
