const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== ХРАНИЛИЩЕ В ПАМЯТИ ==========
let users = [
    { username: 'Danumala', password: 'danyajukovka', avatar: '👑', online: false, verified: true },
    { username: 'RunFly', password: 'GGWWXXJJ2001', avatar: '🚀', online: false, verified: true }
];
let messages = [];
let friendRequests = [];
let friends = [];

// Папка для файлов
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

// ========== ПОЛЬЗОВАТЕЛИ ==========
app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Пользователь уже существует' });
    users.push({ username, password, avatar: '👤', online: false, verified: false });
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

app.post('/update-username', (req, res) => {
    const { oldUsername, newUsername } = req.body;
    if (!oldUsername || !newUsername) return res.status(400).json({ error: 'Недостаточно данных' });
    if (users.find(u => u.username === newUsername)) return res.status(400).json({ error: 'Имя уже занято' });
    const user = users.find(u => u.username === oldUsername);
    if (user) user.username = newUsername;
    res.json({ success: true, newUsername });
});

// ========== ЛИЧНЫЕ СООБЩЕНИЯ ==========
app.post('/send-message', (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    console.log('📨 Отправка сообщения:', { from, to, text });
    if (!from || !to || (!text && !fileUrl)) {
        return res.status(400).json({ error: 'Недостаточно данных' });
    }
    const newMsg = {
        id: Date.now(),
        from_user: from,
        to_user: to,
        text: text || '',
        file_url: fileUrl || null,
        file_name: fileName || null,
        timestamp: new Date().toISOString(),
        edited: false
    };
    messages.push(newMsg);
    console.log('✅ Сообщение сохранено, всего сообщений:', messages.length);
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    const dialog = messages.filter(m => 
        (m.from_user === user1 && m.to_user === user2) || 
        (m.from_user === user2 && m.to_user === user1)
    ).sort((a,b) => a.id - b.id);
    console.log(`📥 Диалог ${user1}/${user2}: ${dialog.length} сообщений`);
    res.json(dialog);
});

app.get('/get-chats/:username', (req, res) => {
    const { username } = req.params;
    const chatSet = new Set();
    messages.forEach(m => {
        if (m.from_user === username) chatSet.add(m.to_user);
        if (m.to_user === username) chatSet.add(m.from_user);
    });
    users.forEach(u => { if (u.username !== username) chatSet.add(u.username); });
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = messages.filter(m => (m.from_user === username && m.to_user === chatUsername) || (m.from_user === chatUsername && m.to_user === username)).sort((a,b) => b.id - a.id)[0];
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

// ========== ДРУЗЬЯ ==========
app.post('/send-friend-request', (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'Недостаточно данных' });
    if (friendRequests.find(r => r.from_user === from && r.to_user === to)) {
        return res.json({ success: false, error: 'Заявка уже отправлена' });
    }
    friendRequests.push({ from_user: from, to_user: to, status: 'pending' });
    res.json({ success: true });
});

app.get('/friend-requests/:username', (req, res) => {
    const { username } = req.params;
    const received = friendRequests.filter(r => r.to_user === username && r.status === 'pending');
    const sent = friendRequests.filter(r => r.from_user === username && r.status === 'pending');
    res.json({ received, sent });
});

app.post('/friend-request/accept', (req, res) => {
    const { from, to } = req.body;
    const reqIndex = friendRequests.findIndex(r => r.from_user === from && r.to_user === to);
    if (reqIndex !== -1) {
        friendRequests[reqIndex].status = 'accepted';
        friends.push({ user1: from, user2: to });
    }
    res.json({ success: true });
});

app.post('/friend-request/reject', (req, res) => {
    const { from, to } = req.body;
    const reqIndex = friendRequests.findIndex(r => r.from_user === from && r.to_user === to);
    if (reqIndex !== -1) friendRequests.splice(reqIndex, 1);
    res.json({ success: true });
});

app.get('/friends/:username', (req, res) => {
    const { username } = req.params;
    const userFriends = friends.filter(f => f.user1 === username || f.user2 === username);
    const result = userFriends.map(f => f.user1 === username ? f.user2 : f.user1);
    res.json(result);
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

app.delete('/delete-message/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = messages.findIndex(m => m.id === id);
    if (index !== -1) messages.splice(index, 1);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}, сообщения в памяти`));
