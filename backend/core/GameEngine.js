const GameState = require('./GameState');
const NightPhase = require('./NightPhase');
const DayPhase = require('./DayPhase');
const GameLog = require('./GameLog');
const RoleDistributor = require('./RoleDistributor');
const WinChecker = require('./WinChecker');

class GameEngine {
  constructor(roomId, players, io) {
    this.roomId = roomId;
    this.io = io;
    this.state = new GameState(roomId);
    this.log = new GameLog();
    
    // Add players to state
    players.forEach(p => this.state.addPlayer(p));

    this.nightPhase = null;
    this.dayPhase = null;
  }

  start() {
    try {
      // 1. Assign roles
      const assignedRoles = RoleDistributor.assignRoles(this.state.players);
      
      // 2. Start game state
      this.state.startGame(assignedRoles);
      
      // Send initial state with roles to each player
      this.state.players.forEach(p => {
        this.io.to(p.id).emit('game_started', this.state.getSanitizedState(p.id));
      });

      this.log.addEvent('system', 'Игра началась', {}, true);

      // 3. Start first night
      this.startNight();
    } catch (e) {
      console.error(`Ошибка старта игры ${this.roomId}:`, e);
      this.io.to(this.roomId).emit('error', { message: e.message });
    }
  }

  startNight() {
    if (WinChecker.checkWin(this.state, this.io)) return;

    this.nightPhase = new NightPhase(this.state, this.io, (results) => {
      // Callback when night ends
      this.log.addEvent('phase_change', 'Ночь закончилась', results, true);
      this.startDay(results);
    });

    this.nightPhase.start();
  }

  startDay(nightResults) {
    if (WinChecker.checkWin(this.state, this.io)) return;

    this.dayPhase = new DayPhase(this.state, this.io, (results) => {
      // Callback when day ends
      this.log.addEvent('phase_change', 'День закончился', results, true);
      this.startNight();
    });

    this.dayPhase.start(nightResults);
  }

  handleNightAction(playerId, targetId) {
    if (this.state.phase === 'night' && this.nightPhase) {
      return this.nightPhase.handleAction(playerId, targetId);
    }
    return { error: 'Действие недоступно в текущей фазе' };
  }

  handleDayVote(playerId, targetId) {
    if (this.state.phase === 'vote' && this.dayPhase) {
      return this.dayPhase.handleVote(playerId, targetId);
    }
    return { error: 'Голосование недоступно' };
  }

  handleChatMessage(playerId, message) {
    if ((this.state.phase === 'day' || this.state.phase === 'vote') && this.dayPhase) {
      return this.dayPhase.handleChatMessage(playerId, message);
    }
    return { error: 'Чат недоступен в текущей фазе' };
  }
}

module.exports = GameEngine;
