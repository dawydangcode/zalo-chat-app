import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MessageBubble({ message, currentUserId }) {
  const isSentByCurrentUser = message.senderId === currentUserId;

  return (
    <View style={[styles.bubble, isSentByCurrentUser ? styles.sent : styles.received]}>
      <Text style={styles.text}>{message.content}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { padding: 10, borderRadius: 10, marginVertical: 5, maxWidth: '70%' },
  sent: { backgroundColor: '#007AFF', alignSelf: 'flex-end' },
  received: { backgroundColor: '#E5E5EA', alignSelf: 'flex-start' },
  text: { color: '#fff' },
});