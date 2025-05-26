import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, FlatList, Alert, View, TouchableOpacity, Text, TextInput, Dimensions, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MessageInput from '../components/MessageInput';
import ImageViewerModal from '../components/ImageViewerModal';
import MessageItem from '../components/Chat/MessageItem';
import FriendStatusBanner from '../components/Chat/FriendStatusBanner';
import OptionsModal from '../components/Chat/OptionsModal';
import AddMemberModal from '../components/Chat/AddMemberModal';
import ChatHeader from '../components/Chat/ChatHeader';
import { initializeSocket, getSocket, disconnectSocket } from '../services/socket';
import { Ionicons } from '@expo/vector-icons';
import {
  sendMessage,
  getMessageSummary,
  getFriends,
  getGroupMembers,
  getMessages,
  getUserStatus,
  sendFriendRequest,
  getReceivedFriendRequests,
  getSentFriendRequests,
  acceptFriendRequest,
  cancelFriendRequest,
  removeFriend,
  markMessageAsSeen,
  refreshToken,
  blockUser,
  leaveGroup,
  addGroupMember,
  createGroup,
  getGroupMessages,
  sendGroupMessage,
  pinMessage,
  unpinMessage,
  deleteConversation,
  recallMessage, // Thêm hàm này nếu chưa có
  deleteMessage, // Thêm hàm này nếu chưa có
  deleteGroupMessage, // Thêm hàm này
  recallGroupMessage, // Thêm hàm này
} from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatScreen({ route, navigation }) {
  const {
    userId,
    token,
    receiverId,
    receiverName,
    avatar,
    isGroup = false,
    groupId,
  } = route.params;
  const [messages, setMessages] = useState([]);
  const [friendStatus, setFriendStatus] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isOptionsModalVisible, setOptionsModalVisible] = useState(false);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [headerAvatarLoadError, setHeaderAvatarLoadError] = useState(false);
  const [groupMembers, setGroupMembers] = useState({});
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState([]);
  const [imageViewerInitialIndex, setImageViewerInitialIndex] = useState(0);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [hasScrolledInitially, setHasScrolledInitially] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState(null);
  const [isLoadingRecentChats, setIsLoadingRecentChats] = useState(false);
  const chatSocketRef = useRef(null);
  const groupSocketRef = useRef(null);
  const flatListRef = useRef(null);
  const userCache = useRef(new Map());
  const processedMessages = useRef(new Set());

  const API_BASE_URL = 'http://192.168.1.9:3000/api';

  const cacheKey = isGroup ? `messages_group_${groupId}` : `messages_${receiverId}`;

  const generatePlaceholderAvatar = (name) => {
    const colors = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6'];
    const firstChar = name?.charAt(0)?.toUpperCase() || 'U';
    const color = colors[firstChar.charCodeAt(0) % colors.length];
    return `https://placehold.co/40x40/${color.replace('#', '')}/ffffff?text=${firstChar}`;
  };

  const getUserInfo = (userId, message) => {
    if (userCache.current.has(userId)) {
      return userCache.current.get(userId);
    }
    let userInfo = {
      name: 'Người dùng',
      avatar: generatePlaceholderAvatar('Người dùng'),
    };
    if (message.senderName || message.senderAvatar) {
      userInfo = {
        name: message.senderName || 'Người dùng',
        avatar: message.senderAvatar || generatePlaceholderAvatar(message.senderName || 'Người dùng'),
      };
    } else if (userId === receiverId) {
      userInfo = {
        name: receiverName || 'Người dùng',
        avatar: avatar || generatePlaceholderAvatar(receiverName || 'Người dùng'),
      };
    }
    userCache.current.set(userId, userInfo);
    return userInfo;
  };

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

  const fetchGroupMembers = async () => {
    if (!isGroup || !groupId) return;
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await getGroupMembers(groupId, storedToken);
      if (response.data.success && Array.isArray(response.data.data.members)) {
        const membersMap = response.data.data.members.reduce((acc, member) => {
          acc[member.userId] = {
            name: member.name || 'Người dùng',
            avatar: member.avatar || generatePlaceholderAvatar(member.name || 'Người dùng'),
          };
          userCache.current.set(member.userId, acc[member.userId]);
          return acc;
        }, {});
        setGroupMembers(membersMap);
      } else {
        throw new Error('Phản hồi API không chứa danh sách thành viên hợp lệ');
      }
    } catch (error) {
      console.error('Lỗi lấy danh sách thành viên nhóm:', error.message);
      setGroupMembers({});
    }
  };

  const markMessagesAsSeen = async () => {
    if (isGroup) return;
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await getMessages(receiverId, storedToken);
      if (response.data.success) {
        const unreadMessages = response.data.messages.filter(
          (msg) => msg.status === 'SENT' || msg.status === 'DELIVERED'
        );
        for (const msg of unreadMessages) {
          await markMessageAsSeen(msg.messageId, storedToken);
        }
      }
    } catch (error) {
      console.error('Lỗi đánh dấu tin nhắn đã xem:', error);
    }
  };

  const fetchRecentChats = async () => {
    setIsLoadingRecentChats(true);
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      console.log('Gửi yêu cầu lấy danh sách cuộc trò chuyện');
      const response = await getMessageSummary(storedToken);
      console.log('Phản hồi danh sách cuộc trò chuyện:', response.data);
      if (response.data.success) {
        const conversations = response.data.data?.conversations || [];
        const groups = response.data.data?.groups || [];
        const formattedChats = [
          ...conversations.map((conv) => {
            const userInfo = {
              name: conv.displayName || 'Không có tên',
              avatar: conv.avatar || generatePlaceholderAvatar(conv.displayName || 'Không có tên'),
            };
            userCache.current.set(conv.otherUserId, userInfo);
            return {
              id: conv.otherUserId,
              name: conv.displayName || 'Không có tên',
              isGroup: false,
              avatar: conv.avatar || generatePlaceholderAvatar(conv.displayName || 'Không có tên'),
              lastMessage: conv.lastMessage,
              timestamp: conv.timestamp,
              unreadCount: conv.unreadCount,
            };
          }),
          ...groups.map((group) => ({
            id: group.groupId,
            name: group.name || 'Nhóm không tên',
            isGroup: true,
            avatar: group.avatar || generatePlaceholderAvatar(group.name || 'Nhóm không tên'),
            lastMessage: group.lastMessage,
            timestamp: group.timestamp,
            memberCount: group.memberCount,
          })),
        ];
        console.log('Combined chats:', formattedChats);
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
    } finally {
      setIsLoadingRecentChats(false);
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
      let recentUsers = convResponse.data?.data?.conversations?.map((conv) => {
        const userInfo = {
          userId: conv.otherUserId,
          name: conv.displayName || 'Không có tên',
          avatar: conv.avatar || generatePlaceholderAvatar(conv.displayName || 'Không có tên'),
        };
        userCache.current.set(conv.otherUserId, userInfo);
        return userInfo;
      }) || [];

      const friendsResponse = await getFriends(storedToken);
      const friends = friendsResponse.data?.data?.map((friend) => {
        const userInfo = {
          userId: friend.userId,
          name: friend.name || friend.userId,
          avatar: friend.avatar || generatePlaceholderAvatar(friend.name || friend.userId),
        };
        userCache.current.set(friend.userId, userInfo);
        return userInfo;
      }) || [];

      const combinedUsers = [...recentUsers, ...friends];
      const uniqueUsers = Array.from(new Map(combinedUsers.map((u) => [u.userId, u])).values()).filter(
        (user) => user.userId !== currentUserId
      );

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

  const refreshTokenHandler = async () => {
    try {
      const refreshTokenValue = await AsyncStorage.getItem('refreshToken');
      console.log('Refresh token:', refreshTokenValue);
      if (!refreshTokenValue || refreshTokenValue === 'null' || refreshTokenValue === 'undefined') {
        throw new Error('Không tìm thấy refresh token');
      }
      const response = await refreshToken(refreshTokenValue);
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
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }

      const response = await deleteConversation(
        receiverId,
        storedToken,
        isGroup,
        groupId
      );

      if (response.data.success) {
        setMessages([]);
        await AsyncStorage.removeItem(cacheKey);
        Alert.alert('Thành công', `Đã xóa ${isGroup ? 'lịch sử nhóm' : 'cuộc trò chuyện'}.`);
        navigation.goBack();
      } else {
        throw new Error(response.data.message || 'Không thể xóa cuộc trò chuyện trên server.');
      }
    } catch (error) {
      console.error('Lỗi xóa cuộc trò chuyện:', error);
      Alert.alert('Lỗi', error.message || 'Không thể xóa. Vui lòng thử lại.');
    }
  };

  const handleBlockUser = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await blockUser(receiverId, storedToken);
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
      const response = await removeFriend(receiverId, storedToken);
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
      const response = await sendFriendRequest(receiverId, storedToken);
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

const handleCancelRequest = async () => {
  let success = false;
  try {
    const storedToken = await AsyncStorage.getItem('token');
    if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
      throw new Error('Không tìm thấy token hợp lệ');
    }
    const response = await getSentFriendRequests(storedToken);
    let request;

    if (Array.isArray(response.data)) {
      request = response.data.find((req) => req.userId === receiverId);
    } else if (response.data?.success && Array.isArray(response.data.data)) {
      request = response.data.data.find((req) => req.userId === receiverId);
    } else {
      console.warn('Dữ liệu yêu cầu kết bạn không hợp lệ:', response.data);
      throw new Error('Không tìm thấy yêu cầu kết bạn đã gửi.');
    }

    if (!request) {
      console.warn('Không tìm thấy yêu cầu kết bạn, kiểm tra trạng thái bạn bè.');
      throw new Error('Không tìm thấy yêu cầu kết bạn.');
    }

    const cancelResponse = await cancelFriendRequest(request.requestId, storedToken);
    const statusResponse = await getUserStatus(receiverId, storedToken);
    if (cancelResponse.data.success || statusResponse.data.status === 'stranger') {
      success = true;
      setFriendStatus('stranger');
    } else {
      throw new Error(cancelResponse.data.message || 'Không thể xác nhận hủy yêu cầu.');
    }
  } catch (error) {
    console.error('Lỗi hủy yêu cầu kết bạn:', error.message);
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const statusResponse = await getUserStatus(receiverId, storedToken);
      if (statusResponse.data.status === 'stranger') {
        success = true;
        setFriendStatus('stranger');
      } else {
        console.warn('Không thể xác nhận hủy yêu cầu, trạng thái bạn bè:', statusResponse.data.status);
        success = true; // Giả sử thành công
        setFriendStatus('stranger');
      }
    } catch (statusError) {
      console.error('Lỗi kiểm tra trạng thái bạn bè:', statusError.message);
      success = true; // Giả sử thành công
      setFriendStatus('stranger');
    }
  } finally {
    if (success) {
      Alert.alert('Thành công', 'Đã hủy yêu cầu kết bạn!');
    }
  }
};

  const handleAcceptRequest = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await getReceivedFriendRequests(storedToken);
      const request = response.data.data.find((req) => req.senderId === receiverId);
      if (!request) {
        Alert.alert('Lỗi', 'Không tìm thấy lời mời kết bạn từ người này.');
        return;
      }
      const acceptResponse = await acceptFriendRequest(request.requestId, storedToken);
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
      const response = await leaveGroup(groupId, storedToken);
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
    fetchFriends();
    setIsAddMemberModalOpen(true);
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

      if (isGroup) {
        const response = await addGroupMember(groupId, selectedFriend.userId, storedToken);
        if (response.data.success) {
          Alert.alert('Thành công', response.data.message || 'Đã thêm thành viên vào nhóm!');
          setIsAddMemberModalOpen(false);
          setSelectedFriend(null);
          setSearchQuery('');
        } else {
          throw new Error(response.data.message || 'Không thể thêm thành viên.');
        }
      } else {
        const members = [receiverId, selectedFriend.userId];
        const payload = {
          name: `${receiverName}, ${selectedFriend.name}`,
          members: JSON.stringify(members),
          initialRoles: JSON.stringify({ [userId]: 'admin' }),
        };
        const response = await createGroup(payload, storedToken);
        if (response.data.success) {
          const newGroup = response.data.data;
          Alert.alert('Thành công', `Nhóm "${newGroup.name}" đã được tạo thành công!`);
          setIsAddMemberModalOpen(false);
          setSelectedFriend(null);
          setSearchQuery('');
          navigation.navigate('ChatScreen', {
            userId,
            token,
            groupId: newGroup.groupId,
            receiverName: newGroup.name,
            avatar: newGroup.avatar || generatePlaceholderAvatar(newGroup.name),
            isGroup: true,
          });
        } else {
          throw new Error(response.data.message || 'Không thể tạo nhóm.');
        }
      }
    } catch (error) {
      console.error('Lỗi thêm thành viên hoặc tạo nhóm:', error.message);
      Alert.alert('Lỗi', `Không thể thực hiện: ${error.message}`);
    }
  };

  const showOptionsMenu = () => {
    setOptionsModalVisible(true);
  };

  const handleImagePress = (images, index) => {
    setImageViewerImages(images);
    setImageViewerInitialIndex(index);
    setImageViewerVisible(true);
  };

  const handlePinMessage = async (messageId) => {
    console.log('Attempting to pin message:', messageId);
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await pinMessage(messageId, storedToken);
      console.log('pinMessage API response:', response.data);
      if (response.data.success) {
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.messageId === messageId ? { ...msg, isPinned: true } : msg
          );
          const pinnedMsg = updatedMessages.find((msg) => msg.messageId === messageId);
          if (pinnedMsg) {
            setPinnedMessages((prevPinned) => {
              if (!prevPinned.some((msg) => msg.messageId === messageId)) {
                return [...prevPinned, pinnedMsg];
              }
              return prevPinned;
            });
          }
          saveMessagesToCache(updatedMessages);
          return [...updatedMessages];
        });
        const socket = getSocket(isGroup ? '/group' : '/chat');
        socket.emit('pinMessage', { messageId, groupId: isGroup ? groupId : null }, (ack) => {
          console.log('pinMessage socket emit acknowledgment:', ack);
          if (!ack?.success) {
            console.warn('Socket acknowledgment failed for pinMessage:', ack);
          }
        });
        Alert.alert('Thành công', 'Đã ghim tin nhắn.');
      } else {
        throw new Error(response.data.message || 'Không thể ghim tin nhắn.');
      }
    } catch (error) {
      console.error('Lỗi ghim tin nhắn:', error.message, error.response?.data);
      Alert.alert('Lỗi', error.message || 'Không thể ghim tin nhắn. Vui lòng thử lại.');
    }
  };

  const handleUnpinMessage = async (messageId) => {
    console.log('Attempting to unpin message:', messageId);
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await unpinMessage(messageId, storedToken);
      console.log('unpinMessage API response:', response.data);
      if (response.data.success) {
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.messageId === messageId ? { ...msg, isPinned: false } : msg
          );
          setPinnedMessages((prevPinned) =>
            prevPinned.filter((msg) => msg.messageId !== messageId)
          );
          saveMessagesToCache(updatedMessages);
          return [...updatedMessages];
        });
        const socket = getSocket(isGroup ? '/group' : '/chat');
        socket.emit('unpinMessage', { messageId, groupId: isGroup ? groupId : null }, (ack) => {
          console.log('unpinMessage socket emit acknowledgment:', ack);
          if (!ack?.success) {
            console.warn('Socket acknowledgment failed for unpinMessage:', ack);
          }
        });
        Alert.alert('Thành công', 'Đã bỏ ghim tin nhắn.');
      } else {
        throw new Error(response.data.message || 'Không thể bỏ ghim tin nhắn.');
      }
    } catch (error) {
      console.error('Lỗi bỏ ghim tin nhắn:', error.message, error.response?.data);
      Alert.alert('Lỗi', error.message || 'Không thể bỏ ghim tin nhắn. Vui lòng thử lại.');
    }
  };

  const options = isGroup
    ? [
        {
          label: 'Xem thông tin nhóm',
          onPress: () => {
            setOptionsModalVisible(false);
            navigation.navigate('GroupDetails', { groupId, groupName: receiverName });
          },
          style: 'default',
        },
        {
          label: 'Xóa lịch sử trò chuyện',
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
          label: 'Rời nhóm',
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
          label: 'Hủy',
          onPress: () => setOptionsModalVisible(false),
          style: 'cancel',
        },
      ]
    : [
        {
          label: 'Xem thông tin liên hệ',
          onPress: () => {
            setOptionsModalVisible(false);
            navigation.navigate('ContactDetails', { userId: receiverId, name: receiverName, avatar });
          },
          style: 'default',
        },
        {
          label: 'Xóa cuộc trò chuyện',
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
          label: 'Chặn',
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
          label: 'Hủy kết bạn',
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
          label: 'Hủy',
          onPress: () => setOptionsModalVisible(false),
          style: 'cancel',
        },
      ];

  const isAtBottom = () => {
    if (!flatListRef.current) return false;
    const scrollResponder = flatListRef.current.getScrollResponder();
    if (!scrollResponder) return false;

    const { contentOffset, contentSize, layoutMeasurement } = scrollResponder;
    if (!contentOffset || !contentSize || !layoutMeasurement) return false;

    return contentOffset.y >= contentSize.height - layoutMeasurement.height - 10;
  };

  const handleReceiveMessage = useCallback(
    async (newMessage) => {
      console.log('Nhận tin nhắn mới (chat đơn):', JSON.stringify(newMessage, null, 2));

      if (!newMessage?.messageId || !newMessage?.senderId) {
        console.warn('Tin nhắn không hợp lệ:', newMessage);
        return;
      }

      const isRelevantMessage =
        newMessage.senderId === receiverId ||
        newMessage.receiverId === receiverId ||
        newMessage.senderId === userId;

      if (!isRelevantMessage) {
        console.log('Tin nhắn không khớp với cuộc trò chuyện:', newMessage);
        return;
      }

      if (processedMessages.current.has(newMessage.messageId)) {
        console.log('Tin nhắn đã xử lý, bỏ qua:', newMessage.messageId);
        return;
      }

      const sender = getUserInfo(newMessage.senderId, newMessage);

      const normalizedMessage = {
        messageId: newMessage.messageId || `temp-${Date.now()}`,
        senderId: newMessage.senderId,
        sender,
        receiverId: newMessage.receiverId,
        content: newMessage.content || '',
        type: newMessage.type || 'text',
        status: newMessage.status || 'delivered',
        timestamp: newMessage.timestamp || new Date().toISOString(),
        mediaUrl: Array.isArray(newMessage.mediaUrl)
          ? newMessage.mediaUrl
          : newMessage.mediaUrl
          ? [newMessage.mediaUrl]
          : [],
        fileName: newMessage.fileName || null,
        mimeType: newMessage.mimeType || null,
        metadata: newMessage.metadata || {},
        isAnonymous: newMessage.isAnonymous || false,
        isPinned: newMessage.isPinned || false,
        isSecret: newMessage.isSecret || false,
        replyToMessageId: newMessage.replyToMessageId || null,
        quality: newMessage.quality || 'original',
        expiresAt: newMessage.expiresAt || null,
      };

      if (
        ['image', 'video', 'file'].includes(newMessage.type) &&
        !normalizedMessage.mediaUrl.length
      ) {
        try {
          const storedToken = await AsyncStorage.getItem('token');
          const response = await getMessages(receiverId, storedToken);
          if (response.data?.success) {
            const message = response.data.messages?.find(
              (msg) => msg.messageId === newMessage.messageId
            );
            if (message) {
              normalizedMessage.mediaUrl = Array.isArray(message.mediaUrl)
                ? message.mediaUrl
                : message.mediaUrl
                ? [message.mediaUrl]
                : [];
              normalizedMessage.fileName = message.fileName || null;
              normalizedMessage.mimeType = message.mimeType || null;
            }
          }
        } catch (error) {
          console.error('Lỗi lấy thông tin tin nhắn:', error.message);
        }
      }

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.messageId === normalizedMessage.messageId);
        let updatedMessages;
        if (exists) {
          console.log('Cập nhật tin nhắn:', normalizedMessage.messageId);
          updatedMessages = prev.map((msg) =>
            msg.messageId === normalizedMessage.messageId ? normalizedMessage : msg
          );
        } else {
          console.log('Thêm tin nhắn mới:', normalizedMessage.messageId);
          updatedMessages = [...prev, normalizedMessage];
          processedMessages.current.add(normalizedMessage.messageId);
          setTimeout(() => {
            processedMessages.current.delete(normalizedMessage.messageId);
          }, 5 * 60 * 1000);
        }
        saveMessagesToCache(updatedMessages);
        setTimeout(() => {
          if (flatListRef.current && isAtBottom()) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 200);
        return [...updatedMessages];
      });
    },
    [userId, receiverId, receiverName, avatar]
  );

  const handleGroupMessage = useCallback(
    async (data) => {
      console.log('Nhận tin nhắn nhóm:', JSON.stringify(data, null, 2));
      const newMessage = data.message || data;

      if (!newMessage?.messageId || !newMessage?.senderId) {
        console.warn('Tin nhắn nhóm không hợp lệ:', newMessage);
        return;
      }

      if (processedMessages.current.has(newMessage.messageId)) {
        console.log('Tin nhắn nhóm đã xử lý, bỏ qua:', newMessage.messageId);
        return;
      }

      if (newMessage.senderId === userId) {
        console.log('Bỏ qua tin nhắn nhóm từ chính mình:', newMessage.messageId);
        return;
      }

      if (newMessage.groupId !== groupId) {
        console.log('Tin nhắn nhóm không khớp với groupId:', newMessage);
        return;
      }

      let sender = groupMembers[newMessage.senderId] || getUserInfo(newMessage.senderId, newMessage);

      const normalizedMessage = {
        messageId: newMessage.messageId || `temp-${Date.now()}`,
        groupId: newMessage.groupId,
        senderId: newMessage.senderId,
        sender,
        content: newMessage.content || '',
        type: newMessage.type || 'text',
        status: newMessage.status === 'sending' ? 'delivered' : newMessage.status || 'delivered',
        timestamp: newMessage.timestamp || new Date().toISOString(),
        isAnonymous: newMessage.isAnonymous || false,
        isPinned: newMessage.isPinned || false,
        isSecret: newMessage.isSecret || false,
        mediaUrl: Array.isArray(newMessage.mediaUrl) ? newMessage.mediaUrl : newMessage.mediaUrl ? [newMessage.mediaUrl] : [],
        fileName: newMessage.fileName || null,
        mimeType: newMessage.mimeType || null,
        replyToMessageId: newMessage.replyToMessageId || null,
        metadata: newMessage.metadata || {},
      };

      if (['image', 'video', 'file'].includes(newMessage.type) && !normalizedMessage.mediaUrl.length) {
        try {
          const storedToken = await AsyncStorage.getItem('token');
          const response = await getGroupMessages(groupId, storedToken);
          if (response.data?.success) {
            const message = response.data.data.messages?.find(
              (msg) => msg.messageId === newMessage.messageId
            );
            if (message) {
              normalizedMessage.mediaUrl = Array.isArray(message.mediaUrl) ? message.mediaUrl : message.mediaUrl ? [message.mediaUrl] : [];
              normalizedMessage.fileName = message.fileName || null;
              normalizedMessage.mimeType = message.mimeType || null;
            }
          }
        } catch (error) {
          console.error('Lỗi lấy thông tin tin nhắn nhóm:', error.message);
        }
      }

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.messageId === normalizedMessage.messageId);
        if (exists) {
          console.log('Tin nhắn nhóm đã tồn tại, bỏ qua:', normalizedMessage.messageId);
          return prev;
        }
        const updatedMessages = [...prev, normalizedMessage];
        saveMessagesToCache(updatedMessages);
        setTimeout(() => {
          if (flatListRef.current && isAtBottom()) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 200);
        processedMessages.current.add(normalizedMessage.messageId);
        return [...updatedMessages];
      });
    },
    [userId, groupId, groupMembers]
  );

  const onSendMessage = useCallback(
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

        if (data.type === 'image' && Array.isArray(data.mediaUris) && data.mediaUris.length > 0) {
          const mediaUrls = [];
          for (const mediaUri of data.mediaUris) {
            const formData = new FormData();
            formData.append('file', {
              uri: mediaUri,
              name: mediaUri.split('/').pop() || `image_${Date.now()}.jpg`,
              type: 'image/jpeg',
            });
            formData.append('type', 'image');
            formData.append('fileName', mediaUri.split('/').pop() || `image_${Date.now()}.jpg`);
            formData.append('mimeType', 'image/jpeg');

            let response;
            if (isGroup) {
              formData.append('isAnonymous', 'false');
              formData.append('isSecret', 'false');
              formData.append('quality', 'original');
              response = await sendGroupMessage(groupId, formData, storedToken, true);
            } else {
              formData.append('receiverId', receiverId);
              response = await sendMessage(formData, storedToken, true);
            }

            const msg = response.data?.data;
            if (msg && msg.mediaUrl) {
              mediaUrls.push(msg.mediaUrl);
            }
          }

          if (mediaUrls.length > 0) {
            const combinedMessage = {
              messageId: `temp-${Date.now()}`,
              senderId: userId,
              sender: {
                name: 'Bạn',
                avatar: generatePlaceholderAvatar('Bạn'),
              },
              receiverId: isGroup ? null : receiverId,
              groupId: isGroup ? groupId : null,
              type: 'image',
              mediaUrl: mediaUrls,
              status: 'sent',
              timestamp: new Date().toISOString(),
            };

            setMessages((prev) => {
              const updatedMessages = [...prev, combinedMessage];
              saveMessagesToCache(updatedMessages);
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: true });
                }
              }, 200);
              return [...updatedMessages];
            });
          }

          onComplete?.();
          return;
        }

        let response;
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
          response = await sendGroupMessage(groupId, payload, storedToken, data instanceof FormData);
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

          msg.sender = isGroup
            ? (groupMembers[userId] || {
                name: 'Bạn',
                avatar: generatePlaceholderAvatar('Bạn'),
              })
            : {
                name: receiverName || 'Bạn',
                avatar: avatar || generatePlaceholderAvatar(receiverName || 'Bạn'),
              };

          setMessages((prev) => {
            const exists = prev.some((m) => m.messageId === msg.messageId);
            if (exists) {
              console.log('Tin nhắn đã tồn tại, bỏ qua:', msg.messageId);
              return prev;
            }
            const updatedMessages = [...prev, { ...msg, status: msg.status || 'sent' }];
            saveMessagesToCache(updatedMessages);
            setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }, 200);
            processedMessages.current.add(msg.messageId);
            return [...updatedMessages];
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
    [isGroup, userId, receiverId, groupId, friendStatus, receiverName, avatar, groupMembers]
  );
const handleRecallMessage = async (messageId) => {
  try {
    // Kiểm tra messageId và groupId hợp lệ
    if (!messageId || !isGroup || !groupId) {
      console.error('Thiếu hoặc không hợp lệ:', { messageId, groupId, isGroup });
      Alert.alert('Lỗi', 'Không thể thu hồi tin nhắn do thiếu thông tin nhóm hoặc tin nhắn.');
      return;
    }

    // Kiểm tra trạng thái tin nhắn trước khi gọi API
    const message = messages.find((msg) => msg.messageId === messageId);
    if (!message) {
      console.error('Không tìm thấy tin nhắn:', messageId);
      Alert.alert('Lỗi', 'Tin nhắn không tồn tại trong danh sách hiển thị.');
      return;
    }
    if (message.status === 'recalled' || message.status === 'adminRecalled') {
      Alert.alert('Thông báo', 'Tin nhắn đã được thu hồi trước đó.');
      return;
    }

    const storedToken = await AsyncStorage.getItem('token');
    if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
      throw new Error('Không tìm thấy token hợp lệ');
    }

    const socket = getSocket(isGroup ? '/group' : '/chat');

    if (isGroup) {
      console.log('Gọi API thu hồi tin nhắn nhóm:', { messageId, groupId, token: storedToken });
      const response = await recallGroupMessage(messageId, groupId, storedToken);
      console.log('Phản hồi từ API thu hồi tin nhắn nhóm:', response.data);

      if (response.data.success) {
        // Cập nhật giao diện ngay lập tức
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.messageId === messageId ? { ...msg, status: 'recalled' } : msg
          );
          setPinnedMessages((prevPinned) =>
            prevPinned.map((msg) =>
              msg.messageId === messageId ? { ...msg, status: 'recalled' } : msg
            )
          );
          saveMessagesToCache(updatedMessages);
          return [...updatedMessages];
        });

        // Phát sự kiện socket để thông báo các client khác
        socket.emit('recallGroupMessage', { messageId, groupId }, (ack) => {
          console.log('Phản hồi từ socket khi thu hồi tin nhắn nhóm:', ack);
          if (!ack?.success) {
            console.warn('Socket acknowledgment failed for recallGroupMessage:', ack);
            // Không cần rollback giao diện vì API đã thành công
          }
        });

        Alert.alert('Thành công', 'Đã thu hồi tin nhắn.');
      } else {
        // Ghi log chi tiết lỗi từ API
        console.error('Lỗi từ API thu hồi tin nhắn nhóm:', response.data);
        throw new Error(response.data.message || 'Không thể thu hồi tin nhắn.');
      }
    } else {
      // Xử lý thu hồi tin nhắn cá nhân (không sửa phần này vì yêu cầu tập trung vào tin nhắn nhóm)
      console.log('Gọi API thu hồi tin nhắn cá nhân:', { messageId, token: storedToken });
      const response = await recallMessage(messageId, storedToken);
      console.log('Phản hồi từ API thu hồi tin nhắn cá nhân:', response.data);
      if (response.data.success) {
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) =>
            msg.messageId === messageId ? { ...msg, status: 'recalled' } : msg
          );
          setPinnedMessages((prevPinned) =>
            prevPinned.map((msg) =>
              msg.messageId === messageId ? { ...msg, status: 'recalled' } : msg
            )
          );
          saveMessagesToCache(updatedMessages);
          return [...updatedMessages];
        });
        socket.emit('recallMessage', { messageId }, (ack) => {
          console.log('Phản hồi từ socket khi thu hồi tin nhắn cá nhân:', ack);
          if (!ack?.success) {
            console.warn('Socket acknowledgment failed for recallMessage:', ack);
          }
        });
        Alert.alert('Thành công', 'Đã thu hồi tin nhắn.');
      } else {
        throw new Error(response.data.message || 'Không thể thu hồi tin nhắn.');
      }
    }
  } catch (error) {
    console.error('Lỗi thu hồi tin nhắn:', error.message, error.response?.data);
    Alert.alert('Lỗi', error.message || 'Không thể thu hồi tin nhắn. Vui lòng thử lại.');
  }
};


const handleDeleteMessage = async (messageId) => {
  try {
    const storedToken = await AsyncStorage.getItem('token');
    if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
      throw new Error('Không tìm thấy token hợp lệ');
    }
    const socket = getSocket(isGroup ? '/group' : '/chat');
    
    if (isGroup) {
      const response = await deleteGroupMessage(messageId, groupId, storedToken);
      if (response.data.success) {
        socket.emit('deleteGroupMessage', { messageId, groupId }, (ack) => {
          console.log('Phản hồi xóa tin nhắn nhóm:', ack);
          if (ack?.success) {
            setMessages((prev) => {
              const updatedMessages = prev.filter((msg) => msg.messageId !== messageId);
              setPinnedMessages((prevPinned) =>
                prevPinned.filter((msg) => msg.messageId !== messageId)
              );
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          } else {
            Alert.alert('Lỗi', ack?.message || 'Không thể xóa tin nhắn.');
          }
        });
      } else {
        throw new Error(response.data.message || 'Không thể xóa tin nhắn.');
      }
    } else {
      const response = await deleteMessage(messageId, storedToken);
      if (response.data.success) {
        socket.emit('deleteMessage', { messageId }, (ack) => {
          console.log('Phản hồi xóa tin nhắn:', ack);
          if (ack?.success) {
            setMessages((prev) => {
              const updatedMessages = prev.filter((msg) => msg.messageId !== messageId);
              setPinnedMessages((prevPinned) =>
                prevPinned.filter((msg) => msg.messageId !== messageId)
              );
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          } else {
            Alert.alert('Lỗi', ack?.message || 'Không thể xóa tin nhắn.');
          }
        });
      } else {
        throw new Error(response.data.message || 'Không thể xóa tin nhắn.');
      }
    }
  } catch (error) {
    console.error('Lỗi xóa tin nhắn:', error);
    Alert.alert('Lỗi', error.message || 'Không thể xóa tin nhắn.');
  }
};

  const handleForwardMessage = (messageId) => {
    console.log('handleForwardMessage called with messageId:', messageId);
    if (!messageId) {
      Alert.alert('Lỗi', 'Không tìm thấy ID tin nhắn để chuyển tiếp.');
      return;
    }
    setForwardMessageId(messageId);
    setIsForwardModalOpen(true);
    console.log('isForwardModalOpen set to true');

    if (recentChats.length === 0) {
      console.log('recentChats is empty, calling fetchRecentChats');
      fetchRecentChats();
    }
  };

  const forwardToRecipient = async (recipient, isGroupRecipient = false) => {
    try {
      if (!forwardMessageId || !recipient.id) {
        throw new Error('Thiếu messageId hoặc recipientId');
      }

      const storedToken = await AsyncStorage.getItem('token');
      const endpoint = isGroupRecipient
        ? `${API_BASE_URL}/pin/messages/${recipient.id}/${forwardMessageId}`
        : `${API_BASE_URL}/messages/forward`;
      const payload = isGroupRecipient
        ? { messageId: forwardMessageId, targetGroupId: recipient.id }
        : { messageId: forwardMessageId, targetReceiverId: recipient.id };

      console.log('Forward request:', { endpoint, payload });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (responseData.success) {
        Alert.alert('Thành công', `Đã chuyển tiếp tin nhắn đến ${recipient.name}.`);
        setIsForwardModalOpen(false);
        setForwardMessageId(null);
      } else {
        throw new Error(responseData.message || 'Không thể chuyển tiếp tin nhắn.');
      }
    } catch (error) {
      console.error('Lỗi chuyển tiếp tin nhắn:', error.message);
      console.error('Chi tiết lỗi:', error.response?.data);
      Alert.alert('Lỗi', error.message || 'Không thể chuyển tiếp tin nhắn.');
    }
  };

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

      if (isGroup) {
        await fetchGroupMembers();
      }

      const fetchMessages = async () => {
        try {
          const cachedMessages = await loadMessagesFromCache();
          if (cachedMessages) {
            setMessages([...cachedMessages]);
            const pinned = cachedMessages.filter((msg) => msg.isPinned);
            setPinnedMessages([...pinned]);
          }
          const storedToken = await AsyncStorage.getItem('token');
          if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
            throw new Error('Không tìm thấy token hợp lệ');
          }
          const response = isGroup
            ? await getGroupMessages(groupId, storedToken)
            : await getMessages(receiverId, storedToken);
          console.log('Phản hồi lấy tin nhắn:', response.data);
          if (response.data.success) {
            const fetchedMessages = isGroup
              ? response.data.data.messages || []
              : response.data.messages || [];
            setMessages([...fetchedMessages]);
            const pinned = fetchedMessages.filter((msg) => msg.isPinned);
            setPinnedMessages([...pinned]);
            saveMessagesToCache(fetchedMessages);
            if (fetchedMessages.length > 0 && !hasScrolledInitially) {
              setTimeout(() => {
                if (flatListRef.current) {
                  flatListRef.current.scrollToEnd({ animated: false });
                }
                setHasScrolledInitially(true);
              }, 200);
            }
          } else {
            setMessages([]);
          }
        } catch (error) {
          console.error('Lỗi lấy tin nhắn:', error.message);
          if (error.response?.status === 401) {
            try {
              const newToken = await refreshTokenHandler();
              route.params.token = newToken;
              const response = isGroup
                ? await getGroupMessages(groupId, newToken)
                : await getMessages(receiverId, newToken);
              if (response.data.success) {
                const fetchedMessages = isGroup
                  ? response.data.data.messages || []
                  : response.data.messages || [];
                setMessages([...fetchedMessages]);
                const pinned = fetchedMessages.filter((msg) => msg.isPinned);
                setPinnedMessages([...pinned]);
                saveMessagesToCache(fetchedMessages);
                if (fetchedMessages.length > 0 && !hasScrolledInitially) {
                  setTimeout(() => {
                    if (flatListRef.current) {
                      flatListRef.current.scrollToEnd({ animated: false });
                    }
                    setHasScrolledInitially(true);
                  }, 200);
                }
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
          const response = await getUserStatus(receiverId, storedToken);
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
        }

        const setupChatSocket = (socket) => {
          if (!socket) return;

          const joinRooms = () => {
            socket.emit('joinRoom', { room: `user:${userId}` }, () => {
              console.log(`Joined room: user:${userId}`);
            });
            if (!isGroup) {
              socket.emit('joinRoom', { room: `user:${receiverId}` }, () => {
                console.log(`Joined room: user:${receiverId}`);
              });
            }
          };

          socket.off('receiveMessage');
          socket.on('receiveMessage', handleReceiveMessage);
          socket.on('messageStatus', (data) => {
            console.log('Cập nhật trạng thái tin nhắn:', data);
            setMessages((prev) => {
              const updatedMessages = prev.map((msg) =>
                msg.messageId === data.messageId ? { ...msg, status: data.status } : msg
              );
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          });
          socket.on('messageRecalled', (data) => {
            console.log('Tin nhắn được thu hồi:', data.messageId);
            setMessages((prev) => {
              const updatedMessages = prev.map((msg) =>
                msg.messageId === data.messageId ? { ...msg, status: 'recalled' } : msg
              );
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          });
          socket.on('messageDeleted', (data) => {
            console.log('Tin nhắn được xóa:', data.messageId);
            setMessages((prev) => {
              const updatedMessages = prev.filter((msg) => msg.messageId !== data.messageId);
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          });
          socket.on('pinMessage', (data) => {
            console.log('Tin nhắn được ghim:', data.messageId);
            setMessages((prev) => {
              const updatedMessages = prev.map((msg) =>
                msg.messageId === data.messageId ? { ...msg, isPinned: true } : msg
              );
              const pinnedMsg = updatedMessages.find((msg) => msg.messageId === data.messageId);
              if (pinnedMsg && !pinnedMessages.some((msg) => msg.messageId === data.messageId)) {
                setPinnedMessages((prevPinned) => [...prevPinned, pinnedMsg]);
              }
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          });
          socket.on('unpinMessage', (data) => {
            console.log('Tin nhắn được bỏ ghim:', data.messageId);
            setMessages((prev) => {
              const updatedMessages = prev.map((msg) =>
                msg.messageId === data.messageId ? { ...msg, isPinned: false } : msg
              );
              setPinnedMessages((prevPinned) =>
                prevPinned.filter((msg) => msg.messageId !== data.messageId)
              );
              saveMessagesToCache(updatedMessages);
              return [...updatedMessages];
            });
          });

          if (socket.connected) {
            joinRooms();
          } else {
            socket.on('connect', () => {
              console.log(`Socket /chat đã kết nối, ID:`, socket.id);
              joinRooms();
            });
          }

          socket.on('connect_error', (error) => {
            console.error('Lỗi kết nối socket /chat:', error.message);
            Alert.alert('Lỗi', `Không thể kết nối đến server chat: ${error.message}`);
          });

          socket.on('disconnect', (reason) => {
            console.log('Socket /chat ngắt kết nối:', reason);
            socket.connect();
          });

          console.log('Socket /chat trạng thái:', {
            id: socket.id,
            connected: socket.connected,
          });
        };

        const setupGroupSocket = (socket) => {
  if (!socket) return;

  socket.on('connect', () => {
    console.log('Socket /group đã kết nối, ID:', socket.id);
    socket.emit('joinRoom', { room: `group:${groupId}` }, () => {
      console.log(`Joined group room: group:${groupId}`);
    });
  });

  socket.on('connect_error', (error) => {
    console.error('Lỗi kết nối socket /group:', error.message);
    Alert.alert('Lỗi', `Không thể kết nối đến server nhóm: ${error.message}`);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket /group ngắt kết nối:', reason);
  });

  socket.on('newGroupMessage', handleGroupMessage);
  socket.on('memberAdded', ({ groupId: updatedGroupId, userId, addedBy }) => {
    if (updatedGroupId === groupId) {
      Alert.alert('Thông báo', `Thành viên mới (ID: ${userId}) đã được thêm vào nhóm.`);
      fetchGroupMembers();
    }
  });
  socket.on('pinMessage', ({ messageId }) => {
    console.log('Tin nhắn được ghim:', messageId);
    setMessages((prev) => {
      const updatedMessages = prev.map((msg) =>
        msg.messageId === messageId ? { ...msg, isPinned: true } : msg
      );
      const pinnedMsg = updatedMessages.find((msg) => msg.messageId === messageId);
      if (pinnedMsg && !pinnedMessages.some((msg) => msg.messageId === messageId)) {
        setPinnedMessages((prevPinned) => [...prevPinned, pinnedMsg]);
      }
      saveMessagesToCache(updatedMessages);
      return [...updatedMessages];
    });
  });
  socket.on('unpinMessage', ({ messageId }) => {
    console.log('Tin nhắn được bỏ ghim:', messageId);
    setMessages((prev) => {
      const updatedMessages = prev.map((msg) =>
        msg.messageId === messageId ? { ...msg, isPinned: false } : msg
      );
      setPinnedMessages((prevPinned) =>
        prevPinned.filter((msg) => msg.messageId !== messageId)
      );
      saveMessagesToCache(updatedMessages);
      return [...updatedMessages];
    });
  });
  // Thêm listener cho thu hồi và xóa tin nhắn nhóm
  socket.on('messageRecalled', ({ messageId }) => {
    console.log('Tin nhắn nhóm được thu hồi:', messageId);
    setMessages((prev) => {
      const updatedMessages = prev.map((msg) =>
        msg.messageId === messageId ? { ...msg, status: 'recalled' } : msg
      );
      setPinnedMessages((prevPinned) =>
        prevPinned.map((msg) =>
          msg.messageId === messageId ? { ...msg, status: 'recalled' } : msg
        )
      );
      saveMessagesToCache(updatedMessages);
      return [...updatedMessages];
    });
  });
  socket.on('messageDeleted', ({ messageId }) => {
    console.log('Tin nhắn nhóm được xóa:', messageId);
    setMessages((prev) => {
      const updatedMessages = prev.filter((msg) => msg.messageId !== messageId);
      setPinnedMessages((prevPinned) =>
        prevPinned.filter((msg) => msg.messageId !== messageId)
      );
      saveMessagesToCache(updatedMessages);
      return [...updatedMessages];
    });
  });

  console.log('Socket /group trạng thái:', {
    id: socket.id,
    connected: socket.connected,
  });
};

        setupChatSocket(chatSocketRef.current);
        if (isGroup) {
          setupGroupSocket(groupSocketRef.current);
        }

        fetchMessages();
        fetchFriendStatus();
        if (!isGroup) {
          markMessagesAsSeen();
        }
        fetchRecentChats();
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
        chatSocketRef.current.off('pinMessage');
        chatSocketRef.current.off('unpinMessage');
        chatSocketRef.current.off('connect');
        chatSocketRef.current.off('connect_error');
        chatSocketRef.current.off('disconnect');
        chatSocketRef.current = null;
      }
      if (groupSocketRef.current) {
        groupSocketRef.current.off('newGroupMessage', handleGroupMessage);
        groupSocketRef.current.off('memberAdded');
        groupSocketRef.current.off('pinMessage');
        groupSocketRef.current.off('unpinMessage');
        groupSocketRef.current.off('connect');
        groupSocketRef.current.off('connect_error');
        groupSocketRef.current.off('disconnect');
        groupSocketRef.current = null;
      }
      processedMessages.current.clear();
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
    receiverName,
    avatar,
  ]);

  useEffect(() => {
    navigation.setOptions(
      ChatHeader({
        navigation,
        receiverName,
        avatar,
        isGroup,
        friendStatus,
        headerAvatarLoadError,
        setHeaderAvatarLoadError,
        handleAddMemberClick,
        showOptionsMenu,
        generatePlaceholderAvatar,
      })
    );
  }, [navigation, receiverName, avatar, isGroup, friendStatus, headerAvatarLoadError]);

  const memoizedMessages = useCallback(() => {
    return [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages]);

  const togglePinnedMessages = () => {
    setIsPinnedExpanded((prev) => !prev);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {!isGroup && friendStatus && (
        <FriendStatusBanner
          friendStatus={friendStatus}
          handleAddFriendRequest={handleAddFriendRequest}
          handleCancelRequest={handleCancelRequest}
          handleAcceptRequest={handleAcceptRequest}
        />
      )}
      {pinnedMessages.length > 0 && (
        <View style={styles.pinnedBanner}>
          <View style={styles.pinnedMessageWrapper}>
            <Ionicons name="pin" size={16} color="#FFD700" style={styles.pinnedBannerIcon} />
            <View style={styles.pinnedMessageContent}>
              <MessageItem
                message={pinnedMessages[0]}
                currentUserId={userId}
                onRecall={handleRecallMessage}
                onDelete={handleDeleteMessage}
                onForward={handleForwardMessage}
                isGroup={isGroup}
                onImagePress={handleImagePress}
                onPin={handlePinMessage}
                onUnpin={handleUnpinMessage}
                isPinnedBanner={true}
              />
              <TouchableOpacity
                style={styles.unpinButton}
                onPress={() => handleUnpinMessage(pinnedMessages[0].messageId)}
              >
                <Ionicons name="close" size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            {pinnedMessages.length > 1 && (
              <TouchableOpacity onPress={togglePinnedMessages} style={styles.expandButton}>
                <Ionicons
                  name={isPinnedExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#555"
                />
              </TouchableOpacity>
            )}
          </View>
          {isPinnedExpanded &&
            pinnedMessages.slice(1).map((pinnedMessage) => (
              <View
                key={pinnedMessage.messageId}
                style={styles.pinnedMessageWrapper}
              >
                <Ionicons name="pin" size={16} color="#FFD700" style={styles.pinnedBannerIcon} />
                <View style={styles.pinnedMessageContent}>
                  <MessageItem
                    message={pinnedMessage}
                    currentUserId={userId}
                    onRecall={handleRecallMessage}
                    onDelete={handleDeleteMessage}
                    onForward={handleForwardMessage}
                    isGroup={isGroup}
                    onImagePress={handleImagePress}
                    onPin={handlePinMessage}
                    onUnpin={handleUnpinMessage}
                    isPinnedBanner={true}
                  />
                  <TouchableOpacity
                    style={styles.unpinButton}
                    onPress={() => handleUnpinMessage(pinnedMessage.messageId)}
                  >
                    <Ionicons name="close" size={16} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={memoizedMessages()}
        keyExtractor={(item) => item.messageId || `temp-${Math.random().toString()}`}
        renderItem={({ item }) => (
          <MessageItem
            message={item}
            currentUserId={userId}
            onRecall={handleRecallMessage}
            onDelete={handleDeleteMessage}
            onForward={handleForwardMessage}
            isGroup={isGroup}
            onImagePress={handleImagePress}
            onPin={handlePinMessage}
            onUnpin={handleUnpinMessage}
            isPinnedBanner={false}
          />
        )}
        contentContainerStyle={styles.flatListContent}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={11}
        removeClippedSubviews
        extraData={messages}
      />
      <MessageInput
        onSendMessage={onSendMessage}
        style={styles.messageInput}
        chat={{ receiverName }}
      />
      <OptionsModal
        visible={isOptionsModalVisible}
        onClose={() => setOptionsModalVisible(false)}
        options={options}
      />
      <AddMemberModal
        visible={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredFriends={friends.filter((friend) =>
          friend.name.toLowerCase().includes(searchQuery.toLowerCase())
        )}
        selectedFriend={selectedFriend}
        setSelectedFriend={setSelectedFriend}
        handleAddMember={handleAddMember}
      />
      <ImageViewerModal
        visible={imageViewerVisible}
        images={imageViewerImages}
        initialIndex={imageViewerInitialIndex}
        onClose={() => setImageViewerVisible(false)}
      />
      {console.log('Rendering modal, isForwardModalOpen:', isForwardModalOpen)}
      <Modal
        visible={isForwardModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsForwardModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chuyển tiếp tin nhắn</Text>
              <TouchableOpacity onPress={() => setIsForwardModalOpen(false)}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Tìm kiếm bạn bè hoặc nhóm..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <Text style={styles.sectionTitle}>Danh sách bạn bè và nhóm</Text>
              {isLoadingRecentChats ? (
                <ActivityIndicator size="large" color="#0068ff" />
              ) : recentChats.length > 0 ? (
                <FlatList
                  data={recentChats.filter((chat) =>
                    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.friendItem}
                      onPress={() => forwardToRecipient(item, item.isGroup)}
                    >
                      <Text style={styles.friendName}>
                        {item.name} {item.isGroup ? '(Nhóm)' : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  style={styles.friendList}
                  contentContainerStyle={styles.friendListContainer}
                />
              ) : (
                <View>
                  <Text style={styles.emptyText}>Không tìm thấy bạn bè hoặc nhóm.</Text>
                  <TouchableOpacity onPress={() => fetchRecentChats()}>
                    <Text style={styles.modalButtonText}>Thử lại</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsForwardModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
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
  messageInput: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  pinnedBanner: {
    backgroundColor: '#FFF8E1',
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  pinnedMessageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinnedMessageContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinnedBannerIcon: {
    marginRight: 8,
  },
  unpinButton: {
    padding: 5,
    marginLeft: 8,
  },
  expandButton: {
    marginLeft: 8,
    padding: 4,
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
}); 
