const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Прямое подключение к базе данных Supabase через порт 5432
const SUPABASE_CONNECTION_STRING = "postgresql://postgres.ostghvdjaxsidrvwkfgj:danyajukovka@://supabase.com";

const pool = new Pool({
    connectionString: SUPABASE_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ADMIN_USERNAME = 'Danumala'; 
const NEWS_GROUP_NAME = 'DanuMes news';

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                last_seen BIGINT NOT NULL,
                avatar TEXT
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                msg_from TEXT NOT NULL,
                msg_to TEXT NOT NULL,
                msg_text TEXT NOT NULL,
                is_group BOOLEAN NOT NULL,
                timestamp BIGINT NOT NULL
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                name TEXT PRIMARY KEY,
                creator TEXT NOT NULL,
                members TEXT[] NOT NULL
            );
        `);

        const adminHash = hashPassword('danyajukovka');
        await pool.query(`
            INSERT INTO users (username, password, last_seen) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (username) DO NOTHING
        `, [ADMIN_USERNAME, adminHash, Date.now()]);

        await pool.query(`
            INSERT INTO groups (name, creator, members) 
            VALUES ($1, $2, $3) 
            ON CONFLICT (name) DO NOTHING
        `, [NEWS_GROUP_NAME, ADMIN_USERNAME, [ADMIN_USERNAME]]);

        console.log("🚀 Неубиваемая база данных Supabase успешно запущена и защищена!");
    } catch (e) {
        console.error("Ошибка инициализации базы данных:", e);
    }
}

initDB();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ ---
app.post('/api/register', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) return res.status(400).json({ success: false, error: 'Заполните поля' });
    
    try {
        const userExists = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
        
        const securePassword = hashPassword(password);
        await pool.query('INSERT INTO users (username, password, last_seen) VALUES ($1, $2, $3)', [username, securePassword, Date.now()]);
        
        await pool.query('UPDATE groups SET members = array_append(members, $1) WHERE name = $2 AND NOT ($1 = ANY(members))', [username, NEWS_GROUP_NAME]);
        
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

app.post('/api/login', async (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        // Исправлено чтение первого найденного пользователя из массива rows
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
        }

        const user = result.rows[0]; 
        const inputHash = hashPassword(password);
        
        if (user.password !== inputHash) {
            return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
        }
        
        await pool.query('UPDATE users SET last_seen = $1 WHERE username = $2', [Date.now(), username]);
        await pool.query('UPDATE groups SET members = array_append(members, $1) WHERE name = $2 AND NOT ($1 = ANY(members))', [username, NEWS_GROUP_NAME]);
        
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, error: 'Ошибка входа' }); }
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

app.post('/api/sync', async (req, res) => {
    const username = (req.body.user || '').trim();
    
    try {
        if (username) {
            await pool.query('UPDATE users SET last_seen = $1 WHERE username = $2', [Date.now(), username]);
        }
        
        const usersResult = await pool.query('SELECT username, last_seen, avatar FROM users');
        const activeUsers = {};
        const now = Date.now();
        
        usersResult.rows.forEach(u => {
            activeUsers[u.username] = {
                online: (now - parseInt(u.last_seen)) < 10000,
                avatar: u.avatar || null
            };
        });

        const msgResult = await pool.query('SELECT id, msg_from as from, msg_to as to, msg_text as text, is_group as "isGroup", timestamp FROM messages');
        const groupsResult = await pool.query('SELECT name, creator, members FROM groups WHERE $1 = ANY(members)', [username]);
        
        res.json({
            users: activeUsers,
            messages: msgResult.rows,
            groups: groupsResult.rows
        });
    } catch(e) { res.json({ users: {}, messages: [], groups: [] }); }
});

app.post('/api/messages/send', async (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    if (isGroup && to === NEWS_GROUP_NAME && from !== ADMIN_USERNAME) {
        return res.status(403).json({ success: false, error: 'Только администратор может писать в этот канал!' });
    }
    
    const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    try {
        await pool.query(
            'INSERT INTO messages (id, msg_from, msg_to, msg_text, is_group, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
            [id, from, to || '', text, !!isGroup, Date.now()]
        );
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false }); }
});

app.post('/api/groups/create', async (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    try {
        const groupExists = await pool.query('SELECT name FROM groups WHERE name = $1', [name]);
        if (groupExists.rows.length > 0) return res.status(400).json({ success: false, error: 'Группа с таким названием уже есть' });

        const allMembers = [creator];
        if (members && Array.isArray(members)) {
            members.forEach(m => { if (!allMembers.includes(m)) allMembers.push(m); });
        }

        await pool.query('INSERT INTO groups (name, creator, members) VALUES ($1, $2, $3)', [name, creator, allMembers]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false }); }
});

app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
