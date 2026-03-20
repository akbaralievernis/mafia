import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, ShieldAlert, Check } from 'lucide-react';

export default function Game({ gameState, myId, onAction }) {
  const [selectedId, setSelectedId] = useState(null);

  if (!gameState) return null;

  const { phase, round, alivePlayers, players, roles } = gameState;
  const myRole = roles[myId] || 'Скрыто';
  const amIAlive = alivePlayers.includes(myId);

  const isNight = phase === 'night';
  const isVoting = phase === 'vote';

  // Разрешено ли выбирать: жив + сейчас ночь или голосование
  const canSelect = amIAlive && (isNight || isVoting);

  const handleSelect = (targetId) => {
    if (!canSelect) return;
    if (targetId === myId && isVoting) return; // Нельзя голосовать против себя
    if (!alivePlayers.includes(targetId)) return; // Цель мертва

    setSelectedId(targetId);
  };

  const confirmAction = () => {
    if (selectedId) {
      onAction(selectedId);
      // Если это просто голос, можно и не сбрасывать, но для визуала оставим выбранным
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
                
                {/* Аватар-заглушка */}
                <div style={{ 
                  width: '60px', height: '60px', 
                  borderRadius: '50%', 
                  background: isDead ? '#333' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.2))',
                  margin: '0 auto 1rem auto',
                  border: isSelected ? '2px solid var(--accent-red)' : '1px solid var(--glass-border)'
                }}/>
                
                <h4 style={{ fontWeight: 600, fontSize: '1rem' }}>{p.name}</h4>
                
                {roles[p.id] && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', marginTop: '0.3rem', fontWeight: 600 }}>
                    {roleNames[roles[p.id]] || roles[p.id]}
                  </p>
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
        {selectedId && canSelect && (
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
      </AnimatePresence>

    </div>
  );
}
