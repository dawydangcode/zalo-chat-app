import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { sendOTP, verifyOTP, resetPassword } from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const handleSendOTP = async () => {
    try {
      await sendOTP(phoneNumber, 'reset-password');
      setError('');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi OTP!');
    }
  };

  const handleResetPassword = async () => {
    try {
      await verifyOTP(phoneNumber, otp);
      await resetPassword(phoneNumber, newPassword, otp);
      navigation.navigate('Login');
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt lại mật khẩu thất bại!');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {step === 1 ? 'Quên mật khẩu' : 'Xác nhận OTP'}
      </Text>
      {step === 1 ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.button} onPress={handleSendOTP}>
            <Text style={styles.buttonText}>Gửi OTP</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Nhập OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="numeric"
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
          <TouchableOpacity style={styles.button} onPress={handleResetPassword}>
            <Text style={styles.buttonText}>Đặt lại mật khẩu</Text>
          </TouchableOpacity>
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.backButtonText}>Quay lại</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#005AE0', // Màu chủ đạo
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    elevation: 2, // Bóng đổ Android
    shadowColor: '#000', // Bóng đổ iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    backgroundColor: '#005AE0', // Màu chủ đạo
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#e63946',
    marginBottom: 15,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#005AE0', // Màu chủ đạo
    fontSize: 16,
  },
});