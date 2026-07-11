const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ===== SUPABASE =====
const supabaseUrl = 'https://pecfhqthefjxfeokyzza.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY2ZocXRoZWZqeGZlb2t5enphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjQ0NTYsImV4cCI6MjA5OTE0MDQ1Nn0.TT8fPOoLiVx3GNx5XMtNJtHusefZWQRKM_hDxPJRUO8';
const supabase = createClient(supabaseUrl, supabaseKey);

const JWT_SECRET = 'danumes-secret-key-2026';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Создаем папку для загрузок
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// ===== ФУНКЦИЯ AUTHENTICATE =====
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();
    
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ========================================
// ===== АУТЕНТИФИКАЦИЯ =====
// ========================================

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const { data: existing } = await supabase
      .from('users')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password: hashedPassword,
        avatar: '👤',
        nickname: username,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/me', authenticate, async (req, res) => {
  res.json(req.user);
});

app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const { avatar, nickname, email, gender, description, visibility, theme } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('users')
      .update({
        avatar: avatar || req.user.avatar,
        nickname: nickname || req.user.nickname,
        email: email || req.user.email,
        gender: gender || req.user.gender,
        description: description || req.user.description,
        visibility: visibility || req.user.visibility,
        theme: theme || req.user.theme,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ===== ЧАТЫ =====
// ========================================

app.get('/api/chats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: chats, error } = await supabase
      .from('chats')
      .select(`
        *,
        messages:messages(
          id, content, sender_id, created_at, type, file_url,
          sender:sender_id(id, username, nickname, avatar)
        )
      `)
      .contains('participants', [userId])
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const formattedChats = await Promise.all(chats.map(async (chat) => {
      let chatData = { ...chat };
      
      if (chat.type === 'personal') {
        const otherUserId = chat.participants.find(id => id !== userId);
        if (otherUserId) {
          const { data: user } = await supabase
            .from('users')
            .select('id, username, nickname, avatar')
            .eq('id', otherUserId)
            .single();
          chatData.otherUser = user;
        }
      }

      if (chatData.messages) {
        chatData.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }

      return chatData;
    }));

    res.json({ success: true, chats: formattedChats });
  } catch (error) {
    console.error('Error loading chats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats', authenticate, async (req, res) => {
  try {
    const { type, participants, name } = req.body;
    const userId = req.user.id;

    if (type === 'personal') {
      const { data: existing } = await supabase
        .from('chats')
        .select('id')
        .contains('participants', [userId])
        .contains('participants', [participants[0]])
        .eq('type', 'personal')
        .maybeSingle();

      if (existing) {
        return res.json({ success: true, chatId: existing.id });
      }
    }

    const { data, error } = await supabase
      .from('chats')
      .insert({
        type,
        participants: type === 'personal' ? [userId, ...participants] : participants,
        name: name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, chat: data });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ===== СООБЩЕНИЯ =====
// ========================================

app.get('/api/messages/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, username, nickname, avatar)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, messages: data });
  } catch (error) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/messages', authenticate, async (req, res) => {
  try {
    const { chatId, content, type, fileUrl, replyTo } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content: content || '',
        type: type || 'text',
        file_url: fileUrl || null,
        reply_to: replyTo || null,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        sender:sender_id(id, username, nickname, avatar)
      `)
      .single();

    if (error) throw error;

    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    io.to(chatId).emit('new_message', data);

    res.json({ success: true, message: data });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/messages/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .update({
        content,
        edited: true,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('sender_id', userId)
      .select(`
        *,
        sender:sender_id(id, username, nickname, avatar)
      `)
      .single();

    if (error) throw error;

    io.to(data.chat_id).emit('message_edited', data);
    res.json({ success: true, message: data });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages/:messageId', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', userId)
      .select('chat_id')
      .single();

    if (error) throw error;

    io.to(data.chat_id).emit('message_deleted', messageId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ===== РЕАКЦИИ =====
// ========================================

app.post('/api/messages/:messageId/reactions', authenticate, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user.id;

    const { data: message } = await supabase
      .from('messages')
      .select('reactions')
      .eq('id', messageId)
      .single();

    let reactions = message.reactions || {};
    
    if (reactions[userId] === reaction) {
      delete reactions[userId];
    } else {
      reactions[userId] = reaction;
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ reactions })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;

    io.to(data.chat_id).emit('reaction_updated', {
      messageId,
      reactions: data.reactions
    });

    res.json({ success: true, reactions: data.reactions });
  } catch (error) {
    console.error('Error updating reaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ===== ЗАГРУЗКА ФАЙЛОВ =====
// ========================================

app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, fileUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use('/uploads', express.static('uploads'));

// ========================================
// ===== ДРУЗЬЯ =====
// ========================================

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

app.get('/api/friends', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        sender:user_id(id, username, nickname, avatar, email, gender, description, visibility),
        receiver:friend_id(id, username, nickname, avatar, email, gender, description, visibility)
      `)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) throw error;

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

// ========================================
// ===== SOCKET.IO =====
// ========================================

const userSockets = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('register', (userId) => {
    userSockets[userId] = socket.id;
    socket.join(userId);
    console.log(`User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`Socket ${socket.id} left chat ${chatId}`);
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('typing', {
      userId: data.userId,
      username: data.username
    });
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.chatId).emit('stop_typing', {
      userId: data.userId
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    for (const [userId, socketId] of Object.entries(userSockets)) {
      if (socketId === socket.id) {
        delete userSockets[userId];
        break;
      }
    }
  });
});

// ========================================
// ===== ЗАПУСК =====
// ========================================

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
