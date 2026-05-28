const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = 'https://uqlihmsrxmjeqlddztuq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbGlobXNyeG1qZXFsZGR6dHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNjQ3NTEsImV4cCI6MjA5NDg0MDc1MX0.NjTgmgL9SrW0taod0aEETjqe56BtyA7c8m7Hw_fyJu8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const VERIFIED_USERS = ['Danumala', 'RunFly'];

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// ========== USER AUTH ==========
app.post('/register-attempt', async (req, res) => {
    const { username, password } = req.body;
    console.log('📝 Register:', username);
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Заполните поля' });
    }

    try {
        const { data: existing } = await supabase
            .from('users')
            .select('username')
            .eq('username', username);
        
        if (existing && existing.length > 0) {
            return res.json({ success: false, error: 'Пользователь уже существует' });
        }

        const isVerified = VERIFIED_USERS.includes(username);
        const { error } = await supabase
            .from('users')
            .insert([{ 
                username, 
                password, 
                avatar: '👤', 
                online: false, 
                verified: isVerified 
            }]);
        
        if (error) throw error;
        
        console.log('✅ User registered:', username);
        res.json({ success: true });
    } catch (error) {
        console.error('Registration error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/login-attempt', async (req, res) => {
    const { username, password } = req.body;
    console.log('🔐 Login attempt:', username, 'password:', password);
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Заполните поля' });
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('username, avatar, verified, password')
            .eq('username', username);
        
        if (error) {
            console.error('DB Error:', error);
            return res.json({ success: false, error: error.message });
        }
        
        console.log('Found user:', data);
        
        if (!data || data.length === 0) {
            return res.json({ success: false, error: 'Пользователь не найден' });
        }
        
        const user = data[0];
        
        if (user.password !== password) {
            console.log('Password mismatch:', user.password, '!=', password);
            return res.json({ success: false, error: 'Неверный пароль' });
        }

        // Обновляем статус онлайн
        await supabase
            .from('users')
            .update({ online: true })
            .eq('username', username);
        
        console.log('✅ Login successful:', username);
        res.json({ 
            success: true, 
            username: user.username, 
            avatar: user.avatar || '👤', 
            verified: user.verified || false 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.json({ success: false, error: error.message });
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
        const { data } = await supabase.from('users').select('username, avatar, online, verified');
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.post('/update-avatar', async (req, res) => {
    const { username, avatar } = req.body;
    const { error } = await supabase.from('users').update({ avatar }).eq('username', username);
    res.json({ success: !error, avatar });
});

// ========== MESSAGES ==========
app.post('/send-message', async (req, res) => {
    const { from, to, text, fileUrl, fileName, fileType } = req.body;
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
            file_type: fileType || null,
            timestamp: new Date().toISOString()
        };
        const { data, error } = await supabase.from('messages').insert([newMessage]).select();
        if (error) throw error;
        res.json({ success: true, message: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-messages/:user1/:user2', async (req, res) => {
    const { user1, user2 } = req.params;
    try {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`and(from_user.eq.${user1},to_user.eq.${user2}),and(from_user.eq.${user2},to_user.eq.${user1})`)
            .order('timestamp', { ascending: true });
        res.json(data || []);
    } catch (error) {
        res.json([]);
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
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== REACTIONS ==========
app.post('/add-reaction', async (req, res) => {
    const { messageId, userId, reaction, type } = req.body;
    const table = type === 'group' ? 'group_reactions' : 'reactions';
    
    try {
        const { data: existing } = await supabase
            .from(table)
            .select('*')
            .eq('message_id', messageId)
            .eq('user_id', userId);
        
        if (existing?.length) {
            await supabase.from(table).delete().eq('message_id', messageId).eq('user_id', userId);
        } else {
            await supabase.from(table).insert([{ message_id: messageId, user_id: userId, reaction, timestamp: new Date().toISOString() }]);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-reactions/:messageId/:type', async (req, res) => {
    const { messageId, type } = req.params;
    const table = type === 'group' ? 'group_reactions' : 'reactions';
    try {
        const { data } = await supabase.from(table).select('*').eq('message_id', parseInt(messageId));
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

// ========== GROUPS ==========
app.post('/create-group', async (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) {
        return res.status(400).json({ success: false, error: 'Недостаточно данных' });
    }
    
    try {
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .insert([{ name, created_by: creator, created_at: new Date().toISOString() }])
            .select();
        
        if (groupError) throw groupError;
        
        const groupId = group[0].id;
        
        const allMembers = [creator, ...(members || [])];
        const memberInserts = allMembers.map(username => ({
            group_id: groupId,
            user_id: username,
            role: 'member',
            joined_at: new Date().toISOString()
        }));
        
        const { error: memberError } = await supabase.from('group_members').insert(memberInserts);
        if (memberError) throw memberError;
        
        res.json({ success: true, group: group[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-groups/:username', async (req, res) => {
    const { username } = req.params;
    try {
        const { data: memberData } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('user_id', username);
        
        if (!memberData || memberData.length === 0) {
            return res.json([]);
        }
        
        const groupIds = memberData.map(m => m.group_id);
        
        const { data: groupsData } = await supabase
            .from('groups')
            .select('*')
            .in('id', groupIds);
        
        const result = groupsData.map(group => ({
            id: group.id,
            name: group.name,
            created_by: group.created_by,
            created_at: group.created_at
        }));
        
        res.json(result);
    } catch (error) {
        res.json([]);
    }
});

app.post('/leave-group', async (req, res) => {
    const { groupId, userId } = req.body;
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
    res.json({ success: true });
});

app.post('/send-group-message', async (req, res) => {
    const { groupId, from, text, fileUrl, fileName, fileType } = req.body;
    
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
            file_type: fileType || null,
            timestamp: new Date().toISOString()
        };
        
        const { data, error } = await supabase.from('group_messages').insert([newMessage]).select();
        if (error) throw error;
        res.json({ success: true, message: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-group-messages/:groupId', async (req, res) => {
    const { groupId } = req.params;
    try {
        const { data } = await supabase
            .from('group_messages')
            .select('*')
            .eq('group_id', parseInt(groupId))
            .order('timestamp', { ascending: true });
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

// ========== CHANNELS ==========
app.post('/create-channel', async (req, res) => {
    const { name, creator } = req.body;
    if (!name || !creator) {
        return res.status(400).json({ success: false, error: 'Недостаточно данных' });
    }
    
    try {
        const { data, error } = await supabase
            .from('channels')
            .insert([{ name, created_by: creator, created_at: new Date().toISOString() }])
            .select();
        
        if (error) throw error;
        res.json({ success: true, channel: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-channels/:username', async (req, res) => {
    try {
        const { data } = await supabase
            .from('channels')
            .select('*')
            .order('created_at', { ascending: false });
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.post('/send-channel-message', async (req, res) => {
    const { channelId, from, text, fileUrl, fileName, fileType } = req.body;
    
    if (!channelId || !from || (!text && !fileUrl)) {
        return res.status(400).json({ success: false, error: 'Недостаточно данных' });
    }
    
    try {
        const newMessage = {
            channel_id: parseInt(channelId),
            from_user: from,
            text: text || '',
            file_url: fileUrl || null,
            file_name: fileName || null,
            file_type: fileType || null,
            timestamp: new Date().toISOString()
        };
        
        const { data, error } = await supabase.from('channel_messages').insert([newMessage]).select();
        if (error) throw error;
        res.json({ success: true, message: data[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/get-channel-messages/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        const { data } = await supabase
            .from('channel_messages')
            .select('*')
            .eq('channel_id', parseInt(channelId))
            .order('timestamp', { ascending: true });
        res.json(data || []);
    } catch (error) {
        res.json([]);
    }
});

app.post('/subscribe-channel', async (req, res) => {
    const { channelId, userId } = req.body;
    const { error } = await supabase.from('channel_subscribers').insert([{ channel_id: channelId, user_id: userId }]);
    res.json({ success: !error });
});

app.post('/unsubscribe-channel', async (req, res) => {
    const { channelId, userId } = req.body;
    const { error } = await supabase.from('channel_subscribers').delete().eq('channel_id', channelId).eq('user_id', userId);
    res.json({ success: !error });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
