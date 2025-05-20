import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState({ token: null, userId: null });

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        console.log('Loaded from AsyncStorage:', { token, userId, refreshToken });
        if (token && userId) {
          setAuth({ token, userId });
        }
      } catch (error) {
        console.error('Lỗi tải auth từ AsyncStorage:', error.message);
      }
    };
    loadAuth();
  }, []);

  const login = async (token, userId) => {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Token không hợp lệ');
      }
      if (!userId || typeof userId !== 'string') {
        throw new Error('User ID không hợp lệ');
      }
      await AsyncStorage.setItem('token', token.trim());
      await AsyncStorage.setItem('userId', userId.trim());
      setAuth({ token, userId });
      console.log('Đã lưu auth:', { token, userId });
    } catch (error) {
      console.error('Lỗi lưu auth:', error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userId');
      await AsyncStorage.removeItem('refreshToken');
      setAuth({ token: null, userId: null });
      console.log('Đã đăng xuất và xóa auth');
    } catch (error) {
      console.error('Lỗi đăng xuất:', error.message);
    }
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};