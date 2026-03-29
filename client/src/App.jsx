import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { SocketProvider, useSocket } from './context/SocketContext';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import './styles/theme.css';

const RoomRouter = () => {
  const { socket, roomData } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomData) {
      navigate('/');
    }
  }, [roomData, navigate]);

  const playerName = localStorage.getItem('playerName');
  
  // Memoized derived values
  const { myId, isHost } = React.useMemo(() => {
    if (!roomData) return { myId: null, isHost: false };
    
    // In Socket.io version, players might have different IDs
    const myPlayer = roomData.players?.find(p => p.name === playerName);
    return {
      myId: myPlayer ? myPlayer.id : (socket?.id || null),
      isHost: myPlayer ? myPlayer.isHost : false
    };
  }, [roomData, socket, playerName]);

  const handleStart = React.useCallback(() => {
    if (roomData?.id && socket) {
      socket.emit('start_game', { roomCode: roomData.id });
    }
  }, [roomData?.id, socket]);

  const handleAction = React.useCallback((targetId) => {
    if (roomData?.id && socket) {
      if (roomData.phase === 'night') {
        socket.emit('night_action', { roomCode: roomData.id, targetId });
      } else if (roomData.phase === 'vote') {
        socket.emit('day_vote', { roomCode: roomData.id, targetId });
      }
    }
  }, [socket, roomData?.id, roomData?.phase]);

  if (!roomData || !socket) return null;

  if (roomData.status === 'lobby') {
    return <Lobby roomData={roomData} isHost={isHost} onStart={handleStart} />;
  }

  return <Game gameState={roomData} myId={myId} onAction={handleAction} isHost={isHost} />;
};

function App() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check OS preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }

    // Keep the Render/Railway connection alive by pinging the backend periodically
    const envURL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
    const interval = setInterval(() => {
      fetch(`${envURL}/ping`).catch(() => {});
    }, 5 * 60 * 1000); // каждые 5 минут

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, [isDark]);

  return (
    <Router>
      <SocketProvider>
        {/* Theme Toggle Button */}
        <button 
          onClick={() => setIsDark(!isDark)}
          style={{
            position: 'absolute', top: 20, right: 20, zIndex: 1000,
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem'
          }}
          title="Toggle Theme"
        >
          {isDark ? '☀️' : '🌙'}
        </button>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:id" element={<RoomRouter />} />
        </Routes>
      </SocketProvider>
    </Router>
  );
}

export default App;
