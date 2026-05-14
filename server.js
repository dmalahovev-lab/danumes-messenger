const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_FILE = path.join(__dirname, 'database.json');

// Инициализация базы данных пользователей и сообщений
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.users) db.users = {};
        if (!db.messages) db.messages = {};
    } catch (e) {
        console.error("Ошибка чтения БД, создаем чистую...");
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Активные онлайн-подключения (socket.id -> username)
let activeConnections = {};

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

        db.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
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
        
        const userData = db.users[username];
        socket.emit('init_self', { name: username, avatar: userData.avatar, status: userData.status });
        sendUsersList();
    });

    // 3. Обновление профиля
    socket.on('update_profile', (data) => {
        const username = activeConnections[socket.id];
        if (!username || !db.users[username]) return;

        db.users[username].status = data.status;
        db.users[username].avatar = data.avatar;
        saveDB();

        socket.emit('init_self', { name: username, avatar: data.avatar, status: data.status });
        sendUsersList();
    });

    // 4. Запрос истории чата
    socket.on('get_chat_history', (targetUser) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, targetUser].sort().join('_');
        const history = db.messages[roomKey] || [];
        socket.emit('chat_history_response', { targetUser: targetUser, history: history });
    });

    // 5. Обработка статуса "Печатает..."
    socket.on('typing_status', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing', { fromUser: username, isTyping: data.isTyping });
        }
    });

    // 6. Отправка сообщений
    socket.on('send_direct_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        if (!db.messages[roomKey]) db.messages[roomKey] = [];

        const messagePayload = {
            id: Date.now() + Math.random().toString(36).substr(2, 5), // уникальный id сообщения
            sender: username,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        db.messages[roomKey].push(messagePayload);
        saveDB();

        // Отправка получателю (если онлайн)
        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', { from: username, message: messagePayload });
        }
        // Подтверждение отправителю
        socket.emit('message_sent_confirm', { toUser: data.toUser, message: messagePayload });
    });

    // 7. Удаление сообщения
    socket.on('delete_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        if (!db.messages[roomKey]) return;

        // Фильтруем сообщения, удаляя выбранное по id
        db.messages[roomKey] = db.messages[roomKey].filter(msg => msg.id !== data.messageId);
        saveDB();

        // Уведомляем обе стороны чата об обновлении истории
        socket.emit('message_deleted_sync', { targetUser: data.toUser, history: db.messages[roomKey] });

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('message_deleted_sync', { targetUser: username, history: db.messages[roomKey] });
        }
    });

    socket.on('disconnect', () => {
        delete activeConnections[socket.id];
        sendUsersList();
    });
});

function sendUsersList() {
    const list = Object.keys(db.users).map(name => ({
        name: name,
        avatar: db.users[name].avatar,
        status: db.users[name].status,
        isOnline: Object.values(activeConnections).includes(name)
    }));
    io.emit('update_users_list', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}`);
});
