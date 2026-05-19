const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
} catch (err) {
    console.error('Ошибка при создании папок/файлов:', err);
    process.exit(1);
}

function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE);
        return JSON.parse(data);
    } catch (e) { return []; }
}
function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
function readMessages() {
    try {
        const data = fs.readFileSync(MESSAGES_FILE);
        return JSON.parse(data);
    } catch (e) { return []; }
}
function writeMessages(messages) {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

const SYSTEM_USERS = [
    { username: 'Danumala', password: 'danumala123', avatar: '👑' },
    { username: 'RunFly', password: 'runfly123', avatar: '🚀' }
];

let users = readUsers();
SYSTEM_USERS.forEach(sysUser => {
    if (!users.find(u => u.username === sysUser.username)) {
        users.push(sysUser);
    }
});
writeUsers(users);

// Все маршруты (такие же как раньше)
app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    let users = readUsers();
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Уже есть' });
    users.push({ username, password, avatar: '👤' });
    writeUsers(users);
    res.json({ success: true });
});

app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    let users = readUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) res.json({ success: true, username: user.username, avatar: user.avatar });
    else res.json({ success: false, error: 'Неверно' });
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
    res.json({ success: true, fileUrl: `/file/${req.file.filename}`, fileName: req.file.originalname });
});

app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

app.listen(PORT, () => { console.log(`Сервер работает на порту ${PORT}`); });
