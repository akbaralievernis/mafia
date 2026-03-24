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
    this.isFinishing = false; // Guard against multiple endDay calls
  }

  /**
   * Запуск дневной фазы
   * @param {Object} nightResults - Результаты из NightPhase (кто убит, спасли ли)
   */
  start(nightResults) {
    this.state.setPhase('day');
    this.subPhase = 'discussion';
    
    console.log(`[Комната ${this.state.id}] Наступил День. Раунд ${this.state.round}. Обсуждение.`);

    let message = "Наступил день. Жители проснулись в целости и сохранности. Доктор кого-то спас, либо злоумышленники промахнулись!";
    let killedNames = [];
    
    if (nightResults.multipleKills && nightResults.multipleKills.length > 0) {
      killedNames = nightResults.multipleKills.map(id => this.state.players.find(p => p.id === id)?.name || "Неизвестный");
      message = `Наступил день. Ночь выдалась кровавой. Убиты: ${killedNames.join(', ')}.`;
    } else if (nightResults.killedPlayerId) {
      let killedPlayerName = this.state.players.find(p => p.id === nightResults.killedPlayerId)?.name || "Неизвестный";
      message = `Наступил день. Сделан страшный выбор. Убит игрок ${killedPlayerName}.`;
    }

    // 1. Показать результат ночи всем игрокам
    this.io.to(this.state.id).emit('day_started', {
      killedPlayerId: nightResults.killedPlayerId, // для совместимости
      multipleKills: nightResults.multipleKills,
      message: message
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
    this._broadcastState(); // ОБЯЗАТЕЛЬНО: уведомляем клиентов о новой фазе!
    
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

  handleVote(voterId, suspectId) {
    if (this.subPhase !== 'voting' && this.subPhase !== 'revoting') {
      return { error: "Голосование еще не началось" };
    }

    if (this.subPhase === 'revoting' && this.tiedCandidates && !this.tiedCandidates.includes(suspectId)) {
      return { error: "Можно голосовать только за кандидатов с ничьей!" };
    }
    
    const success = this.state.registerVote(voterId, suspectId);
    
    if (success) {
      // Можно разослать промежуточные результаты голосов (если голосование публичное)
      this.io.to(this.state.id).emit('votes_updated', this.state.votes);
      
      // Проверка досрочного завершения: все живые проголосовали?
      if (Object.keys(this.state.votes).length === this.state.alivePlayers.length) {
        console.log(`[Комната ${this.state.id}] Все проголосовали. Подсчет.`);
        if (this.subPhase === 'revoting') {
          this.endRevote();
        } else {
          this.endDay();
        }
      }
      return { success: true };
    }
    return { error: "Голосование отклонено (возможно, вы или цель мертвы)" };
  }

  /**
   * Подсчет голосов и изгнание игрока
   */
  endDay() {
    if (this.isFinishing) return;
    this.isFinishing = true;

    clearInterval(this.timer);
    this.state.isProcessingPhase = true;

    // Считаем голоса: { [suspectId]: count }
    const voteCounts = {};
    Object.values(this.state.votes).forEach(suspectId => {
      voteCounts[suspectId] = (voteCounts[suspectId] || 0) + 1;
    });

    let maxVotes = 0;
    let isTie = false;
    this.tiedCandidates = [];

    Object.entries(voteCounts).forEach(([suspectId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        isTie = false;
        this.tiedCandidates = [suspectId];
      } else if (count === maxVotes) {
        isTie = true;
        this.tiedCandidates.push(suspectId);
      }
    });

    if (maxVotes === 0) {
      this._finishVotingWithNoOneExiled("Голоса разделились или никто не проголосовал. Город засыпает в страхе.");
    } else if (isTie) {
      // НАЧИНАЕМ ПЕРЕГОЛОСОВАНИЕ
      console.log(`[Комната ${this.state.id}] Ничья. Запуск переголосования между: ${this.tiedCandidates.join(', ')}`);
      this.subPhase = 'revoting';
      this.isFinishing = false; // Allow one more finish for the revote
      this.state.votes = {}; // Сбрасываем голоса
      this.state.isProcessingPhase = false;
      
      this.io.to(this.state.id).emit('revote_started', {
        candidates: this.tiedCandidates,
        message: "Ничья! У вас есть 20 секунд, чтобы переголосовать среди кандидатов."
      });
      // Очищаем локальные голоса на клиенте тоже
      this.io.to(this.state.id).emit('votes_updated', {});

      this._startTimer(20, () => {
        this.endRevote();
      });
    } else {
      this._finishVotingExile(this.tiedCandidates[0]);
    }
  }

  endRevote() {
    if (this.isFinishing && this.subPhase !== 'revoting') return;
    // Note: revoting uses the same flag but requires special handling if interrupted
    this.isFinishing = true;

    clearInterval(this.timer);
    this.state.isProcessingPhase = true;

    const voteCounts = {};
    Object.values(this.state.votes).forEach(suspectId => {
      voteCounts[suspectId] = (voteCounts[suspectId] || 0) + 1;
    });

    let maxVotes = 0;
    let isTie = false;
    let winnerId = null;

    Object.entries(voteCounts).forEach(([suspectId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        winnerId = suspectId;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    if (maxVotes === 0 || isTie) {
      this._finishVotingWithNoOneExiled("Даже переголосование не выявило виновного. Никто не изгнан.");
    } else {
      this._finishVotingExile(winnerId);
    }
  }

  _finishVotingExile(exiledPlayerId) {
    this.state.killPlayer(exiledPlayerId);
    console.log(`[Комната ${this.state.id}] По итогам голосования уходит ${exiledPlayerId}`);
    
    const exiledName = this.state.players.find(p => p.id === exiledPlayerId)?.name || 'Неизвестный';

    this.io.to(this.state.id).emit('voting_result', {
      exiledPlayerId: exiledPlayerId,
      message: `Город сделал свой суровый выбор. Игрок ${exiledName} изгнан.`
    });
    this.state.isProcessingPhase = false;
    if (this.onDayEnd) this.onDayEnd({ exiledPlayerId });
  }

  _finishVotingWithNoOneExiled(msg) {
    console.log(`[Комната ${this.state.id}] Ничья/тишина. Никто не изгнан.`);
    this.io.to(this.state.id).emit('voting_result', {
      exiledPlayerId: null,
      message: msg
    });
    this.state.isProcessingPhase = false;
    if (this.onDayEnd) this.onDayEnd({ exiledPlayerId: null });
  }

  // --- Внутренние утилиты ---

  _startTimer(seconds, onExpireCallback) {
    if (this.timer) clearInterval(this.timer);
    this.timeLeft = seconds;
    
    this.io.to(this.state.id).emit('timer_update', { timeLeft: this.timeLeft, phase: this.state.phase });

    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      // Отправляем каждую секунду для синхронизации таймера на телефонах
      this.io.to(this.state.id).emit('timer_update', { timeLeft: this.timeLeft, phase: this.state.phase });

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
