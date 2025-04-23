import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons'; // Ensure @expo/vector-icons is installed
import { SafeAreaView } from 'react-native-safe-area-context'; // For safe area handling

export default function MessageInput({ onSendMessage }) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage({ type: 'text', content: message });
      setMessage('');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/zip'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
          Alert.alert('Lỗi', 'File quá lớn! Kích thước tối đa là 100MB.');
          return;
        }

        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name || 'file',
          type: file.mimeType || 'application/octet-stream',
        });
        formData.append('type', 'file');
        formData.append('fileName', file.name || 'file');
        formData.append('mimeType', file.mimeType || 'application/octet-stream');

        onSendMessage(formData);
      }
    } catch (error) {
      console.error('Lỗi khi chọn file:', error);
      Alert.alert('Lỗi', 'Không thể chọn file. Vui lòng thử lại.');
    }
  };

  const pickMedia = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'video/mp4'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
          Alert.alert('Lỗi', 'File quá lớn! Kích thước tối đa là 100MB.');
          return;
        }

        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          name: file.name || 'media',
          type: file.mimeType || 'application/octet-stream',
        });
        formData.append('type', file.mimeType?.includes('image') ? 'image' : 'video');
        formData.append('fileName', file.name || 'media');
        formData.append('mimeType', file.mimeType || 'application/octet-stream');

        onSendMessage(formData);
      }
    } catch (error) {
      console.error('Lỗi khi chọn media:', error);
      Alert.alert('Lỗi', 'Không thể chọn media. Vui lòng thử lại.');
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        <TouchableOpacity onPress={pickFile} style={styles.iconButton}>
          <Ionicons name="attach" size={24} color="#555" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity onPress={pickMedia} style={styles.iconButton}>
          <Ionicons name="camera" size={24} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  input: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
    maxHeight: 80,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  iconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});