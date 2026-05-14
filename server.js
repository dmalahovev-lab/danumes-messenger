const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Единственный разрешенный путь для физической записи файлов на Render.com
const DB_PATH = '/tmp/database.json';

// Инициализация дефолтной структуры базы данных
let memoryDB = {
    users: {
        "admin": { password: "123", avatar: "🤖", status: "Создатель" }
    },
    messages: [],
    groups: {}
};

// Загрузка базы данных с диска /tmp при старте контейнера
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            memoryDB = JSON.parse(data);
            console.log("💾 База данных DanuMes успешно загружена из /tmp/database.json");
        } else {
            saveDatabase();
        }
    } catch (err) {
        console.error("Ошибка при чтении базы данных:", err);
    }
}

// Физическое сохранение всех изменений базы на диск
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

// РОУТ: Регистрация (Полное соответствие ключам user и pass)
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

// РОУТ: Вход (С механизмом авто-воссоздания аккаунтов из localStorage)
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

// РОУТ: Список пользователей сети
app.get('/api/users', (req, res) => {
    const list = Object.keys(memoryDB.users).map(username => ({
        name: username,
        avatar: memoryDB.users[username].avatar,
        status: memoryDB.users[username].status
    }));
    res.json(list);
});

// РОУТ: Получение списка глобальных групп
app.get('/api/groups', (req, res) => {
    res.json(Object.keys(memoryDB.groups || {}));
});

// РОУТ: Создание и сохранение группы
app.post('/api/groups/create', (req, res) => {
    const { groupName, members } = req.body;
    if (!groupName) return res.json({ success: false, msg: 'Укажите название группы' });
    
    if (!memoryDB.groups) memoryDB.groups = {};
    memoryDB.groups[groupName] = members || [];
    saveDatabase();
    res.json({ success: true });
});

// РОУТ: Загрузка всей истории сообщений
app.get('/api/messages', (req, res) => {
    res.json(memoryDB.messages);
});

// РОУТ: Отправка HTTP-сообщения
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

// РОУТ: Удаление сообщения из базы
app.post('/api/messages/delete', (req, res) => {
    memoryDB.messages = memoryDB.messages.filter(msg => msg.id !== req.body.msgId);
    saveDatabase();
    res.json({ success: true, messages: memoryDB.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}`);
});
