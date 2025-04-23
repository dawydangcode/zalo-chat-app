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
import { useNavigation } from '@react-navigation/native';
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
} from '../services/api';
import { AuthContext } from '../context/AuthContext';

import CreateGroupModal from './CreateGroupModal'; // Import modal

const MessagesScreen = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const [chats, setChats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [filter, setFilter] = useState('all');
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
  const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false); // Trạng thái cho modal
  const navigation = useNavigation();
  const { auth, logout } = useContext(AuthContext);

  useEffect(() => {
    const initialize = async () => {
      try {
        const savedSearches = await AsyncStorage.getItem('recentSearches');
        if (savedSearches) {
          setRecentSearches(JSON.parse(savedSearches));
        }
        if (auth.token && auth.userId) {
          fetchChats(auth.token);
          fetchFriends(auth.token);
          fetchReceivedRequests(auth.token);
        } else {
          Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
          navigation.navigate('Login');
        }
      } catch (error) {
        console.error('Lỗi khởi tạo:', error);
        Alert.alert('Lỗi', 'Không thể khởi tạo dữ liệu.');
      }
    };
    initialize();
  }, [auth.token, auth.userId]);

  const fetchChats = async (authToken) => {
    try {
      const response = await getMessageSummary(authToken);
      if (response.data && response.data.success) {
        const conversations = response.data.data?.conversations || [];
        const formattedChats = conversations.map((conv) => ({
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
      const response = await getFriends(authToken);
      if (response.data && response.data.success) {
        setFriends(response.data.data || []);
      } else {
        Alert.alert('Lỗi', 'Không thể lấy danh sách bạn bè.');
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
      }
    }
  };

  const fetchReceivedRequests = async (authToken) => {
    try {
      const response = await getReceivedFriendRequests(authToken);
      if (response.data && response.data.success) {
        setReceivedRequests(response.data.data || []);
      } else {
        Alert.alert('Lỗi', 'Không thể lấy danh sách yêu cầu kết bạn.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách yêu cầu kết bạn:', error);
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
      console.log('Phản hồi từ API searchFriends:', response.data);
      if (response.data && response.data.userId) {
        const user = response.data;
        console.log('Người dùng tìm thấy:', user);
        setUserSearchResults([user]);
        const statusResponse = await getUserStatus(user.userId, auth.token);
        setUserStatuses({ [user.userId]: statusResponse.data.status });
      } else if (response.data?.success && Array.isArray(response.data.data)) {
        const results = response.data.data;
        if (results.length === 0) {
          setUserSearchResults([]);
          Alert.alert('Thông báo', 'Không tìm thấy người dùng với số điện thoại này.');
        } else {
          setUserSearchResults(results);
          const statuses = {};
          for (const user of results) {
            console.log('Người dùng tìm thấy:', user);
            const statusResponse = await getUserStatus(user.userId, auth.token);
            statuses[user.userId] = statusResponse.data.status;
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
      console.log('Gửi yêu cầu kết bạn với targetUserId:', targetUserId);
      const response = await sendFriendRequest(targetUserId, auth.token);
      console.log('Phản hồi từ API sendFriendRequest:', response.data);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Yêu cầu kết bạn đã được gửi!');
        setUserStatuses((prev) => ({ ...prev, [targetUserId]: 'pending' }));
      } else {
        throw new Error(response.data.error || 'Không thể gửi yêu cầu kết bạn.');
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
          error.response?.data?.error || 'Không thể gửi yêu cầu kết bạn do lỗi hệ thống. Vui lòng thử lại sau.'
        );
      } else {
        Alert.alert(
          'Lỗi',
          error.message || 'Có lỗi xảy ra khi gửi yêu cầu kết bạn. Vui lòng thử lại.'
        );
      }
    }
  };

  const acceptFriendRequestHandler = async (requestId) => {
    try {
      const response = await acceptFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã chấp nhận yêu cầu kết bạn!');
        setReceivedRequests((prev) => prev.filter((req) => req._id !== requestId));
        fetchFriends(auth.token);
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
      } else {
        Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra khi chấp nhận yêu cầu kết bạn.');
      }
    }
  };

  const rejectFriendRequestHandler = async (requestId) => {
    try {
      const response = await rejectFriendRequest(requestId, auth.token);
      if (response.data && response.data.success) {
        Alert.alert('Thành công', 'Đã từ chối yêu cầu kết bạn!');
        setReceivedRequests((prev) => prev.filter((req) => req._id !== requestId));
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
      } else {
        Alert.alert('Lỗi', error.message || 'Có lỗi xảy ra khi từ chối yêu cầu kết bạn.');
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

  const handleCreateGroup = (newGroup) => {
    Alert.alert('Thành công', `Nhóm ${newGroup.name} đã được tạo!`);
    navigation.navigate('Chat', {
      userId: auth.userId,
      token: auth.token,
      receiverId: newGroup.groupId, // Giả sử groupId được dùng cho nhóm
      receiverName: newGroup.name,
      isGroup: true, // Cờ để chỉ định trò chuyện nhóm
    });
  };

  const displayedChats = () => {
    if (filter === 'unread') {
      return chats.filter((chat) => chat.unread);
    } else if (filter === 'categorized') {
      return chats.filter((chat) => chat.category);
    }
    return chats;
  };

  const handleLogout = async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chatItem, item.unread && styles.unreadChat]}
      onPress={() => handleSelectChat(item)}
    >
      <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <Text style={styles.lastMessage}>{item.lastMessage}</Text>
      </View>
      <View style={styles.chatMeta}>
        <Text style={styles.chatTime}>
          {item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''}
        </Text>
        {item.unread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unreadCount || 1}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }) => {
    const status = userStatuses[item.userId] || 'none';
    let buttonText = 'Thêm bạn';
    let buttonStyle = styles.addFriendButton;
    let onPress = () => sendFriendRequestHandler(item.userId);

    if (status === 'friends') {
      buttonText = 'Bạn bè';
      buttonStyle = styles.friendButton;
      onPress = () => Alert.alert('Thông báo', 'Các bạn đã là bạn bè!');
    } else if (status === 'pending') {
      buttonText = 'Đã gửi';
      buttonStyle = styles.pendingButton;
      onPress = () => Alert.alert('Thông báo', 'Yêu cầu kết bạn đã được gửi!');
    }

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
        <TouchableOpacity style={buttonStyle} onPress={onPress}>
          <Text style={styles.addFriendText}>{buttonText}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() =>
        navigation.navigate('Chat', {
          userId: auth.userId,
          token: auth.token,
          receiverId: item.userId,
          receiverName: item.name,
        })
      }
    >
      <Image source={{ uri: item.avatar || 'https://via.placeholder.com/50' }} style={styles.friendAvatar} />
      <View>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendPhone}>{item.phoneNumber}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderRequestItem = ({ item }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Image
          source={{ uri: item.sender?.avatar || 'https://via.placeholder.com/50' }}
          style={styles.requestAvatar}
        />
        <View>
          <Text style={styles.requestName}>{item.sender?.name || 'Không có tên'}</Text>
          <Text style={styles.requestPhone}>{item.sender?.phoneNumber || ''}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptFriendRequestHandler(item._id)}
        >
          <Text style={styles.actionText}>Chấp nhận</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => rejectFriendRequestHandler(item._id)}
        >
          <Text style={styles.actionText}>Từ chối</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: auth?.avatar || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
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
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm người dùng..."
              value={userSearchQuery}
              onChangeText={handleUserSearch}
              onFocus={() => setIsSearchActive(true)}
              keyboardType="phone-pad"
            />
            {isSearchActive ? (
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
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setIsSearchActive(true)}
                >
                  <Text style={styles.actionText}>➕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setIsCreateGroupModalVisible(true)} // Mở modal
                >
                  <Text style={styles.actionText}>👥</Text>
                </TouchableOpacity>
              </>
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
              <View style={styles.filterContainer}>
                <TouchableOpacity
                  style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
                  onPress={() => setFilter('all')}
                >
                  <Text>Tất cả 🗂</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filter === 'unread' && styles.activeFilter]}
                  onPress={() => setFilter('unread')}
                >
                  <Text>Chưa đọc 📩</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterButton, filter === 'categorized' && styles.activeFilter]}
                  onPress={() => setFilter('categorized')}
                >
                  <Text>Phân loại 🏷</Text>
                </TouchableOpacity>
              </View>
              {displayedChats().length > 0 ? (
                <FlatList
                  data={displayedChats()}
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
              <Text style={styles.sectionTitle}>Yêu cầu kết bạn</Text>
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

      <CreateGroupModal
        isVisible={isCreateGroupModalVisible}
        onClose={() => setIsCreateGroupModalVisible(false)}
        onGroupCreated={handleCreateGroup}
        auth={auth}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#ddd' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  tabContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  tab: { padding: 10 },
  activeTab: { borderBottomWidth: 2, borderColor: '#007bff' },
  tabText: { fontSize: 16, color: '#333' },
  messagesContainer: { flex: 1, padding: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    marginRight: 10,
  },
  actionButton: { padding: 10 },
  actionText: { fontSize: 18, color: '#007bff' },
  searchResults: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  searchItem: { 
    flexDirection: 'row', 
    padding: 10, 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  searchUserInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  searchAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  searchName: { fontSize: 16, fontWeight: 'bold' },
  searchPhone: { fontSize: 14, color: '#666' },
  addFriendButton: { 
    backgroundColor: '#007bff', 
    padding: 8, 
    borderRadius: 5 
  },
  friendButton: {
    backgroundColor: '#28a745',
    padding: 8,
    borderRadius: 5,
  },
  pendingButton: {
    backgroundColor: '#6c757d',
    padding: 8,
    borderRadius: 5,
  },
  addFriendText: { color: '#fff', fontSize: 14 },
  filterContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  filterButton: { padding: 10 },
  activeFilter: { backgroundColor: '#e0e0e0', borderRadius: 5 },
  chatList: { flex: 1 },
  chatItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  unreadChat: { backgroundColor: '#f0f8ff' },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10 },
  chatInfo: { flex: 1 },
  chatName: { fontSize: 16, fontWeight: 'bold' },
  lastMessage: { fontSize: 14, color: '#666' }, // Đã sửa
  chatMeta: { alignItems: 'flex-end' },
  chatTime: { fontSize: 12, color: '#999' },
  unreadBadge: {
    backgroundColor: '#ff4500',
    borderRadius: 10,
    padding: 5,
    marginTop: 5,
  },
  unreadCount: { color: '#fff', fontSize: 12 },
  noChats: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  contactsContainer: { flex: 1, padding: 10 },
  friendList: { flex: 1 },
  friendItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  friendName: { fontSize: 16, fontWeight: 'bold' },
  friendPhone: { fontSize: 14, color: '#666' },
  requestList: { marginBottom: 20 },
  requestItem: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  requestAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  requestName: { fontSize: 16, fontWeight: 'bold' },
  requestPhone: { fontSize: 14, color: '#666' },
  requestActions: { flexDirection: 'row' },
  acceptButton: { backgroundColor: '#28a745', padding: 8, borderRadius: 5, marginRight: 5 },
  rejectButton: { backgroundColor: '#dc3545', padding: 8, borderRadius: 5 },
  settingsContainer: { flex: 1, padding: 10 },
  logoutButton: { padding: 10, backgroundColor: '#ff4444', borderRadius: 5, marginTop: 20 },
  logoutText: { color: '#fff', textAlign: 'center', fontSize: 16 },
});

export default MessagesScreen;