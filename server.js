const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Папки данных
const DATA_DIR = process.env.RENDER ? '/tmp/data' : path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json'); // список чатов (диалогов)

// Инициализация папок
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Функции работы с JSON
function readJSON(file, def = []) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return def; }
}
function writeJSON(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch(e) { console.error(e); }
}

// Инициализация файлов
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(MESSAGES_FILE)) writeJSON(MESSAGES_FILE, []);
if (!fs.existsSync(CHATS_FILE)) writeJSON(CHATS_FILE, []);

// Системные пользователи
const SYSTEM_USERS = [
    { username: 'Danumala', password: 'danumala123', avatar: '👑', online: false },
    { username: 'RunFly', password: 'runfly123', avatar: '🚀', online: false }
];
let users = readJSON(USERS_FILE, []);
SYSTEM_USERS.forEach(sys => {
    if (!users.find(u => u.username === sys.username)) users.push(sys);
});
writeJSON(USERS_FILE, users);

// Настройка multer для файлов
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

// Регистрация
app.post('/register-attempt', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, error: 'Заполните поля' });
    let users = readJSON(USERS_FILE, []);
    if (users.find(u => u.username === username)) return res.json({ success: false, error: 'Пользователь уже существует' });
    users.push({ username, password, avatar: '👤', online: false });
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

// Вход
app.post('/login-attempt', (req, res) => {
    const { username, password } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        // обновляем онлайн статус
        user.online = true;
        writeJSON(USERS_FILE, users);
        res.json({ success: true, username: user.username, avatar: user.avatar });
    } else {
        res.json({ success: false, error: 'Неверные имя или пароль' });
    }
});

// Выход
app.post('/logout', (req, res) => {
    const { username } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username);
    if (user) user.online = false;
    writeJSON(USERS_FILE, users);
    res.json({ success: true });
});

// Получить всех пользователей (для списка чатов)
app.get('/get-users', (req, res) => {
    let users = readJSON(USERS_FILE, []);
    const safeUsers = users.map(({ username, avatar, online }) => ({ username, avatar, online }));
    res.json(safeUsers);
});

// Обновить аватар (эмодзи)
app.post('/update-avatar', (req, res) => {
    const { username, avatar } = req.body;
    let users = readJSON(USERS_FILE, []);
    const user = users.find(u => u.username === username);
    if (user) {
        user.avatar = avatar;
        writeJSON(USERS_FILE, users);
        res.json({ success: true, avatar });
    } else {
        res.json({ success: false, error: 'Пользователь не найден' });
    }
});

// Отправить личное сообщение
app.post('/send-message', (req, res) => {
    const { from, to, text, fileUrl, fileName } = req.body;
    if (!from || !to || (!text && !fileUrl)) return res.status(400).json({ error: 'Недостаточно данных' });
    let messages = readJSON(MESSAGES_FILE, []);
    const newMsg = {
        id: Date.now(),
        from,
        to,
        text: text || '',
        timestamp: new Date().toISOString(),
        fileUrl: fileUrl || null,
        fileName: fileName || null
    };
    messages.push(newMsg);
    writeJSON(MESSAGES_FILE, messages);
    res.json({ success: true, message: newMsg });
});

// Получить историю диалога между двумя пользователями
app.get('/get-messages/:user1/:user2', (req, res) => {
    const { user1, user2 } = req.params;
    let messages = readJSON(MESSAGES_FILE, []);
    const dialog = messages.filter(m => 
        (m.from === user1 && m.to === user2) || (m.from === user2 && m.to === user1)
    ).sort((a,b) => a.id - b.id);
    res.json(dialog);
});

// Загрузка файла (общая)
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    const fileUrl = `/file/${req.file.filename}`;
    res.json({ success: true, fileUrl, fileName: req.file.originalname });
});

// Отдача файла
app.get('/file/:filename', (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Файл не найден');
});

// Получить список чатов (уникальные собеседники для пользователя)
app.get('/get-chats/:username', (req, res) => {
    const { username } = req.params;
    let messages = readJSON(MESSAGES_FILE, []);
    let users = readJSON(USERS_FILE, []);
    const chatSet = new Set();
    messages.forEach(m => {
        if (m.from === username) chatSet.add(m.to);
        if (m.to === username) chatSet.add(m.from);
    });
    // Добавляем всех пользователей, кроме себя (чтобы можно было начать диалог)
    users.forEach(u => {
        if (u.username !== username) chatSet.add(u.username);
    });
    const chatList = Array.from(chatSet).map(chatUsername => {
        const user = users.find(u => u.username === chatUsername);
        const lastMsg = messages.filter(m => (m.from === username && m.to === chatUsername) || (m.from === chatUsername && m.to === username))
            .sort((a,b) => b.id - a.id)[0];
        return {
            username: chatUsername,
            avatar: user ? user.avatar : '👤',
            online: user ? user.online : false,
            lastMessage: lastMsg ? (lastMsg.text || 'Файл') : 'Нет сообщений',
            lastTime: lastMsg ? lastMsg.timestamp : null
        };
    });
    // сортировка по последнему сообщению
    chatList.sort((a,b) => (b.lastTime || 0) - (a.lastTime || 0));
    res.json(chatList);
});

app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
