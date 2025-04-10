import axios from 'axios';

const API_URL = 'http://192.168.34.169:3000/api'; // Đảm bảo đúng base URL

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const login = (phoneNumber, password) =>
  api.post('/auth/login', { phoneNumber, password });

export const register = (phoneNumber, password, name, otp) =>
  api.post('/auth/register', { phoneNumber, password, name, otp });

export const sendOTP = (phoneNumber, purpose = 'register') =>
  api.post('/auth/send-otp', { phoneNumber, purpose });

export const verifyOTP = (phoneNumber, otp) =>
  api.post('/auth/verify-otp', { phoneNumber, otp });

export const resetPassword = (phoneNumber, newPassword, otp) =>
  api.post('/auth/reset-password', { phoneNumber, newPassword, otp });

export const getProfile = (token) =>
  api.get('/auth/profile', { headers: { Authorization: `Bearer ${token}` } });

export const updateProfile = (data, token) =>
  api.patch('/auth/profile', data, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
  });

export const updatePassword = (data, token) =>
  api.patch('/auth/reset-password-login', data, { // Sửa endpoint
    headers: { Authorization: `Bearer ${token}` },
  });

export default api;