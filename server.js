const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname)));

// Пути к файлам базы данных на сервере Render
const USERS_FILE = path.join(__dirname, 'users.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const GROUPS_FILE = path.join(__dirname, 'groups.json');

// Жестко прописанные админы
const permanentUsers = [
  { username: 'Danumala', password: 'danyajukovka', isVerified: true, newsAccess: true },
  { username: 'RunFly', password: 'GGWWXXJJ2001', isVerified: true, newsAccess: false }
];

// Инициализация файлов БД
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify([]));
if (!fs.existsSync(GROUPS_FILE)) fs.writeFileSync(GROUPS_FILE, JSON.stringify([]));

// Загрузка данных в память сервера
let registeredUsers = JSON.parse(fs.readFileSync(USERS_FILE));
let messages = JSON.parse(fs.readFileSync(MESSAGES_FILE));
let groups = JSON.parse(fs.readFileSync(GROUPS_FILE));

io.on('connection', (socket) => {
  console.log('Подключился клиент:', socket.id);

  // При коннекте отдаем историю глобального чата и каналов
  socket.emit('init-messages', messages);
  socket.emit('init-groups', groups);

  // Поиск пользователей (Реальное время)
  socket.on('search-users', (query) => {
    const q = query.toLowerCase().trim();
    if (!q) return socket.emit('search-results', []);

    // Собираем всех вместе для поиска
    const allUsers = [...permanentUsers, ...registeredUsers];
    const filtered = allUsers
      .filter(u => u.username.toLowerCase().includes(q))
      .map(u => ({ username: u.username, isVerified: u.isVerified || false }));

    socket.emit('search-results', filtered);
  });

  // Логика Входа
  socket.on('login-attempt', (data) => {
    // Проверяем админов
    let found = permanentUsers.find(u => u.username === data.username && u.password === data.password);
    
    // Проверяем обычную базу
    if (!found) {
      found = registeredUsers.find(u => u.username === data.username && u.password === data.password);
    }

    if (found) {
      socket.emit('login-success', {
        username: found.username,
        isVerified: found.isVerified || false,
        newsAccess: found.newsAccess || false
      });
    } else {
      socket.emit('login-failure', 'Неверный логин или пароль');
    }
  });

  // Логика Регистрации
  socket.on('register-attempt', (data) => {
    const exists = [...permanentUsers, ...registeredUsers].some(u => u.username.toLowerCase() === data.username.toLowerCase());
    
    if (exists) {
      socket.emit('register-failure', 'Этот никнейм уже занят');
    } else {
      const newUser = {
        username: data.username,
        password: data.password,
        isVerified: false,
        newsAccess: false
      };
      registeredUsers.push(newUser);
      fs.writeFileSync(USERS_FILE, JSON.stringify(registeredUsers, null, 2));

      socket.emit('register-success', {
        username: newUser.username,
        isVerified: false,
        newsAccess: false
      });
    }
  });

  // Создание новой группы
  socket.on('create-group', (groupName) => {
    if (!groupName.trim()) return;
    
    const newGroup = {
      id: 'group_' + Date.now(),
      name: groupName.trim(),
      type: 'group'
    };
    
    groups.push(newGroup);
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2));
    
    io.emit('group-created', newGroup);
  });

  // Отправка сообщений
  socket.on('send-message', (data) => {
    const sender = [...permanentUsers, ...registeredUsers].find(u => u.username === data.username);
    
    const newMessage = {
      chatId: data.chatId || 'global', // 'global', 'news', или ID группы/ЛС
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: sender ? (sender.isVerified || false) : false
    };

    messages.push(newMessage);
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));

    io.emit('new-message', newMessage);
  });

  // Запрос списка всех созданных пользователей (для администратора)
  socket.on('get-all-users', () => {
    const list = registeredUsers.map(u => u.username);
    socket.emit('all-users-list', list);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер мессенджера Danumes запущен на порту ${PORT}`);
});
