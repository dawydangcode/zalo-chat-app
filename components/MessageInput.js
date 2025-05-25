import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MessageInput({ onSendMessage, chat }) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const textInputRef = useRef(null);

  const targetUser = chat?.receiverName || 'Người dùng';

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage({ type: 'text', content: message }, () => {});
    setMessage('');
    if (textInputRef.current) {
      textInputRef.current.clear();
    }
  };

  const handleFileUpload = async (isImageOnly = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: isImageOnly
          ? ['image/jpeg', 'image/png', 'image/gif'] // Chỉ cho phép ảnh
          : ['video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'application/zip', 'application/x-rar-compressed'], // Chỉ cho phép video và tài liệu
        multiple: true, // Cho phép chọn nhiều tệp
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsUploading(true);
        const files = result.assets;

        if (isImageOnly && files.length > 1) {
          // Gửi nhiều ảnh cùng lúc
          const mediaUris = files
            .filter((file) => {
              const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
              const maxSize = 100 * 1024 * 1024; // 100MB
              if (file.size > maxSize) {
                Alert.alert('Lỗi', `Tệp ${file.name} quá lớn! Kích thước tối đa là 100MB.`);
                return false;
              }
              if (!allowedTypes.includes(file.mimeType)) {
                Alert.alert('Lỗi', `Định dạng tệp ${file.name} không được hỗ trợ! Vui lòng chọn ảnh (JPEG, PNG, GIF).`);
                return false;
              }
              return true;
            })
            .map((file) => file.uri);

          if (mediaUris.length > 0) {
            await new Promise((resolve) => {
              onSendMessage({ type: 'image', mediaUris }, () => resolve());
            });
          }
        } else {
          // Gửi từng tệp riêng lẻ (cho video, tài liệu hoặc ảnh đơn)
          for (const file of files) {
            const maxSize = 100 * 1024 * 1024; // 100MB
            if (file.size > maxSize) {
              Alert.alert('Lỗi', `Tệp ${file.name} quá lớn! Kích thước tối đa là 100MB.`);
              continue;
            }

            const allowedTypes = isImageOnly
              ? ['image/jpeg', 'image/png', 'image/gif']
              : ['video/mp4', 'video/webm', 'video/quicktime', 'application/pdf', 'application/zip', 'application/x-rar-compressed'];

            if (!allowedTypes.includes(file.mimeType)) {
              Alert.alert(
                'Lỗi',
                `Định dạng tệp ${file.name} không được hỗ trợ! Vui lòng chọn ${
                  isImageOnly ? 'ảnh (JPEG, PNG, GIF)' : 'video (MP4, WebM, MOV) hoặc tài liệu (PDF, ZIP, RAR)'
                }.`
              );
              continue;
            }

            let messageType = 'file';
            let mimeType = file.mimeType;
            if (file.mimeType.startsWith('image/')) {
              messageType = 'image';
            } else if (file.mimeType.startsWith('video/')) {
              messageType = 'video';
              if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimeType)) {
                mimeType = 'video/mp4';
              }
            } else if (file.mimeType === 'application/pdf') {
              messageType = 'pdf';
            } else if (file.mimeType === 'application/zip' || file.mimeType === 'application/x-rar-compressed') {
              messageType = 'zip';
            }

            const formData = new FormData();
            formData.append('file', {
              uri: file.uri,
              name: file.name || `file.${file.mimeType.split('/')[1] || 'mp4'}`,
              type: mimeType,
            });
            formData.append('type', messageType);
            formData.append('fileName', file.name || `file.${file.mimeType.split('/')[1] || 'mp4'}`);
            formData.append('mimeType', mimeType);

            const formDataEntries = {};
            for (const [key, value] of formData.entries()) {
              formDataEntries[key] = typeof value === 'object' && value.uri ? { ...value, uri: value.uri } : value;
            }
            console.log(`Gửi tệp ${file.name || 'file'}:`, formDataEntries);

            await new Promise((resolve) => {
              onSendMessage(formData, () => resolve());
            });
          }
        }
      }
    } catch (error) {
      console.error('Lỗi khi chọn tệp:', error);
      Alert.alert('Lỗi', 'Không thể chọn tệp. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStickerClick = () => {
    Alert.alert('Thông báo', 'Chức năng sticker sẽ được triển khai sau!');
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {isUploading && (
          <View style={styles.uploadingIndicator}>
            <ActivityIndicator size="small" color="#0068ff" />
          </View>
        )}
        <TouchableOpacity
          onPress={handleStickerClick}
          style={styles.iconButton}
          disabled={isUploading}
        >
          <Ionicons name="happy-outline" size={24} color={isUploading ? '#ccc' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleFileUpload(true)} // Chỉ tải ảnh
          style={styles.iconButton}
          disabled={isUploading}
        >
          <Ionicons name="image-outline" size={24} color={isUploading ? '#ccc' : '#666'} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleFileUpload(false)} // Chỉ tải video và tài liệu
          style={styles.iconButton}
          disabled={isUploading}
        >
          <Ionicons name="attach-outline" size={24} color={isUploading ? '#ccc' : '#666'} />
        </TouchableOpacity>
        <TextInput
          ref={textInputRef}
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder={`Gửi tin nhắn tới ${targetUser}`}
          placeholderTextColor="#999"
          multiline
          onContentSizeChange={(e) =>
            textInputRef.current.setNativeProps({
              style: {
                height: Math.min(Math.max(e.nativeEvent.contentSize.height, 40), 80),
              },
            })
          }
          editable={!isUploading}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={handleSend}
          style={styles.sendButton}
          disabled={isUploading}
        >
          <Ionicons name="send" size={24} color={isUploading ? '#ccc' : '#0068ff'} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    paddingVertical: Platform.OS === 'ios' ? 10 : 5,
    paddingHorizontal: 10,
    color: '#333',
    minHeight: 40,
    maxHeight: 80,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 5,
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
  uploadingIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
});