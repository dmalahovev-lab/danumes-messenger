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

// --- ВХОД И РЕГИСТРАЦИЯ (СТРОГО ОРИГИНАЛ - НЕ ТРОГАЕМ!) ---
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }
    if (globalState.users[username]) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }
    globalState.users[username] = { password, lastSeen: Date.now(), avatar: null };
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    const user = globalState.users[username];
    if (!user || user.password !== password) {
        return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
    }
    user.lastSeen = Date.now();
    res.json({ success: true });
});

// --- СИНХРОНИЗАЦИЯ ЧАТА (ФИЛЬТРУЕМ ГРУППЫ ПО УЧАСТНИКАМ) ---
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

    // Фильтр: отдаем пользователю только те группы, где он состоит в members
    const filteredGroups = globalState.groups.filter(g => {
        return g.members && g.members.includes(username);
    });
    
    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: filteredGroups
    });
});

app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) return res.status(400).json({ success: false, error: 'Неполные данные' });
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from, to: to || null, text, isGroup: !!isGroup, timestamp: Date.now()
    };
    globalState.messages.push(newMessage);
    res.json({ success: true, message: newMessage });
});

// --- СОЗДАНИЕ ГРУППЫ С УКАЗАНИЕМ УЧАСТНИКОВ ---
app.post('/api/groups/create', (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) return res.status(400).json({ success: false, error: 'Неполные данные' });
    if (globalState.groups.some(g => g.name === name)) {
        return res.status(400).json({ success: false, error: 'Группа с таким названием уже есть' });
    }
    
    // Создатель обязательно должен быть в списке участников группы
    const finalMembers = members || [];
    if (!finalMembers.includes(creator)) {
        finalMembers.push(creator);
    }

    const newGroup = { name, creator, members: finalMembers };
    globalState.groups.push(newGroup);
    res.json({ success: true, group: newGroup });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
