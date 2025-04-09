import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000'; // Thay bằng URL backend của bạn
let socket;

export const initSocket = (userId) => {
  socket = io(SOCKET_URL, { transports: ['websocket'] });
  socket.on('connect', () => {
    console.log('Connected to socket');
    socket.emit('join', userId);
  });
  return socket;
};

export const getSocket = () => socket;