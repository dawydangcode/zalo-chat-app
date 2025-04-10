import React, { useState, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { updatePassword } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function ChangePasswordScreen({ navigation }) {
  const { auth, logout } = useContext(AuthContext);
  const { token } = auth;
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin!');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận không khớp!');
      return;
    }
    try {
      await updatePassword({ oldPassword, newPassword }, token);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      alert('Đổi mật khẩu thành công!');
      navigation.goBack();
    } catch (err) {
      setError('Cập nhật mật khẩu thất bại!');
      console.error('Lỗi updatePassword:', err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Đổi mật khẩu</Text>
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu cũ"
        value={oldPassword}
        onChangeText={setOldPassword}
        secureTextEntry
        placeholderTextColor="#999"
      />
      <TextInput
        style={styles.input}
        placeholder="Mật khẩu mới"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholderTextColor="#999"
      />
      <TextInput
        style={styles.input}
        placeholder="Nhập lại mật khẩu mới"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor="#999"
      />
      <TouchableOpacity style={styles.button} onPress={handleUpdatePassword}>
        <Text style={styles.buttonText}>Cập nhật mật khẩu</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Đăng xuất</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  contentContainer: { padding: 20, paddingBottom: 100 },
  title: { fontSize: 24, color: '#333', fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { width: '100%', padding: 12, marginBottom: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', fontSize: 16, elevation: 2 },
  button: { backgroundColor: '#005AE0', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', marginBottom: 15, elevation: 3 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutButton: { borderWidth: 1, borderColor: 'red', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center' },
  logoutButtonText: { color: 'red', fontSize: 16, fontWeight: '600' },
  error: { color: '#e63946', marginBottom: 15, textAlign: 'center' },
});