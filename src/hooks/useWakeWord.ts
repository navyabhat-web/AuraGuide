import { useEffect, useState, useRef } from 'react';

export const useWakeWord = (onWakeWord: (transcript: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; // We could make this dynamic based on selected language
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      // Restart automatically for continuous listening unless unmounted
      try {
        recognition.start();
      } catch (e) {}
    };
    
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.toLowerCase();
      
      console.log("Heard:", transcript);

      if (
        transcript.includes('hey stop') || 
        transcript.includes('wait a minute') || 
        transcript.includes('pause') || 
        transcript.includes('i have a doubt')
      ) {
        onWakeWord(transcript);
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {}

    return () => {
      if (recognition) {
        recognition.onend = null; // Prevent restart loop
        recognition.stop();
      }
    };
  }, [onWakeWord]);

  return { isListening };
};
