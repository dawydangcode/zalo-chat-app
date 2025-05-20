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
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const GroupDetailsScreen = ({ route, navigation }) => {
  const { groupId, groupName } = route.params;
  const [isEditGroupNameModalOpen, setIsEditGroupNameModalOpen] = useState(false);
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false);
  const [isKickMemberModalOpen, setIsKickMemberModalOpen] = useState(false);
  const [isAssignRoleModalOpen, setIsAssignRoleModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState(groupName || 'Không có tên');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [isMembersPage, setIsMembersPage] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [expandedSections, setExpandedSections] = useState({
    members: true,
    media: true,
    files: true,
    links: true,
    security: true,
    board: true,
  });

  const API_BASE_URL = 'http://192.168.1.3:3000';

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
            {groupName || 'Không có tên'}
          </Text>
        </View>
      ),
    });
  }, [navigation, groupName]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const fetchGroupMembers = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.get(`${API_BASE_URL}/api/groups/members/${groupId}`, {
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
      const response = await axios.get(`${API_BASE_URL}/api/groups/messages/${groupId}`, {
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

  useEffect(() => {
    fetchGroupMembers();
    fetchGroupMessages();
  }, [groupId]);

  const handleEditGroupName = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.put(
        `${API_BASE_URL}/api/groups/info/${groupId}`,
        { name: newGroupName },
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Cập nhật tên nhóm thành công!');
        setIsEditGroupNameModalOpen(false);
        navigation.setParams({ groupName: newGroupName });
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
      const response = await axios.delete(`${API_BASE_URL}/api/groups/messages/${groupId}`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã xóa lịch sử trò chuyện!');
        setIsDeleteChatModalOpen(false);
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
      const response = await axios.post(
        `${API_BASE_URL}/api/groups/${groupId}/leave`,
        {},
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã rời nhóm!');
        setIsLeaveGroupModalOpen(false);
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
        `${API_BASE_URL}/api/groups/members/${groupId}/${selectedMember.userId}`,
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Đã đá thành viên khỏi nhóm!');
        setIsKickMemberModalOpen(false);
        fetchGroupMembers();
      } else {
        throw new Error(response.data.error || 'Không thể đá thành viên.');
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
        `${API_BASE_URL}/api/groups/assignRole`,
        { groupId, userId: selectedMember.userId, role: selectedRole },
        { headers: { Authorization: `Bearer ${token.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', 'Cập nhật vai trò thành công!');
        setIsAssignRoleModalOpen(false);
        fetchGroupMembers();
      } else {
        throw new Error(response.data.error || 'Không thể cập nhật vai trò.');
      }
    } catch (error) {
      console.error('Lỗi cập nhật vai trò:', error.message);
      Alert.alert('Lỗi', `Không thể cập nhật vai trò: ${error.message}`);
    }
  };

  const handleAddMember = () => {
    Alert.alert('Thông báo', 'Chức năng thêm thành viên sẽ được triển khai sau!');
  };

  const handleViewAllMedia = () => {
    Alert.alert('Thông báo', 'Chức năng xem tất cả sẽ được triển khai sau!');
  };

  const renderMemberItem = ({ item }) => {
    const currentUserId = AsyncStorage.getItem('userId');
    const isAdmin = members.find((member) => member.userId === currentUserId && member.role === 'admin');

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
                style={styles.actionButton}
                onPress={() => {
                  setSelectedMember(item);
                  setIsKickMemberModalOpen(true);
                }}
              >
                <Text style={styles.actionText}>Đá khỏi nhóm</Text>
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

  if (isMembersPage) {
    return (
      <View style={styles.container}>
        <View style={styles.membersHeader}>
          <TouchableOpacity onPress={() => setIsMembersPage(false)} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Thông tin nhóm</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>Danh sách thành viên ({members.length})</Text>
          <TouchableOpacity style={styles.addMemberButton} onPress={handleAddMember}>
            <Text style={styles.addMemberButtonText}>Thêm thành viên</Text>
          </TouchableOpacity>
          <FlatList
            data={members}
            renderItem={renderMemberItem}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.membersList}
            ListEmptyComponent={<Text style={styles.emptyText}>Không có thành viên nào.</Text>}
          />
        </View>

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
      </View>
    );
  }

  const recentMediaFiles = mediaFiles.slice(0, 6);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.headerSection}>
        <Text style={styles.groupName}>{groupName}</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditGroupNameModalOpen(true)}
        >
          <Ionicons name="pencil" size={20} color="#0068ff" />
        </TouchableOpacity>
      </View>

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
          <TouchableOpacity
            style={styles.sectionContent}
            onPress={() => setIsMembersPage(true)}
          >
            <Text style={styles.sectionText}>{members.length} thành viên</Text>
          </TouchableOpacity>
        )}
      </View>

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
              />
            ) : (
              <Text style={styles.emptyText}>Chưa có File được chia sẻ</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity onPress={() => setIsDeleteChatModalOpen(true)} style={styles.dangerSection}>
          <Text style={styles.dangerText}>Xóa lịch sử trò chuyện</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity onPress={() => setIsLeaveGroupModalOpen(true)} style={styles.dangerSection}>
          <Text style={styles.dangerText}>Rời nhóm</Text>
        </TouchableOpacity>
      </View>

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
    </ScrollView>
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
  membersHeader: {
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0068ff',
  },
  membersSection: {
    flex: 1,
    padding: 15,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '80%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    backgroundColor: '#0068ff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalButtonDanger: {
    backgroundColor: '#ff3b30',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
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
});

export default GroupDetailsScreen;