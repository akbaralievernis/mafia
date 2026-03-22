export const VoiceTTS = {
  speak: (text) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const lang = localStorage.getItem('mafia_lang') || 'ru';
    utterance.lang = lang === 'de' ? 'de-DE' : 'ru-RU';
    utterance.rate = 1.0;
    utterance.pitch = 0.9;
    utterance.volume = 1.0;

    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      if (lang === 'de') {
        const deVoices = voices.filter(v => v.lang.includes('de'));
        if (deVoices.length > 0) {
          const bestVoice = deVoices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || deVoices[0];
          utterance.voice = bestVoice;
        }
      } else {
        const ruVoices = voices.filter(v => v.lang.includes('ru'));
        if (ruVoices.length > 0) {
          const bestVoice = ruVoices.find(v => {
            const name = v.name.toLowerCase();
            return name.includes('yuri') || name.includes('pavel') || name.includes('dmitry') || name.includes('male') || name.includes('мужской');
          }) || ruVoices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || ruVoices[0];
          utterance.voice = bestVoice;
        }
      }
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = setVoice;
    } else {
      setVoice();
    }
  }
};
