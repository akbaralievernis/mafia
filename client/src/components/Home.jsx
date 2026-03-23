import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from '../utils/i18n';

export default function Home() {
  const [name, setName] = useState(localStorage.getItem('playerName') || '');
  const [avatar, setAvatar] = useState(localStorage.getItem('playerAvatar') || null);
  const [code, setCode] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const fileInputRef = useRef(null);
  
  const { t, lang, setLanguage } = useTranslation();
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        return alert(t('file_too_large') || "Файл слишком большой!");
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result;
        img.onload = () => {
          // Создаем холст для ресайза
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 128; // Маленький размер для аватара
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Получаем сжатую версию (0.7 качество)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setAvatar(dataUrl);
          localStorage.setItem('playerAvatar', dataUrl);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleJoin = () => {
    if (!name.trim()) return alert("Введите имя!");
    if (!socket) return alert("Нет подключения к серверу");

    localStorage.setItem('playerName', name);
    
    if (code.trim()) {
      socket.emit('join_room', { roomCode: code.toUpperCase(), playerName: name, avatar }, (response) => {
        if (response.success) {
          setRoomData(response.room);
        } else {
          alert(response.error || "Ошибка подключения");
        }
      });
    } else {
      socket.emit('create_room', { playerName: name, avatar }, (response) => {
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
        style={{ width: '100%', maxWidth: '400px', position: 'relative' }}
      >
        {/* Language Selector */}
        <div style={{ position: 'absolute', top: 15, right: 15, display: 'flex', gap: '8px' }}>
          <button onClick={() => setLanguage('ru')} style={{ opacity: lang === 'ru' ? 1 : 0.4, border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>🇷🇺</button>
          <button onClick={() => setLanguage('de')} style={{ opacity: lang === 'de' ? 1 : 0.4, border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>🇩🇪</button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>МАФИЯ</h1>
          <p className="text-secondary">{t('home_subtitle')}</p>
        </div>

        {/* Profile Avatar Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div 
            style={{ 
              width: '80px', height: '80px', borderRadius: '50%', cursor: 'pointer',
              background: avatar ? `url(${avatar}) center/cover` : 'rgba(255,255,255,0.1)',
              border: '2px dashed var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center',
              overflow: 'hidden'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {!avatar && <span style={{ fontSize: '2rem', opacity: 0.5 }}>📸</span>}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleImageUpload} 
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', marginTop: '0.5rem', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
            {t('avatar_upload')}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input 
            className="input-glass" 
            placeholder={t('enter_name')} 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input 
            className="input-glass" 
            placeholder={t('enter_code')} 
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button 
            className="btn-primary" 
            style={{ marginTop: '1rem' }}
            onClick={handleJoin}
          >
            {code ? t('join_game') : t('create_room_btn')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
