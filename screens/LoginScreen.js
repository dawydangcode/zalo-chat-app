import React, { useState, useContext } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { login } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: setAuth } = useContext(AuthContext);

  const handleLogin = async () => {
    try {
      const { data } = await login(phoneNumber, password);
      setAuth(data.token, data.user.id);
      navigation.navigate('Main', { screen: 'Profile' });
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại!');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Số điện thoại" value={phoneNumber} onChangeText={setPhoneNumber} />
      <TextInput style={styles.input} placeholder="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Đăng nhập" onPress={handleLogin} />
      <Button title="Đăng ký" onPress={() => navigation.navigate('Register')} />
      <Button title="Quên mật khẩu" onPress={() => navigation.navigate('ForgotPassword')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 5 },
  error: { color: 'red', marginBottom: 10 },
});