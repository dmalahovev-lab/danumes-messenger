const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Функция загрузки данных из файла
function loadData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.trim().length > 0) return JSON.parse(data);
        }
    } catch (e) { console.error("Ошибка чтения БД:", e); }
    return { users: {}, messages: [], groups: [] };
}

// Функция сохранения данных в файл
function saveData() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8');
    } catch (e) { console.error("Ошибка записи БД:", e); }
}

let globalState = loadData();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (СТРОГО ТВОЙ ОРИГИНАЛ БЕЗ ИЗМЕНЕНИЙ) ---
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
    saveData(); // Сохраняем нового пользователя!
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
    saveData(); // Обновляем статус сети в файле
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
    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: globalState.groups
    });
});

// --- ОТПРАВКА СООБЩЕНИЙ ---
app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) return res.status(400).json({ success: false, error: 'Неполные данные' });
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from, to: to || null, text, isGroup: !!isGroup, timestamp: Date.now(), read: false
    };
    globalState.messages.push(newMessage);
    saveData(); // Сохраняем новое сообщение!
    res.json({ success: true, message: newMessage });
});

// --- НОВЫЙ РОУТ: УДАЛЕНИЕ СООБЩЕНИЯ ---
app.post('/api/messages/delete', (req, res) => {
    const { messageId, username } = req.body;
    const index = globalState.messages.findIndex(m => m.id === messageId);
    if (index === -1) return res.status(404).json({ success: false });
    if (globalState.messages[index].from !== username) return res.status(403).json({ success: false });
    
    globalState.messages.splice(index, 1);
    saveData(); // Сохраняем удаление!
    res.json({ success: true });
});

// --- НОВЫЙ РОУТ: ОБНОВЛЕНИЕ АВАТАРКИ ---
app.post('/api/user/avatar', (req, res) => {
    const { username, avatarUrl } = req.body;
    if (globalState.users[username]) {
        globalState.users[username].avatar = avatarUrl;
        saveData();
        return res.json({ success: true });
    }
    res.status(444).json({ success: false });
});

// --- СОЗДАНИЕ ГРУПП ---
app.post('/api/groups/create', (req, res) => {
    const { name, creator } = req.body;
    if (!name || !creator) return res.status(400).json({ success: false, error: 'Неполные данные' });
    if (globalState.groups.some(g => g.name === name)) {
        return res.status(400).json({ success: false, error: 'Группа с таким названием уже есть' });
    }
    const newGroup = { name, creator };
    globalState.groups.push(newGroup);
    saveData(); // Сохраняем группу!
    res.json({ success: true, group: newGroup });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
