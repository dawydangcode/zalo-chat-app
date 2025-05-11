import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Text,
  TouchableOpacity,
  Linking,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage, getMessages, recallMessage, deleteMessage, forwardMessage, removeFriend, getUserStatus, sendFriendRequest } from '../services/api';
import { initSocket } from '../services/socket';
import MessageInput from '../components/MessageInput';

const MessageItem = ({ message, currentUserId, onRecall, onDelete, onForward }) => {
  if (!message) {
    console.warn('MessageItem nhận được tin nhắn không xác định');
    return null;
  }

  const isCurrentUser = message.senderId === currentUserId;
  const [loading, setLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleForward = () => {
    Alert.prompt('Chuyển tiếp', 'Nhập ID người nhận:', (targetUserId) => {
      if (targetUserId) {
        onForward(message.messageId, targetUserId);
        setShowActions(false);
      }
    });
  };

  const handleRecall = () => {
    onRecall(message.messageId);
    setShowActions(false);
  };

  const handleDelete = () => {
    if (message.status === 'recalled') {
      Alert.alert('Thông báo', 'Tin nhắn đã được thu hồi, không thể xóa.');
      return;
    }
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc chắn muốn xóa tin nhắn này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xóa', onPress: () => onDelete(message.messageId) },
      ],
      { cancelable: true }
    );
    setShowActions(false);
  };

  return (
    <TouchableOpacity
      onLongPress={() => isCurrentUser && setShowActions(!showActions)}
      activeOpacity={0.8}
    >
      <View style={[styles.messageWrapper, isCurrentUser ? styles.rightWrapper : styles.leftWrapper]}>
        {!isCurrentUser && (
          <Image
            source={
              message.sender?.avatar
                ? { uri: message.sender.avatar }
                : { uri: 'https://via.placeholder.com/40' }
            }
            style={styles.avatar}
            onError={(e) => console.log('Lỗi tải ảnh đại diện:', e.nativeEvent.error)}
          />
        )}
        <View style={[styles.messageContainer, isCurrentUser ? styles.right : styles.left]}>
          {message.status === 'recalled' ? (
            <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
          ) : (
            <>
              {message.type === 'text' && (
                <Text style={[styles.messageText, isCurrentUser ? styles.rightText : styles.leftText]}>
                  {message.content || '(Không có nội dung)'}
                </Text>
              )}
              {message.type === 'image' && message.mediaUrl && (
                <>
                  {loading && <ActivityIndicator size="small" color="#007AFF" />}
                  <Image
                    source={{ uri: message.mediaUrl }}
                    style={styles.messageImage}
                    resizeMode="contain"
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onError={(e) => {
                      setLoading(false);
                      console.log('Lỗi tải hình ảnh:', e.nativeEvent.error);
                    }}
                  />
                </>
              )}
              {message.type === 'file' && (
                <Text
                  style={styles.linkText}
                  onPress={() => Linking.openURL(message.mediaUrl || '')}
                >
                  📎 {message.fileName || 'Tệp đính kèm'}
                </Text>
              )}
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
      </View>
    </TouchableOpacity>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { userId, token, receiverId, receiverName } = route.params;
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState(null);

  // Tạo cache key dựa trên receiverId để lưu trữ riêng biệt cho từng cuộc hội thoại
  const cacheKey = `messages_${receiverId}`;

  // Hàm lưu tin nhắn vào AsyncStorage
  const saveMessagesToCache = async (msgs) => {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(msgs));
    } catch (error) {
      console.error('Lỗi lưu tin nhắn vào bộ nhớ đệm:', error);
    }
  };

  // Hàm lấy tin nhắn từ AsyncStorage
  const loadMessagesFromCache = async () => {
    try {
      const cachedMessages = await AsyncStorage.getItem(cacheKey);
      return cachedMessages ? JSON.parse(cachedMessages) : null;
    } catch (error) {
      console.error('Lỗi tải tin nhắn từ bộ nhớ đệm:', error);
      return null;
    }
  };

  // Hàm xử lý xóa cuộc trò chuyện
  const handleDeleteConversation = async () => {
    try {
      setMessages([]);
      await AsyncStorage.removeItem(cacheKey);
      Alert.alert('Thành công', 'Đã xóa cuộc trò chuyện.');
      navigation.goBack();
    } catch (error) {
      console.error('Lỗi xóa cuộc trò chuyện:', error);
      Alert.alert('Lỗi', 'Không thể xóa cuộc trò chuyện. Vui lòng thử lại.');
    }
  };

  // Hàm xử lý chặn người dùng
  const handleBlockUser = async () => {
    try {
      const response = await fetch(`http://192.168.1.9:3000/api/friends/block`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockedUserId: receiverId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert('Thành công', `Đã chặn ${receiverName}.`);
        navigation.goBack();
      } else {
        throw new Error(result.message || 'Không thể chặn người dùng.');
      }
    } catch (error) {
      console.error('Lỗi chặn người dùng:', error);
      if (error.message.includes('401')) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', error.message || 'Không thể chặn người dùng. Vui lòng thử lại.');
      }
    }
  };

  // Hàm xử lý hủy kết bạn
  const handleUnfriend = async () => {
    try {
      const response = await removeFriend(receiverId, token);
      if (response.status === 200 && response.data.success) {
        Alert.alert('Thành công', `Đã hủy kết bạn với ${receiverName}.`);
        setRelationshipStatus('stranger'); // Cập nhật trạng thái quan hệ
        navigation.goBack();
      } else {
        throw new Error(response.data.message || 'Không thể hủy kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi hủy kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể hủy kết bạn. Vui lòng thử lại.');
      }
    }
  };

  // Hàm xử lý gửi lời mời kết bạn
  const handleSendFriendRequest = async () => {
    try {
      const response = await sendFriendRequest(receiverId, token);
      if (response.status === 200 && response.data.success) {
        Alert.alert('Thành công', 'Đã gửi lời mời kết bạn!');
        setRelationshipStatus('pending_sent'); // Cập nhật trạng thái quan hệ
      } else {
        throw new Error(response.data.message || 'Không thể gửi lời mời kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi gửi lời mời kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể gửi lời mời kết bạn. Vui lòng thử lại.');
      }
    }
  };

  // Hàm hiển thị menu tùy chọn
  const showOptionsMenu = () => {
    setOptionsModalVisible(true);
  };

  // Các tùy chọn cho menu
  const options = [
    {
      text: 'Xem thông tin liên hệ',
      onPress: () => {
        setOptionsModalVisible(false);
        navigation.navigate('ContactDetails', { userId: receiverId, name: receiverName });
      },
      style: 'default',
    },
    {
      text: 'Xóa cuộc trò chuyện',
      onPress: () => {
        setOptionsModalVisible(false);
        Alert.alert(
          'Xác nhận',
          'Bạn có chắc chắn muốn xóa cuộc trò chuyện này không?',
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Xóa', onPress: handleDeleteConversation, style: 'destructive' },
          ]
        );
      },
      style: 'destructive',
    },
    {
      text: 'Chặn',
      onPress: () => {
        setOptionsModalVisible(false);
        Alert.alert(
          'Xác nhận',
          `Bạn có chắc chắn muốn chặn ${receiverName} không?`,
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Chặn', onPress: handleBlockUser, style: 'destructive' },
          ]
        );
      },
      style: 'destructive',
    },
    {
      text: 'Hủy kết bạn',
      onPress: () => {
        setOptionsModalVisible(false);
        Alert.alert(
          'Xác nhận',
          `Bạn có chắc chắn muốn hủy kết bạn với ${receiverName} không?`,
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Hủy kết bạn', onPress: handleUnfriend, style: 'destructive' },
          ]
        );
      },
      style: 'destructive',
    },
    {
      text: 'Hủy',
      onPress: () => setOptionsModalVisible(false),
      style: 'cancel',
    },
  ];

  // Lấy trạng thái quan hệ khi màn hình được tải
  useEffect(() => {
    const fetchRelationshipStatus = async () => {
      try {
        const response = await getUserStatus(receiverId, token);
        if (response.data && response.data.status) {
          setRelationshipStatus(response.data.status);
        } else {
          console.warn('Không thể lấy trạng thái quan hệ:', response.data);
          setRelationshipStatus('stranger'); // Mặc định là người lạ nếu không lấy được trạng thái
        }
      } catch (error) {
        console.error('Lỗi khi lấy trạng thái quan hệ:', error);
        setRelationshipStatus('stranger'); // Mặc định là người lạ nếu có lỗi
        if (error.response?.status === 401) {
          Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      }
    };

    fetchRelationshipStatus();
  }, [receiverId, token]);

  // Cập nhật tiêu đề header với trạng thái quan hệ
  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerStyle: { backgroundColor: '#0068ff' },
      headerTintColor: '#fff',
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {receiverName || 'Người dùng'}
          </Text>
          {relationshipStatus && (
            <View style={styles.statusContainer}>
              {relationshipStatus === 'friend' ? (
                <Text style={styles.statusText}>Bạn bè</Text>
              ) : relationshipStatus === 'pending_sent' ? (
                <Text style={styles.statusText}>Đã gửi lời mời</Text>
              ) : relationshipStatus === 'stranger' ? (
                <TouchableOpacity
                  style={styles.addFriendButton}
                  onPress={handleSendFriendRequest}
                >
                  <Text style={styles.addFriendText}>Kết bạn</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={showOptionsMenu} style={styles.headerRight}>
          <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, receiverName, relationshipStatus]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const cachedMessages = await loadMessagesFromCache();
        if (cachedMessages) {
          setMessages(cachedMessages);
        }

        const response = await getMessages(receiverId, token);
        const fetchedMessages = response.data?.messages || [];
        const validMessages = fetchedMessages.filter(
          (msg) => msg && msg.messageId && msg.senderId
        );
        console.log('Tin nhắn đã lấy:', validMessages);
        setMessages(validMessages);
        saveMessagesToCache(validMessages);
      } catch (error) {
        console.error('Lỗi lấy tin nhắn:', error);
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
        console.warn('Nhận được tin nhắn không hợp lệ qua socket:', msg);
        return;
      }
      if (
        (msg.senderId === receiverId && msg.receiverId === userId) ||
        (msg.senderId === userId && msg.receiverId === receiverId)
      ) {
        setMessages((prev) => {
          const updatedMessages = [...prev, msg];
          saveMessagesToCache(updatedMessages);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
          return updatedMessages;
        });
      }
    });

    return () => {
      socketRef.current.disconnect();
    };
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

    setMessages((prev) => {
      const updatedMessages = [...prev, tempMessage];
      saveMessagesToCache(updatedMessages);
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
        setMessages((prev) => {
          const updatedMessages = prev.map((m) =>
            m.messageId === tempId ? { ...m, ...msg, status: msg.status || 'sent' } : m
          );
          saveMessagesToCache(updatedMessages);
          return updatedMessages;
        });
      } else {
        throw new Error('Lỗi từ server');
      }
    } catch (error) {
      setMessages((prev) => {
        const updatedMessages = prev.map((m) =>
          m.messageId === tempId ? { ...m, status: 'error' } : m
        );
        saveMessagesToCache(updatedMessages);
        return updatedMessages;
      });
      Alert.alert('Lỗi', 'Không thể gửi tin nhắn.');
    }
  };

  const handleRecallMessage = async (id) => {
    try {
      await recallMessage(id, token);
      setMessages((prev) => {
        const updatedMessages = prev.map((msg) =>
          msg.messageId === id ? { ...msg, status: 'recalled' } : msg
        );
        saveMessagesToCache(updatedMessages);
        return updatedMessages;
      });
    } catch (error) {
      console.error('Lỗi thu hồi tin nhắn:', error);
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
        setMessages((prev) => {
          const updatedMessages = prev.filter((msg) => msg.messageId !== id);
          saveMessagesToCache(updatedMessages);
          return updatedMessages;
        });
      } else {
        throw new Error('Không thể xóa tin nhắn từ server.');
      }
    } catch (error) {
      console.error('Lỗi xóa tin nhắn:', error);
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
        setMessages((prev) => {
          const updatedMessages = prev.filter((msg) => msg.messageId !== id);
          saveMessagesToCache(updatedMessages);
          return updatedMessages;
        });
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
      console.error('Lỗi chuyển tiếp tin nhắn:', error);
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

  const memoizedMessages = useMemo(() => messages, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      <FlatList
        ref={flatListRef}
        data={memoizedMessages}
        keyExtractor={(item) => item.messageId || `temp-${Date.now()}`}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            currentUserId={userId}
            onRecall={handleRecallMessage}
            onDelete={handleDeleteMessage}
            onForward={handleForwardMessage}
          />
        )}
        contentContainerStyle={styles.flatListContent}
      />
      <MessageInput onSendMessage={handleSendMessage} style={styles.messageInput} />

      {/* Custom Options Modal */}
      <Modal
        visible={isOptionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tùy chọn</Text>
            <ScrollView style={styles.optionsContainer}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionItem,
                    option.style === 'destructive' && styles.destructiveOption,
                    option.style === 'cancel' && styles.cancelOption,
                  ]}
                  onPress={option.onPress}
                >
                  <Text
                    style={[
                      styles.optionText,
                      option.style === 'destructive' && styles.destructiveText,
                      option.style === 'cancel' && styles.cancelText,
                    ]}
                  >
                    {option.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flatListContent: {
    padding: 15,
    paddingBottom: 90,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: {
    marginLeft: 10,
  },
  headerRight: {
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
  statusContainer: {
    marginLeft: 5,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
  },
  addFriendButton: {
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  addFriendText: {
    color: '#0068ff',
    fontSize: 12,
    fontWeight: '500',
  },
  messageWrapper: {
    marginVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  leftWrapper: {
    justifyContent: 'flex-start',
  },
  rightWrapper: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  messageContainer: {
    padding: 10,
    borderRadius: 15,
    maxWidth: '75%',
  },
  left: {
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  right: {
    backgroundColor: '#e1f0ff',
    borderRadius: 15,
  },
  messageText: {
    fontSize: 16,
  },
  leftText: {
    color: '#000',
  },
  rightText: {
    color: '#000',
  },
  messageImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginVertical: 5,
  },
  recalled: {
    fontStyle: 'italic',
    color: '#888',
    fontSize: 14,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  actionText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  messageInput: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#000',
  },
  destructiveOption: {
    borderBottomColor: '#ff3b30',
  },
  destructiveText: {
    color: '#ff3b30',
  },
  cancelOption: {
    borderBottomWidth: 0,
  },
  cancelText: {
    color: '#007AFF',
    fontWeight: '500',
  },
});