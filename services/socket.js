import { io } from 'socket.io-client';
import { Alert } from 'react-native';

const SOCKET_URL = 'ws://192.168.1.9:3000';
let sockets = {};

export const initializeSocket = (token, namespace = '') => {
  const key = namespace || 'default';
  if (sockets[key] && sockets[key].connected) {
    console.log(`Socket đã tồn tại và đang kết nối (${namespace})`);
    return sockets[key];
  }

  sockets[key] = io(`${SOCKET_URL}${namespace}`, {
    auth: {
      token: token,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    forceNew: false,
  });

  sockets[key].on('connect', () => {
    console.log(`Kết nối thành công với Socket.IO server (${namespace})`);
  });

  sockets[key].on('connect_error', (error) => {
    console.error(`Lỗi kết nối socket (${namespace}):`, error.message, error.stack);
    Alert.alert('Lỗi kết nối', 'Không thể kết nối đến server chat. Vui lòng kiểm tra mạng.');
  });

  sockets[key].on('reconnect', (attempt) => {
    console.log(`Socket kết nối lại thành công (${namespace}) sau ${attempt} lần thử`);
  });

  sockets[key].on('reconnect_error', (error) => {
    console.error(`Lỗi kết nối lại socket (${namespace}):`, error.message, error.stack);
  });

  sockets[key].on('disconnect', (reason) => {
    console.log(`Ngắt kết nối với Socket.IO server (${namespace}): ${reason}`);
  });

  sockets[key].onAny((event, ...args) => {
    console.log(`Socket nhận sự kiện (${namespace}): ${event}`, args);
  });

  return sockets[key];
};

export const getSocket = (namespace = '') => {
  const key = namespace || 'default';
  if (!sockets[key]) {
    throw new Error(`Socket cho namespace ${namespace} chưa được khởi tạo.`);
  }
  return sockets[key];
};

export const disconnectSocket = (namespace = '') => {
  const key = namespace || 'default';
  if (sockets[key]) {
    sockets[key].disconnect();
    delete sockets[key];
    console.log(`Socket đã ngắt kết nối (${namespace})`);
  }
};

export const disconnectAllSockets = () => {
  Object.keys(sockets).forEach((key) => {
    sockets[key].disconnect();
    delete sockets[key];
  });
  console.log('Tất cả socket đã ngắt kết nối');
};