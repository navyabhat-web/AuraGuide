export function getLanguageCode(language: string): string {
  switch (language.toLowerCase()) {
    case 'english': return 'en-US';
    case 'kannada': return 'kn-IN';
    case 'hindi': return 'hi-IN';
    case 'tulu': return 'en-IN'; // Fallback
    case 'telugu': return 'te-IN';
    case 'tamil': return 'ta-IN';
    case 'malayalam': return 'ml-IN';
    case 'konkani': return 'kok-IN';
    default: return 'en-US';
  }
}

export interface SpeechCallbacks {
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onEnd?: () => void;
  onError?: (e: any) => void;
}

export function speakNative(text: string, language: string, voicePersona: 'Male' | 'Female', callbacks?: SpeechCallbacks) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLanguageCode(language);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  
  // Voices might not be loaded immediately, but we'll try
  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = null;

  const isMale = voicePersona === 'Male';

  if (voices.length > 0) {
    // First try to find a voice that matches the language
    const langVoices = voices.filter(v => v.lang.startsWith(utterance.lang.split('-')[0]));
    const candidates = langVoices.length > 0 ? langVoices : voices;
    
    // Comprehensive Regex for Indian & Global voices on Windows / Chrome
    const maleRegex = /Male|David|Mark|George|Ravi|Hemant|Madhur|Gagan|Valluvar/i;
    const femaleRegex = /Female|Zira|Hazel|Heera|Kalpana|Swara|Neerja|Shruti|Vani|Pallavi|Laya|Sapna/i;
    
    if (isMale) {
      selectedVoice = candidates.find(v => maleRegex.test(v.name)) || 
                      candidates.find(v => !femaleRegex.test(v.name));
    } else {
      selectedVoice = candidates.find(v => femaleRegex.test(v.name)) || 
                      candidates.find(v => !maleRegex.test(v.name));
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else if (candidates.length > 0) {
      utterance.voice = candidates[0];
    }
  }

  utterance.pitch = isMale ? 0.8 : 1.25;
  utterance.rate = isMale ? 0.9 : 0.95;

  if (callbacks) {
    if (callbacks.onStart) utterance.onstart = callbacks.onStart;
    if (callbacks.onPause) utterance.onpause = callbacks.onPause;
    if (callbacks.onResume) utterance.onresume = callbacks.onResume;
    if (callbacks.onEnd) utterance.onend = callbacks.onEnd;
    if (callbacks.onError) utterance.onerror = callbacks.onError;
  }

  window.speechSynthesis.speak(utterance);
}
