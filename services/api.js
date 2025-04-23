import axios from 'axios';

const API_URL = 'http:///192.168.99.169:3000/api'; // Ensure this matches your backend

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
  api.patch('/auth/reset-password-login', data, {
    headers: { Authorization: `Bearer ${token}` },
  });

// New APIs from Sidebar.js
export const getMessageSummary = (token) =>
  api.get('/messages/summary', { headers: { Authorization: `Bearer ${token}` } });

export const getContacts = (token) =>
  api.get('/contacts', { headers: { Authorization: `Bearer ${token}` } });

export const searchFriends = (phoneNumber, token) =>
  api.get(`/friends/search?phoneNumber=${encodeURIComponent(phoneNumber)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const markAsRead = (chatId, token) =>
  api.post(`/chats/${chatId}/mark-as-read`, {}, { headers: { Authorization: `Bearer ${token}` } });

export const getMessages = (targetUserId, token) =>
  api.get(`/messages/user/${targetUserId}`, { headers: { Authorization: `Bearer ${token}` } });

export const sendMessage = (data, token, isFormData = false) =>
  api.post('/messages/send', data, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' }),
    },
  });

export const recallMessage = (messageId, token) =>
  api.patch(`/messages/recall/${messageId}`, {}, { headers: { Authorization: `Bearer ${token}` } });

export const deleteMessage = (messageId, token) =>
  api.delete(`/messages/${messageId}`, { headers: { Authorization: `Bearer ${token}` } });

export const forwardMessage = (messageId, targetReceiverId, token) =>
  api.post(
    '/messages/forward',
    { messageId, targetReceiverId },
    { headers: { Authorization: `Bearer ${token}` } }
  );

export default api;