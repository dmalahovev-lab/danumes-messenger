const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_PATH = path.join(__dirname, 'database.json');

function readDB() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: [] }), 'utf8');
        }
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { users: {}, messages: [] };
    }
}

function writeDB(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 4), 'utf8');
    } catch (e) {
        console.error(e);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Роут регистрации
app.post('/api/register', (req, res) => {
    const db = readDB();
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    if (db.users[username]) {
        return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    db.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
    writeDB(db);
    res.json({ success: 'Аккаунт создан! Нажмите "Войти"' });
});

// Роут входа
app.post('/api/login', (req, res) => {
    const db = readDB();
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    const user = db.users[username];
    if (!user || user.password !== password) {
        return res.status(400).json({ error: 'Недействительный Логин/Пароль' });
    }

    res.json({ name: username, avatar: user.avatar, status: user.status });
});

// Получить список всех пользователей
app.get('/api/users', (req, res) => {
    const db = readDB();
    const list = Object.keys(db.users).map(name => ({
        name: name,
        avatar: db.users[name].avatar,
        status: db.users[name].status
    }));
    res.json(list);
});

// Получить историю сообщений
app.get('/api/messages', (req, res) => {
    const db = readDB();
    res.json(db.messages);
});

// Отправить сообщение
app.post('/api/messages/send', (req, res) => {
    const db = readDB();
    const { from, to, text } = req.body;

    if (!from || !to || !text) return res.status(400).json({ error: 'Ошибка данных' });

    const newMsg = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        from,
        to,
        text
    };

    db.messages.push(newMsg);
    writeDB(db);
    res.json(db.messages);
});

// Удалить сообщение
app.post('/api/messages/delete', (req, res) => {
    const db = readDB();
    const { msgId } = req.body;

    db.messages = db.messages.filter(msg => msg.id !== msgId);
    writeDB(db);
    res.json(db.messages);
});

// Обновление профиля
app.post('/api/profile/update', (req, res) => {
    const db = readDB();
    const { username, status, avatar } = req.body;

    if (db.users[username]) {
        db.users[username].status = status;
        db.users[username].avatar = avatar;
        writeDB(db);
        res.json({ name: username, avatar, status });
    } else {
        res.status(404).json({ error: 'Пользователь не найден' });
    }
});

const PORT = process.env.PORT || 3000;
server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
