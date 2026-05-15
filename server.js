const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Единственный разрешенный путь для физической записи файлов на бесплатном хостинге Render
const DB_PATH = '/tmp/database.json';

// Резервная копия базы данных в ОЗУ на случай инициализации
let memoryDB = {
    users: {
        "admin": { password: "123", avatar: "🤖", status: "Создатель" }
    },
    messages: [],
    groups: [] // Массив названий созданных глобальных групп
};

// Функция загрузки базы данных с диска Render
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

// Функция физической записи базы данных на диск Render
function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf8');
    } catch (err) {
        console.error("Ошибка записи в /tmp/database.json:", err);
    }
}

// Загружаем сохраненную базу данных сразу при старте контейнера
loadDatabase();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// МАРШРУТ: Регистрация нового аккаунта
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

// МАРШРУТ: Авторизация и механизм авто-восстановления сессий
app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    // Механизм авто-восстановления аккаунта из localStorage клиента после перезапуска сервера Render
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

// МАРШРУТ: Получение списка всех зарегистрированных участников мессенджера
app.get('/api/users', (req, res) => {
    const list = Object.keys(memoryDB.users).map(username => ({
        name: username,
        avatar: memoryDB.users[username].avatar,
        status: memoryDB.users[username].status
    }));
    res.json(list);
});

// МАРШРУТ: Получение списка синхронизированных групп мессенджера
app.get('/api/groups', (req, res) => {
    res.json(memoryDB.groups || []);
});

// МАРШРУТ: Сохранение созданной группы на сервере
app.post('/api/groups/create', (req, res) => {
    const groupName = (req.body.groupName || '').trim();
    if (!groupName) {
        return res.json({ success: false, msg: 'Имя группы не может быть пустым' });
    }
    
    if (!memoryDB.groups) memoryDB.groups = [];
    
    if (!memoryDB.groups.includes(groupName)) {
        memoryDB.groups.push(groupName);
        saveDatabase();
    }
    res.json({ success: true, groups: memoryDB.groups });
});

// МАРШРУТ: Получение всей глобальной истории сообщений
app.get('/api/messages', (req, res) => {
    res.json(memoryDB.messages);
});

// МАРШРУТ: Отправка нового сообщения (Личного или Группового)
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

// МАРШРУТ: Удаление сообщения из истории по его ID
app.post('/api/messages/delete', (req, res) => {
    memoryDB.messages = memoryDB.messages.filter(msg => msg.id !== req.body.msgId);
    saveDatabase();
    res.json({ success: true, messages: memoryDB.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}`);
});
