/**
 * Утилита для автоматического распределения ролей.
 * Гарантирует баланс в зависимости от количества игроков.
 */
class RoleDistributor {
  /**
   * Распределяет роли для массива игроков
   * @param {Array<{id: string}>} players - Массив игроков
   * @returns {Object} Словарь ролей { [playerId]: 'role_name' }
   */
  static assignRoles(players) {
    const count = players.length;
    
    // Защита: для полноценной игры с активными ролями нужно минимум 4 человека (в идеале 6+)
    if (count < 4) {
      throw new Error("Недостаточно игроков для старта игры (минимум 4)");
    }

    const rolesArray = [];

    // 1. Динамический баланс мафии (примерно 1 мафия на 3-4 мирных)
    const mafiaCount = Math.floor(count / 4) || 1; 
    for (let i = 0; i < mafiaCount; i++) rolesArray.push('mafia');

    // 2. Добавляем Доктора и Комиссара (при 4+ игроках всегда есть по 1)
    rolesArray.push('doctor');
    rolesArray.push('detective'); // Комиссар

    // 3. Остальные - мирные жители
    const citizensCount = count - rolesArray.length;
    for (let i = 0; i < citizensCount; i++) {
        rolesArray.push('citizen');
    }

    // 4. Случайное перемешивание массива ролей (алгоритм Фишера-Йетса)
    for (let i = rolesArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolesArray[i], rolesArray[j]] = [rolesArray[j], rolesArray[i]];
    }

    // 5. Формируем словарь привязки ролей к конкретным ID игроков
    const assignedRoles = {};
    players.forEach((player, index) => {
      assignedRoles[player.id] = rolesArray[index];
    });

    return assignedRoles;
  }
}

module.exports = RoleDistributor;
