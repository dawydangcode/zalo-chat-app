import axios from 'axios';

const API_URL = 'http://192.168.1.9:3000/api'; // Ensure this matches your backend

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Interceptors để ghi log (giữ nguyên)
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method.toUpperCase(), config.url, config.data);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('API Response Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    return Promise.reject(error);
  }
);

// Auth APIs (giữ nguyên)
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

// Message APIs (sửa getMessageSummary)
export const getMessageSummary = (token) =>
  api.get('/conversations/summary?minimal=false', { headers: { Authorization: `Bearer ${token}` } });

export const getContacts = (token) =>
  api.get('/contacts', { headers: { Authorization: `Bearer ${token}` } });

export const searchFriends = (phoneNumber, token) =>
  api.get(`/searchs/users/by-phone?phoneNumber=${encodeURIComponent(phoneNumber)}`, {
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

// Friend APIs (giữ nguyên)
export const getFriends = (token) =>
  api.get('/friends/list', { headers: { Authorization: `Bearer ${token}` } });

export const getReceivedFriendRequests = (token) =>
  api.get('/friends/received', { headers: { Authorization: `Bearer ${token}` } });

export const getSentFriendRequests = (token) =>
  api.get('/friends/sent', { headers: { Authorization: `Bearer ${token}` } });

export const sendFriendRequest = (targetUserId, token) =>
  api.post(
    '/friends/send',
    { receiverId: targetUserId, message: 'Xin chào, mình muốn kết bạn với bạn!' },
    { headers: { Authorization: `Bearer ${token}` } }
  );

export const acceptFriendRequest = (requestId, token) =>
  api.post(`/friends/accept/${requestId}`, {}, { headers: { Authorization: `Bearer ${token}` } });

export const rejectFriendRequest = (requestId, token) =>
  api.delete(`/friends/reject/${requestId}`, { headers: { Authorization: `Bearer ${token}` } });

export const cancelFriendRequest = (requestId, token) =>
  api.delete(`/friends/cancel/${requestId}`, { headers: { Authorization: `Bearer ${token}` } });

export const getUserStatus = (targetUserId, token) =>
  api.get(`/friends/status/${targetUserId}`, { headers: { Authorization: `Bearer ${token}` } });

export default api;