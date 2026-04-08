class AIBot {
  static generateBots(currentCount, minRequired = 4) {
    const bots = [];
    const names = ['Алекс (Бот)', 'Мария (Бот)', 'Джон (Бот)', 'Сара (Бот)', 'Т-800', 'HAL 9000'];
    const needed = Math.max(0, minRequired - currentCount);
    for(let i = 0; i < needed; i++) {
      bots.push({
        id: `bot_${Date.now()}_${i}`,
        name: names[Math.floor(Math.random() * names.length)],
        isBot: true,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=bot${i}`
      });
    }
    return bots;
  }

  static makeRandomAction(botId, role, phase, alivePlayers) {
    const thinkingTime = Math.floor(Math.random() * 8000) + 2000;
    const possibleTargets = alivePlayers.filter(id => id !== botId);
    if (possibleTargets.length === 0) return null;
    const randomTarget = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    return {
      delay: thinkingTime,
      targetId: randomTarget
    };
  }
}

export default AIBot;
