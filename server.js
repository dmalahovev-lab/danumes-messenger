const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Замени на свои данные из Supabase
const SUPABASE_URL = 'https://ozlpszhrmkyolaviqyxp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96bHBzemhybWt5b2xhdmlxeXhwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIwOTE1NCwiZXhwIjoyMDk0Nzg1MTU0fQ.P6t7GVHCLuMsxQH3E_qFr930YFa4d4pU40ov1g4yB4w';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Хранилище для файлов (временное, но можно сразу загружать в Supabase Storage)
const UPLOADS_DIR = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, 'uploads');
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

// === Вспомогательные функции ===
async function query(sql, params = []) {
    const { data, error } = await supabase.rpc('exec_sql', { sql, params }); // Но RPC exec_sql требует настройки. Проще использовать прямые запросы.
    // Лучше использовать супрабазовские методы. Давай перепишем API напрямую:
}

// На самом деле для Supabase проще использовать их JS клиент без сырых SQL. Я перепишу все эндпоинты.

// === API с Supabase ===

// Регистрация
app.post('/register-attempt', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    const { data: existing } = await supabase.from('users').select('username').eq('username', username);
    if (existing.length) return res.json({ success: false, error: 'Пользователь уже существует' });
    const { error } = await supabase.from('users').insert([{ username, password, avatar: '👤' }]);
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true });
});

// Вход
app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    const { data, error } = await supabase.from('users').select('username, avatar, verified').eq('username', username).eq('password', password);
    if (error || !data.length) return res.json({ success: false, error: 'Неверные имя или пароль' });
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
    res.json(data);
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
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date()
    };
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: newMsg });
});

// Получить историю диалога
app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(from_user.eq.${user1},to_user.eq.${user2}),and(from_user.eq.${user2},to_user.eq.${user1})`)
        .order('id', { ascending: true });
    res.json(data);
});

// Получить список чатов (для пользователя)
app.get('/get-chats/:username', async (req, res) => {
    const { username } = req.params;
    // Получаем все сообщения где участвует пользователь
    const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .or(`from_user.eq.${username},to_user.eq.${username}`);
    const { data: users } = await supabase.from('users').select('username, avatar, online, verified');
    const chatSet = new Set();
    messages.forEach(m => {
        if (m.from_user === username) chatSet.add(m.to_user);
        if (m.to_user === username) chatSet.add(m.from_user);
    });
    users.forEach(u => { if (u.username !== username) chatSet.add(u.username); });
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = messages.filter(m => (m.from_user === username && m.to_user === chatUsername) || (m.from_user === chatUsername && m.to_user === username))
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

// === Каналы ===
app.get('/get-channels', async (req, res) => {
    const { data: channels } = await supabase.from('channels').select('*');
    const { data: channelMsgs } = await supabase.from('channel_messages').select('*');
    const result = channels.map(ch => {
        const lastMsg = channelMsgs.filter(m => m.channel_id === ch.id).sort((a,b) => b.id - a.id)[0];
        return { ...ch, lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений', lastTime: lastMsg ? lastMsg.timestamp : null };
    });
    res.json(result);
});

app.get('/get-channel-messages/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const { data } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('id', { ascending: true });
    res.json(data);
});

app.post('/send-channel-message', async (req, res) => {
    const { channelId, from, text, fileUrl, fileName } = req.body;
    if (!channelId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const { data: channel } = await supabase.from('channels').select('owner, only_owner_can_post').eq('id', channelId);
    if (channel.length && channel[0].only_owner_can_post && from !== channel[0].owner) {
        return res.status(403).json({ error: 'Только владелец канала может отправлять сообщения' });
    }
    const newMsg = {
        id: Date.now(),
        channel_id: channelId,
        from_user: from,
        text: text || '',
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date()
    };
    const { error } = await supabase.from('channel_messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: newMsg });
});

// === Удаление ===
app.delete('/delete-message/:id', async (req, res) => {
    const { id } = req.params;
    const { data: msg } = await supabase.from('messages').select('file_url').eq('id', id);
    if (msg && msg[0] && msg[0].file_url) {
        const fileName = msg[0].file_url.replace('/file/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await supabase.from('messages').delete().eq('id', id);
    res.json({ success: true });
});

app.delete('/delete-channel-message/:id', async (req, res) => {
    const { id } = req.params;
    const { data: msg } = await supabase.from('channel_messages').select('file_url').eq('id', id);
    if (msg && msg[0] && msg[0].file_url) {
        const fileName = msg[0].file_url.replace('/file/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await supabase.from('channel_messages').delete().eq('id', id);
    res.json({ success: true });
});

// === Файлы ===
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const fileUrl = `/file/${req.file.filename}`;
    res.json({ success: true, fileUrl, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.listen(PORT, () => console.log(`🚀 Сервер на Supabase запущен на порту ${PORT}`));
