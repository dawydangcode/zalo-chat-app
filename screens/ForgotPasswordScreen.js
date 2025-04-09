import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import { sendOTP, verifyOTP, resetPassword } from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Nhập số điện thoại, 2: Nhập OTP và mật khẩu mới

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
      await verifyOTP(phoneNumber, otp); // Xác minh OTP trước
      await resetPassword(phoneNumber, newPassword, otp);
      setError('');
      navigation.navigate('Login');
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt lại mật khẩu thất bại!');
    }
  };

  return (
    <View style={styles.container}>
      {step === 1 ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <Button title="Gửi OTP" onPress={handleSendOTP} />
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Nhập OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.input}
            placeholder="Mật khẩu mới"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <Button title="Đặt lại mật khẩu" onPress={handleResetPassword} />
        </>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Quay lại đăng nhập" onPress={() => navigation.navigate('Login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  input: { borderWidth: 1, padding: 10, marginBottom: 10, borderRadius: 5 },
  error: { color: 'red', marginBottom: 10 },
});