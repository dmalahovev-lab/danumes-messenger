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

const usersDB = [];               // { username, password }
const sessions = new Map();       // socket.id -> username
const onlineUsers = new Set();

io.on('connection', (socket) => {
  console.log('Подключение:', socket.id);

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
  });

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
  });

  socket.on('change password', (data, callback) => {
    const username = sessions.get(socket.id);
    if (!username) return callback({ success: false, message: 'Не авторизован' });
    const user = usersDB.find(u => u.username === username);
    if (!user || user.password !== data.oldPassword) {
      return callback({ success: false, message: 'Неверный старый пароль' });
    }
    user.password = data.newPassword;
    callback({ success: true });
  });

  socket.on('logout', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      broadcastOnlineUsers();
      socket.broadcast.emit('user left', { username });
    }
  });

  socket.on('join room', (data, callback) => {
    const currentUser = sessions.get(socket.id);
    const withUser = data.with;
    if (!currentUser || !withUser || !onlineUsers.has(withUser)) {
      return callback && callback({ success: false });
    }
    const room = [currentUser, withUser].sort().join(':');
    socket.join(room);
    if (callback) callback({ success: true, room });
  });

  socket.on('leave room', (data) => {
    if (data.room) socket.leave(data.room);
  });

  socket.on('chat message', (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;
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
server.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
