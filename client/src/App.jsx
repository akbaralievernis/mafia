import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { SocketProvider, useSocket } from './context/SocketContext';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';
import './styles/theme.css';

import HostDashboard from './components/HostDashboard';

const RoomRouter = () => {
  const { socket, roomData, myPlayerId, isHostPlayer } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomData) {
      navigate('/');
    }
  }, [roomData, navigate]);

  const myId = myPlayerId;
  const isHost = isHostPlayer;

  const handleStart = React.useCallback(() => {
    if (socket) socket.emit('start_game', {});
  }, [socket]);

  const handleAction = React.useCallback((targetId) => {
    if (!socket || !roomData) return;
    if (roomData.phase === 'night') {
      socket.emit('night_action', { targetId });
    } else if (roomData.phase === 'vote') {
      socket.emit('day_vote', { targetId });
    }
  }, [socket, roomData]);

  if (!roomData || !socket) return null;

  if (roomData.status === 'lobby') {
    return <Lobby roomData={roomData} isHost={isHost} onStart={handleStart} />;
  }

  // Если это хост (ведущий), показываем ему панель управления
  if (isHost && roomData.phase !== 'lobby') {
    return <HostDashboard gameState={roomData} socket={socket} />;
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

    // Serverless architecture removes the need for pinging the backend
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
