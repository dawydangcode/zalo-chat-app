import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
        <TouchableOpacity onPress={() => {}} style={styles.iconButton}>
          <Ionicons name="happy-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFile} style={styles.iconButton}>
          <Ionicons name="attach-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={pickMedia} style={styles.iconButton}>
          <Ionicons name="camera-outline" size={24} color="#666" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Nhắn tin..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
          <Ionicons name="send" size={24} color="#0068ff" />
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
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
    color: '#333',
    maxHeight: 80,
  },
  iconButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});