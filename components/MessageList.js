import React, { useEffect, useRef } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';

export default function MessageList({ messages, currentUserId }) {
  const flatListRef = useRef(null);

  useEffect(() => {
    if (messages?.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const convertS3UriToObjectUrl = (s3Uri) => {
    if (!s3Uri || !s3Uri.startsWith('s3://')) {
      return s3Uri;
    }
    const bucketName = 'my-chat-app-zalo123';
    const region = 'ap-southeast-2';
    const path = s3Uri.replace(`s3://${bucketName}/`, '');
    return `https://${bucketName}.s3.${region}.amazonaws.com/${path}`;
  };

  const renderMessageContent = (msg) => {
    switch (msg.type) {
      case 'image':
        const imageUrl = convertS3UriToObjectUrl(msg.mediaUrl);
        return (
          <Image
            source={{ uri: imageUrl || 'https://via.placeholder.com/200' }}
            style={styles.media}
            onError={() => Alert.alert('Lỗi', 'Không thể tải ảnh.')}
          />
        );
      case 'video':
        return (
          <Text style={styles.errorText}>Video không được hỗ trợ trong phiên bản này.</Text>
        );
      case 'file':
        const fileUrl = convertS3UriToObjectUrl(msg.mediaUrl);
        return (
          <TouchableOpacity onPress={() => Alert.alert('Tải file', `Tải ${msg.fileName || 'file'}`)}>
            <Text style={styles.fileLink}>{msg.fileName || 'Tải file'}</Text>
          </TouchableOpacity>
        );
      case 'text':
      default:
        return <Text style={styles.messageText}>{msg.content}</Text>;
    }
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.messageContainer,
        item.senderId === currentUserId ? styles.sent : styles.received,
      ]}
    >
      {item.status === 'recalled' ? (
        <Text style={styles.recalledText}>(Tin nhắn đã thu hồi)</Text>
      ) : (
        <>
          {renderMessageContent(item)}
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString()}
          </Text>
        </>
      )}
    </View>
  );

  if (!currentUserId) {
    return (
      <View style={styles.emptyContainer}>
        <Text>Lỗi: Vui lòng đăng nhập lại.</Text>
      </View>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text>Chưa có tin nhắn nào</Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={(item) => item.messageId || item.id}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 10,
  },
  messageContainer: {
    marginVertical: 5,
    padding: 10,
    borderRadius: 10,
    maxWidth: '80%',
  },
  sent: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
  },
  received: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    textAlign: 'right',
  },
  media: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  fileLink: {
    fontSize: 16,
    color: '#005AE0',
    textDecorationLine: 'underline',
  },
  errorText: {
    fontSize: 16,
    color: '#e63946',
  },
  recalledText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});