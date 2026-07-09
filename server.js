const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Твои ключи Supabase
const supabaseUrl = 'https://pecfhqthefjxfeokyzza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY2ZocXRoZWZqeGZlb2t5enphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjQ0NTYsImV4cCI6MjA5OTE0MDQ1Nn0.TT8fPOoLiVx3GNx5XMtNJtHusefZWQRKM_hDxPJRUO8';
const supabase = createClient(supabaseUrl, supabaseKey);

const sessions = new Map();
const onlineUsers = new Set();
const groups = [];
const channels = [];

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Регистрация
  socket.on('register', async (data, cb) => {
    try {
      const { username, password } = data;
      if (!username || !password) return cb({ success: false, message: 'Fill fields' });

      const { data: existing } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (existing) return cb({ success: false, message: 'User exists' });

      const { error } = await supabase
        .from('users')
        .insert({ username, password_hash: password });

      if (error) {
        console.error('Register error:', error);
        return cb({ success: false, message: 'DB error' });
      }

      sessions.set(socket.id, username);
      onlineUsers.add(username);
      cb({ success: true, username });
      broadcastOnlineUsers();
      socket.emit('groups list', groups);
      socket.emit('channels list', channels);
    } catch (err) {
      console.error('Register exception:', err);
      cb({ success: false, message: 'Server error' });
    }
  });

  // Вход
  socket.on('login', async (data, cb) => {
    try {
      const { username, password } = data;

      const { data: user } = await supabase
        .from('users')
        .select('password_hash')
        .eq('username', username)
        .single();

      if (!user || user.password_hash !== password) {
        return cb({ success: false, message: 'Wrong credentials' });
      }

      if (onlineUsers.has(username)) {
        return cb({ success: false, message: 'Already online' });
      }

      sessions.set(socket.id, username);
      onlineUsers.add(username);
      cb({ success: true, username });
      broadcastOnlineUsers();
      socket.emit('groups list', groups);
      socket.emit('channels list', channels);
    } catch (err) {
      console.error('Login exception:', err);
      cb({ success: false, message: 'Server error' });
    }
  });

  // Остальные обработчики (без изменений)
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

  socket.on('join room', async (data) => {
    if (!data.room) return;
    socket.join(data.room);

    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('room', data.room)
        .order('id', { ascending: false })
        .limit(50);

      socket.emit('chat history', (messages || []).reverse());
    } catch (err) {
      console.error('History error:', err);
    }
  });

  socket.on('leave room', (data) => {
    if (data.room) socket.leave(data.room);
  });

  socket.on('chat message', async (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    try {
      await supabase.from('messages').insert({
        room: data.room,
        username: sender,
        text: data.text,
        time,
        reply_to: data.replyTo || null
      });
    } catch (err) {
      console.error('Message save error:', err);
    }

    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time,
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

  socket.on('change username', async (data, cb) => {
    try {
      const { oldUsername, newUsername } = data;
      if (!oldUsername || !newUsername) return cb({ success: false });

      const { data: existing } = await supabase
        .from('users')
        .select('username')
        .eq('username', newUsername)
        .single();

      if (existing) return cb({ success: false, message: 'Username taken' });

      await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('username', oldUsername);

      for (let [sid, user] of sessions) {
        if (user === oldUsername) sessions.set(sid, newUsername);
      }
      onlineUsers.delete(oldUsername);
      onlineUsers.add(newUsername);
      broadcastOnlineUsers();
      cb({ success: true });
    } catch (err) {
      console.error('Change username error:', err);
      cb({ success: false, message: 'Server error' });
    }
  });

  socket.on('change password', async (data, cb) => {
    try {
      const username = sessions.get(socket.id);
      if (!username) return cb({ success: false });

      const { data: user } = await supabase
        .from('users')
        .select('password_hash')
        .eq('username', username)
        .single();

      if (user.password_hash !== data.oldPassword) {
        return cb({ success: false, message: 'Wrong password' });
      }

      await supabase
        .from('users')
        .update({ password_hash: data.newPassword })
        .eq('username', username);

      cb({ success: true });
    } catch (err) {
      console.error('Change password error:', err);
      cb({ success: false, message: 'Server error' });
    }
  });

  socket.on('logout', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      broadcastOnlineUsers();
    }
  });

  socket.on('disconnect', () => {
    const username = sessions.get(socket.id);
    if (username) {
      sessions.delete(socket.id);
      onlineUsers.delete(username);
      broadcastOnlineUsers();
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
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
