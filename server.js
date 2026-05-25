const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const SUPABASE_URL = 'https://uqlihmsrxmjeqlddztuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGlobXNyeG1qZXFsZGR6dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjQ3NTEsImV4cCI6MjA5NDg0MDc1MX0.NjTgmgL9SrW0taod0aEETjqe56BtyA7c8m7Hw_fyJu8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// File upload configuration
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Helper function to handle database errors
const handleDbError = (res, error, customMessage = 'Database error') => {
    console.error(customMessage, error);
    return res.status(500).json({ success: false, error: customMessage });
};

// ========== USER AUTHENTICATION ==========
app.post('/register-attempt', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, error: 'Заполните все поля' });
    }

    try {
        const { data: existing } = await supabase
            .from('users')
            .select('username')
            .eq('username', username);

        if (existing && existing.length > 0) {
            return res.json({ success: false, error: 'Пользователь уже существует' });
        }

        const { error } = await supabase
            .from('users')
            .insert([{ username, password, avatar: '👤', online: true, verified: false }]);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleDbError(res, error, 'Registration error');
    }
});

app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, avatar, verified')
            .eq('username', username)
            .eq('password', password);

        if (error) throw error;
        if (!data || data.length === 0) {
            return res.json({ success: false, error: 'Неверное имя пользователя или пароль' });
        }

        await supabase.from('users').update({ online: true }).eq('username', username);
        res.json({ success: true, username: data[0].username, avatar: data[0].avatar, verified: data[0].verified });
    } catch (error) {
        handleDbError(res, error, 'Login error');
    }
});

app.post('/logout', async (req, res) => {
    const { username } = req.body;
    if (username) {
        await supabase.from('users').update({ online: false }).eq('username', username);
    }
    res.json({ success: true });
});

app.get('/get-users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, avatar, online, verified');
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        handleDbError(res, error, 'Error fetching users');
    }
});

app.post('/update-avatar', async (req, res) => {
    const { username, avatar } = req.body;
    try {
        const { error } = await supabase
            .from('users')
            .update({ avatar })
            .eq('username', username);
        if (error) throw error;
        res.json({ success: true, avatar });
    } catch (error) {
        handleDbError(res, error, 'Error updating avatar');
    }
});

// ========== PRIVATE MESSAGES ==========
app.post('/send-message', async (req, res) => {
    const { from, to, text, fileUrl, fileName, replyToId } = req.body;
    
    if (!from || !to || (!text && !fileUrl)) {
        return res.status(400).json({ success: false, error: 'Недостаточно данных' });
    }

    try {
        const newMessage = {
            from_user: from,
            to_user: to,
            text: text || '',
            file_url: fileUrl || null,
            file_name: fileName || null,
            reply_to: replyToId || null,
            timestamp: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('messages')
            .insert([newMessage])
            .select();

        if (error) throw error;
        
        console.log(`✅ Message sent from ${from} to ${to}`);
        res.json({ success: true, message: data[0] });
    } catch (error) {
        handleDbError(res, error, 'Error sending message');
    }
});

app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`and(from_user.eq.${user1},to_user.eq.${user2}),and(from_user.eq.${user2},to_user.eq.${user1})`)
            .order('timestamp', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        handleDbError(res, error, 'Error fetching messages');
    }
});

app.put('/edit-message/:id', async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    
    try {
        const { error } = await supabase
            .from('messages')
            .update({ text, edited: true, edited_at: new Date().toISOString() })
            .eq('id', parseInt(id));
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleDbError(res, error, 'Error editing message');
    }
});

app.delete('/delete-message/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase
            .from('messages')
            .delete()
            .eq('id', parseInt(id));
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        handleDbError(res, error, 'Error deleting message');
    }
});

// ========== REACTIONS ==========
app.post('/add-reaction', async (req, res) => {
    const { messageId, userId, reaction, type } = req.body;
    const table = type === 'group' ? 'group_reactions' : 'reactions';
    
    try {
        // Check if reaction already exists
        const { data: existing } = await supabase
            .from(table)
            .select('*')
            .eq('message_id', messageId)
            .eq('user_id', userId);
        
        if (existing && existing.length > 0) {
            // Update existing reaction
            const { error } = await supabase
                .from(table)
                .update({ reaction, timestamp: new Date().toISOString() })
                .eq('message_id', messageId)
                .eq('user_id', userId);
            
            if (error) throw error;
        } else {
            // Add new reaction
            const { error } = await supabase
                .from(table)
                .insert([{ message_id: messageId, user_id: userId, reaction, timestamp: new Date().toISOString() }]);
            
            if (error) throw error;
        }
        
        res.json({ success: true });
    } catch (error) {
        handleDbError(res, error, 'Error adding reaction');
    }
});

app.get('/get-reactions/:messageId/:type', async (req, res) => {
    const { messageId, type } = req.params;
    const table = type === 'group' ? 'group_reactions' : 'reactions';
    
    try {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('message_id', parseInt(messageId));
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        handleDbError(res, error, 'Error fetching reactions');
    }
});

// ========== GROUPS ==========
app.post('/create-group', async (req, res) => {
    const { name, creator, members } = req.body;
    
    try {
        // Create group
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert([{ name, created_by: creator, created_at: new Date().toISOString() }])
            .select();
        
        if (groupError) throw groupError;
        
        const groupId = group[0].id;
        
        // Add members
        const allMembers = [...new Set([creator, ...members])];
        const memberInserts = allMembers.map(username => ({
            group_id: groupId,
            user_id: username,
            role: username === creator ? 'admin' : 'member',
            joined_at: new Date().toISOString()
        }));
        
        const { error: memberError } = await supabase
            .from('group_members')
            .insert(memberInserts);
        
        if (memberError) throw memberError;
        
        res.json({ success: true, group: group[0] });
    } catch (error) {
        handleDbError(res, error, 'Error creating group');
    }
});

app.get('/get-groups/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                group_id,
                role,
                groups (
                    id,
                    name,
                    created_by,
                    created_at
                )
            `)
            .eq('user_id', username);
        
        if (error) throw error;
        
        const groups = data
            .filter(item => item.groups)
            .map(item => ({
                id: item.groups.id,
                name: item.groups.name,
                role: item.role,
                created_by: item.groups.created_by,
                created_at: item.groups.created_at
            }));
        
        res.json(groups);
    } catch (error) {
        handleDbError(res, error, 'Error fetching groups');
    }
});

app.post('/send-group-message', async (req, res) => {
    const { groupId, from, text, fileUrl, fileName, replyToId } = req.body;
    
    if (!groupId || !from || (!text && !fileUrl)) {
        return res.status(400).json({ success: false, error: 'Недостаточно данных' });
    }
    
    try {
        const newMessage = {
            group_id: parseInt(groupId),
            from_user: from,
            text: text || '',
            file_url: fileUrl || null,
            file_name: fileName || null,
            reply_to: replyToId || null,
            timestamp: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('group_messages')
            .insert([newMessage])
            .select();
        
        if (error) throw error;
        
        // Get all group members for notifications
        const { data: members } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);
        
        console.log(`✅ Group message sent to group ${groupId} by ${from}`);
        res.json({ success: true, message: data[0], members: members?.map(m => m.user_id) || [] });
    } catch (error) {
        handleDbError(res, error, 'Error sending group message');
    }
});

app.get('/get-group-messages/:groupId', async (req, res) => {
    const { groupId } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', parseInt(groupId))
            .order('timestamp', { ascending: true });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        handleDbError(res, error, 'Error fetching group messages');
    }
});

// ========== PINNED MESSAGES ==========
app.post('/pin-group-message', async (req, res) => {
    const { groupId, messageId, pinnedBy } = req.body;
    
    try {
        // Check if already pinned
        const { data: existing } = await supabase
            .from('group_pinned_messages')
            .select('*')
            .eq('group_id', groupId)
            .eq('message_id', messageId);
        
        if (existing && existing.length > 0) {
            // Unpin
            const { error } = await supabase
                .from('group_pinned_messages')
                .delete()
                .eq('group_id', groupId)
                .eq('message_id', messageId);
            
            if (error) throw error;
            res.json({ success: true, action: 'unpinned' });
        } else {
            // Pin
            const { error } = await supabase
                .from('group_pinned_messages')
                .insert([{ group_id: groupId, message_id: messageId, pinned_by: pinnedBy, pinned_at: new Date().toISOString() }]);
            
            if (error) throw error;
            res.json({ success: true, action: 'pinned' });
        }
    } catch (error) {
        handleDbError(res, error, 'Error pinning message');
    }
});

app.get('/get-pinned-messages/:groupId', async (req, res) => {
    const { groupId } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('group_pinned_messages')
            .select('*, group_messages(*)')
            .eq('group_id', parseInt(groupId));
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        handleDbError(res, error, 'Error fetching pinned messages');
    }
});

// ========== DRAFTS ==========
app.post('/save-draft', async (req, res) => {
    const { userId, chatId, chatType, text } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('drafts')
            .select('*')
            .eq('user_id', userId)
            .eq('chat_id', chatId)
            .eq('chat_type', chatType);
        
        if (data && data.length > 0) {
            // Update existing draft
            const { error: updateError } = await supabase
                .from('drafts')
                .update({ text, updated_at: new Date().toISOString() })
                .eq('id', data[0].id);
            
            if (updateError) throw updateError;
        } else {
            // Insert new draft
            const { error: insertError } = await supabase
                .from('drafts')
                .insert([{ user_id: userId, chat_id: chatId, chat_type: chatType, text, updated_at: new Date().toISOString() }]);
            
            if (insertError) throw insertError;
        }
        
        res.json({ success: true });
    } catch (error) {
        handleDbError(res, error, 'Error saving draft');
    }
});

app.get('/get-draft/:userId/:chatId/:chatType', async (req, res) => {
    const { userId, chatId, chatType } = req.params;
    
    try {
        const { data, error } = await supabase
            .from('drafts')
            .select('text')
            .eq('user_id', userId)
            .eq('chat_id', chatId)
            .eq('chat_type', chatType)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
        
        res.json({ text: data?.text || '' });
    } catch (error) {
        handleDbError(res, error, 'Error fetching draft');
    }
});

// ========== FILE UPLOAD ==========
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    res.json({ 
        success: true, 
        fileUrl: `/file/${req.file.filename}`, 
        fileName: req.file.originalname 
    });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Файл не найден');
    }
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
