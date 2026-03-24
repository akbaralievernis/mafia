import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { VoiceTTS } from '../utils/VoiceTTS';
import { t } from '../utils/i18n';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);
  const [gameEvent, setGameEvent] = useState(null);
  const [privateMessage, setPrivateMessage] = useState(null);
  
  useEffect(() => {
    const envURL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const newSocket = io(envURL, {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      // Пытаемся восстановить сессию, если произошел обрыв связи (например, свернули браузер на телефоне)
      setRoomData(currentRoom => {
        if (currentRoom && currentRoom.id) {
          const playerName = localStorage.getItem('playerName');
          if (playerName) {
            newSocket.emit('reconnect_room', { roomCode: currentRoom.id, playerName });
          }
        }
        return currentRoom;
      });
    });

    newSocket.on('game_started', (data) => {
      setRoomData(prev => ({ ...prev, ...data }));
      if (data.event) {
        setGameEvent(data.event);
        setTimeout(() => setGameEvent(null), 5000);
      }
    });

    // Обработка обновлений стейта игры (рассылается сервером)
    newSocket.on('state_update', (data) => {
      setRoomData(prev => ({ ...prev, ...data }));
    });

    newSocket.on('game_updated', (data) => {
      setRoomData(prev => ({ ...prev, ...data }));
    });

    newSocket.on('room_updated', (data) => {
      setRoomData(prev => prev ? { ...prev, ...data } : data);
    });

    newSocket.on('game_over', (data) => {
      VoiceTTS.speak(data.message);
      setRoomData(prev => ({ ...prev, phase: 'end', gameOverData: data }));
    });

    // Обработка игровых событий и тостов
    const handleGameEvent = (data) => {
      setGameEvent(data);
      setTimeout(() => setGameEvent(null), 5000);
    };

    newSocket.on('day_started', (data) => {
      VoiceTTS.speak(t('tts_day_starts'));
      handleGameEvent(data);
    });

    newSocket.on('voting_started', (data) => {
      VoiceTTS.speak(t('tts_voting_time'));
      handleGameEvent(data);
    });

    newSocket.on('voting_result', (data) => {
      VoiceTTS.speak(data.message); // Сервер присылает имя убитого, лучше озвучить как есть (имя) или добавить ключ в будущем
      handleGameEvent(data);
    });

    newSocket.on('revote_started', (data) => {
      VoiceTTS.speak(t('revote'));
      handleGameEvent(data);
    });

    newSocket.on('phase_started', (data) => {
      if (data.phase === 'night') {
        VoiceTTS.speak(t('tts_night_starts'));
      }
      handleGameEvent(data);
    });

    newSocket.on('night_subphase_started', (data) => {
      if (data.subPhase === 'don') {
        VoiceTTS.speak(t('tts_don_wakes'));
      } else if (data.subPhase === 'mafia') {
        VoiceTTS.speak(t('tts_mafia_wakes') + " " + t('tts_mafia_attacks'));
      } else if (data.subPhase === 'doctor') {
        VoiceTTS.speak(t('tts_doctor_wakes'));
      } else if (data.subPhase === 'detective') {
        VoiceTTS.speak(t('tts_detective_wakes'));
      } else if (data.subPhase === 'maniac') {
        VoiceTTS.speak(t('tts_maniac_wakes'));
      }
      handleGameEvent(data);
    });


    newSocket.on('privateMessage', (msg) => {
      setPrivateMessage(msg);
      setTimeout(() => setPrivateMessage(null), 5000);
    });

    newSocket.on('error', (msg) => {
      setError(msg.message || msg);
      setTimeout(() => setError(null), 3000);
    });

    return () => newSocket.close();
  }, []);

  const value = React.useMemo(() => ({ 
    socket, roomData, setRoomData, error, gameEvent, privateMessage 
  }), [socket, roomData, error, gameEvent, privateMessage]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
