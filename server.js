const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Единственная папка на Render с правами на запись
const DB_PATH = '/tmp/database.json';

// Структура базы данных в оперативной памяти (резервная копия)
let memoryDB = {
    users: {
        "admin": { password: "123", avatar: "🤖", status: "Создатель" }
    },
    messages: [],
    groups: {} // Формат: { "НазваниеГруппы": ["участник1", "участник2"] }
};

// Загрузка базы данных при старте
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            memoryDB = JSON.parse(data);
            // Гарантируем наличие необходимых объектов в JSON
            if (!memoryDB.users) memoryDB.users = {};
            if (!memoryDB.messages) memoryDB.messages = [];
            if (!memoryDB.groups) memoryDB.groups = {};
            console.log("💾 База данных успешно загружена из /tmp/database.json");
        } else {
            saveDatabase();
        }
    } catch (err) {
        console.error("Ошибка чтения базы данных:", err);
    }
}

// Физическое сохранение базы на диск Render
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

// МАРШРУТ: Регистрация
app.post('/api/register', (req, res) => {
    const username = (req.body.user || req.body.username || '').trim();
    const password = (req.body.pass || req.body.password || '').trim();

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

// МАРШРУТ: Вход + Авто-восстановление профиля
app.post('/api/login', (req, res) => {
    const username = (req.body.user || req.body.username || '').trim();
    const password = (req.body.pass || req.body.password || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    // Воссоздание профиля, если сервер засыпал и стер ОЗУ
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

// МАРШРУТ: Список пользователей
app.get('/api/users', (req, res) => {
    const list = Object.keys(memoryDB.users).map(username => ({
        name: username,
        avatar: memoryDB.users[username].avatar,
        status: memoryDB.users[username].status
    }));
    res.json(list);
});

// МАРШРУТ: Список групп
app.get('/api/groups', (req, res) => {
    res.json(Object.keys(memoryDB.groups));
});

// МАРШРУТ: Создание группы
app.post('/api/groups/create', (req, res) => {
    const { groupName, members } = req.body;
    if (!groupName) return res.json({ success: false, msg: 'Укажите имя группы' });
    
    memoryDB.groups[groupName] = members || [];
    saveDatabase();
    res.json({ success: true });
});

// МАРШРУТ: Получить историю сообщений
app.get('/api/messages', (req, res) => {
    res.json(memoryDB.messages);
});

// МАРШРУТ: Отправить сообщение
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

// МАРШРУТ: Удалить сообщение
app.post('/api/messages/delete', (req, res) => {
    memoryDB.messages = memoryDB.messages.filter(msg => msg.id !== req.body.msgId);
    saveDatabase();
    res.json({ success: true, messages: memoryDB.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}`);
});
