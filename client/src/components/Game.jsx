import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, ShieldAlert } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useTranslation } from '../utils/i18n';
import PhaseTimer from './PhaseTimer';
import PlayerCard from './PlayerCard';

// ─── Role metadata ────────────────────────────────────────────────────────────
const getRoleData = (t) => ({
  roleNames: {
    don: t('role_don'),
    mafia: t('role_mafia'),
    doctor: t('role_doctor'),
    detective: t('role_detective'),
    maniac: t('role_maniac'),
    citizen: t('role_citizen'),
    spectator: t('role_spectator'),
  },
  roleDescriptions: {
    don: t('desc_don'),
    mafia: t('desc_mafia'),
    doctor: t('desc_doctor'),
    detective: t('desc_detective'),
    maniac: t('desc_maniac'),
    citizen: t('desc_citizen'),
    spectator: t('desc_spectator'),
  }
});

const Game = React.memo(({ gameState, myId, onAction, isHost }) => {
  const { t } = useTranslation();
  const { socket } = useSocket();

  const [selectedId, setSelectedId] = useState(null);
  const [hasActed, setHasActed] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({});
  const [revoteData, setRevoteData] = useState(null);
  const [privateMsg, setPrivateMsg] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  const { roleNames, roleDescriptions } = useMemo(() => getRoleData(t), [t]);

  // ── Reset on phase change ──────────────────────────────────────────────────
  useEffect(() => {
    setHasActed(false);
    setSelectedId(null);
    setCurrentVotes({});
    setRevoteData(null);
  }, [gameState?.phase]);

  // ── Subscribe to server events via the socket event bus ───────────────────
  useEffect(() => {
    if (!socket) return;

    const onVotes = (votes) => {
      const counts = {};
      Object.values(votes).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
      setCurrentVotes(counts);
    };

    const onRevote = (data) => {
      setRevoteData(data);
      setCurrentVotes({});
      setHasActed(false);
      setSelectedId(null);
    };

    const onDetectiveResult = (data) => setPrivateMsg({ type: 'detective', ...data });
    const onDonResult = (data) => setPrivateMsg({ type: 'don', ...data });
    const onChat = (data) => setChatMessages(prev => [...prev.slice(-49), data]);

    socket.on('votes_updated', onVotes);
    socket.on('revote_started', onRevote);
    socket.on('detective_result', onDetectiveResult);
    socket.on('don_result', onDonResult);
    socket.on('chat_message', onChat);

    return () => {
      socket.off('votes_updated', onVotes);
      socket.off('revote_started', onRevote);
      socket.off('detective_result', onDetectiveResult);
      socket.off('don_result', onDonResult);
      socket.off('chat_message', onChat);
    };
  }, [socket]);

  // Auto-dismiss private message
  useEffect(() => {
    if (!privateMsg) return;
    const t = setTimeout(() => setPrivateMsg(null), 6000);
    return () => clearTimeout(t);
  }, [privateMsg]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const { phase, round, roles, gameOverData, subPhase } = gameState || {};
  const alivePlayers = gameState?.alivePlayers || [];
  const players = gameState?.players || [];
  const myRole = roles?.[myId] || 'citizen';
  const amIAlive = alivePlayers.includes(myId);
  const isNight = phase === 'night';
  const isVoting = phase === 'vote';

  // I can act if I'm alive AND it's my role's turn (night) OR voting time
  const canSelect = useMemo(() => {
    if (!amIAlive) return false;
    if (isVoting) return true;
    if (isNight && subPhase === myRole) return true;
    return false;
  }, [amIAlive, isVoting, isNight, subPhase, myRole]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = useCallback((targetId) => {
    if (!canSelect || hasActed) return;
    if (targetId === myId && isVoting) return; // can't vote for self
    if (!alivePlayers.includes(targetId)) return;
    if (revoteData && !revoteData.candidates?.includes(targetId)) return;
    setSelectedId(targetId);
  }, [canSelect, hasActed, myId, isVoting, alivePlayers, revoteData]);

  const confirmAction = useCallback(() => {
    if (!selectedId) return;
    onAction(selectedId);
    setHasActed(true);
  }, [selectedId, onAction]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim() || !socket) return;
    socket.emit('send_chat_message', { message: chatInput.trim() });
    setChatInput('');
  }, [chatInput, socket]);

  if (!gameState || !roles) return null;

  // ── Game Over Screen ───────────────────────────────────────────────────────
  if (phase === 'end') {
    const isMafiaWin = gameOverData?.winners === 'mafia';
    const isManiacWin = gameOverData?.winners === 'maniac';
    return (
      <div className="container-center" style={{ minHeight: '80vh' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            background: 'var(--glass-bg)',
            border: `2px solid ${isMafiaWin || isManiacWin ? 'var(--accent-red)' : 'var(--accent-blue)'}`,
            padding: '3rem 2rem',
            borderRadius: '24px',
            textAlign: 'center',
            maxWidth: 480
          }}
        >
          <h1 style={{ color: isMafiaWin || isManiacWin ? 'var(--accent-red)' : 'var(--accent-blue)', fontSize: '3rem' }}>
            {t('game_over')}
          </h1>
          <h2 style={{ margin: '1rem 0' }}>
            {isMafiaWin ? t('winners_mafia') : isManiacWin ? '🔪 Маньяк победил!' : t('winners_citizens')}
          </h2>
          <p className="text-secondary" style={{ marginBottom: '2rem' }}>{gameOverData?.message}</p>

          {/* Reveal all roles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
            {players.map(p => (
              <div key={p.id} style={{
                padding: '0.4rem 0.8rem', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.8rem'
              }}>
                <strong>{p.name}</strong>: {roleNames[roles[p.id]] || roles[p.id]}
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={() => window.location.href = '/'}>
            {t('return_to_lobby')}
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Night subphase label ───────────────────────────────────────────────────
  const nightLabel = {
    don: 'Дон мафии ищет комиссара...',
    mafia: 'Мафия делает выбор...',
    doctor: 'Доктор спешит на помощь...',
    detective: 'Комиссар ищет мафию...',
    maniac: 'Маньяк вышел на охоту...',
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <motion.div layout className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {isNight ? <Moon size={28} color="var(--accent-purple)" /> : <Sun size={28} color="#FFD700" />}
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {isNight ? t('phase_night') : isVoting ? t('phase_vote') : t('phase_day')}
            </h2>
          </div>
          <p className="text-secondary" style={{ fontSize: '0.85rem' }}>{t('round')} {round}</p>
          <PhaseTimer socket={socket} initialTime={null} phase={phase} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="text-secondary" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>{t('your_role')}</p>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-red)' }}>{roleNames[myRole] || myRole}</h3>
          {!amIAlive && <span style={{ fontSize: '0.75rem', color: 'gray' }}>{t('dead')}</span>}
        </div>
      </motion.div>

      {/* ── Role Description ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderLeft: '4px solid var(--accent-purple)',
        padding: '1rem',
        borderRadius: '0 8px 8px 0',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        {roleDescriptions[myRole] || t('desc_spectator')}
      </div>

      {/* ── Private notification (detective/don result) ───────────────────────── */}
      <AnimatePresence>
        {privateMsg && (
          <motion.div
            key="privMsg"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: '1rem', borderRadius: 12,
              background: 'rgba(255,200,0,0.1)',
              border: '1px solid gold',
              fontSize: '0.9rem'
            }}
          >
            {privateMsg.type === 'detective'
              ? `🔍 Проверка: ${players.find(p => p.id === privateMsg.targetId)?.name} — ${privateMsg.isMafia ? '🔴 МАФИЯ' : '🟢 Мирный'}`
              : `🕴️ Дон нашёл: ${players.find(p => p.id === privateMsg.targetId)?.name} — ${privateMsg.isDetective ? '🔵 КОМИССАР' : '🟢 не комиссар'}`
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action Banner ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="popLayout">
        {canSelect && !hasActed && (
          <motion.div key="actionBanner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel"
            style={{ padding: '1rem', border: '1px solid var(--accent-red)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <ShieldAlert size={24} color="var(--accent-red)" />
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('action_required')}</p>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>
                {isNight ? t('action_night') : t('action_vote')}
              </p>
            </div>
          </motion.div>
        )}

        {isNight && !canSelect && amIAlive && (
          <motion.div key="sleeping" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {nightLabel[subPhase] || t('city_sleeps')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Player Grid ───────────────────────────────────────────────────────── */}
      <div className="grid-players">
        {players.map((p, index) => (
          <PlayerCard
            key={p.id}
            player={p}
            index={index}
            isDead={!alivePlayers.includes(p.id)}
            isSelected={selectedId === p.id}
            onSelect={handleSelect}
            canSelect={canSelect && !hasActed}
            roleName={roles[p.id] ? roleNames[roles[p.id]] : null}
            votes={currentVotes[p.id] || 0}
            isVoting={isVoting}
          />
        ))}
      </div>

      {/* ── Day / Voting Chat ─────────────────────────────────────────────────── */}
      {(phase === 'day' || phase === 'vote') && amIAlive && (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {chatMessages.length === 0 && (
              <p className="text-secondary" style={{ fontSize: '0.8rem', textAlign: 'center' }}>Чат пуст. Обсуждайте!</p>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: '0.85rem' }}>
                <strong style={{ color: 'var(--accent-purple)' }}>{msg.senderName}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Написать сообщение..."
              className="input-glass"
              style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.85rem' }}
              maxLength={200}
            />
            <button className="btn-primary" onClick={sendChat} style={{ padding: '0.6rem 1.2rem' }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── Sticky Confirm / Acted Buttons ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedId && canSelect && !hasActed && (
          <motion.div key="confirm" initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }}
            style={{ position: 'fixed', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100 }}>
            <button className="btn-primary" onClick={confirmAction} style={{ padding: '1rem 3rem', borderRadius: '30px' }}>
              {t('confirm_choice')}: {players.find(p => p.id === selectedId)?.name}
            </button>
          </motion.div>
        )}
        {hasActed && (
          <motion.div key="acted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: '2rem', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: 'var(--glass-bg)', padding: '0.8rem 2rem', borderRadius: '30px', border: '1px solid var(--accent-purple)' }}>
              ✅ {t('action_accepted')}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Game;
