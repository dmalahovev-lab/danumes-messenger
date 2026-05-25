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

const UPLOADS_DIR = '/tmp/uploads';
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
    const { error } = await supabase.from('users').insert([{ username, password, avatar: '👤', online: false, verified: false, role: 'user' }]);
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true });
});

app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    const { data } = await supabase.from('users').select('username, avatar, verified, role').eq('username', username).eq('password', password);
    if (!data || data.length === 0) return res.json({ success: false, error: 'Неверные имя или пароль' });
    await supabase.from('users').update({ online: true }).eq('username', username);
    res.json({ success: true, username: data[0].username, avatar: data[0].avatar, verified: data[0].verified, role: data[0].role });
});

app.get('/get-users', async (req, res) => {
    const { data } = await supabase.from('users').select('username, avatar, online, verified, role');
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
    const { from, to, text, fileUrl, fileName, replyTo } = req.body;
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const newMsg = {
        id: Date.now(),
        from_user: from,
        to_user: to,
        text: text || '',
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date().toISOString(),
        reply_to: replyTo || null
    };
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    const { data } = await supabase
        .from('messages')
        .select('*')
        .filter('from_user', 'in', `(${user1},${user2})`)
        .filter('to_user', 'in', `(${user1},${user2})`)
        .order('id', { ascending: true });
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

// ========== ГРУППЫ ==========
app.post('/create-group', async (req, res) => {
    const { name, createdBy, members } = req.body;
    if (!name || !createdBy) return res.status(400).json({ error: 'Недостаточно данных' });
    const groupId = Date.now().toString();
    await supabase.from('groups').insert([{ id: groupId, name, avatar: '👥', created_by: createdBy }]);
    await supabase.from('group_members').insert([{ group_id: groupId, username: createdBy, role: 'admin' }]);
    if (members && members.length) {
        const memberRows = members.map(u => ({ group_id: groupId, username: u, role: 'member' }));
        await supabase.from('group_members').insert(memberRows);
    }
    res.json({ success: true, groupId });
});

app.get('/get-groups/:username', async (req, res) => {
    const { username } = req.params;
    const { data: memberships } = await supabase.from('group_members').select('group_id, role').eq('username', username);
    if (!memberships || memberships.length === 0) return res.json([]);
    const groupIds = memberships.map(m => m.group_id);
    const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
    const result = (groups || []).map(g => {
        const membership = memberships.find(m => m.group_id === g.id);
        return { ...g, role: membership?.role || 'member', lastMessage: 'Нет сообщений', lastTime: null };
    });
    res.json(result);
});

app.get('/get-group-messages/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { data } = await supabase.from('group_messages').select('*').eq('group_id', groupId).order('id', { ascending: true });
    for (let msg of data || []) {
        const { data: reactions } = await supabase.from('group_reactions').select('username, reaction').eq('message_id', msg.id);
        msg.reactions = reactions || [];
    }
    res.json(data || []);
});

app.post('/send-group-message', async (req, res) => {
    const { groupId, from, text, fileUrl, fileName, replyTo } = req.body;
    if (!groupId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const newMsg = {
        id: Date.now(),
        group_id: groupId,
        from_user: from,
        text: text || '',
        file_url: fileUrl,
        file_name: fileName,
        timestamp: new Date().toISOString(),
        reply_to: replyTo || null
    };
    const { error } = await supabase.from('group_messages').insert([newMsg]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, message: newMsg });
});

app.post('/add-group-member', async (req, res) => {
    const { groupId, username, addedBy } = req.body;
    if (!groupId || !username || !addedBy) return res.status(400).json({ error: 'Недостаточно данных' });
    const { data: adminCheck } = await supabase.from('group_members').select('role').eq('group_id', groupId).eq('username', addedBy);
    if (!adminCheck || adminCheck[0]?.role !== 'admin') return res.status(403).json({ error: 'Только администратор может добавлять участников' });
    const { error } = await supabase.from('group_members').insert([{ group_id: groupId, username, role: 'member' }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/get-group-members/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { data } = await supabase.from('group_members').select('username, role').eq('group_id', groupId);
    res.json(data || []);
});

// ========== РЕАКЦИИ ==========
app.post('/add-reaction', async (req, res) => {
    const { messageId, type, username, reaction } = req.body;
    if (!messageId || !type || !username || !reaction) return res.status(400).json({ error: 'Недостаточно данных' });
    let table = type === 'user' ? 'reactions' : 'group_reactions';
    await supabase.from(table).delete().eq('message_id', messageId).eq('username', username);
    const { error } = await supabase.from(table).insert([{ message_id: messageId, username, reaction }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

app.get('/get-reactions/:messageId/:type', async (req, res) => {
    const { messageId, type } = req.params;
    let table = type === 'user' ? 'reactions' : 'group_reactions';
    const { data } = await supabase.from(table).select('username, reaction').eq('message_id', parseInt(messageId));
    res.json(data || []);
});

// ========== РЕДАКТИРОВАНИЕ ==========
app.put('/edit-message/:id', async (req, res) => {
    const { id } = req.params;
    const { text, type } = req.body;
    if (!text) return res.status(400).json({ error: 'Текст не может быть пустым' });
    let table = type === 'user' ? 'messages' : 'group_messages';
    const { error } = await supabase.from(table).update({ text, edited: true }).eq('id', parseInt(id));
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// ========== ЗАКРЕПЛЕНИЕ ==========
app.post('/pin-message', async (req, res) => {
    const { groupId, messageId, pinnedBy } = req.body;
    if (!groupId || !messageId || !pinnedBy) return res.status(400).json({ error: 'Недостаточно данных' });
    await supabase.from('group_pinned_messages').upsert([{ group_id: groupId, message_id: messageId, pinned_by: pinnedBy }]);
    res.json({ success: true });
});

// ========== ЧЕРНОВИКИ ==========
app.post('/save-draft', async (req, res) => {
    const { username, chatId, chatType, draftText } = req.body;
    if (!username || !chatId || !chatType) return res.status(400).json({ error: 'Недостаточно данных' });
    await supabase.from('drafts').upsert([{ username, chat_id: chatId, chat_type: chatType, draft_text: draftText, updated_at: new Date() }], {
        onConflict: 'username, chat_id, chat_type'
    });
    res.json({ success: true });
});

app.get('/get-drafts/:username', async (req, res) => {
    const { username } = req.params;
    const { data } = await supabase.from('drafts').select('*').eq('username', username);
    res.json(data || []);
});

// ========== АДМИН-ПАНЕЛЬ ==========
app.get('/admin/users', async (req, res) => {
    const { data } = await supabase.from('users').select('username, avatar, verified, role, online');
    res.json(data || []);
});

app.post('/admin/set-role', async (req, res) => {
    const { adminUsername, targetUsername, role } = req.body;
    if (!adminUsername || !targetUsername || !role) return res.status(400).json({ error: 'Недостаточно данных' });
    const { data: admin } = await supabase.from('users').select('role').eq('username', adminUsername);
    if (!admin || admin[0]?.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
    await supabase.from('users').update({ role }).eq('username', targetUsername);
    res.json({ success: true });
});

app.get('/admin/stats', async (req, res) => {
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: messageCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    const { count: groupCount } = await supabase.from('groups').select('*', { count: 'exact', head: true });
    const { count: groupMessageCount } = await supabase.from('group_messages').select('*', { count: 'exact', head: true });
    res.json({ users: userCount || 0, messages: messageCount || 0, groups: groupCount || 0, groupMessages: groupMessageCount || 0 });
});

// ========== ФАЙЛЫ ==========
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

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
