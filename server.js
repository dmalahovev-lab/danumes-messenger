const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// На Render используем /tmp, иначе папку в текущей директории
const isRender = !!process.env.RENDER;
const DATA_DIR = isRender ? '/tmp/data' : path.join(__dirname, 'data');
const UPLOADS_DIR = isRender ? '/tmp/uploads' : path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

console.log('DATA_DIR =', DATA_DIR);
console.log('UPLOADS_DIR =', UPLOADS_DIR);

try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('✅ Папки созданы');
} catch (err) {
    console.error('❌ Ошибка создания папок:', err.message);
    process.exit(1);
}

function readJSON(file, defaultValue) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        return defaultValue;
    } catch (e) {
        console.error('Ошибка чтения', file, e.message);
        return defaultValue;
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Ошибка записи', file, e.message);
    }
}

let users = readJSON(USERS_FILE, []);
let messages = readJSON(MESSAGES_FILE, []);

const SYSTEM_USERS = [
    { username: 'Danumala', password: 'danumala123', avatar: '👑' },
    { username: 'RunFly', password: 'runfly123', avatar: '🚀' }
];

SYSTEM_USERS.forEach(sysUser => {
    if (!users.find(u => u.username === sysUser.username)) {
        users.push(sysUser);
    }
});
writeJSON(USERS_FILE, users);
writeJSON(MESSAGES_FILE, messages);
console.log(`👥 Пользователей: ${users.length}, сообщений: ${messages.length}`);

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

// === API ===
app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    let users = readJSON(USERS_FILE, []);
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Пользователь уже существует' });
    users.push({ username, password, avatar: '👤' });
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, username: user.username, avatar: user.avatar });
    } else {
        res.json({ success: false, error: 'Неверные имя или пароль' });
    }
});

app.post('/send-message', (req, res) => {
    const { username, text, fileUrl, fileName } = req.body;
    if (!username || (!text && !fileUrl)) return res.status(400).json({ error: 'Нет данных' });
    let messages = readJSON(MESSAGES_FILE, []);
    const newMsg = {
        id: Date.now(),
        username,
        text: text || '',
        timestamp: new Date().toISOString(),
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    messages.push(newMsg);
    writeJSON(MESSAGES_FILE, messages);
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages', (req, res) => {
    res.json(readJSON(MESSAGES_FILE, []));
});

app.get('/init-messages', (req, res) => {
    res.json({ messages: readJSON(MESSAGES_FILE, []) });
});

app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const fileUrl = `/file/${req.file.filename}`;
    res.json({ success: true, fileUrl, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Файл не найден');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
