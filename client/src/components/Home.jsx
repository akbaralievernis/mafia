import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

export default function Home() {
  const [name, setName] = useState(localStorage.getItem('playerName') || '');
  const [code, setCode] = useState('');
  const { socket, roomData, setRoomData } = useSocket();
  const navigate = useNavigate();

  // Отслеживаем успешное подключение
  useEffect(() => {
    if (roomData && roomData.id) {
      navigate(`/room/${roomData.id}`);
    }
  }, [roomData, navigate]);

  // Читаем код из URL, если перешли по QR коду или прямой ссылке
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setCode(roomParam.toUpperCase());
    }
  }, []);

  const handleJoin = () => {
    if (!name.trim()) return alert("Введите имя!");
    if (!socket) return alert("Нет подключения к серверу");

    localStorage.setItem('playerName', name);
    
    if (code.trim()) {
      socket.emit('join_room', { roomCode: code.toUpperCase(), playerName: name }, (response) => {
        if (response.success) {
          setRoomData(response.room);
        } else {
          alert(response.error || "Ошибка подключения");
        }
      });
    } else {
      socket.emit('create_room', { playerName: name }, (response) => {
        if (response.success) {
          setRoomData(response.room);
        } else {
          alert(response.error || "Ошибка создания комнаты");
        }
      });
    }
  };

  return (
    <div className="container-center">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass-panel" 
        style={{ width: '100%', maxWidth: '400px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>МАФИЯ</h1>
          <p className="text-secondary">Премиум издание без ведущего</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            className="input-glass" 
            placeholder="Ваше имя" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input 
            className="input-glass" 
            placeholder="Код комнаты (оставьте пустым для новой)" 
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button 
            className="btn-primary" 
            style={{ marginTop: '1rem' }}
            onClick={handleJoin}
          >
            {code ? 'Войти в игру' : 'Создать комнату'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
