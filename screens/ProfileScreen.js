import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // Thư viện để chọn ảnh
import { getProfile, updateProfile } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { auth } = useContext(AuthContext);
  const { token, userId } = auth;
  const [profile, setProfile] = useState({
    name: '',
    avatar: null,
    coverPhoto: null,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImageType, setSelectedImageType] = useState(null); // 'avatar' hoặc 'coverPhoto'

  useEffect(() => {
    if (token && userId) {
      fetchProfile();
    } else {
      navigation.replace('Login');
    }
  }, [token, userId, navigation]);

  const fetchProfile = async () => {
    try {
      const { data } = await getProfile(token);
      setProfile({
        name: data.data.name || '',
        avatar: data.data.avatar || null,
        coverPhoto: data.data.coverPhoto || null,
      });
    } catch (err) {
      console.error('Lỗi fetchProfile:', err.message);
    }
  };

  // Mở modal khi nhấn avatar hoặc ảnh bìa
  const openModal = (type) => {
    setSelectedImageType(type);
    setModalVisible(true);
  };

  // Đóng modal
  const closeModal = () => {
    setModalVisible(false);
    setSelectedImageType(null);
  };

  // Xem ảnh (chuyển sang màn hình xem ảnh nếu cần)
  const viewImage = () => {
    if (selectedImageType === 'avatar' && profile.avatar) {
      console.log('Xem ảnh đại diện:', profile.avatar);
      // Có thể chuyển sang màn hình xem ảnh lớn nếu cần
    } else if (selectedImageType === 'coverPhoto' && profile.coverPhoto) {
      console.log('Xem ảnh bìa:', profile.coverPhoto);
      // Có thể chuyển sang màn hình xem ảnh lớn nếu cần
    }
    closeModal();
  };

  // Chọn và upload ảnh
  const changeImage = async () => {
    // Yêu cầu quyền truy cập thư viện ảnh
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Cần cấp quyền truy cập thư viện ảnh!');
      return;
    }

    // Mở thư viện ảnh để chọn
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: selectedImageType === 'avatar' ? [1, 1] : [16, 9], // Tỷ lệ cho avatar hoặc ảnh bìa
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const { uri } = result.assets[0];
      await uploadImage(uri);
    }
    closeModal();
  };

  // Upload ảnh lên server
  const uploadImage = async (uri) => {
    const formData = new FormData();
    const fileType = uri.split('.').pop();
    const fileName = `${selectedImageType}_${userId}.${fileType}`;

    formData.append(selectedImageType, {
      uri,
      name: fileName,
      type: `image/${fileType}`,
    });

    try {
      const { data } = await updateProfile(formData, token);
      setProfile((prev) => ({
        ...prev,
        [selectedImageType]: data.data[selectedImageType],
      }));
      alert(`Cập nhật ${selectedImageType === 'avatar' ? 'ảnh đại diện' : 'ảnh bìa'} thành công!`);
    } catch (error) {
      console.error('Lỗi upload ảnh:', error.message);
      alert('Cập nhật ảnh thất bại!');
    }
  };

  if (!token || !userId) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.coverContainer}>
        <TouchableOpacity onPress={() => openModal('coverPhoto')}>
          {profile.coverPhoto ? (
            <Image source={{ uri: profile.coverPhoto }} style={styles.coverPhoto} />
          ) : (
            <View style={styles.coverPhotoPlaceholder}>
              <Text style={styles.avatarText}>Chưa có ảnh bìa</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openModal('avatar')}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>Chưa có ảnh đại diện</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      <Text style={styles.name}>{profile.name}</Text>

      <TouchableOpacity
        style={styles.menuIcon}
        onPress={() => navigation.getParent()?.navigate('ProfileOptions')}
      >
        <Ionicons name="ellipsis-vertical" size={24} color="#333" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalOption} onPress={viewImage}>
              <Text style={styles.modalText}>Xem ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={changeImage}>
              <Text style={styles.modalText}>Thay đổi ảnh</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { paddingBottom: 100 },
  coverContainer: { position: 'relative', width: '100%', height: 230, marginBottom: 70 },
  coverPhoto: { width: '100%', height: '100%', borderWidth: 0, borderColor: '#f5f5f5' },
  coverPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#f5f5f5',
    position: 'absolute',
    bottom: -60,
    alignSelf: 'center',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -60,
    alignSelf: 'center',
  },
  avatarText: { color: '#666', fontSize: 16 },
  name: { fontSize: 24, color: '#333', fontWeight: 'bold', textAlign: 'center', marginVertical: 10 },
  menuIcon: { position: 'absolute', top: 40, left: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
  },
  modalOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalText: {
    fontSize: 18,
    color: '#005AE0',
    textAlign: 'center',
  },
});