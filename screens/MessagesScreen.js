import React, { useState, useEffect, useContext, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessageSummary,
  searchFriends,
  getMessages,
} from '../services/api';
import { AuthContext } from '../context/AuthContext';
import CreateGroupModal from './CreateGroupModal';

const getRelativeTime = (timestamp) => {
  // TODO: Implement relative time logic (e.g., "5 phút trước")
  return new Date(timestamp).toLocaleTimeString();
};

const MessagesScreen = () => {
  const [chats, setChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [combinedChats, setCombinedChats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false);
  const navigation = useNavigation();
  const { auth, logout } = useContext(AuthContext);

  const fetchData = useCallback(async () => {
    if (!auth.token || !auth.userId) {
      Alert.alert('Lỗi', 'Vui lòng đăng nhập lại.');
      navigation.navigate('Login');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getMessageSummary(auth.token);
      console.log('API Response:', response.data); // Debug API response
      if (response.data && response.data.success) {
        const conversations = Array.isArray(response.data.data?.conversations)
          ? response.data.data.conversations
          : [];
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
          isGroup: false,
        }));
        setChats(formattedChats);

        const groupData = Array.isArray(response.data.data?.groups)
          ? response.data.data.groups
          : [];
        const formattedGroups = groupData.map((group) => ({
          id: group.groupId,
          name: group.name || 'Nhóm không tên',
          avatar: group.avatar || 'https://via.placeholder.com/50',
          lastMessage: group.lastMessage?.content || 'Chưa có tin nhắn',
          timestamp: group.lastMessage?.createdAt || new Date().toISOString(),
          targetUserId: group.groupId,
          isGroup: true,
          memberCount: group.memberCount || 0,
        }));
        setGroups(formattedGroups);
      } else {
        throw new Error('Không thể lấy danh sách cuộc trò chuyện và nhóm.');
      }
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu:', error);
      if (error.response?.status === 401) {
        Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        await logout();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } else {
        setError(error.message || 'Có lỗi xảy ra khi lấy dữ liệu.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [auth.token, auth.userId, navigation, logout]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    const combined = [...chats, ...groups].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    setCombinedChats(combined);
    console.log('Combined chats:', combined); // Debug combined chats
  }, [chats, groups]);

  const handleUserSearch = async (query) => {
    setUserSearchQuery(query);
    if (!query) {
      setUserSearchResults([]);
      return;
    }

    const phoneRegex = /^(0|\+84)\d{9,11}$/;
    const cleanedQuery = query.replace(/\s/g, '');

    if (!phoneRegex.test(cleanedQuery)) {
      setUserSearchResults([]);
      return;
    }

    try {
      const response = await searchFriends(cleanedQuery, auth.token);
      if (response.data && response.data.success && response.data.data) {
        const users = response.data.data;
        console.log('Raw API response from searchFriends:', users);

        const enrichedUsers = await Promise.all(
          users.map(async (user) => {
            try {
              const messagesResponse = await getMessages(user.userId, auth.token);
              const messages = messagesResponse.data?.messages || [];
              const senderInfo = messages.length > 0 ? messages[0].sender : null;
              return {
                userId: user.userId,
                name: senderInfo?.name || user.name || user.displayName || user.phoneNumber || 'Người dùng',
                phoneNumber: user.phoneNumber || '',
                avatar: senderInfo?.avatar || user.avatar || user.profilePicture || 'https://via.placeholder.com/50',
                isFriend: user.isFriend,
              };
            } catch (error) {
              console.error(`Error fetching messages for user ${user.userId}:`, error);
              return {
                userId: user.userId,
                name: user.name || user.displayName || user.phoneNumber || 'Người dùng',
                phoneNumber: user.phoneNumber || '',
                avatar: user.avatar || user.profilePicture || 'https://via.placeholder.com/50',
                isFriend: user.isFriend,
              };
            }
          })
        );

        console.log('Processed search results:', enrichedUsers);
        setUserSearchResults(enrichedUsers);
      } else {
        setUserSearchResults([]);
        Alert.alert('Thông báo', 'Không tìm thấy người dùng với số điện thoại này.');
      }
    } catch (error) {
      console.error('Lỗi khi tìm kiếm người dùng:', error.response?.data || error.message);
      setUserSearchResults([]);
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
        isGroup: false,
      };
      navigation.navigate('Chat', {
        userId: auth.userId,
        token: auth.token,
        receiverId: chat.targetUserId,
        receiverName: chat.name,
        avatar: chat.avatar,
        isGroup: chat.isGroup,
      });
      setUserSearchQuery('');
      setUserSearchResults([]);
      setIsSearchActive(false);
    } catch (error) {
      console.error('Lỗi khi chọn người dùng:', error);
      Alert.alert('Lỗi', 'Có lỗi xảy ra. Vui lòng thử lại.');
    }
  };

  const handleSelectChat = (chat) => {
    navigation.navigate('Chat', {
      userId: auth.userId,
      token: auth.token,
      receiverId: chat.isGroup ? null : chat.targetUserId,
      receiverName: chat.name,
      avatar: chat.avatar,
      isGroup: chat.isGroup,
      groupId: chat.isGroup ? chat.targetUserId : undefined, // Truyền groupId cho nhóm
    });
  };

  const handleCreateGroup = (newGroup) => {
    Alert.alert('Thành công', `Nhóm ${newGroup.name} đã được tạo!`);
    navigation.navigate('Chat', {
      userId: auth.userId,
      token: auth.token,
      receiverId: null,
      receiverName: newGroup.name,
      avatar: newGroup.avatar || 'https://via.placeholder.com/50',
      isGroup: true,
      groupId: newGroup.groupId,
    });
    fetchData();
  };

  const handleRetry = () => {
    fetchData();
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chatItem, item.unread && styles.unreadChat]}
      onPress={() => handleSelectChat(item)}
    >
      <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
      <View style={styles.chatInfo}>
        <Text style={[styles.chatName, item.unread && styles.unreadText]}>
          {item.name} {item.isGroup ? `(${item.memberCount} thành viên)` : ''}
        </Text>
        <Text
          style={[styles.lastMessage, item.unread && styles.unreadText]}
          numberOfLines={1}
        >
          {item.lastMessage}
        </Text>
      </View>
      <View style={styles.chatMeta}>
        <Text style={styles.chatTime}>
          {item.timestamp ? getRelativeTime(item.timestamp) : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity
      style={styles.searchItem}
      onPress={() => handleSelectUser(item)}
    >
      <Image
        source={{ uri: item.avatar }}
        style={styles.searchAvatar}
        onError={(e) => console.log(`Failed to load avatar for ${item.name}: ${e.nativeEvent.error}`)}
      />
      <View>
        <Text style={styles.searchName}>{item.name}</Text>
        <Text style={styles.searchPhone}>{item.phoneNumber}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tin nhắn</Text>
      </View>

      <View style={styles.messagesContainer}>
        <View style={styles.searchContainer}>
          <View style={styles.searchWrapper}>
            <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm"
              value={userSearchQuery}
              onChangeText={handleUserSearch}
              onFocus={() => setIsSearchActive(true)}
              onBlur={() => {
                if (!userSearchQuery) setIsSearchActive(false);
              }}
              keyboardType="phone-pad"
            />
          </View>
          <TouchableOpacity
            style={styles.groupButton}
            onPress={() => setIsCreateGroupModalVisible(true)}
          >
            <Ionicons name="people" size={24} color="#0068ff" />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : isSearchActive && userSearchResults.length > 0 ? (
          <View style={styles.searchResults}>
            <FlatList
              data={userSearchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.userId}
            />
          </View>
        ) : combinedChats.length > 0 ? (
          <FlatList
            data={combinedChats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
          />
        ) : (
          <View style={styles.noChats}>
            <Text>Chưa có cuộc trò chuyện hoặc nhóm nào.</Text>
            <Text>Hãy tìm kiếm người dùng hoặc tạo nhóm để bắt đầu!</Text>
            <TouchableOpacity
              style={styles.createGroupButton}
              onPress={() => setIsCreateGroupModalVisible(true)}
            >
              <Text style={styles.createGroupText}>Tạo nhóm mới</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

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
  loading: {
    position: 'absolute',
    top: 0,
    left: '0',
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 1,
  },
  header: {
    padding: 15,
    backgroundColor: '#0068ff',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
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
    marginRight: 5,
  },
  searchInput: {
    flex: 1,
    padding: 8,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  groupButton: {
    padding: 10,
    marginLeft: 10,
  },
  searchResults: { flex: 1 },
  searchItem: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  searchName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chatList: { flex: 1 },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    fontWeight: '500',
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
  unreadChat: {},
  unreadText: {
    fontWeight: 'bold',
    color: '#000',
  },
  noChats: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createGroupButton: {
    marginTop: 10,
    backgroundColor: '#0068ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 5,
  },
  createGroupText: {
    color: '#fff',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default MessagesScreen;