const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Хранилище пользователей и сессий
const usersDB = [];              // { username, password }
const sessions = new Map();      // socket.id -> username
const onlineUsers = new Set();   // имена пользователей онлайн

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Регистрация
  socket.on('register', (data, callback) => {
    const { username, password } = data;
    if (!username || !password) {
      return callback({ success: false, message: 'Заполните все поля' });
    }
    if (usersDB.find(u => u.username === username)) {
      return callback({ success: false, message: 'Пользователь уже существует' });
    }
    usersDB.push({ username, password });
    // Авторизуем сразу
    sessions.set(socket.id, username);
    onlineUsers.add(username);
    console.log(`Зарегистрирован и вошёл: ${username}`);
    callback({ success: true, username });
    broadcastOnlineUsers();
    socket.broadcast.emit('user joined', { username });
  });

  // Вход
  socket.on('login', (data, callback) => {
    const { username, password } = data;
    const user = usersDB.find(u => u.username === username && u.password === password);
    if (!user) {
      return callback({ success: false, message: 'Неверный логин или пароль' });
    }
    if (onlineUsers.has(username)) {
      return callback({ success: false, message: 'Этот пользователь уже в сети' });
    }
    sessions.set(socket.id, username);
    onlineUsers.add(username);
    console.log(`Вошёл: ${username}`);
    callback({ success: true, username });
    broadcastOnlineUsers();
    socket.broadcast.emit('user joined', { username });
  });

  // Присоединение к комнате (начать чат с пользователем)
  socket.on('join room', (data, callback) => {
    const currentUser = sessions.get(socket.id);
    const withUser = data.with;
    if (!currentUser || !withUser || !onlineUsers.has(withUser)) {
      return callback && callback({ success: false });
    }
    // Комната с уникальным именем из двух имён в алфавитном порядке
    const room = [currentUser, withUser].sort().join(':');
    socket.join(room);
    console.log(`${currentUser} присоединился к комнате ${room}`);
    if (callback) callback({ success: true, room });
  });

  // Покинуть комнату
  socket.on('leave room', (data) => {
    const currentUser = sessions.get(socket.id);
    if (!currentUser || !data.room) return;
    socket.leave(data.room);
    console.log(`${currentUser} покинул комнату ${data.room}`);
  });

  // Отправка сообщения в комнату
  socket.on('chat message', (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;
    const messageData = {
      user: sender,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    // Отправляем только в эту комнату (обоим участникам)
    io.to(data.room).emit('chat message', messageData);
  });

  // Индикатор печати в комнате (опционально)
  socket.on('typing', (data) => {
    const user = sessions.get(socket.id);
    if (user && data.room) {
      socket.to(data.room).emit('typing', { user });
    }
  });
  socket.on('stop typing', (data) => {
    const user = sessions.get(socket.id);
    if (user && data.room) {
      socket.to(data.room).emit('stop typing', { user });
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    const username = sessions.get(socket.id);
    if (username) {
      console.log(`${username} отключился`);
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      broadcastOnlineUsers();
      socket.broadcast.emit('user left', { username });
    }
  });

  // Рассылка списка всех онлайн пользователей (кроме текущего)
  function broadcastOnlineUsers() {
    const usersArray = Array.from(onlineUsers);
    io.emit('online users', usersArray);
  }

  // Отправляем текущему сокету актуальный список сразу после авторизации
  // (в обработчиках login/register мы вызываем broadcastOnlineUsers, но текущему сокету тоже нужно)
  socket.on('request online users', () => {
    socket.emit('online users', Array.from(onlineUsers));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
