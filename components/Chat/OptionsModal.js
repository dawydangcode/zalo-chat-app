// components/Chat/OptionsModal.js
import React from 'react';
import { Modal, TouchableOpacity, View, Text, ScrollView, StyleSheet } from 'react-native';

const OptionsModal = ({ visible, onClose, options }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Tùy chọn</Text>
          <ScrollView style={styles.optionsContainer}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionItem,
                  option.style === 'destructive' && styles.destructiveOption,
                  option.style === 'cancel' && styles.cancelOption,
                ]}
                onPress={option.onPress}
              >
                <Text
                  style={[
                    styles.optionText,
                    option.style === 'destructive' && styles.destructiveText,
                    option.style === 'cancel' && styles.cancelText,
                  ]}
                >
                  {option.label} {/* Thay option.text thành option.label */}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  destructiveOption: {
    borderBottomColor: '#ff3b30',
  },
  destructiveText: {
    color: '#ff3b30',
  },
  cancelOption: {
    borderBottomWidth: 0,
  },
  cancelText: {
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default OptionsModal;