import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../services/api'; // Import API_BASE_URL
import { initializeSocket, getSocket, disconnectSocket } from '../services/socket';
import { getMessageSummary, getFriends } from '../services/api';

const GroupDetailsScreen = ({ route, navigation }) => {
  const { groupId, groupName: initialGroupName } = route.params;
  const [isEditGroupNameModalOpen, setIsEditGroupNameModalOpen] = useState(false);
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false);
  const [isKickMemberModalOpen, setIsKickMemberModalOpen] = useState(false);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState(initialGroupName || 'Không có tên');
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    members: false,
    media: true,
    files: true,
    links: true,
    security: true,
    board: true,
  });

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
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {newGroupName || 'Không có tên'}
          </Text>
        </View>
      ),
    });
  }, [navigation, newGroupName]);

  useEffect(() => {
    const getCurrentUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        setCurrentUserId(userId);
      } catch (error) {
        console.error('Lỗi lấy userId:', error.message);
      }
    };
    getCurrentUserId();
  }, []);

  useEffect(() => {
    const setupSocket = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token || token === 'null' || token === 'undefined') {
          throw new Error('Không tìm thấy token hợp lệ');
        }

        await initializeSocket(token);
        const socket = getSocket();
        if (socket) {
          socket.emit('joinGroup', { groupId });

          socket.on('groupNameUpdated', ({ groupId: updatedGroupId, name }) => {
            if (updatedGroupId === groupId) {
              setNewGroupName(name);
              navigation.setParams({ groupName: name });
            }
          });

          socket.on('groupMembersUpdated', ({ groupId: updatedGroupId, members: updatedMembers }) => {
            if (updatedGroupId === groupId) {
              setMembers(updatedMembers || []);
            }
          });

          socket.on('newGroupMessage', ({ groupId: updatedGroupId, message }) => {
            if (updatedGroupId === groupId && message) {
              if (['image', 'video'].includes(message.type)) {
                setMediaFiles((prev) => [
                  {
                    type: message.type,
                    url: message.mediaUrl,
                    fileName: message.fileName,
                    timestamp: message.timestamp,
                  },
                  ...prev,
                ]);
              } else if (['pdf', 'zip', 'file'].includes(message.type)) {
                setFiles((prev) => [
                  {
                    type: message.type,
                    url: message.mediaUrl,
                    fileName: message.fileName,
                    timestamp: message.timestamp,
                  },
                  ...prev,
                ]);
              }
            }
          });

          socket.on('groupChatDeleted', ({ groupId: updatedGroupId }) => {
            if (updatedGroupId === groupId) {
              setMediaFiles([]);
              setFiles([]);
              Alert.alert('Thông báo', 'Lịch sử trò chuyện đã được xóa.');
            }
          });

          socket.on('memberLeft', ({ groupId: updatedGroupId, userId }) => {
            if (updatedGroupId === groupId) {
              setMembers((prev) => prev.filter((member) => member.userId !== userId));
            }
          });

          socket.on('memberAdded', ({ groupId: updatedGroupId, userId, addedBy }) => {
            if (updatedGroupId === groupId) {
              fetchGroupMembers();
              Alert.alert('Thông báo', `Thành viên mới (ID: ${userId}) đã được thêm vào nhóm.`);
            }
          });

          socket.on('memberKicked', ({ groupId: updatedGroupId, targetUserId }) => {
            if (updatedGroupId === groupId) {
              setMembers((prev) => prev.filter((member) => member.userId !== targetUserId));
              Alert.alert('Thông báo', `Thành viên (ID: ${targetUserId}) đã bị đá khỏi nhóm.`);
            }
          });
        }
      } catch (error) {
        console.error('Lỗi thiết lập socket:', error.message);
        Alert.alert('Lỗi', 'Không thể kết nối socket.');
      }
    };

    setupSocket();
    fetchGroupMembers();
    fetchGroupMessages();

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.emit('leaveGroup', { groupId });
        disconnectSocket();
      }
    };
  }, [groupId]);

  const fetchFriends = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }

      const convResponse = await getMessageSummary(token);
      let recentUsers = convResponse.data?.data?.conversations?.map((conv) => ({
        userId: conv.otherUserId,
        name: conv.displayName || 'Không có tên',
        avatar: conv.avatar || 'https://via.placeholder.com/50',
      })) || [];

      const friendsResponse = await getFriends(token);
      const friends = friendsResponse.data?.data?.map((friend) => ({
        userId: friend.userId,
        name: friend.name || friend.userId,
        avatar: friend.avatar || 'https://via.placeholder.com/50',
      })) || [];

      const combinedUsers = [...recentUsers, ...friends];
      const uniqueUsers = Array.from(new Map(combinedUsers.map((u) => [u.userId, u])).values())
        .filter((user) => user.userId !== currentUserId && !members.some((m) => m.userId === user.userId));

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

  const fetchGroupMembers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.get(`${API_BASE_URL}/groups/members/${groupId}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (response.data.success) {
        setMembers(response.data.data.members || []);
      } else {
        console.error('Không thể lấy danh sách thành viên:', response.data.error);
        setMembers([]);
      }
    } catch (error) {
      console.error('Lỗi lấy danh sách thành viên:', error.message);
      Alert.alert('Lỗi', 'Không thể tải danh sách thành viên.');
      setMembers([]);
    }
  };

  const fetchGroupMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.get(`${API_BASE_URL}/groups/messages/${groupId}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (response.data.success) {
        const messages = response.data.data.messages || [];
        messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const media = messages
          .filter((msg) => ['image', 'video'].includes(msg.type))
          .map((msg) => ({
            type: msg.type,
            url: msg.mediaUrl,
            fileName: msg.fileName,
            timestamp: msg.timestamp,
          }));

        const otherFiles = messages
          .filter((msg) => ['pdf', 'zip', 'file'].includes(msg.type))
          .map((msg) => ({
            type: msg.type,
            url: msg.mediaUrl,
            fileName: msg.fileName,
            timestamp: msg.timestamp,
          }));

        setMediaFiles(media);
        setFiles(otherFiles);
      } else {
        setMediaFiles([]);
        setFiles([]);
      }
    } catch (error) {
      console.error('Lỗi lấy tin nhắn nhóm:', error.message);
      Alert.alert('Lỗi', 'Không thể tải phương tiện hoặc tệp.');
      setMediaFiles([]);
      setFiles([]);
    }
  };

  const handleEditGroupName = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.put(
        `${API_BASE_URL}/groups/info/${groupId}`,
        { name: newGroupName },
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Cập nhật tên nhóm thành công!');
        setIsEditGroupNameModalOpen(false);
        navigation.setParams({ groupName: newGroupName });

        const socket = getSocket();
        if (socket) {
          socket.emit('updateGroupName', { groupId, name: newGroupName });
        }
      } else {
        throw new Error(response.data.error || 'Không thể cập nhật tên nhóm.');
      }
    } catch (error) {
      console.error('Lỗi cập nhật tên nhóm:', error.message);
      Alert.alert('Lỗi', `Không thể cập nhật tên nhóm: ${error.message}`);
    }
  };

  const handleDeleteChatHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.delete(`${API_BASE_URL}/groups/messages/${groupId}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã xóa lịch sử trò chuyện!');
        setIsDeleteChatModalOpen(false);
        setMediaFiles([]);
        setFiles([]);

        const socket = getSocket();
        if (socket) {
          socket.emit('deleteGroupChat', { groupId });
        }
      } else {
        throw new Error(response.data.error || 'Không thể xóa lịch sử trò chuyện.');
      }
    } catch (error) {
      console.error('Lỗi xóa lịch sử trò chuyện:', error.message);
      Alert.alert('Lỗi', `Không thể xóa lịch sử trò chuyện: ${error.message}`);
    }
  };

  const handleLeaveGroup = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const userId = await AsyncStorage.getItem('userId');
      const response = await axios.post(
        `${API_BASE_URL}/groups/${groupId}/leave`,
        {},
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã rời nhóm!');
        setIsLeaveGroupModalOpen(false);

        const socket = getSocket();
        if (socket) {
          socket.emit('leaveGroup', { groupId, userId });
        }

        navigation.goBack();
      } else {
        throw new Error(response.data.error || 'Không thể rời nhóm.');
      }
    } catch (error) {
      console.error('Lỗi rời nhóm:', error.message);
      Alert.alert('Lỗi', `Không thể rời nhóm: ${error.message}`);
    }
  };

  const handleKickMember = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.delete(
        `${API_BASE_URL}/groups/members/${groupId}/${selectedMember.userId}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', response.data.message || 'Đã đá thành viên khỏi nhóm!');
        setIsKickMemberModalOpen(false);

        const socket = getSocket();
        if (socket) {
          socket.emit('kickMember', { groupId, targetUserId: selectedMember.userId });
        }

        fetchGroupMembers();
      } else {
        throw new Error(response.data.message || 'Không thể đá thành viên.');
      }
    } catch (error) {
      console.error('Lỗi đá thành viên:', error.message);
      Alert.alert('Lỗi', `Không thể đá thành viên: ${error.message}`);
    }
  };

  const handleAssignRole = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.post(
        `${API_BASE_URL}/groups/assignRole`,
        { groupId, userId: selectedMember.userId, role: selectedRole },
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Cập nhật vai trò thành công!');
        setIsAssignRoleModalOpen(false);

        const socket = getSocket();
        if (socket) {
          socket.emit('assignRole', { groupId, userId: selectedMember.userId, role: selectedRole });
        }

        fetchGroupMembers();
      } else {
        throw new Error(response.data.error || 'Không thể cập nhật vai trò.');
      }
    } catch (error) {
      console.error('Lỗi cập nhật vai trò:', error.message);
      Alert.alert('Lỗi', `Không thể cập nhật vai trò: ${error.message}`);
    }
  };

  const handleAddMember = async () => {
    if (!selectedFriend) {
      Alert.alert('Lỗi', 'Vui lòng chọn một bạn bè để thêm.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }

      const response = await axios.post(
        `${API_BASE_URL}/groups/members/${groupId}`,
        { newUserId: selectedFriend.userId },
        { headers: { Authorization: `Bearer ${token.trim()}` } }
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

  const handleViewAllMedia = () => {
    Alert.alert('Thông báo', 'Chức năng xem tất cả sẽ được triển khai sau!');
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.friendItem, selectedFriend?.userId === item.userId && styles.friendItemSelected]}
      onPress={() => setSelectedFriend(item)}
    >
      <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
      <Text style={styles.friendName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderMemberItem = ({ item }) => {
    const isAdmin = members.find(
      (member) => member.userId === currentUserId && member.role === 'admin'
    );

    return (
      <View style={styles.memberItem}>
        <Image
          source={item.avatar ? { uri: item.avatar } : { uri: 'https://picsum.photos/40' }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberInfo}>
          <View style={styles.memberDetails}>
            <Text style={styles.memberName}>
              {item.userId === currentUserId ? 'Bạn' : item.name || 'Không có tên'}
            </Text>
            {item.role === 'admin' && <Text style={styles.adminLabel}>Trưởng nhóm</Text>}
          </View>
          {isAdmin && item.userId !== currentUserId && item.role !== 'admin' && (
            <View style={styles.memberActions}>
              <TouchableOpacity
                style={styles.kickButton}
                onPress={() => {
                  setSelectedMember(item);
                  setIsKickMemberModalOpen(true);
                }}
              >
                <Text style={styles.kickButtonText}>Đá</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedMember(item);
                  setIsAssignRoleModalOpen(true);
                }}
              >
                <Text style={styles.actionText}>Gán vai trò</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const recentMediaFiles = mediaFiles.slice(0, 6);

  const data = [
    { type: 'header', key: 'header' },
    { type: 'members', key: 'members' },
    { type: 'media', key: 'media' },
    { type: 'files', key: 'files' },
    { type: 'deleteChat', key: 'deleteChat' },
    { type: 'leaveGroup', key: 'leaveGroup' },
  ];

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={styles.headerSection}>
            <Text style={styles.groupName}>{newGroupName}</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditGroupNameModalOpen(true)}
            >
              <Ionicons name="pencil" size={20} color="#0068ff" />
            </TouchableOpacity>
          </View>
        );
      case 'members':
        return (
          <View style={styles.section}>
            <TouchableOpacity onPress={() => toggleSection('members')} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thành viên nhóm</Text>
              <Ionicons
                name={expandedSections.members ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#5a6981"
              />
            </TouchableOpacity>
            {expandedSections.members && (
              <View style={styles.sectionContent}>
                <TouchableOpacity
                  style={styles.addMemberButton}
                  onPress={() => {
                    fetchFriends();
                    setIsAddMemberModalOpen(true);
                  }}
                >
                  <Text style={styles.addMemberButtonText}>Thêm thành viên</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleSection('members')}>
                  <Text style={styles.sectionText}>{members.length} thành viên</Text>
                </TouchableOpacity>
                <FlatList
                  data={members}
                  renderItem={renderMemberItem}
                  keyExtractor={(item) => item.userId}
                  contentContainerStyle={styles.membersList}
                  ListEmptyComponent={<Text style={styles.emptyText}>Không có thành viên nào.</Text>}
                  scrollEnabled={false}
                />
              </View>
            )}
          </View>
        );
      case 'media':
        return (
          <View style={styles.section}>
            <TouchableOpacity onPress={() => toggleSection('media')} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ảnh/Video</Text>
              <Ionicons
                name={expandedSections.media ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#5a6981"
              />
            </TouchableOpacity>
            {expandedSections.media && (
              <View style={styles.sectionContent}>
                {recentMediaFiles.length > 0 ? (
                  <>
                    <View style={styles.mediaGrid}>
                      {recentMediaFiles.map((media, index) => (
                        <Image
                          key={index}
                          source={{ uri: media.url }}
                          style={styles.mediaItem}
                          resizeMode="cover"
                        />
                      ))}
                    </View>
                    {mediaFiles.length > 6 && (
                      <TouchableOpacity style={styles.viewAllButton} onPress={handleViewAllMedia}>
                        <Text style={styles.viewAllButtonText}>Xem tất cả</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyText}>Chưa có Ảnh/Video được chia sẻ</Text>
                )}
              </View>
            )}
          </View>
        );
      case 'files':
        return (
          <View style={styles.section}>
            <TouchableOpacity onPress={() => toggleSection('files')} style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>File</Text>
              <Ionicons
                name={expandedSections.files ? 'chevron-down' : 'chevron-forward'}
                size={20}
                color="#5a6981"
              />
            </TouchableOpacity>
            {expandedSections.files && (
              <View style={styles.sectionContent}>
                {files.length > 0 ? (
                  <FlatList
                    data={files}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.fileItem}>
                        <Text style={styles.fileName}>{item.fileName}</Text>
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item, index) => `${item.url}-${index}`}
                    scrollEnabled={false}
                  />
                ) : (
                  <Text style={styles.emptyText}>Chưa có File được chia sẻ</Text>
                )}
              </View>
            )}
          </View>
        );
      case 'deleteChat':
        return (
          <View style={styles.section}>
            <TouchableOpacity onPress={() => setIsDeleteChatModalOpen(true)} style={styles.dangerSection}>
              <Text style={styles.dangerText}>Xóa lịch sử trò chuyện</Text>
            </TouchableOpacity>
          </View>
        );
      case 'leaveGroup':
        return (
          <View style={styles.section}>
            <TouchableOpacity onPress={() => setIsLeaveGroupModalOpen(true)} style={styles.dangerSection}>
              <Text style={styles.dangerText}>Rời nhóm</Text>
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.contentContainer}
      />

      <Modal
        visible={isEditGroupNameModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditGroupNameModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsEditGroupNameModalOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đổi tên nhóm</Text>
            <TextInput
              style={styles.input}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="Nhập tên nhóm mới"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsEditGroupNameModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleEditGroupName}>
                <Text style={styles.modalButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={isDeleteChatModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDeleteChatModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsDeleteChatModalOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Xóa lịch sử trò chuyện</Text>
            <Text style={styles.modalText}>
              Toàn bộ nội dung trò chuyện sẽ bị xóa vĩnh viễn. Bạn có chắc chắn muốn xóa?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsDeleteChatModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonDanger} onPress={handleDeleteChatHistory}>
                <Text style={styles.modalButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={isLeaveGroupModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLeaveGroupModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsLeaveGroupModalOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rời nhóm</Text>
            <Text style={styles.modalText}>
              Bạn sẽ không thể xem lại tin nhắn trong nhóm này sau khi rời nhóm.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsLeaveGroupModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonDanger} onPress={handleLeaveGroup}>
                <Text style={styles.modalButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={isKickMemberModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsKickMemberModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsKickMemberModalOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Đá thành viên</Text>
            <Text style={styles.modalText}>
              Bạn có chắc chắn muốn đá {selectedMember?.name || 'thành viên'} khỏi nhóm?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsKickMemberModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonDanger} onPress={handleKickMember}>
                <Text style={styles.modalButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={isAssignRoleModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAssignRoleModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsAssignRoleModalOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Gán vai trò cho {selectedMember?.name || 'thành viên'}</Text>
            <View style={styles.roleSelect}>
              {['member', 'co-admin', 'admin'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleOption, selectedRole === role && styles.roleOptionSelected]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text style={styles.roleOptionText}>
                    {role === 'member' ? 'Thành viên' : role === 'co-admin' ? 'Phó nhóm' : 'Trưởng nhóm'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsAssignRoleModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleAssignRole}>
                <Text style={styles.modalButtonText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

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
                  scrollEnabled={false}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 15,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  editButton: {
    padding: 10,
  },
  section: {
    marginBottom: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  sectionContent: {
    marginTop: 10,
  },
  sectionText: {
    fontSize: 16,
    color: '#555',
  },
  addMemberButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 15,
  },
  addMemberButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  membersList: {
    paddingBottom: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  memberInfo: {
    flex: 1,
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  adminLabel: {
    fontSize: 12,
    color: '#0068ff',
    marginLeft: 10,
  },
  memberActions: {
    flexDirection: 'row',
    marginTop: 5,
  },
  kickButton: {
    backgroundColor: '#ff3b30',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  kickButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    marginRight: 15,
  },
  actionText: {
    fontSize: 14,
    color: '#0068ff',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mediaItem: {
    width: '30%',
    height: 100,
    borderRadius: 10,
    marginBottom: 10,
  },
  viewAllButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  viewAllButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  fileItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileName: {
    fontSize: 16,
    color: '#0068ff',
  },
  dangerSection: {
    padding: 10,
  },
  dangerText: {
    fontSize: 16,
    color: '#ff3b30',
    fontWeight: '600',
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
    width: '85%',
    maxHeight: '80%',
    padding: 16,
    elevation: 5,
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
  modalText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
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
  modalButtonDanger: {
    backgroundColor: '#ff3b30',
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
  roleSelect: {
    marginBottom: 20,
  },
  roleOption: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    marginBottom: 10,
  },
  roleOptionSelected: {
    backgroundColor: '#e1f0ff',
    borderColor: '#0068ff',
  },
  roleOptionText: {
    fontSize: 16,
    color: '#000',
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
});

export default GroupDetailsScreen;