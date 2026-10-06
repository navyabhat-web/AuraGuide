import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Settings } from 'lucide-react-native';
import { AdminSettingsModal } from './AdminSettingsModal';

export const Header = () => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.brandText}>AuraGuide</Text>
      <TouchableOpacity 
        style={styles.adminButton} 
        onPress={() => setModalVisible(true)}
      >
        <Settings color="#333" size={24} />
      </TouchableOpacity>
      
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <AdminSettingsModal onClose={() => setModalVisible(false)} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 10,
  },
  brandText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ff4d8b',
    letterSpacing: 1,
  },
  adminButton: {
    padding: 8,
  }
});
