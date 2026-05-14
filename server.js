const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Пути к локальной базе данных JSON
const USERS_FILE = path.join(__dirname, 'users.json');
const CHATS_FILE = path.join(__dirname, 'chats.json');

// Загрузка данных из файлов при старте
let dbUsers = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')) : {};
let dbChats = fs.existsSync(CHATS_FILE) ? JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8')) : {};

// Временное хранилище онлайн-пользователей: socket.id -> username
let onlineUsers = {};

function saveDB() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(dbUsers, null, 2));
    fs.writeFileSync(CHATS_FILE, JSON.stringify(dbChats, null, 2));
}

// Помощник для генерации ключа чата между двумя пользователями (по алфавиту)
function getChatKey(u1, u2) {
    return [u1, u2].sort().join('_amp_');
}

io.on('connection', (socket) => {
    // 1. Логика Авторизации / Регистрации
    socket.on('auth_user', (data) => {
        const { username, password, type } = data;
        
        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля');
        }

        if (type === 'register') {
            if (dbUsers[username]) {
                return socket.emit('auth_error', 'Пользователь уже существует');
            }
            dbUsers[username] = { username, password, status: "Доступен", avatar: "🤖" };
            saveDB();
        } else {
            if (!dbUsers[username] || dbUsers[username].password !== password) {
                return socket.emit('auth_error', 'Неверное имя или пароль');
            }
        }

        // Успешный вход
        onlineUsers[socket.id] = username;
        socket.emit('auth_success', dbUsers[username]);
        
        // Отправляем список всех существующих в системе пользователей
        broadcastUsersList();
    });

    function broadcastUsersList() {
        const list = Object.values(dbUsers).map(u => ({
            name: u.username,
            status: u.status,
            avatar: u.avatar,
            isOnline: Object.values(onlineUsers).includes(u.username)
        }));
        io.emit('update_users_list', list);
    }

    // 2. Обновление профиля
    socket.on('update_profile', (data) => {
        const username = onlineUsers[socket.id];
        if (username && dbUsers[username]) {
            dbUsers[username].status = data.status;
            dbUsers[username].avatar = data.avatar;
            saveDB();
            socket.emit('init_self', dbUsers[username]);
            broadcastUsersList();
        }
    });

    // 3. Запрос истории сообщений при открытии чата
    socket.on('get_chat_history', (targetUser) => {
        const username = onlineUsers[socket.id];
        if (!username) return;
        const chatKey = getChatKey(username, targetUser);
        const history = dbChats[chatKey] || [];
        socket.emit('chat_history_response', { targetUser, history });
    });

    // 4. Отправка сообщений с сохранением в базу
    socket.on('send_direct_message', (data) => {
        const username = onlineUsers[socket.id];
        if (!username) return;

        const chatKey = getChatKey(username, data.toUser);
        if (!dbChats[chatKey]) dbChats[chatKey] = [];

        const messagePayload = {
            id: Date.now(),
            from: username,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        dbChats[chatKey].push(messagePayload);
        saveDB();

        // Отправляем получателю (если он онлайн)
        const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', messagePayload);
        }
        // Подтверждаем отправителю
        socket.emit('message_sent_confirm', { toUser: data.toUser, msg: messagePayload });
    });

    // 5. Удаление сообщения из базы
    socket.on('delete_message_req', (data) => {
        const username = onlineUsers[socket.id];
        if (!username) return;
        const chatKey = getChatKey(username, data.targetUser);
        if (dbChats[chatKey]) {
            dbChats[chatKey] = dbChats[chatKey].filter(m => m.id !== data.msgId);
            saveDB();
            
            // Уведомляем второго участника, если он онлайн
            const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === data.targetUser);
            if (targetSocketId) io.to(targetSocketId).emit('message_deleted_sync', { fromUser: username, msgId: data.msgId });
            
            socket.emit('message_deleted_sync', { fromUser: data.targetUser, msgId: data.msgId });
        }
    });

    // 6. Статус "Печатает..."
    socket.on('typing_state', (data) => {
        const username = onlineUsers[socket.id];
        if (!username) return;
        const targetSocketId = Object.keys(onlineUsers).find(key => onlineUsers[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('typing_receive', { fromUser: username, isTyping: data.isTyping });
        }
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        broadcastUsersList();
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}!`);
});
