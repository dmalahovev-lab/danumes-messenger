const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Настройка CORS для работы сокетов на Render
const io = new Server(server, { 
    cors: { 
        origin: "*",
        methods: ["GET", "POST"]
    } 
});

app.use(express.static(__dirname));

const DB_PATH = path.join(__dirname, 'database.json');

// Проверка и создание файла базы данных при старте
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
        console.error("Ошибка базы данных:", e);
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let onlineUsers = {};

io.on('connection', (socket) => {
    console.log(`Клиент подключился: ${socket.id}`);

    // Обработчик регистрации
    socket.on('auth_register', (data) => {
        const db = readDB();
        const username = data.user.trim();
        const password = data.pass.trim();

        if (db.users[username]) {
            return socket.emit('auth_error', 'Пользователь уже существует');
        }

        db.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
        writeDB(db);
        socket.emit('auth_error', 'Аккаунт успешно создан! Нажмите "Войти"');
    });

    // Обработчик входа
    socket.on('auth_login', (data) => {
        const db = readDB();
        const username = data.user.trim();
        const password = data.pass.trim();

        const user = db.users[username];
        if (!user || user.password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль');
        }

        onlineUsers[socket.id] = { name: username, avatar: user.avatar, status: user.status };
        socket.emit('auth_success', onlineUsers[socket.id]);
        
        io.emit('update_users_list', Object.values(onlineUsers));
    });

    // Запрос истории
    socket.on('request_history', () => {
        const db = readDB();
        socket.emit('load_history', db.messages);
    });

    // Отправка сообщений
    socket.on('send_direct_message', (data) => {
        const me = onlineUsers[socket.id];
        if (!me) return;

        const db = readDB();
        const newMsg = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            from: me.name,
            to: data.toUser,
            text: data.text
        };

        db.messages.push(newMsg);
        writeDB(db);

        const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key].name === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', newMsg);
        }
        socket.emit('message_sent_confirm', newMsg);
        io.emit('load_history', db.messages);
    });

    // Удаление сообщений
    socket.on('delete_message', (data) => {
        const db = readDB();
        db.messages = db.messages.filter(msg => msg.id !== data.msgId);
        writeDB(db);
        io.emit('load_history', db.messages);
    });

    // Статусы ввода текста
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

    // Обновление профиля
    socket.on('update_profile', (data) => {
        const me = onlineUsers[socket.id];
        if (!me) return;

        const db = readDB();
        if (db.users[me.name]) {
            db.users[me.name].status = data.status;
            db.users[me.name].avatar = data.avatar;
            writeDB(db);

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
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
