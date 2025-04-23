import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Alert, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';

export default function MessageInput({ onSendMessage }) {
  const [message, setMessage] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const mediaOptions = [
    { label: 'Chọn ảnh từ thư viện', value: 'image' },
    { label: 'Chọn video từ thư viện', value: 'video' },
  ];

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage({ type: 'text', content: message });
      setMessage('');
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'text/plain',
          'application/zip',
        ],
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
    if (!selectedMedia) {
      Alert.alert('Lỗi', 'Vui lòng chọn loại media.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: selectedMedia === 'image' ? ['image/*'] : ['video/mp4'],
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
          type: file.mimeType || (selectedMedia === 'image' ? 'image/jpeg' : 'video/mp4'),
        });
        formData.append('type', selectedMedia);
        formData.append('fileName', file.name || 'media');
        formData.append('mimeType', file.mimeType || (selectedMedia === 'image' ? 'image/jpeg' : 'video/mp4'));

        onSendMessage(formData);
        setSelectedMedia(null);
      }
    } catch (error) {
      console.error('Lỗi khi chọn media:', error);
      Alert.alert('Lỗi', 'Không thể chọn media. Vui lòng thử lại.');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={message}
        onChangeText={setMessage}
        placeholder="Nhập tin nhắn..."
        multiline
      />
      <TouchableOpacity onPress={pickFile}>
        <View style={styles.icon}>
          <Text>📎</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedMedia}
          onValueChange={(value) => setSelectedMedia(value)}
          style={styles.picker}
        >
          <Picker.Item label="Chọn media" value={null} />
          {mediaOptions.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
      <TouchableOpacity onPress={pickMedia}>
        <View style={styles.icon}>
          <Text>📷</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleSend}>
        <View style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Gửi</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 10,
    backgroundColor: '#fff',
    maxHeight: 100,
  },
  icon: {
    padding: 10,
  },
  pickerContainer: {
    width: 150,
    height: 40,
    justifyContent: 'center',
  },
  picker: {
    height: 40,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});