const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_FILE = path.join(__dirname, 'database.json');

// Автоматическое создание или чтение базы данных
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        if (data.trim()) db = JSON.parse(data);
    } catch (e) {
        console.error("Ошибка чтения базы данных, создаем новую:", e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let activeConnections = {}; // socket.id -> username

io.on('connection', (socket) => {

    // 1. Регистрация нового аккаунта
    socket.on('register_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля!');
        }
        if (db.users[username]) {
            return socket.emit('auth_error', 'Пользователь с таким именем уже существует!');
        }

        db.users[username] = {
            password: password,
            status: "Доступен",
            avatar: "🤖"
        };
        saveDB();
        socket.emit('auth_success', 'Регистрация успешна! Теперь вы можете войти.');
    });

    // 2. Вход в существующий аккаунт
    socket.on('login_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!db.users[username] || db.users[username].password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль');
        }

        activeConnections[socket.id] = username;
        
        // Отправляем личные данные пользователя
        socket.emit('init_self', {
            name: username,
            status: db.users[username].status,
            avatar: db.users[username].avatar
        });

        sendUsersList();
    });

    function sendUsersList() {
        const list = Object.keys(db.users).map(name => ({
            name: name,
            status: db.users[name].status,
            avatar: db.users[name].avatar,
            isOnline: Object.values(activeConnections).includes(name)
        }));
        io.emit('update_users_list', list);
    }

    // 3. Обновление профиля
    socket.on('update_profile', (data) => {
        const username = activeConnections[socket.id];
        if (username && db.users[username]) {
            db.users[username].status = data.status;
            db.users[username].avatar = data.avatar;
            saveDB();

            socket.emit('init_self', {
                name: username,
                status: db.users[username].status,
                avatar: db.users[username].avatar
            });
            sendUsersList();
        }
    });

    // 4. Запрос истории чата
    socket.on('get_chat_history', (targetUser) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, targetUser].sort().join('_');
        const history = db.messages[roomKey] || [];
        socket.emit('chat_history_response', { targetUser, history });
    });

    // 5. Статус «Печатает...»
    socket.on('typing_status', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing', { fromUser: username, isTyping: data.isTyping });
        }
    });

    // 6. Отправка сообщения
    socket.on('send_direct_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        if (!db.messages[roomKey]) db.messages[roomKey] = [];

        const messagePayload = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            from: username,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        db.messages[roomKey].push(messagePayload);
        saveDB();

        // Отправляем получателю
        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', { roomKey, msg: messagePayload, fromUser: username });
        }
        
        // Подтверждаем отправку автору
        socket.emit('message_sent_confirm', { roomKey, msg: messagePayload, toUser: data.toUser });
    });

    // 7. Удаление сообщения
    socket.on('delete_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        if (db.messages[roomKey]) {
            db.messages[roomKey] = db.messages[roomKey].filter(m => m.id !== data.msgId);
            saveDB();

            // Обновляем у обоих пользователей экран
            socket.emit('message_deleted_sync', { targetUser: data.toUser, history: db.messages[roomKey] });
            const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('message_deleted_sync', { targetUser: username, history: db.messages[roomKey] });
            }
        }
    });

    socket.on('disconnect', () => {
        delete activeConnections[socket.id];
        sendUsersList();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
