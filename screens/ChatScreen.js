import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import MessageInput from '../components/MessageInput';
import CreateGroupModal from './CreateGroupModal';
import { initializeSocket, getSocket, disconnectSocket } from '../services/socket';
import { sendMessage } from '../services/api';

// Component MessageItem
const MessageItem = ({ message, currentUserId, onRecall, onDelete, onForward, isGroup }) => {
  if (!message) {
    console.warn('MessageItem nhận được tin nhắn không xác định');
    return null;
  }

  console.log('Rendering message:', {
    messageId: message.messageId || message.id || message.tempId,
    content: message.content,
    type: message.type,
    status: message.status,
    senderId: message.senderId,
  });

  const isCurrentUser = message.senderId === currentUserId;
  const [loading, setLoading] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleForward = () => {
    Alert.prompt('Chuyển tiếp', 'Nhập ID người nhận:', (receiverId) => {
      if (receiverId) {
        onForward(message.messageId || message.id || message.tempId, receiverId);
        setShowActions(false);
      }
    });
  };

  const handleRecall = () => {
    onRecall(message.messageId || message.id || message.tempId);
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
        { text: 'Xóa', onPress: () => onDelete(message.messageId || message.id || message.tempId) },
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
                : { uri: 'https://picsum.photos/40' }
            }
            style={styles.avatar}
            onError={(e) => console.log('Lỗi tải ảnh đại diện:', e.nativeEvent.error)}
          />
        )}
        <View style={[styles.messageContainer, isCurrentUser ? styles.right : styles.left]}>
          {isGroup && !isCurrentUser && (
            <Text style={styles.senderName}>{message.sender?.name || 'Người dùng'}</Text>
          )}
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
              {message.type === 'file' && message.mediaUrl && (
                <Text
                  style={styles.linkText}
                  onPress={() => Linking.openURL(message.mediaUrl).catch((err) => console.error('Lỗi mở URL:', err))}
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
          {message.status === 'error' && (
            <Text style={styles.errorText}>Lỗi gửi tin nhắn</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { userId, token, receiverId, receiverName, avatar, isGroup = false, groupId } = route.params;
  const [messages, setMessages] = useState([]);
  const [friendStatus, setFriendStatus] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const chatSocketRef = useRef(null);
  const groupSocketRef = useRef(null);
  const flatListRef = useRef(null);

  const API_BASE_URL = 'http://192.168.1.3:3000';

  const cacheKey = isGroup ? `messages_group_${groupId}` : `messages_${receiverId}`;

  const saveMessagesToCache = async (msgs) => {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(msgs));
    } catch (error) {
      console.error('Lỗi lưu tin nhắn vào bộ nhớ đệm:', error);
    }
  };

  const loadMessagesFromCache = async () => {
    try {
      const cachedMessages = await AsyncStorage.getItem(cacheKey);
      return cachedMessages ? JSON.parse(cachedMessages) : null;
    } catch (error) {
      console.error('Lỗi tải tin nhắn từ bộ nhớ đệm:', error);
      return null;
    }
  };

  const markMessagesAsSeen = async () => {
    if (isGroup) return;
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/messages/user/${receiverId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        const unreadMessages = response.data.messages.filter(
          (msg) => msg.status === 'SENT' || msg.status === 'DELIVERED'
        );
        for (const msg of unreadMessages) {
          await axios.patch(
            `${API_BASE_URL}/api/messages/seen/${msg.messageId}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      }
    } catch (error) {
      console.error('Lỗi đánh dấu tin nhắn đã xem:', error);
    }
  };

  const fetchRecentChats = async () => {
    try {
      console.log('Gửi yêu cầu lấy danh sách cuộc trò chuyện');
      const response = await axios.get(`${API_BASE_URL}/api/conversations/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      console.log('Phản hồi danh sách cuộc trò chuyện:', response.data);
      if (response.data.success) {
        const conversations = response.data.data?.conversations || [];
        const groups = response.data.data?.groups || [];
        const formattedChats = [
          ...conversations.map((conv) => ({
            id: conv.otherUserId,
            name: conv.displayName || 'Không có tên',
            isGroup: false,
          })),
          ...groups.map((group) => ({
            id: group.groupId,
            name: group.name || 'Nhóm không tên',
            isGroup: true,
            avatar: group.avatar,
          })),
        ];
        console.log('Formatted chats:', formattedChats);
        setRecentChats(formattedChats);
      }
    } catch (error) {
      console.error('Lỗi lấy danh sách cuộc trò chuyện:', error.message, error.stack);
      if (error.message.includes('Network Error')) {
        Alert.alert('Lỗi mạng', 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
      } else {
        Alert.alert('Lỗi', 'Không thể tải danh sách cuộc trò chuyện.');
      }
      setRecentChats([]);
    }
  };

  const refreshToken = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      console.log('Refresh token:', refreshToken);
      if (!refreshToken) throw new Error('Không tìm thấy refresh token');
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken,
      });
      console.log('Phản hồi refresh token:', response.data);
      const newToken = response.data.token;
      await AsyncStorage.setItem('token', newToken);
      return newToken;
    } catch (error) {
      console.error('Lỗi làm mới token:', error);
      Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      throw error;
    }
  };

  const handleDeleteConversation = async () => {
    try {
      setMessages([]);
      await AsyncStorage.removeItem(cacheKey);
      Alert.alert('Thành công', `Đã xóa ${isGroup ? 'lịch sử nhóm' : 'cuộc trò chuyện'}.`);
      navigation.goBack();
    } catch (error) {
      console.error('Lỗi xóa cuộc trò chuyện:', error);
      Alert.alert('Lỗi', 'Không thể xóa. Vui lòng thử lại.');
    }
  };

  const handleBlockUser = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/friends/block`,
        { blockedUserId: receiverId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', `Đã chặn ${receiverName}.`);
        navigation.goBack();
      } else {
        throw new Error(response.data.message || 'Không thể chặn người dùng.');
      }
    } catch (error) {
      console.error('Lỗi chặn người dùng:', error);
      Alert.alert('Lỗi', error.message || 'Không thể chặn người dùng.');
    }
  };

  const handleUnfriend = async () => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/api/friends/remove/${receiverId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', `Đã hủy kết bạn với ${receiverName}.`);
        setFriendStatus('stranger');
        navigation.goBack();
      } else {
        throw new Error(response.data.message || 'Không thể hủy kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi hủy kết bạn:', error);
      Alert.alert('Lỗi', error.message || 'Không thể hủy kết bạn.');
    }
  };

  const handleAddFriendRequest = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/friends/send`,
        {
          receiverId,
          message: `Xin chào, mình là ${userId}, hãy kết bạn với mình nhé!`,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã gửi yêu cầu kết bạn!');
        setFriendStatus('pending_sent');
      } else {
        throw new Error(response.data.message || 'Không thể gửi lời mời kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi gửi lời mời kết bạn:', error);
      Alert.alert('Lỗi', error.message || 'Không thể gửi lời mời kết bạn.');
    }
  };

  const handleAcceptRequest = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/friends/received`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const request = response.data.find((req) => req.senderId === receiverId);
      if (!request) {
        Alert.alert('Lỗi', 'Không tìm thấy lời mời kết bạn từ người này.');
        return;
      }
      const acceptResponse = await axios.post(
        `${API_BASE_URL}/api/friends/accept`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { requestId: request.requestId },
        }
      );
      if (acceptResponse.data.success) {
        Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn!');
        setFriendStatus('friend');
      } else {
        throw new Error(acceptResponse.data.message || 'Không thể chấp nhận lời mời.');
      }
    } catch (error) {
      console.error('Lỗi chấp nhận lời mời:', error);
      Alert.alert('Lỗi', error.message || 'Không thể chấp nhận lời mời.');
    }
  };

  const handleLeaveGroup = async () => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/groups/${groupId}/leave`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã rời nhóm.');
        navigation.goBack();
      } else {
        throw new Error(response.data.message || 'Không thể rời nhóm.');
      }
    } catch (error) {
      console.error('Lỗi rời nhóm:', error);
      Alert.alert('Lỗi', error.message || 'Không thể rời nhóm.');
    }
  };

  const handleAddMemberClick = () => {
    if (isGroup) {
      Alert.alert('Thông báo', 'Chức năng thêm thành viên nhóm sẽ được triển khai sau!');
    } else {
      setIsCreateGroupModalOpen(true);
    }
  };

  const handleGroupCreated = (newGroup) => {
    Alert.alert('Thành công', `Nhóm "${newGroup.name}" đã được tạo thành công!`);
    setIsCreateGroupModalOpen(false);
    navigation.navigate('ChatScreen', {
      userId,
      token,
      groupId: newGroup.groupId,
      receiverName: newGroup.name,
      avatar: newGroup.avatar,
      isGroup: true,
    });
  };

  const showOptionsMenu = () => {
    setOptionsModalVisible(true);
  };

  const options = isGroup
    ? [
        {
          text: 'Xem thông tin nhóm',
          onPress: () => {
            setOptionsModalVisible(false);
            navigation.navigate('GroupDetails', { groupId, groupName: receiverName });
          },
          style: 'default',
        },
        {
          text: 'Xóa lịch sử trò chuyện',
          onPress: () => {
            setOptionsModalVisible(false);
            Alert.alert(
              'Xác nhận',
              'Bạn có chắc chắn muốn xóa lịch sử trò chuyện này không?',
              [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Xóa', onPress: handleDeleteConversation, style: 'destructive' },
              ]
            );
          },
          style: 'destructive',
        },
        {
          text: 'Rời nhóm',
          onPress: () => {
            setOptionsModalVisible(false);
            Alert.alert(
              'Xác nhận',
              'Bạn có chắc chắn muốn rời nhóm này không?',
              [
                { text: 'Hủy', style: 'cancel' },
                { text: 'Rời nhóm', onPress: handleLeaveGroup, style: 'destructive' },
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
      ]
    : [
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

  useEffect(() => {
    const initialize = async () => {
      console.log('route.params:', route.params);
      if (!userId || !token || (!receiverId && !isGroup)) {
        console.warn('Thiếu tham số cần thiết:', { userId, token, receiverId, isGroup });
        Alert.alert('Lỗi', 'Thiếu thông tin cần thiết để mở trò chuyện.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      if (isGroup && (!groupId || typeof groupId !== 'string')) {
        console.warn('Thiếu hoặc groupId không hợp lệ:', groupId);
        Alert.alert('Lỗi', `Không thể mở trò chuyện nhóm. groupId: ${groupId || 'thiếu'}`);
        navigation.goBack();
        return;
      }

      const fetchMessages = async () => {
        try {
          const cachedMessages = await loadMessagesFromCache();
          if (cachedMessages) {
            setMessages(cachedMessages);
          }

          const endpoint = isGroup
            ? `${API_BASE_URL}/api/groups/messages/${groupId}`
            : `${API_BASE_URL}/api/messages/user/${receiverId}`;
          console.log('Gửi yêu cầu lấy tin nhắn:', endpoint);
          const response = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          });
          console.log('Phản hồi lấy tin nhắn:', response.data);

          if (response.data.success) {
            const fetchedMessages = isGroup
              ? response.data.data.messages || []
              : response.data.messages || [];
            setMessages(fetchedMessages);
            saveMessagesToCache(fetchedMessages);
          } else {
            setMessages([]);
          }
        } catch (error) {
          console.error('Lỗi lấy tin nhắn:', error.message, error.stack);
          if (error.message.includes('Network Error')) {
            Alert.alert('Lỗi mạng', 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
          } else {
            Alert.alert('Lỗi', 'Không thể tải tin nhắn. Vui lòng thử lại.');
          }
          if (error.response?.status === 401) {
            try {
              const newToken = await refreshToken();
              route.params.token = newToken;
            } catch (err) {
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
          }
        }
      };

      const fetchFriendStatus = async () => {
        if (isGroup) return;
        try {
          console.log('Gửi yêu cầu lấy trạng thái bạn bè');
          const response = await axios.get(
            `${API_BASE_URL}/api/friends/status/${receiverId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log('Phản hồi trạng thái bạn bè:', response.data);
          setFriendStatus(response.data.status || 'stranger');
        } catch (error) {
          console.error('Lỗi lấy trạng thái bạn bè:', error.message, error.stack);
          setFriendStatus('stranger');
        }
      };

      try {
        chatSocketRef.current = await initializeSocket(token, '/chat');
        if (isGroup) {
          groupSocketRef.current = await initializeSocket(token, '/group');
        }

        chatSocketRef.current.on('connect', () => {
          console.log('Socket /chat đã kết nối, ID:', chatSocketRef.current.id);
        });
        chatSocketRef.current.on('connect_error', (error) => {
          console.error('Lỗi kết nối socket /chat:', error.message, error.stack);
          Alert.alert('Lỗi', `Không thể kết nối đến server chat: ${error.message}`);
        });
        chatSocketRef.current.on('disconnect', (reason) => {
          console.log('Socket /chat ngắt kết nối:', reason);
        });

        if (isGroup && groupSocketRef.current) {
          groupSocketRef.current.on('connect', () => {
            console.log('Socket /group đã kết nối, ID:', groupSocketRef.current.id);
          });
          groupSocketRef.current.on('connect_error', (error) => {
            console.error('Lỗi kết nối socket /group:', error.message, error.stack);
            Alert.alert('Lỗi', `Không thể kết nối đến server nhóm: ${error.message}`);
          });
          groupSocketRef.current.on('disconnect', (reason) => {
            console.log('Socket /group ngắt kết nối:', reason);
          });
        }

        if (chatSocketRef.current) {
          console.log('Socket /chat trạng thái:', {
            id: chatSocketRef.current.id,
            connected: chatSocketRef.current.connected,
          });
          chatSocketRef.current.emit('joinRoom', { room: `user:${userId}` }, () => {
            console.log(`Joined room: user:${userId}`);
          });
        } else {
          console.error('Socket /chat chưa được khởi tạo');
        }

        if (isGroup && groupSocketRef.current) {
          console.log('Socket /group trạng thái:', {
            id: groupSocketRef.current.id,
            connected: groupSocketRef.current.connected,
          });
          groupSocketRef.current.emit('joinRoom', { room: `group:${groupId}` }, () => {
            console.log(`Joined group room: group:${groupId}`);
          });
        } else if (!isGroup) {
          chatSocketRef.current.emit('joinRoom', { room: `user:${receiverId}` }, () => {
            console.log(`Joined room: user:${receiverId}`);
          });
        }

        const handleReceiveMessage = (newMessage) => {
          console.log('Nhận tin nhắn cá nhân:', newMessage);
          if (
            (newMessage.senderId === receiverId || newMessage.receiverId === receiverId) &&
            newMessage.senderId !== userId
          ) {
            setMessages((prev) => {
              const exists = prev.some(
                (msg) =>
                  msg.messageId === newMessage.messageId || msg.tempId === newMessage.messageId
              );
              if (exists) {
                console.log('Tin nhắn cá nhân đã tồn tại, bỏ qua:', newMessage.messageId);
                return prev;
              }
              const updatedMessages = [...prev, newMessage];
              saveMessagesToCache(updatedMessages);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              return updatedMessages;
            });
          } else {
            console.log('Tin nhắn không khớp với receiverId:', newMessage);
          }
        };

        const handleGroupMessage = (data) => {
          console.log('Nhận tin nhắn nhóm:', data);
          const newMessage = data.message;
          if (newMessage.groupId === groupId && newMessage.senderId !== userId) {
            setMessages((prev) => {
              const exists = prev.some(
                (msg) =>
                  msg.messageId === newMessage.messageId || msg.tempId === newMessage.messageId
              );
              if (exists) {
                console.log('Tin nhắn nhóm đã tồn tại, bỏ qua:', newMessage.messageId);
                return prev;
              }
              const updatedMessages = [...prev, newMessage];
              saveMessagesToCache(updatedMessages);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              return updatedMessages;
            });
          } else {
            console.log('Tin nhắn nhóm không khớp với groupId hoặc từ chính người gửi:', newMessage);
          }
        };

        const handleMessageStatus = ({ messageId, status }) => {
          console.log('Cập nhật trạng thái tin nhắn:', { messageId, status });
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              (msg.id === messageId || msg.messageId === messageId || msg.tempId === messageId)
                ? { ...msg, status }
                : msg
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        };

        const handleMessageRecalled = ({ messageId }) => {
          console.log('Tin nhắn được thu hồi:', messageId);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              (msg.id === messageId || msg.messageId === messageId || msg.tempId === messageId)
                ? { ...msg, status: 'recalled' }
                : msg
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        };

        const handleMessageDeleted = ({ messageId }) => {
          console.log('Tin nhắn được xóa:', messageId);
          setMessages((prev) => {
            const updatedMessages = prev.filter(
              (msg) => msg.id !== messageId && msg.messageId !== messageId && msg.tempId !== messageId
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        };

        chatSocketRef.current.on('receiveMessage', handleReceiveMessage);
        chatSocketRef.current.on('messageStatus', handleMessageStatus);
        chatSocketRef.current.on('messageRecalled', handleMessageRecalled);
        chatSocketRef.current.on('messageDeleted', handleMessageDeleted);
        if (isGroup && groupSocketRef.current) {
          groupSocketRef.current.on('newGroupMessage', handleGroupMessage);
        }

        fetchMessages();
        fetchRecentChats();
        if (!isGroup) {
          fetchFriendStatus();
          markMessagesAsSeen();
        }
      } catch (error) {
        console.error('Lỗi khởi tạo socket:', error.message, error.stack);
        Alert.alert('Lỗi', 'Không thể khởi tạo kết nối chat.');
      }
    };

    initialize();

    return () => {
      console.log('Cleanup socket');
      if (chatSocketRef.current) {
        chatSocketRef.current.off('receiveMessage');
        chatSocketRef.current.off('messageStatus');
        chatSocketRef.current.off('messageRecalled');
        chatSocketRef.current.off('messageDeleted');
        chatSocketRef.current.off('connect');
        chatSocketRef.current.off('connect_error');
        chatSocketRef.current.off('disconnect');
        disconnectSocket('/chat');
      }
      if (groupSocketRef.current) {
        groupSocketRef.current.off('newGroupMessage');
        groupSocketRef.current.off('connect');
        groupSocketRef.current.off('connect_error');
        groupSocketRef.current.off('disconnect');
        disconnectSocket('/group');
      }
    };
  }, [userId, token, receiverId, groupId, isGroup, navigation]);

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
          <Image
            source={avatar ? { uri: avatar } : { uri: 'https://picsum.photos/40' }}
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {receiverName || 'Không có tên'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isGroup ? 'Nhóm chat' : 'Người dùng'}
            </Text>
          </View>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleAddMemberClick} style={styles.headerButton}>
            <Ionicons name="person-add" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={showOptionsMenu} style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, receiverName, avatar, isGroup]);

  const handleSendMessage = useCallback(
    async (data, onComplete) => {
      if (!isGroup && friendStatus !== 'friend') {
        Alert.alert('Thông báo', 'Bạn cần là bạn bè để nhắn tin.');
        onComplete?.();
        return;
      }

      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        messageId: tempId,
        senderId: userId,
        receiverId: isGroup ? null : receiverId,
        groupId: isGroup ? groupId : null,
        type: data instanceof FormData ? (data.get('type') || 'file') : (data.type || 'text'),
        content: data instanceof FormData ? 'Đang tải...' : data.content,
        fileName: data instanceof FormData ? data.get('fileName') : null,
        mimeType: data instanceof FormData ? data.get('mimeType') : null,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };

      console.log('Thêm tin nhắn tạm thời:', tempMessage);
      setMessages((prev) => {
        const updatedMessages = [...prev, tempMessage];
        saveMessagesToCache(updatedMessages);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        return updatedMessages;
      });

      try {
        let response;
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            ...(data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {}),
          },
          timeout: 10000,
        };

        if (isGroup) {
          // Tin nhắn nhóm
          let payload = data instanceof FormData
            ? data
            : {
                type: data.type || 'text',
                content: data.content,
                isAnonymous: false,
                isSecret: false,
                quality: 'original',
              };

          if (data instanceof FormData) {
            data.append('type', data.get('type') || 'file');
            data.append('isAnonymous', 'false');
            data.append('isSecret', 'false');
            data.append('quality', 'original');
          }

          console.log('Payload gửi tin nhắn nhóm:', payload);
          response = await axios.post(
            `${API_BASE_URL}/api/groups/messages/${groupId}`,
            payload,
            config
          );
        } else {
          // Tin nhắn cá nhân
          let payload = data instanceof FormData
            ? data
            : {
                receiverId,
                type: data.type || 'text',
                content: data.content,
              };

          if (data instanceof FormData) {
            data.append('receiverId', receiverId);
            data.append('type', data.get('type') || 'file');
          }

          console.log('Payload gửi tin nhắn cá nhân:', payload);
          response = await sendMessage(payload, token, data instanceof FormData);
        }

        console.log('Phản hồi từ server khi gửi tin nhắn:', response.data);

        const msg = response.data?.data;
        if (msg) {
          setMessages((prev) => {
            const updatedMessages = prev.map((m) =>
              m.messageId === tempId ? { ...m, ...msg, status: msg.status || 'sent' } : m
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
          console.log('Cập nhật tin nhắn thành công:', msg);

          // Phát sự kiện qua socket với callback
          const socketNamespace = isGroup ? '/group' : '/chat';
          const eventName = isGroup ? 'sendGroupMessage' : 'sendMessage';
          const socket = getSocket(socketNamespace, token);
          if (socket.connected) {
            socket.emit(eventName, msg, (response) => {
              console.log(`Phản hồi socket ${eventName}:`, response);
              if (!response.success) {
                console.error(`Lỗi socket ${eventName}:`, response.message);
              }
            });
          } else {
            console.warn('Socket không kết nối, không thể phát sự kiện:', socketNamespace);
          }
        } else {
          throw new Error('Không nhận được dữ liệu tin nhắn từ server');
        }
      } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error.message, error.response?.data);
        setMessages((prev) => {
          const updatedMessages = prev.map((m) =>
            m.messageId === tempId
              ? { ...m, status: 'error', errorMessage: error.message }
              : m
          );
          saveMessagesToCache(updatedMessages);
          return updatedMessages;
        });
        Alert.alert('Lỗi', `Không thể gửi tin nhắn: ${error.message}`);
      } finally {
        onComplete?.();
      }
    },
    [isGroup, userId, receiverId, groupId, token, friendStatus]
  );

  const handleRecallMessage = (messageId) => {
    const socket = getSocket('/chat', token);
    socket.emit('recallMessage', { messageId }, (response) => {
      console.log('Phản hồi thu hồi tin nhắn:', response);
      if (response.success) {
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            (msg.id === messageId || msg.messageId === messageId || msg.tempId === messageId)
              ? { ...msg, status: 'recalled' }
              : msg
          );
          saveMessagesToCache(updatedMessages);
          return updatedMessages;
        });
      } else {
        Alert.alert('Lỗi', response?.message || 'Không thể thu hồi tin nhắn.');
      }
    });
  };

  const handleDeleteMessage = (messageId) => {
    if (isGroup) {
      Alert.alert('Thông báo', 'Chức năng xóa tin nhắn nhóm hiện chưa được hỗ trợ.');
      return;
    }
    const socket = getSocket('/chat', token);
    socket.emit('deleteMessage', { messageId }, (response) => {
      console.log('Phản hồi xóa tin nhắn:', response);
      if (response.success) {
        setMessages((prev) => {
          const updatedMessages = prev.filter(
            (msg) => msg.id !== messageId && msg.messageId !== messageId && msg.tempId !== messageId
          );
          saveMessagesToCache(updatedMessages);
          return updatedMessages;
        });
      } else {
        Alert.alert('Lỗi', response?.message || 'Không thể xóa tin nhắn.');
      }
    });
  };

  const handleForwardMessage = (messageId, targetReceiverId) => {
    const socket = getSocket('/chat', token);
    socket.emit('forwardMessage', { messageId, targetReceiverId }, (response) => {
      console.log('Phản hồi chuyển tiếp tin nhắn:', response);
      if (response.success) {
        Alert.alert('Thành công', 'Đã chuyển tiếp tin nhắn.');
      } else {
        Alert.alert('Lỗi', response?.message || 'Không thể chuyển tiếp tin nhắn.');
      }
    });
  };

  const memoizedMessages = useMemo(() => messages, [messages]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
    >
      {!isGroup && friendStatus && friendStatus !== 'friend' && (
        <View style={styles.friendStatusBanner}>
          {friendStatus === 'stranger' && (
            <>
              <Text style={styles.bannerText}>Gửi yêu cầu kết bạn tới người này</Text>
              <TouchableOpacity
                style={styles.bannerButton}
                onPress={handleAddFriendRequest}
              >
                <Text style={styles.bannerButtonText}>Gửi kết bạn</Text>
              </TouchableOpacity>
            </>
          )}
          {friendStatus === 'pending_sent' && (
            <Text style={styles.bannerText}>
              Bạn đã gửi yêu cầu kết bạn và đang chờ xác nhận
            </Text>
          )}
          {friendStatus === 'pending_received' && (
            <>
              <Text style={styles.bannerText}>Người này đã gửi lời mời kết bạn</Text>
              <TouchableOpacity
                style={styles.bannerButton}
                onPress={handleAcceptRequest}
              >
                <Text style={styles.bannerButtonText}>Đồng ý</Text>
              </TouchableOpacity>
            </>
          )}
          {friendStatus === 'blocked' && (
            <Text style={styles.bannerText}>
              Bạn đã chặn người này. Hãy bỏ chặn để nhắn tin.
            </Text>
          )}
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={memoizedMessages}
        keyExtractor={(item) => item.messageId || item.tempId}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            currentUserId={userId}
            onRecall={handleRecallMessage}
            onDelete={handleDeleteMessage}
            onForward={handleForwardMessage}
            isGroup={isGroup}
          />
        )}
        contentContainerStyle={styles.flatListContent}
      />
      <MessageInput onSendMessage={handleSendMessage} style={styles.messageInput} />
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
      <CreateGroupModal
        isVisible={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onGroupCreated={handleGroupCreated}
        auth={{ userId, token }}
      />
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
    flexDirection: 'row',
    marginRight: 10,
  },
  headerButton: {
    marginLeft: 10,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
  },
  friendStatusBanner: {
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  bannerButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  bannerButtonText: {
    color: '#fff',
    fontSize: 14,
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
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
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
  errorText: {
    fontSize: 12,
    color: '#ff3b30',
    marginTop: 4,
  },
  messageInput: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
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