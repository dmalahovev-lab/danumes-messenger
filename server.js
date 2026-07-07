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

// Простейшая база пользователей (в памяти)
const usersDB = [];

// Сессии: socket.id -> username
const sessions = {};

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
    // Автоматически авторизуем после регистрации
    sessions[socket.id] = username;
    console.log(`Зарегистрирован и вошёл: ${username}`);
    callback({ success: true, username });
    // Уведомим всех о новом пользователе (можно для чат-листа)
    io.emit('user joined', { id: socket.id, name: username });
  });

  // Вход
  socket.on('login', (data, callback) => {
    const { username, password } = data;
    const user = usersDB.find(u => u.username === username && u.password === password);
    if (!user) {
      return callback({ success: false, message: 'Неверный логин или пароль' });
    }
    sessions[socket.id] = username;
    console.log(`Вошёл: ${username}`);
    callback({ success: true, username });
    io.emit('user joined', { id: socket.id, name: username });
  });

  // Сообщения
  socket.on('chat message', (msg) => {
    const user = sessions[socket.id];
    if (!user) return;
    io.emit('chat message', {
      user,
      text: msg,
      id: socket.id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // Индикатор печати
  socket.on('typing', () => {
    const user = sessions[socket.id];
    if (user) socket.broadcast.emit('typing', { user, id: socket.id });
  });
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', socket.id);
  });

  // Отключение
  socket.on('disconnect', () => {
    const user = sessions[socket.id];
    if (user) {
      console.log(`${user} отключился`);
      delete sessions[socket.id];
      io.emit('user left', { id: socket.id, name: user });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
