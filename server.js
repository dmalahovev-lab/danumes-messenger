const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Хранилище в памяти
let users = [
    { username: 'Danumala', password: 'danyajukovka', avatar: '👑', online: false, verified: true },
    { username: 'RunFly', password: 'GGWWXXJJ2001', avatar: '🚀', online: false, verified: true }
];
let messages = [];
let channels = [{ id: 'news', name: 'Danumes News', owner: 'Danumala', avatar: '📢', onlyOwnerCanPost: true }];
let channelMessages = [];

// Multer для файлов
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

// ========== API ==========

app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Пользователь уже существует' });
    users.push({ username, password, avatar: '👤', online: false, verified: false });
    console.log('Новый пользователь:', username);
    res.json({ success: true });
});

app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        user.online = true;
        res.json({ success: true, username: user.username, avatar: user.avatar, verified: user.verified });
    } else {
        res.json({ success: false, error: 'Неверные имя или пароль' });
    }
});

app.post('/logout', (req, res) => {
    const { username } = req.body;
    const user = users.find(u => u.username === username);
    if (user) user.online = false;
    res.json({ success: true });
});

app.get('/get-users', (req, res) => {
    res.json(users.map(({ username, avatar, online, verified }) => ({ username, avatar, online, verified })));
});

app.post('/update-avatar', (req, res) => {
    const { username, avatar } = req.body;
    const user = users.find(u => u.username === username);
    if (user) user.avatar = avatar;
    res.json({ success: true, avatar });
});

app.post('/send-message', (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const newMsg = {
        id: Date.now(),
        from,
        to,
        text: text || '',
        timestamp: new Date().toISOString(),
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    messages.push(newMsg);
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    const dialog = messages.filter(m => (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1)).sort((a,b) => a.id - b.id);
    res.json(dialog);
});

app.get('/get-chats/:username', (req, res) => {
    const { username } = req.params;
    const chatSet = new Set();
    messages.forEach(m => {
        if (m.from === username) chatSet.add(m.to);
        if (m.to === username) chatSet.add(m.from);
    });
    users.forEach(u => { if (u.username !== username) chatSet.add(u.username); });
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = messages.filter(m => (m.from === username && m.to === chatUsername) || (m.from === chatUsername && m.to === username)).sort((a,b) => b.id - a.id)[0];
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

app.get('/get-channels', (req, res) => {
    const result = channels.map(ch => {
        const lastMsg = channelMessages.filter(m => m.channelId === ch.id).sort((a,b) => b.id - a.id)[0];
        return { ...ch, lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений', lastTime: lastMsg ? lastMsg.timestamp : null };
    });
    res.json(result);
});

app.get('/get-channel-messages/:channelId', (req, res) => {
    const { channelId } = req.params;
    res.json(channelMessages.filter(m => m.channelId === channelId).sort((a,b) => a.id - b.id));
});

app.post('/send-channel-message', (req, res) => {
    const { channelId, from, text, fileUrl, fileName } = req.body;
    if (!channelId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const channel = channels.find(c => c.id === channelId);
    if (channel.onlyOwnerCanPost && from !== channel.owner) {
        return res.status(403).json({ error: 'Только владелец канала может отправлять сообщения' });
    }
    const newMsg = {
        id: Date.now(),
        channelId,
        from,
        text: text || '',
        timestamp: new Date().toISOString(),
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    channelMessages.push(newMsg);
    res.json({ success: true, message: newMsg });
});

app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    res.json({ success: true, fileUrl: `/file/${req.file.filename}`, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.delete('/delete-message/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = messages.findIndex(m => m.id === id);
    if (index !== -1) messages.splice(index, 1);
    res.json({ success: true });
});

app.delete('/delete-channel-message/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = channelMessages.findIndex(m => m.id === id);
    if (index !== -1) channelMessages.splice(index, 1);
    res.json({ success: true });
});

// Добавим временный эндпоинт для просмотра пользователей (только для разработки)
app.get('/admin/users', (req, res) => {
    res.json(users.map(u => ({ username: u.username, password: u.password, avatar: u.avatar, verified: u.verified })));
});

app.listen(PORT, () => {
    console.log(`✅ Сервер успешно запущен на порту ${PORT}`);
    console.log(`📊 Всего пользователей: ${users.length}`);
});
