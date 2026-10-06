"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Compass, Settings, List, Map as MapIcon, RefreshCcw } from 'lucide-react';
import { useGeoFence } from '../hooks/useGeoFence';
import { AudioDeck } from '../components/audio/AudioDeck';
import { usePOIStore } from '../hooks/usePOIStore';
import { geoDistance } from '../lib/geo';
import { WelcomeModal } from '../components/layout/WelcomeModal';
import { FilterBar } from '../components/layout/FilterBar';
import { NearbyList } from '../components/layout/NearbyList';
import { SettingsModal } from '../components/layout/SettingsModal';
import { SearchBar } from '../components/layout/SearchBar';

const MapView = dynamic(() => import('../components/map/MapView'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-cream text-deep-rose-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-baby-pink to-cream z-0" />
      <Compass className="animate-spin-slow w-16 h-16 text-deep-rose mb-6 z-10" />
      <p className="font-bold tracking-widest text-xl animate-pulse text-deep-rose z-10">CALIBRATING GPS...</p>
    </div>
  )
});

export default function ExplorePage() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All Places');
  const [isListOpen, setIsListOpen] = useState(false); 
  
  // Start tracking only after start
  const location = useGeoFence(hasStarted);
  const { pois, setActivePOI, activePOI, history, addToHistory, theme, setIsSettingsOpen, setPOIs, language, isAutoTour, setIsAutoTour } = usePOIStore();
  const [mounted, setMounted] = useState(false);
  const [hasFetchedPOIs, setHasFetchedPOIs] = useState(false);
  
  // Custom center for search
  const [searchCenter, setSearchCenter] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch POIs for a given coordinate
  const fetchPOIsForLocation = async (lat: number, lng: number) => {
    try {
      const res = await fetch('/api/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, language, timestamp: Date.now() })
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.toLowerCase().indexOf("application/json") === -1) {
         throw new Error("API /api/nearby returned non-JSON. This is usually caused by a NextJS Compile Error or Turbopack caching glitch. Please restart your dev server.");
      }
      
      const data = await res.json();
      if (data.pois) {
        setPOIs(data.pois);
        if (data.pois.length > 0) {
          setActivePOI(data.pois[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch POIs", err);
    }
  };

  // Fetch real-world POIs based on GPS (only once initially)
  useEffect(() => {
    if (location.coordinates && !hasFetchedPOIs) {
      setHasFetchedPOIs(true);
      fetchPOIsForLocation(location.coordinates.lat, location.coordinates.lng);
    }
  }, [location.coordinates, hasFetchedPOIs]);

  // Fetch POIs when user searches a new location or changes language
  useEffect(() => {
    if (searchCenter) {
      fetchPOIsForLocation(searchCenter.lat, searchCenter.lng);
    } else if (location.coordinates) {
      fetchPOIsForLocation(location.coordinates.lat, location.coordinates.lng);
    }
  }, [searchCenter, language]);

  // Background GPS check is now handled by useGeoFence hook

  if (!mounted) return null;

  const isMapReady = location.coordinates || searchCenter;

  return (
    <main className={`relative w-full h-[100dvh] overflow-hidden selection:bg-deep-rose/30 transition-colors duration-500 bg-cream text-deep-rose-dark`}>
      
      {!hasStarted && (
        <WelcomeModal 
          onStart={() => {
            setHasStarted(true);
            setIsListOpen(true);
          }} 
        />
      )}

      {/* Floating Header */}
      <div className="absolute top-0 left-0 w-full z-10 p-4 pt-safe pointer-events-none transition-transform duration-500 transform translate-y-0">
        <div className="flex justify-between items-center pointer-events-auto">
          {/* Logo Pill */}
          <div className="bg-white/90 backdrop-blur-xl px-4 py-2 md:px-5 md:py-3 rounded-full border border-pink-200 shadow-lg flex items-center space-x-2 md:space-x-3 shrink-0">
            <Compass className="text-deep-rose w-5 h-5" />
            <h1 className="text-base md:text-lg font-black tracking-tight text-deep-rose-dark hidden sm:block">AuraGuide</h1>
          </div>
          
          {/* Search Bar in Header */}
          {hasStarted && (
            <div className="flex-1 max-w-lg">
              <SearchBar 
                theme={theme}
                onSearch={(lat, lng) => {
                  setSearchCenter({ lat, lng });
                }} 
              />
            </div>
          )}

          {/* Top Actions */}
          <div className="flex space-x-2 md:space-x-3 shrink-0">
            <button 
              onClick={() => setIsAutoTour(!isAutoTour)}
              className={`bg-white/90 backdrop-blur-xl p-3.5 rounded-full border border-pink-200 shadow-lg transition active:scale-95 flex items-center justify-center
                ${isAutoTour ? 'text-white bg-deep-rose border-deep-rose shadow-[0_0_15px_rgba(194,24,91,0.5)]' : 'text-pink-400 hover:text-deep-rose-dark hover:bg-baby-pink'}
              `}
              title={isAutoTour ? "Auto-Tour Enabled" : "Enable Auto-Tour"}
            >
              <RefreshCcw size={18} className={isAutoTour ? "animate-spin-slow" : ""} />
            </button>
            <button 
              onClick={() => setIsListOpen(true)}
              className="bg-white/90 backdrop-blur-xl p-3.5 rounded-full border border-pink-200 shadow-lg text-deep-rose hover:text-deep-rose-dark hover:bg-baby-pink transition active:scale-95"
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`bg-white/90 backdrop-blur-xl p-3.5 rounded-full shadow-lg transition active:scale-95 border border-pink-200 text-deep-rose hover:text-deep-rose-dark hover:bg-baby-pink`}>
              <Settings size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Filtering Options */}
      {hasStarted && (
        <FilterBar activeFilter={activeFilter} setFilter={setActiveFilter} />
      )}

      {/* Main Map or Loading Screen */}
      {hasStarted && (
        isMapReady ? (
          <MapView 
            location={searchCenter ? { loaded: true, coordinates: searchCenter } : location} 
            activeFilter={activeFilter} 
          />
        ) : (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-cream text-deep-rose-dark relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-baby-pink to-cream z-0" />
            <Compass className="animate-spin-slow w-16 h-16 text-deep-rose mb-6 z-10" />
            <p className="font-bold tracking-widest text-xl animate-pulse text-deep-rose z-10">ACQUIRING LIVE GPS...</p>
          </div>
        )
      )}

      {/* Interactive Bottom Audio Deck */}
      {hasStarted && <AudioDeck location={searchCenter ? { loaded: true, coordinates: searchCenter } : location} />}

      {/* Nearby List Drawer */}
      <NearbyList isOpen={isListOpen} onClose={() => setIsListOpen(false)} location={location} searchCenter={searchCenter} />
      
      {/* Settings Modal */}
      <SettingsModal />
    </main>
  );
}

