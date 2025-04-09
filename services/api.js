import axios from 'axios';

const API_URL = 'http://localhost:3000/api'; // Thay bằng URL backend của bạn

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

export const getConversations = (token) =>
  api.get('/messages/conversations', { headers: { Authorization: `Bearer ${token}` } });

export const getMessages = (userId, token) =>
  api.get(`/messages/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });

export const sendMessage = (data, token) =>
  api.post('/messages/send', data, { headers: { Authorization: `Bearer ${token}` } });

export default api;