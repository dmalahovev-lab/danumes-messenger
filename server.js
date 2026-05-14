const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_FILE = path.join(__dirname, 'database.json');

// Проверка и инициализация базы данных
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.users) db.users = {};
        if (!db.messages) db.messages = {};
    } catch (e) {
        console.error("Ошибка чтения базы, создаем чистую...");
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error("Ошибка сохранения базы данных:", e);
    }
}

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Хранилище активных подключений в реальном времени: socket.id -> username
let activeConnections = {};

io.on('connection', (socket) => {
    console.log(`Подключился сокет: ${socket.id}`);

    // Отправка актуального списка пользователей всем в сети
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

    // 1. Регистрация нового аккаунта
    socket.on('register_account', (data) => {
        if (!data || !data.username || !data.password) {
            return socket.emit('auth_error', 'Заполните все поля!');
        }
        const username = data.username.trim();
        const password = data.password.trim();

        if (db.users[username]) {
            return socket.emit('auth_error', 'Пользователь с таким именем уже существует!');
        }

        db.users[username] = {
            password: password,
            avatar: "🤖",
            status: "Доступен"
        };
        saveDB();
        
        socket.emit('auth_success', { username, msg: 'Регистрация успешна! Теперь вы можете войти.' });
        sendUsersList();
    });

    // 2. Вход в существующий аккаунт
    socket.on('login_account', (data) => {
        if (!data || !data.username || !data.password) {
            return socket.emit('auth_error', 'Заполните все поля!');
        }
        const username = data.username.trim();
        const password = data.password.trim();

        if (!db.users[username] || db.users[username].password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль');
        }

        activeConnections[socket.id] = username;
        
        socket.emit('init_self', {
            name: username,
            avatar: db.users[username].avatar || "🤖",
            status: db.users[username].status || "Доступен"
        });

        sendUsersList();
    });

    // 3. Обновление профиля
    socket.on('update_profile', (data) => {
        const username = activeConnections[socket.id];
        if (!username || !db.users[username]) return;

        db.users[username].status = data.status;
        db.users[username].avatar = data.avatar;
        saveDB();

        socket.emit('init_self', {
            name: username,
            avatar: db.users[username].avatar,
            status: db.users[username].status
        });
        sendUsersList();
    });

    // 4. Запрос истории чата
    socket.on('get_chat_history', (targetUser) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, targetUser].sort().join("_");
        const history = db.messages[roomKey] || [];
        socket.emit('chat_history_response', { targetUser, history });
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
        if (!username || !data.toUser || !data.text.trim()) return;

        const roomKey = [username, data.toUser].sort().join("_");
        if (!db.messages[roomKey]) db.messages[roomKey] = [];

        const newMsg = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: username,
            text: data.text.trim(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        db.messages[roomKey].push(newMsg);
        saveDB();

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        
        // Отправляем получателю
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', { from: username, msg: newMsg, roomKey });
        }
        // Подтверждаем отправителю
        socket.emit('message_sent_confirm', { toUser: data.toUser, msg: newMsg, roomKey });
    });

    // 7. Удаление сообщения
    socket.on('delete_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username || !data.roomKey || !data.msgId) return;

        if (db.messages[data.roomKey]) {
            db.messages[data.roomKey] = db.messages[data.roomKey].filter(m => m.id !== data.msgId);
            saveDB();

            // Уведомляем обоих участников чата для синхронного удаления на экранах
            const participants = data.roomKey.split("_");
            participants.forEach(user => {
                const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === user);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('message_deleted_sync', { roomKey: data.roomKey, msgId: data.msgId });
                }
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Отключился сокет: ${socket.id}`);
        delete activeConnections[socket.id];
        sendUsersList();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}!`);
});
