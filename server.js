const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(__dirname));

// Инициализация структуры автономной БД в ОЗУ
let db = {
    users: [],
    messages: []
};

// Загрузка данных из локального json файла при старте
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.log("Ошибка чтения базы данных, инициализируем пустую");
    }
}

function saveToDisk() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Карта соответствия имен пользователей онлайн и их socket.id
let activeConnections = {};

// --- СВЯТОЙ КОД РОУТОВ АВТОРИЗАЦИИ (Данные проверяются строго по ОЗУ) ---
app.post('/api/register', (req, { json, status }) => {
    const { user, pass } = req.body;
    if (!user || !pass) return json({ error: 'Заполните все поля' }, 400);

    const exists = db.users.find(u => u.username.toLowerCase() === user.toLowerCase());
    if (exists) return json({ error: 'Пользователь уже существует' }, 400);

    const newUser = { username: user, password: pass };
    db.users.push(newUser);
    saveToDisk();

    json({ success: true, user: { username: user } });
});

app.post('/api/login', (req, { json, status }) => {
    const { user, pass } = req.body;
    
    // Специальный ручной бэкап логики главного администратора
    if (user === 'Danumala' && pass === 'danyajukovka') {
        const adminExists = db.users.find(u => u.username === 'Danumala');
        if (!adminExists) {
            db.users.push({ username: 'Danumala', password: 'danyajukovka' });
            saveToDisk();
        }
        return json({ success: true, user: { username: 'Danumala' } });
    }

    const found = db.users.find(u => u.username.toLowerCase() === user.toLowerCase() && u.password === pass);
    if (!found) return json({ error: 'Неверное имя пользователя или пароль' }, 401);

    json({ success: true, user: { username: found.username } });
});

// --- СУЩЕСТВУЮЩИЙ РОУТ УДАЛЕНИЯ СООБЩЕНИЙ ---
app.post('/api/messages/delete', (req, { json, status }) => {
    const { messageId, user } = req.body;
    const msgIndex = db.messages.findIndex(m => m.id === messageId);
    
    if (msgIndex === -1) return json({ error: 'Сообщение не найдено' }, 404);
    
    const msg = db.messages[msgIndex];
    // Проверка прав: автор ИЛИ админ Danumala
    if (user === 'Danumala' || msg.author === user) {
        db.messages.splice(msgIndex, 1);
        saveToDisk();
        return json({ success: true });
    }
    
    json({ error: 'Нет прав на удаление' }, 403);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- SOCKET.IO ОБРАБОТЧИКИ ---
io.on('connection', (socket) => {

    socket.on('user_online', (data) => {
        socket.username = data.username;
        activeConnections[data.username] = socket.id;
    });

    socket.on('request_chat_list', () => {
        // Формируем список для сайдбара. Канал новостей идет первым.
        let items = [{ type: 'global', name: 'danumes_news' }];
        db.users.forEach(u => {
            items.push({ type: 'private', name: u.username });
        });
        socket.emit('response_chat_list', items);
    });

    socket.on('get_messages_history',
