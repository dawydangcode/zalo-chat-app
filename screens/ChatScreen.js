import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, FlatList, StyleSheet } from 'react-native';
import { sendMessage, getMessages } from '../services/api';
import { initSocket, getSocket } from '../services/socket';
import MessageBubble from '../components/MessageBubble';

export default function ChatScreen({ route }) {
  const { userId, token, receiverId, receiverName } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await getMessages(receiverId, token);
      setMessages(data.messages);
    };
    fetchMessages();

    const socket = initSocket(userId);
    socket.on('receiveMessage', (msg) => {
      if ((msg.senderId === receiverId && msg.receiverId === userId) || 
          (msg.senderId === userId && msg.receiverId === receiverId)) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => socket.disconnect();
  }, [userId, receiverId, token]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const messageData = {
      receiverId,
      type: 'text',
      content: input,
    };
    const { data } = await sendMessage(messageData, token);
    setMessages((prev) => [...prev, data.data]);
    setInput('');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={({ item }) => <MessageBubble message={item} currentUserId={userId} />}
        keyExtractor={(item) => item.messageId}
        style={styles.messageList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Nhập tin nhắn..."
        />
        <Button title="Gửi" onPress={handleSend} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  messageList: { flex: 1, padding: 10 },
  inputContainer: { flexDirection: 'row', padding: 10 },
  input: { flex: 1, borderWidth: 1, padding: 10, borderRadius: 5, marginRight: 10 },
});