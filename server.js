const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Для SPA (если нужно) — все остальные запросы на index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Хранилище данных
const usersDB = {};           // { username: password }
const sessions = {};          // { socket.id: username }
const onlineUsers = new Set();
const groups = [];
const channels = [];

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Регистрация
  socket.on('register', (data, callback) => {
    const { username, password } = data;
    if (!username || !password) {
      return callback({ success: false, message: 'Заполните все поля' });
    }
    if (usersDB[username]) {
      return callback({ success: false, message: 'Пользователь уже существует' });
    }
    usersDB[username] = password;
    sessions[socket.id] = username;
    onlineUsers.add(username);
    console.log(`Зарегистрирован: ${username}`);
    callback({ success: true, username });
    broadcastOnlineUsers();
    socket.broadcast.emit('user joined', { username });
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  // Вход
  socket.on('login', (data, callback) => {
    const { username, password } = data;
    if (!usersDB[username] || usersDB[username] !== password) {
      return callback({ success: false, message: 'Неверный логин или пароль' });
    }
    if (onlineUsers.has(username)) {
      return callback({ success: false, message: 'Уже в сети' });
    }
    sessions[socket.id] = username;
    onlineUsers.add(username);
    console.log(`Вошёл: ${username}`);
    callback({ success: true, username });
    broadcastOnlineUsers();
    socket.broadcast.emit('user joined', { username });
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  // Создание группы
  socket.on('create group', (data, callback) => {
    const admin = sessions[socket.id];
    if (!admin) return callback({ success: false });
    const members = [admin, ...data.members];
    const room = 'group_' + Date.now();
    const group = { name: data.name, room, members, admin, type: 'group' };
    groups.push(group);
    socket.join(room);
    io.emit('groups list', groups);
    callback({ success: true, group });
  });

  // Создание канала
  socket.on('create channel', (data, callback) => {
    const admin = sessions[socket.id];
    if (!admin) return callback({ success: false });
    const room = 'channel_' + Date.now();
    const channel = { name: data.name, room, subscribers: [admin], admin, type: 'channel' };
    channels.push(channel);
    socket.join(room);
    io.emit('channels list', channels);
    callback({ success: true, channel });
  });

  // Присоединение к комнате
  socket.on('join room', (data) => {
    if (data.room) socket.join(data.room);
  });

  socket.on('leave room', (data) => {
    if (data.room) socket.leave(data.room);
  });

  // Отправка сообщения
  socket.on('chat message', (data) => {
    const sender = sessions[socket.id];
    if (!sender || !data.room || !data.text) return;
    // Для канала — только админ может писать
    const channel = channels.find(c => c.room === data.room);
    if (channel && channel.admin !== sender) return;
    
    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Смена пароля
  socket.on('change password', (data, callback) => {
    const username = sessions[socket.id];
    if (!username) return callback({ success: false, message: 'Не авторизован' });
    if (usersDB[username] !== data.oldPassword) return callback({ success: false, message: 'Неверный старый пароль' });
    usersDB[username] = data.newPassword;
    callback({ success: true });
  });

  // Индикатор печати
  socket.on('typing', (data) => {
    const user = sessions[socket.id];
    if (user && data.room) socket.to(data.room).emit('typing', { user });
  });
  socket.on('stop typing', (data) => {
    const user = sessions[socket.id];
    if (user && data.room) socket.to(data.room).emit('stop typing', { user });
  });

  // Выход
  socket.on('logout', () => {
    const username = sessions[socket.id];
    if (username) {
      delete sessions[socket.id];
      onlineUsers.delete(username);
      broadcastOnlineUsers();
      socket.broadcast.emit('user left', { username });
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    const username = sessions[socket.id];
    if (username) {
      delete sessions[socket.id];
      onlineUsers.delete(username);
      broadcastOnlineUsers();
      socket.broadcast.emit('user left', { username });
    }
  });

  function broadcastOnlineUsers() {
    io.emit('online users', Array.from(onlineUsers));
  }

  socket.on('request online users', () => {
    socket.emit('online users', Array.from(onlineUsers));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
