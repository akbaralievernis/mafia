export const VoiceTTS = {
  speak: (text) => {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU'; // Russian text
    utterance.rate = 1.0;     // Normal speed
    utterance.pitch = 0.9;    // Slightly lower pitch for dramatic effect
    utterance.volume = 1.0;

    // Optional: try to find a premium/natural sounding voice
    const setVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const ruVoices = voices.filter(v => v.lang.includes('ru'));
      if (ruVoices.length > 0) {
        // Try to pick a Google or premium voice if available
        const bestVoice = ruVoices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || ruVoices[0];
        utterance.voice = bestVoice;
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
