import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, SkipForward, Mic, Eye, Users, Shield, Heart, Zap, Crosshair } from 'lucide-react';
import PlayerCard from './PlayerCard';

const SCRIPTS = {
  night_start: { narrative: "Наступает ночь. Весь город засыпает.", instruction: "Озвучьте: 'Город засыпает...'" },
  putana: { narrative: "Просыпается Путана. Кого она навестит этой ночью?", instruction: "Озвучьте: 'Путана просыпается...'" },
  don: { narrative: "Просыпается Дон мафии. Он ищет комиссара.", instruction: "Озвучьте: 'Дон просыпается...'" },
  mafia: { narrative: "Мафия выходит на охоту. Кого они уберут со своего пути?", instruction: "Озвучьте: 'Мафия просыпается...'" },
  doctor: { narrative: "Просыпается Доктор. Кого он будет лечить?", instruction: "Озвучьте: 'Доктор просыпается...'" },
  bodyguard: { narrative: "Телохранитель выходит на патруль. Кого он защитит собой?", instruction: "Озвучьте: 'Телохранитель просыпается...'" },
  detective: { narrative: "Просыпается Комиссар. Кого он проверит этой ночью?", instruction: "Озвучьте: 'Комиссар просыпается...'" },
  maniac: { narrative: "Маньяк выходит из тени. Кто станет его следующей жертвой?", instruction: "Озвучьте: 'Маньяк просыпается...'" },
  day_discussion: { narrative: "Наступило утро. Город просыпается. Посмотрим, кто не проснулся сегодня...", instruction: "Озвучьте результаты ночи и начните обсуждение." },
  voting: { narrative: "Пришло время правосудия. Городу пора сделать свой выбор.", instruction: "Время голосования. Попросите город выбрать виновного." },
  end: { narrative: "Игра окончена. Победители определены.", instruction: "Озвучьте итоги и поздравьте победителей!" }
};

const HostDashboard = ({ gameState, socket }) => {
  const { phase, subPhase, players, alivePlayers, roles, round } = gameState;
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  
  const currentData = useMemo(() => {
    if (phase === 'night') return SCRIPTS[subPhase] || SCRIPTS.night_start;
    if (phase === 'day') return SCRIPTS.day_discussion;
    if (phase === 'vote') return SCRIPTS.voting;
    if (phase === 'end') return SCRIPTS.end;
    return { narrative: "Ожидание...", instruction: "" };
  }, [phase, subPhase]);

  // Функция озвучки
  const speak = (text) => {
    if (!isVoiceEnabled || !window.speechSynthesis) return;
    
    // Отменяем текущую озвучку, если она есть
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    
    // Пытаемся найти мужской русский голос
    const voices = window.speechSynthesis.getVoices();
    const ruVoices = voices.filter(v => v.lang.startsWith('ru'));
    
    // Ищем имя Павел, Максим, или просто по порядку (обычно мужские голоса имеют такие имена)
    const maleVoice = ruVoices.find(v => 
        v.name.toLowerCase().includes('pavel') || 
        v.name.toLowerCase().includes('maxim') || 
        v.name.toLowerCase().includes('dmitry') ||
        v.name.toLowerCase().includes('microsoft pavel')
    );
    
    if (maleVoice) utterance.voice = maleVoice;
    
    utterance.rate = 0.9; // Чуть медленнее для атмосферности
    utterance.pitch = 0.8; // Чуть ниже для мужского тембра
    
    window.speechSynthesis.speak(utterance);
  };

  // Озвучиваем при изменении фазы
  useEffect(() => {
    if (currentData.narrative && currentData.narrative !== "Ожидание...") {
        speak(currentData.narrative);
    }
  }, [phase, subPhase]);

  const handleAdvance = () => {
    if (phase === 'night') {
      socket.emit('host_advance_night');
    } else if (phase === 'day') {
      socket.emit('host_start_voting');
    } else if (phase === 'vote') {
      socket.emit('host_end_day');
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'mafia': return <Zap size={16} color="var(--accent-red)" />;
      case 'don': return <Shield size={16} color="var(--accent-red)" />;
      case 'doctor': return <Heart size={16} color="var(--accent-blue)" />;
      case 'detective': return <Eye size={16} color="var(--accent-blue)" />;
      case 'putana': return <Users size={16} color="var(--accent-purple)" />;
      case 'maniac': return <Crosshair size={16} color="var(--accent-red)" />;
      default: return null;
    }
  };

  return (
    <div className="host-dashboard" style={{ 
      display: 'grid', 
      gridTemplateColumns: '350px 1fr', 
      gap: '1rem', 
      height: 'calc(100vh - 40px)', 
      padding: '20px' 
    }}>
      
      {/* Control Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem', overflowY: 'auto' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--accent-purple)' }}>Ведущий</h2>
          <p className="text-secondary">Раунд {round}</p>
        </div>

        <div className="script-box" style={{ 
          background: 'rgba(255,255,255,0.05)', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          borderLeft: '4px solid var(--accent-purple)',
          minHeight: '120px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <Mic size={20} color="var(--accent-purple)" />
            <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isVoiceEnabled} onChange={e => setIsVoiceEnabled(e.target.checked)} />
                Авто-озвучка
            </label>
          </div>
          <p style={{ fontStyle: 'italic', fontSize: '1.1rem', lineHeight: '1.4', marginBottom: '8px' }}>
            {currentData.narrative}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 'bold' }}>
            🔔 {currentData.instruction}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <button className="btn-primary" onClick={handleAdvance} style={{ 
            padding: '1.2rem', 
            borderRadius: '12px', 
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}>
            <SkipForward size={20} />
            {phase === 'night' ? 'Следующая роль' : phase === 'day' ? 'Начать голосование' : 'Завершить день'}
          </button>
        </div>

        <hr style={{ opacity: 0.1 }} />

        <div className="live-log">
          <h4 style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} /> Статус игроков
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {players.map(p => {
                if (p.isHost) return null;
                const isAlive = alivePlayers.includes(p.id);
                return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', opacity: isAlive ? 1 : 0.5 }}>
                        <span>{p.name} {getRoleIcon(roles[p.id])}</span>
                        <span style={{ color: isAlive ? 'var(--accent-blue)' : 'var(--accent-red)' }}>
                           {isAlive ? 'Жив' : 'Мертв'}
                        </span>
                    </div>
                );
            })}
          </div>
        </div>
      </div>

      {/* Main Game View */}
      <div className="game-view" style={{ overflowY: 'auto', padding: '10px' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.5rem' }}>
                {phase === 'night' ? '🌙 Фаза Ночи' : '☀️ Фаза Дня'} 
                {subPhase && ` — ${subPhase.toUpperCase()}`}
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ padding: '5px 15px', background: 'var(--glass-bg)', borderRadius: '20px', fontSize: '0.8rem' }}>
                    👥 {alivePlayers.length} игроков в игре
                </div>
            </div>
        </div>

        <div className="grid-players" style={{ 
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '1rem' 
        }}>
          {players.map((p, index) => {
            if (p.isHost) return null;
            return (
              <PlayerCard
                key={p.id}
                player={p}
                index={index}
                isDead={!alivePlayers.includes(p.id)}
                isSelected={false}
                onSelect={() => {}}
                canSelect={false}
                roleName={roles[p.id]}
                isHostView={true}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HostDashboard;
