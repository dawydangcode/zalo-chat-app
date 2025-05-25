import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthContext } from '../context/AuthContext';
import { getProfile } from '../services/api';

export default function ProfileOptionsScreen({ navigation }) {
  const { auth, logout } = useContext(AuthContext);
  const { token, userId } = auth;
  const [userName, setUserName] = useState('Đang tải...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token && userId) {
      fetchUserName();
    }
  }, [token, userId]);

  const fetchUserName = async () => {
    try {
      const { data } = await getProfile(token);
      const name = data.data.name || 'Không có tên';
      setUserName(name);
    } catch (err) {
      setError('Không thể tải tên người dùng!');
      setUserName('Lỗi');
      console.error('Lỗi fetchUserName:', err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerText}>{userName}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={styles.option}
        onPress={() => navigation.navigate('ProfileInfo')}
      >
        <Text style={styles.optionText}>Thông tin</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.option}
        onPress={() => navigation.navigate('ChangePassword')}
      >
        <Text style={styles.optionText}>Đổi mật khẩu</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.logoutOption}
        onPress={handleLogout}
      >
        <Text style={styles.logoutOptionText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 15 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 10,
  },
  option: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  optionText: {
    fontSize: 18,
    color: '#005AE0',
  },
  logoutOption: {
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'red',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutOptionText: {
    fontSize: 18,
    color: 'red',
    fontWeight: '600',
  },
  error: {
    color: '#e63946',
    marginBottom: 15,
    textAlign: 'center',
  },
});