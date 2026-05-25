const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://uqlihmsrxmjeqlddztuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGlobXNyeG1qZXFsZGR6dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjQ3NTEsImV4cCI6MjA5NDg0MDc1MX0.NjTgmgL9SrW0taod0aEETjqe56BtyA7c8m7Hw_fyJu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UPLOADS_DIR = '/tmp/uploads';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

// ========== ПОЛЬЗОВАТЕЛИ ==========
app.post('/register-attempt', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    const { data: existing } = await supabase.from('users').select('username').eq('username', username);
    if (existing && existing.length) return res.json({ success: false, error: 'Пользователь уже существует' });
    const { error } = await supabase.from('users').insert([{ username, password, avatar: '👤', online: false, verified: false }]);
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true });
});

app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    const { data } = await supabase.from('users').select('username, avatar, verified').eq('username', username).eq('password', password);
    if (!data || data.length === 0) return res.json({ success: false, error: 'Неверные имя или пароль' });
    await supabase.from('users').update({ online: true }).eq('username', username);
    res.json({ success: true, username: data[0].username, avatar: data[0].avatar, verified: data[0].verified });
});

app.get('/get-users', async (req, res) => {
    const { data } = await supabase.from('users').select('username, avatar, online, verified');
    res.json(data || []);
});

app.post('/update-avatar', async (req, res) => {
    const { username, avatar } = req.body;
    await supabase.from('users').update({ avatar }).eq('username', username);
    res.json({ success: true, avatar });
});

app.post('/update-username', async (req, res) => {
    const { oldUsername, newUsername } = req.body;
    if (!oldUsername || !newUsername) return res.status(400).json({ error: 'Недостаточно данных' });
    const { data: existing } = await supabase.from('users').select('username').eq('username', newUsername);
    if (existing && existing.length) return res.status(400).json({ error: 'Имя уже занято' });
    await supabase.from('users').update({ username: newUsername }).eq('username', oldUsername);
    res.json({ success: true, newUsername });
});

// ========== ЛИЧНЫЕ СООБЩЕНИЯ ==========
app.post('/send-message', async (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    console.log('📨 Отправка:', { from, to, text });
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const newMsg = {
        id: Date.now(),
        from_user: from,
        to_user: to,
        text: text || '',
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date().toISOString()
    };
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) {
        console.error('❌ Ошибка Supabase:', error);
        return res.status(500).json({ error: error.message });
    }
    console.log('✅ Сообщение сохранено, id:', newMsg.id);
    res.json({ success: true, message: newMsg });
});

// ТВОЙ РАБОЧИЙ ЗАПРОС
app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    console.log(`📥 Запрос сообщений между ${user1} и ${user2}`);
    
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .filter('from_user', 'in', `(${user1},${user2})`)
        .filter('to_user', 'in', `(${user1},${user2})`)
        .order('id', { ascending: true });
    
    if (error) {
        console.error('❌ Ошибка получения:', error);
        return res.status(500).json({ error: error.message });
    }
    
    console.log(`📦 Найдено сообщений: ${data?.length || 0}`);
    res.json(data || []);
});

app.get('/get-chats/:username', async (req, res) => {
    const { username } = req.params;
    const { data: users } = await supabase.from('users').select('username, avatar, online, verified');
    const { data: messages } = await supabase.from('messages').select('*').or(`from_user.eq.${username},to_user.eq.${username}`);
    
    const chatSet = new Set();
    (messages || []).forEach(m => {
        if (m.from_user === username) chatSet.add(m.to_user);
        if (m.to_user === username) chatSet.add(m.from_user);
    });
    users.forEach(u => { if (u.username !== username) chatSet.add(u.username); });
    
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = (messages || []).filter(m => (m.from_user === username && m.to_user === chatUsername) || (m.from_user === chatUsername && m.to_user === username)).sort((a,b) => b.id - a.id)[0];
        return {
            username: chatUsername,
            avatar: user ? user.avatar : '👤',
            online: user ? user.online : false,
            verified: user ? user.verified : false,
            lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений',
            lastTime: lastMsg ? lastMsg.timestamp : null
        };
    });
    chatList.sort((a,b) => (b.lastTime || 0) - (a.lastTime || 0));
    res.json(chatList);
});

// ========== ФАЙЛЫ ==========
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    res.json({ success: true, fileUrl: `/file/${req.file.filename}`, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.delete('/delete-message/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('messages').delete().eq('id', parseInt(id));
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
