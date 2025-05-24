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
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { WebView } from 'react-native-webview';
import MessageInput from '../components/MessageInput';
import CreateGroupModal from './CreateGroupModal';
import { initializeSocket, getSocket, disconnectSocket } from '../services/socket';
import { sendMessage, getMessageSummary, getFriends } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const [error, setError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isVideoFullScreen, setIsVideoFullScreen] = useState(false);

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

  const handleOpenDocument = async () => {
    try {
      const supported = await Linking.canOpenURL(message.mediaUrl);
      if (supported) {
        await Linking.openURL(message.mediaUrl);
      } else {
        Alert.alert('Lỗi', 'Không thể mở tài liệu. URL không được hỗ trợ.');
      }
    } catch (err) {
      console.error('Lỗi mở tài liệu:', err);
      Alert.alert('Lỗi', 'Không thể mở tài liệu. Vui lòng thử lại.');
    }
  };

  const toggleFullScreenVideo = () => {
    setIsVideoFullScreen(!isVideoFullScreen);
  };

  const videoHtml = `
    <html>
      <body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center; background-color:#000; width:100%; height:100%;">
        <video controls style="max-width:100%; max-height:100%;">
          <source src="${message.mediaUrl}" type="${message.mimeType || 'video/mp4'}">
          Your browser does not support the video tag.
        </video>
      </body>
    </html>
  `;

  const fullScreenVideoHtml = `
    <html>
      <body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center; background-color:#000; width:100%; height:100%;">
        <video controls autoplay style="width:100%; height:100%;">
          <source src="${message.mediaUrl}" type="${message.mimeType || 'video/mp4'}">
          Your browser does not support the video tag.
        </video>
      </body>
    </html>
  `;

  return (
    <>
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
              <Text style={styles.senderName}>
                {typeof message.sender?.name === 'string' ? message.sender.name : 'Người dùng'}
              </Text>
            )}
            {message.status === 'recalled' ? (
              <Text style={styles.recalled}>(Tin nhắn đã thu hồi)</Text>
            ) : (
              <>
                {message.type === 'text' && (
                  <Text style={[styles.messageText, isCurrentUser ? styles.rightText : styles.leftText]}>
                    {typeof message.content === 'string' ? message.content : '(Không có nội dung)'}
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
                        setError(true);
                        console.log('Lỗi tải hình ảnh:', e.nativeEvent.error);
                      }}
                    />
                    {error && <Text style={styles.errorText}>Không thể tải hình ảnh</Text>}
                  </>
                )}
                {message.type === 'video' && message.mediaUrl && (
                  <>
                    {error ? (
                      <Text style={styles.errorText}>Không thể tải video</Text>
                    ) : (
                      <TouchableOpacity onPress={toggleFullScreenVideo}>
                        <WebView
                          style={styles.messageVideo}
                          source={{ html: videoHtml }}
                          allowsFullscreenVideo
                          mediaPlaybackRequiresUserAction={false}
                          onError={() => {
                            setError(true);
                            console.log('Lỗi tải video trong WebView');
                          }}
                        />
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {(message.type === 'pdf' || message.type === 'zip' || message.type === 'file') &&
                  message.mediaUrl && (
                    <Text
                      style={styles.linkText}
                      onPress={handleOpenDocument}
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
            {message.status === 'error' && <Text style={styles.errorText}>Lỗi gửi tin nhắn</Text>}
          </View>
        </View>
      </TouchableOpacity>

      <Modal
        visible={isVideoFullScreen}
        transparent={false}
        animationType="fade"
        onRequestClose={toggleFullScreenVideo}
      >
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={toggleFullScreenVideo}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <WebView
            style={styles.fullScreenVideo}
            source={{ html: fullScreenVideoHtml }}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            onError={() => {
              setError(true);
              console.log('Lỗi tải video toàn màn hình trong WebView');
            }}
          />
        </View>
      </Modal>
    </>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { userId, token, receiverId, receiverName, avatar, isGroup = false, groupId } = route.params;
  const [messages, setMessages] = useState([]);
  const [friendStatus, setFriendStatus] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const chatSocketRef = useRef(null);
  const groupSocketRef = useRef(null);
  const flatListRef = useRef(null);
  const processedMessages = useRef(new Set());

  const API_BASE_URL = 'http://192.168.1.9:3000';

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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.get(`${API_BASE_URL}/api/messages/user/${receiverId}`, {
        headers: { Authorization: `Bearer ${storedToken.trim()}` },
      });
      if (response.data.success) {
        const unreadMessages = response.data.messages.filter(
          (msg) => msg.status === 'SENT' || msg.status === 'DELIVERED'
        );
        for (const msg of unreadMessages) {
          await axios.patch(
            `${API_BASE_URL}/api/messages/seen/${msg.messageId}`,
            {},
            { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
          );
        }
      }
    } catch (error) {
      console.error('Lỗi đánh dấu tin nhắn đã xem:', error);
    }
  };

  const fetchRecentChats = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      console.log('Gửi yêu cầu lấy danh sách cuộc trò chuyện');
      const response = await axios.get(`${API_BASE_URL}/api/conversations/summary`, {
        headers: { Authorization: `Bearer ${storedToken.trim()}` },
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
      console.error('Lỗi lấy danh sách cuộc trò chuyện:', error.message);
      if (error.message.includes('Network Error')) {
        Alert.alert('Lỗi mạng', 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
      } else {
        Alert.alert('Lỗi', 'Không thể tải danh sách cuộc trò chuyện.');
      }
      setRecentChats([]);
    }
  };

  const fetchFriends = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const currentUserId = userId;
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }

      const convResponse = await getMessageSummary(storedToken);
      let recentUsers = convResponse.data?.data?.conversations?.map((conv) => ({
        userId: conv.otherUserId,
        name: conv.displayName || 'Không có tên',
        avatar: conv.avatar || 'https://via.placeholder.com/50',
      })) || [];

      const friendsResponse = await getFriends(storedToken);
      const friends = friendsResponse.data?.data?.map((friend) => ({
        userId: friend.userId,
        name: friend.name || friend.userId,
        avatar: friend.avatar || 'https://via.placeholder.com/50',
      })) || [];

      const combinedUsers = [...recentUsers, ...friends];
      const uniqueUsers = Array.from(new Map(combinedUsers.map((u) => [u.userId, u])).values())
        .filter((user) => user.userId !== currentUserId);

      setFriends(uniqueUsers);
    } catch (error) {
      console.error('Lỗi lấy danh sách bạn bè:', error.message);
      Alert.alert('Lỗi', 'Không thể tải danh sách bạn bè.');
      setFriends([]);
      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove(['token', 'userId']);
        navigation.goBack();
      }
    }
  };

  const refreshToken = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      console.log('Refresh token:', refreshToken);
      if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined') {
        throw new Error('Không tìm thấy refresh token');
      }
      const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken,
      });
      console.log('Phản hồi refresh token:', response.data);
      const newToken = response.data.token;
      if (!newToken || typeof newToken !== 'string') {
        throw new Error('Token mới không hợp lệ');
      }
      await AsyncStorage.setItem('token', newToken.trim());
      return newToken;
    } catch (error) {
      console.error('Lỗi làm mới token:', error.message);
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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/friends/block`,
        { blockedUserId: receiverId },
        { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.delete(
        `${API_BASE_URL}/api/friends/remove/${receiverId}`,
        { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/friends/send`,
        {
          receiverId,
          message: `Xin chào, mình là ${userId}, hãy kết bạn với mình nhé!`,
        },
        { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.get(`${API_BASE_URL}/api/friends/received`, {
        headers: { Authorization: `Bearer ${storedToken.trim()}` },
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
          headers: { Authorization: `Bearer ${storedToken.trim()}` },
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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/groups/${groupId}/leave`,
        {},
        { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
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
      fetchFriends();
      setIsAddMemberModalOpen(true);
    } else {
      setIsCreateGroupModalOpen(true);
    }
  };

  const handleAddMember = async () => {
    if (!selectedFriend) {
      Alert.alert('Lỗi', 'Vui lòng chọn một bạn bè để thêm.');
      return;
    }

    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/groups/members/${groupId}`,
        { newUserId: selectedFriend.userId },
        { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
      );

      if (response.data.success) {
        Alert.alert('Thành công', response.data.message || 'Đã thêm thành viên vào nhóm!');
        setIsAddMemberModalOpen(false);
        setSelectedFriend(null);
        setSearchQuery('');
      } else {
        throw new Error(response.data.message || 'Không thể thêm thành viên.');
      }
    } catch (error) {
      console.error('Lỗi thêm thành viên:', error.message);
      Alert.alert('Lỗi', `Không thể thêm thành viên: ${error.message}`);
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
            navigation.navigate('ContactDetails', { userId: receiverId, name: receiverName, avatar });
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

  const handleReceiveMessage = useCallback(
    (newMessage) => {
      console.log('Nhận tin nhắn cá nhân:', JSON.stringify(newMessage, null, 2));

      const normalizedMessage = {
        messageId: newMessage.messageId || `temp-${Date.now()}`,
        senderId: newMessage.senderId,
        receiverId: newMessage.receiverId,
        content: newMessage.content || null,
        type: newMessage.type || 'text',
        status: newMessage.status || 'delivered',
        timestamp: newMessage.timestamp || new Date().toISOString(),
        mediaUrl: newMessage.mediaUrl || null,
        fileName: newMessage.fileName || null,
        mimeType: newMessage.mimeType || null,
        metadata: newMessage.metadata || {},
      };

      if (normalizedMessage.senderId === userId) {
        console.log('Bỏ qua tin nhắn từ chính mình:', normalizedMessage.messageId);
        return;
      }

      if (normalizedMessage.senderId !== receiverId && normalizedMessage.receiverId !== receiverId) {
        console.log('Tin nhắn không khớp với receiverId:', normalizedMessage);
        return;
      }

      if (processedMessages.current.has(normalizedMessage.messageId)) {
        console.log('Tin nhắn đã được xử lý, bỏ qua:', normalizedMessage.messageId);
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.messageId === normalizedMessage.messageId);
        console.log('Kiểm tra tin nhắn tồn tại:', {
          messageId: normalizedMessage.messageId,
          exists,
          currentMessages: prev.map((msg) => msg.messageId),
          processedMessages: Array.from(processedMessages.current),
        });

        if (exists) {
          console.log('Tin nhắn đã tồn tại trong messages, bỏ qua:', normalizedMessage.messageId);
          return prev;
        }

        const updatedMessages = [...prev, normalizedMessage];
        saveMessagesToCache(updatedMessages);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        processedMessages.current.add(normalizedMessage.messageId);

        return updatedMessages;
      });
    },
    [userId, receiverId]
  );

  const handleGroupMessage = useCallback(
    (data) => {
      console.log('Nhận tin nhắn nhóm:', JSON.stringify(data, null, 2));
      const newMessage = data.message;

      if (newMessage.senderId === userId) {
        console.log('Bỏ qua tin nhắn nhóm từ chính mình:', newMessage.messageId);
        return;
      }

      if (newMessage.groupId !== groupId) {
        console.log('Tin nhắn nhóm không khớp với groupId:', newMessage);
        return;
      }

      if (processedMessages.current.has(newMessage.messageId)) {
        console.log('Tin nhắn nhóm đã được xử lý, bỏ qua:', newMessage.messageId);
        return;
      }

      const normalizedMessage = {
        messageId: newMessage.messageId || `temp-${Date.now()}`,
        groupId: newMessage.groupId,
        senderId: newMessage.senderId,
        content: newMessage.content || null,
        type: newMessage.type || 'text',
        status: newMessage.status === 'sending' ? 'delivered' : newMessage.status || 'delivered',
        timestamp: newMessage.timestamp || new Date().toISOString(),
        isAnonymous: newMessage.isAnonymous || false,
        isPinned: newMessage.isPinned || false,
        isSecret: newMessage.isSecret || false,
        mediaUrl: newMessage.mediaUrl || null,
        fileName: newMessage.fileName || null,
        mimeType: newMessage.mimeType || null,
        replyToMessageId: newMessage.replyToMessageId || null,
        metadata: newMessage.metadata || {},
      };

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.messageId === normalizedMessage.messageId);
        console.log('Kiểm tra tin nhắn nhóm tồn tại:', {
          messageId: normalizedMessage.messageId,
          exists,
          currentMessages: prev.map((msg) => msg.messageId),
          processedMessages: Array.from(processedMessages.current),
        });

        if (exists) {
          console.log('Tin nhắn nhóm đã tồn tại trong messages, bỏ qua:', normalizedMessage.messageId);
          return prev;
        }

        const updatedMessages = [...prev, normalizedMessage];
        console.log('Thêm tin nhắn nhóm mới:', normalizedMessage.messageId);
        saveMessagesToCache(updatedMessages);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        processedMessages.current.add(normalizedMessage.messageId);

        return updatedMessages;
      });
    },
    [userId, groupId]
  );

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

      processedMessages.current.clear();

      const fetchMessages = async () => {
        try {
          const cachedMessages = await loadMessagesFromCache();
          if (cachedMessages) {
            setMessages(cachedMessages);
          }
          const storedToken = await AsyncStorage.getItem('token');
          if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
            throw new Error('Không tìm thấy token hợp lệ');
          }
          const endpoint = isGroup
            ? `${API_BASE_URL}/api/groups/messages/${groupId}`
            : `${API_BASE_URL}/api/messages/user/${receiverId}`;
          console.log('Gửi yêu cầu với token:', storedToken);
          const response = await axios.get(endpoint, {
            headers: { Authorization: `Bearer ${storedToken.trim()}` },
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
          console.error('Lỗi lấy tin nhắn:', error.message);
          if (error.response?.status === 401) {
            try {
              const newToken = await refreshToken();
              route.params.token = newToken;
              const endpoint = isGroup
                ? `${API_BASE_URL}/api/groups/messages/${groupId}`
                : `${API_BASE_URL}/api/messages/user/${receiverId}`;
              const response = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${newToken.trim()}` },
                timeout: 10000,
              });
              if (response.data.success) {
                const fetchedMessages = isGroup
                  ? response.data.data.messages || []
                  : response.data.messages || [];
                setMessages(fetchedMessages);
                saveMessagesToCache(fetchedMessages);
              } else {
                setMessages([]);
              }
            } catch (refreshError) {
              console.error('Lỗi làm mới token:', refreshError.message);
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            }
          } else {
            Alert.alert('Lỗi', 'Không thể tải tin nhắn: ' + error.message);
            if (error.message.includes('Network Error')) {
              Alert.alert('Lỗi mạng', 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.');
            }
            setMessages([]);
          }
        }
      };

      const fetchFriendStatus = async () => {
        if (isGroup) return;
        try {
          const storedToken = await AsyncStorage.getItem('token');
          if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
            throw new Error('Không tìm thấy token hợp lệ');
          }
          console.log('Gửi yêu cầu lấy trạng thái bạn bè');
          const response = await axios.get(`${API_BASE_URL}/api/friends/status/${receiverId}`, {
            headers: { Authorization: `Bearer ${storedToken.trim()}` },
          });
          console.log('Phản hồi trạng thái bạn bè:', response.data);
          setFriendStatus(response.data.status || 'stranger');
        } catch (error) {
          console.error('Lỗi lấy trạng thái bạn bè:', error.message);
          setFriendStatus('stranger');
        }
      };

      try {
        chatSocketRef.current = await initializeSocket(token, '/chat');
        if (isGroup) {
          groupSocketRef.current = await initializeSocket(token, '/group');
          if (groupSocketRef.current) {
            groupSocketRef.current.on('memberAdded', ({ groupId: updatedGroupId, userId, addedBy }) => {
              if (updatedGroupId === groupId) {
                Alert.alert('Thông báo', `Thành viên mới (ID: ${userId}) đã được thêm vào nhóm.`);
              }
            });
          }
        }

        chatSocketRef.current.on('connect', () => {
          console.log('Socket /chat đã kết nối, ID:', chatSocketRef.current.id);
        });
        chatSocketRef.current.on('connect_error', (error) => {
          console.error('Lỗi kết nối socket /chat:', error.message);
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
            console.error('Lỗi kết nối socket /group:', error.message);
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
        fetchFriendStatus();
        if (!isGroup) {
          markMessagesAsSeen();
        }
      } catch (error) {
        console.error('Lỗi khởi tạo socket:', error.message);
        Alert.alert('Lỗi', 'Không thể khởi tạo kết nối chat.');
      }
    };

    initialize();

    return () => {
      console.log('Cleanup socket');
      if (chatSocketRef.current) {
        chatSocketRef.current.off('receiveMessage', handleReceiveMessage);
        chatSocketRef.current.off('messageStatus');
        chatSocketRef.current.off('messageRecalled');
        chatSocketRef.current.off('messageDeleted');
        chatSocketRef.current.off('connect');
        chatSocketRef.current.off('connect_error');
        chatSocketRef.current.off('disconnect');
        disconnectSocket('/chat');
      }
      if (groupSocketRef.current) {
        groupSocketRef.current.off('newGroupMessage', handleGroupMessage);
        groupSocketRef.current.off('memberAdded');
        groupSocketRef.current.off('connect');
        groupSocketRef.current.off('connect_error');
        groupSocketRef.current.off('disconnect');
        disconnectSocket('/group');
      }
    };
  }, [
    userId,
    token,
    receiverId,
    groupId,
    isGroup,
    navigation,
    handleReceiveMessage,
    handleGroupMessage,
  ]);

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
            source={
              avatar && typeof avatar === 'string'
                ? { uri: avatar }
                : { uri: 'https://picsum.photos/40' }
            }
            style={styles.headerAvatar}
          />
          <View>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              {typeof receiverName === 'string' && receiverName ? receiverName : 'Không có tên'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isGroup === true ? 'Nhóm chat' : 'Người dùng'}
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

      try {
        const storedToken = await AsyncStorage.getItem('token');
        if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
          throw new Error('Không tìm thấy token hợp lệ');
        }

        if (data instanceof FormData) {
          const formDataEntries = {};
          for (const [key, value] of data.entries()) {
            formDataEntries[key] = typeof value === 'object' && value.uri ? { ...value, uri: value.uri } : value;
          }
          console.log('FormData received in handleSendMessage:', formDataEntries);

          const typeValue = data.get('type');
          if (!['text', 'image', 'video', 'pdf', 'zip', 'file'].includes(typeValue)) {
            throw new Error(`Loại tin nhắn không hợp lệ: ${typeValue}`);
          }
        } else {
          console.log('Data received in handleSendMessage:', data);
        }

        let response;
        const config = {
          headers: {
            Authorization: `Bearer ${storedToken.trim()}`,
            ...(data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {}),
          },
          timeout: 10000,
        };

        if (isGroup) {
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
            if (!data.get('isAnonymous')) data.append('isAnonymous', 'false');
            if (!data.get('isSecret')) data.append('isSecret', 'false');
            if (!data.get('quality')) data.append('quality', 'original');
          }

          console.log('Payload gửi tin nhắn nhóm:', payload);
          response = await axios.post(
            `${API_BASE_URL}/api/groups/messages/${groupId}`,
            payload,
            config
          );
        } else {
          let payload = data instanceof FormData
            ? data
            : {
                receiverId,
                type: data.type || 'text',
                content: data.content,
              };

          if (data instanceof FormData) {
            if (!data.get('receiverId')) data.append('receiverId', receiverId);
          }

          console.log('Payload gửi tin nhắn cá nhân:', payload);
          response = await sendMessage(payload, storedToken, data instanceof FormData);
        }

        console.log('Phản hồi từ server khi gửi tin nhắn:', response.data);

        const msg = response.data?.data;
        if (msg) {
          console.log('Tin nhắn nhận được từ server:', {
            messageId: msg.messageId,
            type: msg.type,
            mediaUrl: msg.mediaUrl,
            fileName: msg.fileName,
            mimeType: msg.mimeType,
          });

          setMessages((prev) => {
            const exists = prev.some((m) => m.messageId === msg.messageId);
            if (exists) {
              console.log('Tin nhắn đã tồn tại, bỏ qua:', msg.messageId);
              return prev;
            }
            const updatedMessages = [...prev, { ...msg, status: msg.status || 'sent' }];
            saveMessagesToCache(updatedMessages);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            return updatedMessages;
          });
          console.log('Thêm tin nhắn thành công:', msg);
        } else {
          throw new Error('Không nhận được dữ liệu tin nhắn từ server');
        }
      } catch (error) {
        console.error('Lỗi gửi tin nhắn:', error.message, error.response?.data);
        let errorMessage = 'Không thể gửi tin nhắn.';
        if (error.message.includes('Network Error')) {
          errorMessage = 'Lỗi mạng. Vui lòng kiểm tra kết nối.';
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        Alert.alert('Lỗi', errorMessage);
      } finally {
        onComplete?.();
      }
    },
    [isGroup, userId, receiverId, groupId, friendStatus]
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

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.friendItem, selectedFriend?.userId === item.userId && styles.friendItemSelected]}
      onPress={() => setSelectedFriend(item)}
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.friendAvatar}
      />
      <Text style={styles.friendName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <TouchableOpacity style={styles.bannerButton} onPress={handleAddFriendRequest}>
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
              <TouchableOpacity style={styles.bannerButton} onPress={handleAcceptRequest}>
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
        keyExtractor={(item) => item.messageId || item.tempId || `temp-${Math.random().toString()}`}
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
      <MessageInput onSendMessage={handleSendMessage} style={styles.messageInput} chat={{ receiverName }} />
      <Modal
        visible={isOptionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsModalVisible(false)}>
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
      <Modal
        visible={isAddMemberModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddMemberModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm thành viên mới</Text>
              <TouchableOpacity onPress={() => setIsAddMemberModalOpen(false)}>
                <Text style={styles.closeButton}>✖</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Tìm kiếm bạn bè..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <Text style={styles.sectionTitle}>Danh sách bạn bè</Text>
              {filteredFriends.length > 0 ? (
                <FlatList
                  data={filteredFriends}
                  renderItem={renderFriendItem}
                  keyExtractor={(item) => item.userId}
                  style={styles.friendList}
                  contentContainerStyle={styles.friendListContainer}
                />
              ) : (
                <Text style={styles.emptyText}>Không tìm thấy bạn bè.</Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setIsAddMemberModalOpen(false);
                  setSelectedFriend(null);
                  setSearchQuery('');
                }}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleAddMember}>
                <Text style={styles.modalButtonText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    alignSelf: 'center',
  },
  messageVideo: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginVertical: 5,
    alignSelf: 'center',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenVideo: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    fontSize: 20,
    color: '#333',
  },
  modalBody: {
    flexGrow: 1,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  modalButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 5,
    alignItems: 'center',
    minWidth: 80,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginVertical: 6,
  },
  friendList: {
    maxHeight: 180,
  },
  friendListContainer: {
    paddingBottom: 10,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendItemSelected: {
    backgroundColor: '#e1f0ff',
  },
  friendAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  friendName: {
    fontSize: 14,
    color: '#000',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
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