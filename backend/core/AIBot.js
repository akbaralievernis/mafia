/**
 * Модуль для генерации и управления AI-ботами.
 * Позволяет играть даже в одиночку или вдвоем.
 */
class AIBot {
  /**
   * Создает необходимое количество ботов для дополнения комнаты до минимума
   */
  static generateBots(currentCount, minRequired = 4) {
    const bots = [];
    const names = ['Алекс (Бот)', 'Мария (Бот)', 'Джон (Бот)', 'Сара (Бот)', 'Т-800', 'HAL 9000'];
    
    const needed = Math.max(0, minRequired - currentCount);
    
    for(let i = 0; i < needed; i++) {
      bots.push({
        id: `bot_${Date.now()}_${i}`,
        name: names[Math.floor(Math.random() * names.length)],
        isBot: true,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=bot${i}` // Генерация аватара робота
      });
    }
    return bots;
  }

  /**
   * Имитация "раздумий" бота во время фаз
   */
  static makeRandomAction(botId, role, phase, alivePlayers) {
    // Делаем задержку от 2 до 10 секунд, чтобы казалось, что боты "думают"
    const thinkingTime = Math.floor(Math.random() * 8000) + 2000;
    
    // Бот никого не выбирает, если мертв или некому выбирать
    const possibleTargets = alivePlayers.filter(id => id !== botId); // Боты не голосуют за себя
    if (possibleTargets.length === 0) return null;

    const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];

    return {
      delay: thinkingTime,
      targetId: randomTarget
    };
  }
}

module.exports = AIBot;
