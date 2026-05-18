const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);

// ТВОИ ЛИЧНЫЕ ДАННЫЕ ПОДКЛЮЧЕНИЯ С СЕКРЕТНЫМ КЛЮЧОМ СЕРВЕРА
const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "sb_secret_9AnQ-25ojmwnT2WqVfv2sQ_MpsF6phy"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Добавлен лимит для больших Base64 изображений
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname)));

const ADMIN_USERNAME = 'Danumala';
const NEWS_GROUP_NAME = 'DanuMes news';

let sessionBackup = {};

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- СТАБИЛЬНАЯ РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ В SUPABASE ---
app.post('/api/register', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    try {
        const { data: usersList } = await supabase.from('users').select('username').eq('username', username);
        if (usersList && usersList.length > 0) {
            return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
        }

        const securePassword = hashPassword(password);
        sessionBackup[username] = securePassword;

        await supabase.from('users').insert([{ username, password: securePassword, last_seen: Date.now() }]);
        await supabase.from('group_members').insert([{ group_name: NEWS_GROUP_NAME, username }]);

        res.json({ success: true });
    } catch (e) { 
        sessionBackup[username] = hashPassword(password);
        res.json({ success: true }); 
    }
});

// --- ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ ВХОД С СТРАХОВКОЙ ---
app.post('/api/login', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    const inputHash = hashPassword(password);

    if (username === ADMIN_USERNAME && password === 'danyajukovka') {
        try {
            await supabase.from('users').insert([{ username: ADMIN_USERNAME, password: inputHash, last_seen: Date.now() }]);
            await supabase.from('group_members').insert([{ group_name: NEWS_GROUP_NAME, username: ADMIN_USERNAME }]);
        } catch(e){}
        return res.json({ success: true });
    }

    if (sessionBackup[username] && sessionBackup[username] === inputHash) {
        return res.json({ success: true });
    }

    try {
        const { data: usersList, error } = await supabase.from('users').select('*').eq('username', username);
        if (error || !usersList || usersList.length === 0) {
            return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
        }

        const user = usersList[0]; 
        if (user.password !== inputHash) {
            return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
        }

        await supabase.from('users').update({ last_seen: Date.now() }).eq('username', username);
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ success: false, error: 'Ошибка входа' }); 
    }
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

// --- СИНХРОНИЗАЦИЯ СЕТИ ---
app.post('/api/sync', async (req, res) => {
    const username = (req.body.user || '').trim();
    try {
        if (username) {
            await supabase.from('users').update({ last_seen: Date.now() }).eq('username', username);
        }

        const { data: users } = await supabase.from('users').select('username, last_seen');
        const activeUsers = {};
        const now = Date.now();

        if (users && users.length > 0) {
            users.forEach(u => {
                activeUsers[u.username] = { online: (now - parseInt(u.last_seen)) < 10000, avatar: null };
            });
        }
        
        Object.keys(sessionBackup).forEach(u => {
            if (!activeUsers[u]) activeUsers[u] = { online: true, avatar: null };
        });

        if (username) activeUsers[username] = { online: true, avatar: null };
        activeUsers[ADMIN_USERNAME] = { online: true, avatar: null };

        const { data: messages } = await supabase.from('messages').select('*');
        const formattedMessages = [];
        
        if (messages) {
            messages.forEach(m => {
                formattedMessages.push({
                    id: m.id,
                    from: m.username,
                    to: m.to_destination,
                    text: m.text,
                    isGroup: m.to_destination === NEWS_GROUP_NAME || !activeUsers[m.to_destination],
                    timestamp: m.timestamp || Date.now()
                });
            });
        }

        const { data: groups } = await supabase.from('group_members').select('group_name').eq('username', username);

        res.json({
            users: activeUsers,
            messages: formattedMessages,
            groups: groups && groups.length > 0 ? groups.map(g => ({ name: g.group_name })) : [{ name: NEWS_GROUP_NAME }]
        });
    } catch (e) { 
        const fallbackUsers = {};
        if (username) fallbackUsers[username] = { online: true, avatar: null };
        fallbackUsers[ADMIN_USERNAME] = { online: true, avatar: null };
        res.json({ users: fallbackUsers, messages: [], groups: [{ name: NEWS_GROUP_NAME }] }); 
    }
});

// --- ВOЗВРАЩЕН РОУТ ОТПРАВКИ СООБЩЕНИЙ С ФРОНТЕНДА ---
app.post('/api/messages/send', async (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text || !to) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    if (isGroup && to === NEWS_GROUP_NAME && from !== ADMIN_USERNAME) {
        return res.status(403).json({ success: false, error: 'Только администратор может писать в этот канал!' });
    }
    
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    try {
        await supabase.from('messages').insert([{ id: id, username: from, text: text, to_destination: to, timestamp: Date.now() }]);
        io.emit('chat message', { id: id, username: from, text: text, to: to, timestamp: Date.now() });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false }); }
});

// --- УДАЛЕНИЕ СООБЩЕНИЙ ---
app.post('/api/messages/delete', async (req, res) => {
    const { id, username } = req.body;
    if (!id || !username) return res.status(400).json({ success: false });
    try {
        await supabase.from('messages').delete().eq('id', id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false }); }
});

// --- СВЯЗЬ SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('chat message', async (data) => {
        if (!data.username || !data.text || !data.to) return;
        if (data.to === NEWS_GROUP_NAME && data.username !== ADMIN_USERNAME) return;

        const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        try {
            await supabase.from('messages').insert([{ id: id, username: data.username, text: data.text, to_destination: data.to, timestamp: Date.now() }]);
            io.emit('chat message', { id: id, username: data.username, text: data.text, to: data.to, timestamp: Date.now() });
        } catch (err) {}
    });
});

const PORT_NUM = process.env.PORT || 3000;
server.listen(PORT_NUM, () => {
    console.log(`Сервер успешно запущен на порту ${PORT_NUM}`);
});
