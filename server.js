const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const supabaseUrl = 'https://pecfhqthefjxfeokyzza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY2ZocXRoZWZqeGZlb2t5enphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjQ0NTYsImV4cCI6MjA5OTE0MDQ1Nn0.TT8fPOoLiVx3GNx5XMtNJtHusefZWQRKM_hDxPJRUO8';
const supabase = createClient(supabaseUrl, supabaseKey);

const sessions = new Map();
const onlineUsers = new Set();
const groups = [];
const channels = [];

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

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // ===== РЕГИСТРАЦИЯ =====
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

  // ===== ВХОД =====
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

  // ===== ОБНОВЛЕНИЕ ПРОФИЛЯ =====
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
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url; // эмодзи
    if (data.visibility_email !== undefined) updates.visibility_email = data.visibility_email;
    if (data.visibility_gender !== undefined) updates.visibility_gender = data.visibility_gender;
    if (data.visibility_bio !== undefined) updates.visibility_bio = data.visibility_bio;

    if (Object.keys(updates).length > 0) {
      updates.profile_setup_complete = true;
      const { error } = await supabase.from('users').update(updates).eq('username', username);
      if (error) return cb({ success: false, message: 'Update failed' });
      const { data: updatedUser } = await supabase.from('users').select('*').eq('username', username).single();
      cb({ success: true, profile: updatedUser });
    } else {
      cb({ success: false, message: 'No fields to update' });
    }
  });

  // ===== ПОЛУЧЕНИЕ ПРОФИЛЯ =====
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

  // ===== ОСТАЛЬНЫЕ ОБРАБОТЧИКИ (группы, каналы, сообщения, удаление, редактирование, реакции, выход) =====
  // (оставлены без изменений, полный код есть в предыдущих версиях)
  // ...
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
