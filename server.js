const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// НАДЕЖНОЕ ХРАНИЛИЩЕ В ПАМЯТИ (Исключает краш файловой системы)
let memoryDB = {
    users: {},
    messages: []
};

let onlineUsers = {};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// HTTP API: Регистрация (Исправлена ошибка 500)
app.post('/api/register', (req, res) => {
    try {
        const username = (req.body.user || "").trim();
        const password = (req.body.pass || "").trim();

        if (!username || !password) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        if (memoryDB.users[username]) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }

        memoryDB.users[username] = {
            password: password,
            avatar: "🤖",
            status: "Доступен"
        };

        return res.json({ success: true, message: 'Аккаунт успешно создан! Нажмите "Войти"' });
    } catch (e) {
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// HTTP API: Вход
app.post('/api/login', (req, res) => {
    try {
        const username = (req.body.user || "").trim();
        const password = (req.body.pass || "").trim();

        const user = memoryDB.users[username];
        if (!user || user.password !== password) {
            return res.status(400).json({ error: 'Недействительный Логин/Пароль' });
        }

        return res.json({ success: true, user: { name: username, avatar: user.avatar, status: user.status } });
    } catch (e) {
        return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
});

// SOCKET.IO РАБОТА С СЕТЬЮ
io.on('connection', (socket) => {
    socket.on('set_online', (username) => {
        const user = memoryDB.users[username];
        if (user) {
            onlineUsers[socket.id] = { name: username, avatar: user.avatar, status: user.status };
            io.emit('update_users_list', Object.values(onlineUsers));
            socket.emit('load_history', memoryDB.messages);
        }
    });

    socket.on('request_history', () => {
        socket.emit('load_history', memoryDB.messages);
    });

    socket.on('send_direct_message', (data) => {
        const me = onlineUsers[socket.id];
        if (!me) return;

        const newMsg = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            from: me.name,
            to: data.toUser,
            text: data.text
        };

        memoryDB.messages.push(newMsg);

        const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key].name === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', newMsg);
        }
        socket.emit('message_sent_confirm', newMsg);
        io.emit('load_history', memoryDB.messages);
    });

    socket.on('delete_message', (data) => {
        memoryDB.messages = memoryDB.messages.filter(msg => msg.id !== data.msgId);
        io.emit('load_history', memoryDB.messages);
    });

    socket.on('typing_start', (data) => {
        const me = onlineUsers[socket.id];
        if (!me) return;
        const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key].name === data.toUser);
        if (targetSocketId) io.to(targetSocketId).emit('user_typing', { from: me.name });
    });

    socket.on('typing_stop', (data) => {
        const me = onlineUsers[socket.id];
        if (!me) return;
        const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key].name === data.toUser);
        if (targetSocketId) io.to(targetSocketId).emit('user_typing_stop', { from: me.name });
    });

    socket.on('update_profile', (data) => {
        const me = onlineUsers[socket.id];
        if (!me) return;

        if (memoryDB.users[me.name]) {
            memoryDB.users[me.name].status = data.status;
            memoryDB.users[me.name].avatar = data.avatar;

            onlineUsers[socket.id].status = data.status;
            onlineUsers[socket.id].avatar = data.avatar;

            socket.emit('init_self', onlineUsers[socket.id]);
            io.emit('update_users_list', Object.values(onlineUsers));
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update_users_list', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен`);
});
