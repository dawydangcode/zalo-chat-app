import axios from 'axios';

const API_URL = 'http://192.168.1.2:3000/api'; // Thay bằng URL backend của bạn

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const login = (phoneNumber, password) =>
  api.post('/auth/login', { phoneNumber, password });

export const getConversations = (token) =>
  api.get('/messages/conversations', { headers: { Authorization: `Bearer ${token}` } });

export const getMessages = (userId, token) =>
  api.get(`/messages/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });

export const sendMessage = (data, token) =>
  api.post('/messages/send', data, { headers: { Authorization: `Bearer ${token}` } });

export default api;