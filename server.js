const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    transports: ['websocket'],
    allowUpgrades: false,
    maxHttpBufferSize: 1e8
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

let db = { users: {}, messages: [], groups: {} };

// Чтение локальной базы данных
if (fs.existsSync(DB_FILE)) {
    try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8').trim();
        if (fileContent) db = JSON.parse(fileContent);
    } catch (e) {
        console.error("Ошибка чтения файла БД:", e);
    }
}

if (!db || typeof db !== 'object') db = { users: {}, messages: [], groups: {} };
if (!db.users) db.users = {};
if (!db.messages) db.messages = [];
if (!db.groups) db.groups = {};

function saveDB() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error("Ошибка записи в файл БД:", e);
    }
}

const usersOnline = {}; 

// СВЯТОЙ КОД АВТОРИЗАЦИИ (100% Оригинал, не изменен ни один символ)
app.post('/api/register', (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ message: 'Заполните все поля' });
    if (db.users[user]) return res.status(400).json({ message: 'Пользователь уже существует' });
    db.users[user] = { password: pass, avatar: null };
    saveDB();
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ message: 'Заполните все поля' });
    
    if (user === 'Danumala' && !db.users['Danumala']) {
        db.users['Danumala'] = { password: 'danyajukovka', avatar: null };
        saveDB();
    }
    if (user === 'RunFly' && !db.users['RunFly']) {
        db.users['RunFly'] = { password: 'GGWWXXJJ2001', avatar: null };
        saveDB();
    }

    const account = db.users[user];
    if (!account || account.password !== pass) {
        return res.status(400).json({ message: 'Неверное имя пользователя или пароль' });
    }
    res.json({ success: true });
});

app.post('/api/upload', (req, res) => {
    const { rawData, fileName, isImage } = req.body;
    if (!rawData || !fileName) return res.status(400).json({ message: 'Данные файла не переданы' });
    
    try {
        const base64Data = rawData.replace(/^data:.*;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = path.extname(fileName);
        const safeName = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
        const filePath = path.join(UPLOADS_DIR, safeName);
        
        fs.writeFileSync(filePath, buffer);
        res.json({ url: `/uploads/${safeName}`, name: fileName, isImage: isImage });
    } catch(err) {
        res.status(500).json({ message: 'Ошибка сервера при записи файла' });
    }
});

app.post('/api/messages/delete', (req, res) => {
    const { messageId, user } = req.body;
    const msgIndex = db.messages.findIndex(m => m.id === messageId);
    if (msgIndex !== -1) {
        const msg = db.messages[msgIndex];
        if (user === 'Danumala' || msg.author === user) {
            db.messages.splice(msgIndex, 1);
            saveDB();
            io.emit('msg_deleted', messageId);
            return res.json({ success: true });
        }
    }
    res.status(400).json({ message: 'Нет прав или сообщение не найдено' });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function broadcastUsersList() {
    const usersData = Object.keys(usersOnline).map(username => ({
        username: username,
        avatar: db.users[username] ? db.users[username].avatar : null
    }));
    io.emit('update_users', usersData);
}

io.on('connection', (socket) => {
    let sessionUser = null;

    socket.on('register_user', (username) => {
        if (!username) return;
        sessionUser = username;
        usersOnline[username] = socket.id;
        
        const userAvatar = db.users[username] ? db.users[username].avatar : null;
        socket.emit('auth_success_data', { avatar: userAvatar });

        broadcastUsersList();
        sendGroupsList(socket);
    });

    function sendGroupsList(targetSocket) {
        if (!sessionUser) return;
        const userGroups = [];
        Object.keys(db.groups).forEach(groupId => {
            const group = db.groups[groupId];
            if (group.members.includes(sessionUser)) {
                userGroups.push({ id: groupId, name: group.name });
            }
        });
        targetSocket.emit('update_groups', userGroups);
    }

    socket.on('get_online_users', () => { broadcastUsersList(); });

    socket.on('update_profile_avatar', (data) => {
        if (sessionUser && db.users[sessionUser]) {
            db.users[sessionUser].avatar = data.avatar;
            saveDB();
            broadcastUsersList(); 
        }
    });

    socket.on('create_private_group', (data) => {
        if (!sessionUser) return;
        const groupId = 'group_' + Date.now();
        const members = data.members;
        if (!members.includes(sessionUser)) members.push(sessionUser);
        db.groups[groupId] = { name: data.name, creator: sessionUser, members: members };
        saveDB();
        members.forEach(member => {
            const targetSocketId = usersOnline[member];
            if (targetSocketId) { const ts = io.sockets.sockets.get(targetSocketId); if (ts) sendGroupsList(ts); }
        });
    });

    socket.on('load_messages', (query) => {
        let history = [];
        if (query.type === 'news') {
            history = db.messages.filter(m => m.type === 'news');
        } else if (query.type === 'group') {
            const group = db.groups[query.id];
            if (group && group.members.includes(sessionUser)) history = db.messages.filter(m => m.type === 'group' && m.to === query.id);
        } else {
            history = db.messages.filter(m => m.type === 'private' && ((m.to === query.id && m.author === sessionUser) || (m.to === sessionUser && m.author === query.id)));
        }
        socket.emit('messages_history', history);
    });

    socket.on('send_msg', (data) => {
        if (data.type === 'news' && sessionUser !== 'Danumala') return;
        if (data.type === 'group') {
            const group = db.groups[data.to];
            if (!group || !group.members.includes(sessionUser)) return;
        }

        const newMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: data.type,
            to: data.to,
            author: sessionUser,
            text: data.text || '',
            image: data.image || null,
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
            time: new Date().toISOString(),
            read: false
        };

        db.messages.push(newMsg);
        saveDB();

        if (data.type === 'news') {
            io.emit('new_msg', newMsg);
        } else if (data.type === 'group') {
            const group = db.groups[data.to];
            group.members.forEach(member => { const ts = usersOnline[member]; if (ts) io.to(ts).emit('new_msg', newMsg); });
        } else {
            const ts = usersOnline[data.to];
            if (ts) io.to(ts).emit('new_msg', newMsg);
            socket.emit('new_msg', newMsg);
        }
    });

    socket.on('mark_as_read', (data) => {
        let changed = false;
        db.messages.forEach(m => { if (m.type === 'private' && m.author === data.chatWith && m.to === sessionUser && !m.read) { m.read = true; changed = true; } });
        if (changed) { saveDB(); const ts = usersOnline[data.chatWith]; if (ts) io.to(ts).emit('chat_read_by_recipient', { readBy: sessionUser }); }
    });

    socket.on('typing_status', (data) => { if (data.type === 'private') { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('user_typing_broadcast', { from: sessionUser, isTyping: data.isTyping }); } });

    socket.on('req_delete_message', (data) => {
        const msgIndex = db.messages.findIndex(m => m.id === data.messageId);
        if (msgIndex !== -1) {
            const msg = db.messages[msgIndex];
            if (data.user === 'Danumala' || msg.author === data.user) { db.messages.splice(msgIndex, 1); saveDB(); io.emit('msg_deleted', data.messageId); }
        }
    });

    socket.on('call_init', (data) => { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('call_incoming', { from: data.from }); });
    socket.on('call_accepted', (data) => { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('start_handshake', { from: data.from }); });
    socket.on('rtc_offer', (data) => { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('receive_offer', { offer: data.offer, from: sessionUser }); });
    socket.on('rtc_answer', (data) => { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('receive_answer', { answer: data.answer }); });
    socket.on('ice_candidate', (data) => { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('receive_ice', { candidate: data.candidate }); });
    socket.on('call_rejected', (data) => { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('call_ended'); });

    socket.on('disconnect', () => { if (sessionUser && usersOnline[sessionUser] === socket.id) { delete usersOnline[sessionUser]; broadcastUsersList(); } });
});

server.listen(PORT, () => { console.log(`Сервер DanuMes успешно поднят на порту ${PORT}`); });
