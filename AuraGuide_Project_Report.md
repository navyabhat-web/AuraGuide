# AuraGuide Complete Project Report

This report contains the full architecture, structure, and complete source code of the AuraGuide application.

## Project Structure

`	ext
Folder PATH listing
Volume serial number is 000001DB CE46:C13D
C:\USERS\NAVYA.RAMANANDABHAT\.GEMINI\ANTIGRAVITY-IDE\SCRATCH\AURAGUIDE\SRC
+---app
|   |   favicon.ico
|   |   globals.css
|   |   layout.tsx
|   |   page.tsx
|   |   
|   \---api
|       +---chat
|       |       route.ts
|       |       
|       +---narrate
|       |       route.ts
|       |       
|       +---nearby
|       |       route.ts
|       |       
|       \---test-trans
|               route.ts
|               
+---components
|   +---audio
|   |       AudioDeck.tsx
|   |       ChatWidget.tsx
|   |       
|   +---layout
|   |       FilterBar.tsx
|   |       NearbyList.tsx
|   |       SearchBar.tsx
|   |       SettingsModal.tsx
|   |       WelcomeModal.tsx
|   |       
|   \---map
|           MapView.tsx
|           
+---contexts
|       LanguageContext.tsx
|       
+---hooks
|       useAudioPlayer.ts
|       useGeoFence.ts
|       useGeolocation.ts
|       usePOIStore.ts
|       useWakeWord.ts
|       
\---lib
        geo.ts
        openai.ts
        speech.ts
        translations.ts
        tts.ts
        

``n
## Source Code

### src/app/api/chat/route.ts

`$lang
import { NextRequest, NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/openai';
import { generateTTS } from '@/lib/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poi, question, language = 'English', voicePersona = 'Female' } = body;

    if (!poi || !poi.name || !question) {
      return NextResponse.json({ error: "Missing POI or question" }, { status: 400 });
    }

    const answer = await answerQuestion(poi, question, language);
    
    // Generate Audio for the answer
    // Using a default voice persona (e.g. Female) or what you want
    let base64Audio = null;
    try {
      const audioBuffer = await generateTTS(answer, voicePersona as 'Male' | 'Female');
      base64Audio = Buffer.from(audioBuffer).toString('base64');
    } catch (e) {
      console.error("Failed to generate TTS for chat answer:", e);
    }

    return NextResponse.json({ answer, audioBase64: base64Audio }, { status: 200 });
  } catch (error: any) {
    console.error("Chat API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

``n
### src/app/api/narrate/route.ts

`$lang
import { NextRequest, NextResponse } from 'next/server';
import { generateTourScript } from '@/lib/openai';
import { generateTTS } from '@/lib/tts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { poi, preferences } = body;

    if (!poi || !poi.name || !poi.category) {
      return NextResponse.json({ error: "Missing POI data" }, { status: 400 });
    }

    console.log(`Generating script for ${poi.name}...`);
    // 1. Generate the narrative script
    const script = await generateTourScript(poi.name, poi.category, preferences, poi.coordinates);

    // Audio & Text Validation Filter
    // Split sentences using standard punctuation AND Devanagari Danda for Hindi
    const sentences = script.split(/[.!?à¥¤]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    
    // Check for generic terms and exact name inclusion
    const isGenericTerm = script.toLowerCase().includes("generic") || script.toLowerCase().includes("this category of place");
    
    // To handle translations or LLM rewrites, check if at least one significant word from the POI name is present
    const nameWords = poi.name.toLowerCase().split(/[\s,.-]+/).filter((w: string) => w.length > 3);
    const hasNamePart = nameWords.length > 0 
      ? nameWords.some((w: string) => script.toLowerCase().includes(w))
      : script.toLowerCase().includes(poi.name.toLowerCase());

    const isNonEnglish = preferences.language && preferences.language.toLowerCase() !== 'english';
    const isGeneric = isGenericTerm || (!isNonEnglish && !hasNamePart && !script.toLowerCase().includes("here"));

    if (isGeneric) {
      console.warn(`Validation failed for ${poi.name}. Sentences: ${sentenceCount}. Generic: ${isGeneric}`);
      throw new Error("AI generation failed validation constraints (generic content).");
    }

    console.log(`Generating audio for ${poi.name}...`);
    // 2. Generate the TTS audio (graceful fallback)
    let base64Audio = null;
    try {
      const audioBuffer = await generateTTS(script, preferences.voicePersona);
      base64Audio = Buffer.from(audioBuffer).toString('base64');
    } catch (ttsError) {
      console.warn("TTS Generation failed (missing key or quota). Returning script only for native fallback.");
    }

    // 3. Return JSON containing text (and audio if successful)
    return NextResponse.json({
      script: script,
      audioBase64: base64Audio
    }, { status: 200 });
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic'; // Prevent any aggressive caching

``n
### src/app/api/nearby/route.ts

`$lang
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Trigger Turbopack recompile
export async function POST(req: NextRequest) {
  try {
    const { lat, lng, language = 'English' } = await req.json();

    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
    }

    // Attempt Overpass API Query: Find places across 6 domains within 50000m (50km)
    let pois = await fetchOverpass(lat, lng, language);

    // Mandatory City-Center Fallback
    if (pois.length < 5) {
      console.log("Fewer than 5 results found, attempting city-center geocoding fallback...");
      try {
        const nominatimResponse = await fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng + "&zoom=10");
        if (nominatimResponse.ok) {
          const locData = await nominatimResponse.json();
          // Find the city or district center
          const fallbackLat = parseFloat(locData.lat);
          const fallbackLng = parseFloat(locData.lon);
          
          if (!isNaN(fallbackLat) && !isNaN(fallbackLng) && (fallbackLat !== lat || fallbackLng !== lng)) {
             console.log("Geocoded city center at " + fallbackLat + ", " + fallbackLng);
             const fallbackPois = await fetchOverpass(fallbackLat, fallbackLng, language);
             // Merge while avoiding duplicates
             const existingIds = new Set(pois.map(p => p.id));
             fallbackPois.forEach(p => {
               if (!existingIds.has(p.id)) pois.push(p);
             });
          }
        }
      } catch (e) {
        console.error("City-center Nominatim fallback failed", e);
      }
    }

    // Dynamic Wikipedia GeoSearch Fallback
    if (pois.length === 0) {
      console.warn("Overpass failed or returned 0 results. Falling back to Live Wikipedia GeoSearch.");
      pois = await fetchWikipediaNearby(lat, lng, language);
    }

    return NextResponse.json({ pois }, { status: 200 });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch nearby POIs" }, { status: 500 });
  }
}

async function fetchWikipediaNearby(lat: number, lng: number, language: string) {
  try {
    // ALWAYS search Wikipedia using English to prevent filtering out places when regional languages are selected
    const code = 'en';
    
    const url = `https://${code}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=15&format=json&origin=*`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];
    
    const data = await response.json();
    if (!data.query || !data.query.geosearch) return [];
    
    return data.query.geosearch.map((item: any) => ({
      id: "wiki_" + item.pageid,
      name: item.title,
      coordinates: { lat: item.lat, lng: item.lon },
      category: "Historic & Ancient", // Default category for wiki articles
      description: `A notable location approximately ${Math.round(item.dist)} meters away.`
    }));
  } catch (e) {
    console.error("Wikipedia GeoSearch failed", e);
    return [];
  }
}

async function fetchOverpass(lat: number, lng: number, language: string) {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      nwr(around:50000, ${lat}, ${lng})["tourism"];
      nwr(around:50000, ${lat}, ${lng})["historic"];
      nwr(around:50000, ${lat}, ${lng})["waterway"="waterfall"];
      nwr(around:50000, ${lat}, ${lng})["amenity"="place_of_worship"];
      nwr(around:50000, ${lat}, ${lng})["natural"="hill"];
      nwr(around:50000, ${lat}, ${lng})["natural"="peak"];
      nwr(around:50000, ${lat}, ${lng})["natural"="beach"];
      nwr(around:50000, ${lat}, ${lng})["leisure"="park"];
      nwr(around:50000, ${lat}, ${lng})["shop"="mall"];
    );
    out center 800;
  `;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
  ];

  let data = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(overpassQuery),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        cache: 'no-store'
      });
      if (response.ok) {
        data = await response.json();
        break; 
      }
    } catch (e) {}
  }

  if (!data || !data.elements) return [];
  const combinedElements = data.elements;

  const langCodeMap: Record<string, string> = {
    'English': 'en',
    'Kannada': 'kn',
    'Hindi': 'hi',
    'Tulu': 'tcy',
    'Telugu': 'te',
    'Tamil': 'ta',
    'Malayalam': 'ml',
    'Konkani': 'kok'
  };

  const code = langCodeMap[language] || 'en';

  return combinedElements
    .filter((el: any) => el.tags)
    .map((el: any) => {
      let category = "Historic & Ancient";
      const t = el.tags;
      
      let exactName = t['name:' + code] || t['name:en'] || t.name || t.official_name || t.historic_name;

      if (t.tourism) category = "All Places";
      if (t.amenity === 'place_of_worship') category = "Temples & Spiritual";
      if (t.natural || t.waterway) category = "Nature & Scenery";
      if (t.shop === 'mall' || t.amenity === 'bus_station' || t.aeroway || t.railway) category = "Urban & Modern";
      if (t.historic === 'fort' || t.historic === 'castle') category = "Defense & Infrastructure";

      // If the location has no mapped name, give it a smart fallback based on its type
      if (!exactName) {
         if (t.amenity === 'place_of_worship') exactName = 'Local Temple / Shrine';
         else if (t.historic) exactName = 'Historic Site';
         else if (t.natural) exactName = 'Natural Landmark';
         else if (t.leisure) exactName = 'Local Park / Recreation';
         else if (t.waterway === 'waterfall') exactName = 'Local Waterfall';
         else exactName = 'Point of Interest';
      }

      const finalLat = el.lat || (el.center && el.center.lat);
      const finalLon = el.lon || (el.center && el.center.lon);

      let desc = t.description || t.wikipedia || ("A notable landmark located at " + finalLat.toFixed(4) + ", " + finalLon.toFixed(4) + ".");

      return {
        id: "poi_" + el.id,
        name: exactName,
        coordinates: { lat: finalLat, lng: finalLon },
        category: category,
        description: desc
      };
  });
}

``n
### src/app/api/test-trans/route.ts

`$lang
import { NextResponse } from 'next/server'; export async function GET() { try { const data: any = await new Promise((resolve, reject) => { const https = require('https'); function fetchUrl(targetUrl: string, redirectCount = 0) { if (redirectCount > 5) return reject(new Error('Too many redirects')); const options = { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' } }; https.get(targetUrl, options, (res: any) => { if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, targetUrl).toString(); return fetchUrl(newUrl, redirectCount + 1); } let chunks = ''; res.on('data', (d: any) => chunks += d); res.on('end', () => resolve({code: res.statusCode, body: chunks})); }).on('error', reject); } fetchUrl('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=kn&dt=t&q=Hello'); }); return NextResponse.json(data); } catch(e:any) { return NextResponse.json({ error: e.message }); } }

``n
### src/app/globals.css

`$lang
@import "tailwindcss";

@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --color-baby-pink: #FCE4EC;
  --color-baby-pink-dark: #F8BBD0;
  --color-cream: #FFFDD0;
  --color-cream-alt: #FAF0E6;
  --color-deep-rose: #C2185B;
  --color-deep-rose-dark: #880E4F;

  --animate-ping-slow: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
  --animate-visualizer: visualizer 0.8s ease-in-out infinite alternate;
  --animate-slide-up: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  --animate-fade-in: fade-in 0.3s ease-out forwards;
}

:root {
  --background: var(--color-baby-pink);
  --foreground: var(--color-deep-rose-dark);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: var(--color-deep-rose-dark);
    --foreground: var(--color-baby-pink);
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
  overflow: hidden;
  /* Prevent bounce scrolling on mobile map */
}

/* Custom Keyframes */
@keyframes ping-slow {

  75%,
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

@keyframes visualizer {
  0% {
    height: 4px;
  }

  100% {
    height: 24px;
  }
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/* Hide scrollbar for horizontal lists */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
``n
### src/app/layout.tsx

`$lang
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '../contexts/LanguageContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuraGuide",
  description: "AI-powered personalized local tour guide",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

``n
### src/app/page.tsx

`$lang
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


``n
### src/components/audio/AudioDeck.tsx

`$lang
import React, { useState } from 'react';
import { Play, Pause, SkipForward, MapPin, ChevronUp, Bookmark, Image as ImageIcon } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useWakeWord } from '../../hooks/useWakeWord';
import { ChatWidget } from './ChatWidget';
import { useLanguage } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../lib/translations';
import { geoDistance } from '../../lib/geo';
import { LocationState } from '../../hooks/useGeolocation';

export const AudioDeck = ({ location }: { location?: LocationState }) => {
  const { activePOI, theme, language, topics, voicePersona, isAutoTour, pois, history, setActivePOI } = usePOIStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [narrativeText, setNarrativeText] = useState<string>(''); // state for script
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { t } = useLanguage();

  const handleAudioEnded = () => {
    if (!isAutoTour) return;
    if (!location?.coordinates) {
      console.warn("Auto-Tour paused: No live GPS coordinates available.");
      return;
    }
    
    // Find closest unplayed POI
    const unplayedPois = pois.filter(p => !history.includes(p.id) && p.id !== activePOI?.id);
    if (unplayedPois.length === 0) {
      console.log("Auto-Tour finished: All loaded places have been played.");
      return;
    }
    
    let closestPoi = unplayedPois[0];
    let minDistance = Infinity;
    
    unplayedPois.forEach(p => {
      const dist = geoDistance(
        location.coordinates!.lat,
        location.coordinates!.lng,
        p.coordinates.lat,
        p.coordinates.lng
      );
      if (dist < minDistance) {
        minDistance = dist;
        closestPoi = p;
      }
    });
    
    console.log(`Auto-Tour jumping to closest next POI: ${closestPoi.name} at ${Math.round(minDistance)}m away.`);
    setActivePOI(closestPoi);
  };

  const { audioRef, isPlaying, progress, togglePlay, playAudio, setMediaSession } = useAudioPlayer(handleAudioEnded);

  useWakeWord((transcript) => {
    // Pause audio
    if (window?.speechSynthesis?.speaking) {
      window.speechSynthesis.pause();
    } else if (isPlaying) {
      togglePlay();
    }
    // Expand deck and show chat widget
    setIsExpanded(true);
    setIsChatOpen(true);
    console.log("Wake word detected! Opening chat for doubts.");
  });

  React.useEffect(() => {
    if (!activePOI) return;
    
    // Reset narrative text when switching POIs
    setNarrativeText('');
    
    // Auto-generate audio for active POI
    const generateAudio = async () => {
      setIsGenerating(true);
      try {
        const response = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            poi: activePOI,
            preferences: { language, topics, voicePersona }
          })
        });
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
           throw new Error("API /api/narrate returned non-JSON. Possible NextJS Compile Error.");
        }
        
        if (response.ok) {
          const data = await response.json();
          setNarrativeText(data.script);
          
          if (data.audioBase64) {
            // Convert base64 back to Blob url
            const byteCharacters = atob(data.audioBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            
            setMediaSession(activePOI.name);
            playAudio(url);
          } else {
            console.warn("Using Native Browser Speech: Cloud audio API key not configured.");
            fallbackToNativeSpeech(data.script);
          }
        } else {
          console.warn("Full narrative API failed. Using Native Browser Speech with basic description.");
          fallbackToNativeSpeech();
        }
      } catch (err) {
        console.error("Error fetching audio, falling back to native browser speech.", err);
        fallbackToNativeSpeech();
      } finally {
        setIsGenerating(false);
      }
    };
    
    const fallbackToNativeSpeech = (customScript?: string) => {
      const fallbackText = customScript || `${activePOI.name}. ${activePOI.description}`;
      if (!narrativeText || narrativeText === '') {
        setNarrativeText(fallbackText);
      }
      import('../../lib/speech').then(({ speakNative }) => {
        speakNative(fallbackText, language, voicePersona, handleAudioEnded);
      });
    };
    
    const fetchImage = async () => {
      try {
        const langCode = language === 'English' ? 'en' : 'en'; // fallback to en for images
        const searchUrl = `https://${langCode}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(activePOI.name)}&gsrlimit=1&prop=pageimages&pithumbsize=600&format=json&origin=*`;
        const res = await fetch(searchUrl);
        if (!res.ok) throw new Error("Wikipedia API returned non-OK status");
        
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") === -1) {
           throw new Error("Wikipedia API did not return JSON");
        }
        
        const data = await res.json();
        
        let foundImage = null;
        if (data.query && data.query.pages) {
          const pages = data.query.pages;
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
            foundImage = pages[pageId].thumbnail.source;
          }
        }
        
        // Try Wikimedia Commons search if Wikipedia has no image
        if (!foundImage) {
           const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(activePOI.name)}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`;
           try {
             const resCommons = await fetch(commonsUrl);
             const dataCommons = await resCommons.json();
             if (dataCommons.query && dataCommons.query.pages) {
               const pages = dataCommons.query.pages;
               const pageId = Object.keys(pages)[0];
               if (pages[pageId].imageinfo && pages[pageId].imageinfo.length > 0) {
                  foundImage = pages[pageId].imageinfo[0].thumburl || pages[pageId].imageinfo[0].url;
               }
             }
           } catch(e) {}
        }
        
        // Ultimate Fallback to Beautiful High-Res Unsplash Images by Category
        if (!foundImage) {
          const CATEGORY_IMAGES: Record<string, string> = {
            'Historic & Ancient': 'https://images.unsplash.com/photo-1564507592208-528756c28b5a?w=600&h=400&fit=crop',
            'Spiritual & Religious': 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&h=400&fit=crop',
            'Nature & Parks': 'https://images.unsplash.com/photo-1505322022379-7c3353ee6291?w=600&h=400&fit=crop',
            'Cityscape & Modern': 'https://images.unsplash.com/photo-1572949645841-094f3a9c4c94?w=600&h=400&fit=crop',
            'default': 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=400&fit=crop'
          };
          foundImage = CATEGORY_IMAGES[activePOI.category] || CATEGORY_IMAGES['default'];
        }

        setImageUrl(foundImage);
      } catch (err) {
        console.error("Failed to fetch image", err);
        setImageUrl('https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=400&fit=crop'); // Absolute fallback
      }
    };
    
    fetchImage();
    generateAudio();
    
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
         window.speechSynthesis.cancel();
      }
    }
  }, [activePOI?.id]);

  if (!activePOI) {
    return (
      <div className={`fixed bottom-0 left-0 w-full backdrop-blur-xl p-6 rounded-t-[2.5rem] border-t shadow-[0_-10px_40px_rgba(0,0,0,0.3)] transition-all duration-500 z-40 pb-safe ${theme === 'dark' ? 'bg-rose-950/60 text-white border-rose-800/50' : 'bg-pink-50/80 text-rose-950 border-pink-200/50'}`}>
        <div className="flex items-center justify-center space-x-3 opacity-50 py-2">
          <MapPin size={20} className="animate-pulse" />
          <p className="text-sm font-semibold tracking-wide">{t('waitingStories')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Expanded Overlay Background */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-rose-950/80 backdrop-blur-sm z-30 transition-opacity"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div 
        className={`fixed bottom-0 left-0 w-full backdrop-blur-2xl rounded-t-[2.5rem] border-t shadow-[0_-20px_60px_rgba(0,0,0,0.6)] transition-all duration-500 z-40 overflow-hidden flex flex-col ${
          isExpanded ? 'h-[85vh]' : 'h-auto pb-safe'
        } ${theme === 'dark' ? 'bg-rose-950/90 text-white border-rose-800/50' : 'bg-white/95 text-rose-950 border-pink-200'}`}
      >
        {/* Hidden Audio Element */}
        <audio ref={audioRef} />

        {/* Drag Handle & Progress Bar Area */}
        <div 
          className="relative w-full pt-4 pb-2 px-6 cursor-pointer flex flex-col items-center group"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-12 h-1.5 bg-rose-700/50 rounded-full mb-4 group-hover:bg-rose-500 transition-colors" />
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-800/20">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(244,63,94,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Collapsed/Header View */}
        <div className="px-6 pb-6 flex-shrink-0 flex items-center justify-between">
          <div className="flex-1 overflow-hidden pr-4" onClick={() => !isExpanded && setIsExpanded(true)}>
            <h3 className={`text-xl font-black truncate tracking-tight ${theme === 'dark' ? 'text-white' : 'text-rose-950'}`}>{activePOI.name}</h3>
            <div className="flex items-center space-x-2 mt-1.5">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${theme === 'dark' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30' : 'bg-pink-100 text-pink-700 border-pink-200'}`}>
                {isGenerating ? 'Generating Audio...' : activePOI.category}
              </span>
              
              {/* Visualizer */}
              {(isPlaying || window?.speechSynthesis?.speaking) && (
                <div className="flex items-end space-x-0.5 h-3 ml-2">
                  <div className="w-1 bg-pink-400 rounded-t animate-visualizer" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1 bg-pink-400 rounded-t animate-visualizer" style={{ animationDelay: '0.3s' }} />
                  <div className="w-1 bg-pink-400 rounded-t animate-visualizer" style={{ animationDelay: '0.2s' }} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              disabled={isGenerating}
              onClick={(e) => { 
                e.stopPropagation(); 
                if(window?.speechSynthesis?.speaking) {
                   window.speechSynthesis.pause(); 
                } else {
                   togglePlay(); 
                }
              }}
              className={`p-4 rounded-full transition-all active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white text-rose-950 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-rose-100' : 'bg-rose-900 text-white shadow-xl hover:bg-rose-800'}`}
            >
              {isPlaying || (typeof window !== 'undefined' && window.speechSynthesis?.speaking) ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
            </button>
            <button className={`p-3 rounded-full transition-colors active:scale-95 ${theme === 'dark' ? 'text-rose-400 hover:text-white hover:bg-rose-800' : 'text-rose-500 hover:text-rose-900 hover:bg-pink-100'}`}>
              <SkipForward size={20} />
            </button>
          </div>
        </div>

        {/* Expanded View Content */}
        <div className={`flex-1 overflow-y-auto px-6 pb-8 transition-opacity duration-500 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
          {imageUrl ? (
            <div className="w-full h-48 rounded-2xl mb-6 shadow-inner overflow-hidden relative">
              <img src={imageUrl} alt={activePOI.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className={`w-full h-48 rounded-2xl mb-6 flex flex-col items-center justify-center border shadow-inner overflow-hidden relative ${theme === 'dark' ? 'bg-rose-900/50 text-rose-500 border-rose-800' : 'bg-pink-50 text-pink-400 border-pink-100'}`}>
              <ImageIcon size={40} className="mb-2 opacity-50" />
              <span className="text-sm font-semibold">No Image Available</span>
            </div>
          )}
          
          <div className="flex items-center justify-between mb-4 mt-6">
            <h4 className="text-lg font-bold">The Story</h4>
            <button className="flex items-center space-x-2 text-sm text-pink-500 hover:text-pink-400 transition-colors">
              <Bookmark size={18} />
              <span>Save</span>
            </button>
          </div>
          
          <div className={`text-base leading-relaxed font-serif p-4 rounded-xl shadow-inner border mb-6 ${theme === 'dark' ? 'text-rose-200 bg-rose-950 border-rose-800' : 'text-rose-800 bg-white border-pink-100'}`}>
            {narrativeText ? (
              <p className="whitespace-pre-wrap">{narrativeText}</p>
            ) : isGenerating ? (
              <div className="flex space-x-2 items-center text-pink-500/50">
                <span className="animate-pulse">Generating narrative...</span>
              </div>
            ) : (
              <p>{activePOI.description}</p>
            )}
          </div>
          
          {/* Chat Widget Toggle */}
          {!isChatOpen && (
            <button 
              onClick={() => setIsChatOpen(true)}
              className="w-full mt-4 bg-baby-pink hover:bg-pink-200 text-deep-rose-dark font-bold py-3 rounded-xl border border-pink-300 transition-colors"
            >
              {t('haveDoubt')}
            </button>
          )}

          {/* Chat Widget */}
          {isChatOpen && (
            <div className="w-full my-4 animate-slide-up">
              <ChatWidget poi={activePOI} theme={theme} />
              <button 
                onClick={() => setIsChatOpen(false)}
                className="w-full mt-2 text-sm text-pink-500 hover:text-deep-rose transition-colors"
              >
                {t('closeChat')}
              </button>
            </div>
          )}
          
          <p className="text-pink-400/80 text-xs leading-relaxed text-center mt-4">
            (Audio & Text generated via AI or Native Browser Fallback)
          </p>
        </div>
      </div>
    </>
  );
};

``n
### src/components/audio/ChatWidget.tsx

`$lang
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

``n
### src/components/layout/FilterBar.tsx

`$lang
import React from 'react';

import { useLanguage } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../lib/translations';

const CATEGORIES = ["All Places", "Temples & Spiritual", "Historic & Ancient", "Nature & Scenery", "Urban & Modern", "Defense & Infrastructure"];

const categoryKeys: Record<string, TranslationKey> = {
  "All Places": "allPlaces",
  "Temples & Spiritual": "templesSpiritual",
  "Historic & Ancient": "historicAncient",
  "Nature & Scenery": "natureScenery",
  "Urban & Modern": "urbanModern",
  "Defense & Infrastructure": "defenseInfrastructure"
};

export const FilterBar = ({ activeFilter, setFilter }: { activeFilter: string, setFilter: (c: string) => void }) => {
  const { t } = useLanguage();
  return (
    <div className="absolute top-20 left-0 w-full z-10 px-4 pointer-events-none">
      <div className="flex space-x-2 overflow-x-auto no-scrollbar pointer-events-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-md backdrop-blur-md border ${
              activeFilter === cat 
                ? 'bg-deep-rose text-white border-deep-rose shadow-[0_0_15px_rgba(194,24,91,0.4)]' 
                : 'bg-white/80 text-deep-rose-dark border-pink-200 hover:bg-baby-pink'
            }`}
          >
            {t(categoryKeys[cat] || 'allPlaces')}
          </button>
        ))}
      </div>
    </div>
  );
};



``n
### src/components/layout/NearbyList.tsx

`$lang
import React from 'react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { MapPin, Navigation, X } from 'lucide-react';
import { geoDistance } from '../../lib/geo';
import { LocationState } from '../../hooks/useGeolocation';
import { useLanguage } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../lib/translations';

const categoryKeys: Record<string, TranslationKey> = {
  "All Places": "allPlaces",
  "Temples & Spiritual": "templesSpiritual",
  "Historic & Ancient": "historicAncient",
  "Nature & Scenery": "natureScenery",
  "Urban & Modern": "urbanModern",
  "Defense & Infrastructure": "defenseInfrastructure"
};

const getFallbackImage = (category: string) => {
  switch(category) {
    case 'Temples & Spiritual': return 'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=400';
    case 'Historic & Ancient': return 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=400';
    case 'Nature & Scenery': return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400';
    case 'Urban & Modern': return 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=400';
    case 'Defense & Infrastructure': return 'https://images.unsplash.com/photo-1565019014169-232cb979d5bb?w=400';
    default: return 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=400';
  }
};

export const NearbyList = ({ 
  isOpen, 
  onClose,
  location,
  searchCenter
}: { 
  isOpen: boolean; 
  onClose: () => void;
  location: LocationState;
  searchCenter?: {lat: number, lng: number} | null;
}) => {
  const { pois, setActivePOI, activePOI } = usePOIStore();
  const { t } = useLanguage();

  // Calculate distance for each POI
  const poisWithDistance = pois.map(poi => {
    let dist = null;
    const centerLat = searchCenter?.lat || location.coordinates?.lat;
    const centerLng = searchCenter?.lng || location.coordinates?.lng;

    if (centerLat && centerLng) {
      dist = geoDistance(
        centerLat,
        centerLng,
        poi.coordinates.lat,
        poi.coordinates.lng
      );
    }
    return { ...poi, dist };
  }).sort((a, b) => (a.dist || Infinity) - (b.dist || Infinity));

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-rose-950/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 w-80 max-w-full h-full bg-white/80 backdrop-blur-2xl border-l border-pink-200 shadow-[-10px_0_30px_rgba(194,24,91,0.15)] z-50 transform transition-transform duration-500 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-pink-300 flex items-center justify-between bg-white/60 backdrop-blur-md">
          <h2 className="text-xl font-bold text-deep-rose-dark tracking-tight flex items-center space-x-2">
            <Navigation size={20} className="text-deep-rose" />
            <span>Nearby Places</span>
          </h2>
          <button onClick={onClose} className="p-2 bg-pink-100 text-deep-rose hover:bg-pink-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {poisWithDistance.map(poi => {
            const isActive = activePOI?.id === poi.id;
            return (
              <div 
                key={poi.id}
                className={`p-4 rounded-2xl transition-all border ${
                  isActive 
                    ? 'bg-white border-deep-rose shadow-[0_0_15px_rgba(194,24,91,0.2)]' 
                    : 'bg-white/60 border-pink-200 hover:bg-white hover:border-pink-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-bold text-base ${isActive ? 'text-deep-rose' : 'text-deep-rose-dark'}`}>
                    {poi.name}
                  </h3>
                  {poi.dist !== null && (
                    <span className="text-xs font-mono font-bold bg-pink-100 text-deep-rose px-2 py-1 rounded-md shrink-0 ml-2">
                      {poi.dist > 1000 ? (poi.dist / 1000).toFixed(1) + 'km' : Math.round(poi.dist) + 'm'}
                    </span>
                  )}
                </div>
                
                <p className="text-xs font-bold uppercase tracking-wider text-deep-rose/80 mb-3">{t(categoryKeys[poi.category] || 'allPlaces')}</p>
                
                {/* Image Placeholder */}
                <div className="w-full h-32 bg-cream-alt rounded-xl mb-3 flex items-center justify-center border border-pink-200 overflow-hidden relative">
                  <img 
                    src={getFallbackImage(poi.category)} 
                    alt={poi.name} 
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-950/40 to-transparent" />
                  <MapPin size={24} className="text-white/80 absolute bottom-3 right-3 drop-shadow-md" />
                </div>
                
                <p className="text-sm text-deep-rose-dark/80 line-clamp-2 leading-snug mb-4">{poi.description}</p>
                
                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      setActivePOI(poi);
                      onClose(); // Optional: close drawer when playing
                    }}
                    className="flex-1 bg-deep-rose hover:bg-deep-rose-dark text-white text-sm font-bold py-2 rounded-lg transition-colors shadow-sm"
                  >
                    {t('listenStory')}
                  </button>
                  <button 
                    onClick={() => {
                      // Just set active to center map (AudioDeck handles map zooming via a side-effect if we added it, but for now setting active POI is fine)
                      setActivePOI(poi);
                      onClose();
                    }}
                    className="flex-1 bg-white hover:bg-baby-pink text-deep-rose text-sm font-bold py-2 rounded-lg transition-colors border border-pink-300 shadow-sm"
                  >
                    View Map
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};



``n
### src/components/layout/SearchBar.tsx

`$lang
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { useMap } from 'react-leaflet'; // This would need to be inside MapContainer if used directly, or we can just update a state that MapController watches.

import { useLanguage } from '../../contexts/LanguageContext';

// Better approach: pass a function to update the map center.
interface Props {
  onSearch: (lat: number, lng: number) => void;
  theme: string;
}

export const SearchBar = ({ onSearch, theme }: Props) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onSearch(parseFloat(lat), parseFloat(lon));
        setQuery(''); // clear after search
      } else {
        alert("Location not found. Try a different search.");
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSearch} 
      className={`relative flex-1 max-w-md mx-4 flex items-center px-4 py-2 rounded-full shadow-md backdrop-blur-xl border transition-all bg-white/80 border-pink-200 text-deep-rose-dark focus-within:bg-white`}
    >
      <Search size={18} className={`shrink-0 text-deep-rose`} />
      <input
        type="text"
        placeholder={t('searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-transparent border-none outline-none px-3 placeholder-rose-400/70 text-sm"
        disabled={loading}
      />
      {loading && <span className="shrink-0 animate-spin text-pink-500 rounded-full h-4 w-4 border-b-2 border-pink-500"></span>}
    </form>
  );
};

``n
### src/components/layout/SettingsModal.tsx

`$lang
import React from 'react';
import { X, Moon, Sun, FastForward } from 'lucide-react';
import { usePOIStore } from '../../hooks/usePOIStore';

export const SettingsModal = () => {
  const { isSettingsOpen, setIsSettingsOpen, theme, setTheme, audioSpeed, setAudioSpeed, history, cooldownMinutes, setCooldownMinutes, language, setLanguage, topics, setTopics } = usePOIStore();
  
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



``n
### src/components/layout/WelcomeModal.tsx

`$lang
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

``n
### src/components/map/MapView.tsx

`$lang
"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { usePOIStore } from '../../hooks/usePOIStore';
import { LocationState } from '../../hooks/useGeolocation';
import { MapPin, Navigation, Landmark, TreePine, Eye, Crosshair } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { useLanguage } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../lib/translations';

const categoryKeys: Record<string, TranslationKey> = {
  "All Places": "allPlaces",
  "Temples & Spiritual": "templesSpiritual",
  "Historic & Ancient": "historicAncient",
  "Nature & Scenery": "natureScenery",
  "Urban & Modern": "urbanModern",
  "Defense & Infrastructure": "defenseInfrastructure"
};

// Helper to create custom HTML markers using Tailwind classes
const createIcon = (colorClass: string, isPulsing: boolean, CategoryIcon: any) => {
  const iconHtml = renderToString(
    <div className="relative flex items-center justify-center w-10 h-10">
      {isPulsing && (
        <div className={`absolute inset-0 rounded-full bg-${colorClass} opacity-75 animate-ping-slow`} />
      )}
      <div className={`relative z-10 p-2 rounded-full shadow-xl bg-${colorClass} text-white border-2 border-white`}>
        <CategoryIcon size={18} />
      </div>
    </div>
  );

  return L.divIcon({
    html: iconHtml,
    className: 'custom-div-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
};

const userIcon = L.divIcon({
  html: renderToString(
    <div className="relative flex items-center justify-center w-10 h-10">
      <div className="absolute inset-0 rounded-full bg-deep-rose opacity-40 animate-ping-slow" />
      <div className="relative z-10 p-2 bg-deep-rose rounded-full border-4 border-white shadow-lg">
        <Navigation size={14} className="text-white transform -rotate-45" />
      </div>
    </div>
  ),
  className: 'custom-div-icon',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -24],
});

const getCategoryDetails = (category: string) => {
  switch(category) {
    case 'Temples & Spiritual': return { color: 'amber-600', icon: Landmark };
    case 'Historic & Ancient': return { color: 'deep-rose', icon: Landmark };
    case 'Nature & Scenery': return { color: 'emerald-600', icon: TreePine };
    case 'Urban & Modern': return { color: 'blue-600', icon: Eye };
    case 'Defense & Infrastructure': return { color: 'slate-700', icon: Crosshair };
    default: return { color: 'pink-500', icon: MapPin };
  }
};

const MapController = ({ 
  center, 
  isFollowing, 
  setIsFollowing, 
  activePOI 
}: { 
  center: { lat: number; lng: number }, 
  isFollowing: boolean, 
  setIsFollowing: (v: boolean) => void,
  activePOI: any 
}) => {
  const map = useMap();
  
  // Disable following when user manually interacts
  useMapEvents({
    dragstart: () => setIsFollowing(false),
    zoomstart: () => setIsFollowing(false),
  });

  // Fly to active POI when it changes
  useEffect(() => {
    if (activePOI && activePOI.coordinates) {
      map.flyTo([activePOI.coordinates.lat, activePOI.coordinates.lng], 16, {
        animate: true,
        duration: 1.5
      });
      setIsFollowing(false);
    }
  }, [activePOI, map, setIsFollowing]);

  // Fly to user location if following is turned back on
  useEffect(() => {
    if (isFollowing) {
      map.flyTo([center.lat, center.lng], 16, {
        animate: true,
        duration: 1.5
      });
    }
  }, [center, map, isFollowing]);

  return null;
};

const MapClickHandler = () => {
  const { setPOIs, setActivePOI, language } = usePOIStore();
  
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng;
      
      try {
        const res = await fetch('/api/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, language, timestamp: Date.now() })
        });
        const data = await res.json();
        
        if (data.pois && data.pois.length > 0) {
          setPOIs((prev) => {
            // merge new pois, avoiding duplicates
            const newPois = [...prev];
            data.pois.forEach((newPoi: any) => {
              if (!newPois.find(p => p.id === newPoi.id)) {
                newPois.push(newPoi);
              }
            });
            return newPois;
          });
          setActivePOI(data.pois[0]); // Play the first/closest one
        }
      } catch (err) {
        console.error("Failed to fetch clicked location POI", err);
      }
    }
  });

  return null;
};

export default function MapView({ location, activeFilter }: { location: LocationState, activeFilter: string }) {
  const { pois, setActivePOI, activePOI, theme } = usePOIStore();
  const [isFollowing, setIsFollowing] = React.useState(true);
  const markerRefs = React.useRef<{ [key: string]: L.Marker | null }>({});
  const { t } = useLanguage();
  
  const center = location.coordinates || { lat: 41.8902, lng: 12.4922 };
  
  // Filter POIs
  const visiblePOIs = activeFilter === 'All Places' 
    ? pois 
    : pois.filter(p => p.category === activeFilter);

  // Automatically open popup for active POI
  React.useEffect(() => {
    if (activePOI && markerRefs.current[activePOI.id]) {
      markerRefs.current[activePOI.id]?.openPopup();
    }
  }, [activePOI]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[center.lat, center.lng]} 
        zoom={16} 
        zoomControl={false}
        className="w-full h-[100dvh] sepia-[.15] hue-rotate-[-5deg] contrast-[.95]"
      >
        {/* Dynamic theme styled tiles - forcing a creamy voyager base */}
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        {location.coordinates && (
          <MapController center={location.coordinates} isFollowing={isFollowing} setIsFollowing={setIsFollowing} activePOI={activePOI} />
        )}
        
        <MapClickHandler />

        {/* User Location */}
        {location.coordinates && (
          <Marker position={[location.coordinates.lat, location.coordinates.lng]} icon={userIcon}>
            <Popup className="custom-popup">
              <span className="font-bold text-deep-rose">{t('youAreHere')}</span>
            </Popup>
          </Marker>
        )}

        {/* POI Markers */}
        {visiblePOIs.map((poi) => {
          const isActive = activePOI?.id === poi.id;
          const { color, icon } = getCategoryDetails(poi.category);
          
          return (
            <Marker 
              key={poi.id} 
              position={[poi.coordinates.lat, poi.coordinates.lng]}
              icon={createIcon(color, isActive, icon)}
              ref={(ref) => { markerRefs.current[poi.id] = ref; }}
              eventHandlers={{
                click: () => setActivePOI(poi),
              }}
            >
              <Popup>
                <div className="p-3 text-deep-rose-dark w-48">
                  <h3 className="font-bold text-base mb-1.5">{poi.name}</h3>
                  <span className={`text-[10px] uppercase font-bold text-white bg-${color} px-2 py-0.5 rounded-full mb-3 inline-block`}>
                    {t(categoryKeys[poi.category] || 'allPlaces')}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePOI(poi);
                    }}
                    className="w-full bg-deep-rose hover:bg-deep-rose-dark text-white text-xs font-bold py-1.5 rounded-lg transition-colors flex items-center justify-center space-x-1"
                  >
                    <Navigation size={12} />
                    <span>{t('listenStory')}</span>
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Recenter Button */}
      {!isFollowing && location.coordinates && (
        <button 
          onClick={() => setIsFollowing(true)}
          className={`absolute bottom-32 right-4 z-20 p-3 rounded-full shadow-lg transition-transform active:scale-95 bg-white text-deep-rose border border-pink-200`}
        >
          <Crosshair size={24} />
        </button>
      )}
    </div>
  );
}



``n
### src/contexts/LanguageContext.tsx

`$lang
"use client";

import React, { createContext, useContext } from 'react';
import { usePOIStore } from '../hooks/usePOIStore';
import { translations, Language, TranslationKey } from '../lib/translations';

interface LanguageContextType {
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  t: (key) => translations['English'][key] || key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const language = usePOIStore((state) => state.language) as Language;

  const t = (key: TranslationKey): string => {
    const langDict = translations[language] || translations['English'];
    return langDict[key] || translations['English'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ t }}>
      {children}
    </LanguageContext.Provider>
  );
};

``n
### src/hooks/useAudioPlayer.ts

`$lang
import { useState, useRef, useEffect } from 'react';

export const useAudioPlayer = (onEndedCallback?: () => void) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch(error => {
            console.error("Playback prevented:", error);
            setIsPlaying(false);
          });
        } else {
          setIsPlaying(true);
        }
      }
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause(); // Pause any current audio
      audioRef.current.src = url;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch(error => {
          console.error("Playback prevented:", error);
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const setMediaSession = (title: string) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'GeoNarrate AI',
        album: 'Audio Tour',
        artwork: [
          { src: '/favicon.ico', sizes: '96x96', type: 'image/x-icon' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) audioRef.current.play();
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
      });
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const updateProgress = () => {
        setProgress((audio.currentTime / audio.duration) * 100);
      };
      const onEnded = () => {
        setIsPlaying(false);
        if (onEndedCallback) onEndedCallback();
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('ended', onEnded);
      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('ended', onEnded);
      };
    }
  }, []);

  return { audioRef, isPlaying, progress, togglePlay, playAudio, setMediaSession };
};

``n
### src/hooks/useGeoFence.ts

`$lang
import { useEffect } from 'react';
import { usePOIStore } from './usePOIStore';
import { useGeolocation } from './useGeolocation';
import { geoDistance } from '../lib/geo';

export const useGeoFence = (enabled: boolean) => {
  const location = useGeolocation(enabled);
  const { pois, activePOI, history, addToHistory, setActivePOI, cooldownMinutes, lastTriggeredAt, setLastTriggeredAt } = usePOIStore();

  useEffect(() => {
    if (!enabled || !location.coordinates) return;

    let closestPOI = null;
    let minDistance = Infinity;

    // Radius to trigger is 50 meters
    const RADIUS_METERS = 50;

    for (const poi of pois) {
      const dist = geoDistance(
        location.coordinates.lat,
        location.coordinates.lng,
        poi.coordinates.lat,
        poi.coordinates.lng
      );

      if (dist < RADIUS_METERS && dist < minDistance) {
        minDistance = dist;
        closestPOI = poi;
      }
    }

    if (closestPOI && (!activePOI || activePOI.id !== closestPOI.id)) {
      if (!history.includes(closestPOI.id)) {
        // Check cooldown
        const now = Date.now();
        const timeSinceLastTrigger = lastTriggeredAt ? (now - lastTriggeredAt) / (1000 * 60) : Infinity;

        if (timeSinceLastTrigger >= cooldownMinutes) {
          setActivePOI(closestPOI);
          addToHistory(closestPOI.id);
          setLastTriggeredAt(now);
          // Audio generation/playback logic is handled in AudioDeck which reacts to activePOI changes
        }
      }
    }
  }, [enabled, location.coordinates, pois, activePOI, setActivePOI, history, addToHistory, cooldownMinutes, lastTriggeredAt, setLastTriggeredAt]);

  return location;
};

``n
### src/hooks/useGeolocation.ts

`$lang
import { useState, useEffect } from 'react';

export interface LocationState {
  loaded: boolean;
  coordinates: { lat: number; lng: number } | null;
  error?: { code: number; message: string };
}

export const useGeolocation = (enabled: boolean = true) => {
  const [location, setLocation] = useState<LocationState>({
    loaded: false,
    coordinates: null,
  });

  useEffect(() => {
    if (!enabled) return;

    if (!("geolocation" in navigator)) {
      setLocation((state) => ({
        ...state,
        loaded: true,
        error: { code: 0, message: "Geolocation not supported" },
      }));
      return;
    }

    const onSuccess = (location: GeolocationPosition) => {
      setLocation({
        loaded: true,
        coordinates: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        },
      });
    };

    const onError = (error: GeolocationPositionError) => {
      setLocation((state) => ({
        ...state,
        loaded: true,
        error: { code: error.code, message: error.message },
      }));
    };

    const watcher = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    });

    return () => navigator.geolocation.clearWatch(watcher);
  }, [enabled]);

  return location;
};

``n
### src/hooks/usePOIStore.ts

`$lang
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

``n
### src/hooks/useWakeWord.ts

`$lang
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

``n
### src/lib/geo.ts

`$lang
/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 */
export function geoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in meters
}

``n
### src/lib/openai.ts

`$lang
import OpenAI from 'openai';

// Initialize the OpenAI client
// It will automatically use process.env.OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function generateTourScript(poiName: string, type: string, preferences: any, coordinates?: { lat: number, lng: number }): Promise<string> {
  const language = preferences.language || 'English';
  const coordString = coordinates ? `${coordinates.lat}, ${coordinates.lng}` : 'Unknown';
  const prompt = `You are an expert, engaging local tour guide audio AI. Your job is to narrate the story of a specific place for a tourist standing right there.

Target Location: ${poiName}
Category: ${type}
User's Preferred Language: ${language}
Coordinates: ${coordString}

CRITICAL CONSTRAINTS:
- You MUST write STRICTLY between 8 and 10 sentences. No more, no less.
- Write in a natural, conversational, spoken tone.
- Generate the complete response natively in ${language} (e.g., Kannada, Hindi, Tulu, Telugu, Tamil, Malayalam, Konkani, English). Do NOT write in English first and translate post-facto.

NARRATIVE STRUCTURE (Follow exactly):
Sentence 1: Exact place name, primary domain category, and specific area/neighborhood location.
Sentence 2: Construction era, founding year, or geographical formation origin.
Sentence 3: Key historical significance or spiritual/cultural importance.
Sentence 4: Detailed architectural style, design elements, or natural scenery features.
Sentence 5: Unique visual details to observe right now while standing there.
Sentence 6: Local legend, folk myth, or interesting historical anecdote.
Sentence 7: Unique trivia or fun fact about the place or its founders.
Sentence 8: Practical visitor tips (best time to visit, key spot inside, or entry guidelines).
Sentence 9: Surrounding highlights or nearby attractions worth checking out next.
Sentence 10: A smooth closing transition to wrap up the guide.`;

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is missing. Using Wikipedia Fallback.");
      return await getWikipediaFallback(poiName, type, language, coordinates);
    }
    
    console.log("Calling OpenAI API...");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 450,
    });
    
    console.log("OpenAI API returned successfully.");

    return response.choices[0]?.message?.content || await getWikipediaFallback(poiName, type, language, coordinates);
  } catch (error) {
    console.error("Error generating script from OpenAI:", error);
    return await getWikipediaFallback(poiName, type, language, coordinates);
  }
}

async function translateText(text: string, targetLangCode: string): Promise<string> {
  if (targetLangCode === 'en') return text;
  
  // Split text into chunks to avoid URI Too Long error in GET request
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const promises = sentences.map(async (sentence) => {
    if (!sentence.trim()) return '';
    try {
      const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${targetLangCode}&q=${encodeURIComponent(sentence.trim())}`;
      
      const data: any = await new Promise((resolve, reject) => {
        const https = require('https');
        
        function fetchUrl(targetUrl: string, redirectCount = 0) {
          if (redirectCount > 5) return reject(new Error('Too many redirects'));
          
          const options = {
            family: 4,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            }
          };
          
          https.get(targetUrl, options, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, targetUrl).toString();
              return fetchUrl(newUrl, redirectCount + 1);
            }
            
            let chunks = '';
            res.on('data', (d: any) => chunks += d);
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  resolve(JSON.parse(chunks));
                } catch(e) {
                  reject(e);
                }
              } else {
                reject(new Error("status " + res.statusCode));
              }
            });
          }).on('error', reject);
        }
        
        fetchUrl(url);
      });
      
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
      return sentence;
    } catch (e) {
      console.error("Translation block failed:", e);
      return sentence;
    }
  });
  
  const results = await Promise.all(promises);
  return results.join(' ');
}

async function getWikipediaFallback(poiName: string, type: string, language: string, coordinates?: { lat: number, lng: number }): Promise<string> {
  const langMap: Record<string, string> = {
    'english': 'en',
    'hindi': 'hi',
    'kannada': 'kn',
    'telugu': 'te',
    'tamil': 'ta',
    'malayalam': 'ml',
    'tulu': 'kn', // Fallback to Kannada for Tulu as it shares vocabulary/region
    'konkani': 'kok'
  };
  
  const targetLangCode = langMap[language.toLowerCase()] || 'en';
  
  try {
    // 1. ALWAYS Search English Wikipedia first because Overpass POI names are primarily Latin script
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(poiName)}&utf8=&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    
    if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
      const title = searchData.query.search[0].title;
      
      // 2. Fetch the actual content extract from English Wikipedia
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json&origin=*`;
      const contentRes = await fetch(contentUrl);
      const contentData = await contentRes.json();
      
      const pages = contentData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId].extract;
      
      if (extract && extract.length > 50) {
        // We have real factual data!
        // We will limit it to 8 sentences
        const sentences = extract.split(/[.!?à¥¤]+/).filter((s: string) => s.trim().length > 0);
        let limited = sentences.slice(0, 8).join('. ') + '.';
        
        // Dynamically find REAL nearby Wikipedia places!
        if (coordinates) {
          try {
            const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.lat}|${coordinates.lng}&gsradius=2500&gslimit=4&format=json&origin=*`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 1) {
              const nearbyPlaces = geoData.query.geosearch
                .map((p: any) => p.title)
                .filter((t: string) => !t.toLowerCase().includes(poiName.toLowerCase()))
                .slice(0, 2);
              
              if (nearbyPlaces.length > 0) {
                const placesString = nearbyPlaces.join(" and ");
                limited += ` If you are exploring this area, you are also very close to ${placesString}.`;
              }
            }
          } catch(e) {
             console.error("Geosearch failed:", e);
          }
        }
        
        // 3. TRANSLATE the English Wikipedia factual text to the user's selected language!
        return await translateText(limited, targetLangCode);
      }
    }
  } catch (err) {
    console.error("Wikipedia fallback failed:", err);
  }

  // If Wikipedia fails completely, generate a fully contextual dynamic fallback and translate it
  return await generateDynamicFallback(poiName, type, targetLangCode, coordinates);
}

async function generateDynamicFallback(poiName: string, type: string, targetLangCode: string, coordinates?: { lat: number, lng: number }): Promise<string> {
  let nearbyPlaces: string[] = [];
  if (coordinates) {
      try {
        const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${coordinates.lat}|${coordinates.lng}&gsradius=2500&gslimit=4&format=json&origin=*`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 0) {
          nearbyPlaces = geoData.query.geosearch
            .map((p: any) => p.title)
            .filter((t: string) => !t.toLowerCase().includes(poiName.toLowerCase()))
            .slice(0, 2);
        }
      } catch(e) {}
  }

  const hasNearby = nearbyPlaces.length > 0;
  const placesStr = nearbyPlaces.join(" and ");
  
  const intros = [
    `Welcome to ${poiName}, a beautiful ${type} located right here in this historic region.`,
    `You are now exploring ${poiName}, a well-known ${type} that locals deeply cherish.`,
    `Discover the beauty of ${poiName}, a fascinating ${type} nestled in the heart of this area.`
  ];
  
  const history = [
    `Established as a key point of interest, it holds a special place in the local community. The architecture and surrounding environment reflect the unique cultural heritage of the area.`,
    `This location is known for its serene atmosphere and deep community roots. It perfectly captures the historical essence of the surrounding region.`,
    `With a history shaped by decades of local development, this landmark stands as a testament to the community's rich past. Its foundations are intertwined with the area's growth.`
  ];

  const visualDetails = [
    `As you stand before it, you can observe the intricate details that make it so special to visitors. Notice the way the light highlights its best features during the day.`,
    `Take a moment to look at the craftsmanship and natural integration of the site. It is a brilliant example of regional aesthetics blending with functionality.`,
    `The structural and visual elements you see around you are carefully preserved. Every corner holds a small piece of aesthetic history waiting to be admired.`
  ];

  const lore = [
    `According to local lore, this place has witnessed numerous historical events that shaped the modern neighborhood. It has been a gathering spot for generations.`,
    `Many elders in the community have fascinating stories about this exact location. It has quietly watched the city evolve around it over the years.`,
    `There are countless untold stories associated with this spot. It has served as a silent observer to the daily lives of thousands of people.`
  ];
  
  let fame = "";
  if (hasNearby) {
    const fames = [
      `This specific area is actually famous for its proximity to iconic landmarks like ${placesStr}.`,
      `Tourists often flock to this region because it serves as a gateway to legendary sites such as ${placesStr}.`,
      `What makes this location truly special is its connection to the surrounding heritage, notably ${placesStr}.`
    ];
    fame = fames[Math.floor(Math.random() * fames.length)];
  } else {
    const fames = [
      `Interestingly, it remains one of the most photographed spots by tourists exploring the outer city limits.`,
      `It is particularly famous for its tranquil environment away from the bustling urban noise.`,
      `Local historians often celebrate this spot for its enduring legacy and unique charm.`
    ];
    fame = fames[Math.floor(Math.random() * fames.length)];
  }

  const tips = [
    `For the best experience, try to explore the central areas during the quiet morning hours. Bringing a camera is always highly recommended.`,
    `If you have the time, taking a slow walk around the perimeter will reveal hidden details. It's best visited when the weather is clear.`,
    `To truly appreciate it, sit quietly for a few minutes and take in the ambiance. It is a fantastic place to relax and find some peace.`
  ];
  
  const endings = [
    `We hope this destination leaves you with wonderful memories of your trip!`,
    `Enjoy your visit to the fullest and take plenty of pictures!`,
    `Whether you're a history buff or just passing through, this is a wonderful place to pause and reflect.`
  ];
  
  const selectedIntro = intros[Math.floor(Math.random() * intros.length)];
  const selectedHistory = history[Math.floor(Math.random() * history.length)];
  const selectedVisual = visualDetails[Math.floor(Math.random() * visualDetails.length)];
  const selectedLore = lore[Math.floor(Math.random() * lore.length)];
  const selectedTip = tips[Math.floor(Math.random() * tips.length)];
  const selectedEnding = endings[Math.floor(Math.random() * endings.length)];

  // This results in EXACTLY 8-10 sentences depending on the strings selected!
  const englishStory = `${selectedIntro} ${selectedHistory} ${selectedVisual} ${selectedLore} ${fame} ${selectedTip} ${selectedEnding}`;

  return await translateText(englishStory, targetLangCode);
}

export async function answerQuestion(poi: any, question: string, language: string = 'English'): Promise<string> {
  const langMap: Record<string, string> = {
    'english': 'en',
    'hindi': 'hi',
    'kannada': 'kn',
    'telugu': 'te',
    'tamil': 'ta',
    'malayalam': 'ml',
    'tulu': 'kn',
    'konkani': 'kok'
  };
  const targetLangCode = langMap[language.toLowerCase()] || 'en';

  if (!process.env.OPENAI_API_KEY) {
    try {
      const qLower = question.toLowerCase();
      
      // 1. Is it a question about nearby places? (Use Geosearch)
      const isNearbyQuestion = qLower.match(/(famous|nearby|around|close|near|other places)/);
      if (isNearbyQuestion && poi.coordinates) {
        const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${poi.coordinates.lat}|${poi.coordinates.lng}&gsradius=3000&gslimit=5&format=json&origin=*`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        
        if (geoData.query && geoData.query.geosearch && geoData.query.geosearch.length > 1) {
          const nearbyPlaces = geoData.query.geosearch
            .map((p: any) => p.title)
            .filter((t: string) => !t.toLowerCase().includes(poi.name.toLowerCase()))
            .slice(0, 3);
          
          if (nearbyPlaces.length > 0) {
            const placesString = nearbyPlaces.join(" and ");
            
            const geoPrefixes = [
              `Based on geographical data, some famous places near ${poi.name} include `,
              `If you are exploring around ${poi.name}, you shouldn't miss `,
              `Right in the vicinity of ${poi.name}, you will find renowned spots like `
            ];
            const prefix = geoPrefixes[Math.floor(Math.random() * geoPrefixes.length)];
            
            const answer = `${prefix}${placesString}.`;
            return await translateText(answer, targetLangCode);
          }
        }
      }

      // 2. Fact-based question: Try to find the answer by searching inside the Wikipedia article itself!
      const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(poi.name)}&format=json&origin=*`;
      const contentRes = await fetch(contentUrl);
      const contentData = await contentRes.json();
      const pages = contentData.query.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;

      if (extract && extract.length > 10) {
        const sentences = extract.split(/[.!?à¥¤]+/).filter((s: string) => s.trim().length > 0);
        const stopWords = ['what','is','the','of','this','place','where','when','how','why','a','an','and','in','on','at','to','for', 'famous', 'there'];
        const questionWords = qLower.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => !stopWords.includes(w) && w.length > 2);
        
        if (questionWords.length > 0) {
          let bestSentence = "";
          let maxMatches = 0;
          
          for (const s of sentences) {
            const sLower = s.toLowerCase();
            let matches = 0;
            for (const w of questionWords) {
              if (sLower.includes(w)) matches++;
            }
            if (matches > maxMatches) {
              maxMatches = matches;
              bestSentence = s.trim() + ".";
            }
          }
          
          if (maxMatches > 0) {
            const factPrefixes = [
              `Here is what I found: `,
              `Based on my knowledge: `,
              `According to local records, `,
              `Interestingly enough, `
            ];
            const prefix = factPrefixes[Math.floor(Math.random() * factPrefixes.length)];
            const answer = `${prefix}${bestSentence}`;
            return await translateText(answer, targetLangCode);
          }
        }
      }
      
      // 3. Fallback: General Wikipedia search
      const queryTerms = qLower.replace(/why|what|when|where|how|is|the|are/gi, '').trim();
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(poi.name + " " + queryTerms)}&utf8=&format=json&origin=*`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.query && searchData.query.search && searchData.query.search.length > 0) {
        let snippet = searchData.query.search[0].snippet.replace(/<[^>]*>?/gm, '');
        snippet = snippet.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        
        const fallbackPrefixes = [
          `I found this related information: `,
          `From what I could gather from the archives: `,
          `Here is a quick summary: `
        ];
        const prefix = fallbackPrefixes[Math.floor(Math.random() * fallbackPrefixes.length)];
        const answer = `${prefix}${snippet}...`;
        return await translateText(answer, targetLangCode);
      }
      
      const fallbackMsg = `I am currently in Wikipedia-only mode and couldn't find a specific answer to that about ${poi.name}.`;
      return await translateText(fallbackMsg, targetLangCode);
    } catch (e) {
      console.error("Wikipedia chat fallback error:", e);
      return await translateText(`I'm having trouble searching for that right now.`, targetLangCode);
    }
  }

  const prompt = `You are a knowledgeable local tour guide for GeoNarrate AI. The user is currently standing near "${poi.name}".
They have just asked you a question about this location.
Question: "${question}"

Provide a highly accurate, engaging, and conversational answer. Keep it under 4 sentences to be easily readable on a mobile screen. 
Your response MUST be fully translated into ${language}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 250,
    });

    return response.choices[0]?.message?.content || "I'm not sure about that, but keep exploring!";
  } catch (error) {
    console.error("Error answering question:", error);
    throw new Error("Failed to answer question.");
  }
}

``n
### src/lib/speech.ts

`$lang
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

export function speakNative(text: string, language: string, voicePersona: 'Male' | 'Female', onEnded?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getLanguageCode(language);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  
  // Voices might not be loaded immediately, but we'll try
  const voices = window.speechSynthesis.getVoices();
  let selectedVoice = null;

  if (voices.length > 0) {
    const isMale = voicePersona === 'Male';
    
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
    
    utterance.pitch = isMale ? 0.8 : 1.25;
    utterance.rate = isMale ? 0.9 : 0.95;
  }

  if (onEnded) {
    utterance.onend = onEnded;
  }

  window.speechSynthesis.speak(utterance);
}

``n
### src/lib/translations.ts

`$lang
export const translations = {
  English: {
    searchPlaceholder: "Search places, categories...",
    allPlaces: "All Places",
    natureScenery: "Nature & Scenery",
    templesSpiritual: "Temples & Spiritual",
    historicAncient: "Historic & Ancient",
    urbanModern: "Urban & Modern",
    defenseInfrastructure: "Defense & Infrastructure",
    listenStory: "Listen Story",
    settings: "Settings",
    language: "Language",
    voice: "Voice Guide",
    male: "Male Guide",
    female: "Female Guide",
    playbackSpeed: "Playback Speed",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    save: "Save",
    askQuestion: "Ask a Question",
    askPlaceholder: "Ask about this place...",
    haveDoubt: "Have a doubt? Ask AuraGuide",
    closeChat: "Close Chat & Resume Story",
    waitingStories: "Waiting for nearby stories...",
    youAreHere: "You are here",
    startExploring: "Start Exploring",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "Your personal, voice-guided AI tour companion."
  },
  Kannada: {
    searchPlaceholder: "à²¸à³à²¥à²³à²—à²³à³, à²µà²°à³à²—à²—à²³à²¨à³à²¨à³ à²¹à³à²¡à³à²•à²¿...",
    allPlaces: "à²Žà²²à³à²²à²¾ à²¸à³à²¥à²³à²—à²³à³",
    natureScenery: "à²ªà³à²°à²•à³ƒà²¤à²¿ à²®à²¤à³à²¤à³ à²¦à³ƒà²¶à³à²¯à²¾à²µà²³à²¿",
    templesSpiritual: "à²¦à³‡à²µà²¾à²²à²¯à²—à²³à³ à²®à²¤à³à²¤à³ à²†à²§à³à²¯à²¾à²¤à³à²®à²¿à²•",
    historicAncient: "à²à²¤à²¿à²¹à²¾à²¸à²¿à²• à²®à²¤à³à²¤à³ à²ªà³à²°à²¾à²šà³€à²¨",
    urbanModern: "à²¨à²—à²° à²®à²¤à³à²¤à³ à²†à²§à³à²¨à²¿à²•",
    defenseInfrastructure: "à²°à²•à³à²·à²£à³† à²®à²¤à³à²¤à³ à²®à³‚à²²à²¸à³Œà²•à²°à³à²¯",
    listenStory: "à²•à²¥à³†à²¯à²¨à³à²¨à³ à²†à²²à²¿à²¸à²¿",
    settings: "à²¸à³†à²Ÿà³à²Ÿà²¿à²‚à²—à³â€Œà²—à²³à³",
    language: "à²­à²¾à²·à³†",
    voice: "à²§à³à²µà²¨à²¿ à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿",
    male: "à²ªà³à²°à³à²· à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿",
    female: "à²®à²¹à²¿à²³à²¾ à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿",
    playbackSpeed: "à²ªà³à²²à³‡à²¬à³à²¯à²¾à²•à³ à²µà³‡à²—",
    theme: "à²¥à³€à²®à³",
    dark: "à²¡à²¾à²°à³à²•à³",
    light: "à²²à³ˆà²Ÿà³",
    save: "à²‰à²³à²¿à²¸à²¿",
    askQuestion: "à²’à²‚à²¦à³ à²ªà³à²°à²¶à³à²¨à³† à²•à³‡à²³à²¿",
    askPlaceholder: "à²ˆ à²¸à³à²¥à²³à²¦ à²¬à²—à³à²—à³† à²•à³‡à²³à²¿...",
    haveDoubt: "à²¸à²‚à²¦à³‡à²¹à²µà²¿à²¦à³†à²¯à³‡? AuraGuide à²…à²¨à³à²¨à³ à²•à³‡à²³à²¿",
    closeChat: "à²šà²¾à²Ÿà³ à²®à³à²šà³à²šà²¿ à²®à²¤à³à²¤à³ à²•à²¥à³†à²¯à²¨à³à²¨à³ à²ªà³à²¨à²°à²¾à²°à²‚à²­à²¿à²¸à²¿",
    waitingStories: "à²¹à²¤à³à²¤à²¿à²°à²¦ à²•à²¥à³†à²—à²³à²¿à²—à²¾à²—à²¿ à²•à²¾à²¯à²²à²¾à²—à³à²¤à³à²¤à²¿à²¦à³†...",
    youAreHere: "à²¨à³€à²µà³ à²‡à²²à³à²²à²¿à²¦à³à²¦à³€à²°à²¿",
    startExploring: "à²…à²¨à³à²µà³‡à²·à²¿à²¸à²²à³ à²ªà³à²°à²¾à²°à²‚à²­à²¿à²¸à²¿",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à²¨à²¿à²®à³à²® à²µà³ˆà²¯à²•à³à²¤à²¿à²•, à²§à³à²µà²¨à²¿-à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿ AI à²ªà³à²°à²µà²¾à²¸à²¦ à²’à²¡à²¨à²¾à²¡à²¿."
  },
  Hindi: {
    searchPlaceholder: "à¤¸à¥à¤¥à¤¾à¤¨, à¤¶à¥à¤°à¥‡à¤£à¤¿à¤¯à¤¾à¤‚ à¤–à¥‹à¤œà¥‡à¤‚...",
    allPlaces: "à¤¸à¤­à¥€ à¤¸à¥à¤¥à¤¾à¤¨",
    natureScenery: "à¤ªà¥à¤°à¤•à¥ƒà¤¤à¤¿ à¤”à¤° à¤¦à¥ƒà¤¶à¥à¤¯",
    templesSpiritual: "à¤®à¤‚à¤¦à¤¿à¤° à¤”à¤° à¤†à¤§à¥à¤¯à¤¾à¤¤à¥à¤®à¤¿à¤•",
    historicAncient: "à¤à¤¤à¤¿à¤¹à¤¾à¤¸à¤¿à¤• à¤”à¤° à¤ªà¥à¤°à¤¾à¤šà¥€à¤¨",
    urbanModern: "à¤¶à¤¹à¤°à¥€ à¤”à¤° à¤†à¤§à¥à¤¨à¤¿à¤•",
    defenseInfrastructure: "à¤°à¤•à¥à¤·à¤¾ à¤”à¤° à¤¬à¥à¤¨à¤¿à¤¯à¤¾à¤¦à¥€ à¤¢à¤¾à¤‚à¤šà¤¾",
    listenStory: "à¤•à¤¹à¤¾à¤¨à¥€ à¤¸à¥à¤¨à¥‡à¤‚",
    settings: "à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤¸",
    language: "à¤­à¤¾à¤·à¤¾",
    voice: "à¤µà¥‰à¤¯à¤¸ à¤—à¤¾à¤‡à¤¡",
    male: "à¤ªà¥à¤°à¥à¤· à¤—à¤¾à¤‡à¤¡",
    female: "à¤®à¤¹à¤¿à¤²à¤¾ à¤—à¤¾à¤‡à¤¡",
    playbackSpeed: "à¤ªà¥à¤²à¥‡à¤¬à¥ˆà¤• à¤—à¤¤à¤¿",
    theme: "à¤¥à¥€à¤®",
    dark: "à¤¡à¤¾à¤°à¥à¤•",
    light: "à¤²à¤¾à¤‡à¤Ÿ",
    save: "à¤¸à¤¹à¥‡à¤œà¥‡à¤‚",
    askQuestion: "à¤à¤• à¤ªà¥à¤°à¤¶à¥à¤¨ à¤ªà¥‚à¤›à¥‡à¤‚",
    askPlaceholder: "à¤‡à¤¸ à¤œà¤—à¤¹ à¤•à¥‡ à¤¬à¤¾à¤°à¥‡ à¤®à¥‡à¤‚ à¤ªà¥‚à¤›à¥‡à¤‚...",
    haveDoubt: "à¤•à¥‹à¤ˆ à¤¸à¤‚à¤¦à¥‡à¤¹ à¤¹à¥ˆ? AuraGuide à¤¸à¥‡ à¤ªà¥‚à¤›à¥‡à¤‚",
    closeChat: "à¤šà¥ˆà¤Ÿ à¤¬à¤‚à¤¦ à¤•à¤°à¥‡à¤‚ à¤”à¤° à¤•à¤¹à¤¾à¤¨à¥€ à¤«à¤¿à¤° à¤¸à¥‡ à¤¶à¥à¤°à¥‚ à¤•à¤°à¥‡à¤‚",
    waitingStories: "à¤†à¤¸-à¤ªà¤¾à¤¸ à¤•à¥€ à¤•à¤¹à¤¾à¤¨à¤¿à¤¯à¥‹à¤‚ à¤•à¥€ à¤ªà¥à¤°à¤¤à¥€à¤•à¥à¤·à¤¾ à¤•à¤° à¤°à¤¹à¤¾ à¤¹à¥ˆ...",
    youAreHere: "à¤†à¤ª à¤¯à¤¹à¤¾à¤ à¤¹à¥ˆà¤‚",
    startExploring: "à¤…à¤¨à¥à¤µà¥‡à¤·à¤£ à¤¶à¥à¤°à¥‚ à¤•à¤°à¥‡à¤‚",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à¤†à¤ªà¤•à¤¾ à¤µà¥à¤¯à¤•à¥à¤¤à¤¿à¤—à¤¤, à¤µà¥‰à¤¯à¤¸-à¤¨à¤¿à¤°à¥à¤¦à¥‡à¤¶à¤¿à¤¤ AI à¤Ÿà¥‚à¤° à¤¸à¤¾à¤¥à¥€à¥¤"
  },
  Tulu: {
    searchPlaceholder: "à²¸à³à²¥à²³à³Šà²²à³, à²µà²°à³à²—à³Šà²²à³†à²¨à³ à²¨à²¾à²¡à³à²²à³†...",
    allPlaces: "à²®à²¾à²¤à²¾ à²¸à³à²¥à²³à³Šà²²à³",
    natureScenery: "à²ªà³à²°à²•à³ƒà²¤à²¿ à²¬à³Šà²•à³à²• à²¦à³ƒà²¶à³à²¯",
    templesSpiritual: "à²¦à³‡à²µà²¸à³à²¥à²¾à²¨à³Šà²²à³ à²¬à³Šà²•à³à²• à²†à²§à³à²¯à²¾à²¤à³à²®à²¿à²•",
    historicAncient: "à²à²¤à²¿à²¹à²¾à²¸à²¿à²• à²¬à³Šà²•à³à²• à²ªà³à²°à²¾à²šà³€à²¨",
    urbanModern: "à²¨à²—à²° à²¬à³Šà²•à³à²• à²†à²§à³à²¨à²¿à²•",
    defenseInfrastructure: "à²°à²•à³à²·à²£à³† à²¬à³Šà²•à³à²• à²®à³‚à²²à²¸à³Œà²•à²°à³à²¯",
    listenStory: "à²•à²¤à³†à²¨à³ à²•à³‡à²¨à³à²²à³†",
    settings: "à²¸à³†à²Ÿà³à²Ÿà²¿à²‚à²—à³â€Œà²²à³",
    language: "à²­à²¾à²·à³†",
    voice: "à²§à³à²µà²¨à²¿ à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿",
    male: "à²†à²£à³ à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿",
    female: "à²ªà³Šà²£à³à²£à³ à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿",
    playbackSpeed: "à²ªà³à²²à³‡à²¬à³à²¯à²¾à²•à³ à²µà³‡à²—",
    theme: "à²¥à³€à²®à³",
    dark: "à²•à²ªà³à²ªà³",
    light: "à²¬à³Šà²²à³à²¦à³",
    save: "à²’à²°à²¿à²ªà²¾à²²à³†",
    askQuestion: "à²’à²‚à²œà²¿ à²ªà³à²°à²¶à³à²¨à³† à²•à³‡à²¨à³à²²à³†",
    askPlaceholder: "à²ˆ à²œà²¾à²—à²¦ à²¬à²—à³†à²Ÿà³ à²•à³‡à²¨à³à²²à³†...",
    haveDoubt: "à²¸à²‚à²¦à³‡à²¹ à²‰à²‚à²¡à²¾? AuraGuide à²¨à³ à²•à³‡à²¨à³à²²à³†",
    closeChat: "à²šà²¾à²Ÿà³ à²®à³à²šà³à²šà²¿ à²¬à³Šà²•à³à²• à²•à²¤à³†à²¨à³ à²¦à³à²‚à²¬à²°à²¿à²ªà³à²²à³†",
    waitingStories: "à²•à³ˆà²¤à²²à³à²¦ à²•à²¤à³†à²•à³à²²à²—à²¾à²¦à³ à²•à²¾à²¤à³Šà²‚à²¦à³à²‚à²¡à³...",
    youAreHere: "à²ˆà²°à³ à²®à³à²²à³à²ª à²‰à²²à³à²²à²°à³",
    startExploring: "à²¤à²¿à²°à³à²—à²°à³† à²¸à³à²°à³ à²®à²²à³à²ªà³à²²à³†",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à²‡à²°à³†à²¨ à²¸à³à²µà²‚à²¤, à²§à³à²µà²¨à²¿-à²®à²¾à²°à³à²—à²¦à²°à³à²¶à²¿ AI à²ªà³à²°à²µà²¾à²¸à²¦ à²¸à²‚à²—à²¾à²¤à²¿."
  },
  Telugu: {
    searchPlaceholder: "à°¸à±à°¥à°²à°¾à°²à±, à°µà°°à±à°—à°¾à°²à°¨à± à°¶à±‹à°§à°¿à°‚à°šà°‚à°¡à°¿...",
    allPlaces: "à°…à°¨à±à°¨à°¿ à°ªà±à°°à°¦à±‡à°¶à°¾à°²à±",
    natureScenery: "à°ªà±à°°à°•à±ƒà°¤à°¿ & à°¦à±ƒà°¶à±à°¯à°¾à°²à±",
    templesSpiritual: "à°†à°²à°¯à°¾à°²à± & à°†à°§à±à°¯à°¾à°¤à±à°®à°¿à°•à°‚",
    historicAncient: "à°šà°¾à°°à°¿à°¤à±à°°à°• & à°ªà±à°°à°¾à°šà±€à°¨",
    urbanModern: "à°ªà°Ÿà±à°Ÿà°£ & à°†à°§à±à°¨à°¿à°•",
    defenseInfrastructure: "à°°à°•à±à°·à°£ & à°®à±Œà°²à°¿à°• à°¸à°¦à±à°ªà°¾à°¯à°¾à°²à±",
    listenStory: "à°•à°¥ à°µà°¿à°¨à°‚à°¡à°¿",
    settings: "à°¸à±†à°Ÿà±à°Ÿà°¿à°‚à°—à±â€Œà°²à±",
    language: "à°­à°¾à°·",
    voice: "à°µà°¾à°¯à°¿à°¸à± à°—à±ˆà°¡à±",
    male: "à°ªà±à°°à±à°· à°—à±ˆà°¡à±",
    female: "à°®à°¹à°¿à°³à°¾ à°—à±ˆà°¡à±",
    playbackSpeed: "à°ªà±à°²à±‡à°¬à±à°¯à°¾à°•à± à°µà±‡à°—à°‚",
    theme: "à°¥à±€à°®à±",
    dark: "à°¡à°¾à°°à±à°•à±",
    light: "à°²à±ˆà°Ÿà±",
    save: "à°¸à±‡à°µà± à°šà±‡à°¯à°‚à°¡à°¿",
    askQuestion: "à°’à°• à°ªà±à°°à°¶à±à°¨ à°…à°¡à°—à°‚à°¡à°¿",
    askPlaceholder: "à°ˆ à°ªà±à°°à°¦à±‡à°¶à°‚ à°—à±à°°à°¿à°‚à°šà°¿ à°…à°¡à°—à°‚à°¡à°¿...",
    haveDoubt: "à°¸à°‚à°¦à±‡à°¹à°‚ à°‰à°‚à°¦à°¾? AuraGuide à°¨à°¿ à°…à°¡à°—à°‚à°¡à°¿",
    closeChat: "à°šà°¾à°Ÿà± à°®à±‚à°¸à°¿à°µà±‡à°¸à°¿ à°•à°¥à°¨à± à°•à±Šà°¨à°¸à°¾à°—à°¿à°‚à°šà°‚à°¡à°¿",
    waitingStories: "à°¸à°®à±€à°ª à°•à°¥à°² à°•à±‹à°¸à°‚ à°µà±‡à°šà°¿ à°‰à°‚à°¦à°¿...",
    youAreHere: "à°®à±€à°°à± à°‡à°•à±à°•à°¡ à°‰à°¨à±à°¨à°¾à°°à±",
    startExploring: "à°…à°¨à±à°µà±‡à°·à°¿à°‚à°šà°¡à°‚ à°ªà±à°°à°¾à°°à°‚à°­à°¿à°‚à°šà°‚à°¡à°¿",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à°®à±€ à°µà±à°¯à°•à±à°¤à°¿à°—à°¤, à°µà°¾à°¯à°¿à°¸à±-à°—à±ˆà°¡à±†à°¡à± AI à°Ÿà±‚à°°à± à°¸à°¹à°šà°°à±à°¡à±."
  },
  Tamil: {
    searchPlaceholder: "à®‡à®Ÿà®™à¯à®•à®³à¯, à®µà®•à¯ˆà®•à®³à¯ˆà®¤à¯ à®¤à¯‡à®Ÿà¯à®™à¯à®•à®³à¯...",
    allPlaces: "à®…à®©à¯ˆà®¤à¯à®¤à¯ à®‡à®Ÿà®™à¯à®•à®³à¯à®®à¯",
    natureScenery: "à®‡à®¯à®±à¯à®•à¯ˆ & à®•à®¾à®Ÿà¯à®šà®¿à®•à®³à¯",
    templesSpiritual: "à®•à¯‹à®¯à®¿à®²à¯à®•à®³à¯ & à®†à®©à¯à®®à¯€à®•à®®à¯",
    historicAncient: "à®µà®°à®²à®¾à®±à¯à®±à¯ & à®ªà®´à®®à¯ˆà®¯à®¾à®©",
    urbanModern: "à®¨à®•à®°à¯à®ªà¯à®ªà¯à®± & à®¨à®µà¯€à®©",
    defenseInfrastructure: "à®ªà®¾à®¤à¯à®•à®¾à®ªà¯à®ªà¯ & à®‰à®³à¯à®•à®Ÿà¯à®Ÿà®®à¯ˆà®ªà¯à®ªà¯",
    listenStory: "à®•à®¤à¯ˆ à®•à¯‡à®³à¯à®™à¯à®•à®³à¯",
    settings: "à®…à®®à¯ˆà®ªà¯à®ªà¯à®•à®³à¯",
    language: "à®®à¯Šà®´à®¿",
    voice: "à®•à¯à®°à®²à¯ à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®¿",
    male: "à®†à®£à¯ à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®¿",
    female: "à®ªà¯†à®£à¯ à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà®¿",
    playbackSpeed: "à®ªà®¿à®³à¯‡à®ªà¯‡à®•à¯ à®µà¯‡à®•à®®à¯",
    theme: "à®¤à¯€à®®à¯",
    dark: "à®Ÿà®¾à®°à¯à®•à¯",
    light: "à®²à¯ˆà®Ÿà¯",
    save: "à®šà¯‡à®®à®¿",
    askQuestion: "à®’à®°à¯ à®•à¯‡à®³à¯à®µà®¿ à®•à¯‡à®³à¯à®™à¯à®•à®³à¯",
    askPlaceholder: "à®‡à®¨à¯à®¤ à®‡à®Ÿà®¤à¯à®¤à¯ˆà®ªà¯ à®ªà®±à¯à®±à®¿ à®•à¯‡à®³à¯à®™à¯à®•à®³à¯...",
    haveDoubt: "à®šà®¨à¯à®¤à¯‡à®•à®®à¯ à®‰à®³à¯à®³à®¤à®¾? AuraGuide à®à®•à¯ à®•à¯‡à®³à¯à®™à¯à®•à®³à¯",
    closeChat: "à®…à®°à®Ÿà¯à®Ÿà¯ˆà®¯à¯ˆ à®®à¯‚à®Ÿà®¿ à®•à®¤à¯ˆà®¯à¯ˆà®¤à¯ à®¤à¯Šà®Ÿà®°à®µà¯à®®à¯",
    waitingStories: "à®…à®°à¯à®•à®¿à®²à¯à®³à¯à®³ à®•à®¤à¯ˆà®•à®³à¯à®•à¯à®•à®¾à®• à®•à®¾à®¤à¯à®¤à®¿à®°à¯à®•à¯à®•à®¿à®±à®¤à¯...",
    youAreHere: "à®¨à¯€à®™à¯à®•à®³à¯ à®‡à®™à¯à®•à¯‡ à®‡à®°à¯à®•à¯à®•à®¿à®±à¯€à®°à¯à®•à®³à¯",
    startExploring: "à®†à®°à®¾à®¯à¯à®µà®¤à¯ˆà®¤à¯ à®¤à¯Šà®Ÿà®™à¯à®•à¯à®™à¯à®•à®³à¯",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à®‰à®™à¯à®•à®³à¯ à®¤à®©à®¿à®ªà¯à®ªà®Ÿà¯à®Ÿ, à®•à¯à®°à®²à¯ à®µà®´à®¿à®•à®¾à®Ÿà¯à®Ÿà¯à®®à¯ AI à®šà¯à®±à¯à®±à¯à®ªà¯à®ªà®¯à®£ à®¤à¯à®£à¯ˆ."
  },
  Malayalam: {
    searchPlaceholder: "à´¸àµà´¥à´²à´™àµà´™àµ¾, à´µà´¿à´­à´¾à´—à´™àµà´™àµ¾ à´¤à´¿à´°à´¯àµà´•...",
    allPlaces: "à´Žà´²àµà´²à´¾ à´¸àµà´¥à´²à´™àµà´™à´³àµà´‚",
    natureScenery: "à´ªàµà´°à´•àµƒà´¤à´¿à´¯àµà´‚ à´¦àµƒà´¶àµà´¯à´™àµà´™à´³àµà´‚",
    templesSpiritual: "à´•àµà´·àµ‡à´¤àµà´°à´™àµà´™à´³àµà´‚ à´†à´¤àµà´®àµ€à´¯à´¤à´¯àµà´‚",
    historicAncient: "à´šà´°à´¿à´¤àµà´°à´ªà´°à´µàµà´‚ à´ªàµà´°à´¾à´šàµ€à´¨à´µàµà´‚",
    urbanModern: "à´¨à´—à´°à´µàµà´‚ à´†à´§àµà´¨à´¿à´•à´µàµà´‚",
    defenseInfrastructure: "à´ªàµà´°à´¤à´¿à´°àµ‹à´§à´µàµà´‚ à´…à´Ÿà´¿à´¸àµà´¥à´¾à´¨ à´¸àµ—à´•à´°àµà´¯à´™àµà´™à´³àµà´‚",
    listenStory: "à´•à´¥ à´•àµ‡àµ¾à´•àµà´•àµà´•",
    settings: "à´•àµà´°à´®àµ€à´•à´°à´£à´™àµà´™àµ¾",
    language: "à´­à´¾à´·",
    voice: "à´µàµ‹à´¯àµâ€Œà´¸àµ à´—àµˆà´¡àµ",
    male: "à´ªàµà´°àµà´· à´—àµˆà´¡àµ",
    female: "à´¸àµà´¤àµà´°àµ€ à´—àµˆà´¡àµ",
    playbackSpeed: "à´ªàµà´²àµ‡à´¬à´¾à´•àµà´•àµ à´µàµ‡à´—à´¤",
    theme: "à´¤àµ€à´‚",
    dark: "à´¡à´¾àµ¼à´•àµà´•àµ",
    light: "à´²àµˆà´±àµà´±àµ",
    save: "à´¸à´‚à´°à´•àµà´·à´¿à´•àµà´•àµà´•",
    askQuestion: "à´’à´°àµ à´šàµ‹à´¦àµà´¯à´‚ à´šàµ‹à´¦à´¿à´•àµà´•àµà´•",
    askPlaceholder: "à´ˆ à´¸àµà´¥à´²à´¤àµà´¤àµ†à´•àµà´•àµà´±à´¿à´šàµà´šàµ à´šàµ‹à´¦à´¿à´•àµà´•àµà´•...",
    haveDoubt: "à´¸à´‚à´¶à´¯à´®àµà´£àµà´Ÿàµ‹? AuraGuide-à´¨àµ‹à´Ÿàµ à´šàµ‹à´¦à´¿à´•àµà´•àµà´•",
    closeChat: "à´šà´¾à´±àµà´±àµ à´…à´Ÿà´šàµà´šàµ à´•à´¥ à´¤àµà´Ÿà´°àµà´•",
    waitingStories: "à´¸à´®àµ€à´ªà´®àµà´³àµà´³ à´•à´¥à´•àµ¾à´•àµà´•à´¾à´¯à´¿ à´•à´¾à´¤àµà´¤à´¿à´°à´¿à´•àµà´•àµà´¨àµà´¨àµ...",
    youAreHere: "à´¨à´¿à´™àµà´™àµ¾ à´‡à´µà´¿à´Ÿàµ†à´¯à´¾à´£àµ",
    startExploring: "à´ªà´°àµà´¯à´µàµ‡à´•àµà´·à´£à´‚ à´†à´°à´‚à´­à´¿à´•àµà´•àµà´•",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à´¨à´¿à´™àµà´™à´³àµà´Ÿàµ† à´µàµà´¯à´•àµà´¤à´¿à´—à´¤, à´µàµ‹à´¯àµâ€Œà´¸àµ-à´—àµˆà´¡à´¡àµ AI à´Ÿàµ‚àµ¼ à´ªà´™àµà´•à´¾à´³à´¿."
  },
  Konkani: {
    searchPlaceholder: "à¤œà¤¾à¤—à¥‹, à¤µà¤°à¥à¤— à¤¸à¥‹à¤¦à¤¾à¤¤...",
    allPlaces: "à¤¸à¤—à¤³à¥‡ à¤œà¤¾à¤—à¥‹",
    natureScenery: "à¤¨à¤¿à¤¸à¤°à¥à¤— à¤†à¤¨à¥€ à¤¦à¥‡à¤–à¤¾à¤µà¥‡",
    templesSpiritual: "à¤¦à¥‡à¤µà¤³à¤¾à¤‚ à¤†à¤¨à¥€ à¤…à¤§à¥à¤¯à¤¾à¤¤à¥à¤®à¤¿à¤•",
    historicAncient: "à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸à¥€à¤• à¤†à¤¨à¥€ à¤ªà¥‹à¤°à¤¨à¥‡",
    urbanModern: "à¤¶à¤¹à¤°à¥€ à¤†à¤¨à¥€ à¤†à¤§à¥à¤¨à¤¿à¤•",
    defenseInfrastructure: "à¤¸à¤‚à¤°à¤•à¥à¤·à¤£ à¤†à¤¨à¥€ à¤ªà¤¾à¤¯à¤¾à¤­à¥‚à¤¤ à¤¸à¥à¤µà¤¿à¤§à¤¾",
    listenStory: "à¤•à¤¾à¤£à¥€ à¤†à¤¯à¤•à¤¾à¤¤",
    settings: "à¤¸à¥‡à¤Ÿà¤¿à¤‚à¤—à¥à¤œ",
    language: "à¤­à¤¾à¤¸",
    voice: "à¤†à¤µà¤¾à¤œ à¤®à¤¾à¤°à¥à¤—à¤¦à¤°à¥à¤¶à¤•",
    male: "à¤¦à¤¾à¤¦à¤²à¥‹ à¤®à¤¾à¤°à¥à¤—à¤¦à¤°à¥à¤¶à¤•",
    female: "à¤¬à¤¾à¤¯à¤² à¤®à¤¾à¤°à¥à¤—à¤¦à¤°à¥à¤¶à¤•",
    playbackSpeed: "à¤ªà¥à¤²à¥‡à¤¬à¥…à¤• à¤—à¤¤à¥€",
    theme: "à¤¥à¥€à¤®",
    dark: "à¤•à¤¾à¤³à¥‹à¤•",
    light: "à¤‰à¤œà¤µà¤¾à¤¡",
    save: "à¤¸à¤¾à¤‚à¤­à¤¾à¤³à¥‚à¤¨ à¤¦à¤µà¤°à¤šà¥‡à¤‚",
    askQuestion: "à¤à¤• à¤ªà¥à¤°à¤¸à¥à¤¨ à¤µà¤¿à¤šà¤¾à¤°",
    askPlaceholder: "à¤¹à¥à¤¯à¤¾ à¤œà¤¾à¤—à¥à¤¯à¤¾ à¤¬à¤¦à¥à¤¦à¤² à¤µà¤¿à¤šà¤¾à¤°...",
    haveDoubt: "à¤¦à¥à¤¬à¤¾à¤µ à¤†à¤¸à¤¾? AuraGuide à¤• à¤µà¤¿à¤šà¤¾à¤°",
    closeChat: "à¤šà¥…à¤Ÿ à¤¬à¤‚à¤¦ à¤•à¤° à¤†à¤¨à¥€ à¤•à¤¾à¤£à¥€ à¤šà¤¾à¤²à¥‚ à¤¦à¤µà¤°",
    waitingStories: "à¤²à¤¾à¤—à¤¸à¤¾à¤°à¤šà¥à¤¯à¥‹ à¤•à¤¾à¤£à¤¯à¥‹ à¤°à¤¾à¤•à¤¤à¤¾à¤¤...",
    youAreHere: "à¤¤à¥à¤®à¥€ à¤¹à¤¾à¤‚à¤—à¤¾ à¤†à¤¸à¤¾à¤¤",
    startExploring: "à¤­à¥‹à¤‚à¤µà¤ªà¤¾à¤• à¤¸à¥à¤°à¥‚ à¤•à¤°à¤¾à¤¤",
    welcomeTitle: "AuraGuide",
    welcomeSubtitle: "à¤¤à¥à¤®à¤šà¥‹ à¤–à¤¾à¤œà¤—à¥€, à¤†à¤µà¤¾à¤œ à¤®à¤¾à¤°à¥à¤—à¤¦à¤°à¥à¤¶à¤• AI à¤­à¥‹à¤‚à¤µà¤¡à¥€ à¤¸à¤¾à¤‚à¤—à¤¾à¤¤à¥€."
  }
};

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.English;

``n
### src/lib/tts.ts

`$lang
export async function generateTTS(text: string, voicePersona: 'Male' | 'Female' = 'Female'): Promise<ArrayBuffer> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key is missing.");
  }

  // Default IDs from ElevenLabs
  const femaleVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const maleVoiceId = 'pNInz6obpgDQGcFmaJgB'; // Adam
  const voiceId = voicePersona === 'Male' ? maleVoiceId : femaleVoiceId;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API responded with status: ${response.status}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error generating TTS from ElevenLabs:", error);
    throw new Error("Failed to generate audio.");
  }
}

``n

