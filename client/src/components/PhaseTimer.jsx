import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Важный UX-элемент: круговой (или линейный) таймер прогресса,
 * показывающий сколько времени осталось до авто-действия (завершение фазы).
 * 
 * @param {number} timeLeft - текущее оставшееся время (сек)
 * @param {number} totalTime - изначальное время фазы (сек) (например, 30 для ночи, 60 для дня)
 * @param {string} phase - текущая фаза, чтобы менять цвет и подпись
 */
export default function PhaseTimer({ timeLeft, totalTime, phase }) {
  // Защита от деления на 0
  const maxTime = totalTime || 1; 

  // Вычисляем прогресс от 0 до 1
  const progress = timeLeft / maxTime;

  // Динамический цвет в зависимости от времени и фазы
  let strokeColor = 'var(--accent-purple)'; 
  if (phase === 'night') strokeColor = '#24243e'; // Темно-синий/индиго
  if (phase === 'vote') strokeColor = 'var(--accent-red)';
  
  // Если времени мало (меньше 25%), пульсируем агрессивным красным
  if (progress < 0.25) {
    strokeColor = '#ff2a5f';
  }

  // Настройка круга
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        
        {/* Фоновый тусклый круг */}
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle 
            cx="50" cy="50" r={radius} 
            stroke="var(--glass-border)" 
            strokeWidth="8" 
            fill="transparent" 
          />
          {/* Анимированный круг прогресса */}
          <motion.circle 
            cx="50" cy="50" r={radius} 
            stroke={strokeColor} 
            strokeWidth="8" 
            fill="transparent"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'linear' }}
            strokeLinecap="round"
          />
        </svg>

        {/* Текст в центре кольца */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          fontWeight: 800,
          fontSize: '1.5rem',
          color: progress < 0.25 ? 'var(--accent-red)' : 'var(--text-primary)'
        }}>
          {timeLeft}
        </div>
      </div>
      
      <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
        {timeLeft === 0 ? 'Время вышло!' : 'До авто-пропуска...'}
      </p>
    </div>
  );
}

// === Пример использования в Game.jsx: ===
/*
  import PhaseTimer from './PhaseTimer';

  // В компоненте:
  <PhaseTimer 
    timeLeft={timerValue} 
    totalTime={phase === 'day' ? 60 : 30} 
    phase={phase} 
  />
*/
