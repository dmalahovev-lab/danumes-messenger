const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = process.env.RENDER ? '/tmp/danumes.db' : path.join(__dirname, 'danumes.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT '👤',
        online INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        text TEXT,
        file_url TEXT,
        file_name TEXT,
        timestamp TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        avatar TEXT DEFAULT '📢',
        only_owner_can_post INTEGER DEFAULT 1
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS channel_messages (
        id INTEGER PRIMARY KEY,
        channel_id TEXT NOT NULL,
        from_user TEXT NOT NULL,
        text TEXT,
        file_url TEXT,
        file_name TEXT,
        timestamp TEXT
    )`);

    const stmt = db.prepare(`INSERT OR IGNORE INTO users (username, password, avatar, verified) VALUES (?, ?, ?, ?)`);
    stmt.run('Danumala', 'danyajukovka', '👑', 1);
    stmt.run('RunFly', 'GGWWXXJJ2001', '🚀', 1);
    stmt.finalize();

    db.run(`INSERT OR IGNORE INTO channels (id, name, owner) VALUES ('news', 'Danumes News', 'Danumala')`);
});

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

// ========== API ==========

app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    db.get(`SELECT username FROM users WHERE username = ?`, [username], (err, row) => {
        if (row) return res.json({ success: false, error: 'Пользователь уже существует' });
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password], (err) => {
            if (err) return res.json({ success: false, error: 'Ошибка БД' });
            res.json({ success: true });
        });
    });
});

app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT username, avatar, verified FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
        if (row) {
            db.run(`UPDATE users SET online = 1 WHERE username = ?`, [username]);
            res.json({ success: true, username: row.username, avatar: row.avatar, verified: row.verified });
        } else {
            res.json({ success: false, error: 'Неверные имя или пароль' });
        }
    });
});

app.post('/logout', (req, res) => {
    const { username } = req.body;
    db.run(`UPDATE users SET online = 0 WHERE username = ?`, [username]);
    res.json({ success: true });
});

app.get('/get-users', (req, res) => {
    db.all(`SELECT username, avatar, online, verified FROM users`, [], (err, rows) => {
        res.json(rows);
    });
});

app.post('/update-avatar', (req, res) => {
    const { username, avatar } = req.body;
    db.run(`UPDATE users SET avatar = ? WHERE username = ?`, [avatar, username]);
    res.json({ success: true, avatar });
});

app.post('/send-message', (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    const id = Date.now();
    const timestamp = new Date().toISOString();
    db.run(`INSERT INTO messages (id, from_user, to_user, text, file_url, file_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, from, to, text || '', fileUrl || null, fileName || null, timestamp], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: { id, from, to, text, timestamp, fileUrl, fileName } });
        });
});

app.get('/get-messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    db.all(`SELECT id, from_user as from, to_user as to, text, file_url as fileUrl, file_name as fileName, timestamp 
            FROM messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY id ASC`,
        [user1, user2, user2, user1], (err, rows) => {
            res.json(rows);
        });
});

app.get('/get-chats/:username', (req, res) => {
    const { username } = req.params;
    db.all(`SELECT DISTINCT 
                CASE WHEN from_user = ? THEN to_user ELSE from_user END as chatUser
            FROM messages WHERE from_user = ? OR to_user = ?`, [username, username, username], (err, rows) => {
        const chatSet = rows.map(r => r.chatUser);
        db.all(`SELECT username, avatar, online, verified FROM users`, [], (err, users) => {
            const allUsers = users.map(u => u.username).filter(u => u !== username);
            const uniqueChats = [...new Set([...chatSet, ...allUsers])];
            const chatList = uniqueChats.map(chatUsername => {
                const user = users.find(u => u.username === chatUsername);
                return {
                    username: chatUsername,
                    avatar: user ? user.avatar : '👤',
                    online: user ? user.online : false,
                    verified: user ? user.verified : false,
                    lastMessage: 'Нет сообщений',
                    lastTime: null
                };
            });
            const promises = chatList.map(chat => {
                return new Promise((resolve) => {
                    db.get(`SELECT text, file_url, timestamp FROM messages 
                            WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) 
                            ORDER BY id DESC LIMIT 1`,
                        [username, chat.username, chat.username, username], (err, row) => {
                            if (row) {
                                chat.lastMessage = row.text || 'Файл';
                                chat.lastTime = row.timestamp;
                            }
                            resolve();
                        });
                });
            });
            Promise.all(promises).then(() => {
                chatList.sort((a,b) => (b.lastTime || 0) - (a.lastTime || 0));
                res.json(chatList);
            });
        });
    });
});

app.get('/get-channels', (req, res) => {
    db.all(`SELECT id, name, owner, avatar FROM channels`, [], (err, rows) => {
        const channelList = rows.map(ch => ({ ...ch, lastMessage: 'Нет сообщений', lastTime: null }));
        res.json(channelList);
    });
});

app.get('/get-channel-messages/:channelId', (req, res) => {
    const { channelId } = req.params;
    db.all(`SELECT id, from_user as from, text, file_url as fileUrl, file_name as fileName, timestamp 
            FROM channel_messages WHERE channel_id = ? ORDER BY id ASC`, [channelId], (err, rows) => {
        res.json(rows);
    });
});

app.post('/send-channel-message', (req, res) => {
    const { channelId, from, text, fileUrl, fileName } = req.body;
    if (!channelId || !from || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    db.get(`SELECT owner, only_owner_can_post FROM channels WHERE id = ?`, [channelId], (err, row) => {
        if (row && row.only_owner_can_post && from !== row.owner) {
            return res.status(403).json({ error: 'Только владелец канала может отправлять сообщения' });
        }
        const id = Date.now();
        const timestamp = new Date().toISOString();
        db.run(`INSERT INTO channel_messages (id, channel_id, from_user, text, file_url, file_name, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, channelId, from, text || '', fileUrl || null, fileName || null, timestamp], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: { id, channelId, from, text, timestamp, fileUrl, fileName } });
            });
    });
});

app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    res.json({ success: true, fileUrl: `/file/${req.file.filename}`, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.delete('/delete-message/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT file_url FROM messages WHERE id = ?`, [id], (err, row) => {
        if (row && row.file_url) {
            const fileName = row.file_url.replace('/file/', '');
            const filePath = path.join(UPLOADS_DIR, fileName);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.run(`DELETE FROM messages WHERE id = ?`, [id]);
        res.json({ success: true });
    });
});

app.delete('/delete-channel-message/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT file_url FROM channel_messages WHERE id = ?`, [id], (err, row) => {
        if (row && row.file_url) {
            const fileName = row.file_url.replace('/file/', '');
            const filePath = path.join(UPLOADS_DIR, fileName);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        db.run(`DELETE FROM channel_messages WHERE id = ?`, [id]);
        res.json({ success: true });
    });
});

// Админ-панель для Danumala
app.get('/admin', (req, res) => {
    // Простая проверка, что запрос пришёл от Danumala (можно улучшить, но для теста)
    // Реальная аутентификация требует сессий, а пока просто покажем таблицу
    db.all(`SELECT username, password, avatar, verified FROM users`, [], (err, rows) => {
        if (err) return res.status(500).send('Ошибка БД');
        let html = '<h1>Админ-панель DanuMes</h1><table border="1" cellpadding="5"><tr><th>Логин</th><th>Пароль</th><th>Аватар</th><th>Верифицирован</th></tr>';
        rows.forEach(u => {
            html += `<tr><td>${u.username}</td><td>${u.password}</td><td>${u.avatar}</td><td>${u.verified ? '✓' : 'Нет'}</td></tr>`;
        });
        html += '</table><p><a href="/">Вернуться в мессенджер</a></p>';
        res.send(html);
    });
});

app.listen(PORT, () => console.log(`🚀 Сервер SQLite запущен на порту ${PORT}`));
