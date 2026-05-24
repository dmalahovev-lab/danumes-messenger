const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://uqlihmsrxmjeqlddztuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGlobXNyeG1qZXFsZGR6dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjQ3NTEsImV4cCI6MjA5NDg0MDc1MX0.NjTgmgL9SrW0taod0aEETjqe56BtyA7c8m7Hw_fyJu8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UPLOADS_DIR = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

// ========== ПОЛЬЗОВАТЕЛИ ==========
app.post('/register-attempt', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    const { data: existing } = await supabase.from('users').select('username').eq('username', username);
    if (existing && existing.length) return res.json({ success: false, error: 'Пользователь уже существует' });
    const { error } = await supabase.from('users').insert([{ username, password, avatar: '👤', online: false, verified: false }]);
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true });
});

app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    const { data } = await supabase.from('users').select('username, avatar, verified').eq('username', username).eq('password', password);
    if (!data || data.length === 0) return res.json({ success: false, error: 'Неверные имя или пароль' });
    await supabase.from('users').update({ online: true }).eq('username', username);
    res.json({ success: true, username: data[0].username, avatar: data[0].avatar, verified: data[0].verified });
});

app.post('/logout', async (req, res) => {
    const { username } = req.body;
    await supabase.from('users').update({ online: false }).eq('username', username);
    res.json({ success: true });
});

app.get('/get-users', async (req, res) => {
    const { data } = await supabase.from('users').select('username, avatar, online, verified');
    res.json(data || []);
});

app.post('/update-avatar', async (req, res) => {
    const { username, avatar } = req.body;
    await supabase.from('users').update({ avatar }).eq('username', username);
    res.json({ success: true, avatar });
});

app.post('/update-username', async (req, res) => {
    const { oldUsername, newUsername } = req.body;
    if (!oldUsername || !newUsername) return res.status(400).json({ error: 'Недостаточно данных' });
    const { data: existing } = await supabase.from('users').select('username').eq('username', newUsername);
    if (existing && existing.length) return res.status(400).json({ error: 'Имя уже занято' });
    await supabase.from('users').update({ username: newUsername }).eq('username', oldUsername);
    res.json({ success: true, newUsername });
});

// ========== ЛИЧНЫЕ СООБЩЕНИЯ ==========
app.post('/send-message', async (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    console.log('📨 Получен запрос на отправку:', { from, to, text, fileUrl });
    if (!from || !to || (!text && !fileUrl)) {
        return res.status(400).json({ error: 'Недостаточно данных' });
    }
    const newMsg = {
        id: Date.now(),
        from_user: from,
        to_user: to,
        text: text || '',
        file_url: fileUrl || null,
        file_name: fileName || null,
        timestamp: new Date().toISOString(),
        edited: false
    };
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) {
        console.error('❌ Ошибка Supabase:', error);
        return res.status(500).json({ error: error.message });
    }
    console.log('✅ Сообщение сохранено:', newMsg.id);
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    console.log(`📥 Запрос сообщений между ${user1} и ${user2}`);
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`from_user.eq.${user1},to_user.eq.${user2}`)
        .or(`from_user.eq.${user2},to_user.eq.${user1}`)
        .order('id', { ascending: true });
    if (error) console.error('❌ Ошибка:', error);
    console.log(`📦 Найдено сообщений: ${data?.length || 0}`);
    res.json(data || []);
});

app.get('/get-chats/:username', async (req, res) => {
    const { username } = req.params;
    const { data: users } = await supabase.from('users').select('username, avatar, online, verified');
    const { data: messages } = await supabase.from('messages').select('*').or(`from_user.eq.${username},to_user.eq.${username}`);
    const chatSet = new Set();
    (messages || []).forEach(m => {
        if (m.from_user === username) chatSet.add(m.to_user);
        if (m.to_user === username) chatSet.add(m.from_user);
    });
    users.forEach(u => { if (u.username !== username) chatSet.add(u.username); });
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = (messages || []).filter(m => (m.from_user === username && m.to_user === chatUsername) || (m.from_user === chatUsername && m.to_user === username)).sort((a,b) => b.id - a.id)[0];
        return {
            username: chatUsername,
            avatar: user ? user.avatar : '👤',
            online: user ? user.online : false,
            verified: user ? user.verified : false,
            lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений',
            lastTime: lastMsg ? lastMsg.timestamp : null
        };
    });
    chatList.sort((a,b) => (b.lastTime || 0) - (a.lastTime || 0));
    res.json(chatList);
});

// ========== ДРУЗЬЯ ==========
app.post('/send-friend-request', async (req, res) => {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'Недостаточно данных' });
    const { error } = await supabase.from('friend_requests').insert([{ from_user: from, to_user: to, status: 'pending' }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/friend-requests/:username', async (req, res) => {
    const { username } = req.params;
    const { data: received } = await supabase.from('friend_requests').select('*').eq('to_user', username).eq('status', 'pending');
    const { data: sent } = await supabase.from('friend_requests').select('*').eq('from_user', username).eq('status', 'pending');
    res.json({ received: received || [], sent: sent || [] });
});

app.post('/friend-request/accept', async (req, res) => {
    const { from, to } = req.body;
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('from_user', from).eq('to_user', to);
    await supabase.from('friends').insert([{ user1: from, user2: to }]);
    res.json({ success: true });
});

app.post('/friend-request/reject', async (req, res) => {
    const { from, to } = req.body;
    await supabase.from('friend_requests').delete().eq('from_user', from).eq('to_user', to);
    res.json({ success: true });
});

app.get('/friends/:username', async (req, res) => {
    const { username } = req.params;
    const { data } = await supabase.from('friends').select('*').or(`user1.eq.${username},user2.eq.${username}`);
    const friends = (data || []).map(f => f.user1 === username ? f.user2 : f.user1);
    res.json(friends);
});

// ========== ГРУППЫ ==========
app.post('/create-group', async (req, res) => {
    const { name, createdBy, members } = req.body;
    if (!name || !createdBy) return res.status(400).json({ error: 'Недостаточно данных' });
    const groupId = Date.now().toString();
    await supabase.from('groups').insert([{ id: groupId, name, avatar: '👥', created_by: createdBy }]);
    await supabase.from('group_members').insert([{ group_id: groupId, username: createdBy }]);
    if (members && members.length) {
        const memberRows = members.map(u => ({ group_id: groupId, username: u }));
        await supabase.from('group_members').insert(memberRows);
    }
    res.json({ success: true, groupId });
});

app.get('/get-groups/:username', async (req, res) => {
    const { username } = req.params;
    const { data: memberships } = await supabase.from('group_members').select('group_id').eq('username', username);
    if (!memberships || memberships.length === 0) return res.json([]);
    const groupIds = memberships.map(m => m.group_id);
    const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
    const { data: allGroupMessages } = await supabase.from('group_messages').select('*').in('group_id', groupIds).order('id', { ascending: false });
    const result = (groups || []).map(g => {
        const lastMsg = allGroupMessages?.find(m => m.group_id === g.id);
        return {
            ...g,
            lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений',
            lastTime: lastMsg ? lastMsg.timestamp : null
        };
    });
    result.sort((a,b) => (b.lastTime || 0) - (a.lastTime || 0));
    res.json(result);
});

app.get('/get-group-messages/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { data } = await supabase.from('group_messages').select('*').eq('group_id', groupId).order('id', { ascending: true });
    res.json(data || []);
});

app.post('/send-group-message', async (req, res) => {
    const { groupId, from, text, fileUrl, fileName } = req.body;
    if (!groupId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const newMsg = {
        id: Date.now(),
        group_id: groupId,
        from_user: from,
        text: text || '',
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date().toISOString(),
        edited: false
    };
    const { error } = await supabase.from('group_messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: newMsg });
});

// ========== КАНАЛЫ ==========
app.get('/get-channels', async (req, res) => {
    const { data } = await supabase.from('channels').select('*');
    res.json(data || []);
});

app.get('/get-channel-messages/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const { data } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('id', { ascending: true });
    res.json(data || []);
});

app.post('/send-channel-message', async (req, res) => {
    const { channelId, from, text, fileUrl, fileName } = req.body;
    if (!channelId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const { data: channel } = await supabase.from('channels').select('owner, only_owner_can_post').eq('id', channelId);
    if (channel && channel[0] && channel[0].only_owner_can_post && from !== channel[0].owner) {
        return res.status(403).json({ error: 'Только владелец канала может отправлять сообщения' });
    }
    const newMsg = {
        id: Date.now(),
        channel_id: channelId,
        from_user: from,
        text: text || '',
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date().toISOString(),
        edited: false
    };
    const { error } = await supabase.from('channel_messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: newMsg });
});

// ========== ОБЩИЕ ==========
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    res.json({ success: true, fileUrl: `/file/${req.file.filename}`, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.delete('/delete-message/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('messages').delete().eq('id', parseInt(id));
    res.json({ success: true });
});

app.delete('/delete-group-message/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('group_messages').delete().eq('id', parseInt(id));
    res.json({ success: true });
});

app.delete('/delete-channel-message/:id', async (req, res) => {
    const { id } = req.params;
    await supabase.from('channel_messages').delete().eq('id', parseInt(id));
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
