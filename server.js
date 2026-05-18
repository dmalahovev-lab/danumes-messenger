const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Инициализация базы данных в оперативной памяти
let db = { users: [], messages: [], groups: [] };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Ошибка чтения базы данных, инициализируем пустую:", e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Карта соответствия: username -> socket.id для WebRTC звонков
const usersOnline = {};

// ==========================================
// СВЯТОЙ КОД АВТОРИЗАЦИИ (НЕ МЕНЯТЬ НИ БУКВЫ)
// ==========================================
app.post('/api/register', (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ error: 'Заполните все поля' });
    
    const exists = db.users.find(u => u.username.toLowerCase() === user.toLowerCase());
    if (exists) return res.status(400).json({ error: 'Пользователь уже существует' });
    
    const newUser = { username: user, password: pass };
    db.users.push(newUser);
    saveDB();
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const found = db.users.find(u => u.username.toLowerCase() === user.toLowerCase() && u.password === pass);
    if (!found) return res.status(400).json({ error: 'Неверный логин или пароль' });
    res.json({ success: true, username: found.username });
});

// ==========================================
// РОУТ УДАЛЕНИЯ СООБЩЕНИЙ
// ==========================================
app.post('/api/messages/delete', (req, res) => {
    const { messageId, user } = req.body;
    const msgIndex = db.messages.findIndex(m => m.id === messageId);
    
    if (msgIndex === -1) return res.status(404).json({ error: 'Сообщение не найдено' });
    
    const msg = db.messages[msgIndex];
    // Удалять может автор ИЛИ админ Danumala
    if (user === 'Danumala' || msg.author === user) {
        db.messages.splice(msgIndex, 1);
        saveDB();
        io.emit('msg_removed_from_chat', { messageId }); // Оповещаем сокеты
        return res.json({ success: true });
    }
    
    res.status(403).json({ error: 'Нет прав на удаление' });
});

// Дополнительные API эндпоинты для инициализации интерфейса
app.get('/api/users', (req, res) => {
    res.json(db.users.map(u => ({ username: u.username })));
});

app.get('/api/messages', (req, res) => {
    res.json(db.messages);
});

// ==========================================
// SOCKET.IO СИГНАЛИНГ И ЖИВОЙ ЧАТ
// ==========================================
io.on('connection', (socket) => {
    let currentUsername = null;

    socket.on('user_connected', (username) => {
        currentUsername = username;
        usersOnline[username] = socket.id;
        io.emit('update_online_list', Object.keys(usersOnline));
    });

    socket.on('new_message', (msgData) => {
        // Защита канала новостей: писать может только Danumala
        if (msgData.room === 'danumes_news' && msgData.author !== 'Danumala') {
            return;
        }
        
        const messageWithId = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            ...msgData,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        db.messages.push(messageWithId);
        saveDB();
        io.emit('broadcast_message', messageWithId);
    });

    // Ручной проброс удаления через сокет (на всякий случай)
    socket.on('message_deleted', (data) => {
        io.emit('msg_removed_from_chat', { messageId: data.messageId });
    });

    // Сигналинг для приватных аудиозвонков WebRTC
    socket.on('call_request', (data) => {
        const targetSocketId = usersOnline[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('incoming_call', { from: data.from });
        } else {
            socket.emit('call_failed', { reason: 'Пользователь не в сети' });
        }
    });

    socket.on('call_accepted', (data) => {
        const targetSocketId = usersOnline[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('start_webrtc_handshake', { from: data.from });
        }
    });

    socket.on('call_rejected', (data) => {
        const targetSocketId = usersOnline[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call_ended');
        }
    });

    socket.on('webrtc_offer', (data) => {
        const targetSocketId = usersOnline[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_offer', { offer: data.offer, from: data.from });
        }
    });

    socket.on('webrtc_answer', (data) => {
        const targetSocketId = usersOnline[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_answer', { answer: data.answer, from: data.from });
        }
    });

    socket.on('ice_candidate', (data) => {
        const targetSocketId = usersOnline[data.to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('receive_ice', { candidate: data.candidate });
        }
    });

    socket.on('disconnect', () => {
        if (currentUsername) {
            delete usersOnline[currentUsername];
            io.emit('update_online_list', Object.keys(usersOnline));
        }
    });
});

http.listen(PORT, () => {
    console.log(`Сервер DanuMes запущен на порту ${PORT}`);
});
