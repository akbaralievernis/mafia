/**
 * Продвинутый голосовой ассистент на базе Web Speech API.
 * Включает очередь сообщений, чтобы фразы не прерывали друг друга,
 * и мягкие настройки pitch/rate для приятного звучания.
 */
class VoiceAssistant {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.isMuted = false;
    this.queue = [];
    this.isSpeaking = false;
    
    // Пытаемся загрузить русские голоса
    this.loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = this.loadVoices.bind(this);
    }
  }

  /**
   * Загружает и выбирает самый приятный русский голос
   */
  loadVoices() {
    const voices = this.synth.getVoices();
    // Ищем Yandex, Google или любой доступный русский голос (ru-RU)
    const ruVoices = voices.filter(v => v.lang.includes('ru'));
    
    // Предпочтение отдаем Google или премиальным голосам операционной системы
    this.voice = ruVoices.find(v => v.name.includes('Google') || v.name.includes('Yuri') || v.name.includes('Milena')) 
                 || ruVoices[0] 
                 || voices[0];
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.synth.cancel();
      this.queue = [];
      this.isSpeaking = false;
    }
    return this.isMuted;
  }

  /**
   * Добавляет фразу в очередь на озвучивание
   */
  speak(text) {
    if (this.isMuted || !this.synth) return;
    
    this.queue.push(text);
    this._processQueue();
  }

  /**
   * Приватный метод для обработки очереди (чтобы фразы не накладывались)
   */
  _processQueue() {
    if (this.isSpeaking || this.queue.length === 0) return;

    this.isSpeaking = true;
    const text = this.queue.shift();
    
    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    
    // Настройки для "магического", дикторского и четкого звучания (как у профессионального ведущего)
    utterance.pitch = 0.9;  // Чуть ниже обычного
    utterance.rate = 0.95;  // Небольшое замедление для четкости
    utterance.volume = 1.0; 
    
    utterance.onend = () => {
      this.isSpeaking = false;
      // Небольшая пауза между фразами (500мс)
      setTimeout(() => this._processQueue(), 500);
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      this.isSpeaking = false;
      this._processQueue();
    };
    
    this.synth.speak(utterance);
  }

  /**
   * Очищает очередь и останавливает текущую речь (например, при резком сбросе игры)
   */
  clear() {
    this.queue = [];
    this.synth.cancel();
    this.isSpeaking = false;
  }
}

// Экспортируем синглтон для доступа из любых компонентов
export const assistant = new VoiceAssistant();


// --- ПРИМЕРЫ СИНХРОНИЗАЦИИ ВО ВРЕМЯ ИГРЫ (для вставки в useEffect Game.jsx): ---
/*
  if (phase === 'night') {
    assistant.speak('Наступает ночь. Город засыпает.');
    assistant.speak('Мафия выбирает жертву.');
    assistant.speak('Доктор делает выбор и спасает жизнь.');
  }

  if (phase === 'day') {
    assistant.speak('Просыпается город.');
  }
*/
