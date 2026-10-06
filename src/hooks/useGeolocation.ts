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
