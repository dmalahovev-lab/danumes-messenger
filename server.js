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

// --- Простая JSON База Данных ---
const DB_FILE = path.join(__dirname, 'database.json');
let db = { users: {}, messages: [] }; // users: { username: { password, avatar, status } }

if (fs.existsSync(DB_FILE)) {
    try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { console.log("Ошибка БД, создаем новую"); }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }

let activeSockets = {}; // socket.id -> username

io.on('connection', (socket) => {
    // Авторизация / Регистрация
    socket.on('auth_user', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();
        if (!username || !password) return socket.emit('auth_error', 'Заполните все поля');

        if (db.users[username]) {
            // Проверка пароля существующего юзера
            if (db.users[username].password !== password) {
                return socket.emit('auth_error', 'Неверный пароль для этого имени');
            }
        } else {
            // Регистрация нового юзера
            db.users[username] = { password: password, status: "Доступен", avatar: "🤖" };
            saveDB();
        }

        activeSockets[socket.id] = username;
        
        // Отправляем личные данные профиля
        socket.emit('init_self', { 
            name: username, 
            status: db.users[username].status, 
            avatar: db.users[username].avatar 
        });

        // Отправляем историю сообщений для этого пользователя
        const userHistory = db.messages.filter(m => m.from === username || m.to === username);
        socket.emit('load_history', userHistory);

        // Рассылаем всем обновленный список пользователей в сети
        broadcastUsersList();
    });

    // Изменение профиля
    socket.on('update_profile', (data) => {
        const username = activeSockets[socket.id];
        if (username && db.users[username]) {
            db.users[username].status = data.status;
            db.users[username].avatar = data.avatar;
            saveDB();
            
            socket.emit('init_self', { name: username, status: data.status, avatar: data.avatar });
            broadcastUsersList();
        }
    });

    // Статус "Печатает..."
    socket.on('typing_status', (data) => {
        const username = activeSockets[socket.id];
        if (!username) return;
        
        const targetSocketId = Object.keys(activeSockets).find(key => activeSockets[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('user_typing_echo', { fromUser: username, isTyping: data.isTyping });
        }
    });

    // Отправка сообщений
    socket.on('send_direct_message', (data) => {
        const username = activeSockets[socket.id];
        if (!username) return;

        const messagePayload = {
            from: username,
            to: data.toUser,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Сохраняем в историю на сервере
        db.messages.push(messagePayload);
        saveDB();

        // Пересылаем получателю в реальном времени
        const targetSocketId = Object.keys(activeSockets).find(key => activeSockets[key] === data.toUser);
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', messagePayload);
        }
        // Подтверждаем отправителю
        socket.emit('message_sent_confirm', messagePayload);
    });

    socket.on('disconnect', () => {
        delete activeSockets[socket.id];
        broadcastUsersList();
    });
});

function broadcastUsersList() {
    const list = Object.keys(db.users).map(name => ({
        name: name,
        status: db.users[name].status,
        avatar: db.users[name].avatar,
        isOnline: Object.values(activeSockets).includes(name)
    }));
    io.emit('update_users_list', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 DanuMes запущен на порту ${PORT}`));
