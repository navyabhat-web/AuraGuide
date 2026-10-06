import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface POI {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  category: string;
  description: string;
  audioUrl?: string;
}

export type ThemeType = 'dark' | 'light';
export type AudioSpeed = 1 | 1.25 | 1.5;

interface AppState {
  // POI Data
  pois: POI[];
  activePOI: POI | null;
  history: string[]; // List of POI IDs already played
  
  // Settings
  theme: ThemeType;
  audioSpeed: AudioSpeed;
  isSettingsOpen: boolean;
  isAutoTour: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: number | null;
  language: string;
  voicePersona: 'Male' | 'Female';
  topics: string[];

  // Actions
  setActivePOI: (poi: POI | null) => void;
  addToHistory: (id: string) => void;
  setPOIs: (pois: POI[]) => void;
  setTheme: (theme: ThemeType) => void;
  setAudioSpeed: (speed: AudioSpeed) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setIsAutoTour: (isAuto: boolean) => void;
  setCooldownMinutes: (minutes: number) => void;
  setLastTriggeredAt: (timestamp: number) => void;
  setLanguage: (lang: string) => void;
  setVoicePersona: (persona: 'Male' | 'Female') => void;
  setTopics: (topics: string[]) => void;
}

export const usePOIStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial State
      pois: [],
      activePOI: null,
      history: [],
      theme: 'light',
      audioSpeed: 1,
      isSettingsOpen: false,
      isAutoTour: false,
      cooldownMinutes: 3,
      lastTriggeredAt: null,
      language: 'English', // English, Kannada, Hindi, Tulu, Telugu, Tamil, Malayalam, Konkani
      voicePersona: 'Female',
      topics: ['History', 'Architecture', 'Local Legends', 'Food & Culture'],

      // Actions
      setActivePOI: (poi) => set({ activePOI: poi }),
      addToHistory: (id) => set((state) => ({ history: [...state.history, id] })),
      setPOIs: (pois) => set({ pois }),
      setTheme: (theme) => set({ theme }),
      setAudioSpeed: (speed) => set({ audioSpeed: speed }),
      setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setIsAutoTour: (isAuto) => set({ isAutoTour: isAuto }),
      setCooldownMinutes: (minutes) => set({ cooldownMinutes: minutes }),
      setLastTriggeredAt: (timestamp) => set({ lastTriggeredAt: timestamp }),
      setLanguage: (lang) => set({ language: lang }),
      setVoicePersona: (persona) => set({ voicePersona: persona }),
      setTopics: (topics) => set({ topics }),
    }),
    {
      name: 'auraguide-storage',
      partialize: (state) => ({ 
        theme: state.theme, 
        audioSpeed: state.audioSpeed, 
        isAutoTour: state.isAutoTour,
        history: state.history,
        cooldownMinutes: state.cooldownMinutes,
        language: state.language,
        voicePersona: state.voicePersona,
        topics: state.topics
      }),
    }
  )
);
