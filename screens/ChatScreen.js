import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { sendMessage, getMessages } from '../services/api';
import { initSocket, getSocket } from '../services/socket';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';

export default function ChatScreen({ route }) {
  const { userId, token, receiverId, receiverName } = route.params;
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await getMessages(receiverId, token);
        setMessages(response.data?.messages || []);
      } catch (error) {
        console.error('Lỗi khi lấy tin nhắn:', error);
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

    return () => {
      socket.disconnect();
    };
  }, [userId, receiverId, token]);

  const handleSendMessage = async (data) => {
    try {
      const messageData = data instanceof FormData ? data : {
        receiverId,
        type: data.type,
        content: data.content,
      };

      if (data instanceof FormData) {
        messageData.append('receiverId', receiverId);
      }

      const tempMessage = {
        messageId: `temp-${Date.now()}`,
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

      const response = await sendMessage(messageData, token);
      if (response.data?.data) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === tempMessage.messageId
              ? {
                  ...msg,
                  messageId: response.data.data.messageId,
                  content: response.data.data.content || msg.content,
                  mediaUrl: response.data.data.mediaUrl,
                  status: response.data.data.status || 'sent',
                }
              : msg
          )
        );
      } else {
        throw new Error('Phản hồi không hợp lệ từ server');
      }
    } catch (error) {
      console.error('Lỗi khi gửi tin nhắn:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.messageId === tempMessage.messageId ? { ...msg, status: 'error' } : msg
        )
      );
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <MessageList messages={messages} currentUserId={userId} />
      <MessageInput onSendMessage={handleSendMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});