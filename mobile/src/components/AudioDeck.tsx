import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { usePOIStore } from '../store/usePOIStore';
import { Play, Pause, Square, Trash2 } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export const AudioDeck = () => {
  const { originPOI, queuedAudio, removeQueuedAudio } = usePOIStore();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const queuedItem = originPOI ? queuedAudio[originPOI.id] : null;

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const togglePlayback = async () => {
    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    if (!queuedItem || !queuedItem.audioBase64) return;

    setIsLoading(true);
    try {
      // expo-av needs a file URI to play, so we write the base64 to a temporary file
      const uri = FileSystem.cacheDirectory + 'temp_audio.mp3';
      await FileSystem.writeAsStringAsync(uri, queuedItem.audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        }
      });
      
      setSound(newSound);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing audio", error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopPlayback = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      setIsPlaying(false);
    }
  };

  const handleRemove = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
    if (originPOI) {
      removeQueuedAudio(originPOI.id);
    }
  };

  if (!originPOI) return null;

  return (
    <View style={styles.container}>
      <View style={styles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.poiName} numberOfLines={1}>{originPOI.name}</Text>
          <Text style={styles.poiCategory}>{originPOI.category}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleRemove}>
          <Trash2 color="#999" size={20} />
        </TouchableOpacity>
      </View>
      
      {queuedItem ? (
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.stopBtn} onPress={stopPlayback}>
            <Square color="#333" size={20} fill="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.playBtn} onPress={togglePlayback} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : isPlaying ? (
              <Pause color="#fff" size={24} fill="#fff" />
            ) : (
              <Play color="#fff" size={24} fill="#fff" style={{ marginLeft: 3 }} />
            )}
          </TouchableOpacity>
          <View style={styles.statusContainer}>
             <Text style={styles.statusText}>{isPlaying ? 'Playing...' : 'Ready in Queue'}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#ff4d8b" size="small" />
          <Text style={styles.loadingText}>Generating AI Audio...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30, // Safe area for modern phones
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poiName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  poiCategory: {
    fontSize: 14,
    color: '#ff4d8b',
    marginTop: 2,
    fontWeight: '500',
  },
  deleteBtn: {
    padding: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ff4d8b',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    elevation: 4,
    shadowColor: '#ff4d8b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  stopBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    width: 48, // Balances the layout
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  }
});
