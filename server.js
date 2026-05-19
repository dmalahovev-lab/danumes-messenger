const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Папки и файлы — создаём без выхода при ошибке
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
} catch (err) {
    console.error('Не удалось создать папки/файлы (но сервер продолжит работу):', err.message);
}

// Функции чтения/записи с защитой от ошибок
function readUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch(e) { return []; }
}
function writeUsers(users) {
    try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); } catch(e) { console.error('Ошибка записи users'); }
}
function readMessages() {
    try { return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch(e) { return []; }
}
function writeMessages(messages) {
    try { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2)); } catch(e) { console.error('Ошибка записи messages'); }
}

// Multer — настройка хранения (если папка uploads не создалась, используем /tmp как fallback)
let upload;
try {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, unique + path.extname(file.originalname));
        }
    });
    upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
} catch(e) {
    console.error('Multer error, using memory storage fallback');
    upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
}

app.use(express.json());
app.use(express.static(__dirname));

// Системные пользователи
const SYSTEM_USERS = [
    { username: 'Danumala', password: 'danumala123', avatar: '👑' },
    { username: 'RunFly', password: 'runfly123', avatar: '🚀' }
];
let users = readUsers();
SYSTEM_USERS.forEach(sysUser => {
    if (!users.find(u => u.username === sysUser.username)) users.push(sysUser);
});
writeUsers(users);

// API маршруты (без изменений)
app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    let users = readUsers();
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Пользователь уже существует' });
    users.push({ username, password, avatar: '👤' });
    writeUsers(users);
    res.json({ success: true });
});

app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    let users = readUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) res.json({ success: true, username: user.username, avatar: user.avatar });
    else res.json({ success: false, error: 'Неверные имя или пароль' });
});

app.post('/send-message', (req, res) => {
    const { username, text, fileUrl, fileName } = req.body;
    if (!username || (!text && !fileUrl)) return res.status(400).json({ error: 'Нет данных' });
    const messages = readMessages();
    const newMsg = { id: Date.now(), username, text: text || '', timestamp: new Date().toISOString(), fileUrl: fileUrl || null, fileName: fileName || null };
    messages.push(newMsg);
    writeMessages(messages);
    res.json({ success: true, message: newMsg });
});

app.get('/get-messages', (req, res) => { res.json(readMessages()); });
app.get('/init-messages', (req, res) => { res.json({ messages: readMessages() }); });

app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    let fileUrl, fileName;
    if (req.file.path) {
        fileUrl = `/file/${req.file.filename}`;
        fileName = req.file.originalname;
    } else {
        // fallback для memoryStorage — не сохраняем, а отдаём как data URL (для демо)
        const base64 = req.file.buffer.toString('base64');
        fileUrl = `data:${req.file.mimetype};base64,${base64}`;
        fileName = req.file.originalname;
    }
    res.json({ success: true, fileUrl, fileName });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
