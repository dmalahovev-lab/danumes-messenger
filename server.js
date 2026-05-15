const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DB_PATH = '/tmp/database.json';

let memoryDB = {
    users: {
        "admin": { password: "123", avatar: "🤖", status: "Создатель" }
    },
    messages: [],
    groups: {}
};

function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            memoryDB = JSON.parse(data);
            console.log("💾 База данных успешно загружена из /tmp/database.json");
        } else {
            saveDatabase();
        }
    } catch (err) {
        console.error("Ошибка при чтении базы данных:", err);
    }
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf8');
    } catch (err) {
        console.error("Ошибка записи в /tmp/database.json:", err);
    }
}

loadDatabase();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    if (memoryDB.users[username]) {
        return res.json({ success: false, msg: 'Пользователь уже существует' });
    }

    memoryDB.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
    saveDatabase();
    return res.json({ success: true, msg: 'Аккаунт успешно создан! Нажмите "Войти"' });
});

app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    if (!memoryDB.users[username]) {
        memoryDB.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
        saveDatabase();
    }

    const user = memoryDB.users[username];
    
    if (user.password !== password) {
        return res.json({ success: false, msg: 'Недействительный Логин/Пароль' });
    }

    return res.json({
        success: true,
        user: { name: username, avatar: user.avatar, status: user.status }
    });
});

app.get('/api/users', (req, res) => {
    const list = Object.keys(memoryDB.users).map(username => ({
        name: username,
        avatar: memoryDB.users[username].avatar,
        status: memoryDB.users[username].status
    }));
    res.json(list);
});

app.get('/api/groups', (req, res) => {
    res.json(Object.keys(memoryDB.groups || {}));
});

app.post('/api/groups/create', (req, res) => {
    const groupName = (req.body.groupName || '').trim();
    const members = req.body.members || [];
    if (!groupName) return res.json({ success: false, msg: 'Укажите имя группы' });
    
    if (!memoryDB.groups) memoryDB.groups = {};
    memoryDB.groups[groupName] = members;
    saveDatabase();
    res.json({ success: true });
});

app.get('/api/messages', (req, res) => {
    res.json(memoryDB.messages);
});

app.post('/api/messages/send', (req, res) => {
    const newMsg = {
        id: Date.now().toString(),
        from: req.body.from,
        to: req.body.to,
        text: req.body.text
    };
    memoryDB.messages.push(newMsg);
    saveDatabase();
    res.json({ success: true, messages: memoryDB.messages });
});

app.post('/api/messages/delete', (req, res) => {
    memoryDB.messages = memoryDB.messages.filter(msg => msg.id !== req.body.msgId);
    saveDatabase();
    res.json({ success: true, messages: memoryDB.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
