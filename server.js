const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'database.json');
const ADMIN_USERNAME = 'Danumala';
const NEWS_GROUP_NAME = 'DanuMes news';

function loadLocalDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const fileData = fs.readFileSync(DB_FILE, 'utf8');
            if (fileData.trim().length > 0) return JSON.parse(fileData);
        }
    } catch (e) { console.error("Ошибка чтения файла БД:", e); }
    return { users: {}, messages: [], groups: [] };
}

let globalState = loadLocalDatabase();

function saveLocalDatabase() {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8'); } 
    catch (e) { console.error("Ошибка записи файла БД:", e); }
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function initLocalSystem() {
    if (!globalState.users) globalState.users = {};
    if (!globalState.groups) globalState.groups = [];
    if (!globalState.messages) globalState.messages = [];

    if (!globalState.users[ADMIN_USERNAME]) {
        globalState.users[ADMIN_USERNAME] = {
            password: hashPassword('danyajukovka'),
            last_seen: Date.now()
        };
    }

    const hasNews = globalState.groups.some(g => g.name === NEWS_GROUP_NAME);
    if (!hasNews) {
        globalState.groups.push({ name: NEWS_GROUP_NAME, creator: ADMIN_USERNAME, members: [ADMIN_USERNAME] });
    }

    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME) {
            Object.keys(globalState.users).forEach(u => {
                if (!g.members.includes(u)) g.members.push(u);
            });
        }
    });
    saveLocalDatabase();
}
initLocalSystem();

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// --- СТРОГО ТВОЯ ОРИГИНАЛЬНАЯ АВТОРИЗАЦИЯ ---
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });
    if (globalState.users[username]) return res.status(400).json({ success: false, error: 'Пользователь уже существует' });

    globalState.users[username] = { password: hashPassword(password), last_seen: Date.now() };
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME && !g.members.includes(username)) g.members.push(username);
    });
    saveLocalDatabase();
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    const user = globalState.users[username];
    if (!user || user.password !== hashPassword(password)) return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });

    user.last_seen = Date.now();
    saveLocalDatabase();
    res.json({ success: true });
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

app.post('/api/sync', (req, res) => {
    const username = (req.body.user || '').trim();
    if (username && globalState.users[username]) globalState.users[username].last_seen = Date.now();

    const activeUsers = {};
    const now = Date.now();
    Object.keys(globalState.users).forEach(u => {
        activeUsers[u] = { online: (now - globalState.users[u].last_seen) < 10000, avatar: null };
    });

    res.json({
        users: activeUsers,
        messages: globalState.messages || [],
        groups: globalState.groups.filter(g => g.members && g.members.includes(username))
    });
});

app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text || !to) return res.status(400).json({ success: false, error: 'Неполные данные' });
    if (isGroup && to === NEWS_GROUP_NAME && from !== ADMIN_USERNAME) return res.status(403).json({ success: false, error: 'Отказ' });

    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from, to, text, isGroup: !!isGroup, timestamp: Date.now()
    };

    globalState.messages.push(newMessage);
    saveLocalDatabase();
    io.emit('chat message', newMessage); // Отправляем полный объект сообщения
    res.json({ success: true, message: newMessage });
});

// --- НОВЫЙ РОУТ ДЛЯ УДАЛЕНИЯ СООБЩЕНИЙ ИЗ БАЗЫ ДАННЫХ ---
app.post('/api/messages/delete', (req, res) => {
    const { id, username } = req.body;
    if (!id || !username) return res.status(400).json({ success: false });

    const msgIndex = globalState.messages.findIndex(m => m.id === id);
    if (msgIndex !== -1) {
        // Разрешаем удалять сообщение только его автору или админу Danumala
        if (globalState.messages[msgIndex].from === username || username === ADMIN_USERNAME) {
            globalState.messages.splice(msgIndex, 1);
            saveLocalDatabase();
            io.emit('message deleted', { id }); // Команда сокетам стереть сообщение с экранов
            return res.json({ success: true });
        }
    }
    res.status(403).json({ success: false });
});

app.post('/api/groups/create', (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) return res.status(400).json({ success: false });
    if (globalState.groups.some(g => g.name === name)) return res.status(400).json({ success: false });

    const allMembers = [creator];
    if (members && Array.isArray(members)) { members.forEach(m => { if (!allMembers.includes(m)) allMembers.push(m); }); }

    globalState.groups.push({ name, creator, members: allMembers });
    saveLocalDatabase();
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('chat message', (data) => {
        if (!data.username || !data.text || !data.to) return;
        if (data.to === NEWS_GROUP_NAME && data.username !== ADMIN_USERNAME) return;

        const newMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            from: data.username, to: data.to, text: data.text,
            isGroup: data.to === NEWS_GROUP_NAME || globalState.groups.some(g => g.name === data.to),
            timestamp: Date.now()
        };
        globalState.messages.push(newMessage);
        saveLocalDatabase();
        io.emit('chat message', newMessage);
    });
});

const PORT_NUM = process.env.PORT || 3000;
server.listen(PORT_NUM, () => { console.log(`Сервер запущен на порту ${PORT_NUM}`); });
