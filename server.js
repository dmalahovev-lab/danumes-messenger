const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'database.json');

// Инициализация базы данных
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.users) db.users = {};
        if (!db.messages) db.messages = {};
    } catch (e) {
        console.error("Ошибка чтения базы данных, сброс к пустой:", e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Активные онлайн подключения (socket.id -> username)
let activeConnections = {};

function sendUsersList() {
    const list = Object.keys(db.users).map(username => {
        const isOnline = Object.values(activeConnections).includes(username);
        return {
            name: username,
            avatar: db.users[username].avatar || "🤖",
            status: db.users[username].status || "Доступен",
            isOnline: isOnline
        };
    });
    io.emit('update_users_list', list);
}

io.on('connection', (socket) => {
    console.log(`Подключение к сокету: ${socket.id}`);

    // 1. Регистрация нового аккаунта
    socket.on('register_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            socket.emit('auth_error', 'Заполните все поля текста!');
            return;
        }

        if (db.users[username]) {
            socket.emit('auth_error', 'Пользователь с таким именем уже существует!');
            return;
        }

        db.users[username] = {
            password: password,
            avatar: "🤖",
            status: "Доступен"
        };
        saveDB();

        socket.emit('auth_success', 'Регистрация успешна! Теперь вы можете войти.');
    });

    // 2. Вход в существующий аккаунт
    socket.on('login_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!db.users[username] || db.users[username].password !== password) {
            socket.emit('auth_error', 'Недействительный Логин/Пароль');
            return;
        }

        activeConnections[socket.id] = username;

        socket.emit('init_self', {
            name: username,
            avatar: db.users[username].avatar,
            status: db.users[username].status
        });

        sendUsersList();
    });

    // 3. Обновление настроек профиля
    socket.on('update_profile', (data) => {
        const username = activeConnections[socket.id];
        if (username && db.users[username]) {
            db.users[username].status = data.status;
            db.users[username].avatar = data.avatar;
            saveDB();

            socket.emit('init_self', {
                name: username,
                avatar: data.avatar,
                status: data.status
            });
            sendUsersList();
        }
    });

    // 4. Запрос истории переписки
    socket.on('get_chat_history', (targetUser) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, targetUser].sort().join('_');
        const history = db.messages[roomKey] || [];
        socket.emit('chat_history_response', { targetUser: targetUser, history: history });
    });

    // 5. Обработка индикатора набора текста
    socket.on('typing_status', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing', { fromUser: username, isTyping: data.isTyping });
        }
    });

    // 6. Отправка и сохранение сообщений
    socket.on('send_direct_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        const messagePayload = {
            sender: username,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!db.messages[roomKey]) db.messages[roomKey] = [];
        db.messages[roomKey].push(messagePayload);
        saveDB();

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', { from: username, text: data.text });
        }
        socket.emit('message_sent_confirm', messagePayload);
    });

    // 7. Удаление сообщения
    socket.on('delete_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        if (db.messages[roomKey] && db.messages[roomKey][data.index]) {
            db.messages[roomKey].splice(data.index, 1);
            saveDB();

            socket.emit('message_deleted_sync', { targetUser: data.toUser, index: data.index });
            
            const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('message_deleted_sync', { targetUser: username, index: data.index });
            }
        }
    });

    socket.on('disconnect', () => {
        delete activeConnections[socket.id];
        sendUsersList();
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}!`);
});
