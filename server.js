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

// Пути к файлам базы данных на сервере
const DB_USERS = path.join(__dirname, 'users.json');
const DB_CHATS = path.join(__dirname, 'chats.json');

// Вспомогательные функции для чтения/записи базы данных
function readData(filePath, defaultData = []) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content || JSON.stringify(defaultData));
    } catch (e) {
        console.error("Ошибка чтения файла БД:", e);
        return defaultData;
    }
}

function writeData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Ошибка записи в файл БД:", e);
    }
}

// Загружаем данные в память при старте сервера
let dbUsers = readData(DB_USERS);
let dbChats = readData(DB_CHATS);
let activeConnections = {}; // socket.id -> username

io.on('connection', (socket) => {
    
    // ЛОГИКА РЕГИСТРАЦИИ
    socket.on('auth_register', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля!');
        }

        dbUsers = readData(DB_USERS);
        const userExists = dbUsers.find(u => u.name.toLowerCase() === username.toLowerCase());
        
        if (userExists) {
            return socket.emit('auth_error', 'Этот логин уже занят!');
        }

        const newUser = {
            id: Date.now(),
            name: username,
            password: password, // В учебных целях храним строкой
            status: "Доступен",
            avatar: "🤖"
        };

        dbUsers.push(newUser);
        writeData(DB_USERS, dbUsers);

        // Автоматически логиним после успешной регистрации
        logUserIn(socket, newUser);
    });

    // ЛОГИКА ВХОДА
    socket.on('auth_login', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        dbUsers = readData(DB_USERS);
        const user = dbUsers.find(u => u.name.toLowerCase() === username.toLowerCase());

        if (!user || user.password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/Пароль');
        }

        logUserIn(socket, user);
    });

    function logUserIn(socket, user) {
        activeConnections[socket.id] = user.name;
        
        // Отправляем пользователю его профиль
        socket.emit('init_self', user);
        
        // Рассылаем список всех пользователей с пометкой, кто онлайн
        sendOnlineList();
    }

    function sendOnlineList() {
        dbUsers = readData(DB_USERS);
        const onlineNames = Object.values(activeConnections);
        
        const preparedList = dbUsers.map(u => ({
            id: u.id,
            name: u.name,
            status: u.status,
            avatar: u.avatar,
            isOnline: onlineNames.includes(u.name)
        }));
        
        io.emit('update_users_list', preparedList);
    }

    // СТАТУС ПЕЧАТАЕТ
    socket.on('typing_status', (data) => {
        const myName = activeConnections[socket.id];
        if (!myName) return;

        const targetSocketId = Object.keys(activeConnections).find(
            key => activeConnections[key] === data.toUser
        );

        if (targetSocketId) {
            io.to(targetSocketId).emit('typing_receive', { fromUser: myName, isTyping: data.isTyping });
        }
    });

    // ОБНОВЛЕНИЕ ПРОФИЛЯ
    socket.on('update_profile', (data) => {
        const myName = activeConnections[socket.id];
        if (!myName) return;

        dbUsers = readData(DB_USERS);
        const idx = dbUsers.findIndex(u => u.name === myName);
        if (idx !== -1) {
            dbUsers[idx].status = data.status;
            dbUsers[idx].avatar = data.avatar;
            writeData(DB_USERS, dbUsers);
            
            socket.emit('init_self', dbUsers[idx]);
            sendOnlineList();
        }
    });

    // ЗАПРОС ИСТОРИИ ЧАТА
    socket.on('request_chat_history', (data) => {
        const myName = activeConnections[socket.id];
        if (!myName) return;

        dbChats = readData(DB_CHATS);
        // Фильтруем сообщения между двумя этими пользователями
        const history = dbChats.filter(m => 
            (m.from === myName && m.to === data.friendName) || 
            (m.from === data.friendName && m.to === myName)
        );

        socket.emit('receive_chat_history', { friendName: data.friendName, history: history });
    });

    // ОТПРАВКА СООБЩЕНИЯ
    socket.on('send_direct_message', (data) => {
        const myName = activeConnections[socket.id];
        if (!myName) return;

        const newMsg = {
            id: Date.now(),
            from: myName,
            to: data.toUser,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        dbChats = readData(DB_CHATS);
        dbChats.push(newMsg);
        writeData(DB_CHATS, dbChats);

        // Отправляем получателю
        const targetSocketId = Object.keys(activeConnections).find(
            key => activeConnections[key] === data.toUser
        );
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', newMsg);
        }
        
        // Подтверждаем отправителю
        socket.emit('message_sent_confirm', newMsg);
    });

    // УДАЛЕНИЕ СООБЩЕНИЯ
    socket.on('delete_message_req', (data) => {
        dbChats = readData(DB_CHATS);
        // Удаляем сообщение по ID из базы
        dbChats = dbChats.filter(m => m.id !== data.msgId);
        writeData(DB_CHATS, dbChats);

        // Оповещаем второго участника, если он в сети, о необходимости перерисовать чат
        const targetSocketId = Object.keys(activeConnections).find(
            key => activeConnections[key] === data.friendName
        );
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('message_deleted_sync', { friendName: activeConnections[socket.id] });
        }
        socket.emit('message_deleted_sync', { friendName: data.friendName });
    });

    socket.on('disconnect', () => {
        if (activeConnections[socket.id]) {
            delete activeConnections[socket.id];
            sendOnlineList();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}!`);
});
