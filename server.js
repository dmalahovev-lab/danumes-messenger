const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let globalState = {
    users: {},
    messages: [],
    groups: []
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (СТРОГО ОРИГИНАЛ, НЕ ТРОГАЕМ!) ---
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });
    if (globalState.users[username]) return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    globalState.users[username] = { password, lastSeen: Date.now(), avatar: null };
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    const user = globalState.users[username];
    if (!user || user.password !== password) return res.status(400).json({ success: false, error: 'Неверный ник или пароль' });
    user.lastSeen = Date.now();
    res.json({ success: true });
});

// --- СИНХРОНИЗАЦИЯ ЧАТА ---
app.post('/api/sync', (req, res) => {
    const username = (req.body.user || '').trim();
    if (username && globalState.users[username]) {
        globalState.users[username].lastSeen = Date.now();
    }
    const activeUsers = {};
    const now = Date.now();
    Object.keys(globalState.users).forEach(u => {
        activeUsers[u] = {
            online: (now - globalState.users[u].lastSeen) < 10000,
            avatar: globalState.users[u].avatar || null
        };
    });

    // Фильтруем группы: показываем пользователю только те, где он есть в списке участников (members)
    const myGroups = globalState.groups.filter(g => g.members && g.members.includes(username));

    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: myGroups
    });
});

// --- ИСПРАВЛЕННАЯ ОТПРАВКА СООБЩЕНИЙ ---
app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from,
        to: to || null,
        text,
        isGroup: isGroup === undefined ? false : !!isGroup, // <-- ИСПРАВЛЕНО: Теперь личные сообщения строго помечаются как false
        timestamp: Date.now()
    };
    globalState.messages.push(newMessage);
    res.json({ success: true, message: newMessage });
});

// --- СОЗДАНИЕ ПРИВАТНОЙ ГРУППЫ С УЧАСТНИКАМИ ---
app.post('/api/groups/create', (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) return res.status(400).json({ success: false, error: 'Неполные данные' });
    if (globalState.groups.some(g => g.name === name)) {
        return res.status(400).json({ success: false, error: 'Группа уже существует' });
    }
    
    // В список участников железно добавляем самого создателя + тех, кого он выбрал
    const allMembers = Array.isArray(members) ? members : [];
    if (!allMembers.includes(creator)) {
        allMembers.push(creator);
    }

    const newGroup = { name, creator, members: allMembers };
    globalState.groups.push(newGroup);
    res.json({ success: true, group: newGroup });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
