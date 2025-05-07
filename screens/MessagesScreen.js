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
import { Ionicons } from '@expo/vector-icons'; // Thêm Ionicons để sử dụng biểu tượng
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessageSummary,
  searchFriends,
  getMessages,
} from '../services/api';
import { AuthContext } from '../context/AuthContext';
import CreateGroupModal from './CreateGroupModal';

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
  const [chats, setChats] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateGroupModalVisible, setIsCreateGroupModalVisible] = useState(false);
  const navigation = useNavigation();
  const { auth, logout } = useContext(AuthContext);

  useFocusEffect(
    React.useCallback(() => {
      const initialize = async () => {
        setIsLoading(true);
        try {
          if (auth.token && auth.userId) {
            await fetchChats(auth.token);
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
      };
      navigation.navigate('Chat', {
        userId: auth.userId,
        token: auth.token,
        receiverId: chat.targetUserId,
        receiverName: chat.name,
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
      receiverId: chat.targetUserId,
      receiverName: chat.name,
    });
  };

  const handleCreateGroup = (newGroup) => {
    Alert.alert('Thành công', `Nhóm ${newGroup.name} đã được tạo!`);
    navigation.navigate('Chat', {
      userId: auth.userId,
      token: auth.token,
      receiverId: newGroup.groupId,
      receiverName: newGroup.name,
      isGroup: true,
    });
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.chatItem, item.unread && styles.unreadChat]}
      onPress={() => handleSelectChat(item)}
    >
      <Image source={{ uri: item.avatar }} style={styles.chatAvatar} />
      <View style={styles.chatInfo}>
        <Text style={[styles.chatName, item.unread && styles.unreadText]}>
          {item.name}
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
      {/* {isLoading && (
        <View style={styles.loading}>
          <Text>Đang tải...</Text>
        </View>
      )} */}
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

        {isSearchActive && userSearchResults.length > 0 ? (
          <View style={styles.searchResults}>
            <FlatList
              data={userSearchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.userId}
            />
          </View>
        ) : (
          chats.length > 0 ? (
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
          )
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
});

export default MessagesScreen;