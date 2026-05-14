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

// Путь к нашей локальной базе данных JSON
const DB_PATH = path.join(__dirname, 'database.json');

// Загрузка данных из файла базы
function loadData() {
    if (!fs.existsSync(DB_PATH)) {
        return { users: {}, chatHistories: {} };
    }
    try {
        const raw = fs.readFileSync(DB_PATH);
        return JSON.parse(raw);
    } catch (e) {
        return { users: {}, chatHistories: {} };
    }
}

// Сохранение данных в файл базы
function saveData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let connectedUsers = {}; // socket.id -> username

io.on('connection', (socket) => {
    
    // Обработка Входа (Авторизация)
    socket.on('login_user', (data) => {
        const db = loadData();
        const username = data.username.trim();
        const password = data.password;

        if (!db.users[username] || db.users[username].password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль.');
        }

        // Успешный вход
        connectedUsers[socket.id] = username;
        db.users[username].isOnline = true;
        saveData(db);

        // Отправляем пользователю его профиль и историю
        socket.emit('init_self', {
            name: username,
            status: db.users[username].status,
            avatar: db.users[username].avatar,
            histories: db.chatHistories[username] || {}
        });

        sendOnlineList();
    });

    // Обработка Регистрации
    socket.on('register_user', (data) => {
        const db = loadData();
        const username = data.username.trim();
        const password = data.password;

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля формы.');
        }
        if (db.users[username]) {
            return socket.emit('auth_error', 'Пользователь с таким именем уже существует.');
        }

        // Создаем нового пользователя в БД
        db.users[username] = {
            password: password,
            status: "Доступен",
            avatar: "🤖",
            isOnline = true
        };
        if (!db.chatHistories[username]) db.chatHistories[username] = {};
        saveData(db);

        connectedUsers[socket.id] = username;
        
        socket.emit('init_self', {
            name: username,
            status: "Доступен",
            avatar: "🤖",
            histories: {}
        });

        sendOnlineList();
    });

    // Статус набора текста "Печатает..."
    socket.on('typing_status', (data) => {
        const myName = connectedUsers[socket.id];
        if (!myName) return;

        // Ищем socket id получателя
        const targetSocketId = Object.keys(connectedUsers).find(
            key => connectedUsers[key] === data.toUser
        );

        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing', { fromUser: myName, isTyping: data.isTyping });
        }
    });

    // Обновление профиля
    socket.on('update_profile', (data) => {
        const username = connectedUsers[socket.id];
        if (!username) return;

        const db = loadData();
        if (db.users[username]) {
            db.users[username].status = data.status;
            db.users[username].avatar = data.avatar;
            saveData(db);

            socket.emit('init_self', {
                name: username,
                status: data.status,
                avatar: data.avatar,
                histories: db.chatHistories[username] || {}
            });
            sendOnlineList();
        }
    });

    // Отправка сообщений
    socket.on('send_direct_message', (data) => {
        const senderName = connectedUsers[socket.id];
        if (!senderName) return;

        const targetName = data.toUser;
        const db = loadData();

        const messagePayload = {
            from: senderName,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Сохраняем в историю отправителя
        if (!db.chatHistories[senderName]) db.chatHistories[senderName] = {};
        if (!db.chatHistories[senderName][targetName]) db.chatHistories[senderName][targetName] = [];
        db.chatHistories[senderName][targetName].push({ sender: 'user', text: data.text });

        // Сохраняем в историю получателя
        if (!db.chatHistories[targetName]) db.chatHistories[targetName] = {};
        if (!db.chatHistories[targetName][senderName]) db.chatHistories[targetName][senderName] = [];
        db.chatHistories[targetName][senderName].push({ sender: 'friend', text: data.text });

        saveData(db);

        // Ищем получателя в сети
        const targetSocketId = Object.keys(connectedUsers).find(key => connectedUsers[key] === targetName);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', messagePayload);
        }
        
        socket.emit('message_sent_confirm', messagePayload);
    });

    // Удаление сообщения
    socket.on('delete_message_req', (data) => {
        const senderName = connectedUsers[socket.id];
        if (!senderName) return;

        const db = loadData();
        if (db.chatHistories[senderName] && db.chatHistories[senderName][data.toUser]) {
            db.chatHistories[senderName][data.toUser].splice(data.index, 1);
            saveData(db);
        }
    });

    socket.on('disconnect', () => {
        const username = connectedUsers[socket.id];
        if (username) {
            const db = loadData();
            if (db.users[username]) db.users[username].isOnline = false;
            saveData(db);
            delete connectedUsers[socket.id];
        }
        sendOnlineList();
    });

    function sendOnlineList() {
        const db = loadData();
        const list = Object.keys(db.users).map(name => ({
            name: name,
            status: db.users[name].status,
            avatar: db.users[name].avatar,
            isOnline: db.users[name].isOnline
        }));
        io.emit('update_users_list', list);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}!`);
});
