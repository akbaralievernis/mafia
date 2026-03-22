import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Lobby({ roomData, onStart, isHost }) {
  if (!roomData) return null;

  const hostPlayer = roomData.players.find(p => p.isHost);
  const normalPlayers = roomData.players.filter(p => !p.isHost);

  return (
    <div className="container-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel"
        style={{ width: '100%', maxWidth: '500px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Комната: <span style={{ color: 'var(--accent-red)' }}>{roomData.id}</span></h2>
          <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
             <div style={{ background: '#fff', padding: '10px', borderRadius: '8px' }}>
               <img 
                 src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/?room=' + roomData.id)}`}
                 alt="QR Code for joining"
                 width="150"
                 height="150"
               />
             </div>
          </div>
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>Ожидание игроков...</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
          {hostPlayer && (
            <div style={{
              padding: '1rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--accent-purple)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                  {hostPlayer.avatar ? <img src={hostPlayer.avatar} alt="avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : '👤'}
                </div>
                <span style={{ fontWeight: 600 }}>{hostPlayer.name}</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>ГЛАВНЫЙ ЭКРАН (ВЕДУЩИЙ)</span>
            </div>
          )}
        
          <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Игроки ({normalPlayers.length}):</h3>
          <AnimatePresence>
            {normalPlayers.map((p, i) => (
              <motion.div 
                key={p.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ 
                    width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    {p.avatar ? <img src={p.avatar} alt="avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : '👤'}
                  </div>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {isHost ? (
          <button 
            className="btn-primary" 
            style={{ width: '100%' }}
            onClick={onStart}
          >
            {normalPlayers.length < 4 ? `Начать (добавится ${4 - normalPlayers.length} бота)` : 'Начать игру'}
          </button>
        ) : (
          <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            Ожидаем, пока создатель запустит игру...
          </p>
        )}
      </motion.div>
    </div>
  );
}
