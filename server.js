const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Определяем папки для данных
const DATA_DIR = process.env.RENDER ? '/tmp/data' : path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, 'uploads');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Функция для безопасного чтения JSON
function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Ошибка чтения ${filePath}:`, error);
    return defaultValue;
  }
}

// Функция для безопасной записи JSON
function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Ошибка записи ${filePath}:`, error);
    return false;
  }
}

// Создаем необходимые директории при старте
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('✅ Директории данных созданы');
} catch (error) {
  console.error('❌ Ошибка создания директорий:', error);
  process.exit(1);
}

// --- Системные пользователи (ДАНУМАЛА и RUNFLY) ---
const SYSTEM_USERS = [
  { username: 'Danumala', password: 'danumala123', avatar: '👑' },
  { username: 'RunFly', password: 'runfly123', avatar: '🚀' }
];

// Инициализируем файл пользователей, если его нет или он пустой
let users = readJSON(USERS_FILE, []);
if (users.length === 0) {
    users = SYSTEM_USERS;
    writeJSON(USERS_FILE, users);
    console.log('➕ Созданы системные пользователи');
} else {
    // Проверяем, что системные пользователи существуют, и добавляем их при необходимости
    let updated = false;
    SYSTEM_USERS.forEach(sysUser => {
        if (!users.some(u => u.username === sysUser.username)) {
            users.push(sysUser);
            updated = true;
            console.log(`➕ Добавлен отсутствующий системный пользователь: ${sysUser.username}`);
        }
    });
    if (updated) writeJSON(USERS_FILE, users);
}
console.log(`👥 Загружено пользователей: ${users.length}`);

// --- Настройка загрузки файлов (multer) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));

// === API РОУТЫ ===
// Регистрация
app.post('/register-attempt', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.json({ success: false, error: 'Заполните все поля' });
  }
  let users = readJSON(USERS_FILE, []);
  if (users.find(u => u.username === username)) {
    return res.json({ success: false, error: 'Пользователь уже существует' });
  }
  const newUser = { username, password, avatar: '👤' };
  users.push(newUser);
  if (writeJSON(USERS_FILE, users)) {
    res.json({ success: true, user: newUser });
  } else {
    res.status(500).json({ success: false, error: 'Ошибка сервера при сохранении пользователя' });
  }
});

// Вход
app.post('/login-attempt', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(USERS_FILE, []);
  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, username: user.username, avatar: user.avatar });
  } else {
    res.json({ success: false, error: 'Неверные имя пользователя или пароль' });
  }
});

// Отправка сообщения
app.post('/send-message', (req, res) => {
  const { username, text, fileUrl, fileName } = req.body;
  if (!username || (!text && !fileUrl)) {
    return res.status(400).json({ error: 'Недостаточно данных для отправки' });
  }
  let messages = readJSON(MESSAGES_FILE, []);
  const newMessage = {
    id: Date.now(),
    username,
    text: text || '',
    timestamp: new Date().toISOString(),
    fileUrl: fileUrl || null,
    fileName: fileName || null
  };
  messages.push(newMessage);
  if (writeJSON(MESSAGES_FILE, messages)) {
    res.json({ success: true, message: newMessage });
  } else {
    res.status(500).json({ error: 'Ошибка сервера при сохранении сообщения' });
  }
});

// Получение всех сообщений
app.get('/get-messages', (req, res) => {
  const messages = readJSON(MESSAGES_FILE, []);
  res.json(messages);
});

// Инициализация для новых пользователей
app.get('/init-messages', (req, res) => {
  const messages = readJSON(MESSAGES_FILE, []);
  res.json({ messages });
});

// Загрузка файла на сервер
app.post('/upload-file', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не был загружен' });
  }
  const fileUrl = `/file/${req.file.filename}`;
  res.json({ success: true, fileUrl, fileName: req.file.originalname });
});

// Отдача файла по ссылке
app.get('/file/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Файл не найден');
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер успешно запущен и слушает порт ${PORT}`);
});
