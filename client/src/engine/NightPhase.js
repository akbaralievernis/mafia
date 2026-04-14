import AIBot from './AIBot.js';

class NightPhase {
  constructor(gameState, io, onNightEndCallback) {
    this.state = gameState;
    this.io = io;
    this.onNightEnd = onNightEndCallback;
    this.timer = null;
    this.timeLeft = 0; 
    this.mafiaVotes = {}; 
    this.doctorTarget = null;
    this.detectiveTarget = null;
    this.donTarget = null;
    this.maniacTarget = null;
    this.putanaTarget = null;
    this.bodyguardTarget = null;
    this.subPhases = ['putana', 'don', 'mafia', 'doctor', 'bodyguard', 'detective', 'maniac'];
    this.currentSubPhaseIndex = -1;
    this.isTransitioning = false; 
    this.blockedPlayers = []; 
  }

  start() {
    this.state.setPhase('night');
    this._broadcastState(); 
    console.log(`[Комната ${this.state.id}] Наступила ночь. Раунд ${this.state.round}`);
    this.currentSubPhaseIndex = -1;
    this.nextSubPhase();
  }

  nextSubPhase() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.currentSubPhaseIndex++;
    if (this.currentSubPhaseIndex >= this.subPhases.length) {
      this.endNight();
      return;
    }

    const currentRole = this.subPhases[this.currentSubPhaseIndex];
    this.state.subPhase = currentRole;
    this.timeLeft = 30; // Увеличим время для ведущего

    const aliveWithRole = this.state.alivePlayers.filter(id => this.state.roles[id] === currentRole);
    if (aliveWithRole.length === 0) {
      this.isTransitioning = false; 
      return this.nextSubPhase();
    }

    this.io.to(this.state.id).emit('night_subphase_started', {
      subPhase: currentRole,
      duration: this.timeLeft
    });
    
    this._broadcastState(); 

    // Боты
    this.state.players.forEach(p => {
      if (p.isBot && this.state.alivePlayers.includes(p.id) && this.state.roles[p.id] === currentRole) {
        const action = AIBot.makeRandomAction(p.id, currentRole, 'night', this.state.alivePlayers);
        if (action) {
          setTimeout(() => {
            if (this.state.phase === 'night' && this.state.subPhase === currentRole) {
              this.handleAction(p.id, action.targetId);
            }
          }, action.delay);
        }
      }
    });

    if (this.timer) clearInterval(this.timer);
    this.isTransitioning = false; 

    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      this.io.to(this.state.id).emit('timer_update', { timeLeft: this.timeLeft, phase: this.state.phase, subPhase: currentRole });
      
      // Если есть хост, мы можем не переходить автоматически, если захотим. 
      // Но пока оставим авто-переход как страховку.
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.nextSubPhase(); 
      }
    }, 1000);
  }

  handleAction(playerId, targetId) {
    if (this.state.phase !== 'night' || this.state.isProcessingPhase) return { error: "Не время для действий" };
    if (!this.state.alivePlayers.includes(playerId)) return { error: "Мертвые не действуют" };
    
    // Проверка на блок Путаны
    if (this.blockedPlayers.includes(playerId)) {
      this.io.to(playerId).emit('action_blocked', { message: "Вас заблокировали этой ночью!" });
      return { success: true, blocked: true };
    }

    if (!this.state.alivePlayers.includes(targetId) && targetId !== null) return { error: "Цель мертва" };
    const role = this.state.roles[playerId];
    if (role !== this.state.subPhase) return { error: "Сейчас не ваш ход" };

    if (role === 'putana') {
      this.putanaTarget = targetId;
      if (targetId) this.blockedPlayers.push(targetId);
    } else if (role === 'don') {
      this.donTarget = targetId;
      const targetRole = this.state.roles[targetId];
      const isDetective = targetRole === 'detective';
      this.io.to(playerId).emit('don_result', { targetId, isDetective });
    } else if (role === 'mafia') {
      this.mafiaVotes[playerId] = targetId; 
      const aliveMafias = this.state.alivePlayers.filter(id => this.state.roles[id] === 'mafia' || this.state.roles[id] === 'don');
      aliveMafias.forEach(mafiaId => {
        this.io.to(mafiaId).emit('mafia_votes_update', this.mafiaVotes);
      });
    } else if (role === 'doctor') {
      this.doctorTarget = targetId;
    } else if (role === 'bodyguard') {
      this.bodyguardTarget = targetId;
    } else if (role === 'detective') {
      this.detectiveTarget = targetId;
      const targetRole = this.state.roles[targetId];
      const isMafia = targetRole === 'mafia' || targetRole === 'don';
      this.io.to(playerId).emit('detective_result', { targetId, isMafia });
    } else if (role === 'maniac') {
      this.maniacTarget = targetId;
    }

    this.checkEarlyEnd();
    return { success: true };
  }

  checkEarlyEnd() {
    const currentRole = this.state.subPhase;
    const aliveRoleIds = this.state.alivePlayers.filter(id => this.state.roles[id] === currentRole);
    let allActed = false;
    
    if (currentRole === 'putana') allActed = this.putanaTarget !== null;
    else if (currentRole === 'don') allActed = this.donTarget !== null;
    else if (currentRole === 'mafia') allActed = Object.keys(this.mafiaVotes).length === aliveRoleIds.length;
    else if (currentRole === 'doctor') allActed = this.doctorTarget !== null;
    else if (currentRole === 'bodyguard') allActed = this.bodyguardTarget !== null;
    else if (currentRole === 'detective') allActed = this.detectiveTarget !== null;
    else if (currentRole === 'maniac') allActed = this.maniacTarget !== null;

    if (allActed) {
      // Даже если все сходили, дадим ведущему 3 секунды "на озвучку" перед авто-переходом
      setTimeout(() => {
        if (this.state.subPhase === currentRole) {
          clearInterval(this.timer);
          this.nextSubPhase();
        }
      }, 3000);
    }
  }

  endNight() {
    clearInterval(this.timer);
    this.state.isProcessingPhase = true;

    // Считаем цель мафии
    let mafiaTarget = null;
    if (Object.keys(this.mafiaVotes).length > 0) {
      const voteCounts = {};
      Object.values(this.mafiaVotes).forEach(t => {
        if (t) voteCounts[t] = (voteCounts[t] || 0) + 1;
      });
      const candidates = Object.keys(voteCounts);
      if (candidates.length > 0) {
        mafiaTarget = candidates.reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
      }
    }

    let killedPlayers = [];
    
    // Обработка Мафии
    if (mafiaTarget && mafiaTarget !== this.doctorTarget) {
      if (mafiaTarget === this.bodyguardTarget) {
        // Телохранитель защитил! Но сам погиб (если не лечил доктор?)
        // По правилам: Телохранитель умирает за цель.
        const bodyguardId = this.state.alivePlayers.find(id => this.state.roles[id] === 'bodyguard');
        if (bodyguardId && !killedPlayers.includes(bodyguardId)) killedPlayers.push(bodyguardId);
      } else {
        if (!killedPlayers.includes(mafiaTarget)) killedPlayers.push(mafiaTarget);
      }
    }

    // Обработка Маньяка
    if (this.maniacTarget && this.maniacTarget !== this.doctorTarget) {
       if (this.maniacTarget === this.bodyguardTarget) {
          const bodyguardId = this.state.alivePlayers.find(id => this.state.roles[id] === 'bodyguard');
          if (bodyguardId && !killedPlayers.includes(bodyguardId)) killedPlayers.push(bodyguardId);
       } else {
          if (!killedPlayers.includes(this.maniacTarget)) killedPlayers.push(this.maniacTarget);
       }
    }
    
    killedPlayers.forEach(id => this.state.killPlayer(id));

    this.state.actions = {
      don: this.donTarget,
      mafia: Object.values(this.mafiaVotes),
      doctor: this.doctorTarget,
      detective: this.detectiveTarget,
      maniac: this.maniacTarget,
      putana: this.putanaTarget,
      bodyguard: this.bodyguardTarget
    };

    this.state.isProcessingPhase = false;
    if (this.onNightEnd) {
      this.onNightEnd({
        killedPlayerId: killedPlayers.length > 0 ? killedPlayers[0] : null,
        multipleKills: killedPlayers,
        wasSavedByDoctor: (mafiaTarget === this.doctorTarget && mafiaTarget !== null) || (this.maniacTarget === this.doctorTarget && this.maniacTarget !== null)
      });
    }
  }

  _broadcastState() {
    this.state.players.forEach(p => {
      this.io.to(p.id).emit('state_update', this.state.getSanitizedState(p.id));
    });
  }
}

export default NightPhase;
