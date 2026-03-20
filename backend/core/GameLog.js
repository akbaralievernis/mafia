/**
 * Модуль для логирования событий игры (История).
 * Все важные действия (смерти, фазы, результаты) записываются сюда.
 */
class GameLog {
  constructor() {
    this.history = [];
  }

  /**
   * Добавляет новое событие в историю
   * @param {string} type - 'phase_change', 'death', 'vote', 'system'
   * @param {string} message - Текст для отображения в UI
   * @param {Object} data - Скрытые данные (например, реальные роли)
   * @param {boolean} isPublic - Доступно ли всем прямо сейчас
   */
  addEvent(type, message, data = {}, isPublic = true) {
    const event = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      timestamp: Date.now(),
      type,
      message,
      data,
      isPublic
    };
    
    this.history.push(event);
    return event;
  }

  /**
   * Возвращает историю
   * Если игра идет, скрытые события вырезаются. Если игра окончена - отдается всё.
   */
  getLogs(isGameOver) {
    if (isGameOver) return this.history;
    return this.history.filter(event => event.isPublic);
  }
}

module.exports = GameLog;
