const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Путь к базе данных
const DB_FILE = path.join(__dirname, 'database.json');

// Инициализация базы данных
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Ошибка чтения БД, сброс:", e);
    }
}

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error("Ошибка сохранения БД:", e);
    }
}

// Активные сокеты онлайн-пользователей
let activeConnections = {}; // socket.id -> username

io.on('connection', (socket) => {
    console.log(`Подключение сокета: ${socket.id}`);

    // 1. Регистрация нового аккаунта
    socket.on('register_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля для регистрации!');
        }

        if (db.users[username]) {
            return socket.emit('auth_error', 'Пользователь с таким именем уже существует!');
        }

        // Сохраняем нового пользователя
        db.users[username] = {
            password: password,
            avatar: "🤖",
            status: "Доступен"
        };
        saveDB();

        socket.emit('auth_success', 'Регистрация успешна! Теперь вы можете войти.');
    });

    // 2. Вход в систему (Авторизация)
    socket.on('login_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля для входа!');
        }

        if (!db.users[username] || db.users[username].password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль');
        }

        // Авторизация успешна. Привязываем сокет к пользователю
        activeConnections[socket.id] = username;

        // Отправляем личные данные пользователя
        socket.emit('init_self', {
            name: username,
            avatar: db.users[username].avatar,
            status: db.users[username].status
        });

        // Рассылаем всем обновленный список пользователей
        sendUsersList();
    });

    // 3. Изменение профиля (Статус, Аватарка)
    socket.on('update_profile', (data) => {
        const username = activeConnections[socket.id];
        if (!username || !db.users[username]) return;

        db.users[username].status = data.status;
        db.users[username].avatar = data.avatar;
        saveDB();

        // Отправляем подтверждение пользователю и обновляем списки у всех
        socket.emit('init_self', {
            name: username,
            avatar: db.users[username].avatar,
            status: db.users[username].status
        });
        sendUsersList();
    });

    // 4. Запрос истории переписки при открытии чата
    socket.on('get_chat_history', (targetUser) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, targetUser].sort().join('_');
        const history = db.messages[roomKey] || [];

        socket.emit('chat_history_response', {
            targetUser: targetUser,
            history: history
        });
    });

    // 5. Обработка статуса ввода текста ("Печатает...")
    socket.on('typing_status', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        // Ищем socket id получателя, чтобы сказать ему, что мы печатаем
        const targetSocketId = Object.keys(activeConnections).find(
            key => activeConnections[key] === data.toUser
        );

        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing', {
                fromUser: username,
                isTyping: data.isTyping
            });
        }
    });

    // 6. Отправка сообщений
    socket.on('send_direct_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');
        
        const messagePayload = {
            sender: username,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (!db.messages[roomKey]) {
            db.messages[roomKey] = [];
        }
        db.messages[roomKey].push(messagePayload);
        saveDB();

        // Отправляем получателю (если он онлайн)
        const targetSocketId = Object.keys(activeConnections).find(
            key => activeConnections[key] === data.toUser
        );
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', messagePayload);
        }

        // Подтверждаем отправку самому отправителю
        socket.emit('message_sent_confirm', messagePayload);
    });

    // 7. Удаление сообщения из истории
    socket.on('delete_message', (data) => {
        const username = activeConnections[socket.id];
        if (!username) return;

        const roomKey = [username, data.toUser].sort().join('_');

        if (db.messages[roomKey] && db.messages[roomKey][data.index]) {
            db.messages[roomKey].splice(data.index, 1);
            saveDB();

            // Оповещаем обе стороны диалога об обновлении чата
            socket.emit('message_deleted_sync', { targetUser: data.toUser, history: db.messages[roomKey] });

            const targetSocketId = Object.keys(activeConnections).find(
                key => activeConnections[key] === data.toUser
            );
            if (targetSocketId) {
                io.to(targetSocketId).emit('message_deleted_sync', { targetUser: username, history: db.messages[roomKey] });
            }
        }
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        if (activeConnections[socket.id]) {
            delete activeConnections[socket.id];
            sendUsersList();
        }
        console.log(`Отключение сокета: ${socket.id}`);
    });

    // Функция генерации глобального списка пользователей
    function sendUsersList() {
        const list = Object.keys(db.users).map(name => {
            return {
                name: name,
                avatar: db.users[name].avatar,
                status: db.users[name].status,
                isOnline: Object.values(activeConnections).includes(name)
            };
        });
        io.emit('update_users_list', list);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
