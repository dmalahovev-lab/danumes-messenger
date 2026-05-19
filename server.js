const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.RENDER ? '/tmp/data' : path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const CHANNEL_MSGS_FILE = path.join(DATA_DIR, 'channel_messages.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function readJSON(file, def = []) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return def; }
}
function writeJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch(e) { console.error(e); }
}

// Инициализация файлов
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(MESSAGES_FILE)) writeJSON(MESSAGES_FILE, []);
if (!fs.existsSync(CHANNELS_FILE)) writeJSON(CHANNELS_FILE, []);
if (!fs.existsSync(CHANNEL_MSGS_FILE)) writeJSON(CHANNEL_MSGS_FILE, []);

// Системные пользователи с верификацией
const SYSTEM_USERS = [
    { username: 'Danumala', password: 'danyajukovka', avatar: '👑', online: false, verified: true },
    { username: 'RunFly', password: 'GGWWXXJJ2001', avatar: '🚀', online: false, verified: true }
];
let users = readJSON(USERS_FILE, []);
SYSTEM_USERS.forEach(sys => {
    if (!users.find(u => u.username === sys.username)) users.push(sys);
});
writeJSON(USERS_FILE, users);

// Каналы
let channels = readJSON(CHANNELS_FILE, []);
if (!channels.find(c => c.id === 'news')) {
    channels.push({
        id: 'news',
        name: 'Danumes News',
        owner: 'Danumala',
        avatar: '📢',
        onlyOwnerCanPost: true
    });
    writeJSON(CHANNELS_FILE, channels);
}

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
app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    let users = readJSON(USERS_FILE, []);
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Пользователь уже существует' });
    users.push({ username, password, avatar: '👤', online: false, verified: false });
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        user.online = true;
        writeJSON(USERS_FILE, users);
        res.json({ success: true, username: user.username, avatar: user.avatar, verified: user.verified });
    } else {
        res.json({ success: false, error: 'Неверные имя или пароль' });
    }
});

app.post('/logout', (req, res) => {
    const { username } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username);
    if (user) user.online = false;
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.get('/get-users', (req, res) => {
    let users = readJSON(USERS_FILE, []);
    res.json(users.map(({ username, avatar, online, verified }) => ({ username, avatar, online, verified })));
});

app.post('/update-avatar', (req, res) => {
    const { username, avatar } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username);
    if (user) {
        user.avatar = avatar;
        writeJSON(USERS_FILE, users);
        res.json({ success: true, avatar });
    } else {
        res.json({ success: false, error: 'Пользователь не найден' });
    }
});

// ========== ЛИЧНЫЕ СООБЩЕНИЯ ==========
app.post('/send-message', (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    let messages = readJSON(MESSAGES_FILE, []);
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
    writeJSON(MESSAGES_FILE, messages);
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    let messages = readJSON(MESSAGES_FILE, []);
    const dialog = messages.filter(m => 
        (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1)
    ).sort((a,b) => a.id - b.id);
    res.json(dialog);
});

app.get('/get-chats/:username', (req, res) => {
    const { username } = req.params;
    let messages = readJSON(MESSAGES_FILE, []);
    let users = readJSON(USERS_FILE, []);
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

// ========== КАНАЛЫ ==========
app.get('/get-channels', (req, res) => {
    let channels = readJSON(CHANNELS_FILE, []);
    let channelMsgs = readJSON(CHANNEL_MSGS_FILE, []);
    const result = channels.map(ch => {
        const lastMsg = channelMsgs.filter(m => m.channelId === ch.id).sort((a,b) => b.id - a.id)[0];
        return {
            ...ch,
            lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений',
            lastTime: lastMsg ? lastMsg.timestamp : null
        };
    });
    res.json(result);
});

app.get('/get-channel-messages/:channelId', (req, res) => {
    const { channelId } = req.params;
    let messages = readJSON(CHANNEL_MSGS_FILE, []);
    const channelMsgs = messages.filter(m => m.channelId === channelId).sort((a,b) => a.id - b.id);
    res.json(channelMsgs);
});

app.post('/send-channel-message', (req, res) => {
    const { channelId, from, text, fileUrl, fileName } = req.body;
    if (!channelId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    let channels = readJSON(CHANNELS_FILE, []);
    const channel = channels.find(c => c.id === channelId);
    if (channel.onlyOwnerCanPost && from !== channel.owner) {
        return res.status(403).json({ error: 'Только владелец канала может отправлять сообщения' });
    }
    let messages = readJSON(CHANNEL_MSGS_FILE, []);
    const newMsg = {
        id: Date.now(),
        channelId,
        from,
        text: text || '',
        timestamp: new Date().toISOString(),
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    messages.push(newMsg);
    writeJSON(CHANNEL_MSGS_FILE, messages);
    res.json({ success: true, message: newMsg });
});

// ========== ФАЙЛЫ ==========
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

// ========== УДАЛЕНИЕ ==========
app.delete('/delete-message/:id', (req, res) => {
    const { id } = req.params;
    let messages = readJSON(MESSAGES_FILE, []);
    const messageIndex = messages.findIndex(m => m.id == id);
    if (messageIndex === -1) return res.status(404).json({ error: 'Сообщение не найдено' });
    const msg = messages[messageIndex];
    if (msg.fileUrl) {
        const fileName = msg.fileUrl.replace('/file/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    messages.splice(messageIndex, 1);
    writeJSON(MESSAGES_FILE, messages);
    res.json({ success: true });
});

app.delete('/delete-channel-message/:id', (req, res) => {
    const { id } = req.params;
    let messages = readJSON(CHANNEL_MSGS_FILE, []);
    const messageIndex = messages.findIndex(m => m.id == id);
    if (messageIndex === -1) return res.status(404).json({ error: 'Сообщение не найдено' });
    const msg = messages[messageIndex];
    if (msg.fileUrl) {
        const fileName = msg.fileUrl.replace('/file/', '');
        const filePath = path.join(UPLOADS_DIR, fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    messages.splice(messageIndex, 1);
    writeJSON(CHANNEL_MSGS_FILE, messages);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
