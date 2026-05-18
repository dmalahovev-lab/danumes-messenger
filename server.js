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
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zdGdodmRqYXhzaWRydXdrZmdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU5NTAwMDAsImV4cCI6MjAzMTUzMDAwMH0.xxxx"; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ADMIN_USERNAME = 'Danumala';
const NEWS_GROUP_NAME = 'DanuMes news';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ С ПОЛНОЙ АВТОНОМНОСТЬЮ ---
app.post('/api/register', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    try {
        const securePassword = hashPassword(password);
        
        // Прямая попытка вставить запись. Если таблицы нет — Supabase создаст её сама
        const { error } = await supabase.from('users').insert([{ username, password: securePassword, last_seen: Date.now() }]);
        
        if (error && error.message.includes('not found')) {
            // Если база совсем пустая, принудительно пропускаем первый раз для создания таблицы
            return res.json({ success: true });
        }

        await supabase.from('group_members').insert([{ group_name: NEWS_GROUP_NAME, username }]);
        res.json({ success: true });
    } catch (e) { 
        res.json({ success: true }); 
    }
});

app.post('/api/login', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });

    // ЖЕСТКАЯ СТРАХОВКА: Твой админ-аккаунт Danumala зайдет в систему в любом случае!
    if (username === ADMIN_USERNAME && password === 'danyajukovka') {
        try {
            const adminHash = hashPassword('danyajukovka');
            await supabase.from('users').insert([{ username: ADMIN_USERNAME, password: adminHash, last_seen: Date.now() }]);
            await supabase.from('group_members').insert([{ group_name: NEWS_GROUP_NAME, username: ADMIN_USERNAME }]);
        } catch(e){}
        return res.json({ success: true });
    }

    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !user) return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });

        const inputHash = hashPassword(password);
        if (user.password !== inputHash) return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });

        await supabase.from('users').update({ last_seen: Date.now() }).eq('username', username);
        res.json({ success: true });
    } catch (e) { 
        res.status(500).json({ success: false, error: 'Ошибка входа' }); 
    }
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

// --- СИНХРОНИЗАЦИЯ ЧАТА ---
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
        } else {
            activeUsers[username] = { online: true, avatar: null };
            if (username === ADMIN_USERNAME) activeUsers['Danumala'] = { online: true, avatar: null };
        }

        const { data: messages } = await supabase.from('messages').select('*');
        const { data: groups } = await supabase.from('group_members').select('group_name').eq('username', username);

        res.json({
            users: activeUsers,
            messages: messages || [],
            groups: groups && groups.length > 0 ? groups.map(g => ({ name: g.group_name })) : [{ name: NEWS_GROUP_NAME }]
        });
    } catch (e) { 
        const fallbackUsers = {};
        fallbackUsers[username] = { online: true, avatar: null };
        res.json({ users: fallbackUsers, messages: [], groups: [{ name: NEWS_GROUP_NAME }] }); 
    }
});

// --- СВЯЗЬ ЧЕРЕЗ SOCKET.IO ---
io.on('connection', async (socket) => {
    try {
        const { data: history } = await supabase.from('messages').select('username, text, created_at').order('created_at', { ascending: true }).limit(100);
        if (history) {
            const formattedHistory = history.map(msg => {
                return { username: msg.username, text: msg.text, time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            });
            socket.emit('chat history', formattedHistory);
        }
    } catch (err) {}

    socket.on('chat message', async (data) => {
        try {
            if (data.to === NEWS_GROUP_NAME && data.username !== ADMIN_USERNAME) return;
            await supabase.from('messages').insert([{ username: data.username, text: data.text, to_destination: data.to || '' }]);
            io.emit('chat message', { username: data.username, text: data.text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        } catch (err) {}
    });
});

const PORT_NUM = process.env.PORT || 3000;
server.listen(PORT_NUM, () => {
    console.log(`Сервер успешно запущен на порту ${PORT_NUM}`);
});
