import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { usePOIStore } from '../store/usePOIStore';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// For connecting to the Next.js backend on physical devices, use your computer's local IP
// Configure this based on the environment (usually something like 192.168.x.x)
// In production, this would be your hosted URL
const API_BASE_URL = __DEV__ ? 
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000') 
  : 'https://your-production-url.com';

const LOCATION_TASK_NAME = 'background-location-task';

export const useGeoTracking = () => {
  const [liveLocation, setLiveLocation] = useState<{lat: number, lng: number} | null>(null);
  const [velocityKmh, setVelocityKmh] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { setOriginLocation, setOriginPOI, addQueuedAudio, adminSettings, pastVisitedLocations, addVisitedLocation } = usePOIStore();

  useEffect(() => {
    (async () => {
      let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setErrorMsg('Foreground permission to access location was denied');
        return;
      }
      
      let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        setErrorMsg('Background permission was denied. Location tracking may stop when app is minimized.');
      }
      
      // Get initial position
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLiveLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
      setVelocityKmh((location.coords.speed || 0) * 3.6);
      
      // Watch foreground position
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
        (loc) => {
          setLiveLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          setVelocityKmh((loc.coords.speed || 0) * 3.6);
        }
      );
    })();
  }, []);

  const startExploring = async () => {
    if (!liveLocation) return;
    setIsTracking(true);
    setOriginLocation(liveLocation);
    
    // Start background tracking
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 10,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "AuraGuide",
        notificationBody: "Tracking your exploration journey",
        notificationColor: "#ff4d8b",
      }
    });

    try {
      // 1. Fetch Nearby POI from backend
      const nearbyRes = await fetch(`${API_BASE_URL}/api/nearby`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lat: liveLocation.lat, 
          lng: liveLocation.lng, 
          language: adminSettings.language 
        })
      });
      const nearbyData = await nearbyRes.json();
      
      if (nearbyData.pois && nearbyData.pois.length > 0) {
        const originPOI = nearbyData.pois[0]; // Nearest POI is origin
        setOriginPOI(originPOI);
        
        // 2. Queue Narration Audio
        const narrateRes = await fetch(`${API_BASE_URL}/api/narrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poi: originPOI,
            preferences: adminSettings,
            velocityKmh,
            pastVisitedLocations,
            trafficOrWeatherAlerts: null // Can be populated dynamically via a live traffic API later
          })
        });
        const narrateData = await narrateRes.json();
        
        if (narrateData.routingAction) {
          // Display the AI detour instruction to the user
          alert(`Routing Action: ${narrateData.routingAction}`);
        }
        
        if (narrateData.script && narrateData.audioBase64) {
          addQueuedAudio(originPOI.id, narrateData.script, narrateData.audioBase64);
          addVisitedLocation(originPOI.name); // Record for next prompt's history
        } else if (narrateData.script) {
          addQueuedAudio(originPOI.id, narrateData.script, ""); 
          addVisitedLocation(originPOI.name);
        }
      }
    } catch (e) {
      console.error("Failed to start exploring journey: ", e);
      setIsTracking(false);
    }
  };

  const stopExploring = async () => {
    setIsTracking(false);
    setOriginLocation(null);
    setOriginPOI(null);
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  };

  return { liveLocation, isTracking, errorMsg, startExploring, stopExploring };
};
