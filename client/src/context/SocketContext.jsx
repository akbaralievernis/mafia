import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(0);
  const [gameEvent, setGameEvent] = useState(null);
  const [privateMessage, setPrivateMessage] = useState(null);
  
  useEffect(() => {
    const envURL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const newSocket = io(envURL, {
      transports: ['websocket', 'polling']
    });
    setSocket(newSocket);

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

    // Обработка игровых событий и тостов
    const handleGameEvent = (data) => {
      setGameEvent(data);
      setTimeout(() => setGameEvent(null), 5000);
    };

    newSocket.on('day_started', handleGameEvent);
    newSocket.on('voting_started', handleGameEvent);
    newSocket.on('voting_result', handleGameEvent);
    newSocket.on('phase_started', handleGameEvent);

    newSocket.on('timer', (time) => {
      setTimer(time);
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

  return (
    <SocketContext.Provider value={{ socket, roomData, setRoomData, error, timer, gameEvent, privateMessage }}>
      {children}
    </SocketContext.Provider>
  );
};
