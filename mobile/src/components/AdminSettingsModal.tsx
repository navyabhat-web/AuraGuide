import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { usePOIStore } from '../store/usePOIStore';
import { X } from 'lucide-react-native';

const LANGUAGES = ['English', 'Kannada', 'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Tulu', 'Konkani'];
const PERSONAS = ['Female', 'Male'];

export const AdminSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { adminSettings, updateAdminSettings } = usePOIStore();

  return (
    <SafeAreaView style={styles.overlay}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin Settings</Text>
          <TouchableOpacity onPress={onClose}>
            <X color="#333" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agent Language</Text>
          <View style={styles.optionsGrid}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity 
                key={lang} 
                style={[styles.optionBtn, adminSettings.language === lang && styles.activeOption]}
                onPress={() => updateAdminSettings({ language: lang })}
              >
                <Text style={[styles.optionText, adminSettings.language === lang && styles.activeText]}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Persona</Text>
          <View style={styles.optionsRow}>
            {PERSONAS.map(persona => (
              <TouchableOpacity 
                key={persona} 
                style={[styles.optionBtn, { flex: 1, marginHorizontal: 5 }, adminSettings.voicePersona === persona && styles.activeOption]}
                onPress={() => updateAdminSettings({ voicePersona: persona as 'Male' | 'Female' })}
              >
                <Text style={[styles.optionText, adminSettings.voicePersona === persona && styles.activeText]}>{persona}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
          <Text style={styles.saveBtnText}>Save & Close</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#666',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -5,
  },
  optionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 5,
  },
  activeOption: {
    backgroundColor: '#ff4d8b',
  },
  optionText: {
    color: '#333',
    fontWeight: '500',
  },
  activeText: {
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
