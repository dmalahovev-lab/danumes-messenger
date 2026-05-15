const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Единственная папка на Render.com, разрешенная для физической записи файлов
const DB_PATH = '/tmp/database.json';

// Изначальная структура базы данных (резерв в оперативной памяти)
let memoryDB = {
    users: {
        "admin": { password: "123", avatar: "🤖", status: "Создатель" }
    },
    messages: [],
    groups: {} // Хранилище групп в формате: { "НазваниеГруппы": ["участник1", "участник2"] }
};

// Функция загрузки базы данных с диска Render при старте сервера
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

// Функция записи базы данных в файл /tmp/database.json (Защита от ошибки 500)
function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf8');
    } catch (err) {
        console.error("Ошибка записи в /tmp/database.json:", err);
    }
}

// Запускаем считывание базы данных сразу при старте
loadDatabase();

// Главная страница мессенджера
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// МАРШРУТ: Регистрация (принимает любые ключи для стабильности)
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

// МАРШРУТ: Вход (с авто-восстановлением аккаунта при перезагрузке Render)
app.post('/api/login', (req, res) => {
    const username = (req.body.user || req.body.username || '').trim();
    const password = (req.body.pass || req.body.password || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    // Если сервер спал и стер память, но браузер прислал localStorage — воссоздаем профиль
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

// МАРШРУТ: Получить список всех пользователей мессенджера
app.get('/api/users', (req, res) => {
    const list = Object.keys(memoryDB.users).map(username => ({
        name: username,
        avatar: memoryDB.users[username].avatar,
        status: memoryDB.users[username].status
    }));
    res.json(list);
});

// МАРШРУТ: Получить список всех групп
app.get('/api/groups', (req, res) => {
    res.json(Object.keys(memoryDB.groups));
});

// МАРШРУТ: Создать новую группу участников
app.post('/api/groups/create', (req, res) => {
    const groupName = (req.body.groupName || '').trim();
    const members = req.body.members || [];
    
    if (!groupName) {
        return res.json({ success: false, msg: 'Введите название группы' });
    }

    memoryDB.groups[groupName] = members;
    saveDatabase();
    res.json({ success: true, msg: 'Группа успешно создана!' });
});

// МАРШРУТ: Получить историю сообщений
app.get('/api/messages', (req, res) => {
    res.json(memoryDB.messages);
});

// МАРШРУТ: Отправить сообщение (POST HTTP fetch)
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
