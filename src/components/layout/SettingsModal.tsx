import React from 'react';
import { X, Moon, Sun, FastForward } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';

export const SettingsModal = () => {
  const { isSettingsOpen, setIsSettingsOpen, theme, setTheme, audioSpeed, setAudioSpeed, history, cooldownMinutes, setCooldownMinutes, language, setLanguage, topics, setTopics, voicePersona, setVoicePersona } = usePOIStore();
  
  const AVAILABLE_LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi'];
  const AVAILABLE_TOPICS = ['History', 'Architecture', 'Local Legends', 'Food & Culture'];

  const toggleTopic = (topic: string) => {
    if (topics.includes(topic)) {
      setTopics(topics.filter(t => t !== topic));
    } else {
      setTopics([...topics, topic]);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-sm h-[80vh] overflow-y-auto rounded-3xl p-6 shadow-2xl relative ${theme === 'dark' ? 'bg-rose-900 text-white' : 'bg-white text-rose-900'}`}>
        <button 
          onClick={() => setIsSettingsOpen(false)}
          className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-rose-800' : 'hover:bg-rose-100'}`}
        >
          <X size={20} />
        </button>
        
        <h2 className="text-2xl font-black mb-6">Settings</h2>

        {/* Theme Toggle */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Display Theme</h3>
          <div className={`flex rounded-xl p-1 ${theme === 'dark' ? 'bg-rose-800' : 'bg-rose-100'}`}>
            <button 
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${theme === 'light' ? 'bg-white text-rose-900 shadow' : 'text-rose-500'}`}
            >
              <Sun size={16} /> <span>Light</span>
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${theme === 'dark' ? 'bg-rose-700 text-white shadow' : 'text-rose-500'}`}
            >
              <Moon size={16} /> <span>Dark</span>
            </button>
          </div>
        </div>

        {/* Audio Speed */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Audio Speed</h3>
          <div className={`flex rounded-xl p-1 ${theme === 'dark' ? 'bg-rose-800' : 'bg-rose-100'}`}>
            {[1, 1.25, 1.5].map((speed) => (
              <button 
                key={speed}
                onClick={() => setAudioSpeed(speed as any)}
                className={`flex-1 flex items-center justify-center space-x-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${audioSpeed === speed ? (theme === 'dark' ? 'bg-rose-700 text-white shadow' : 'bg-white text-rose-900 shadow') : 'text-rose-500'}`}
              >
                <FastForward size={14} /> <span>{speed}x</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* Cooldown Gap */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Auto-Play Gap (Minutes)</h3>
          <div className={`flex rounded-xl p-1 ${theme === 'dark' ? 'bg-rose-800' : 'bg-rose-100'}`}>
            {[1, 3, 5].map((gap) => (
              <button 
                key={gap}
                onClick={() => setCooldownMinutes(gap)}
                className={`flex-1 flex items-center justify-center space-x-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${cooldownMinutes === gap ? (theme === 'dark' ? 'bg-rose-700 text-white shadow' : 'bg-white text-rose-900 shadow') : 'text-rose-500'}`}
              >
                <span>{gap}m</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Narrator Language</h3>
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-rose-800 border-rose-700 text-white' : 'bg-rose-50 border-rose-200 text-rose-900'}`}
          >
            {AVAILABLE_LANGUAGES.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        {/* Voice Persona Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Guide Voice</h3>
          <div className={`flex rounded-xl p-1 ${theme === 'dark' ? 'bg-rose-800' : 'bg-rose-100'}`}>
            {['Female', 'Male'].map((voice) => (
              <button 
                key={voice}
                onClick={() => setVoicePersona(voice as 'Female' | 'Male')}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-lg text-sm font-semibold transition-all ${voicePersona === voice ? (theme === 'dark' ? 'bg-rose-700 text-white shadow' : 'bg-white text-rose-900 shadow') : 'text-rose-500'}`}
              >
                <span>{voice}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topic Filters */}
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Narrative Topics</h3>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TOPICS.map(topic => (
              <button 
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${topics.includes(topic) ? (theme === 'dark' ? 'bg-pink-600 border-pink-500 text-white' : 'bg-pink-500 border-pink-400 text-white') : (theme === 'dark' ? 'bg-rose-800 border-rose-700 text-rose-400' : 'bg-rose-100 border-rose-200 text-rose-600')}`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Reset History */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3 opacity-60">Data</h3>
          <button 
            onClick={() => {
                // To actually clear zustand persisted state, one would write a clearHistory action.
                alert(`You have visited ${history.length} spots!`);
            }}
            className={`w-full py-3 rounded-xl font-semibold border transition-colors ${theme === 'dark' ? 'border-rose-700 hover:bg-rose-800' : 'border-rose-200 hover:bg-rose-50'}`}
          >
            View History Stats
          </button>
        </div>
      </div>
    </div>
  );
};


