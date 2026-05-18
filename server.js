const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    transports: ['websocket'],
    allowUpgrades: false
});

const PORT = process.env.PORT || 3000;

// Нативное чтение ключей из защищенных переменных Render Environment
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

const usersOnline = {}; 

// СВЯТОЙ КОД АВТОРИЗАЦИИ (100% Оригинал, не изменен ни один символ)
app.post('/api/register', async (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ message: 'Заполните все поля' });
    
    try {
        const { data: existingUser } = await supabase.from('users').select('username').eq('username', user).maybeSingle();
        if (existingUser) return res.status(400).json({ message: 'Пополнили базу данных, юзер уже есть!' });
        
        await supabase.from('users').insert([{ username: user, password: pass }]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка базы данных' });
    }
});

app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ message: 'Заполните все поля' });
    
    try {
        if (user === 'Danumala') {
            const { data: d } = await supabase.from('users').select('username').eq('username', 'Danumala').maybeSingle();
            if (!d) await supabase.from('users').insert([{ username: 'Danumala', password: 'danyajukovka' }]);
        }
        if (user === 'RunFly') {
            const { data: r } = await supabase.from('users').select('username').eq('username', 'RunFly').maybeSingle();
            if (!r) await supabase.from('users').insert([{ username: 'RunFly', password: 'GGWWXXJJ2001' }]);
        }

        const { data: account } = await supabase.from('users').select('*').eq('username', user).maybeSingle();
        if (!account || account.password !== pass) {
            return res.status(400).json({ message: 'Неверное имя пользователя или пароль' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка авторизации' });
    }
});

app.post('/api/upload', (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ message: 'Файл не найден' });
    res.json({ url: image });
});

app.post('/api/messages/delete', async (req, res) => {
    const { messageId, user } = req.body;
    try {
        const { data: msg } = await supabase.from('messages').select('author').eq('id', messageId).maybeSingle();
        if (msg && (user === 'Danumala' || msg.author === user)) {
            await supabase.from('messages').delete().eq('id', messageId);
            io.emit('msg_deleted', messageId);
            return res.json({ success: true });
        }
        res.status(400).json({ message: 'Нет прав или сообщение не найдено' });
    } catch(err) {
        res.status(500).json({ message: 'Ошибка удаления' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function broadcastUsersList() {
    try {
        const { data: allUsers } = await supabase.from('users').select('username, avatar');
        const usersMap = {};
        if (allUsers) allUsers.forEach(u => { usersMap[u.username] = u.avatar; });

        const usersData = Object.keys(usersOnline).map(username => ({
            username: username,
            avatar: usersMap[username] || null
        }));
        io.emit('update_users', usersData);
    } catch(e) { console.error(e); }
}

io.on('connection', (socket) => {
    let sessionUser = null;

    socket.on('register_user', async (username) => {
        if (!username) return;
        sessionUser = username;
        usersOnline[username] = socket.id;
        
        try {
            const { data: u } = await supabase.from('users').select('avatar').eq('username', username).maybeSingle();
            socket.emit('auth_success_data', { avatar: u ? u.avatar : null });
            broadcastUsersList();
            sendGroupsList(socket);
        } catch(e) { console.error(e); }
    });

    async function sendGroupsList(targetSocket) {
        if (!sessionUser) return;
        try {
            const { data: allGroups } = await supabase.from('groups').select('*');
            if (allGroups) {
                const userGroups = allGroups
                    .filter(g => g.members && g.members.includes(sessionUser))
                    .map(g => ({ id: g.id, name: g.name }));
                targetSocket.emit('update_groups', userGroups);
            }
        } catch(e) { console.error(e); }
    }

    socket.on('get_online_users', () => { broadcastUsersList(); });

    socket.on('update_profile_avatar', async (data) => {
        if (sessionUser && data.avatar) {
            try {
                await supabase.from('users').update({ avatar: data.avatar }).eq('username', sessionUser);
                broadcastUsersList();
            } catch(e) { console.error(e); }
        }
    });

    socket.on('create_private_group', async (data) => {
        if (!sessionUser) return;
        const groupId = 'group_' + Date.now();
        const members = data.members;
        if (!members.includes(sessionUser)) members.push(sessionUser);

        try {
            await supabase.from('groups').insert([{ id: groupId, name: data.name, creator: sessionUser, members: members }]);
            members.forEach(member => {
                const targetSocketId = usersOnline[member];
                if (targetSocketId) {
                    const ts = io.sockets.sockets.get(targetSocketId);
                    if (ts) sendGroupsList(ts);
                }
            });
        } catch(e) { console.error(e); }
    });

    socket.on('load_messages', async (query) => {
        try {
            let history = [];
            const { data: msgs } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
            
            if (msgs) {
                if (query.type === 'news') {
                    history = msgs.filter(m => m.type === 'news');
                } else if (query.type === 'group') {
                    history = msgs.filter(m => m.type === 'group' && m.to === query.id);
                } else {
                    history = msgs.filter(m => m.type === 'private' && ((m.to === query.id && m.author === sessionUser) || (m.to === sessionUser && m.author === query.id)));
                }
            }
            socket.emit('messages_history', history);
        } catch(e) { console.error(e); }
    });

    socket.on('send_msg', async (data) => {
        if (data.type === 'news' && sessionUser !== 'Danumala') return;
        const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        const newMsg = {
            id: msgId,
            type: data.type,
            to: data.to,
            author: sessionUser,
            text: data.text || '',
            image: data.image || null,
            read: false
        };

        try {
            await supabase.from('messages').insert([newMsg]);

            if (data.type === 'news') {
                io.emit('new_msg', newMsg);
            } else if (data.type === 'group') {
                const { data: g } = await supabase.from('groups').select('members').eq('id', data.to).maybeSingle();
                if (g && g.members) {
                    g.members.forEach(member => { const ts = usersOnline[member]; if (ts) io.to(ts).emit('new_msg', newMsg); });
                }
            } else {
                const ts = usersOnline[data.to];
                if (ts) io.to(ts).emit('new_msg', newMsg);
                socket.emit('new_msg', newMsg);
            }
        } catch(e) { console.error(e); }
    });

    socket.on('mark_as_read', async (data) => {
        try {
            await supabase.from('messages').update({ read: true }).eq('type', 'private').eq('author', data.chatWith).eq('to', sessionUser).eq('read', false);
            const ts = usersOnline[data.chatWith];
            if (ts) io.to(ts).emit('chat_read_by_recipient', { readBy: sessionUser });
        } catch(e) { console.error(e); }
    });

    socket.on('typing_status', (data) => { if (data.type === 'private') { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('user_typing_broadcast', { from: sessionUser, isTyping: data.isTyping }); } });

    socket.on('req_delete_message', async (data) => {
        try {
            await supabase.from('messages').delete().eq('id', data.messageId);
            io.emit('msg_deleted', data.messageId);
        } catch(e) { console.error(e); }
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
