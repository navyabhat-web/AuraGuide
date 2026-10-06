import React from 'react';
import { usePOIStore } from '../../hooks/usePOIStore';
import { MapPin, Navigation, X } from 'lucide-react';
import { LazyWikiImage } from './LazyWikiImage';
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
  "Defense & Infrastructure": "defenseInfrastructure",
  "Commercial & Shops": "commercialShops",
  "Offices & Companies": "officesCompanies",
  "Infrastructure & Roads": "infrastructureRoads",
  "Buildings & Structures": "buildingsStructures"
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
                <LazyWikiImage poiName={poi.name} category={poi.category} lat={poi.coordinates.lat} lng={poi.coordinates.lng} />
                
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


