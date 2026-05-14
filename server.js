const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const DB_PATH = path.join('/tmp', 'database.json');

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [], groups: [] }), 'utf8');
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        const json = JSON.parse(data);
        if (!json.groups) json.groups = []; // Защита от старой структуры
        return json;
    } catch (e) {
        return { users: {}, messages: [], groups: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), 'utf8');
    } catch (e) {
        console.error("Ошибка записи базы данных в /tmp:", e);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/register', (req, res) => {
    try {
        const db = readDB();
        const username = (req.body.user || '').trim();
        const password = (req.body.pass || '').trim();

        if (!username || !password) {
            return res.json({ success: false, msg: 'Заполните все поля' });
        }

        if (db.users[username]) {
            return res.json({ success: false, msg: 'Пользователь уже существует' });
        }

        db.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
        writeDB(db);

        return res.json({ success: true, msg: 'Аккаунт успешно создан! Нажмите "Войти"' });
    } catch (err) {
        return res.json({ success: false, msg: 'Внутренняя ошибка регистрации' });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const db = readDB();
        const username = (req.body.user || '').trim();
        const password = (req.body.pass || '').trim();

        const user = db.users[username];
        if (!user || user.password !== password) {
            return res.json({ success: false, msg: 'Недействительный Логин/Пароль' });
        }

        return res.json({
            success: true,
            user: { name: username, avatar: user.avatar, status: user.status }
        });
    } catch (err) {
        return res.json({ success: false, msg: 'Внутренняя ошибка авторизации' });
    }
});

app.get('/api/users', (req, res) => {
    const db = readDB();
    const list = Object.keys(db.users).map(username => ({
        name: username,
        avatar: db.users[username].avatar,
        status: db.users[username].status
    }));
    res.json(list);
});

// ГЛОБАЛЬНЫЕ ГРУППЫ: Получить список всех групп с сервера
app.get('/api/groups', (req, res) => {
    const db = readDB();
    res.json(db.groups || []);
});

// ГЛОБАЛЬНЫЕ ГРУППЫ: Создать группу на сервере
app.post('/api/groups/create', (req, res) => {
    const db = readDB();
    const gName = (req.body.name || '').trim();
    if (gName && !db.groups.includes(gName)) {
        db.groups.push(gName);
        writeDB(db);
    }
    res.json({ success: true, groups: db.groups });
});

app.get('/api/messages', (req, res) => {
    const db = readDB();
    res.json(db.messages);
});

app.post('/api/messages/send', (req, res) => {
    const db = readDB();
    const newMsg = {
        id: Date.now().toString(),
        from: req.body.from,
        to: req.body.to,
        text: req.body.text
    };
    db.messages.push(newMsg);
    writeDB(db);
    res.json({ success: true, messages: db.messages });
});

app.post('/api/messages/delete', (req, res) => {
    const db = readDB();
    db.messages = db.messages.filter(msg => msg.id !== req.body.msgId);
    writeDB(db);
    res.json({ success: true, messages: db.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
