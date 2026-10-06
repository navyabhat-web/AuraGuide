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
  const { activePOI, theme, language, topics, voicePersona, isAutoTour, pois, history, addToHistory, setActivePOI } = usePOIStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [narrativeText, setNarrativeText] = useState<string>(''); // state for script
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [nativeState, setNativeState] = useState<'idle' | 'playing' | 'paused'>('idle');
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
    if (activePOI) {
      addToHistory(activePOI.id);
    }
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
    
    // Reset narrative text and image when switching POIs
    setNarrativeText('');
    setImageUrl(null);
    
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
    
    const fallbackToNativeSpeech = async (customScript?: string) => {
      let finalScript = customScript;
      
      // If we don't have a custom AI script, try fetching a rich 8-10 sentence extract from Wikipedia!
      if (!finalScript || finalScript.trim() === '') {
        try {
          const langCode = language === 'English' ? 'en' : 'en';
          const searchUrl = `https://${langCode}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(activePOI.name)}&gsrlimit=1&prop=extracts&exintro=1&explaintext=1&exsentences=10&format=json&origin=*`;
          const res = await fetch(searchUrl);
          const data = await res.json();
          if (data.query && data.query.pages) {
            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pages[pageId].extract) {
              finalScript = pages[pageId].extract;
            }
          }
        } catch(e) {}
      }
      
      const fallbackText = finalScript || `Unfortunately, there is no detailed historical Wikipedia record available for ${activePOI.name}. This is a local ${activePOI.category.toLowerCase()} that is part of the local community. To generate a full 10-sentence historical narrative for unlisted places, please connect the AI Generator in your settings.`;
      
      if (!narrativeText || narrativeText === '') {
        setNarrativeText(fallbackText);
      }
      import('../../lib/speech').then(({ speakNative }) => {
        speakNative(fallbackText, language, voicePersona, {
          onStart: () => setNativeState('playing'),
          onPause: () => setNativeState('paused'),
          onResume: () => setNativeState('playing'),
          onEnd: () => {
            setNativeState('idle');
            handleAudioEnded();
          },
          onError: () => setNativeState('idle')
        });
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
        
        // Secondary Fallback: Wikipedia Geosearch for the exact city/location!
        if (!foundImage && activePOI.coordinates) {
          try {
            const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${activePOI.coordinates.lat}|${activePOI.coordinates.lng}&ggsradius=5000&ggslimit=10&prop=pageimages&pithumbsize=600&format=json&origin=*`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            
            if (geoData.query && geoData.query.pages) {
              const pages = geoData.query.pages;
              for (const key in pages) {
                if (pages[key].thumbnail && pages[key].thumbnail.source) {
                  foundImage = pages[key].thumbnail.source;
                  break;
                }
              }
            }
          } catch(e) {}
        }
        
        // Ultimate Fallback to Beautiful High-Res Unsplash Images by Category
        if (!foundImage) {
          const CATEGORY_IMAGES: Record<string, string> = {
            'Temples & Spiritual': 'https://images.unsplash.com/photo-1542359649-31e03cd4d909?w=600&h=400&fit=crop',
            'Historic & Ancient': 'https://images.unsplash.com/photo-1544413660-299165566b1d?w=600&h=400&fit=crop',
            'Nature & Scenery': 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&h=400&fit=crop',
            'Urban & Modern': 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=600&h=400&fit=crop',
            'Defense & Infrastructure': 'https://images.unsplash.com/photo-1565019014169-232cb979d5bb?w=600&h=400&fit=crop',
            'Commercial & Shops': 'https://images.unsplash.com/photo-1555529771-835f59bfc50c?w=600&h=400&fit=crop',
            'Offices & Companies': 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
            'Infrastructure & Roads': 'https://images.unsplash.com/photo-1449844908441-8829872d2607?w=600&h=400&fit=crop',
            'Buildings & Structures': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
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
              {(isPlaying || nativeState === 'playing') && (
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
                if (nativeState === 'playing') {
                   window.speechSynthesis.pause(); 
                } else if (nativeState === 'paused') {
                   window.speechSynthesis.resume();
                } else {
                   togglePlay(); 
                }
              }}
              className={`p-4 rounded-full transition-all active:scale-95 disabled:opacity-50 ${theme === 'dark' ? 'bg-white text-rose-950 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-rose-100' : 'bg-rose-900 text-white shadow-xl hover:bg-rose-800'}`}
            >
              {(isPlaying || nativeState === 'playing') ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
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
              <ImageIcon size={40} className="mb-2 opacity-50 animate-pulse" />
              <span className="text-sm font-semibold animate-pulse">Loading Photo...</span>
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
