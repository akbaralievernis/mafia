/**
 * Модуль для управления Дневной фазой игры.
 * Отвечает за:
 * 1. Объявление результатов прошедшей ночи.
 * 2. Чат / обсуждение (таймер).
 * 3. Голосование.
 * 4. Изгнание игрока по итогам голосования (линчевание).
 */
class DayPhase {
  constructor(gameState, io, onDayEndCallback) {
    this.state = gameState;
    this.io = io;
    this.onDayEnd = onDayEndCallback;
    
    this.timer = null;
    this.timeLeft = 0;
    
    // Внутренний статус фазы дня: 'discussion' (обсуждение) или 'voting' (само голосование)
    this.subPhase = 'discussion'; 
  }

  /**
   * Запуск дневной фазы
   * @param {Object} nightResults - Результаты из NightPhase (кто убит, спасли ли)
   */
  start(nightResults) {
    this.state.setPhase('day');
    this.subPhase = 'discussion';
    
    console.log(`[Комната ${this.state.id}] Наступил День. Раунд ${this.state.round}. Обсуждение.`);

    // 1. Показать результат ночи всем игрокам
    this.io.to(this.state.id).emit('day_started', {
      killedPlayerId: nightResults.killedPlayerId,
      message: nightResults.killedPlayerId 
        ? "Мафия сделала свой выбор. В городе жертва." 
        : "Жители проснулись в целости и сохранности. Доктор кого-то спас, либо мафия промахнулась!"
    });

    // Излучаем обновление состояния (убитый игрок станет { isAlive: false })
    this._broadcastState();

    // 2. Запуск таймера обсуждения (например 60 секунд)
    this._startTimer(60, () => {
      this.startVoting(); // Автоматически переходим к голосованию
    });
  }

  /**
   * Запуск под-фазы голосования (Линчевание)
   */
  startVoting() {
    this.state.setPhase('vote'); // Меняем флаг в GameState (чтобы принимались голоса)
    this.subPhase = 'voting';
    
    console.log(`[Комната ${this.state.id}] Начало голосования.`);
    
    this.io.to(this.state.id).emit('voting_started', {
      message: "Время голосования! Выберите, кого посадить в тюрьму."
    });

    const AIBot = require('./AIBot');
    
    // Триггерим автоматические голоса от AI-ботов
    this.state.players.forEach(p => {
      if (p.isBot && this.state.alivePlayers.includes(p.id)) {
        const action = AIBot.makeRandomAction(p.id, this.state.roles[p.id], 'vote', this.state.alivePlayers);
        if (action) {
          setTimeout(() => {
            this.handleVote(p.id, action.targetId);
          }, action.delay);
        }
      }
    });

    // 3. Запуск таймера голосования (например 30 секунд)
    this._startTimer(30, () => {
      this.endDay(); // Завершаем голосование и день
    });
  }

  /**
   * Обработка логов текстового/голосового чата в течение дня.
   * Вызывается из socket-обработчика (socket.on('send_chat_message'))
   */
  handleChatMessage(senderId, message) {
    if (this.state.phase !== 'day' && this.state.phase !== 'vote') {
      return { error: "Чат доступен только днем" };
    }
    
    // Проверка: мертвые не говорят
    if (!this.state.alivePlayers.includes(senderId)) {
       return { error: "Мертвые не разговаривают" };
    }

    const sender = this.state.players.find(p => p.id === senderId);

    // Рассылаем всем игрокам в комнате текст обсуждения
    this.io.to(this.state.id).emit('chat_message', {
      senderId: senderId,
      senderName: sender.name,
      text: message,
      timestamp: Date.now()
    });

    return { success: true };
  }

  /**
   * Обработчик входящего голоса от игрока.
   * Защита от двойного голосования уже реализована внутри this.state.registerVote,
   * так как там используется словарь this.votes[voterId] = suspectId.
   * При повторном голосовании старый голос затирается новым (игрок может "передумать").
   */
  handleVote(voterId, suspectId) {
    if (this.subPhase !== 'voting') {
      return { error: "Голосование еще не началось" };
    }
    
    const success = this.state.registerVote(voterId, suspectId);
    
    if (success) {
      // Можно разослать промежуточные результаты голосов (если голосование публичное)
      this.io.to(this.state.id).emit('votes_updated', this.state.votes);
      
      // Проверка досрочного завершения: все живые проголосовали?
      if (Object.keys(this.state.votes).length === this.state.alivePlayers.length) {
        console.log(`[Комната ${this.state.id}] Все проголосовали. Подсчет.`);
        this.endDay();
      }
      return { success: true };
    }
    return { error: "Голосование отклонено (возможно, вы или цель мертвы)" };
  }

  /**
   * Подсчет голосов и изгнание игрока
   */
  endDay() {
    clearInterval(this.timer);
    this.state.isProcessingPhase = true;

    // Считаем голоса: { [suspectId]: count }
    const voteCounts = {};
    Object.values(this.state.votes).forEach(suspectId => {
      voteCounts[suspectId] = (voteCounts[suspectId] || 0) + 1;
    });

    let exiledPlayerId = null;
    let maxVotes = 0;
    let isTie = false; // Проверка на "ничью"

    Object.entries(voteCounts).forEach(([suspectId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        exiledPlayerId = suspectId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true; // Два человека набрали равное количество голосов
      }
    });

    // Решаем судьбу (если ничья — никто не уходит, иначе - убиваем)
    if (exiledPlayerId && !isTie) {
      this.state.killPlayer(exiledPlayerId);
      console.log(`[Комната ${this.state.id}] По итогам голосования уходит ${exiledPlayerId}`);
      
      this.io.to(this.state.id).emit('voting_result', {
        exiledPlayerId: exiledPlayerId,
        message: "Город сделал выбор. Игрок изгнан."
      });
    } else {
      console.log(`[Комната ${this.state.id}] Ничья/тишина. Никто не изгнан.`);
      this.io.to(this.state.id).emit('voting_result', {
        exiledPlayerId: null,
        message: "Голоса разделились или никто не проголосовал. Город засыпает в страхе."
      });
    }

    this.state.isProcessingPhase = false;

    // Передаем управление обратно GameEngine для старта новой ночи
    if (this.onDayEnd) {
      this.onDayEnd({ exiledPlayerId });
    }
  }

  // --- Внутренние утилиты ---

  _startTimer(seconds, onExpireCallback) {
    if (this.timer) clearInterval(this.timer);
    this.timeLeft = seconds;
    
    this.io.to(this.state.id).emit('timer_update', { timeLeft: this.timeLeft, phase: this.state.phase });

    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      // Можно каждую секунду или раз в 5 сек отправлять: 
      // this.io.to(this.state.id).emit('timer_update', { timeLeft: this.timeLeft });

      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        onExpireCallback();
      }
    }, 1000);
  }

  _broadcastState() {
    this.state.players.forEach(p => {
      this.io.to(p.id).emit('state_update', this.state.getSanitizedState(p.id));
    });
  }
}

module.exports = DayPhase;
