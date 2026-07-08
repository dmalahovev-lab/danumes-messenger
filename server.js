const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const usersDB = {};
const sessions = new Map();
const onlineUsers = new Set();
const groups = [];
const channels = [];

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register', (data, cb) => {
    const { username, password } = data;
    if (!username || !password) return cb({ success: false, message: 'Fill fields' });
    if (usersDB[username]) return cb({ success: false, message: 'User exists' });
    usersDB[username] = password;
    sessions.set(socket.id, username);
    onlineUsers.add(username);
    cb({ success: true, username });
    io.emit('online users', Array.from(onlineUsers));
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  socket.on('login', (data, cb) => {
    const { username, password } = data;
    if (!usersDB[username] || usersDB[username] !== password) return cb({ success: false, message: 'Wrong credentials' });
    if (onlineUsers.has(username)) return cb({ success: false, message: 'Already online' });
    sessions.set(socket.id, username);
    onlineUsers.add(username);
    cb({ success: true, username });
    io.emit('online users', Array.from(onlineUsers));
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  socket.on('create group', (data, cb) => {
    const admin = sessions.get(socket.id);
    if (!admin) return cb({ success: false });
    const members = [admin, ...data.members];
    const room = 'group_' + Date.now();
    groups.push({ name: data.name, room, members, admin, type: 'group' });
    socket.join(room);
    io.emit('groups list', groups);
    cb({ success: true });
  });

  socket.on('create channel', (data, cb) => {
    const admin = sessions.get(socket.id);
    if (!admin) return cb({ success: false });
    const room = 'channel_' + Date.now();
    channels.push({ name: data.name, room, subscribers: [admin], admin, type: 'channel' });
    socket.join(room);
    io.emit('channels list', channels);
    cb({ success: true });
  });

  socket.on('join room', (data) => {
    if (data.room) socket.join(data.room);
  });

  socket.on('leave room', (data) => {
    if (data.room) socket.leave(data.room);
  });

  socket.on('chat message', (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;
    // Проверка канала: только админ может писать
    const channel = channels.find(c => c.room === data.room);
    if (channel && channel.admin !== sender) {
      return socket.emit('error', 'Только админ может писать в канал');
    }
    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id: data.id,
      replyTo: data.replyTo
    });
  });

  socket.on('delete message', (data) => {
    if (data.room) socket.to(data.room).emit('delete message', { id: data.id });
  });

  socket.on('reaction', (data) => {
    if (data.room) socket.to(data.room).emit('reaction', { id: data.id, emoji: data.emoji });
  });

  socket.on('change username', (data, cb) => {
    const { oldUsername, newUsername } = data;
    if (!oldUsername || !newUsername) return cb({ success: false });
    if (usersDB[newUsername]) return cb({ success: false, message: 'Username taken' });
    usersDB[newUsername] = usersDB[oldUsername];
    delete usersDB[oldUsername];
    for (let [sid, user] of sessions) {
      if (user === oldUsername) sessions.set(sid, newUsername);
    }
    onlineUsers.delete(oldUsername);
    onlineUsers.add(newUsername);
    io.emit('online users', Array.from(onlineUsers));
    cb({ success: true });
  });

  socket.on('change password', (data, cb) => {
    const username = sessions.get(socket.id);
    if (!username || usersDB[username] !== data.oldPassword) return cb({ success: false, message: 'Wrong password' });
    usersDB[username] = data.newPassword;
    cb({ success: true });
  });

  socket.on('logout', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      io.emit('online users', Array.from(onlineUsers));
    }
  });

  socket.on('disconnect', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      io.emit('online users', Array.from(onlineUsers));
    }
  });

  socket.on('request online users', () => {
    socket.emit('online users', Array.from(onlineUsers));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
