"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { usePOIStore } from '../../hooks/usePOIStore';
import { LocationState } from '../../hooks/useGeolocation';
import { MapPin, Navigation, Landmark, TreePine, Eye, Crosshair, Store, Briefcase, Car, Building } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { useLanguage } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../lib/translations';
import { LazyWikiImage } from '../layout/LazyWikiImage';

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
    case 'Commercial & Shops': return { color: 'orange-500', icon: Store };
    case 'Offices & Companies': return { color: 'indigo-600', icon: Briefcase };
    case 'Infrastructure & Roads': return { color: 'stone-600', icon: Car };
    case 'Buildings & Structures': return { color: 'zinc-700', icon: Building };
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
          const currentPois = usePOIStore.getState().pois;
          const newPois = [...currentPois];
          data.pois.forEach((newPoi: any) => {
            if (!newPois.find(p => p.id === newPoi.id)) {
              newPois.push(newPoi);
            }
          });
          setPOIs(newPois);
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                  
                  {/* Map Popup Thumbnail */}
                  <div className="h-24 w-full mb-3 overflow-hidden rounded-lg">
                    <LazyWikiImage poiName={poi.name} category={poi.category} lat={poi.coordinates.lat} lng={poi.coordinates.lng} />
                  </div>
                  
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


