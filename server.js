const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Путь к базе данных в разрешенной для записи папке Render
const DB_PATH = '/tmp/database.json';

// Инициализация базы данных (резервная копия в ОЗУ)
let memoryDB = {
    users: {
        "admin": { password: "123", avatar: "🤖", status: "Создатель" }
    },
    messages: []
};

// Функция загрузки базы из файла /tmp/database.json при старте сервера
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            memoryDB = JSON.parse(data);
            console.log("💾 База данных DanuMes успешно загружена из /tmp/database.json");
        } else {
            saveDatabase(); // Создаем файл, если его нет
        }
    } catch (err) {
        console.error("Ошибка при чтении базы данных:", err);
    }
}

// Функция сохранения базы в файл /tmp/database.json
function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(memoryDB, null, 2), 'utf8');
    } catch (err) {
        console.error("Ошибка записи в /tmp/database.json:", err);
    }
}

// Загружаем данные сразу при запуске сервера
loadDatabase();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// МАРШРУТ: Регистрация (приведен к единому стандарту ключей)
app.post('/api/register', (req, res) => {
    // Принимаем и user/pass, и username/password для исключения багов фронтенда
    const username = (req.body.user || req.body.username || '').trim();
    const password = (req.body.pass || req.body.password || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    if (memoryDB.users[username]) {
        return res.json({ success: false, msg: 'Пользователь уже существует' });
    }

    memoryDB.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
    saveDatabase(); // Физически сохраняем изменения на диск

    return res.json({ success: true, msg: 'Аккаунт успешно создан! Нажмите "Войти"' });
});

// МАРШРУТ: Вход (с авто-восстановлением)
app.post('/api/login', (req, res) => {
    const username = (req.body.user || req.body.username || '').trim();
    const password = (req.body.pass || req.body.password || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    // Авто-восстановление аккаунта из localStorage браузера при перезапуске контейнера Render
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

// МАРШРУТ: Получить историю
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
    saveDatabase(); // Физически сохраняем сообщение на диск
    res.json({ success: true, messages: memoryDB.messages });
});

// МАРШРУТ: Удалить сообщение
app.post('/api/messages/delete', (req, res) => {
    memoryDB.messages = memoryDB.messages.filter(msg => msg.id !== req.body.msgId);
    saveDatabase(); // Физически сохраняем изменения на диск
    res.json({ success: true, messages: memoryDB.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}`);
});
