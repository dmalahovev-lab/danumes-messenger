const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const supabaseUrl = 'https://pecfhqthefjxfeokyzza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY2ZocXRoZWZqeGZlb2t5enphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjQ0NTYsImV4cCI6MjA5OTE0MDQ1Nn0.TT8fPOoLiVx3GNx5XMtNJtHusefZWQRKM_hDxPJRUO8';
const supabase = createClient(supabaseUrl, supabaseKey);

// VAPID ключи (замени на свои после генерации)
const vapidKeys = {
  publicKey: 'BOkPlPRoPshXFVmZQGRGZuUbnUbnUbnUbnUbnUbnUbnUbnUbnUbnUb',
  privateKey: 'твой_приватный_ключ'
};

webpush.setVapidDetails(
  'mailto:danumes@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const sessions = new Map();
const onlineUsers = new Set();
const groups = [];
const channels = [];
const pushSubscriptions = [];

async function loadGroups() {
  const { data } = await supabase.from('groups_table').select('*');
  if (data) groups.push(...data);
}
async function loadChannels() {
  const { data } = await supabase.from('channels_table').select('*');
  if (data) channels.push(...data);
}
loadGroups();
loadChannels();

function broadcastOnlineUsers() {
  io.emit('online users', Array.from(onlineUsers));
}

// Сохранение push-подписки
app.post('/api/save-subscription', (req, res) => {
  const subscription = req.body;
  if (subscription && subscription.endpoint) {
    const exists = pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      pushSubscriptions.push(subscription);
      console.log('Push подписка сохранена');
    }
  }
  res.json({ success: true });
});

// Отправка push-уведомлений
async function sendPushToAll(data) {
  for (const sub of pushSubscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(data));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        const idx = pushSubscriptions.indexOf(sub);
        if (idx !== -1) pushSubscriptions.splice(idx, 1);
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('auto_login', async (data, cb) => {
    try {
      const { token } = data;
      if (!token) return cb({ success: false });
      const { data: user } = await supabase.from('users').select('*').eq('username', token).single();
      if (!user) return cb({ success: false });
      if (onlineUsers.has(token)) {
        sessions.set(socket.id, token);
        cb({ success: true, username: token, profile: user });
        socket.emit('groups list', groups);
        socket.emit('channels list', channels);
        return;
      }
      sessions.set(socket.id, token);
      onlineUsers.add(token);
      cb({ success: true, username: token, profile: user });
      broadcastOnlineUsers();
      socket.emit('groups list', groups);
      socket.emit('channels list', channels);
    } catch (err) {
      cb({ success: false });
    }
  });

  socket.on('register', async (data, cb) => {
    try {
      const { username, password } = data;
      if (!username || !password) return cb({ success: false, message: 'Fill fields' });
      if (username.length > 15) return cb({ success: false, message: 'Max 15 symbols' });
      const { data: existing } = await supabase.from('users').select('username').eq('username', username).single();
      if (existing) return cb({ success: false, message: 'User exists' });

      const { error } = await supabase.from('users').insert({
        username,
        password_hash: password,
        display_name: username,
        username_alias: username,
        profile_setup_complete: false,
        visibility_email: true,
        visibility_gender: true,
        visibility_bio: true
      });
      if (error) return cb({ success: false, message: 'DB error' });

      sessions.set(socket.id, username);
      onlineUsers.add(username);
      cb({ success: true, username });
      broadcastOnlineUsers();
      socket.emit('groups list', groups);
      socket.emit('channels list', channels);
    } catch (err) {
      cb({ success: false, message: 'Server error' });
    }
  });

  socket.on('login', async (data, cb) => {
    try {
      const { username, password } = data;
      const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
      if (!user || user.password_hash !== password) return cb({ success: false, message: 'Wrong credentials' });
      if (onlineUsers.has(username)) return cb({ success: false, message: 'Already online' });

      sessions.set(socket.id, username);
      onlineUsers.add(username);
      cb({ success: true, username, profile: user });
      broadcastOnlineUsers();
      socket.emit('groups list', groups);
      socket.emit('channels list', channels);
    } catch (err) {
      cb({ success: false, message: 'Server error' });
    }
  });

  socket.on('update_profile', async (data, cb) => {
    const username = sessions.get(socket.id);
    if (!username) return cb({ success: false, message: 'Not authorized' });

    const updates = {};
    if (data.display_name !== undefined) updates.display_name = data.display_name;
    if (data.username_alias !== undefined) {
      if (!/^[a-zA-Z0-9_]+$/.test(data.username_alias)) return cb({ success: false, message: 'Alias must be English letters, numbers or underscore' });
      const { data: existing } = await supabase.from('users').select('username').eq('username_alias', data.username_alias).single();
      if (existing && existing.username !== username) return cb({ success: false, message: 'Alias taken' });
      updates.username_alias = data.username_alias;
    }
    if (data.email !== undefined) updates.email = data.email;
    if (data.gender !== undefined) updates.gender = data.gender;
    if (data.bio !== undefined) updates.bio = data.bio;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url;
    if (data.visibility_email !== undefined) updates.visibility_email = data.visibility_email;
    if (data.visibility_gender !== undefined) updates.visibility_gender = data.visibility_gender;
    if (data.visibility_bio !== undefined) updates.visibility_bio = data.visibility_bio;

    if (Object.keys(updates).length > 0) {
      updates.profile_setup_complete = true;
      const { error } = await supabase.from('users').update(updates).eq('username', username);
      if (error) return cb({ success: false, message: 'Update failed' });
      const { data: updatedUser } = await supabase.from('users').select('*').eq('username', username).single();

      io.emit('user_profile_updated', {
        username: updatedUser.username,
        display_name: updatedUser.display_name,
        avatar_url: updatedUser.avatar_url
      });

      cb({ success: true, profile: updatedUser });
    } else {
      cb({ success: false, message: 'No fields to update' });
    }
  });

  socket.on('get_user_profile', async (data, cb) => {
    const { username } = data;
    const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
    if (!user) return cb({ success: false });

    const publicProfile = {
      display_name: user.display_name,
      username_alias: user.username_alias,
      avatar_url: user.avatar_url,
      bio: user.visibility_bio ? user.bio : null,
      email: user.visibility_email ? user.email : null,
      gender: user.visibility_gender ? user.gender : null,
    };
    cb({ success: true, profile: publicProfile });
  });

  socket.on('create group', async (data, cb) => {
    const admin = sessions.get(socket.id);
    if (!admin) return cb({ success: false });
    const members = [admin, ...data.members];
    const room = 'group_' + Date.now();
    const group = { name: data.name, room, members, admin, type: 'group' };
    await supabase.from('groups_table').insert({ name: data.name, room, members, admin, type: 'group' });
    groups.push(group);
    socket.join(room);
    io.emit('groups list', groups);
    cb({ success: true });
  });

  socket.on('create channel', async (data, cb) => {
    const admin = sessions.get(socket.id);
    if (!admin) return cb({ success: false });
    const room = 'channel_' + Date.now();
    const channel = { name: data.name, room, subscribers: [admin], admin, type: 'channel' };
    await supabase.from('channels_table').insert({ name: data.name, room, subscribers: [admin], admin, type: 'channel' });
    channels.push(channel);
    socket.join(room);
    io.emit('channels list', channels);
    cb({ success: true });
  });

  socket.on('join room', async (data) => {
    if (!data.room) return;
    socket.join(data.room);
    try {
      const { data: messages } = await supabase.from('messages').select('*').eq('room', data.room).order('id', { ascending: false }).limit(50);
      socket.emit('chat history', (messages || []).reverse());
    } catch (err) {}
  });

  socket.on('leave room', (data) => { if (data.room) socket.leave(data.room); });

  socket.on('chat message', async (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;
    const channel = channels.find(c => c.room === data.room);
    if (channel && channel.admin !== sender) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        room: data.room,
        username: sender,
        text: data.text,
        time: time,
        reply_to: data.replyTo || null
      })
      .select('id')
      .single();

    const realId = inserted?.id || data.id;

    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time: time,
      id: realId,
      replyTo: data.replyTo
    });

    // Отправляем push-уведомления
    sendPushToAll({
      title: `Новое сообщение от ${sender}`,
      body: data.text.substring(0, 100),
      url: '/'
    });
  });

  socket.on('edit message', async (data) => {
    if (!data.room || !data.id || !data.text) return;
    const { error } = await supabase.from('messages').update({ text: data.text }).eq('id', data.id);
    if (!error) {
      io.to(data.room).emit('edit message', { id: data.id, text: data.text, user: sessions.get(socket.id) });
    }
  });

  socket.on('delete message', async (data) => {
    if (!data.room || !data.id) return;
    await supabase.from('messages').delete().eq('id', data.id);
    io.to(data.room).emit('delete message', { id: data.id });
  });

  socket.on('reaction', (data) => { if (data.room) io.to(data.room).emit('reaction', { id: data.id, emoji: data.emoji }); });

  socket.on('change password', async (data, cb) => {
    const username = sessions.get(socket.id);
    if (!username) return cb({ success: false });
    const { data: user } = await supabase.from('users').select('password_hash').eq('username', username).single();
    if (!user || user.password_hash !== data.oldPassword) return cb({ success: false, message: 'Wrong password' });
    await supabase.from('users').update({ password_hash: data.newPassword }).eq('username', username);
    cb({ success: true });
  });

  socket.on('logout', () => {
    const username = sessions.get(socket.id);
    if (username) { sessions.delete(socket.id); onlineUsers.delete(username); broadcastOnlineUsers(); }
  });

  socket.on('disconnect', () => {
    const username = sessions.get(socket.id);
    if (username) { sessions.delete(socket.id); onlineUsers.delete(username); broadcastOnlineUsers(); }
  });

  socket.on('request online users', () => socket.emit('online users', Array.from(onlineUsers)));
  socket.on('request all users', async () => {
    const { data } = await supabase.from('users').select('username, display_name, avatar_url');
    socket.emit('all users', data || []);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
