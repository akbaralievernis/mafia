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
    this.timeLeft = 30; // 30 секунд на ночь
    
    // Временное хранилище ночных выборов (до наступления утра)
    this.mafiaVotes = {}; // { [mafiaId]: targetId } - кто за кого проголосовал из мафии
    this.doctorTarget = null;
    this.detectiveTarget = null;
  }

  /**
   * Запуск ночной фазы
   */
  start() {
    this.state.setPhase('night');
    console.log(`[Комната ${this.state.id}] Наступила ночь. Раунд ${this.state.round}`);
    
    // Уведомляем всех, что началась ночь и запускаем таймер на клиентах
    this.io.to(this.state.id).emit('phase_started', {
      phase: 'night',
      duration: this.timeLeft
    });

    const AIBot = require('./AIBot');
    
    // Триггерим автоматические ночные действия от AI-ботов
    this.state.players.forEach(p => {
      if (p.isBot && this.state.alivePlayers.includes(p.id)) {
        const action = AIBot.makeRandomAction(p.id, this.state.roles[p.id], 'night', this.state.alivePlayers);
        if (action) {
          setTimeout(() => {
             // Чтобы игра не падала если фаза уже прошла:
            if (this.state.phase === 'night') {
              this.handleAction(p.id, action.targetId);
            }
          }, action.delay);
        }
      }
    });

    // Запускаем серверный таймер
    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      
      if (this.timeLeft <= 0) {
        this.endNight(); // Авто-завершение/пропуск
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
   * Проверка: все ли активные роли сделали свой ход?
   * Если да - нет смысла ждать таймер, завершаем ночь досрочно.
   */
  checkEarlyEnd() {
    const aliveMap = this.state.alivePlayers.reduce((acc, id) => {
      acc[this.state.roles[id]] = (acc[this.state.roles[id]] || 0) + 1;
      return acc;
    }, {});

    const expectedMafiaVotes = aliveMap['mafia'] || 0;
    const currentMafiaVotes = Object.keys(this.mafiaVotes).length;
    
    // Проверяем: если роль жива, сделала ли она выбор (или null)
    const doctorActed = !aliveMap['doctor'] || this.doctorTarget !== null;
    const detectiveActed = !aliveMap['detective'] || this.detectiveTarget !== null;
    const mafiaActed = expectedMafiaVotes === 0 || currentMafiaVotes === expectedMafiaVotes;

    if (doctorActed && detectiveActed && mafiaActed) {
      console.log(`[Комната ${this.state.id}] Все активные роли походили. Досрочное утро.`);
      this.endNight();
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
}

module.exports = NightPhase;
