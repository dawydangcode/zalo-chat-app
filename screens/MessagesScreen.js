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
import { initializeSocket, getSocket } from '../services/socket';

// Hàm hiển thị thời gian tương đối
const getRelativeTime = (timestamp) => {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now - messageTime) / 1000);

  if (isNaN(messageTime.getTime())) {
    return '';
  }

  if (diffInSeconds < 60) {
    return `${diffInSeconds} giây trước`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} phút trước`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} giờ trước`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ngày trước`;
  } else {
    return messageTime.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
};

// Hàm lưu thời gian tin nhắn gần nhất vào AsyncStorage
const saveChatTimestamps = async (chats, groups) => {
  try {
    const timestamps = {};
    chats.forEach((chat) => {
      if (chat.timestamp && !isNaN(new Date(chat.timestamp).getTime())) {
        timestamps[`chat_${chat.id}`] = chat.timestamp;
      }
    });
    groups.forEach((group) => {
      if (group.timestamp && !isNaN(new Date(group.timestamp).getTime())) {
        timestamps[`group_${group.id}`] = group.timestamp;
      }
    });
    await AsyncStorage.setItem('chat_timestamps', JSON.stringify(timestamps));
    console.log('Đã lưu timestamps:', timestamps);
  } catch (error) {
    console.error('Lỗi lưu thời gian tin nhắn:', error);
  }
};

// Hàm đọc thời gian tin nhắn từ AsyncStorage
const loadChatTimestamps = async () => {
  try {
    const timestampsString = await AsyncStorage.getItem('chat_timestamps');
    const timestamps = timestampsString ? JSON.parse(timestampsString) : {};
    console.log('Đã tải timestamps:', timestamps);
    return timestamps;
  } catch (error) {
    console.error('Lỗi tải thời gian tin nhắn:', error);
    return {};
  }
};

const MessagesScreen = () => {
  const [chats, setChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [combinedChats, setCombinedChats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
      // Tải thời gian từ AsyncStorage
      const cachedTimestamps = await loadChatTimestamps();

      const response = await getMessageSummary(auth.token);
      console.log('API Response:', response.data);
      if (response.data && response.data.success) {
        const conversations = Array.isArray(response.data.data?.conversations)
          ? response.data.data.conversations
          : [];
        const formattedChats = conversations.map((conv) => {
          const timestamp =
            conv.lastMessage?.createdAt ||
            cachedTimestamps[`chat_${conv.otherUserId}`] ||
            new Date().toISOString();
          return {
            id: conv.otherUserId,
            name: conv.displayName || 'Không có tên',
            phoneNumber: conv.phoneNumber || '',
            avatar: conv.avatar || 'https://via.placeholder.com/50',
            lastMessage:
              conv.lastMessage?.status === 'recalled'
                ? '(Tin nhắn đã thu hồi)'
                : conv.lastMessage?.content || 'Chưa có tin nhắn',
            timestamp,
            unread: conv.unreadCount > 0,
            unreadCount: conv.unreadCount || 0,
            targetUserId: conv.otherUserId,
            isGroup: false,
          };
        });
        setChats(formattedChats);

        const groupData = Array.isArray(response.data.data?.groups)
          ? response.data.data.groups
          : [];
        const formattedGroups = groupData.map((group) => {
          const timestamp =
            group.lastMessage?.createdAt ||
            cachedTimestamps[`group_${group.groupId}`] ||
            new Date().toISOString();
          return {
            id: group.groupId,
            name: group.name || 'Nhóm không tên',
            avatar: group.avatar || 'https://via.placeholder.com/50',
            lastMessage: group.lastMessage?.content || 'Chưa có tin nhắn',
            timestamp,
            targetUserId: group.groupId,
            isGroup: true,
            memberCount: group.memberCount || 0,
          };
        });
        setGroups(formattedGroups);

        // Lưu thời gian tin nhắn gần nhất vào AsyncStorage
        await saveChatTimestamps(formattedChats, formattedGroups);
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

  useEffect(() => {
    // Khởi tạo socket để nhận tin nhắn mới
    let chatSocket = null;
    let groupSocket = null;

    const initializeSockets = async () => {
      if (auth.token && auth.userId) {
        try {
          chatSocket = await initializeSocket(auth.token, '/chat');
          groupSocket = await initializeSocket(auth.token, '/group');

          chatSocket.on('connect', () => {
            console.log('Socket /chat connected for MessagesScreen');
            chatSocket.emit('joinRoom', { room: `user:${auth.userId}` });
          });

          groupSocket.on('connect', () => {
            console.log('Socket /group connected for MessagesScreen');
          });

          chatSocket.on('receiveMessage', (newMessage) => {
            console.log('Received new message:', newMessage);
            if (newMessage.senderId === auth.userId || newMessage.receiverId === auth.userId) {
              const chatId = newMessage.senderId === auth.userId ? newMessage.receiverId : newMessage.senderId;
              setChats((prevChats) => {
                const updatedChats = prevChats.map((chat) => {
                  if (chat.id === chatId) {
                    return {
                      ...chat,
                      lastMessage: newMessage.content || 'Chưa có tin nhắn',
                      timestamp: newMessage.timestamp || new Date().toISOString(),
                      unread: newMessage.receiverId === auth.userId,
                    };
                  }
                  return chat;
                });
                saveChatTimestamps(updatedChats, groups);
                return updatedChats;
              });
            }
          });

          groupSocket.on('newGroupMessage', (data) => {
            console.log('Received new group message:', data);
            const newMessage = data.message;
            if (newMessage.groupId) {
              setGroups((prevGroups) => {
                const updatedGroups = prevGroups.map((group) => {
                  if (group.id === newMessage.groupId) {
                    return {
                      ...group,
                      lastMessage: newMessage.content || 'Chưa có tin nhắn',
                      timestamp: newMessage.timestamp || new Date().toISOString(),
                      unread: newMessage.senderId !== auth.userId,
                    };
                  }
                  return group;
                });
                saveChatTimestamps(chats, updatedGroups);
                return updatedGroups;
              });
            }
          });
        } catch (error) {
          console.error('Lỗi khởi tạo socket:', error);
        }
      }
    };

    initializeSockets();

    return () => {
      if (chatSocket) {
        chatSocket.off('receiveMessage');
        chatSocket.off('connect');
        chatSocket.disconnect();
      }
      if (groupSocket) {
        groupSocket.off('newGroupMessage');
        groupSocket.off('connect');
        groupSocket.disconnect();
      }
    };
  }, [auth.token, auth.userId, chats, groups]);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    // Sắp xếp các cuộc trò chuyện từ mới nhất đến cũ nhất dựa trên timestamp
    const combined = [...chats, ...groups]
      .filter((chat) => chat.timestamp && !isNaN(new Date(chat.timestamp).getTime()))
      .sort((a, b) => {
        const timeA = new Date(a.timestamp);
        const timeB = new Date(b.timestamp);
        return timeB.getTime() - timeA.getTime();
      });
    setCombinedChats(combined);
    console.log('Combined chats sorted by timestamp:', combined);
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
                name:
                  senderInfo?.name ||
                  user.name ||
                  user.displayName ||
                  user.phoneNumber ||
                  'Người dùng',
                phoneNumber: user.phoneNumber || '',
                avatar:
                  senderInfo?.avatar ||
                  user.avatar ||
                  user.profilePicture ||
                  'https://via.placeholder.com/50',
                isFriend: user.isFriend,
              };
            } catch (error) {
              console.error(`Error fetching messages for user ${user.userId}:`, error);
              return {
                userId: user.userId,
                name:
                  user.name ||
                  user.displayName ||
                  user.phoneNumber ||
                  'Người dùng',
                phoneNumber: user.phoneNumber || '',
                avatar:
                  user.avatar ||
                  user.profilePicture ||
                  'https://via.placeholder.com/50',
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
      groupId: chat.isGroup ? chat.targetUserId : undefined,
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
          {item.timestamp ? getRelativeTime(item.timestamp) : 'Không có tin nhắn'}
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
        onError={(e) =>
          console.log(`Failed to load avatar for ${item.name}: ${e.nativeEvent.error}`)
        }
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
    left: 0,
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