import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Alert,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ContactDetailsScreen = ({ route, navigation }) => {
  const { userId, name, avatar } = route.params; // userId là ID của người đang chat
  const [mediaFiles, setMediaFiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    media: false,
    files: false,
    links: false,
    security: false,
  });
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [isBlockUserModalOpen, setIsBlockUserModalOpen] = useState(false);

  const API_BASE_URL = 'http://192.168.1.8:3000';
  const cacheKey = `messages_${userId}`;

  // Hàm toggle mở rộng/thu gọn section
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Lấy danh sách tin nhắn để lọc media và file
  const fetchMessages = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      console.log('Gửi yêu cầu với token:', storedToken);
      const response = await axios.get(`${API_BASE_URL}/api/messages/user/${userId}`, {
        headers: { Authorization: `Bearer ${storedToken.trim()}` },
      });
      console.log('Phản hồi lấy tin nhắn:', response.data);
      if (response.data.success) {
        const messages = response.data.messages || [];
        const media = messages
          .filter((msg) => ['image', 'video'].includes(msg.type))
          .map((msg) => ({
            type: msg.type,
            url: msg.mediaUrl,
            fileName: msg.fileName,
          }));
        setMediaFiles(media);
        const otherFiles = messages
          .filter((msg) => ['pdf', 'zip', 'file'].includes(msg.type))
          .map((msg) => ({
            type: msg.type,
            url: msg.mediaUrl,
            fileName: msg.fileName,
          }));
        setFiles(otherFiles);
      }
    } catch (error) {
      console.error('Lỗi lấy tin nhắn:', error.message);
      if (error.response?.status === 401) {
        try {
          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (!refreshToken || refreshToken === 'null' || refreshToken === 'undefined') {
            throw new Error('Không tìm thấy refresh token');
          }
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
          const newToken = response.data.token;
          if (!newToken || typeof newToken !== 'string') {
            throw new Error('Token mới không hợp lệ');
          }
          await AsyncStorage.setItem('token', newToken.trim());
          const retryResponse = await axios.get(`${API_BASE_URL}/api/messages/user/${userId}`, {
            headers: { Authorization: `Bearer ${newToken.trim()}` },
          });
          if (retryResponse.data.success) {
            const messages = retryResponse.data.messages || [];
            const media = messages
              .filter((msg) => ['image', 'video'].includes(msg.type))
              .map((msg) => ({
                type: msg.type,
                url: msg.mediaUrl,
                fileName: msg.fileName,
              }));
            setMediaFiles(media);
            const otherFiles = messages
              .filter((msg) => ['pdf', 'zip', 'file'].includes(msg.type))
              .map((msg) => ({
                type: msg.type,
                url: msg.mediaUrl,
                fileName: msg.fileName,
              }));
            setFiles(otherFiles);
          }
        } catch (refreshError) {
          console.error('Lỗi làm mới token:', refreshError.message);
          Alert.alert('Lỗi', 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      } else {
        setMediaFiles([]);
        setFiles([]);
        Alert.alert('Lỗi', 'Không thể tải media hoặc file: ' + error.message);
      }
    }
  };

  useEffect(() => {
    console.log('ContactDetails route.params:', route.params);
    fetchMessages();
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
        <Text style={styles.headerTitle}>Thông tin liên hệ</Text>
      ),
    });
  }, [navigation]);

  // Xóa lịch sử trò chuyện
  const handleDeleteChatHistory = async () => {
    try {
      await AsyncStorage.removeItem(cacheKey);
      Alert.alert('Thành công', 'Đã xóa lịch sử trò chuyện.');
      setIsDeleteChatModalOpen(false);
      navigation.goBack();
    } catch (error) {
      console.error('Lỗi xóa lịch sử trò chuyện:', error);
      Alert.alert('Lỗi', 'Không thể xóa lịch sử trò chuyện.');
    }
  };

  // Chặn người dùng
  const handleBlockUser = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (!storedToken || storedToken === 'null' || storedToken === 'undefined') {
        throw new Error('Không tìm thấy token hợp lệ');
      }
      const response = await axios.post(
        `${API_BASE_URL}/api/friends/block`,
        { blockedUserId: userId },
        { headers: { Authorization: `Bearer ${storedToken.trim()}` } }
      );
      if (response.data.success) {
        Alert.alert('Thành công', `Đã chặn ${name}.`);
        setIsBlockUserModalOpen(false);
        navigation.goBack();
      } else {
        throw new Error(response.data.message || 'Không thể chặn người dùng.');
      }
    } catch (error) {
      console.error('Lỗi chặn người dùng:', error);
      Alert.alert('Lỗi', error.message || 'Không thể chặn người dùng.');
    }
  };

  // Render item media
  const renderMediaItem = ({ item }) => (
    <View style={styles.mediaItem}>
      {item.type === 'image' ? (
        <Image source={{ uri: item.url }} style={styles.mediaImage} />
      ) : (
        <Video
          source={{ uri: item.url }}
          style={styles.mediaVideo}
          controls
          resizeMode="contain"
        />
      )}
    </View>
  );

  // Render item file
  const renderFileItem = ({ item }) => (
    <TouchableOpacity
      style={styles.fileItem}
      onPress={() => Linking.openURL(item.url).catch((err) => console.error('Lỗi mở URL:', err))}
    >
      <Text style={styles.fileName}>{item.fileName || 'Tệp đính kèm'}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header thông tin liên hệ */}
      <View style={styles.infoHeader}>
        <Image
          source={
            avatar && typeof avatar === 'string'
              ? { uri: avatar }
              : { uri: 'https://picsum.photos/100' }
          }
          style={styles.infoAvatar}
        />
        <Text style={styles.contactName}>
          {typeof name === 'string' && name ? name : 'Không có tên'}
        </Text>
        <Text style={styles.contactPhone}>
          {typeof userId === 'string' && userId ? `+${userId}` : 'Không có số'}
        </Text>
      </View>

      {/* Section: Ảnh/Video */}
      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => toggleSection('media')} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ảnh/Video {expandedSections.media ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {expandedSections.media && (
          <View style={styles.sectionContent}>
            {mediaFiles.length > 0 ? (
              <FlatList
                data={mediaFiles}
                renderItem={renderMediaItem}
                keyExtractor={(item, index) => `media-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.mediaGrid}
              />
            ) : (
              <Text style={styles.emptyText}>Chưa có ảnh/video được chia sẻ</Text>
            )}
          </View>
        )}
      </View>

      {/* Section: File */}
      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => toggleSection('files')} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>File {expandedSections.files ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {expandedSections.files && (
          <View style={styles.sectionContent}>
            {files.length > 0 ? (
              <FlatList
                data={files}
                renderItem={renderFileItem}
                keyExtractor={(item, index) => `file-${index}`}
                style={styles.fileList}
              />
            ) : (
              <Text style={styles.emptyText}>Chưa có file được chia sẻ</Text>
            )}
          </View>
        )}
      </View>

      {/* Section: Link */}
      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => toggleSection('links')} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Link {expandedSections.links ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {expandedSections.links && (
          <View style={styles.sectionContent}>
            <Text style={styles.emptyText}>Sẽ triển khai sau</Text>
          </View>
        )}
      </View>

      {/* Section: Thiết lập bảo mật */}
      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => toggleSection('security')} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Thiết lập bảo mật {expandedSections.security ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {expandedSections.security && (
          <View style={styles.sectionContent}>
            <Text style={styles.emptyText}>Sẽ triển khai sau</Text>
          </View>
        )}
      </View>

      {/* Section: Xóa lịch sử trò chuyện */}
      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => setIsDeleteChatModalOpen(true)}>
          <Text style={styles.dangerText}>Xóa lịch sử trò chuyện</Text>
        </TouchableOpacity>
      </View>

      {/* Section: Chặn người dùng */}
      <View style={styles.infoSection}>
        <TouchableOpacity onPress={() => setIsBlockUserModalOpen(true)}>
          <Text style={styles.dangerText}>Chặn người dùng</Text>
        </TouchableOpacity>
      </View>

      {/* Modal xóa lịch sử trò chuyện */}
      <Modal
        visible={isDeleteChatModalOpen}
        transparent
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
              <TouchableOpacity
                style={[styles.modalButton, styles.dangerButton]}
                onPress={handleDeleteChatHistory}
              >
                <Text style={[styles.modalButtonText, styles.dangerButtonText]}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Modal chặn người dùng */}
      <Modal
        visible={isBlockUserModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBlockUserModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setIsBlockUserModalOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chặn người dùng</Text>
            <Text style={styles.modalText}>
              Bạn có chắc chắn muốn chặn {typeof name === 'string' && name ? name : 'người này'}? Bạn sẽ không thể liên lạc với họ sau khi chặn.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsBlockUserModalOpen(false)}
              >
                <Text style={styles.modalButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.dangerButton]}
                onPress={handleBlockUser}
              >
                <Text style={[styles.modalButtonText, styles.dangerButtonText]}>Chặn</Text>
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
  headerLeft: {
    marginLeft: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoHeader: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  infoAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  contactName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  contactPhone: {
    fontSize: 16,
    color: '#555',
    marginTop: 5,
  },
  infoSection: {
    backgroundColor: '#fff',
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  sectionHeader: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  sectionContent: {
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  mediaGrid: {
    marginTop: 10,
  },
  mediaItem: {
    marginRight: 10,
  },
  mediaImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  mediaVideo: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  fileList: {
    marginTop: 10,
  },
  fileItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fileName: {
    fontSize: 14,
    color: '#007AFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  dangerText: {
    fontSize: 16,
    color: '#ff3b30',
    padding: 15,
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
    textAlign: 'center',
    marginBottom: 10,
  },
  modalText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 5,
    marginHorizontal: 5,
    backgroundColor: '#f0f0f0',
  },
  modalButtonText: {
    fontSize: 14,
    color: '#007AFF',
  },
  dangerButton: {
    backgroundColor: '#ff3b30',
  },
  dangerButtonText: {
    color: '#fff',
  },
});

export default ContactDetailsScreen;