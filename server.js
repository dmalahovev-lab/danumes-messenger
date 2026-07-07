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

const users = {};

io.on('connection', (socket) => {
  console.log('Новый пользователь подключился:', socket.id);

  socket.on('new user', (name) => {
    users[socket.id] = name;
    io.emit('user joined', { id: socket.id, name });
    // Отправляем список активных пользователей (можно использовать для чат‑листа)
    io.emit('online users', Object.values(users));
  });

  socket.on('chat message', (msg) => {
    const user = users[socket.id] || 'Аноним';
    io.emit('chat message', {
      user,
      text: msg,
      id: socket.id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('typing', () => {
    const user = users[socket.id] || 'Аноним';
    socket.broadcast.emit('typing', { user, id: socket.id });
  });

  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
    if (users[socket.id]) {
      io.emit('user left', { id: socket.id, name: users[socket.id] });
      delete users[socket.id];
      io.emit('online users', Object.values(users));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
