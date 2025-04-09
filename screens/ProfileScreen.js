import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, Button, Image, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getProfile, updateProfile, updatePassword } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function ProfileScreen({ navigation }) {
  const { auth, logout } = useContext(AuthContext);
  const { token, userId } = auth;
  const [profile, setProfile] = useState({ name: '', phoneNumber: '', avatar: null });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token && userId) {
      fetchProfile();
    } else {
      setError('Vui lòng đăng nhập lại!');
    }
  }, [token, userId]);

  const fetchProfile = async () => {
    try {
      const { data } = await getProfile(token);
      console.log('Dữ liệu profile từ server:', data);
      setProfile({
        name: data.name || '',
        phoneNumber: data.phoneNumber || '',
        avatar: data.avatar || null,
      });
    } catch (err) {
      setError('Không thể tải profile!');
      console.error('Lỗi fetchProfile:', err.message);
    }
  };

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      setError('Chức năng chọn ảnh không hỗ trợ trên web!');
      return;
    }

    try {
      console.log('Yêu cầu quyền');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Trạng thái quyền:', status);
      if (status !== 'granted') {
        setError('Cần cấp quyền truy cập thư viện ảnh!');
        return;
      }

      console.log('Mở thư viện ảnh');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      console.log('Kết quả chọn ảnh:', result);

      if (!result.canceled) {
        const file = {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        };
        const formData = new FormData();
        formData.append('avatar', file);
        console.log('FormData:', { uri: file.uri, type: file.type, name: file.name });

        console.log('Gửi request upload với token:', token);
        const { data } = await updateProfile(formData, token);
        console.log('Kết quả từ server:', data);

        // Backend trả về toàn bộ profile, cập nhật tất cả
        if (data.success) {
          setProfile({
            name: data.data.name || profile.name,
            phoneNumber: data.data.phoneNumber || profile.phoneNumber,
            avatar: data.data.avatar || null,
          });
        } else {
          console.log('Upload thành công nhưng không có dữ liệu mới, gọi fetchProfile');
          await fetchProfile(); // Gọi lại để lấy dữ liệu mới nhất
        }
        setError('');
      }
    } catch (err) {
      setError('Lỗi khi chọn hoặc upload ảnh!');
      console.error('Lỗi chi tiết:', err.message);
      if (err.response) {
        console.error('Response error:', err.response.data);
      } else if (err.request) {
        console.error('Request error:', err.request);
      }
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      setError('Vui lòng nhập mật khẩu mới!');
      return;
    }
    try {
      await updatePassword({ newPassword }, token);
      setNewPassword('');
      setError('');
    } catch (err) {
      setError('Cập nhật mật khẩu thất bại!');
      console.error('Lỗi updatePassword:', err.message);
    }
  };

  if (!token || !userId) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Vui lòng đăng nhập để xem profile!</Text>
        <Button title="Đăng nhập" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {profile.avatar ? (
        <Image source={{ uri: profile.avatar }} style={styles.avatar} />
      ) : (
        <Text>Chưa có ảnh đại diện</Text>
      )}
      <Button title="Thay đổi ảnh" onPress={pickImage} disabled={Platform.OS === 'web'} />
      <Text style={styles.info}>Tên: {profile.name}</Text>
      <Text style={styles.info}>Số điện thoại: {profile.phoneNumber}</Text>
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu mới"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />
      <Button title="Cập nhật mật khẩu" onPress={handleUpdatePassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Đăng xuất" onPress={logout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 20 },
  info: { fontSize: 16, marginVertical: 10 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 5, width: '100%' },
  error: { color: 'red', marginBottom: 10 },
});