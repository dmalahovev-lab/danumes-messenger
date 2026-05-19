const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname)));

// --- ЛОКАЛЬНАЯ НАДЁЖНАЯ БАЗА ДАННЫХ НА ФАЙЛАХ ---
const MESSAGES_FILE = path.join(__dirname, 'db_messages.json');
const USERS_FILE = path.join(__dirname, 'db_users.json');

// Системные нестрогие аккаунты, которые всегда активны
const permanentUsers = [
  { username: 'Danumala', password: 'danyajukovka', hasVerifiedBadge: true, hasNewsAccess: true },
  { username: 'RunFly', password: 'GGWWXXJJ2001', hasVerifiedBadge: true, hasNewsAccess: false }
];

let globalMessages = [];
let registeredUsers = [];

// Хелперы чтения/записи файлов базы данных
function loadDatabase() {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      globalMessages = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    }
    if (fs.existsSync(USERS_FILE)) {
      registeredUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Ошибка инициализации локальной БД:', err.message);
  }
}

function saveMessages() {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(globalMessages, null, 2), 'utf8');
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(registeredUsers, null, 2), 'utf8');
}

// Загружаем сохраненные данные при старте сервера
loadDatabase();

// --- СВЯЗЬ И ЛОГИКА СОКЕТОВ ---
io.on('connection', (socket) => {
  console.log('Подключился клиент:', socket.id);

  // Сразу отправляем историю глобального чата новому клиенту
  socket.emit('init-messages', globalMessages);

  // 1. ПОЛНОЦЕННАЯ РАБОТАЮЩАЯ ОБРАБОТКА ВХОДА
  socket.on('login-attempt', (data) => {
    const { username, password } = data;
    if (!username || !password) return socket.emit('login-failure', { message: 'Заполните поля!' });

    // Проверяем админов
    let foundUser = permanentUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    // Если не админ, ищем в зарегистрированных обычных пользователях
    if (!foundUser) {
      foundUser = registeredUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    }

    if (foundUser) {
      socket.emit('login-success', {
        username: foundUser.username,
        hasVerifiedBadge: foundUser.hasVerifiedBadge || false,
        hasNewsAccess: foundUser.hasNewsAccess || false
      });
    } else {
      socket.emit('login-failure', { message: 'Неверное имя или пароль!' });
    }
  });

  // 2. ПОЛНОЦЕННАЯ РАБОТАЮЩАЯ ОБРАБОТКА РЕГИСТРАЦИИ
  socket.on('register-attempt', (data) => {
    const { username, password } = data;
    if (!username || !password) return socket.emit('register-failure', { message: 'Заполните поля!' });

    const existsInPerm = permanentUsers.some(u => u.username.toLowerCase() === username.toLowerCase());
    const existsInReg = registeredUsers.some(u => u.username.toLowerCase() === username.toLowerCase());

    if (existsInPerm || existsInReg) {
      return socket.emit('register-failure', { message: 'Этот никнейм уже занят!' });
    }

    const newUser = {
      username: username,
      password: password,
      hasVerifiedBadge: false,
      hasNewsAccess: false
    };

    registeredUsers.push(newUser);
    saveUsers(); // Сохраняем в db_users.json навсегда

    socket.emit('register-success', {
      username: newUser.username,
      hasVerifiedBadge: false,
      hasNewsAccess: false
    });
  });

  // 3. ПОИСК ПОЛЬЗОВАТЕЛЕЙ ПО БАЗЕ ДАННЫХ
  socket.on('search-users', (query) => {
    const searchStr = query.toLowerCase().trim();
    if (!searchStr) return socket.emit('search-results', []);

    // Собираем всех существующих пользователей для поиска
    const allUsers = [...permanentUsers, ...registeredUsers].map(u => ({
      username: u.username,
      hasVerifiedBadge: u.hasVerifiedBadge || false
    }));

    const filtered = allUsers.filter(u => u.username.toLowerCase().includes(searchStr));
    socket.emit('search-results', filtered);
  });

  // 4. ПОЛУЧЕНИЕ СПИСКА ВСЕХ ЗАРЕГИСТРИРОВАННЫХ ДЛЯ АДМИН ПАНЕЛИ
  socket.on('get-all-users', () => {
    const list = [...permanentUsers, ...registeredUsers].map(u => ({
      username: u.username,
      isPermanent: permanentUsers.some(p => p.username === u.username)
    }));
    socket.emit('all-users-list', list);
  });

  // 5. ОТПРАВКА И СОХРАНЕНИЕ СООБЩЕНИЙ ЧАТА
  socket.on('send-message', (data) => {
    const checkUser = permanentUsers.find(u => u.username === data.username);
    
    const newMessage = {
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: checkUser ? checkUser.hasVerifiedBadge : false,
      newsAccess: checkUser ? checkUser.hasNewsAccess : false,
      isNews: data.isNews || false
    };

    globalMessages.push(newMessage);
    saveMessages(); // Сохраняем в db_messages.json навсегда

    io.emit('new-message', newMessage);
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключился:', socket.id);
  });
});

// Роут для ручного просмотра базы пользователей через браузер (опционально)
app.get('/api/admin/users-list', (req, res) => {
  res.json({ permanent: permanentUsers, registered: registeredUsers });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[OK] Сервер Danumes запущен на порту ${PORT}`);
});
