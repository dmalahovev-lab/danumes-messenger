const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Инициализация Socket.IO с поддержкой CORS
const io = new Server(server, {
    cors: { origin: "*" }
});

const DB_PATH = path.join(__dirname, 'database.json');

// Инициализация базы данных, если файл отсутствует или пуст
if (!fs.existsSync(DB_PATH) || fs.readFileSync(DB_PATH, 'utf8').trim() === "") {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, messages: {} }, null, 2), 'utf8');
}

// Функции чтения и записи БД
function readDB() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { users: {}, messages: {} };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Принудительная раздача статических файлов из текущей директории
app.use(express.static(__dirname));

// Маршрут для отдачи главного интерфейса
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Хранилище активных подключений в оперативной памяти: socket.id -> username
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log(`Подключен клиент: ${socket.id}`);

    // Авторизация (Вход)
    socket.on('auth_login', (data) => {
        const db = readDB();
        const username = data.username.trim();
        const password = data.password;

        if (!db.users[username] || db.users[username].password !== password) {
            return socket.emit('auth_error', { message: "Недействительный Логин/Пароль" });
        }

        onlineUsers[socket.id] = username;
        
        // Формируем список пользователей для отправки клиенту
        const userList = Object.keys(db.users).map(name => ({
            name: name,
            avatar: db.users[name].avatar || "🤖",
            status: db.users[name].status || "Доступен",
            isOnline: Object.values(onlineUsers).includes(name)
        }));

        socket.emit('auth_success', {
            username: username,
            avatar: db.users[username].avatar || "🤖",
            status: db.users[username].status || "Доступен",
            allUsers: userList
        });

        io.emit('global_update_users', userList);
    });

    // Регистрация нового аккаунта
    socket.on('auth_register', (data) => {
        const db = readDB();
        const username = data.username.trim();
        const password = data.password;

        if (!username || !password) {
            return socket.emit('auth_error', { message: "Заполните все поля!" });
        }
        if (db.users[username]) {
            return socket.emit('auth_error', { message: "Пользователь уже существует" });
        }

        // Создаем пользователя в базе данных
        db.users[username] = {
            password: password,
            avatar: "🤖",
            status: "Доступен"
        };
        writeDB(db);

        socket.emit('register_success', { message: "Аккаунт успешно создан! Теперь войдите." });
    });

    // Обновление настроек профиля
    socket.on('update_profile', (data) => {
        const username = onlineUsers[socket.id];
        if (!username) return;

        const db = readDB();
        if (db.users[username]) {
            db.users[username].avatar = data.avatar;
            db.users[username].status = data.status;
            writeDB(db);

            const userList = Object.keys(db.users).map(name => ({
                name: name,
                avatar: db.users[name].avatar || "🤖",
                status: db.users[name].status || "Доступен",
                isOnline: Object.values(onlineUsers).includes(name)
            }));

            socket.emit('profile_updated', { avatar: data.avatar, status: data.status });
            io.emit('global_update_users', userList);
        }
    });

    // Запрос истории чата между двумя пользователями
    socket.on('get_chat_history', (data) => {
        const currentUsername = onlineUsers[socket.id];
        if (!currentUsername) return;

        const db = readDB();
        const chatKey = [currentUsername, data.withUser].sort().join('_');
        const history = db.messages[chatKey] || [];

        socket.emit('chat_history_response', { withUser: data.withUser, history: history });
    });

    // Отправка мгновенного сообщения
    socket.on('send_direct_message', (data) => {
        const sender = onlineUsers[socket.id];
        if (!sender) return;

        const recipient = data.toUser;
        const db = readDB();
        const chatKey = [sender, recipient].sort().join('_');

        if (!db.messages[chatKey]) {
            db.messages[chatKey] = [];
        }

        const messagePayload = {
            sender: sender,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        db.messages[chatKey].push(messagePayload);
        writeDB(db);

        // Пересылаем получателю, если он онлайн
        Object.keys(onlineUsers).forEach(sid => {
            if (onlineUsers[sid] === recipient) {
                io.to(sid).emit('receive_direct_message', { from: sender, text: data.text });
                io.to(sid).emit('trigger_sound');
            }
        });

        // Подтверждаем отправку отправителю
        socket.emit('message_sent_confirm', { toUser: recipient, text: data.text });
    });

    // Удаление сообщения из истории
    socket.on('delete_message', (data) => {
        const currentUsername = onlineUsers[socket.id];
        if (!currentUsername) return;

        const db = readDB();
        const chatKey = [currentUsername, data.withUser].sort().join('_');

        if (db.messages[chatKey] && db.messages[chatKey][data.index]) {
            db.messages[chatKey].splice(data.index, 1);
            writeDB(db);

            // Отправляем обновленную историю обоим участникам, если они онлайн
            Object.keys(onlineUsers).forEach(sid => {
                if (onlineUsers[sid] === currentUsername || onlineUsers[sid] === data.withUser) {
                    io.to(sid).emit('chat_history_response', { 
                        withUser: onlineUsers[sid] === currentUsername ? data.withUser : currentUsername, 
                        history: db.messages[chatKey] 
                    });
                }
            });
        }
    });

    // Пересылка статуса "печатает..."
    socket.on('typing_status', (data) => {
        const sender = onlineUsers[socket.id];
        if (!sender) return;

        Object.keys(onlineUsers).forEach(sid => {
            if (onlineUsers[sid] === data.toUser) {
                io.to(sid).emit('user_typing', { from: sender, isTyping: data.isTyping });
            }
        });
    });

    // Обработка отключения пользователя
    socket.on('disconnect', () => {
        const username = onlineUsers[socket.id];
        if (username) {
            delete onlineUsers[socket.id];
            const db = readDB();
            const userList = Object.keys(db.users).map(name => ({
                name: name,
                avatar: db.users[name].avatar || "🤖",
                status: db.users[name].status || "Доступен",
                isOnline: Object.values(onlineUsers).includes(name)
            }));
            io.emit('global_update_users', userList);
        }
        console.log(`Клиент отключился: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
