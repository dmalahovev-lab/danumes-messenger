const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const usersDB = [];
const sessions = new Map();
const onlineUsers = new Set();

// Группы и каналы
const groups = [];   // { name, room, members: [], type: 'group'|'channel', admin }
const channels = []; // { name, room, subscribers: [], admin }

io.on('connection', (socket) => {
  console.log('Подключение:', socket.id);

  // Регистрация
  socket.on('register', (data, callback) => {
    const { username, password } = data;
    if (!username || !password) return callback({ success: false, message: 'Заполните все поля' });
    if (usersDB.find(u => u.username === username)) return callback({ success: false, message: 'Пользователь уже существует' });
    usersDB.push({ username, password });
    sessions.set(socket.id, username);
    onlineUsers.add(username);
    callback({ success: true, username });
    broadcastOnlineUsers();
    socket.broadcast.emit('user joined', { username });
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  // Вход
  socket.on('login', (data, callback) => {
    const { username, password } = data;
    const user = usersDB.find(u => u.username === username && u.password === password);
    if (!user) return callback({ success: false, message: 'Неверный логин или пароль' });
    if (onlineUsers.has(username)) return callback({ success: false, message: 'Уже в сети' });
    sessions.set(socket.id, username);
    onlineUsers.add(username);
    callback({ success: true, username });
    broadcastOnlineUsers();
    socket.broadcast.emit('user joined', { username });
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  // Создание группы
  socket.on('create group', (data, callback) => {
    const admin = sessions.get(socket.id);
    if (!admin) return callback({ success: false, message: 'Не авторизован' });
    const { name, members } = data;
    const allMembers = [admin, ...members];
    const room = allMembers.sort().join(':');
    
    const group = { name, room, members: allMembers, type: 'group', admin };
    groups.push(group);
    
    // Присоединяем создателя к комнате
    socket.join(room);
    
    // Отправляем всем обновлённый список
    io.emit('groups list', groups);
    callback({ success: true, group });
  });

  // Создание канала
  socket.on('create channel', (data, callback) => {
    const admin = sessions.get(socket.id);
    if (!admin) return callback({ success: false, message: 'Не авторизован' });
    const { name } = data;
    const room = `channel:${name}:${Date.now()}`;
    
    const channel = { name, room, subscribers: [admin], admin, type: 'channel' };
    channels.push(channel);
    
    socket.join(room);
    io.emit('channels list', channels);
    callback({ success: true, channel });
  });

  // Подписка на канал
  socket.on('subscribe channel', (data, callback) => {
    const username = sessions.get(socket.id);
    if (!username) return callback({ success: false });
    const channel = channels.find(c => c.room === data.room);
    if (!channel) return callback({ success: false });
    if (!channel.subscribers.includes(username)) {
      channel.subscribers.push(username);
    }
    socket.join(channel.room);
    io.emit('channels list', channels);
    callback({ success: true, channel });
  });

  // Смена пароля
  socket.on('change password', (data, callback) => {
    const username = sessions.get(socket.id);
    if (!username) return callback({ success: false, message: 'Не авторизован' });
    const user = usersDB.find(u => u.username === username);
    if (!user || user.password !== data.oldPassword) return callback({ success: false, message: 'Неверный старый пароль' });
    user.password = data.newPassword;
    callback({ success: true });
  });

  // Выход
  socket.on('logout', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      broadcastOnlineUsers();
      socket.broadcast.emit('user left', { username });
    }
  });

  // Присоединение к комнате
  socket.on('join room', (data, callback) => {
    const currentUser = sessions.get(socket.id);
    const room = data.room;
    if (!currentUser) return callback && callback({ success: false });
    
    // Проверяем доступ к группе
    const group = groups.find(g => g.room === room);
    if (group && !group.members.includes(currentUser)) {
      return callback({ success: false, message: 'Нет доступа' });
    }
    
    socket.join(room);
    console.log(`${currentUser} joined ${room}`);
    if (callback) callback({ success: true, room });
  });

  socket.on('leave room', (data) => {
    if (data.room) socket.leave(data.room);
  });

  // Отправка сообщения
  socket.on('chat message', (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;
    
    // Для каналов проверяем, что отправитель — админ
    const channel = channels.find(c => c.room === data.room);
    if (channel && channel.admin !== sender) return;
    
    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('typing', (data) => {
    const user = sessions.get(socket.id);
    if (user && data.room) socket.to(data.room).emit('typing', { user });
  });

  socket.on('stop typing', (data) => {
    const user = sessions.get(socket.id);
    if (user && data.room) socket.to(data.room).emit('stop typing', { user });
  });

  socket.on('disconnect', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
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
server.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));
