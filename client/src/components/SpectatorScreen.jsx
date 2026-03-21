import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Tv } from 'lucide-react';

export default function SpectatorScreen({ gameState }) {
  const { phase, round, alivePlayers, players } = gameState;
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
              {isNight ? 'Ночь: Город засыпает' : phase === 'vote' ? 'Дневное голосование' : 'День: Обсуждение'}
            </h2>
          </div>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '1rem' }}>Раунд {round}</p>
        </div>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <Tv size={30} color="var(--text-secondary)" opacity={0.5} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', letterSpacing: '2px' }}>Главный Экран</h3>
        </div>
      </motion.div>

      {/* Описание для зрителей */}
      {isNight ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--accent-purple)' }}>Активные роли делают свой выбор...</h3>
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>Роли скрыты, чтобы не портить интригу.</p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--accent-blue)' }}>Идет обсуждение. Выслушайте каждого!</h3>
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
                layout
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
                  display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                  {isDead && <span style={{ fontSize: '1.5rem' }}>💀</span>}
                </div>
                
                <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{p.name}</h4>
                {isDead && <p style={{ fontSize: '0.85rem', color: 'var(--accent-red)', fontWeight: 'bold' }}>Исключен</p>}
                {!isDead && <p style={{ fontSize: '0.85rem', color: 'var(--accent-blue)' }}>В игре</p>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}
