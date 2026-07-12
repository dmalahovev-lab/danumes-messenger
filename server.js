const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
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

// ===== AUTHENTICATE =====
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

// ===== РЕГИСТРАЦИЯ =====
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
        username: username,
        email: email,
        password_hash: hashedPassword,
        display_name: username,
        avatar_url: '👤',
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

// ===== ЛОГИН =====
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

    const isValid = await bcrypt.compare(password, user.password_hash);
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

// ===== ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЯ =====
app.get('/api/me', authenticate, async (req, res) => {
  res.json(req.user);
});

// ===== ОБНОВИТЬ ПРОФИЛЬ =====
app.put('/api/profile', authenticate, async (req, res) => {
  try {
    const { avatar_url, display_name, bio, theme } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (display_name !== undefined) updateData.display_name = display_name;
    if (bio !== undefined) updateData.bio = bio;
    if (theme !== undefined) updateData.theme = theme;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
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

// ===== ПОИСК ПОЛЬЗОВАТЕЛЕЙ =====
app.get('/api/search/users', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    const userId = req.user.id;

    if (!query || query.length < 1) {
      return res.json({ success: true, users: [] });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('id', userId)
      .limit(20);

    if (error) throw error;

    res.json({ success: true, users: data });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ЧАТЫ =====
app.get('/api/chats', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .contains('participants', [userId])
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const formattedChats = await Promise.all(chats.map(async (chat) => {
      let chatData = { ...chat, messages: [] };
      
      if (chat.type === 'personal') {
        const otherUserId = chat.participants.find(id => id !== userId);
        if (otherUserId) {
          const { data: user } = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url')
            .eq('id', otherUserId)
            .single();
          chatData.otherUser = user;
        }
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

// ===== СООБЩЕНИЯ =====
app.get('/api/messages/:chatId', authenticate, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:sender_id(id, username, display_name, avatar_url)
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
    const { chatId, content, type, fileUrl } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: userId,
        content: content || '',
        type: type || 'text',
        file_url: fileUrl || null,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        sender:sender_id(id, username, display_name, avatar_url)
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

// ===== ЗАГРУЗКА ФАЙЛОВ =====
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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

// ===== SOCKET.IO =====
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

// ===== ЗАПУСК =====
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
