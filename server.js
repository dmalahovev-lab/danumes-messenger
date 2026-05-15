const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Путь к физической базе данных в системной папке Render
const DB_PATH = '/tmp/database.json';

// Инициализация структуры базы данных
let globalState = {
    users: [],
    messages: [],
    groups: [] // Добавили массив для глобальной синхронизации групп
};

// Функция загрузки базы данных при старте сервера
function loadDatabase() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            globalState = JSON.parse(data);
            // Защита структуры от пустых полей
            if (!globalState.users) globalState.users = [];
            if (!globalState.messages) globalState.messages = [];
            if (!globalState.groups) globalState.groups = [];
            console.log("💾 База данных DanuMes успешно загружена из /tmp/database.json");
        } else {
            saveDatabase();
        }
    } catch (err) {
        console.error("Ошибка чтения базы данных:", err);
    }
}

// Функция физического сохранения изменений на диск Render
function saveDatabase() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(globalState, null, 2), 'utf8');
    } catch (err) {
        console.error("Критическая ошибка записи в /tmp/database.json:", err);
    }
}

// Вызываем загрузку при старте сервера
loadDatabase();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Синхронизация локальной базы с сервером
app.post('/api/sync', (req, res) => {
    let changed = false;
    if (req.body.users && Array.isArray(req.body.users)) {
        req.body.users.forEach(u => {
            if (!globalState.users.some(existing => existing.name === u.name)) {
                globalState.users.push(u);
                changed = true;
            }
        });
    }
    if (req.body.messages && Array.isArray(req.body.messages)) {
        globalState.messages = req.body.messages;
        changed = true;
    }
    if (changed) {
        saveDatabase();
    }
    res.json(globalState);
});

// МАРШРУТ: Регистрация
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    if (globalState.users.some(u => u.name === username)) {
        return res.json({ success: false, msg: 'Пользователь уже существует' });
    }

    const newUser = { name: username, password: password, avatar: "🤖", status: "Доступен" };
    globalState.users.push(newUser);
    saveDatabase();

    return res.json({ success: true, msg: 'Аккаунт успешно создан! Нажмите "Войти"', newUser });
});

// МАРШРУТ: Вход (с защитой от выкидывания и авто-восстановлением)
app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    let user = globalState.users.find(u => u.name === username);
    if (!user) {
        user = { name: username, password: password, avatar: "🤖", status: "Доступен" };
        globalState.users.push(user);
        saveDatabase();
    }

    if (user.password !== password) {
        return res.json({ success: false, msg: 'Недействительный Логин/Пароль' });
    }

    return res.json({
        success: true,
        user: { name: username, avatar: user.avatar, status: user.status }
    });
});

// МАРШРУТ: Получить список пользователей
app.get('/api/users', (req, res) => {
    res.json(globalState.users);
});

// МАРШРУТ: Получить список групп
app.get('/api/groups', (req, res) => {
    res.json(globalState.groups || []);
});

// МАРШРУТ: Создать группу глобально
app.post('/api/groups/create', (req, res) => {
    const groupName = (req.body.groupName || '').trim();
    if (!groupName) return res.json({ success: false, msg: 'Введите название' });

    if (!globalState.groups) globalState.groups = [];
    if (!globalState.groups.includes(groupName)) {
        globalState.groups.push(groupName);
        saveDatabase();
    }
    res.json({ success: true, groups: globalState.groups });
});

// МАРШРУТ: Получить историю сообщений
app.get('/api/messages', (req, res) => {
    res.json(globalState.messages);
});

// МАРШРУТ: Отправить сообщение
app.post('/api/messages/send', (req, res) => {
    const newMsg = {
        id: Date.now().toString(),
        from: req.body.from,
        to: req.body.to,
        text: req.body.text
    };
    globalState.messages.push(newMsg);
    saveDatabase();
    res.json({ success: true, messages: globalState.messages });
});

// МАРШРУТ: Удалить сообщение
app.post('/api/messages/delete', (req, res) => {
    globalState.messages = globalState.messages.filter(msg => msg.id !== req.body.msgId);
    saveDatabase();
    res.json({ success: true, messages: globalState.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}`);
});
