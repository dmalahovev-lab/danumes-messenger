const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// База данных сервера (в оперативной памяти)
let usersDatabase = {}; // username -> password
let onlineUsers = {};   // socket.id -> { name, status, avatar }
let globalMessages = []; // Хранилище всех сообщений в системе

io.on('connection', (socket) => {
    console.log(`Подключен клиент: ${socket.id}`);

    // Обработка регистрации
    socket.on('register_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля!');
        }
        if (usersDatabase[username]) {
            return socket.emit('auth_error', 'Этот логин уже занят!');
        }

        // Сохраняем в базу данных
        usersDatabase[username] = password;
        
        // Автоматически авторизуем после регистрации
        authorizeUser(socket, username);
    });

    // Обработка входа
    socket.on('login_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!usersDatabase[username] || usersDatabase[username] !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль.');
        }

        authorizeUser(socket, username);
    });

    function authorizeUser(socket, username) {
        onlineUsers[socket.id] = { name: username, status: "Доступен", avatar: "🤖" };
        
        // Отправляем пользователю подтверждение успешного входа
        socket.emit('auth_success', onlineUsers[socket.id]);
        
        // Отправляем всю историю сообщений для этого пользователя
        socket.emit('load_history', globalMessages);

        // Обновляем список пользователей для всех в сети
        io.emit('update_users_list', Object.values(onlineUsers));
    }

    // Обновление профиля
    socket.on('update_profile', (data) => {
        if (onlineUsers[socket.id]) {
            onlineUsers[socket.id].status = data.status;
            onlineUsers[socket.id].avatar = data.avatar;
            io.emit('update_users_list', Object.values(onlineUsers));
            socket.emit('init_self', onlineUsers[socket.id]);
        }
    });

    // Статус "Печатает..."
    socket.on('typing_status', (data) => {
        if (onlineUsers[socket.id]) {
            socket.broadcast.emit('user_typing', {
                from: onlineUsers[socket.id].name,
                isTyping: data.isTyping
            });
        }
    });

    // Отправка сообщений
    socket.on('send_direct_message', (data) => {
        if (!onlineUsers[socket.id]) return;

        const msgPayload = {
            id: Date.now(),
            from: onlineUsers[socket.id].name,
            toUser: data.toUser,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Сохраняем сообщение в историю на сервере
        globalMessages.push(msgPayload);

        // Ищем получателя в сети
        const targetSocketId = Object.keys(onlineUsers).find(
            key => onlineUsers[key].name === data.toUser
        );

        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', msgPayload);
        }
        socket.emit('message_sent_confirm', msgPayload);
    });

    socket.on('disconnect', () => {
        if (onlineUsers[socket.id]) {
            delete onlineUsers[socket.id];
            io.emit('update_users_list', Object.values(onlineUsers));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes работает на порту ${PORT}`);
});
