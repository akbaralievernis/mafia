class GameState {
  constructor(roomId) {
    this.id = roomId;
    this.players = [];
    this.roles = {};
    this.alivePlayers = [];
    this.phase = "lobby";
    this.subPhase = null;
    this.round = 0;
    this.votes = {};
    this.actions = { don: null, mafia: {}, doctor: null, detective: null, maniac: null, putana: null, bodyguard: null };
    this.isProcessingPhase = false; 
  }

  addPlayer(player) {
    if (this.phase !== "lobby") throw new Error("Нельзя присоединиться: игра уже началась");
    if (this.players.find(p => p.id === player.id)) throw new Error("Игрок уже в комнате");
    this.players.push(player);
    if (!player.isHost) this.alivePlayers.push(player.id);
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.alivePlayers = this.alivePlayers.filter(id => id !== playerId);
    delete this.roles[playerId];
    delete this.votes[playerId];
  }

  startGame(assignedRoles) {
    if (this.phase !== 'lobby') return false;
    this.isProcessingPhase = true;
    try {
      this.roles = assignedRoles;
      this.round = 1;
      this.phase = 'night';
      this.resetActions();
    } finally {
      this.isProcessingPhase = false;
    }
    return true;
  }

  setPhase(newPhase) {
    this.isProcessingPhase = true;
    try {
      this.phase = newPhase;
      this.subPhase = null;
      if (newPhase === 'night') {
        this.round++;
        this.resetActions();
      } else if (newPhase === 'vote') {
        this.votes = {};
      }
    } finally {
      this.isProcessingPhase = false;
    }
  }

  registerNightAction(playerId, targetId, role) {
    if (this.phase !== 'night' || this.isProcessingPhase) return false;
    if (!this.alivePlayers.includes(playerId)) return false;

    switch (role) {
      case 'don': this.actions.don = targetId; break;
      case 'mafia': this.actions.mafia[playerId] = targetId; break;
      case 'doctor': this.actions.doctor = targetId; break;
      case 'detective': this.actions.detective = targetId; break;
      case 'maniac': this.actions.maniac = targetId; break;
      case 'putana': this.actions.putana = targetId; break;
      case 'bodyguard': this.actions.bodyguard = targetId; break;
      default: return false;
    }
    return true;
  }

  registerVote(voterId, suspectId) {
    if (this.phase !== 'vote' || this.isProcessingPhase) return false;
    if (!this.alivePlayers.includes(voterId) || !this.alivePlayers.includes(suspectId)) return false;
    this.votes[voterId] = suspectId;
    return true;
  }

  killPlayer(playerId) {
    this.alivePlayers = this.alivePlayers.filter(id => id !== playerId);
  }

  resetActions() {
    this.actions = { don: null, mafia: {}, doctor: null, detective: null, maniac: null, putana: null, bodyguard: null };
  }

  getSanitizedState(playerId) {
    const isGameEnded = this.phase === 'end';
    const myRole = this.roles[playerId];
    const isMafiaTeam = myRole === 'mafia' || myRole === 'don';

    return {
      id: this.id,
      phase: this.phase,
      subPhase: this.subPhase,
      round: this.round,
      alivePlayers: this.alivePlayers,
      roles: isGameEnded ? this.roles : this._getVisibleRoles(isMafiaTeam, playerId),
      votes: this.phase === 'vote' ? this.votes : {},
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isAlive: this.alivePlayers.includes(p.id),
        isHost: p.isHost
      }))
    };
  }

  _getVisibleRoles(isMafiaTeam, myId) {
    const visibleRoles = {};
    const myPlayer = this.players.find(p => p.id === myId);
    
    // Ведущий видит ВСЕ роли
    if (myPlayer?.isHost) return this.roles;
    
    if (this.roles[myId] === 'spectator') return visibleRoles;
    
    if (isMafiaTeam) {
      Object.keys(this.roles).forEach(id => {
        if (this.roles[id] === 'mafia' || this.roles[id] === 'don') visibleRoles[id] = this.roles[id];
      });
    }
    
    if (this.roles[myId]) visibleRoles[myId] = this.roles[myId];
    
    return visibleRoles;
  }
}

export default GameState;
