import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, FlatList, Alert, View, TouchableOpacity } from 'react-native';
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
  getUserById,
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
} from '../services/api';

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
  const chatSocketRef = useRef(null);
  const groupSocketRef = useRef(null);
  const flatListRef = useRef(null);
  const processedMessages = useRef(new Set());
  const userCache = useRef(new Map());

  const cacheKey = isGroup ? `messages_group_${groupId}` : `messages_${receiverId}`;

  const generatePlaceholderAvatar = (name) => {
    const colors = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6'];
    const firstChar = name?.charAt(0)?.toUpperCase() || 'U';
    const color = colors[firstChar.charCodeAt(0) % colors.length];
    return `https://placehold.co/40x40/${color.replace('#', '')}/ffffff?text=${firstChar}`;
  };

  const getUserInfo = async (userId, token) => {
    if (userCache.current.has(userId)) {
      return userCache.current.get(userId);
    }
    try {
      const response = await getUserById(userId, token);
      const userInfo = {
        name: response.data.data.name || 'Người dùng',
        avatar:
          response.data.data.avatar ||
          generatePlaceholderAvatar(response.data.data.name || 'Người dùng'),
      };
      userCache.current.set(userId, userInfo);
      return userInfo;
    } catch (error) {
      console.error('Lỗi lấy thông tin người dùng:', error.message);
      const defaultUserInfo = {
        name: 'Người dùng',
        avatar: generatePlaceholderAvatar('Người dùng'),
      };
      userCache.current.set(userId, defaultUserInfo);
      return defaultUserInfo;
    }
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
          ...conversations.map((conv) => ({
            id: conv.otherUserId,
            name: conv.displayName || 'Không có tên',
            isGroup: false,
            avatar: conv.avatar || generatePlaceholderAvatar(conv.displayName || 'Không có tên'),
            lastMessage: conv.lastMessage,
            timestamp: conv.timestamp,
            unreadCount: conv.unreadCount,
          })),
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
        avatar: conv.avatar || generatePlaceholderAvatar(conv.displayName || 'Không có tên'),
      })) || [];

      const friendsResponse = await getFriends(storedToken);
      const friends = friendsResponse.data?.data?.map((friend) => ({
        userId: friend.userId,
        name: friend.name || friend.userId,
        avatar: friend.avatar || generatePlaceholderAvatar(friend.name || friend.userId),
      })) || [];

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
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await getSentFriendRequests(storedToken);
      const request = response.data.data.find((req) => req.userId === receiverId);
      if (!request) {
        Alert.alert('Lỗi', 'Không tìm thấy yêu cầu kết bạn đã gửi.');
        return;
      }
      const cancelResponse = await cancelFriendRequest(request.requestId, storedToken);
      if (cancelResponse.data.success) {
        Alert.alert('Thành công', 'Đã hủy yêu cầu kết bạn!');
        setFriendStatus('stranger');
      } else {
        throw new Error(cancelResponse.data.message || 'Không thể hủy yêu cầu.');
      }
    } catch (error) {
      console.error('Lỗi hủy yêu cầu kết bạn:', error);
      Alert.alert('Lỗi', error.message || 'Không thể hủy yêu cầu kết bạn.');
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
          return updatedMessages;
        });
        const socket = getSocket(isGroup ? '/group' : '/chat', token);
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
          return updatedMessages;
        });
        const socket = getSocket(isGroup ? '/group' : '/chat', token);
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

  const isAtBottom = () => {
    if (!flatListRef.current) return false;
    const scrollResponder = flatListRef.current.getScrollResponder();
    if (!scrollResponder) return false;

    const { contentOffset, contentSize, layoutMeasurement } = scrollResponder;
    if (!contentOffset || !contentSize || !layoutMeasurement) return false;

    return contentOffset.y >= contentSize.height - layoutMeasurement.height - 20;
  };

  const handleReceiveMessage = useCallback(
    async (newMessage) => {
      console.log('Raw socket message:', JSON.stringify(newMessage, null, 2));

      if (!newMessage?.messageId || !newMessage?.senderId) {
        console.warn('Tin nhắn không hợp lệ:', newMessage);
        return;
      }

      if (processedMessages.current.has(newMessage.messageId)) {
        console.log('Tin nhắn đã được xử lý, bỏ qua:', newMessage.messageId);
        return;
      }

      if (newMessage.senderId === userId && newMessage.receiverId !== userId) {
        console.log('Bỏ qua tin nhắn từ chính mình:', newMessage.messageId);
        return;
      }

      if (newMessage.senderId !== receiverId && newMessage.receiverId !== receiverId) {
        console.log('Tin nhắn không khớp với receiverId:', newMessage);
        return;
      }

      let sender = newMessage.sender || { name: newMessage.senderName, avatar: newMessage.senderAvatar };
      if (!sender?.name || !sender?.avatar) {
        if (newMessage.senderId === receiverId) {
          sender = {
            name: receiverName || 'Người dùng',
            avatar: avatar || generatePlaceholderAvatar(receiverName || 'Người dùng'),
          };
        } else {
          const storedToken = await AsyncStorage.getItem('token');
          sender = await getUserInfo(newMessage.senderId, storedToken);
        }
      }

      const normalizedMessage = {
        messageId: newMessage.messageId || `temp-${Date.now()}`,
        senderId: newMessage.senderId,
        sender,
        receiverId: newMessage.receiverId,
        content: newMessage.content || '',
        type: newMessage.type || 'text',
        status: newMessage.status || 'delivered',
        timestamp: newMessage.timestamp || new Date().toISOString(),
        mediaUrl: Array.isArray(newMessage.mediaUrl) ? newMessage.mediaUrl : newMessage.mediaUrl ? [newMessage.mediaUrl] : null,
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

      if (['image', 'video', 'file'].includes(newMessage.type) && !normalizedMessage.mediaUrl) {
        try {
          const storedToken = await AsyncStorage.getItem('token');
          const response = await getMessages(receiverId, storedToken);
          const message = response.data.messages.find(
            (msg) => msg.messageId === newMessage.messageId
          );
          if (message) {
            normalizedMessage.mediaUrl = Array.isArray(message.mediaUrl) ? message.mediaUrl : message.mediaUrl ? [message.mediaUrl] : null;
            normalizedMessage.fileName = message.fileName || null;
            normalizedMessage.mimeType = message.mimeType || null;
          }
        } catch (error) {
          console.error('Lỗi lấy thông tin tin nhắn:', error.message);
        }
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
          console.log('Tin nhắn đã tồn tại, bỏ qua:', normalizedMessage.messageId);
          return prev;
        }

        const updatedMessages = [...prev, normalizedMessage];
        saveMessagesToCache(updatedMessages);
        if (isAtBottom()) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
        processedMessages.current.add(normalizedMessage.messageId);
        return updatedMessages;
      });
    },
    [userId, receiverId, receiverName, avatar]
  );

  const handleGroupMessage = useCallback(
    async (data) => {
      console.log('Nhận tin nhắn nhóm:', JSON.stringify(data, null, 2));
      const newMessage = data.message;

      if (!newMessage?.messageId || !newMessage?.senderId) {
        console.warn('Tin nhắn nhóm không hợp lệ:', newMessage);
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

      if (processedMessages.current.has(newMessage.messageId)) {
        console.log('Tin nhắn nhóm đã được xử lý, bỏ qua:', newMessage.messageId);
        return;
      }

      let sender = groupMembers[newMessage.senderId] || {
        name: `Người dùng (${newMessage.senderId.slice(0, 8)})`,
        avatar: generatePlaceholderAvatar(newMessage.senderId.slice(0, 8)),
      };

      if (!groupMembers[newMessage.senderId]) {
        const storedToken = await AsyncStorage.getItem('token');
        try {
          sender = await getUserInfo(newMessage.senderId, storedToken);
        } catch (error) {
          console.error('Không thể lấy thông tin người gửi, sử dụng giá trị tạm thời:', error.message);
          sender = {
            name: `Người dùng (${newMessage.senderId.slice(0, 8)})`,
            avatar: generatePlaceholderAvatar(newMessage.senderId.slice(0, 8)),
          };
        }
      }

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
        mediaUrl: Array.isArray(newMessage.mediaUrl) ? newMessage.mediaUrl : newMessage.mediaUrl ? [newMessage.mediaUrl] : null,
        fileName: newMessage.fileName || null,
        mimeType: newMessage.mimeType || null,
        replyToMessageId: newMessage.replyToMessageId || null,
        metadata: newMessage.metadata || {},
      };

      if (['image', 'video', 'file'].includes(newMessage.type) && !normalizedMessage.mediaUrl) {
        try {
          const storedToken = await AsyncStorage.getItem('token');
          const response = await getGroupMessages(groupId, storedToken);
          const message = response.data.data.messages.find(
            (msg) => msg.messageId === newMessage.messageId
          );
          if (message) {
            normalizedMessage.mediaUrl = Array.isArray(message.mediaUrl) ? message.mediaUrl : message.mediaUrl ? [message.mediaUrl] : null;
            normalizedMessage.fileName = message.fileName || null;
            normalizedMessage.mimeType = message.mimeType || null;
          }
        } catch (error) {
          console.error('Lỗi lấy thông tin tin nhắn nhóm:', error.message);
        }
      }

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.messageId === normalizedMessage.messageId);
        if (exists) return prev;

        const updatedMessages = [...prev, normalizedMessage];
        saveMessagesToCache(updatedMessages);
        if (isAtBottom()) {
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
        processedMessages.current.add(normalizedMessage.messageId);
        return updatedMessages;
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
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
              return updatedMessages;
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
    [isGroup, userId, receiverId, groupId, friendStatus, receiverName, avatar, groupMembers]
  );

  const handleRecallMessage = (messageId) => {
    const socket = getSocket('/chat', token);
    socket.emit('recallMessage', { messageId }, (response) => {
      console.log('Phản hồi thu hồi tin nhắn:', response);
      if (response.success) {
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
          const updatedMessages = prev.filter((msg) => msg.messageId !== messageId);
          setPinnedMessages((prevPinned) =>
            prevPinned.filter((msg) => msg.messageId !== messageId)
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
            setMessages(cachedMessages);
            const pinned = cachedMessages.filter((msg) => msg.isPinned);
            setPinnedMessages(pinned);
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
            setMessages(fetchedMessages);
            const pinned = fetchedMessages.filter((msg) => msg.isPinned);
            setPinnedMessages(pinned);
            saveMessagesToCache(fetchedMessages);
            if (fetchedMessages.length > 0 && !hasScrolledInitially) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
                setHasScrolledInitially(true);
              }, 100);
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
                setMessages(fetchedMessages);
                const pinned = fetchedMessages.filter((msg) => msg.isPinned);
                setPinnedMessages(pinned);
                saveMessagesToCache(fetchedMessages);
                if (fetchedMessages.length > 0 && !hasScrolledInitially) {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                    setHasScrolledInitially(true);
                  }, 100);
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
          if (groupSocketRef.current) {
            groupSocketRef.current.on('memberAdded', ({ groupId: updatedGroupId, userId, addedBy }) => {
              if (updatedGroupId === groupId) {
                Alert.alert('Thông báo', `Thành viên mới (ID: ${userId}) đã được thêm vào nhóm.`);
                fetchGroupMembers();
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
              msg.messageId === messageId ? { ...msg, status } : msg
            );
            setPinnedMessages((prevPinned) =>
              prevPinned.map((msg) =>
                msg.messageId === messageId ? { ...msg, status } : msg
              )
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        };

        const handleMessageRecalled = ({ messageId }) => {
          console.log('Tin nhắn được thu hồi:', messageId);
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
            return updatedMessages;
          });
        };

        const handleMessageDeleted = ({ messageId }) => {
          console.log('Tin nhắn được xóa:', messageId);
          setMessages((prev) => {
            const updatedMessages = prev.filter((msg) => msg.messageId !== messageId);
            setPinnedMessages((prevPinned) =>
              prevPinned.filter((msg) => msg.messageId !== messageId)
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        };

        const handleMessagePinned = ({ messageId }) => {
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
            return updatedMessages;
          });
        };

        const handleMessageUnpinned = ({ messageId }) => {
          console.log('Tin nhắn được bỏ ghim:', messageId);
          setMessages((prev) => {
            const updatedMessages = prev.map((msg) =>
              msg.messageId === messageId ? { ...msg, isPinned: false } : msg
            );
            setPinnedMessages((prevPinned) =>
              prevPinned.filter((msg) => msg.messageId !== messageId)
            );
            saveMessagesToCache(updatedMessages);
            return updatedMessages;
          });
        };

        chatSocketRef.current.on('receiveMessage', handleReceiveMessage);
        chatSocketRef.current.on('messageStatus', handleMessageStatus);
        chatSocketRef.current.on('messageRecalled', handleMessageRecalled);
        chatSocketRef.current.on('messageDeleted', handleMessageDeleted);
        chatSocketRef.current.on('pinMessage', handleMessagePinned);
        chatSocketRef.current.on('unpinMessage', handleMessageUnpinned);
        if (isGroup && groupSocketRef.current) {
          groupSocketRef.current.on('newGroupMessage', handleGroupMessage);
          groupSocketRef.current.on('pinMessage', handleMessagePinned);
          groupSocketRef.current.on('unpinMessage', handleMessageUnpinned);
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
        chatSocketRef.current.off('pinMessage');
        chatSocketRef.current.off('unpinMessage');
        chatSocketRef.current.off('connect');
        chatSocketRef.current.off('connect_error');
        chatSocketRef.current.off('disconnect');
        disconnectSocket('/chat');
      }
      if (groupSocketRef.current) {
        groupSocketRef.current.off('newGroupMessage', handleGroupMessage);
        groupSocketRef.current.off('memberAdded');
        groupSocketRef.current.off('pinMessage');
        groupSocketRef.current.off('unpinMessage');
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
        headerAvatarLoadError,
        setHeaderAvatarLoadError,
        handleAddMemberClick,
        showOptionsMenu,
        generatePlaceholderAvatar,
      })
    );
  }, [navigation, receiverName, avatar, isGroup, headerAvatarLoadError]);

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
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={21}
        removeClippedSubviews
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
  pinnedBannerIcon: {
    marginRight: 8,
  },
  expandButton: {
    marginLeft: 8,
    padding: 4,
  },
});