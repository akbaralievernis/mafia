/**
 * Модуль для управления Ночной фазой игры.
 * Обрабатывает таймеры, действия ролей и вынесение вердикта (кто убит).
 */
class NightPhase {
  constructor(gameState, io, onNightEndCallback) {
    this.state = gameState;
    this.io = io;
    this.onNightEnd = onNightEndCallback;

    this.timer = null;
    this.timeLeft = 0; 
    
    // Временное хранилище ночных выборов (до наступления утра)
    this.mafiaVotes = {}; // { [mafiaId]: targetId } - кто за кого проголосовал из мафии
    this.doctorTarget = null;
    this.detectiveTarget = null;
    this.donTarget = null;
    this.maniacTarget = null;

    this.subPhases = ['don', 'mafia', 'doctor', 'detective', 'maniac'];
    this.currentSubPhaseIndex = -1;
    this.isTransitioning = false; // Guard against multiple nextSubPhase calls
  }

  /**
   * Запуск ночной фазы
   */
  start() {
    this.state.setPhase('night');
    this._broadcastState(); // Рассказываем клиентам, что фаза сменилась!
    console.log(`[Комната ${this.state.id}] Наступила ночь. Раунд ${this.state.round}`);
    
    this.currentSubPhaseIndex = -1;
    this.nextSubPhase();
  }

  /**
   * Переход к следующей подочереди ночью (Мафия -> Доктор -> Детектив)
   */
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
    this.timeLeft = 15; // 15 секунд на каждую активную роль

    // Проверяем, есть ли живые игроки с этой ролью
    const aliveWithRole = this.state.alivePlayers.filter(id => this.state.roles[id] === currentRole);
    if (aliveWithRole.length === 0) {
      // Если никого нет или убиты, переходим к следующей роли сразу
      return this.nextSubPhase();
    }

    // Уведомляем клиентов о начале подочереди
    this.io.to(this.state.id).emit('night_subphase_started', {
      subPhase: currentRole,
      duration: this.timeLeft
    });
    
    this._broadcastState(); // Обновляем стейт с новой subPhase

    const AIBot = require('./AIBot');
    
    // Триггерим ботов для текущей роли
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
    this.isTransitioning = false; // Reset after setting up new subphase

    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      
      this.io.to(this.state.id).emit('timer_update', { timeLeft: this.timeLeft, phase: this.state.phase, subPhase: currentRole });

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.nextSubPhase(); // Авто-пропуск хода роли
      }
    }, 1000);
  }

  /**
   * Обработка действия от игрока
   */
  handleAction(playerId, targetId) {
    // 1. Проверки базовые
    if (this.state.phase !== 'night' || this.state.isProcessingPhase) return { error: "Не время для действий" };
    if (!this.state.alivePlayers.includes(playerId)) return { error: "Мертвые не действуют" };
    if (!this.state.alivePlayers.includes(targetId) && targetId !== null) return { error: "Цель мертва" };

    const role = this.state.roles[playerId];
    
    if (role !== this.state.subPhase) return { error: "Сейчас не ваш ход" };

    // 2. Логика для конкретных ролей
    if (role === 'don') {
      this.donTarget = targetId;
      // Дон ищет комиссара
      const targetRole = this.state.roles[targetId];
      const isDetective = targetRole === 'detective';
      this.io.to(playerId).emit('don_result', { targetId, isDetective });
      
    } else if (role === 'mafia') {
      this.mafiaVotes[playerId] = targetId; // Мафия голосует за цель
      
      // Рассылаем остальным живым мафиози обновленный статус выбора,
      // чтобы реализовать "первый выбирает, остальные подтверждают или меняют"
      const aliveMafias = this.state.alivePlayers.filter(id => this.state.roles[id] === 'mafia');
      aliveMafias.forEach(mafiaId => {
        this.io.to(mafiaId).emit('mafia_votes_update', this.mafiaVotes);
      });

    } else if (role === 'doctor') {
      this.doctorTarget = targetId;

    } else if (role === 'detective') {
      this.detectiveTarget = targetId;
      // Детектив сразу получает ответ (или утром - зависит от правил, сделаем сразу для динамики)
      const targetRole = this.state.roles[targetId];
      // Дон проверяется детективом как обычная мафия
      const isMafia = targetRole === 'mafia' || targetRole === 'don';
      this.io.to(playerId).emit('detective_result', { targetId, isMafia });
      
    } else if (role === 'maniac') {
      this.maniacTarget = targetId;
      
    } else {
      return { error: "Ваша роль не имеет ночных действий" };
    }

    this.checkEarlyEnd();
    return { success: true };
  }

  /**
   * Проверка: все ли игроки этой роли сделали свой ход?
   */
  checkEarlyEnd() {
    const currentRole = this.state.subPhase;
    const aliveRoleIds = this.state.alivePlayers.filter(id => this.state.roles[id] === currentRole);
    
    let allActed = false;
    if (currentRole === 'don') {
      allActed = this.donTarget !== null;
    } else if (currentRole === 'mafia') {
      const currentMafiaVotes = Object.keys(this.mafiaVotes).length;
      allActed = currentMafiaVotes === aliveRoleIds.length;
    } else if (currentRole === 'doctor') {
      allActed = this.doctorTarget !== null;
    } else if (currentRole === 'detective') {
      allActed = this.detectiveTarget !== null;
    } else if (currentRole === 'maniac') {
      allActed = this.maniacTarget !== null;
    }

    if (allActed) {
      clearInterval(this.timer);
      console.log(`[Комната ${this.state.id}] ${currentRole} совершил выбор. Переход к следующей фазе.`);
      this.nextSubPhase();
    }
  }

  /**
   * Завершение ночи и расчет итогов
   */
  endNight() {
    clearInterval(this.timer);
    
    // Блокируем гонку событий
    this.state.isProcessingPhase = true;

    // 1. Вычисляем итоговую жертву мафии (по большинству голосов среди мафиози)
    let mafiaTarget = null;
    if (Object.keys(this.mafiaVotes).length > 0) {
      const voteCounts = {};
      Object.values(this.mafiaVotes).forEach(t => {
        voteCounts[t] = (voteCounts[t] || 0) + 1;
      });
      // Ищем ID с максимальным количеством голосов
      mafiaTarget = Object.keys(voteCounts).reduce((a, b) => voteCounts[a] > voteCounts[b] ? a : b);
    }

    // 2. Логика спасения Доктором
    let killedPlayers = [];
    
    // Проверка жертв списком (может быть убит и от мафии, и от маньяка)
    if (mafiaTarget && mafiaTarget !== this.doctorTarget) {
      if (!killedPlayers.includes(mafiaTarget)) killedPlayers.push(mafiaTarget);
    }
    
    if (this.maniacTarget && this.maniacTarget !== this.doctorTarget) {
      if (!killedPlayers.includes(this.maniacTarget)) killedPlayers.push(this.maniacTarget);
    }
    
    // Убиваем физически в стейте всех жертв
    killedPlayers.forEach(id => {
      this.state.killPlayer(id);
    });

    // Сохраняем в историю для отладки
    this.state.actions = {
      don: this.donTarget,
      mafia: Object.values(this.mafiaVotes),
      doctor: this.doctorTarget,
      detective: this.detectiveTarget,
      maniac: this.maniacTarget
    };

    this.state.isProcessingPhase = false;

    // Вызываем коллбек (передаем управление обратно PhaseController)
    // Возвращаем первую или null для совместимости с DayPhase, либо массив
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

module.exports = NightPhase;
