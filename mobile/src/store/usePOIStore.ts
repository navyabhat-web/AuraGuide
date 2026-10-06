import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface POI {
  id: string;
  name: string;
  category: string;
  description: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface QueuedAudio {
  poiId: string;
  narrativeText: string;
  audioBase64: string; // Saved Base64 for offline playback
  timestamp: number;
}

interface AdminSettings {
  language: string;
  voicePersona: 'Male' | 'Female';
}

interface POIStore {
  originLocation: { lat: number, lng: number } | null;
  setOriginLocation: (loc: { lat: number, lng: number }) => void;
  
  originPOI: POI | null;
  setOriginPOI: (poi: POI | null) => void;
  
  queuedAudio: Record<string, QueuedAudio>;
  addQueuedAudio: (poiId: string, narrativeText: string, audioBase64: string) => void;
  removeQueuedAudio: (poiId: string) => void;
  
  adminSettings: AdminSettings;
  updateAdminSettings: (settings: Partial<AdminSettings>) => void;
  
  pastVisitedLocations: string[];
  addVisitedLocation: (locationName: string) => void;
}

export const usePOIStore = create<POIStore>()(
  persist(
    (set) => ({
      originLocation: null,
      setOriginLocation: (loc) => set({ originLocation: loc }),
      
      originPOI: null,
      setOriginPOI: (poi) => set({ originPOI: poi }),
      
      queuedAudio: {},
      addQueuedAudio: (poiId, narrativeText, audioBase64) => set((state) => ({
        queuedAudio: {
          ...state.queuedAudio,
          [poiId]: { poiId, narrativeText, audioBase64, timestamp: Date.now() }
        }
      })),
      removeQueuedAudio: (poiId) => set((state) => {
        const newQueue = { ...state.queuedAudio };
        delete newQueue[poiId];
        return { queuedAudio: newQueue };
      }),
      
      adminSettings: {
        language: 'English',
        voicePersona: 'Female'
      },
      updateAdminSettings: (settings) => set((state) => ({
        adminSettings: { ...state.adminSettings, ...settings }
      })),
      
      pastVisitedLocations: [],
      addVisitedLocation: (locationName) => set((state) => {
        if (state.pastVisitedLocations.includes(locationName)) return state;
        return {
          pastVisitedLocations: [...state.pastVisitedLocations, locationName]
        };
      }),
    }),
    {
      name: 'auraguide-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
