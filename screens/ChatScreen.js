import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Text,
  TouchableOpacity
} from 'react-native';
import { sendMessage, getMessages, recallMessage, deleteMessage, forwardMessage } from '../services/api';
import { initSocket } from '../services/socket';
import MessageInput from '../components/MessageInput';

const MessageItem = ({ message, currentUserId, onRecall, onDelete, onForward }) => {
  const isCurrentUser = message.senderId === currentUserId;
  const handleForward = () => {
    Alert.prompt('Chuyển tiếp', 'Nhập ID người nhận:', (targetUserId) => {
      if (targetUserId) onForward(message.messageId || message.id, targetUserId);
    });
  };

  return (
    <View style={[styles.messageContainer, isCurrentUser ? styles.right : styles.left]}>
      {message.status === 'recalled' ? (
        <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
      ) : (
        <>
          {message.type === 'text' && <Text>{message.content}</Text>}
          {message.type === 'file' && (
            <Text style={styles.linkText} onPress={() => Linking.openURL(message.mediaUrl)}>
              {message.fileName || 'Tệp đính kèm'}
            </Text>
          )}
          <Text style={styles.timestamp}>{new Date(message.timestamp).toLocaleTimeString()}</Text>
          {isCurrentUser && (
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onRecall(message.messageId || message.id)}>
                <Text style={styles.actionText}>Thu hồi</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(message.messageId || message.id)}>
                <Text style={styles.actionText}>Xóa</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleForward}>
                <Text style={styles.actionText}>Chuyển tiếp</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
};

export default function ChatScreen({ route }) {
  const { userId, token, receiverId, receiverName } = route.params;
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await getMessages(receiverId, token);
        setMessages(response.data?.messages || []);
      } catch (error) {
        Alert.alert('Lỗi', 'Không thể tải tin nhắn. Vui lòng thử lại.');
      }
    };
    fetchMessages();

    const socket = initSocket(userId);
    socket.on('receiveMessage', (msg) => {
      if (
        (msg.senderId === receiverId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === receiverId)
      ) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => socket.disconnect();
  }, [userId, receiverId, token]);

  const handleSendMessage = async (data) => {
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      messageId: tempId,
      senderId: userId,
      receiverId,
      type: data instanceof FormData ? data.get('type') : data.type,
      content: data instanceof FormData ? 'Đang tải...' : data.content,
      fileName: data instanceof FormData ? data.get('fileName') : null,
      mimeType: data instanceof FormData ? data.get('mimeType') : null,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    setMessages((prev) => [...prev, tempMessage]);

    try {
      if (data instanceof FormData) {
        data.append('receiverId', receiverId);
      }
      const payload = data instanceof FormData
        ? data
        : { receiverId, type: data.type, content: data.content };

      const response = await sendMessage(payload, token);
      const msg = response.data?.data;

      if (msg) {
        setMessages((prev) =>
          prev.map((m) => (m.messageId === tempId ? { ...m, ...msg, status: msg.status || 'sent' } : m))
        );
      } else {
        throw new Error('Lỗi từ server');
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) => (m.messageId === tempId ? { ...m, status: 'error' } : m))
      );
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn.');
    }
  };

  const handleRecallMessage = async (id) => {
    try {
      await recallMessage(id, token);
      setMessages((prev) =>
        prev.map((msg) => (msg.messageId === id ? { ...msg, status: 'recalled' } : msg))
      );
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn.');
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      await deleteMessage(id, token);
      setMessages((prev) => prev.filter((msg) => msg.messageId !== id));
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa tin nhắn.');
    }
  };

  const handleForwardMessage = async (id, targetUserId) => {
    try {
      await forwardMessage(id, targetUserId, token);
      Alert.alert('Thành công', 'Đã chuyển tiếp tin nhắn.');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chuyển tiếp tin nhắn.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={64}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.messageId || item.id}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            currentUserId={userId}
            onRecall={handleRecallMessage}
            onDelete={handleDeleteMessage}
            onForward={handleForwardMessage}
          />
        )}
        contentContainerStyle={{ padding: 10 }}
      />
      <MessageInput onSendMessage={handleSendMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  messageContainer: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 10,
    maxWidth: '80%',
    backgroundColor: '#e6e6e6',
  },
  left: { alignSelf: 'flex-start', backgroundColor: '#f1f0f0' },
  right: { alignSelf: 'flex-end', backgroundColor: '#dcf8c6' },
  actions: { flexDirection: 'row', marginTop: 4 },
  actionText: { marginHorizontal: 5, fontSize: 12, color: '#007AFF' },
  recalled: { fontStyle: 'italic', color: '#888' },
  timestamp: { fontSize: 10, color: '#999', marginTop: 5 },
  linkText: { color: '#007AFF', textDecorationLine: 'underline' },
});
