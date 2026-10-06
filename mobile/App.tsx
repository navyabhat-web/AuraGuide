import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView } from 'react-native';
import { Header } from './src/components/Header';
import { MapScreen } from './src/screens/MapScreen';
import { AudioDeck } from './src/components/AudioDeck';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error("Background Location Error: ", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    // Here we can access usePOIStore.getState() outside of React context if needed,
    // to check if we have moved significantly away from origin or arrived at a destination.
    // For now, the background tracking simply keeps the OS tracking active.
    console.log('Background location received:', locations[0].coords);
  }
});

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Header />
      
      <View style={styles.mapContainer}>
        <MapScreen />
      </View>
      
      <View style={styles.deckContainer}>
        <AudioDeck />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  deckContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
  }
});
