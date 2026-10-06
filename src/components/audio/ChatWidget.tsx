import React, { useState } from 'react';
import { Send, Bot, Loader2, Mic, MicOff } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { speakNative } from '../../lib/speech';
import { useLanguage } from '../../contexts/LanguageContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWidgetProps {
  poi: any;
  theme?: string;
}

export const ChatWidget = ({ poi, theme = 'light' }: ChatWidgetProps) => {
  const { language, voicePersona } = usePOIStore();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const playBase64Audio = (base64String: string) => {
    try {
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (e) {
      console.error("Failed to play base64 audio", e);
    }
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      // Automatically send
      submitQuestion(transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };
    
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };

  const submitQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;
    
    setInputValue('');
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: questionText };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poi, question: questionText, language, voicePersona })
      });
      const data = await res.json();
      
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: data.answer || "I'm having trouble connecting. Let's try again!"
      };
      setMessages(prev => [...prev, aiMsg]);
      
      if (data.audioBase64) {
        playBase64Audio(data.audioBase64);
      } else {
        speakNative(data.answer, language, voicePersona);
      }
      
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Connection error. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    submitQuestion(inputValue);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`w-full rounded-2xl border flex flex-col overflow-hidden shadow-sm bg-white border-pink-200`}>
      <div className={`px-4 py-3 border-b flex items-center space-x-2 border-pink-200 bg-baby-pink`}>
        <Bot size={18} className={'text-deep-rose'} />
        <h4 className={`font-bold text-sm text-deep-rose-dark`}>{t('askQuestion')}</h4>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 max-h-60 overflow-y-auto p-4 space-y-4 flex flex-col">
        {messages.length === 0 ? (
          <p className={`text-center text-sm italic my-4 opacity-60 text-deep-rose-dark`}>
            Curious about {poi.name}? Ask your AI guide anything!
          </p>
        ) : (
          messages.map(m => (
            <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user' 
                  ? 'bg-deep-rose text-white rounded-tr-none' 
                  : 'bg-baby-pink text-deep-rose-dark rounded-tl-none'
              }`}>
                {m.content}
              </div>
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="flex w-full justify-start">
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 rounded-tl-none bg-baby-pink`}>
              <Loader2 size={16} className={`animate-spin text-deep-rose`} />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`p-2 border-t border-pink-200 bg-white`}>
        <form onSubmit={handleSend} className="relative flex items-center">
          <button 
            type="button"
            onClick={startRecording}
            className={`absolute left-1.5 p-2 rounded-full transition-all ${
              isRecording 
                ? 'bg-red-100 text-red-500 animate-pulse' 
                : 'text-deep-rose hover:bg-baby-pink'
            }`}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isRecording ? "Listening..." : t('askPlaceholder')}
            className={`w-full pl-10 pr-12 py-2.5 rounded-xl text-sm outline-none transition-all bg-cream-alt text-deep-rose-dark placeholder-pink-400 focus:ring-1 focus:ring-deep-rose ${isRecording ? 'opacity-50' : ''}`}
            disabled={isRecording}
          />
          <button 
            type="submit"
            disabled={!inputValue.trim() || isTyping || isRecording}
            className={`absolute right-1.5 p-1.5 rounded-lg transition-colors ${
              !inputValue.trim() || isRecording
                ? 'opacity-50 cursor-not-allowed text-pink-300' 
                : 'bg-deep-rose text-white hover:bg-deep-rose-dark'
            }`}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
