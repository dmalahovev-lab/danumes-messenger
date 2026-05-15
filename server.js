const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Подключаем модуль работы с файлами

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json'); // Путь к вечной базе данных

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ИМЯ ТВОЕГО АДМИН-АККАУНТА И НАЗВАНИЕ КАНАЛА НОВОСТЕЙ
const ADMIN_USERNAME = 'Danumala'; 
const NEWS_GROUP_NAME = 'DanuMes news';

// Функция для БЕЗОПАСНОЙ загрузки данных из файла
function loadData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const fileData = fs.readFileSync(DB_FILE, 'utf8');
            if (fileData.trim().length > 0) {
                return JSON.parse(fileData);
            }
        }
    } catch (error) {
        console.error("Ошибка чтения файла базы данных:", error);
    }
    return { users: {}, messages: [], groups: [] };
}

// Функция для сохранения данных в файл
function saveData() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8');
    } catch (error) {
        console.error("Не удалось сохранить данные в файл:", error);
    }
}

// Загружаем сохраненную базу
let globalState = loadData();

// ПРОВЕРКА И СОЗДАНИЕ АДМИНА И КАНАЛА НОВОСТЕЙ ПРИ СТАРТЕ
function initAdminAndNews() {
    if (!globalState.users) globalState.users = {};
    if (!globalState.groups) globalState.groups = [];
    if (!globalState.messages) globalState.messages = [];

    // 1. Создаем вечного админа (если его нет в файле). Пароль поставь свой!
    if (!globalState.users[ADMIN_USERNAME]) {
        globalState.users[ADMIN_USERNAME] = {
            password: 'danyajukovka', // Укажи тут свой пароль для входа!
            lastSeen: Date.now(),
            avatar: null
        };
    }

    // 2. Создаем вечный канал новостей (если его нет в файле)
    const hasNewsGroup = globalState.groups.some(g => g.name === NEWS_GROUP_NAME);
    if (!hasNewsGroup) {
        globalState.groups.push({
            name: NEWS_GROUP_NAME,
            creator: ADMIN_USERNAME,
            members: [ADMIN_USERNAME] // Изначально там только админ
        });
    }

    // 3. Автоматически добавляем ВСЕХ уже существующих юзеров в канал новостей
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME) {
            Object.keys(globalState.users).forEach(u => {
                if (!g.members.includes(u)) g.members.push(u);
            });
        }
    });
    saveData();
}

// Запускаем инициализацию админки
initAdminAndNews();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (ПОЛНЫЙ ОРИГИНАЛ + АВТО-ДОБАВЛЕНИЕ В КАНАЛ) ---
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }
    if (!globalState.users) globalState.users = {};
    if (globalState.users[username]) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }
    
    // Создаем пользователя
    globalState.users[username] = { password, lastSeen: Date.now(), avatar: null };
    
    // Сразу принудительно закидываем новичка в канал новостей
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME && !g.members.includes(username)) {
            g.members.push(username);
        }
    });

    saveData(); // Сохраняем в файл!
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();
    if (!globalState.users) globalState.users = {};
    const user = globalState.users[username];
    if (!user || user.password !== password) {
        return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
    }
    user.lastSeen = Date.now();

    // Защита: если юзер старый, но его почему-то нет в новостях — добавляем при входе
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME && !g.members.includes(username)) {
            g.members.push(username);
        }
    });

    saveData(); // Сохраняем обновление в файл
    res.json({ success: true });
});

// Старые роуты-дубли для совместимости
app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

// --- СИНХРОНИЗАЦИЯ ЧАТА ---
app.post('/api/sync', (req, res) => {
    const username = (req.body.user || '').trim();
    
    if (!globalState) globalState = { users: {}, messages: [], groups: [] };
    if (!globalState.users) globalState.users = {};
    if (!globalState.messages) globalState.messages = [];
    if (!globalState.groups) globalState.groups = [];

    if (username && globalState.users[username]) {
        globalState.users[username].lastSeen = Date.now();
    }
    
    const activeUsers = {};
    const now = Date.now();
    
    Object.keys(globalState.users).forEach(u => {
        if (globalState.users[u]) {
            activeUsers[u] = {
                online: (now - globalState.users[u].lastSeen) < 10000,
                avatar: globalState.users[u].avatar || null
            };
        }
    });

    const visibleGroups = globalState.groups.filter(g => {
        return g.members && g.members.includes(username);
    });
    
    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: visibleGroups
    });
});

// --- ОТПРАВКА СООБЩЕНИЙ С ЖЕСТКОЙ ПРОВЕРКОЙ НА КАНАЛ НОВОСТЕЙ ---
app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    if (!globalState.messages) globalState.messages = [];

    // КРИТИЧЕСКАЯ ПРОВЕРКА: Если пишут в DanuMes news, проверяем, админ ли это
    if (isGroup && to === NEWS_GROUP_NAME) {
        if (from !== ADMIN_USERNAME) {
            return res.status(403).json({ success: false, error: 'Только администратор может писать в этот канал!' });
        }
    }
    
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from, to: to || null, text, isGroup: !!isGroup, timestamp: Date.now()
    };
    globalState.messages.push(newMessage);
    
    saveData(); // Сохраняем новое сообщение на жесткий диск хостинга!
    res.json({ success: true, message: newMessage });
});

app.post('/api/groups/create', (req, res) => {
    const { name, creator, members } = req.body;
    if (!name || !creator) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    if (!globalState.groups) globalState.groups = [];
    if (globalState.groups.some(g => g.name === name)) {
        return res.status(400).json({ success: false, error: 'Группа с таким названием уже есть' });
    }

    const allMembers = [creator];
    if (members && Array.isArray(members)) {
        members.forEach(m => {
            if (!allMembers.includes(m)) allMembers.push(m);
        });
    }

    const newGroup = { name, creator, members: allMembers };
    globalState.groups.push(newGroup);
    
    saveData(); // Сохраняем новую группу в файл!
    res.json({ success: true, group: newGroup });
});

app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
