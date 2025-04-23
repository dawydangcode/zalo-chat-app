import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Text,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { sendMessage, getMessages, recallMessage, deleteMessage, forwardMessage, getUserStatus, sendFriendRequest } from '../services/api';
import { initSocket } from '../services/socket';
import MessageInput from '../components/MessageInput';

const MessageItem = ({ message, currentUserId, onRecall, onDelete, onForward, onMarkAsSeen }) => {
  if (!message) {
    console.warn('MessageItem received undefined message');
    return null;
  }

  const isCurrentUser = message.senderId === currentUserId;
  const [showActions, setShowActions] = useState(false);

  const handleForward = () => {
    Alert.prompt('Chuyển tiếp', 'Nhập ID người nhận:', (targetUserId) => {
      if (targetUserId) {
        onForward(message.messageId || message.id, targetUserId);
        setShowActions(false);
      }
    });
  };

  const handleRecall = () => {
    onRecall(message.messageId || message.id);
    setShowActions(false);
  };

  const handleDelete = () => {
    if (message.status === 'recalled') {
      Alert.alert('Thông báo', 'Tin nhắn đã được thu hồi, không thể xóa.');
      return;
    }
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xóa tin nhắn này?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', onPress: () => onDelete(message.messageId || message.id) },
      ],
      { cancelable: true }
    );
    setShowActions(false);
  };

  useEffect(() => {
    if (!isCurrentUser && message.status !== 'seen') {
      onMarkAsSeen(message.messageId || message.id);
    }
  }, [message, isCurrentUser, onMarkAsSeen]);

  return (
    <TouchableOpacity
      onLongPress={() => isCurrentUser && setShowActions(!showActions)}
      activeOpacity={0.8}
    >
      <View style={[styles.messageContainer, isCurrentUser ? styles.right : styles.left]}>
        {message.status === 'recalled' ? (
          <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
        ) : (
          <>
            {message.type === 'text' && <Text>{message.content || '(Không có nội dung)'}</Text>}
            {message.type === 'image' && message.mediaUrl && (
              <Image
                source={{ uri: message.mediaUrl }}
                style={styles.messageImage}
                resizeMode="contain"
                onError={(e) => console.log('Error loading image:', e.nativeEvent.error)}
              />
            )}
            {message.type === 'file' && (
              <Text style={styles.linkText} onPress={() => Linking.openURL(message.mediaUrl || '')}>
                {message.fileName || 'Tệp đính kèm'}
              </Text>
            )}
            <Text style={styles.timestamp}>
              {new Date(message.timestamp || Date.now()).toLocaleTimeString()}
            </Text>
            {isCurrentUser && showActions && (
              <View style={styles.actions}>
                <TouchableOpacity onPress={handleRecall}>
                  <Text style={styles.actionText}>Thu hồi</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete}>
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
    </TouchableOpacity>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { userId, token, receiverId, receiverName } = route.params;
  const [messages, setMessages] = useState([]);
  const [friendStatus, setFriendStatus] = useState('none');
  const socketRef = React.useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    const checkFriendStatus = async () => {
      try {
        if (!token) throw new Error('Không tìm thấy token xác thực.');
        const response = await getUserStatus(receiverId, token);
        const status = response.data.status === 'friend' ? 'friends' : response.data.status;
        setFriendStatus(status);
        console.log('Friend status:', status);
      } catch (error) {
        console.error('Lỗi khi kiểm tra trạng thái bạn bè:', error);
        setFriendStatus('none');
        if (error.response?.status === 401) {
          Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      }
    };
    checkFriendStatus();
  }, [receiverId, token, navigation]);

  useEffect(() => {
    console.log('Setting navigation options...');
    console.log('Receiver name:', receiverName);
    console.log('Friend status:', friendStatus);
    navigation.setOptions({
      headerShown: true,
      headerStyle: { backgroundColor: '#0068ff' },
      headerTintColor: '#fff',
      headerTitle: () => (
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{receiverName || 'Người dùng'}</Text>
          {friendStatus === 'friends' ? (
            <Text style={styles.friendStatus}>Bạn bè</Text>
          ) : (
            <TouchableOpacity
              style={styles.addFriendButton}
              onPress={handleSendFriendRequest}
              disabled={friendStatus === 'pending'}
            >
              <Text style={styles.addFriendText}>
                {friendStatus === 'pending' ? 'Đã gửi' : 'Kết bạn'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, receiverName, friendStatus]);

  const handleSendFriendRequest = async () => {
    try {
      if (!token) throw new Error('Không tìm thấy token xác thực.');
      const response = await sendFriendRequest(receiverId, token);
      if (response.data && response.data.message === 'Đã gửi yêu cầu kết bạn') {
        setFriendStatus('pending');
        Alert.alert('Thành công', 'Đã gửi yêu cầu kết bạn!');
      } else {
        throw new Error(response.data.message || 'Không thể gửi yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi gửi yêu cầu kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 400 && error.response.data.message === 'Friend request already sent') {
        Alert.alert('Thông báo', 'Yêu cầu kết bạn đã được gửi trước đó.');
        setFriendStatus('pending');
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể gửi yêu cầu kết bạn.');
      }
    }
  };

  const markMessageAsSeen = useCallback(
    async (messageId) => {
      if (!messageId) {
        console.warn('Cannot mark message as seen: messageId is undefined');
        return;
      }
      try {
        if (socketRef.current) {
          socketRef.current.emit('markMessageAsSeen', { messageId }, (response) => {
            if (response.success) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg && msg.messageId === messageId ? { ...msg, status: 'seen' } : msg
                )
              );
            } else {
              console.warn('Failed to mark message as seen:', response.error);
            }
          });
        }
      } catch (error) {
        console.error('Error marking message as seen:', error);
      }
    },
    []
  );

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await getMessages(receiverId, token);
        const fetchedMessages = response.data?.messages || [];
        const validMessages = fetchedMessages.filter(
          (msg) => msg && msg.messageId && msg.senderId
        );
        console.log('Fetched messages:', validMessages);
        setMessages(validMessages);
        validMessages.forEach((msg) => {
          if (msg.senderId !== userId && msg.status !== 'seen') {
            markMessageAsSeen(msg.messageId);
          }
        });
      } catch (error) {
        console.error('Error fetching messages:', error);
        if (error.response?.status === 401) {
          Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        } else {
          Alert.alert('Lỗi', 'Không thể tải tin nhắn. Vui lòng thử lại.');
        }
      }
    };
    fetchMessages();

    socketRef.current = initSocket(userId);
    socketRef.current.on('receiveMessage', (msg) => {
      if (!msg || !msg.messageId || !msg.senderId) {
        console.warn('Received invalid message via socket:', msg);
        return;
      }
      if (
        (msg.senderId === receiverId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === receiverId)
      ) {
        setMessages((prev) => {
          const updatedMessages = [...prev, msg];
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
          return updatedMessages;
        });
        if (msg.senderId !== userId && msg.status !== 'seen') {
          markMessageAsSeen(msg.messageId);
        }
      }
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [userId, receiverId, token, markMessageAsSeen]);

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

    setMessages((prev) => {
      const updatedMessages = [...prev, tempMessage];
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return updatedMessages;
    });

    try {
      if (data instanceof FormData) {
        data.append('receiverId', receiverId);
      }
      const payload = data instanceof FormData
        ? data
        : { receiverId, type: data.type, content: data.content };

      const response = await sendMessage(payload, token, data instanceof FormData);
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
      console.error('Error recalling message:', error);
      if (error.response?.status === 403) {
        Alert.alert('Lỗi', error.response.data?.message || 'Bạn không có quyền thu hồi tin nhắn này.');
      } else if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể thu hồi tin nhắn.');
      }
    }
  };

  const handleDeleteMessage = async (id) => {
    try {
      if (!token) {
        throw new Error('Không tìm thấy token xác thực.');
      }
      const response = await deleteMessage(id, token);
      if (response.status === 200) {
        setMessages((prev) => prev.filter((msg) => msg.messageId !== id));
      } else {
        throw new Error('Không thể xóa tin nhắn từ server.');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      if (error.response?.status === 403) {
        Alert.alert(
          'Lỗi',
          error.response.data?.message || 'Bạn không có quyền xóa tin nhắn này.'
        );
      } else if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Tin nhắn không tồn tại hoặc đã bị xóa.');
        setMessages((prev) => prev.filter((msg) => msg.messageId !== id));
      } else {
        Alert.alert(
          'Lỗi',
          error.response?.data?.message || 'Không thể xóa tin nhắn. Vui lòng thử lại.'
        );
      }
    }
  };

  const handleForwardMessage = async (id, targetUserId) => {
    try {
      await forwardMessage(id, targetUserId, token);
      Alert.alert('Thành công', 'Đã chuyển tiếp tin nhắn.');
    } catch (error) {
      console.error('Error forwarding message:', error);
      if (error.response?.status === 403) {
        Alert.alert('Lỗi', error.response.data?.message || 'Bạn không có quyền chuyển tiếp tin nhắn này.');
      } else if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể chuyển tiếp tin nhắn.');
      }
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 70} // Tăng offset để đảm bảo thanh input không che khuất
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.messageId || `temp-${Date.now()}`}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            currentUserId={userId}
            onRecall={handleRecallMessage}
            onDelete={handleDeleteMessage}
            onForward={handleForwardMessage}
            onMarkAsSeen={markMessageAsSeen}
          />
        )}
        contentContainerStyle={{ padding: 10, paddingBottom: 80 }} // Tăng paddingBottom để tin nhắn cuối không bị che
      />
      <MessageInput onSendMessage={handleSendMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  friendStatus: {
    fontSize: 14,
    color: '#28a745',
    marginLeft: 10,
  },
  addFriendButton: {
    backgroundColor: '#007bff',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  addFriendText: {
    color: '#fff',
    fontSize: 14,
  },
  messageContainer: {
    marginVertical: 8,
    padding: 10,
    borderRadius: 10,
    maxWidth: '80%',
    backgroundColor: '#e6e6e6',
  },
  left: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#f1f0f0',
    marginRight: 50,
  },
  right: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#dcf8c6',
    marginLeft: 50,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginVertical: 5,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 4,
    backgroundColor: '#fff',
    padding: 5,
    borderRadius: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  actionText: { marginHorizontal: 10, fontSize: 12, color: '#007AFF' },
  recalled: { fontStyle: 'italic', color: '#888' },
  timestamp: { fontSize: 10, color: '#999', marginTop: 5 },
  linkText: { color: '#007AFF', textDecorationLine: 'underline' },
});