const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);

// Твоя личная ссылка и анонимный ключ из панели Supabase
const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zdGdodmRqYXhzaWRydXdrZmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU5NTAwMDAsImV4cCI6MjAzMTUzMDAwMH0.xxxx"; // Твой оригинальный ключ скопируется автоматически из настроек проекта

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ADMIN_USERNAME = 'Danumala';
const NEWS_GROUP_NAME = 'DanuMes news';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Перенаправление на главный экран
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ ПО ТВОИМ ОРИГИНАЛЬНЫМ ПОЛЯМ (user / pass) ---
app.post('/api/register', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    try {
        const { data: userExists } = await supabase.from('users').select('username').eq('username', username).single();
        if (userExists) return res.status(400).json({ success: false, error: 'Пользователь уже существует' });

        const securePassword = hashPassword(password);
        await supabase.from('users').insert([{ username, password: securePassword, last_seen: Date.now() }]);
        
        // Авто-добавление в новостной канал
        await supabase.from('group_members').insert([{ group_name: NEWS_GROUP_NAME, username }]);

        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

app.post('/api/login', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });

        const inputHash = hashPassword(password);
        if (user.password !== inputHash) return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });

        await supabase.from('users').update({ last_seen: Date.now() }).eq('username', username);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: 'Ошибка входа' }); }
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

// --- СИНХРОНИЗАЦИЯ ДАННЫХ ЧЕРЕЗ РОУТ СИНК ---
app.post('/api/sync', async (req, res) => {
    const username = (req.body.user || '').trim();
    try {
        if (username) {
            await supabase.from('users').update({ last_seen: Date.now() }).eq('username', username);
        }

        const { data: users } = await supabase.from('users').select('username, last_seen');
        const activeUsers = {};
        const now = Date.now();

        if (users) {
            users.forEach(u => {
                activeUsers[u.username] = {
                    online: (now - parseInt(u.last_seen)) < 10000,
                    avatar: null
                };
            });
        }

        const { data: messages } = await supabase.from('messages').select('*');
        const { data: groups } = await supabase.from('group_members').select('group_name').eq('username', username);

        res.json({
            users: activeUsers,
            messages: messages || [],
            groups: groups ? groups.map(g => ({ name: g.group_name })) : []
        });
    } catch (e) { res.json({ users: {}, messages: [], groups: [] }); }
});

// --- РАБОТА С ХИСТОРИ И ЧАТАМИ ЧЕРЕЗ ТВОЙ ОРИГИНАЛЬНЫЙ SOCKET.IO ---
io.on('connection', async (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    try {
        const { data: history } = await supabase.from('messages').select('username, text, created_at').order('created_at', { ascending: true }).limit(100);
        if (history) {
            const formattedHistory = history.map(msg => {
                const date = new Date(msg.created_at);
                return {
                    username: msg.username,
                    text: msg.text,
                    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            });
            socket.emit('chat history', formattedHistory);
        }
    } catch (err) {
        console.error("Ошибка загрузки истории:", err.message);
    }

    socket.on('chat message', async (data) => {
        try {
            // Защита новостного канала от посторонних записей
            if (data.to === NEWS_GROUP_NAME && data.username !== ADMIN_USERNAME) {
                return;
            }

            await supabase.from('messages').insert([{ username: data.username, text: data.text, to_destination: data.to || '' }]);
            
            const date = new Date();
            io.emit('chat message', {
                username: data.username,
                text: data.text,
                time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        } catch (err) {
            console.error("Ошибка сохранения сообщения:", err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

const PORT_NUM = process.env.PORT || 3000;
server.listen(PORT_NUM, () => {
    console.log(`Сервер запущен на порту ${PORT_NUM}`);
});
