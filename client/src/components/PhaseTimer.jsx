import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';

/**
 * Изолированный компонент таймера.
 * Слушает события 'timer_update' и обновляется независимо, 
 * не вызывая перерисовку всей сетки игроков.
 */
const PhaseTimer = ({ socket, initialTime, phase }) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(initialTime || null);

  useEffect(() => {
    if (!socket) return;

    const handleTimer = (data) => {
      setTimeLeft(data.timeLeft);
    };

    socket.on('timer_update', handleTimer);

    return () => {
      socket.off('timer_update', handleTimer);
    };
  }, [socket]);

  // Сброс при смене фазы (опционально, так как сервер пришлет новые данные)
  useEffect(() => {
    // Не сбрасываем принудительно, доверяем серверу
  }, [phase]);

  if (timeLeft === null) return null;

  const isLowTime = timeLeft <= 10;

  return (
    <p style={{ 
      marginTop: '0.3rem', 
      fontSize: '1.2rem', 
      fontWeight: 'bold', 
      color: isLowTime ? 'var(--accent-red)' : 'var(--accent-blue)',
      transition: 'color 0.3s ease'
    }}>
      {t('time_left')} {timeLeft} {t('sec')}
    </p>
  );
};

export default React.memo(PhaseTimer);
