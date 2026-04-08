class GameManager {
  constructor(roomId, roomManager) {
    this.roomId = roomId;
    this.roomManager = roomManager;
    this.state = 'lobby'; // lobby, role_reveal, night, day_discussion, day_voting, end
    this.timer = null;
    this.timeLeft = 0;
    
    // Night actions
    this.nightActions = {
      mafia: {}, // socketId -> targetName
      donCheck: null, // targetName
      doctor: null, // targetName
      sheriff: null // targetName
    };
    
    // Day voting
    this.votes = {}; // socketId -> targetName
  }

  get room() {
    return this.roomManager.getRoom(this.roomId);
  }

  get alivePlayers() {
    return this.room.players.filter(p => p.isAlive);
  }

  start(io) {
    if (this.state !== 'lobby') return;
    const players = this.room.players;
    if (players.length < 4) {
      // Need at least 4 players for a basic game
      io.to(this.roomId).emit('gameError', 'Need at least 4 players to start.');
      return;
    }

    this.assignRoles(players);
    this.state = 'role_reveal';
    this.updateRoom(io);

    // After 10 seconds of role reveal, go to night
    this.startTimer(10, io, () => this.startNight(io));
  }

  assignRoles(players) {
    // Roles: 1 Don, 1 Sheriff, 1 Doctor, rest Citizens (if 4 players: 1 Don or Mafia, 1 Doc, 1 Sheriff, 1 Cit. Let's say: 1 Mafia, 1 Doc, 1 Sheriff, 1 Citizen for 4 players. If 5+: 1 Don, 1 Mafia, etc.)
    const count = players.length;
    let roles = [];
    if (count === 4) {
      roles = ['mafia', 'doctor', 'sheriff', 'citizen'];
    } else if (count >= 5 && count <= 6) {
      roles = ['don', 'doctor', 'sheriff', 'citizen', 'citizen'];
      if (count === 6) roles.push('citizen');
    } else {
      // 7+ players
      roles = ['don', 'mafia', 'doctor', 'sheriff', 'citizen', 'citizen', 'citizen'];
      for (let i = 7; i < count; i++) roles.push('citizen');
    }

    // Shuffle roles
    roles.sort(() => Math.random() - 0.5);

    players.forEach((p, i) => {
      p.role = roles[i];
      p.isAlive = true;
    });
  }

  startNight(io) {
    this.state = 'night';
    this.nightActions = { mafia: {}, donCheck: null, doctor: null, sheriff: null };
    this.updateRoom(io);
    this.startTimer(30, io, () => this.resolveNight(io));
  }

  handleAction(socketId, targetName, io) {
    const player = this.room.players.find(p => p.socketId === socketId);
    if (!player || !player.isAlive) return;

    if (this.state === 'night') {
      if (player.role === 'mafia' || player.role === 'don') {
        this.nightActions.mafia[socketId] = targetName;
        if (player.role === 'don') this.nightActions.donCheck = targetName; // Don does double duty
      }
      if (player.role === 'doctor') this.nightActions.doctor = targetName;
      if (player.role === 'sheriff') this.nightActions.sheriff = targetName;

      // Check if all needed actions are in
      this.checkNightActionsDone(io);
    } else if (this.state === 'day_voting') {
      this.votes[socketId] = targetName;
      this.checkVotesDone(io);
    }
  }

  checkNightActionsDone(io) {
    const alive = this.alivePlayers;
    const mafias = alive.filter(p => p.role === 'mafia' || p.role === 'don');
    const doctor = alive.find(p => p.role === 'doctor');
    const sheriff = alive.find(p => p.role === 'sheriff');

    if (mafias.every(m => this.nightActions.mafia[m.socketId]) &&
        (!doctor || this.nightActions.doctor) &&
        (!sheriff || this.nightActions.sheriff)) {
      this.resolveNight(io);
    }
  }

  resolveNight(io) {
    clearTimeout(this.timer);
    // Send checks
    const don = this.alivePlayers.find(p => p.role === 'don');
    if (don && this.nightActions.donCheck) {
      const target = this.room.players.find(p => p.name === this.nightActions.donCheck);
      const isSheriff = target && target.role === 'sheriff';
      io.to(don.socketId).emit('privateMessage', `Проверка: ${target.name} ${isSheriff ? 'Шериф' : 'не Шериф'}`);
    }

    const sheriff = this.alivePlayers.find(p => p.role === 'sheriff');
    if (sheriff && this.nightActions.sheriff) {
      const target = this.room.players.find(p => p.name === this.nightActions.sheriff);
      const isMafia = target && (target.role === 'mafia' || target.role === 'don');
      io.to(sheriff.socketId).emit('privateMessage', `Проверка: ${target.name} ${isMafia ? 'Мафия' : 'не Мафия'}`);
    }

    // Resolve kill
    const mafiaTargets = Object.values(this.nightActions.mafia);
    // Simple logic: first target or most voted
    const counts = {};
    mafiaTargets.forEach(t => counts[t] = (counts[t] || 0) + 1);
    let topTarget = null, topVotes = 0;
    for (let t in counts) {
      if (counts[t] > topVotes) {
        topVotes = counts[t];
        topTarget = t;
      }
    }

    let diedCount = 0;
    let diedName = null;

    if (topTarget && this.nightActions.doctor !== topTarget) {
      const victim = this.room.players.find(p => p.name === topTarget);
      if (victim) {
        victim.isAlive = false;
        diedCount++;
        diedName = victim.name;
      }
    }

    // Check win condition
    if (this.checkWin(io)) return;

    this.state = 'day_discussion';
    this.updateRoom(io, { event: 'dayStart', diedName });
    
    // Day discussion
    this.startTimer(60, io, () => this.startVoting(io));
  }

  startVoting(io) {
    this.state = 'day_voting';
    this.votes = {};
    this.updateRoom(io);
    this.startTimer(30, io, () => this.resolveVoting(io));
  }

  checkVotesDone(io) {
    const aliveCount = this.alivePlayers.length;
    if (Object.keys(this.votes).length === aliveCount) {
      this.resolveVoting(io);
    }
  }

  resolveVoting(io) {
    clearTimeout(this.timer);
    
    const voteCounts = {};
    Object.values(this.votes).forEach(t => voteCounts[t] = (voteCounts[t] || 0) + 1);
    let topTarget = null, topVotes = 0;
    for (let t in voteCounts) {
      if (voteCounts[t] > topVotes) {
        topVotes = voteCounts[t];
        topTarget = t;
      }
    }

    // Check if there's a tie or real majority
    // We'll keep it simple: highest votes dies. If tie, just pick one (Object loop order)
    let exiledName = null;
    if (topTarget) {
      const victim = this.room.players.find(p => p.name === topTarget);
      if (victim) {
        victim.isAlive = false;
        exiledName = victim.name;
      }
    }

    if (this.checkWin(io)) return;

    this.state = 'night';
    this.updateRoom(io, { event: 'votingResult', exiledName, votes: this.votes });
    this.startTimer(5, io, () => this.startNight(io)); // brief pause before next night starts
  }

  checkWin(io) {
    const alive = this.alivePlayers;
    const mafias = alive.filter(p => p.role === 'mafia' || p.role === 'don').length;
    const citizens = alive.length - mafias;

    if (mafias === 0) {
      this.state = 'end';
      this.updateRoom(io, { event: 'gameEnd', winners: 'citizens' });
      return true;
    } else if (mafias >= citizens) {
      this.state = 'end';
      this.updateRoom(io, { event: 'gameEnd', winners: 'mafia' });
      return true;
    }
    return false;
  }

  startTimer(seconds, io, callback) {
    clearTimeout(this.timer);
    this.timeLeft = seconds;
    
    // Broadcast initial time
    io.to(this.roomId).emit('timer', this.timeLeft);
    
    this.timer = setInterval(() => {
      this.timeLeft--;
      io.to(this.roomId).emit('timer', this.timeLeft);
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        callback();
      }
    }, 1000);
  }

  updateRoom(io, extraData = {}) {
    const roomData = this.roomManager.getRoomData(this.roomId);
    
    // Emit hidden roles and specific info to players
    this.room.players.forEach(p => {
      const personalData = {
        ...roomData,
        myRole: p.role,
        myStatus: p.isAlive ? 'alive' : 'dead',
        players: roomData.players // Public faces only
      };

      // Reveal roles if game ended or if it's mafias seeing each other
      if (this.state === 'end') {
        personalData.players = this.room.players.map(pl => ({
          name: pl.name, isAlive: pl.isAlive, role: pl.role
        }));
      } else if (p.role === 'mafia' || p.role === 'don') {
        // Mafias know mafias
        personalData.players = personalData.players.map(pl => {
          const sp = this.room.players.find(x => x.name === pl.name);
          return {
            ...pl,
            isMafia: (sp.role === 'mafia' || sp.role === 'don')
          };
        });
      }

      io.to(p.socketId).emit('gameState', { ...personalData, ...extraData });
    });
  }
}

module.exports = GameManager;
