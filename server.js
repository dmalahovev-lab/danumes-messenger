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

// Локальная база данных прямо в памяти сервера
function loadLocalDatabase() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const fileData = fs.readFileSync(DB_FILE, 'utf8');
            if (fileData.trim().length > 0) {
                return JSON.parse(fileData);
            }
        }
    } catch (e) {
        console.error("Ошибка чтения локальной БД:", e);
    }
    return { users: {}, messages: [], groups: [] };
}

let globalState = loadLocalDatabase();

function saveLocalDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8');
    } catch (e) {
        console.error("Ошибка записи локальной БД:", e);
    }
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Инициализация админа Danumala и новостей при старте
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
        globalState.groups.push({
            name: NEWS_GROUP_NAME,
            creator: ADMIN_USERNAME,
            members: [ADMIN_USERNAME]
        });
    }

    // Автодобавление всех в новости
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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- СВЕРХСТАБИЛЬНАЯ АВТОНОМНАЯ РЕГИСТРАЦИЯ ---
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    if (globalState.users[username]) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }

    globalState.users[username] = {
        password: hashPassword(password),
        last_seen: Date.now()
    };

    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME && !g.members.includes(username)) {
            g.members.push(username);
        }
    });

    saveLocalDatabase();
    res.json({ success: true });
});

// --- СВЕРХСТАБИЛЬНЫЙ АВТОНОМНЫЙ ВХОД ДЛЯ ВСЕХ ---
app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    const user = globalState.users[username];
    if (!user) {
        return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
    }

    const inputHash = hashPassword(password);
    if (user.password !== inputHash) {
        return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
    }

    user.last_seen = Date.now();
    saveLocalDatabase();
    res.json({ success: true });
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

// --- СИНХРОНИЗАЦИЯ ЧАТА ---
app.post('/api/sync', (req, res) => {
    const username = (req.body.user || '').trim();
    if (username && globalState.users[username]) {
        globalState.users[username].last_seen = Date.now();
    }

    const activeUsers = {};
    const now = Date.now();

    Object.keys(globalState.users).forEach(u => {
        activeUsers[u] = {
            online: (now - globalState.users[u].last_seen) < 10000,
            avatar: null
        };
    });

    const myGroups = globalState.groups.filter(g => g.members && g.members.includes(username));

    res.json({
        users: activeUsers,
        messages: globalState.messages || [],
        groups: myGroups
    });
});

// --- СВЯЗЬ SOCKET.IO ---
io.on('connection', (socket) => {
    // Шлём историю из памяти
    const formattedHistory = (globalState.messages || []).map(msg => {
        return {
            username: msg.from,
            text: msg.text,
            time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    });
    socket.emit('chat history', formattedHistory.slice(-100));

    socket.on('chat message', (data) => {
        if (!data.username || !data.text) return;
        if (data.to === NEWS_GROUP_NAME && data.username !== ADMIN_USERNAME) return;

        const newMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            from: data.username,
            to: data.to || '',
            text: data.text,
            isGroup: data.to === NEWS_GROUP_NAME || globalState.groups.some(g => g.name === data.to),
            timestamp: Date.now()
        };

        globalState.messages.push(newMessage);
        saveLocalDatabase();

        io.emit('chat message', {
            username: newMessage.from,
            text: newMessage.text,
            time: new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });
});

const PORT_NUM = process.env.PORT || 3000;
server.listen(PORT_NUM, () => {
    console.log(`Сервер успешно запущен на порту ${PORT_NUM}`);
});
