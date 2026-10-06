import React, { useState } from 'react';
import { Compass, MapPin, Headphones, ChevronRight, Globe, User } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  onStart: () => void;
}

export const WelcomeModal = ({ onStart }: Props) => {
  const [isClosing, setIsClosing] = useState(false);
  const { language, setLanguage, voicePersona, setVoicePersona } = usePOIStore();
  const { t } = useLanguage();

  const handleStart = () => {
    setIsClosing(true);
    setTimeout(onStart, 400);
  };

  const languages = ['English', 'Kannada', 'Hindi', 'Tulu', 'Telugu', 'Tamil', 'Malayalam', 'Konkani'];

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-baby-pink/80 to-cream/80 backdrop-blur-xl transition-opacity duration-400 ${isClosing ? 'opacity-0' : 'opacity-100 animate-fade-in'}`}>
      <div className="bg-white/70 backdrop-blur-3xl border-[3px] border-deep-rose shadow-[0_0_60px_rgba(194,24,91,0.25)] rounded-[2.5rem] w-full max-w-sm overflow-hidden relative">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-baby-pink border-2 border-deep-rose rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(194,24,91,0.4)]">
            <Compass className="text-deep-rose w-10 h-10 animate-pulse" />
          </div>
          <h2 className="text-4xl font-black text-deep-rose mb-1 tracking-tight">{t('welcomeTitle')}</h2>
          <p className="text-deep-rose-dark/80 font-medium italic text-sm mb-6 leading-relaxed px-2">
            "{t('welcomeSubtitle')}"
          </p>
          
          <div className="w-full space-y-4 mb-8 text-left bg-white/80 backdrop-blur-lg p-5 rounded-3xl border border-pink-200 shadow-sm">
            {/* Language Selector */}
            <div className="flex flex-col space-y-2">
              <label className="flex items-center text-deep-rose-dark font-bold text-sm">
                <Globe size={16} className="mr-2 text-deep-rose" /> {t('language')}
              </label>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-cream-alt/80 border border-pink-200 text-deep-rose-dark text-sm font-semibold rounded-xl p-3 outline-none focus:border-deep-rose focus:ring-1 focus:ring-deep-rose transition-all"
              >
                {languages.map(lang => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            {/* Voice Persona Selector */}
            <div className="flex flex-col space-y-2 pt-2">
              <label className="flex items-center text-deep-rose-dark font-bold text-sm">
                <User size={16} className="mr-2 text-deep-rose" /> {t('voice')}
              </label>
              <div className="flex bg-cream-alt/80 rounded-xl p-1.5 border border-pink-200">
                <button
                  onClick={() => setVoicePersona('Female')}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${voicePersona === 'Female' ? 'bg-deep-rose text-white shadow-md' : 'text-deep-rose-dark hover:bg-baby-pink-dark'}`}
                >
                  {t('female')}
                </button>
                <button
                  onClick={() => setVoicePersona('Male')}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${voicePersona === 'Male' ? 'bg-deep-rose text-white shadow-md' : 'text-deep-rose-dark hover:bg-baby-pink-dark'}`}
                >
                  {t('male')}
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={handleStart}
            className="w-full bg-deep-rose hover:bg-deep-rose-dark text-white font-black text-lg py-4 rounded-2xl shadow-[0_10px_30px_rgba(194,24,91,0.5)] flex items-center justify-center space-x-2 group transition-all active:scale-95"
          >
            <span>{t('startExploring')}</span>
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
