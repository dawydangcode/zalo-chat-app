import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessageSummary,
  markAsRead,
  searchFriends,
  getFriends,
  getReceivedFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  getUserStatus,
  cancelFriendRequest,
  getSentFriendRequests,
} from '../services/api';
import { AuthContext } from '../context/AuthContext';

// Hàm tính thời gian tương đối
const getRelativeTime = (timestamp) => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now - messageTime) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} giây`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)} phút`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)} giờ`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)} ngày`;
  }
};

const MessagesScreen = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const [chats, setChats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const [sentRequestIds, setSentRequestIds] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();
  const { auth, logout } = useContext(AuthContext);

  // Làm mới dữ liệu khi màn hình được focus
  useFocusEffect(
    React.useCallback(() => {
      const initialize = async () => {
        setIsLoading(true);
        try {
          const savedSearches = await AsyncStorage.getItem('recentSearches');
          if (savedSearches) {
            const parsedSearches = JSON.parse(savedSearches);
            setRecentSearches(parsedSearches);
            if (auth.token && parsedSearches.length > 0) {
              const statuses = {};
              for (const user of parsedSearches) {
                const isCurrentUser = user.phoneNumber === auth.phoneNumber;
                statuses[user.userId] = isCurrentUser ? 'self' : 'none';
                if (!isCurrentUser) {
                  try {
                    const statusResponse = await getUserStatus(user.userId, auth.token);
                    statuses[user.userId] = statusResponse.data.status === 'friend' ? 'friends' : statusResponse.data.status;
                  } catch (error) {
                    console.error(`Lỗi khi lấy trạng thái cho user ${user.userId}:`, error);
                    statuses[user.userId] = 'none';
                  }
                }
              }
              setUserStatuses(statuses);
            }
          }
          if (auth.token && auth.userId) {
            await Promise.all([
              fetchChats(auth.token),
              fetchFriends(auth.token),
              fetchReceivedRequests(auth.token),
              fetchSentRequests(auth.token),
            ]);
          } else {
            Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
            navigation.navigate('Login');
          }
        } catch (error) {
          console.error('Lỗi khởi tạo:', error);
          Alert.alert('Lỗi', 'Không thể khởi tạo dữ liệu.');
        } finally {
          setIsLoading(false);
        }
      };
      initialize();
    }, [auth.token, auth.userId])
  );

  const fetchChats = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getMessageSummary(authToken);
      if (response.data && response.data.success) {
        const conversations = response.data.data?.conversations || [];
        const formattedChats = conversations.map((conv, index) => ({
          id: conv.otherUserId,
          name: conv.displayName || 'Không có tên',
          phoneNumber: conv.phoneNumber || '',
          avatar: conv.avatar || 'https://via.placeholder.com/50',
          lastMessage:
            conv.lastMessage?.status === 'recalled'
              ? '(Tin nhắn đã thu hồi)'
              : conv.lastMessage?.content || 'Chưa có tin nhắn',
          timestamp: conv.lastMessage?.createdAt || new Date().toISOString(),
          unread: conv.unreadCount > 0,
          unreadCount: conv.unreadCount || 0,
          targetUserId: conv.otherUserId,
          pinned: index === 0,
        }));
        setChats(formattedChats);
      } else {
        Alert.alert('Lỗi', 'Không thể lấy danh sách cuộc trò chuyện.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy tóm tắt hội thoại:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', `Lỗi khi lấy danh sách cuộc trò chuyện: ${error.message}`);
      }
    }
  };

  const fetchFriends = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getFriends(authToken);
      // Kiểm tra xem response.data có phải là mảng không
      if (Array.isArray(response.data)) {
        setFriends(response.data || []);
      } else {
        Alert.alert('Lỗi', 'Dữ liệu bạn bè không hợp lệ.');
        setFriends([]);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', `Không thể lấy danh sách bạn bè: ${error.message}`);
        setFriends([]);
      }
    }
  };

  const fetchReceivedRequests = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getReceivedFriendRequests(authToken);
      console.log('Danh sách yêu cầu nhận được:', response.data);
      // Kiểm tra xem response.data có phải là mảng không
      if (Array.isArray(response.data)) {
        setReceivedRequests(response.data || []);
      } else {
        Alert.alert('Lỗi', 'Dữ liệu yêu cầu kết bạn nhận được không hợp lệ.');
        setReceivedRequests([]);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu nhận được:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', `Không thể lấy danh sách yêu cầu nhận được: ${error.message}`);
        setReceivedRequests([]);
      }
    }
  };

  const fetchSentRequests = async (authToken) => {
    try {
      if (!authToken) throw new Error('Không tìm thấy token xác thực.');
      const response = await getSentFriendRequests(authToken);
      console.log('Danh sách yêu cầu đã gửi:', response.data);
      // Kiểm tra xem response.data có phải là mảng không
      if (Array.isArray(response.data)) {
        const sentRequests = response.data || [];
        const newSentRequestIds = {};
        sentRequests.forEach((req) => {
          // API trả về requestId thay vì _id, và receiverInfo chứa thông tin người nhận
          newSentRequestIds[req.receiverInfo.userId] = req.requestId; // Sử dụng requestId thay vì _id
          setUserStatuses((prev) => ({
            ...prev,
            [req.receiverInfo.userId]: 'pending',
          }));
        });
        setSentRequestIds(newSentRequestIds);
        console.log('Updated sentRequestIds:', newSentRequestIds);
      } else {
        Alert.alert('Lỗi', 'Dữ liệu yêu cầu kết bạn không hợp lệ.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu đã gửi:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        Alert.alert('Lỗi', `Không thể lấy danh sách yêu cầu đã gửi: ${error.message}`);
      }
    }
  };

  const handleUserSearch = async (query) => {
    setUserSearchQuery(query);
    if (!query) {
      setUserSearchResults([]);
      setUserStatuses({});
      return;
    }

    const phoneRegex = /^(0|\+84)\d{9,11}$/;
    const cleanedQuery = query.replace(/\s/g, '');

    if (!phoneRegex.test(cleanedQuery)) {
      setUserSearchResults([]);
      setUserStatuses({});
      return;
    }

    try {
      const response = await searchFriends(cleanedQuery, auth.token);
      if (response.data && response.data.success) {
        const results = response.data.data || [];
        if (results.length === 0) {
          setUserSearchResults([]);
          Alert.alert('Thông báo', 'Không tìm thấy người dùng với số điện thoại này.');
        } else {
          setUserSearchResults(results);
          const statuses = {};
          for (const user of results) {
            const isCurrentUser = user.phoneNumber === auth.phoneNumber;
            let userStatus = isCurrentUser ? 'self' : 'none';
            if (!isCurrentUser) {
              const statusResponse = await getUserStatus(user.userId, auth.token);
              userStatus = statusResponse.data.status === 'friend' ? 'friends' : statusResponse.data.status;
              if (sentRequestIds[user.userId]) {
                userStatus = 'pending';
              }
            }
            statuses[user.userId] = userStatus;
          }
          setUserStatuses(statuses);
        }
      } else {
        setUserSearchResults([]);
        Alert.alert('Thông báo', 'Không tìm thấy người dùng với số điện thoại này.');
      }
    } catch (error) {
      console.error('Lỗi khi tìm kiếm người dùng:', error.response?.data || error.message);
      setUserSearchResults([]);
      setUserStatuses({});
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert(
          'Thông báo',
          'Không tìm thấy người dùng với số điện thoại này. Vui lòng kiểm tra số điện thoại.'
        );
      } else {
        Alert.alert('Lỗi', `Có lỗi xảy ra khi tìm kiếm: ${error.message}`);
      }
    }
  };

  const sendFriendRequestHandler = async (targetUserId) => {
    try {
      if (!auth.token) throw new Error('Không tìm thấy token xác thực.');
      console.log('Gửi yêu cầu kết bạn với targetUserId:', targetUserId);
      const response = await sendFriendRequest(targetUserId, auth.token);
      console.log('Phản hồi từ API sendFriendRequest:', response.data);
  
      // Kiểm tra phản hồi có message "Đã gửi yêu cầu kết bạn" hay không
      if (response.data && response.data.message === 'Đã gửi yêu cầu kết bạn') {
        Alert.alert('Thành công', 'Yêu cầu kết bạn đã được gửi!');
  
        // Cập nhật trạng thái người dùng và danh sách yêu cầu đã gửi
        setUserStatuses((prev) => {
          const newStatuses = { ...prev, [targetUserId]: 'pending' };
          console.log('Updated userStatuses:', newStatuses);
          return newStatuses;
        });
        setSentRequestIds((prev) => {
          const newSentRequestIds = { ...prev, [targetUserId]: response.data.requestId };
          console.log('Updated sentRequestIds:', newSentRequestIds);
          return newSentRequestIds;
        });
  
        await fetchSentRequests(auth.token);
      } else {
        throw new Error(response.data.message || 'Không thể gửi yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi gửi yêu cầu kết bạn:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.message || 'Không thể gửi yêu cầu kết bạn do lỗi hệ thống. Vui lòng thử lại sau.'
        );
      } else {
        Alert.alert(
          'Lỗi',
          error.response?.data?.message || error.message || 'Có lỗi xảy ra khi gửi yêu cầu kết bạn. Vui lòng thử lại.'
        );
      }
    }
  };

  const cancelFriendRequestHandler = async (requestId, targetUserId) => {
    try {
      if (!auth.token) throw new Error('Không tìm thấy token xác thực.');
      if (!requestId || typeof requestId !== 'string') {
        throw new Error('ID yêu cầu không hợp lệ.');
      }
      const response = await cancelFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã hủy yêu cầu kết bạn!');
        setUserStatuses((prev) => ({ ...prev, [targetUserId]: 'none' }));
        setSentRequestIds((prev) => {
          const newSentRequestIds = { ...prev };
          delete newSentRequestIds[targetUserId];
          return newSentRequestIds;
        });
        await fetchSentRequests(auth.token);
      } else {
        throw new Error(response.data.message || 'Không thể hủy yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi hủy yêu cầu kết bạn:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Yêu cầu kết bạn không tồn tại. Đang làm mới danh sách...');
        setUserStatuses((prev) => ({ ...prev, [targetUserId]: 'none' }));
        setSentRequestIds((prev) => {
          const newSentRequestIds = { ...prev };
          delete newSentRequestIds[targetUserId];
          return newSentRequestIds;
        });
        await fetchSentRequests(auth.token);
      } else if (error.response?.status === 500) {
        Alert.alert(
          'Lỗi',
          error.response?.data?.message || 'Không thể hủy yêu cầu kết bạn do lỗi hệ thống. Vui lòng liên hệ quản trị viên hoặc thử lại sau.'
        );
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra khi hủy yêu cầu kết bạn.');
      }
    }
  };

  const acceptFriendRequestHandler = async (requestId) => {
    try {
      if (!auth.token) throw new Error('Không tìm thấy token xác thực.');
      if (!requestId) throw new Error('ID yêu cầu không hợp lệ.');
      const response = await acceptFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã chấp nhận yêu cầu kết bạn!');
        setReceivedRequests((prev) => prev.filter((req) => req._id !== requestId));
        await fetchFriends(auth.token);
        await fetchReceivedRequests(auth.token); // Làm mới danh sách yêu cầu
      } else {
        throw new Error(response.data.message || 'Không thể chấp nhận yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi chấp nhận yêu cầu kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Yêu cầu kết bạn không tồn tại. Đang làm mới danh sách...');
        await fetchReceivedRequests(auth.token); // Làm mới danh sách yêu cầu
      } else if (error.response?.status === 400) {
        Alert.alert('Lỗi', error.response?.data?.message || 'Yêu cầu kết bạn không hợp lệ.');
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra khi chấp nhận yêu cầu kết bạn.');
      }
    }
  };

  const rejectFriendRequestHandler = async (requestId) => {
    try {
      if (!auth.token) throw new Error('Không tìm thấy token xác thực.');
      if (!requestId) throw new Error('ID yêu cầu không hợp lệ.');
      const response = await rejectFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã từ chối yêu cầu kết bạn!');
        setReceivedRequests((prev) => prev.filter((req) => req._id !== requestId));
        await fetchReceivedRequests(auth.token); // Làm mới danh sách yêu cầu
      } else {
        throw new Error(response.data.message || 'Không thể từ chối yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi từ chối yêu cầu kết bạn:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Lỗi', 'Yêu cầu kết bạn không tồn tại. Đang làm mới danh sách...');
        await fetchReceivedRequests(auth.token); // Làm mới danh sách yêu cầu
      } else {
        Alert.alert('Lỗi', error.response?.data?.message || 'Có lỗi xảy ra khi từ chối yêu cầu kết bạn.');
      }
    }
  };

  const handleSelectUser = async (user) => {
    try {
      if (!auth.userId) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
        navigation.navigate('Login');
        return;
      }
      const chat = {
        id: user.userId,
        name: user.name,
        phoneNumber: user.phoneNumber,
        avatar: user.avatar || 'https://via.placeholder.com/50',
        targetUserId: user.userId,
      };
      const updatedSearches = [
        { userId: user.userId, name: user.name, phoneNumber: user.phoneNumber, avatar: user.avatar },
        ...recentSearches.filter((s) => s.userId !== user.userId),
      ].slice(0, 5);
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      navigation.navigate('Chat', {
        userId: auth.userId,
        token: auth.token,
        receiverId: chat.targetUserId,
        receiverName: chat.name,
      });
    } catch (error) {
      console.error('Lỗi khi chọn người dùng:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const handleSelectChat = (chat) => {
    navigation.navigate('Chat', {
      userId: auth.userId,
      token: auth.token,
      receiverId: chat.targetUserId,
      receiverName: chat.name,
    });
    handleMarkAsRead(chat.id);
  };

  const handleMarkAsRead = async (chatId) => {
    try {
      await markAsRead(chatId, auth.token);
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat.id === chatId ? { ...chat, unread: false, unreadCount: 0 } : chat
        )
      );
    } catch (error) {
      console.error('Lỗi khi đánh dấu đã đọc:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => handleSelectChat(item)}>
      <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
      <View style={styles.chatMeta}>
        <Text style={styles.chatTime}>{item.timestamp ? getRelativeTime(item.timestamp) : ''}</Text>
        {item.pinned && <Text style={styles.pinIcon}>{/*📌*/}</Text>}
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }) => {
    const status = userStatuses[item.userId] || 'none';
    const requestId = sentRequestIds[item.userId];
    const isCurrentUser = item.phoneNumber === auth.phoneNumber;
    const isPending = requestId || status === 'pending';

    return (
      <View style={styles.searchItem}>
        <TouchableOpacity style={styles.searchUserInfo} onPress={() => handleSelectUser(item)}>
          <Image
            source={{ uri: item.avatar || 'https://via.placeholder.com/50' }}
            style={styles.searchAvatar}
          />
          <View>
            <Text style={styles.searchName}>{item.name}</Text>
            <Text style={styles.searchPhone}>{item.phoneNumber}</Text>
          </View>
        </TouchableOpacity>

        {!isCurrentUser && status !== 'friends' && (
          <View style={styles.requestActions}>
            {isPending ? (
              <>
                <View style={[styles.statusButton, styles.pendingButton]}>
                  <Text style={styles.addFriendText}>Đã gửi</Text>
                </View>
                {requestId && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() =>
                      Alert.alert(
                        'Xác nhận',
                        'Bạn có chắc muốn hủy yêu cầu kết bạn này không?',
                        [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Đồng ý', onPress: () => cancelFriendRequestHandler(requestId, item.userId) },
                        ]
                      )
                    }
                  >
                    <Text style={styles.addFriendText}>Hủy</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <TouchableOpacity
                style={styles.addFriendButton}
                onPress={() => sendFriendRequestHandler(item.userId)}
              >
                <Text style={styles.addFriendText}>Thêm bạn</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.friendItem}>
      <Image
        source={{ uri: item.user?.avatar || 'https://via.placeholder.com/50' }}
        style={styles.friendAvatar}
      />
      <View>
        <Text style={styles.friendName}>{item.user?.name || 'Không có tên'}</Text>
        <Text style={styles.friendPhone}>{item.user?.phoneNumber || ''}</Text>
      </View>
    </View>
  );

  const renderRequestItem = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Image
          source={{ uri: item.senderInfo?.avatar || 'https://via.placeholder.com/50' }}
          style={styles.requestAvatar}
        />
        <View>
          <Text style={styles.requestName}>{item.senderInfo?.name || 'Không có tên'}</Text>
          <Text style={styles.requestPhone}>{item.senderInfo?.phoneNumber || ''}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptFriendRequestHandler(item._id)}
        >
          <Text style={styles.addFriendText}>Chấp nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => rejectFriendRequestHandler(item._id)}
        >
          <Text style={styles.addFriendText}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleLogout = async () => {
    try {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra khi đăng xuất. Vui lòng thử lại.');
    }
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loading}>
          <Text>Đang tải...</Text>
        </View>
      )}
      <View style={styles.header}>
        <Image source={{ uri: auth?.avatar || 'https://via.placeholder.com/50' }} style={styles.avatar} />
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'messages' && styles.activeTab]}
            onPress={() => setActiveTab('messages')}
          >
            <Text style={styles.tabText}>Tin nhắn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
            onPress={() => setActiveTab('contacts')}
          >
            <Text style={styles.tabText}>Danh bạ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
            onPress={() => setActiveTab('settings')}
          >
            <Text style={styles.tabText}>Cài đặt</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'messages' && (
        <View style={styles.messagesContainer}>
          <View style={styles.searchContainer}>
            <View style={styles.searchWrapper}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm kiếm"
                value={userSearchQuery}
                onChangeText={handleUserSearch}
                onFocus={() => setIsSearchActive(true)}
                keyboardType="phone-pad"
              />
            </View>
            {isSearchActive && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setIsSearchActive(false);
                  setUserSearchQuery('');
                  setUserSearchResults([]);
                  setUserStatuses({});
                }}
              >
                <Text style={styles.actionText}>Đóng</Text>
              </TouchableOpacity>
            )}
          </View>

          {isSearchActive ? (
            <View style={styles.searchResults}>
              {userSearchResults.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Kết quả tìm kiếm</Text>
                  <FlatList
                    data={userSearchResults}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.userId}
                  />
                </>
              )}
              {recentSearches.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Tìm kiếm gần đây</Text>
                  <FlatList
                    data={recentSearches}
                    renderItem={renderSearchResult}
                    keyExtractor={(item) => item.userId}
                  />
                </>
              )}
            </View>
          ) : (
            <>
              {chats.length > 0 ? (
                <FlatList
                  data={chats}
                  renderItem={renderChatItem}
                  keyExtractor={(item) => item.id}
                  style={styles.chatList}
                />
              ) : (
                <View style={styles.noChats}>
                  <Text>Chưa có cuộc trò chuyện nào.</Text>
                  <Text>Hãy tìm kiếm người dùng để bắt đầu trò chuyện!</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {activeTab === 'contacts' && (
        <View style={styles.contactsContainer}>
          {receivedRequests.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Yêu cầu kết bạn nhận được</Text>
              <FlatList
                data={receivedRequests}
                renderItem={renderRequestItem}
                keyExtractor={(item) => item._id}
                style={styles.requestList}
              />
            </>
          )}
          <Text style={styles.sectionTitle}>Danh sách bạn bè</Text>
          {friends.length > 0 ? (
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.userId}
              style={styles.friendList}
            />
          ) : (
            <Text>Chưa có bạn bè nào.</Text>
          )}
        </View>
      )}

      {activeTab === 'settings' && (
        <View style={styles.settingsContainer}>
          <Text style={styles.sectionTitle}>Cài đặt</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
  header: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#0068ff',
  },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  tabContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tab: { padding: 10 },
  activeTab: { borderBottomWidth: 2, borderColor: '#007bff' },
  tabText: { fontSize: 16, color: '#333' },
  messagesContainer: { flex: 1, paddingHorizontal: 10, paddingTop: 10 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    padding: 8,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  actionButton: {
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 14,
    color: '#fff',
  },
  searchResults: { flex: 1 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  searchItem: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  searchName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchPhone: {
    fontSize: 14,
    color: '#666',
  },
  addFriendButton: {
    backgroundColor: '#007bff',
    padding: 8,
    borderRadius: 5,
  },
  statusButton: { padding: 8, borderRadius: 5, marginRight: 5 },
  pendingButton: { backgroundColor: '#6c757d', padding: 8, borderRadius: 5 },
  cancelButton: { backgroundColor: '#dc3545', padding: 8, borderRadius: 5 },
  addFriendText: {
    color: '#fff',
    fontSize: 14,
  },
  requestActions: { flexDirection: 'row' },
  chatList: { flex: 1 },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
  },
  chatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chatMeta: {
    alignItems: 'flex-end',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  pinIcon: {
    fontSize: 16,
    color: '#007bff',
    marginTop: 5,
  },
  noChats: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactsContainer: {
    flex: 1,
    padding: 10,
  },
  friendList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  friendPhone: {
    fontSize: 14,
    color: '#666',
  },
  requestList: {
    marginBottom: 20,
  },
  requestItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  requestName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  requestPhone: {
    fontSize: 14,
    color: '#666',
  },
  requestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 5,
    marginRight: 5,
  },
  rejectButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 5,
    marginRight: 5,
  },
  settingsContainer: {
    flex: 1,
    padding: 10,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: '#ff4444',
    borderRadius: 5,
    marginTop: 20,
  },
  logoutText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default MessagesScreen;