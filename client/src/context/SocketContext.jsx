import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { VoiceTTS } from '../utils/VoiceTTS';
import { t } from '../utils/i18n';
import GameEngine from '../engine/GameEngine';
import SupabaseIOMock from '../engine/SupabaseIOMock';
import AIBot from '../engine/AIBot.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

const generateRoomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);
  const [privateMessage, setPrivateMessage] = useState(null);

  const channelRef = useRef(null);
  const hostRoomRef = useRef(null); 
  const engineRef = useRef(null);
  const myIdRef = useRef(`p_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const isHostRef = useRef(false);
  const roomIdRef = useRef(null);

  // Unified emitter for client components to use just like socket.io
  const createMockSocket = useCallback((channel) => {
    return {
      id: myIdRef.current,
      emit: async (event, data, callback) => {
        
        // --- 1. CREATE ROOM (HOST ONLY) ---
        if (event === 'create_room') {
          const roomCode = generateRoomCode();
          const newPlayer = { id: myIdRef.current, socketId: myIdRef.current, name: data.playerName, avatar: data.avatar, isHost: true };
          const newRoom = { id: roomCode, players: [newPlayer], status: 'lobby', maxPlayers: data.maxPlayers || 10 };
          
          isHostRef.current = true;
          hostRoomRef.current = newRoom;
          roomIdRef.current = roomCode;
          
          const newChannel = supabase.channel(`room_${roomCode}`);
          channelRef.current = newChannel;
          
          newChannel.on('broadcast', { event: 'client_to_server' }, (payload) => handleClientToServerMsg(payload.payload));
          newChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setRoomData(newRoom);
              setSocket(createMockSocket(newChannel));
              if (callback) callback({ success: true, room: newRoom });
            }
          });
          return;
        }

        // --- 2. JOIN ACCESSIBLE OVER BROADCAST ---
        if (event === 'join_room') {
          const roomCode = data.roomCode.toUpperCase();
          const newChannel = supabase.channel(`room_${roomCode}`);
          channelRef.current = newChannel;
          isHostRef.current = false;
          roomIdRef.current = roomCode;
          
          newChannel.on('broadcast', { event: 'server_to_client' }, (payload) => handleServerToClientMsg(payload.payload));
          newChannel.subscribe(async (status) => {
             if (status === 'SUBSCRIBED') {
               setSocket(createMockSocket(newChannel));
               
               // Ask host to join
               await newChannel.send({
                 type: 'broadcast',
                 event: 'client_to_server',
                 payload: { 
                   event: 'join_room', 
                   data: { ...data, playerId: myIdRef.current }, 
                   replyId: myIdRef.current 
                 }
               });

               // Temporary callback resolver attached to window so broadcast can trigger it
               if (callback) {
                 window[`cb_${myIdRef.current}`] = callback;
               }
             }
          });
          return;
        }

        // --- 3. IN-GAME ACTIONS (Send to Host) ---
        if (channelRef.current) {
           if (isHostRef.current) {
             // Local bypass for Host sending actions to itself
             handleClientToServerMsg({ event, data: { ...data, senderId: myIdRef.current } });
           } else {
             // Guest sends to Host
             channelRef.current.send({
                type: 'broadcast',
                event: 'client_to_server',
                payload: { event, data: { ...data, senderId: myIdRef.current } }
             });
           }
        }
      }
    };
  }, []);

  // Initialize basic socket mock before joining any channel
  useEffect(() => {
    setSocket(createMockSocket(null));
  }, [createMockSocket]);

  // --- HOST LOGIC: Processing Messages from Guests ---
  const handleClientToServerMsg = async (payload) => {
    if (!isHostRef.current || !hostRoomRef.current) return;
    const { event, data, replyId } = payload;
    const room = hostRoomRef.current;

    const respond = async (resp) => {
       if (replyId) {
         await channelRef.current.send({
           type: 'broadcast',
           event: 'server_to_client',
           payload: { event: 'callback_reply', targetId: replyId, data: resp }
         });
       }
    };

    const broadcastUpdate = () => {
      // Local update
      setRoomData({ ...hostRoomRef.current });
      // Network update
      channelRef.current.send({
         type: 'broadcast', event: 'server_to_client',
         payload: { event: 'room_updated', targetId: null, data: hostRoomRef.current }
      });
    };

    if (event === 'join_room') {
      if (room.status !== 'lobby') return respond({ success: false, error: 'Игра уже началась' });
      if (room.players.length >= room.maxPlayers) return respond({ success: false, error: 'Комната переполнена' });
      if (room.players.find(p => p.name === data.playerName)) return respond({ success: false, error: 'Имя занято' });

      room.players.push({ id: data.playerId, socketId: data.playerId, name: data.playerName, avatar: data.avatar, isHost: false });
      respond({ success: true, room });
      broadcastUpdate();
    }

    else if (event === 'start_game') {
      room.status = 'playing';
      
      const activePlayersCount = room.players.filter(p => !p.isHost).length;
      if (activePlayersCount < 4) {
         const bots = AIBot.generateBots(activePlayersCount, 4);
         room.players.push(...bots);
         startEngine();
      } else {
         startEngine();
      }
      
      const startEngine = () => {
         broadcastUpdate();
         const mockIo = new SupabaseIOMock(channelRef.current);
         // Engine callback to update our local host state when emitting to everyone
         const originalEmit = mockIo.emit.bind(mockIo);
         mockIo.emit = (ev, d) => {
            if (ev === 'state_update') setRoomData(prev => ({ ...prev, ...d }));
            if (ev === 'room_updated' || ev === 'game_started') setRoomData(d);
            originalEmit(ev, d);
         };

         engineRef.current = new GameEngine(room.id, room.players, mockIo);
         engineRef.current.start();
      };
    }

    else if (event === 'night_action' && engineRef.current) {
      engineRef.current.handleNightAction(data.senderId, data.targetId);
    }
    else if (event === 'day_vote' && engineRef.current) {
      engineRef.current.handleDayVote(data.senderId, data.targetId);
    }
    else if (event === 'send_chat_message' && engineRef.current) {
      engineRef.current.handleChatMessage(data.senderId, data.message);
    }
  };

  // --- GUEST LOGIC: Processing Messages from Host ---
  const handleServerToClientMsg = (payload) => {
    const { event, targetId, data } = payload;
    
    // Ignore targeted messages not for me (allow room-wide broadcasts where targetId === roomIdRef.current)
    if (targetId && targetId !== myIdRef.current && targetId !== roomIdRef.current) return;

    if (event === 'callback_reply') {
       if (window[`cb_${myIdRef.current}`]) {
          window[`cb_${myIdRef.current}`](data);
          delete window[`cb_${myIdRef.current}`];
       }
    }
    else if (event === 'room_updated' || event === 'game_started') {
       setRoomData(data);
    }
    else if (event === 'state_update') {
       setRoomData(prev => ({ ...prev, ...data }));
    }
    else if (event === 'error') {
       setError(data.message || data);
       setTimeout(() => setError(null), 3000);
    }
    else if (event === 'game_over') {
       setRoomData(prev => ({ ...prev, ...data.finalState, phase: 'end', gameOverData: data }));
    }
    // Phase and Events
    else if (event === 'night_subphase_started') setRoomData(prev => ({ ...prev, subPhase: data.subPhase, duration: data.duration }));
    else if (event === 'timer_update') setRoomData(prev => ({ ...prev, timeLeft: data.timeLeft }));
    else if (event === 'day_started') setRoomData(prev => ({ ...prev, phase: 'day', dayResults: data }));
    else if (event === 'voting_started') setRoomData(prev => ({ ...prev, phase: 'vote', votingMessage: data.message }));
    else if (event === 'votes_updated') setRoomData(prev => ({ ...prev, votes: data }));
    else if (event === 'revote_started') setRoomData(prev => ({ ...prev, tiedCandidates: data.candidates, phase: 'vote' }));
    else if (event === 'voting_result') setRoomData(prev => ({ ...prev, votingResult: data }));
    else if (event === 'chat_message') {
       // We might want to dispatch an event or attach to roomData briefly
       const ev = new CustomEvent('mafia_chat', { detail: data });
       window.dispatchEvent(ev);
    }
    // Notifications
    else if (event === 'detective_result' || event === 'don_result') {
       setPrivateMessage(data);
       setTimeout(() => setPrivateMessage(null), 5000);
    }
  };


  useEffect(() => {
    if (!roomData) return;
    if (roomData.phase === 'night' && roomData.subPhase === 'don') VoiceTTS.speak(t('tts_night_starts') + ". " + t('tts_don_wakes'));
    else if (roomData.phase === 'day' && roomData.subPhase === 'results') VoiceTTS.speak(t('tts_day_starts'));
    else if (roomData.phase === 'vote') VoiceTTS.speak(t('tts_voting_time'));
    else if (roomData.status === 'end') VoiceTTS.speak(roomData.gameOverData?.message || t('game_over'));

    if (roomData.phase === 'night') {
      const sub = roomData.subPhase;
      if (sub === 'mafia') VoiceTTS.speak(t('tts_mafia_wakes') + " " + t('tts_mafia_attacks'));
      else if (sub === 'doctor') VoiceTTS.speak(t('tts_doctor_wakes'));
      else if (sub === 'detective') VoiceTTS.speak(t('tts_detective_wakes'));
      else if (sub === 'maniac') VoiceTTS.speak(t('tts_maniac_wakes'));
    }
  }, [roomData?.phase, roomData?.subPhase, roomData?.status]);

  const value = React.useMemo(() => ({ 
    socket, roomData, setRoomData, error, privateMessage 
  }), [socket, roomData, error, privateMessage]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
