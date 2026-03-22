/**
 * Класс управления состоянием игры (Game State)
 * Отвечает за централизованное хранение и безопасное обновление данных.
 */
class GameState {
  constructor(roomId) {
    this.id = roomId;
    this.players = [];         // Полный список объектов игроков: { id, name, isHost }
    this.roles = {};           // Словарь ролей: { [playerId]: 'mafia' | 'doctor' | 'detective' | 'citizen' }
    this.alivePlayers = [];    // Массив ID живых игроков
    this.phase = "lobby";      // Текущая фаза: "lobby" | "night" | "day" | "vote" | "end"
    this.round = 0;            // Номер текущего раунда (ночь + день = 1 раунд)
    
    // Голоса во время дневного голосования: { [voterId]: suspectId }
    this.votes = {};           
    
    // Действия активных ролей ночью
    this.actions = {
      mafia: [],               // Массив ID жертв, выбранных разными мафиози (для вычисления большинства)
      doctor: null,            // ID игрока, которого лечит доктор
      detective: null          // ID игрока, которого проверяет детектив
    };

    // Защита от состояния гонки (рассинхронизации)
    // Флаг блокировки мутаций во время транзита фаз
    this.isProcessingPhase = false; 
  }

  // --- 1. УПРАВЛЕНИЕ ИГРОКАМИ ---

  addPlayer(player) {
    if (this.phase !== "lobby") {
      throw new Error("Нельзя присоединиться: игра уже началась");
    }
    if (this.players.find(p => p.id === player.id)) {
      throw new Error("Игрок уже в комнате");
    }
    this.players.push(player);
    if (!player.isHost) {
      this.alivePlayers.push(player.id);
    }
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    this.alivePlayers = this.alivePlayers.filter(id => id !== playerId);
    
    // Если игрок ушел, нужно его убрать из ролей и очистить его голоса
    delete this.roles[playerId];
    delete this.votes[playerId];
  }

  // --- 2. УПРАВЛЕНИЕ СОСТОЯНИЕМ (ФАЗЫ) ---

  /**
   * Начинает первый раунд (переход из lobby в night).
   */
  startGame(assignedRoles) {
    if (this.phase !== 'lobby') return false;
    
    // Блокируем изменение состояния для защиты от race conditions
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

  /**
   * Сменяет фазу игры. 
   * @param {string} newPhase - "night", "day" или "vote"
   */
  setPhase(newPhase) {
    this.isProcessingPhase = true;
    try {
      this.phase = newPhase;
      
      // При наступлении новой ночи увеличиваем номер раунда
      if (newPhase === 'night') {
        this.round++;
        this.resetActions();
      } 
      // При наступлении дневного голосования очищаем старые голоса
      else if (newPhase === 'vote') {
        this.votes = {};
      }
    } finally {
      this.isProcessingPhase = false;
    }
  }

  // --- 3. ИГРОВЫЕ ДЕЙСТВИЯ ---

  /**
   * Записывает ночное действие от конкретной роли.
   * Проверяет, валидно ли действие, жив ли игрок.
   */
  registerNightAction(playerId, targetId, role) {
    if (this.phase !== 'night' || this.isProcessingPhase) return false;
    if (!this.alivePlayers.includes(playerId)) return false;

    // Записываем действие строго по роли
    switch (role) {
      case 'mafia':
        this.actions.mafia.push(targetId);
        break;
      case 'doctor':
        this.actions.doctor = targetId;
        break;
      case 'detective':
        this.actions.detective = targetId;
        break;
      default:
        return false;
    }
    return true;
  }

  /**
   * Записывает дневной голос игрока против подозреваемого.
   */
  registerVote(voterId, suspectId) {
    if (this.phase !== 'vote' || this.isProcessingPhase) return false;
    if (!this.alivePlayers.includes(voterId) || !this.alivePlayers.includes(suspectId)) {
      return false; // Заблокировано: мертвые не голосуют, за мертвых не голосуют
    }

    this.votes[voterId] = suspectId;
    return true;
  }

  /**
   * Убивает игрока по итогам ночи или дневного голосования.
   */
  killPlayer(playerId) {
    this.alivePlayers = this.alivePlayers.filter(id => id !== playerId);
  }

  /**
   * Очищает действия предыдущей ночи
   */
  resetActions() {
    this.actions = {
      mafia: [],
      doctor: null,
      detective: null
    };
  }

  // --- 4. ЭКСПОРТ СОСТОЯНИЯ (Для отправки на клиент) ---

  /**
   * Возвращает безопасный "срез" данных для конкретного игрока.
   * Скрывает скрытую информацию: чужие роли и ночные действия.
   */
  getSanitizedState(playerId) {
    const isGameEnded = this.phase === 'end';
    const myRole = this.roles[playerId];
    const isMafia = myRole === 'mafia';

    return {
      id: this.id,
      phase: this.phase,
      round: this.round,
      alivePlayers: this.alivePlayers,
      // Раскрываем все роли только в конце игры
      // Во время игры игрок видит только свою роль (и мафия видит мафию)
      roles: isGameEnded ? this.roles : this._getVisibleRoles(isMafia, playerId),
      // Голосующие видят публичные голоса (кто за кого)
      votes: this.phase === 'vote' ? this.votes : {},
      // Личные результаты или текущий статус отправляются отдельно от общего стейта, 
      // чтобы избежать утечки данных.
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isAlive: this.alivePlayers.includes(p.id)
      }))
    };
  }

  /**
   * Приватный метод вычисления видимых ролей для конкретного клиента
   */
  _getVisibleRoles(isMafia, myId) {
    const visibleRoles = {};
    if (this.roles[myId] === 'spectator') {
      return visibleRoles; // Зритель не видит никаких ролей!
    }

    if (isMafia) {
      // Мафия знает всех остальных мафиози
      Object.keys(this.roles).forEach(id => {
        if (this.roles[id] === 'mafia') visibleRoles[id] = 'mafia';
      });
    } else {
      // Мирный/Шериф/Доктор видят только себя
      if (this.roles[myId]) visibleRoles[myId] = this.roles[myId];
    }
    return visibleRoles;
  }
}

module.exports = GameState;
