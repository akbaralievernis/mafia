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

    this.subPhases = ['mafia', 'doctor', 'detective'];
    this.currentSubPhaseIndex = -1;
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
    if (role === 'mafia') {
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
      const isMafia = targetRole === 'mafia';
      this.io.to(playerId).emit('detective_result', { targetId, isMafia });
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
    if (currentRole === 'mafia') {
      const currentMafiaVotes = Object.keys(this.mafiaVotes).length;
      allActed = currentMafiaVotes === aliveRoleIds.length;
    } else if (currentRole === 'doctor') {
      allActed = this.doctorTarget !== null;
    } else if (currentRole === 'detective') {
      allActed = this.detectiveTarget !== null;
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
    let killedPlayerId = null;
    if (mafiaTarget && mafiaTarget !== this.doctorTarget) {
      // Доктор не угадал или не лечил
      killedPlayerId = mafiaTarget;
      // Убиваем физически в стейте (без this.isProcessingPhase = false)
      this.state.killPlayer(killedPlayerId);
    }

    // Сохраняем в историю для отладки
    this.state.actions = {
      mafia: Object.values(this.mafiaVotes),
      doctor: this.doctorTarget,
      detective: this.detectiveTarget
    };

    this.state.isProcessingPhase = false;

    // Вызываем коллбек (передаем управление обратно GameEngine/PhaseController)
    if (this.onNightEnd) {
      this.onNightEnd({
        killedPlayerId: killedPlayerId,
        wasSavedByDoctor: mafiaTarget === this.doctorTarget && mafiaTarget !== null
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
