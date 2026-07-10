const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
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

  // ===== АВТО-ВХОД =====
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

  // ===== РЕГИСТРАЦИЯ =====
  socket.on('register', async (data, cb) => {
    try {
      const { username, password } = data;
      if (!username || !password) return cb({ success: false, message: 'Fill fields' });
      if (username.length > 15) return cb({ success: false, message: 'Max 15 symbols' });
      if (/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(username)) {
  return cb({ success: false, message: 'No emoji allowed in username' });
}
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
        visibility_bio: true,
        verified: false
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
        avatar_url: updatedUser.avatar_url,
        verified: updatedUser.verified
      });

      cb({ success: true, profile: updatedUser });
    } else {
      cb({ success: false, message: 'No fields to update' });
    }
  });

  // ===== ВЕРИФИКАЦИЯ ПОЛЬЗОВАТЕЛЯ (только для админов) =====
  socket.on('verify_user', async (data, cb) => {
    const admin = sessions.get(socket.id);
    // Здесь можно добавить проверку на админа
    if (!admin) return cb({ success: false, message: 'Not authorized' });

    const { username, verified } = data;
    const { error } = await supabase
      .from('users')
      .update({ verified: verified })
      .eq('username', username);

    if (error) return cb({ success: false, message: 'Update failed' });

    io.emit('user_verified', { username, verified });
    cb({ success: true });
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
      verified: user.verified
    };
    cb({ success: true, profile: publicProfile });
  });

  // ===== ГРУППЫ И КАНАЛЫ =====
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

  // ===== СООБЩЕНИЯ =====
  socket.on('chat message', async (data) => {
    const sender = sessions.get(socket.id);
    if (!sender || !data.room || !data.text) return;
    const channel = channels.find(c => c.room === data.room);
    if (channel && channel.admin !== sender) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const { data: inserted } = await supabase
      .from('messages')
      .insert({ room: data.room, username: sender, text: data.text, time, reply_to: data.replyTo || null })
      .select('id').single();

    io.to(data.room).emit('chat message', {
      user: sender,
      text: data.text,
      time,
      id: inserted?.id || data.id,
      replyTo: data.replyTo
    });
  });

  socket.on('edit message', async (data) => {
    if (!data.room || !data.id || !data.text) return;
    await supabase.from('messages').update({ text: data.text }).eq('id', data.id);
    io.to(data.room).emit('edit message', { id: data.id, text: data.text, user: sessions.get(socket.id) });
  });

  socket.on('delete message', async (data) => {
    if (!data.room || !data.id) return;
    await supabase.from('messages').delete().eq('id', data.id);
    io.to(data.room).emit('delete message', { id: data.id });
  });

  socket.on('reaction', (data) => {
    if (data.room) io.to(data.room).emit('reaction', { id: data.id, emoji: data.emoji });
  });

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
    const { data } = await supabase.from('users').select('username, display_name, avatar_url, verified');
    socket.emit('all users', data || []);
  });
});

// ===== ДРУЗЬЯ =====

// Отправить заявку в друзья
app.post('/api/friends/request', authenticate, async (req, res) => {
  try {
    const { friendId } = req.body;
    const userId = req.user.id;

    if (!friendId) {
      return res.status(400).json({ error: 'friendId is required' });
    }

    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot add yourself as friend' });
    }

    // Проверяем, не существует ли уже запись
    const { data: existing } = await supabase
      .from('friends')
      .select('status')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ error: 'Friend request already sent' });
      }
    }

    // Создаем заявку
    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Отправляем уведомление через Socket.IO
    const friendSocketId = userSockets[friendId];
    if (friendSocketId) {
      io.to(friendSocketId).emit('friend_request', {
        id: data.id,
        userId: userId,
        username: req.user.username,
        nickname: req.user.nickname,
        avatar: req.user.avatar,
        createdAt: data.created_at
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Принять заявку в друзья
app.post('/api/friends/accept', authenticate, async (req, res) => {
  try {
    const { requestId } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('friends')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('friend_id', userId)
      .select(`
        *,
        sender:user_id(id, username, nickname, avatar, email),
        receiver:friend_id(id, username, nickname, avatar, email)
      `)
      .single();

    if (error) throw error;

    // Уведомляем отправителя
    const senderSocketId = userSockets[data.user_id];
    if (senderSocketId) {
      io.to(senderSocketId).emit('friend_accepted', {
        requestId: requestId,
        userId: userId,
        username: req.user.username,
        nickname: req.user.nickname,
        avatar: req.user.avatar
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отклонить заявку в друзья
app.post('/api/friends/reject', authenticate, async (req, res) => {
  try {
    const { requestId } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('friends')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('friend_id', userId)
      .select()
      .single();

    if (error) throw error;

    // Уведомляем отправителя
    const senderSocketId = userSockets[data.user_id];
    if (senderSocketId) {
      io.to(senderSocketId).emit('friend_rejected', {
        requestId: requestId,
        userId: userId
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить список друзей и заявок
app.get('/api/friends', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Получаем все связи пользователя
    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        sender:user_id(id, username, nickname, avatar, email, gender, description, visibility),
        receiver:friend_id(id, username, nickname, avatar, email, gender, description, visibility)
      `)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) throw error;

    // Форматируем данные
    const friends = [];
    const pendingRequests = [];
    const sentRequests = [];

    data.forEach(item => {
      const isSender = item.user_id === userId;
      const otherUser = isSender ? item.receiver : item.sender;

      if (item.status === 'accepted') {
        friends.push({
          id: item.id,
          userId: otherUser.id,
          username: otherUser.username,
          nickname: otherUser.nickname,
          avatar: otherUser.avatar,
          email: otherUser.email,
          gender: otherUser.gender,
          description: otherUser.description,
          visibility: otherUser.visibility,
          createdAt: item.created_at
        });
      } else if (item.status === 'pending' && !isSender) {
        pendingRequests.push({
          id: item.id,
          userId: otherUser.id,
          username: otherUser.username,
          nickname: otherUser.nickname,
          avatar: otherUser.avatar,
          createdAt: item.created_at
        });
      } else if (item.status === 'pending' && isSender) {
        sentRequests.push({
          id: item.id,
          userId: otherUser.id,
          username: otherUser.username,
          nickname: otherUser.nickname,
          avatar: otherUser.avatar,
          createdAt: item.created_at
        });
      }
    });

    res.json({
      success: true,
      friends,
      pendingRequests,
      sentRequests
    });
  } catch (error) {
    console.error('Error getting friends:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить из друзей
app.delete('/api/friends/:friendId', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    const { error } = await supabase
      .from('friends')
      .delete()
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .or(`user_id.eq.${friendId},friend_id.eq.${friendId}`)
      .eq('status', 'accepted');

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ error: error.message });
  }
});

// Проверить статус дружбы
app.get('/api/friends/status/:userId', authenticate, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    const { data, error } = await supabase
      .from('friends')
      .select('status, id, user_id, friend_id')
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
      .or(`user_id.eq.${targetUserId},friend_id.eq.${targetUserId}`)
      .maybeSingle();

    if (error) throw error;

    let status = 'none';
    let requestId = null;
    let isSender = false;

    if (data) {
      status = data.status;
      requestId = data.id;
      isSender = data.user_id === currentUserId;
    }

    res.json({
      success: true,
      status,
      requestId,
      isSender
    });
  } catch (error) {
    console.error('Error checking friend status:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
