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
import { getMessageSummary, markAsRead, searchFriends } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const MessagesScreen = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const [chats, setChats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [filter, setFilter] = useState('all');
  const navigation = useNavigation();
  const { auth, logout } = useContext(AuthContext);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load recent searches
        const savedSearches = await AsyncStorage.getItem('recentSearches');
        if (savedSearches) {
          setRecentSearches(JSON.parse(savedSearches));
        }

        // Fetch chats
        if (auth.token && auth.userId) {
          fetchChats(auth.token);
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

  const handleUserSearch = async (query) => {
    setUserSearchQuery(query);
    if (!query) {
      setUserSearchResults([]);
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(query)) {
      setUserSearchResults([]);
      return;
    }

    try {
      const response = await searchFriends(query, auth.token);
      if (response.data && response.data.userId) {
        setUserSearchResults([response.data]);
      } else if (response.data.success && response.data.data) {
        setUserSearchResults([response.data.data]);
      } else {
        setUserSearchResults([]);
        Alert.alert('Thông báo', 'Không tìm thấy người dùng với số điện thoại này.');
      }
    } catch (error) {
      console.error('Lỗi khi tìm kiếm người dùng:', error);
      setUserSearchResults([]);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else if (error.response?.status === 404) {
        Alert.alert('Thông báo', 'Không tìm thấy người dùng với số điện thoại này.');
      } else {
        Alert.alert('Lỗi', 'Có lỗi xảy ra khi tìm kiếm. Vui lòng thử lại.');
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

      // Update recent searches
      const updatedSearches = [
        { userId: user.userId, name: user.name, phoneNumber: user.phoneNumber, avatar: user.avatar },
        ...recentSearches.filter((s) => s.userId !== user.userId),
      ].slice(0, 5);
      setRecentSearches(updatedSearches);
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updatedSearches));

      // Navigate to ChatScreen
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

    // Mark as read
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

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity style={styles.searchItem} onPress={() => handleSelectUser(item)}>
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/50' }}
        style={styles.searchAvatar}
      />
      <View>
        <Text style={styles.searchName}>{item.name}</Text>
        <Text style={styles.searchPhone}>{item.phoneNumber}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
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
            />
            {isSearchActive ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setIsSearchActive(false);
                  setUserSearchQuery('');
                  setUserSearchResults([]);
                }}
              >
                <Text style={styles.actionText}>Đóng</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Alert.alert('Thông báo', 'Chức năng thêm bạn đang được phát triển!')}
                >
                  <Text style={styles.actionText}>➕</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Alert.alert('Thông báo', 'Chức năng tạo nhóm đang được phát triển!')}
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
          <Text style={styles.sectionTitle}>Danh sách bạn bè</Text>
          <Text>Chưa triển khai danh sách bạn bè.</Text>
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
  searchItem: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  searchAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  searchName: { fontSize: 16, fontWeight: 'bold' },
  searchPhone: { fontSize: 14, color: '#666' },
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
  lastMessage: { fontSize: 14, color: '#666' },
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
  settingsContainer: { flex: 1, padding: 10 },
  logoutButton: { padding: 10, backgroundColor: '#ff4444', borderRadius: 5, marginTop: 20 },
  logoutText: { color: '#fff', textAlign: 'center', fontSize: 16 },
});

export default MessagesScreen;