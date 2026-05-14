const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_FILE = path.join(__dirname, 'database.json');

// Инициализация базы данных
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        const fileData = fs.readFileSync(DB_FILE, 'utf8').trim();
        if (fileData) {
            db = JSON.parse(fileData);
            if (!db.users) db.users = {};
            if (!db.messages) db.messages = {};
        }
    } catch (e) {
        console.error("Ошибка чтения БД, создаем чистую:", e);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error("Ошибка сохранения БД:", e);
    }
}

// Отдача статики
app.use(express.static(path.join(__dirname)));

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Сервер теперь гарантированно отдает HTML, а не свой код
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let activeConnections = {}; // socket.id -> username

io.on('connection', (socket) => {
    // 1. Регистрация
    socket.on('register_account', (data) => {
        const username = data.username ? data.username.trim() : "";
        const password = data.password ? data.password.trim() : "";

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

    // 2. Вход
    socket.on('login_account', (data) => {
        const username = data.username ? data.username.trim() : "";
        const password = data.password ? data.password.trim() : "";

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

        const roomKey = [username, targetUser].sort().join('_');
        const history = db.messages[roomKey] || [];
        socket.emit('chat_history_response', { targetUser: targetUser, history: history });
    });

    // 5. Статус "Печатает..."
    socket.on('typing_status', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing', { fromUser: username, isTyping: data.isTyping });
        }
    });

    // 6. ПЕРЕПИСАННАЯ ОТПРАВКА СООБЩЕНИЙ (Без багов)
    socket.on('send_direct_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const targetUser = data.toUser;
        const roomKey = [username, targetUser].sort().join('_');

        const messagePayload = {
            id: Date.now() + Math.random().toString(36).substr(2, 9), // Уникальный ID для удаления
            sender: username,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!db.messages[roomKey]) db.messages[roomKey] = [];
        db.messages[roomKey].push(messagePayload);
        saveDB();

        // Отправка отправителю
        socket.emit('message_sent_confirm', { targetUser: targetUser, msg: messagePayload });

        // Отправка получателю (если он онлайн)
        const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === targetUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', { fromUser: username, msg: messagePayload });
        }
    });

    // 7. ПЕРЕПИСАННОЕ УДАЛЕНИЕ СООБЩЕНИЙ
    socket.on('delete_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const targetUser = data.toUser;
        const msgId = data.msgId;
        const roomKey = [username, targetUser].sort().join('_');

        if (db.messages[roomKey]) {
            db.messages[roomKey] = db.messages[roomKey].filter(m => m.id !== msgId);
            saveDB();

            // Уведомляем обе стороны об удалении конкретного сообщения по ID
            socket.emit('message_deleted_sync', { targetUser: targetUser, msgId: msgId });
            
            const targetSocketId = Object.keys(activeConnections).find(key => activeConnections[key] === targetUser);
            if (targetSocketId) {
                io.to(targetSocketId).emit('message_deleted_sync', { targetUser: username, msgId: msgId });
            }
        }
    });

    socket.on('disconnect', () => {
        delete activeConnections[socket.id];
        sendUsersList();
    });
});

function sendUsersList() {
    const usersList = Object.keys(db.users).map(name => {
        const isOnline = Object.values(activeConnections).includes(name);
        return {
            name: name,
            avatar: db.users[name].avatar || "🤖",
            status: db.users[name].status || "Доступен",
            isOnline: isOnline
        };
    });
    io.emit('update_users_list', usersList);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
