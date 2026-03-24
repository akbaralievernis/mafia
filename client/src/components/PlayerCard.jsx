import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Мемоизированный компонент карточки игрока.
 * Перерисовывается только если изменились его конкретные данные.
 */
const PlayerCard = ({ 
  player, 
  index, 
  isDead, 
  isSelected, 
  onSelect, 
  canSelect, 
  roleName, 
  votes, 
  isVoting 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDead ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`player-card ${isSelected ? 'selected' : ''} ${isDead ? 'dead' : ''}`}
      onClick={() => !isDead && onSelect(player.id)}
      whileTap={{ scale: canSelect && !isDead ? 0.98 : 1 }}
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="player-number">{index + 1}</div>
      
      {/* Аватар */}
      <div style={{ 
        width: '60px', height: '60px', 
        borderRadius: '50%', 
        background: isDead ? '#222' : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.2))',
        margin: '0 auto 1rem auto',
        border: isSelected ? '2px solid var(--accent-red)' : '1px solid var(--glass-border)',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}>
        {player.avatar ? (
          <img src={player.avatar} alt={player.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isDead ? 0.2 : 1 }} />
        ) : (
          <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>👤</span>
        )}
      </div>
      
      <h4 style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player.name}
      </h4>
      
      {roleName && (
        <p style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', marginTop: '0.3rem', fontWeight: 700 }}>
          {roleName}
        </p>
      )}

      {/* Отображение голосов */}
      {isVoting && votes > 0 && (
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          style={{ 
            marginTop: '0.6rem', 
            background: 'rgba(255, 42, 95, 0.25)', 
            padding: '2px 8px', 
            borderRadius: '10px', 
            fontSize: '0.75rem', 
            color: 'var(--accent-red)', 
            fontWeight: 'bold',
            border: '1px solid rgba(255, 42, 95, 0.3)'
          }}
        >
          {votes}
        </motion.div>
      )}

      {isSelected && (
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          style={{ position: 'absolute', top: 10, right: 10, background: 'var(--accent-red)', borderRadius: '50%', padding: '4px', boxShadow: '0 0 10px rgba(255,42,95,0.5)' }}
        >
          <Check size={12} color="#fff" strokeWidth={3} />
        </motion.div>
      )}
    </motion.div>
  );
};

// CRITICAL: memo prevents re-renders when other players or timer change
export default React.memo(PlayerCard);
