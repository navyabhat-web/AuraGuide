import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useGeoTracking } from '../hooks/useGeoTracking';
import { usePOIStore } from '../store/usePOIStore';
import { Navigation, MapPin } from 'lucide-react-native';

export const MapScreen = () => {
  const { liveLocation, isTracking, startExploring, stopExploring } = useGeoTracking();
  const { originLocation, originPOI } = usePOIStore();

  const handleToggleExplore = () => {
    if (isTracking) {
      stopExploring();
    } else {
      startExploring();
    }
  };

  const initialRegion = liveLocation ? {
    latitude: liveLocation.lat,
    longitude: liveLocation.lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 12.9716, // Default Bangalore
    longitude: 77.5946,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <MapView 
        provider={PROVIDER_GOOGLE}
        style={styles.map} 
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={false}
      >
        {/* Origin Location Marker */}
        {originLocation && (
          <Marker 
            coordinate={{ latitude: originLocation.lat, longitude: originLocation.lng }}
            title="Origin Point"
            description={originPOI?.name || "Starting Point"}
          >
            <View style={styles.originMarker}>
              <MapPin color="#fff" size={20} />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.overlayContainer}>
        <TouchableOpacity 
          style={[styles.exploreBtn, isTracking ? styles.stopBtn : styles.startBtn]} 
          onPress={handleToggleExplore}
          disabled={!liveLocation}
        >
          {!liveLocation ? (
            <ActivityIndicator color="#fff" />
          ) : isTracking ? (
            <Text style={styles.exploreBtnText}>Stop Exploring</Text>
          ) : (
            <>
              <Navigation color="#fff" size={20} style={{ marginRight: 8 }} />
              <Text style={styles.exploreBtnText}>Start Exploring</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  overlayContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  exploreBtn: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startBtn: {
    backgroundColor: '#ff4d8b',
  },
  stopBtn: {
    backgroundColor: '#333',
  },
  exploreBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  originMarker: {
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  }
});
