const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Обычные настройки сервера (как в вашем оригинале)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Чистая и надежная база данных прямо в памяти (без записи файлов на диск)
let globalState = {
    users: {},
    messages: [],
    groups: []
};

// Главная страница сайта
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (ВАШ ОРИГИНАЛЬНЫЙ КОД БЕЗ ИЗМЕНЕНИЙ) ---

app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }
    if (globalState.users[username]) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }
    
    globalState.users[username] = {
        password,
        lastSeen: Date.now(),
        avatar: null
    };
    
    res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = globalState.users[username];
    if (!user || user.password !== password) {
        return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
    }
    
    user.lastSeen = Date.now();
    res.json({ success: true });
});

// --- СИНХРОНИЗАЦИЯ ЧАТА ---

app.post('/api/sync', (req, res) => {
    const { username } = req.body;
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
    
    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: globalState.groups
    });
});

// --- РАБОТА С СООБЩЕНИЯМИ ---

app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) {
        return res.status(400).json({ success: false, error: 'Неполные данные' });
    }
    
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from,
        to: to || null,
        text,
        isGroup: !!isGroup,
        timestamp: Date.now()
    };
    
    globalState.messages.push(newMessage);
    res.json({ success: true, message: newMessage });
});

app.post('/api/messages/delete', (req, res) => {
    const { messageId, username } = req.body;
    const index = globalState.messages.findIndex(m => m.id === messageId);
    
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }
    if (globalState.messages[index].from !== username) {
        return res.status(403).json({ success: false, error: 'Нет прав на удаление' });
    }
    
    globalState.messages.splice(index, 1);
    res.json({ success: true });
});

// --- РАБОТА С ГРУППАМИ ---

app.post('/api/groups/create', (req, res) => {
    const { name, creator } = req.body;
    if (!name || !creator) {
        return res.status(400).json({ success: false, error: 'Неполные данные' });
    }
    
    if (globalState.groups.some(g => g.name === name)) {
        return res.status(400).json({ success: false, error: 'Группа с таким названием уже есть' });
    }
    
    const newGroup = { name, creator };
    globalState.groups.push(newGroup);
    res.json({ success: true, group: newGroup });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
