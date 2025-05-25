import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getMessageSummary, getFriends, createGroup, updateGroupInfo } from '../services/api';

const CreateGroupModal = ({ isVisible, onClose, onGroupCreated, auth }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUri, setAvatarUri] = useState(null);

  const currentUserId = auth.userId;
  const token = auth.token;

  useEffect(() => {
    if (isVisible) {
      fetchUsers();
    }
  }, [isVisible]);

  const fetchUsers = async () => {
    try {
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
        .filter((user) => user.userId !== currentUserId);

      setUsers(uniqueUsers);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể lấy danh sách người dùng.');
      console.error('Lỗi khi lấy danh sách người dùng:', error);
      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove(['token', 'user']);
        onClose();
      }
    }
  };

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Quyền bị từ chối', 'Ứng dụng cần quyền truy cập ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      setAvatarFile({
        uri: asset.uri,
        type: 'image/jpeg',
        name: asset.fileName || 'group-avatar.jpg',
      });
      setAvatarUri(asset.uri);
    }
  };

  const handleMemberToggle = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    console.log('→ Bắt đầu tạo nhóm...');

    // Kiểm tra đầu vào
    if (!groupName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên nhóm!');
      return;
    }
    if (groupName.length > 50) {
      Alert.alert('Lỗi', 'Tên nhóm không được dài quá 50 ký tự!');
      return;
    }
    if (selectedMembers.length < 2) {
      Alert.alert('Lỗi', 'Nhóm phải có ít nhất 3 thành viên (bao gồm bạn)!');
      return;
    }

    // Chuẩn bị roles: currentUser là admin
    const initialRoles = selectedMembers.reduce((roles, memberId) => {
      roles[memberId] = 'member';
      return roles;
    }, { [currentUserId]: 'admin' });

    try {
      // Bước 1: Gửi yêu cầu tạo nhóm (chưa có avatar)
      const createResponse = await createGroup(
        {
          name: groupName.trim(),
          members: selectedMembers,
          initialRoles: initialRoles,
        },
        token
      );

      const newGroup = createResponse.data?.data;
      console.log('→ Nhóm đã được tạo:', newGroup);

      // Bước 2: Nếu có avatar thì cập nhật nhóm
      if (avatarFile && newGroup?.groupId) {
        const formData = new FormData();
        formData.append('avatar', {
          uri: avatarFile.uri,
          name: avatarFile.name,
          type: avatarFile.type,
        });
        formData.append('name', groupName.trim());

        await updateGroupInfo(newGroup.groupId, formData, token);

        console.log('→ Avatar đã được cập nhật.');
      }

      // Thành công
      Alert.alert('Thành công', 'Nhóm đã được tạo!');
      if (typeof onGroupCreated === 'function') {
        onGroupCreated(newGroup);
      }
      onClose();
      setGroupName('');
      setSelectedMembers([]);
      setAvatarFile(null);
      setAvatarUri(null);
    } catch (error) {
      console.error('→ Lỗi khi tạo nhóm:', error);
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tạo nhóm!');
      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove(['token', 'user']);
        onClose();
      }
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <TouchableOpacity style={styles.userInfo} onPress={() => handleMemberToggle(item.userId)}>
        <View style={styles.checkbox}>
          {selectedMembers.includes(item.userId) && <Text style={styles.checkmark}>✔</Text>}
        </View>
        <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
        <Text style={styles.userName}>{item.name}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Tạo nhóm</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✖</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <TouchableOpacity style={styles.avatarPicker} onPress={handlePickImage}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarPreview} />
              ) : (
                <Text style={styles.avatarPlaceholder}>Chọn ảnh nhóm</Text>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Nhập tên nhóm..."
              value={groupName}
              onChangeText={setGroupName}
            />
            <TextInput
              style={styles.input}
              placeholder="Tìm kiếm người dùng..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <Text style={styles.sectionTitle}>Danh sách người dùng</Text>
            {filteredUsers.length > 0 ? (
              <FlatList
                data={filteredUsers}
                renderItem={renderUserItem}
                keyExtractor={(item) => item.userId}
                style={styles.userList}
              />
            ) : (
              <Text>Không tìm thấy người dùng.</Text>
            )}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.buttonText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createButton} onPress={handleCreateGroup}>
              <Text style={styles.buttonText}>Tạo nhóm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
  },
  closeButton: {
    fontSize: 20,
    color: '#333',
  },
  modalBody: {
    flexGrow: 1,
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
  userList: {
    maxHeight: 180,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: '#ccc',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginRight: 10,
  },
  createButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
  },
  userItem: {
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 14,
    color: '#007bff',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  userName: {
    fontSize: 14,
  },
  avatarPicker: {
    alignSelf: 'center',
    marginBottom: 10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    color: '#666',
    fontSize: 12,
  },
});

export default CreateGroupModal;