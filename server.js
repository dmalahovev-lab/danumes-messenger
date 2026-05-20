const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== ТВОИ КЛЮЧИ SUPABASE (уже вставлены) =====
const SUPABASE_URL = 'https://uqlihmsrxmjeqlddztuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGlobXNyeG1qZXFsZGR6dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjQ3NTEsImV4cCI6MjA5NDg0MDc1MX0.NjTgmgL9SrW0taod0aEETjqe56BtyA7c8m7Hw_fyJu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Папка для временного хранения файлов (на Render)
const UPLOADS_DIR = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Настройка multer для загрузки файлов
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

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
// Функция для преобразования имен полей (supabase использует snake_case)
function toSnakeCase(obj) {
    if (!obj) return obj;
    const result = {};
    for (let key in obj) {
        if (key === 'from') result['from_user'] = obj[key];
        else if (key === 'to') result['to_user'] = obj[key];
        else if (key === 'fileUrl') result['file_url'] = obj[key];
        else if (key === 'fileName') result['file_name'] = obj[key];
        else if (key === 'channelId') result['channel_id'] = obj[key];
        else result[key] = obj[key];
    }
    return result;
}

function fromSnakeCase(obj) {
    if (!obj) return obj;
    const result = {};
    for (let key in obj) {
        if (key === 'from_user') result['from'] = obj[key];
        else if (key === 'to_user') result['to'] = obj[key];
        else if (key === 'file_url') result['fileUrl'] = obj[key];
        else if (key === 'file_name') result['fileName'] = obj[key];
        else if (key === 'channel_id') result['channelId'] = obj[key];
        else result[key] = obj[key];
    }
    return result;
}

// ========== API ==========

// Регистрация
app.post('/register-attempt', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    
    // Проверяем, существует ли пользователь
    const { data: existing } = await supabase.from('users').select('username').eq('username', username);
    if (existing && existing.length > 0) {
        return res.json({ success: false, error: 'Пользователь уже существует' });
    }
    
    // Создаём нового пользователя
    const { error } = await supabase.from('users').insert([{
        username,
        password,
        avatar: '👤',
        online: false,
        verified: false
    }]);
    
    if (error) return res.json({ success: false, error: 'Ошибка БД: ' + error.message });
    res.json({ success: true });
});

// Вход
app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    const { data, error } = await supabase
        .from('users')
        .select('username, avatar, verified')
        .eq('username', username)
        .eq('password', password);
    
    if (error || !data || data.length === 0) {
        return res.json({ success: false, error: 'Неверные имя или пароль' });
    }
    
    // Обновляем статус онлайн
    await supabase.from('users').update({ online: true }).eq('username', username);
    
    res.json({ success: true, username: data[0].username, avatar: data[0].avatar, verified: data[0].verified });
});

// Выход
app.post('/logout', async (req, res) => {
    const { username } = req.body;
    await supabase.from('users').update({ online: false }).eq('username', username);
    res.json({ success: true });
});

// Получить всех пользователей
app.get('/get-users', async (req, res) => {
    const { data } = await supabase.from('users').select('username, avatar, online, verified');
    res.json(data || []);
});

// Обновить аватар
app.post('/update-avatar', async (req, res) => {
    const { username, avatar } = req.body;
    await supabase.from('users').update({ avatar }).eq('username', username);
    res.json({ success: true, avatar });
});

// Отправить личное сообщение
app.post('/send-message', async (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    
    const newMsg = {
        id: Date.now(),
        from_user: from,
        to_user: to,
        text: text || '',
        file_url: fileUrl || null,
        file_name: fileName || null,
        timestamp: new Date().toISOString()
    };
    
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ success: true, message: fromSnakeCase(newMsg) });
});

// Получить историю диалога
app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`from_user.eq.${user1},and(to_user.eq.${user2})`)
        .or(`from_user.eq.${user2},and(to_user.eq.${user1})`)
        .order('id', { ascending: true });
    
    const messages = (data || []).map(m => fromSnakeCase(m));
    res.json(messages);
});

// Получить список чатов
app.get('/get-chats/:username', async (req, res) => {
    const { username } = req.params;
    
    // Получаем всех пользователей
    const { data: users } = await supabase.from('users').select('username, avatar, online, verified');
    
    // Получаем сообщения
    const { data: allMessages } = await supabase
        .from('messages')
        .select('*')
        .or(`from_user.eq.${username},to_user.eq.${username}`);
    
    const messages = (allMessages || []).map(m => fromSnakeCase(m));
    
    // Собираем уникальных собеседников
    const chatSet = new Set();
    messages.forEach(m => {
        if (m.from === username) chatSet.add(m.to);
        if (m.to === username) chatSet.add(m.from);
    });
    users.forEach(u => { if (u.username !== username) chatSet.add(u.username); });
    
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = messages.filter(m => (m.from === username && m.to === chatUsername) || (m.from === chatUsername && m.to === username))
            .sort((a,b) => b.id - a.id)[0];
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

// === КАНАЛЫ ===
app.get('/get-channels', async (req, res) => {
    const { data: channels } = await supabase.from('channels').select('*');
    res.json(channels || []);
});

app.get('/get-channel-messages/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const { data } = await supabase
        .from('channel_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('id', { ascending: true });
    
    const messages = (data || []).map(m => fromSnakeCase(m));
    res.json(messages);
});

app.post('/send-channel-message', async (req, res) => {
    const { channelId, from, text, fileUrl, fileName } = req.body;
    if (!channelId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    
    // Проверяем права (только владелец канала может писать)
    const { data: channel } = await supabase.from('channels').select('owner, only_owner_can_post').eq('id', channelId);
    if (channel && channel[0] && channel[0].only_owner_can_post && from !== channel[0].owner) {
        return res.status(403).json({ error: 'Только владелец канала может отправлять сообщения' });
    }
    
    const newMsg = {
        id: Date.now(),
        channel_id: channelId,
        from_user: from,
        text: text || '',
        file_url: fileUrl || null,
        file_name: fileName || null,
        timestamp: new Date().toISOString()
    };
    
    const { error } = await supabase.from('channel_messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    
    res.json({ success: true, message: fromSnakeCase(newMsg) });
});

// === ФАЙЛЫ И УДАЛЕНИЕ ===
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
    // Удаляем сообщение
    await supabase.from('messages').delete().eq('id', parseInt(id));
    res.json({ success: true });
});

app.delete('/delete-channel-message/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('channel_messages').delete().eq('id', parseInt(id));
    res.json({ success: true });
});

// Админ-панель для просмотра пользователей (только для Danumala)
app.get('/admin', async (req, res) => {
    const { data: users } = await supabase.from('users').select('username, password, avatar, verified');
    let html = '<h1>Пользователи DanuMes</h1><table border="1">服务<th>Логин</th><th>Пароль</th><th>Аватар</th><th>Верифицирован</th></tr>';
    users.forEach(u => {
        html += `<tr><td>${u.username}</td><td>${u.password}</td><td>${u.avatar}</td><td>${u.verified ? 'Да' : 'Нет'}</td></tr>`;
    });
    html += '</table><p><a href="/">Вернуться в чат</a></p>';
    res.send(html);
});

app.listen(PORT, () => console.log(`🚀 Сервер Supabase запущен на порту ${PORT}`));
