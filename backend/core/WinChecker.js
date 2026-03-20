/**
 * Модуль для проверки условий победы.
 * Отвечает за подсчет баланса сил и объявление победителя.
 */
class WinChecker {
  /**
   * Проверяет, завершена ли игра, и если да — объявляет результаты.
   * Вызывается после каждой ночи и после каждого дневного голосования.
   * 
   * @param {Object} gameState - Экземпляр GameState
   * @param {Object} io - Socket.io серверный инстанс
   * @returns {boolean} true если игра окончена, иначе false
   */
  static checkWin(gameState, io) {
    if (gameState.phase === 'end') return true;

    // Считаем количество живых игроков по фракциям
    let mafiaCount = 0;
    let peacefulCount = 0; // Мирные, доктор, детектив (все, кто не мафия)

    gameState.alivePlayers.forEach(playerId => {
      if (gameState.roles[playerId] === 'mafia') {
        mafiaCount++;
      } else {
        peacefulCount++;
      }
    });

    let winners = null;
    let winMessage = "";

    // 1. Условие победы Мирных: все мафиози мертвы
    if (mafiaCount === 0) {
      winners = 'citizens';
      winMessage = "Вся мафия уничтожена! Мирные жители спасли свой город.";
    } 
    // 2. Условие победы Мафии: мафиози больше или равно количеству мирных (математическая победа)
    else if (mafiaCount >= peacefulCount) {
      winners = 'mafia';
      winMessage = "Мафия захватила контроль над городом. мирных осталось слишком мало для сопротивления.";
    }

    if (winners) {
      this._endGame(gameState, io, winners, winMessage);
      return true;
    }

    return false;
  }

  /**
   * Внутренний метод для перевода игры в финальную стадию
   */
  static _endGame(gameState, io, winners, winMessage) {
    // 1. Блокируем дальнейшие действия, меняя фазу
    gameState.setPhase('end');
    
    console.log(`[Комната ${gameState.id}] ИГРА ОКОНЧЕНА. Победили: ${winners}`);

    // Раскрываем все роли (метод getSanitizedState в фазе 'end' вернет полный словарь ролей)
    gameState.players.forEach(p => {
      // Отправляем финальный стейт с раскрытыми ролями всех игроков
      const finalState = gameState.getSanitizedState(p.id);
      
      io.to(p.id).emit('game_over', {
        winners: winners,       // 'mafia' или 'citizens'
        message: winMessage,
        finalState: finalState  // Клиент отобразит, кто кем был на самом деле
      });
    });
  }
}

module.exports = WinChecker;
