import React, {
  createContext, useContext, useEffect,
  useState, useRef, useCallback, useMemo
} from 'react';
import { createClient } from '@supabase/supabase-js';
import GameEngine from '../engine/GameEngine';
import SupabaseIOMock from '../engine/SupabaseIOMock';
import AIBot from '../engine/AIBot.js';

// ─── Supabase Client ───────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://bqmexkdefmpbwsbyzsfa.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_W22iDeFOad4YzqMKFUCr2A_4POuu-nX';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

// ─── Helpers ───────────────────────────────────────────────────────────────────
const generateId = () => `p_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const SocketProvider = ({ children }) => {
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);

  // Refs that never trigger re-renders
  const myId = useRef(generateId());
  const isHost = useRef(false);
  const roomId = useRef(null);
  const channelRef = useRef(null);
  const hostRoomRef = useRef(null);
  const engineRef = useRef(null);

  // ── Client-side event bus (replaces socket.on / socket.off) ─────────────────
  const listenersRef = useRef({});
  const eventBus = useRef({
    on: (event, cb) => {
      if (!listenersRef.current[event]) listenersRef.current[event] = new Set();
      listenersRef.current[event].add(cb);
    },
    off: (event, cb) => {
      listenersRef.current[event]?.delete(cb);
    },
    emit: (event, data) => {
      listenersRef.current[event]?.forEach(cb => cb(data));
    }
  });

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }, []);

  // ── Broadcast to all guests via Supabase ─────────────────────────────────────
  const broadcastToGuests = useCallback((event, data, targetId = null) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'server_to_client',
      payload: { event, data, targetId }
    }).catch(err => console.error('[Host Broadcast Error]', err));
  }, []);

  // ── Dispatch an event both locally AND to guests ──────────────────────────────
  const dispatchGameEvent = useCallback((event, data, targetId = null) => {
    // Always fire locally for the host's own components
    eventBus.current.emit(event, data);
    // Send to all guests over Supabase (targetId = null means everyone)
    broadcastToGuests(event, data, targetId);
  }, [broadcastToGuests]);

  // ── HOST: Process messages from guests ───────────────────────────────────────
  const handleClientToServerMsg = useCallback(async (payload) => {
    if (!isHost.current || !hostRoomRef.current) return;
    const { event, data, replyId } = payload;
    const room = hostRoomRef.current;

    const respond = (resp) => {
      if (!replyId) return;
      channelRef.current?.send({
        type: 'broadcast',
        event: 'server_to_client',
        payload: { event: 'callback_reply', data: resp, targetId: replyId }
      });
    };

    const pushRoomUpdate = () => {
      setRoomData({ ...room });
      broadcastToGuests('room_updated', room);
    };

    // ── join_room ──────────────────────────────────────────────────────────────
    if (event === 'join_room') {
      if (room.status !== 'lobby') return respond({ success: false, error: 'Игра уже началась' });
      if (room.players.length >= room.maxPlayers) return respond({ success: false, error: 'Комната переполнена' });
      if (room.players.find(p => p.name === data.playerName)) return respond({ success: false, error: 'Имя занято' });

      room.players.push({
        id: data.playerId,
        socketId: data.playerId,
        name: data.playerName,
        avatar: data.avatar || null,
        isHost: false
      });
      respond({ success: true, room });
      pushRoomUpdate();
      return;
    }

    // ── start_game ─────────────────────────────────────────────────────────────
    if (event === 'start_game') {
      room.status = 'playing';

      const humanCount = room.players.filter(p => !p.isHost).length;
      if (humanCount < 4) {
        const bots = AIBot.generateBots(humanCount, 4);
        room.players.push(...bots);
      }

      pushRoomUpdate();

      // Create SupabaseIOMock that also fires locally via eventBus
      const mockIo = new SupabaseIOMock(channelRef.current, eventBus.current, myId.current, room.id);
      engineRef.current = new GameEngine(room.id, room.players, mockIo);
      engineRef.current.start();
      return;
    }

    // ── in-game actions ────────────────────────────────────────────────────────
    if (event === 'night_action' && engineRef.current) {
      engineRef.current.handleNightAction(data.senderId, data.targetId);
    } else if (event === 'day_vote' && engineRef.current) {
      engineRef.current.handleDayVote(data.senderId, data.targetId);
    } else if (event === 'send_chat_message' && engineRef.current) {
      engineRef.current.handleChatMessage(data.senderId, data.message);
    }
  }, [broadcastToGuests]);

  // ── GUEST: Process messages from host ────────────────────────────────────────
  const handleServerToClientMsg = useCallback((payload) => {
    const { event, data, targetId } = payload;

    // Filter: ignore messages targeted at other players
    if (targetId && targetId !== myId.current) return;

    if (event === 'callback_reply') {
      const cb = window[`__cb_${myId.current}`];
      if (cb) { cb(data); delete window[`__cb_${myId.current}`]; }
      return;
    }

    if (event === 'room_updated') {
      setRoomData({ ...data });
      return;
    }

    if (event === 'game_started') {
      setRoomData(prev => ({ ...prev, ...data }));
      return;
    }

    if (event === 'error') {
      showError(data?.message || String(data));
      return;
    }

    // ── All other game events go to the local event bus ──
    eventBus.current.emit(event, data);

    // ── Update roomData for key state transitions ──────────────────────────────
    switch (event) {
      case 'state_update':
        setRoomData(prev => prev ? { ...prev, ...data } : data);
        break;
      case 'night_subphase_started':
        setRoomData(prev => prev ? { ...prev, phase: 'night', subPhase: data.subPhase, timeLeft: data.duration } : prev);
        break;
      case 'day_started':
        setRoomData(prev => prev ? { ...prev, ...data, phase: 'day' } : prev);
        break;
      case 'voting_started':
        setRoomData(prev => prev ? { ...prev, phase: 'vote' } : prev);
        break;
      case 'game_over':
        setRoomData(prev => prev ? { ...prev, ...data.finalState, phase: 'end', gameOverData: data } : prev);
        break;
      default:
        break;
    }
  }, [showError]);

  // ── Setup channel subscription when joining as guest ─────────────────────────
  const setupGuestChannel = useCallback(async (code, playerName, avatar, callback) => {
    const newChannel = supabase.channel(`room_${code}`);
    channelRef.current = newChannel;

    newChannel.on('broadcast', { event: 'server_to_client' }, (msg) => {
      handleServerToClientMsg(msg.payload);
    });

    newChannel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;

      window[`__cb_${myId.current}`] = callback;

      await newChannel.send({
        type: 'broadcast',
        event: 'client_to_server',
        payload: {
          event: 'join_room',
          data: { playerName, avatar, playerId: myId.current },
          replyId: myId.current
        }
      });
    });
  }, [handleServerToClientMsg]);

  // ── Setup channel subscription when creating as host ─────────────────────────
  const setupHostChannel = useCallback((code, room, callback) => {
    const newChannel = supabase.channel(`room_${code}`);
    channelRef.current = newChannel;

    newChannel.on('broadcast', { event: 'client_to_server' }, (msg) => {
      handleClientToServerMsg(msg.payload);
    });

    newChannel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      setRoomData({ ...room });
      if (callback) callback({ success: true, room });
    });
  }, [handleClientToServerMsg]);

  // ── Public socket mock (used by components exactly like socket.io) ────────────
  const socket = useMemo(() => ({
    id: myId.current,

    // .on() and .off() delegate to the eventBus
    on: (event, cb) => eventBus.current.on(event, cb),
    off: (event, cb) => eventBus.current.off(event, cb),

    emit: async (event, data, callback) => {

      // ── create_room ────────────────────────────────────────────────────────
      if (event === 'create_room') {
        const code = generateRoomCode();
        const room = {
          id: code,
          players: [{
            id: myId.current,
            socketId: myId.current,
            name: data.playerName,
            avatar: data.avatar || null,
            isHost: true
          }],
          status: 'lobby',
          maxPlayers: data.maxPlayers || 10
        };

        isHost.current = true;
        roomId.current = code;
        hostRoomRef.current = room;
        setupHostChannel(code, room, callback);
        return;
      }

      // ── join_room ──────────────────────────────────────────────────────────
      if (event === 'join_room') {
        const code = data.roomCode?.toUpperCase();
        isHost.current = false;
        roomId.current = code;
        setupGuestChannel(code, data.playerName, data.avatar, callback);
        return;
      }

      // ── in-game actions ────────────────────────────────────────────────────
      if (isHost.current) {
        // Host acts locally – no broadcast needed
        handleClientToServerMsg({ event, data: { ...data, senderId: myId.current } });
      } else if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'client_to_server',
          payload: { event, data: { ...data, senderId: myId.current } }
        }).catch(err => console.error('[Guest Send Error]', err));
      }
    }
  }), [setupHostChannel, setupGuestChannel, handleClientToServerMsg]);

  // ─── HOST: Subscribe to game engine events and update roomData ───────────────
  // The engine emits events through eventBus locally. We listen here and
  // mirror those updates into React state so the UI re-renders.
  useEffect(() => {
    const bus = eventBus.current;

    const onStateUpdate = (data) => {
      setRoomData(prev => prev ? { ...prev, ...data } : data);
    };
    const onGameStarted = (data) => {
      setRoomData(prev => prev ? { ...prev, ...data } : data);
    };
    const onNightSubphase = (data) => {
      setRoomData(prev => prev ? { ...prev, phase: 'night', subPhase: data.subPhase, timeLeft: data.duration } : prev);
    };
    const onDayStarted = (data) => {
      setRoomData(prev => prev ? { ...prev, ...data, phase: 'day', subPhase: null } : prev);
    };
    const onVotingStarted = () => {
      setRoomData(prev => prev ? { ...prev, phase: 'vote' } : prev);
    };
    const onGameOver = (data) => {
      setRoomData(prev => prev ? { ...prev, ...data.finalState, phase: 'end', gameOverData: data } : prev);
    };

    bus.on('state_update', onStateUpdate);
    bus.on('game_started', onGameStarted);
    bus.on('night_subphase_started', onNightSubphase);
    bus.on('day_started', onDayStarted);
    bus.on('voting_started', onVotingStarted);
    bus.on('game_over', onGameOver);

    return () => {
      bus.off('state_update', onStateUpdate);
      bus.off('game_started', onGameStarted);
      bus.off('night_subphase_started', onNightSubphase);
      bus.off('day_started', onDayStarted);
      bus.off('voting_started', onVotingStarted);
      bus.off('game_over', onGameOver);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    socket,
    roomData,
    setRoomData,
    error,
    myPlayerId: myId.current,
    isHostPlayer: isHost.current
  }), [socket, roomData, error]);

  return (
    <SocketContext.Provider value={value}>
      {error && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#ff4444', color: '#fff', padding: '0.8rem 2rem',
          borderRadius: 12, zIndex: 9999, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
        }}>
          ⚠️ {error}
        </div>
      )}
      {children}
    </SocketContext.Provider>
  );
};
