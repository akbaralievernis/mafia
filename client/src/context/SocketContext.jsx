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
      // Пытаемся восстановить сессию
      const lastRoomId = localStorage.getItem('lastRoomId');
      const playerName = localStorage.getItem('playerName');
      if (lastRoomId && playerName) {
        newSocket.emit('reconnect_room', { roomCode: lastRoomId, playerName });
      }
    });

    newSocket.on('room_updated', (data) => {
      setRoomData(data);
      if (data.id) localStorage.setItem('lastRoomId', data.id);
    });

    newSocket.on('game_started', (data) => {
      setRoomData(data);
      if (data.id) localStorage.setItem('lastRoomId', data.id);
    });

    newSocket.on('state_update', (data) => {
      setRoomData(prev => ({ ...prev, ...data }));
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

  // Handle TTS and events from roomData changes
  useEffect(() => {
    if (!roomData) return;

    // Phase Change TTS
    if (roomData.phase === 'night' && roomData.subPhase === 'don') {
       VoiceTTS.speak(t('tts_night_starts') + ". " + t('tts_don_wakes'));
    } else if (roomData.phase === 'day' && roomData.subPhase === 'results') {
       VoiceTTS.speak(t('tts_day_starts'));
    } else if (roomData.phase === 'vote') {
       VoiceTTS.speak(t('tts_voting_time'));
    } else if (roomData.status === 'end') {
       VoiceTTS.speak(roomData.gameOverData?.message || t('game_over'));
    }

    // SubPhase Specific TTS
    if (roomData.phase === 'night') {
      const sub = roomData.subPhase;
      if (sub === 'mafia') VoiceTTS.speak(t('tts_mafia_wakes') + " " + t('tts_mafia_attacks'));
      else if (sub === 'doctor') VoiceTTS.speak(t('tts_doctor_wakes'));
      else if (sub === 'detective') VoiceTTS.speak(t('tts_detective_wakes'));
      else if (sub === 'maniac') VoiceTTS.speak(t('tts_maniac_wakes'));
    }
  }, [roomData?.phase, roomData?.subPhase, roomData?.status]);

  const value = React.useMemo(() => ({ 
    socket, roomData, setRoomData, error, gameEvent, privateMessage
  }), [socket, roomData, error, gameEvent, privateMessage]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
