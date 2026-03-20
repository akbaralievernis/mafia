import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Lobby({ roomData, onStart, isHost }) {
  if (!roomData) return null;

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
          <p className="text-secondary" style={{ marginTop: '0.5rem' }}>Ожидание игроков...</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '2rem' }}>
          <AnimatePresence>
            {roomData.players.map((p, i) => (
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
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                {p.isHost && <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>СОЗДАТЕЛЬ</span>}
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
            {roomData.players.length < 4 ? `Начать с ботами (не хватает ${4 - roomData.players.length})` : 'Начать игру'}
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
