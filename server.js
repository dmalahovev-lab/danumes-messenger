const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const usersDB = {};
const sessions = {};
const onlineUsers = new Set();
const groups = [];
const channels = [];

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('register', (data, callback) => {
    const { username, password } = data;
    if (!username || !password) return callback({ success: false, message: 'Fill fields' });
    if (usersDB[username]) return callback({ success: false, message: 'User exists' });
    usersDB[username] = password;
    sessions[socket.id] = username;
    onlineUsers.add(username);
    callback({ success: true, username });
    io.emit('online users', Array.from(onlineUsers));
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

  socket.on('login', (data, callback) => {
    const { username, password } = data;
    if (usersDB[username] !== password) return callback({ success: false, message: 'Wrong credentials' });
    if (onlineUsers.has(username)) return callback({ success: false, message: 'Already online' });
    sessions[socket.id] = username;
    onlineUsers.add(username);
    callback({ success: true, username });
    io.emit('online users', Array.from(onlineUsers));
    socket.emit('groups list', groups);
    socket.emit('channels list', channels);
  });

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

  socket.on('join room', (data) => {
    if (data.room) socket.join(data.room);
  });

  socket.on('leave room', (data) => {
    if (data.room) socket.leave(data.room);
  });

  socket.on('chat message', (data) => {
    const sender = sessions[socket.id];
    if (!sender || !data.room || !data.text) return;
    const channel = channels.find(c => c.room === data.room);
    if (channel && channel.admin !== sender) return;
    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('change password', (data, callback) => {
    const username = sessions[socket.id];
    if (!username) return callback({ success: false, message: 'Not authorized' });
    if (usersDB[username] !== data.oldPassword) return callback({ success: false, message: 'Wrong old password' });
    usersDB[username] = data.newPassword;
    callback({ success: true });
  });

  socket.on('logout', () => {
    const username = sessions[socket.id];
    if (username) {
      delete sessions[socket.id];
      onlineUsers.delete(username);
      io.emit('online users', Array.from(onlineUsers));
    }
  });

  socket.on('disconnect', () => {
    const username = sessions[socket.id];
    if (username) {
      delete sessions[socket.id];
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
