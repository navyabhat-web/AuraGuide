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
