const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let connectedUsers = {}; 
let allUsers = [];

io.on('connection', (socket) => {
    socket.on('register_user', (username) => {
        const userId = Date.now(); 
        // По умолчанию ставим статус "Доступен" и стандартную аватарку-смайлик
        connectedUsers[socket.id] = { id: userId, name: username, status: "Доступен", avatar: "🤖" };
        allUsers.push(connectedUsers[socket.id]);
        
        io.emit('update_users_list', allUsers);
        socket.emit('init_self', connectedUsers[socket.id]);
    });

    // Обновление профиля пользователя
    socket.on('update_profile', (data) => {
        if (connectedUsers[socket.id]) {
            connectedUsers[socket.id].status = data.status;
            connectedUsers[socket.id].avatar = data.avatar;
            
            // Обновляем в общем списке
            const idx = allUsers.findIndex(u => u.name === connectedUsers[socket.id].name);
            if (idx !== -1) allUsers[idx] = connectedUsers[socket.id];

            io.emit('update_users_list', allUsers);
            socket.emit('init_self', connectedUsers[socket.id]);
        }
    });

    socket.on('send_direct_message', (data) => {
        const targetSocketId = Object.keys(connectedUsers).find(
            key => connectedUsers[key].name === data.toUser
        );

        const messagePayload = {
            from: connectedUsers[socket.id].name,
            text: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_direct_message', messagePayload);
        }
        socket.emit('message_sent_confirm', messagePayload);
    });

    socket.on('disconnect', () => {
        if (connectedUsers[socket.id]) {
            const user = connectedUsers[socket.id];
            allUsers = allUsers.filter(u => u.name !== user.name);
            delete connectedUsers[socket.id];
            io.emit('update_users_list', allUsers);
        }
    });
});

// Хостинг сам назначит нужный порт через переменную окружения
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes успешно запущен на порту ${PORT}!`);
});
