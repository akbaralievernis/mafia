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
    if (gameState.phase === 'end' || gameState.isEnding) return true;

    // Считаем количество живых игроков по фракциям
    let mafiaCount = 0;
    let peacefulCount = 0; // Мирные, доктор, детектив (все, кто не мафия и не маньяк)
    let maniacCount = 0;

    gameState.alivePlayers.forEach(playerId => {
      const r = gameState.roles[playerId];
      if (r === 'mafia' || r === 'don') {
        mafiaCount++;
      } else if (r === 'maniac') {
        maniacCount++;
      } else {
        peacefulCount++;
      }
    });

    let winners = null;
    let winMessage = "";

    // 1. Условие победы Мирных: все мафиози и злодеи мертвы
    if (mafiaCount === 0 && maniacCount === 0) {
      winners = 'citizens';
      winMessage = "Все злодеи уничтожены! Мирные жители спасли свой город.";
    } 
    // 2. Условие победы Мафии: мафиози больше или равно сумме остальных ролей
    else if (mafiaCount >= peacefulCount + maniacCount) {
      winners = 'mafia';
      winMessage = "Мафия захватила контроль над городом. Оставшихся слишком мало для сопротивления.";
    }
    // 3. Условие победы Маньяка: мафия мертва, и маньяк остался один на один с мирным или вообще один
    else if (maniacCount > 0 && mafiaCount === 0 && peacefulCount <= 1) {
      winners = 'maniac';
      winMessage = "Маньяк остался последним выжившим злодеем и закончил свою охоту. Победа Маньяка!";
    }

    if (winners) {
      gameState.isEnding = true;
      // Даем игрокам 5 секунд на осознание результатов голосования (анимация задержки)
      setTimeout(() => {
        this._endGame(gameState, io, winners, winMessage);
      }, 6000); 
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
