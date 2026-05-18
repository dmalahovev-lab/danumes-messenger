const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Инициализация локальной автономной БД в ОЗУ
let db = { users: {}, messages: [] };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Ошибка чтения БД:", e);
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Глобальная карта для WebRTC-сигналинга (связка: ник пользователя -> id сокета)
const usersOnline = {}; 

// СВЯТОЙ КОД АВТОРИЗАЦИИ (Строго роуты, структуры user и pass — без изменений!)
app.post('/api/register', (expressReq, expressRes) => {
    const { user, pass } = expressReq.body;
    if (!user || !pass) return expressRes.status(400).json({ message: 'Заполните все поля' });
    if (db.users[user]) return expressRes.status(400).json({ message: 'Пользователь уже существует' });
    
    db.users[user] = { password: pass };
    saveDB();
    expressRes.json({ success: true });
});

app.post('/api/login', (expressReq, expressRes) => {
    const { user, pass } = expressReq.body;
    if (!user || !pass) return expressRes.status(400).json({ message: 'Заполните все поля' });
    
    // Специальный ручной бэкап главного админа, если БД пустая
    if (user === 'Danumala' && !db.users['Danumala']) {
        db.users['Danumala'] = { password: 'danyajukovka' };
        saveDB();
    }

    const account = db.users[user];
    if (!account || account.password !== pass) {
        return expressRes.status(400).json({ message: 'Неверное имя пользователя или пароль' });
    }
    expressRes.json({ success: true });
});

// Существующий обязательный роут удаления сообщений
app.post('/api/messages/delete', (expressReq, expressRes) => {
    const { messageId, user } = expressReq.body;
    const msgIndex = db.messages.findIndex(m => m.id === messageId);
    
    if (msgIndex !== -1) {
        const msg = db.messages[msgIndex];
        if (user === 'Danumala' || msg.author === user) {
            db.messages.splice(msgIndex, 1);
            saveDB();
            io.emit('msg_deleted', messageId); // Мгновенно стираем у всех из UI
            return expressRes.json({ success: true });
        }
    }
    expressRes.status(400).json({ message: 'Нет прав или сообщение не найдено' });
});

// Главный роут для фронтенда
app.get('/', (expressReq, expressRes) => {
    expressRes.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.io Архитектура и сигналинг звонков
io.on('connection', (socket) => {
    let sessionUser = null;

    socket.on('register_user', (username) => {
        sessionUser = username;
        usersOnline[username] = socket.id; // Регистрируем активный сокет
        io.emit('update_users', Object.keys(usersOnline));
    });

    socket.on('get_online_users', () => {
        socket.emit('update_users', Object.keys(usersOnline));
    });

    socket.on('load_messages', (query) => {
        // Загрузка приватных сообщений или общего канала новостей
        let history = [];
        if (query.type === 'news') {
            history = db.messages.filter(m => m.type === 'news');
        } else {
            history = db.messages.filter(m => 
                m.type === 'private' && 
                ((m.to === query.id && m.author === sessionUser) || (m.to === sessionUser && m.author === query.id))
            );
        }
        socket.emit('messages_history', history);
    });

    socket.on('send_msg', (data) => {
        if (data.type === 'news' && sessionUser !== 'Danumala') return; // Защита новостного канала

        const newMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: data.type,
            to: data.to,
            author: sessionUser,
            text: data.text || '',
            image: data.image || null,
            time: new Date().toISOString()
        };

        db.messages.push(newMsg);
        saveDB();

        // Отправка сообщений целевым клиентам
        if (data.type === 'news') {
            io.emit('new_msg', newMsg);
        } else {
            const targetSocket = usersOnline[data.to];
            if (targetSocket) io.to(targetSocket).emit('new_msg', newMsg);
            socket.emit('new_msg', newMsg); // Возвращаем автору
        }
    });

    // Фича А: Быстрое сокет-удаление сообщений
    socket.on('req_delete_message', (data) => {
        const msgIndex = db.messages.findIndex(m => m.id === data.messageId);
        if (msgIndex !== -1) {
            const msg = db.messages[msgIndex];
            if (data.user === 'Danumala' || msg.author === data.user) {
                db.messages.splice(msgIndex, 1);
                saveDB();
                io.emit('msg_deleted', data.messageId);
            }
        }
    });

    // Фича Б: Сигналинг для приватных аудиозвонков WebRTC
    socket.on('call_init', (data) => {
        const targetId = usersOnline[data.to];
        if (targetId) {
            io.to(targetId).emit('call_incoming', { from: data.from });
        }
    });

    socket.on('call_accepted', (data) => {
        const targetId = usersOnline[data.to];
        if (targetId) {
            io.to(targetId).emit('start_handshake', { from: data.from });
        }
    });

    socket.on('rtc_offer', (data) => {
        const targetId = usersOnline[data.to];
        if (targetId) {
            io.to(targetId).emit('receive_offer', { offer: data.offer, from: sessionUser });
        }
    });

    socket.on('rtc_answer', (data) => {
        const targetId = usersOnline[data.to];
        if (targetId) {
            io.to(targetId).emit('receive_answer', { answer: data.answer });
        }
    });

    socket.on('ice_candidate', (data) => {
        const targetId = usersOnline[data.to];
        if (targetId) {
            io.to(targetId).emit('receive_ice', { candidate: data.candidate });
        }
    });

    socket.on('call_rejected', (data) => {
        const targetId = usersOnline[data.to];
        if (targetId) {
            io.to(targetId).emit('call_ended');
        }
    });

    socket.on('disconnect', () => {
        if (sessionUser && usersOnline[sessionUser] === socket.id) {
            delete usersOnline[sessionUser];
            io.emit('update_users', Object.keys(usersOnline));
        }
    });
});

server.listen(PORT, () => {
    console.log(`Сервер DanuMes успешно запущен на порту ${PORT}`);
});
