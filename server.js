const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Функция для безопасной загрузки данных
function loadData() {
    try {
        // Проверяем, существует ли файл базы данных
        if (fs.existsSync(DB_FILE)) {
            const fileData = fs.readFileSync(DB_FILE, 'utf8');
            // Проверяем, что файл не пустой
            if (fileData.trim().length > 0) {
                return JSON.parse(fileData);
            }
        }
    } catch (error) {
        console.error("Ошибка при чтении базы данных, создаем чистую структуру:", error);
    }
    
    // Если файла нет или он пустой, возвращаем чистую стандартную структуру
    return {
        users: {},
        messages: [],
        groups: []
    };
}

// Функция для сохранения данных
function saveData() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8');
    } catch (error) {
        console.error("Не удалось сохранить данные в файл:", error);
    }
}

// Загружаем данные при старте
let globalState = loadData();

// Роут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (ВЕРНУЛИ К ПОЛНОМУ ОРИГИНАЛУ С УЛУЧШЕННОЙ ПРОВЕРКОЙ) ---

app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }
    
    // Защита: если вдруг users не создался, создаем его принудительно
    if (!globalState.users) {
        globalState.users = {};
    }
    
    if (globalState.users[username]) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }
    
    globalState.users[username] = {
        password,
        lastSeen: Date.now(),
        avatar: null
    };
    
    saveData(); // Сохраняем в файл
    res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!globalState.users) {
        globalState.users = {};
    }
    
    const user = globalState.users[username];
    if (!user || user.password !== password) {
        return res.status(400).json({ success: false, error: 'Неверное имя или пароль' });
    }
    
    user.lastSeen = Date.now();
    saveData(); // Обновляем время входа
    res.json({ success: true });
});

// --- СИНХРОНИЗАЦИЯ И ОБНОВЛЕНИЕ ДАННЫХ ---

app.post('/api/sync', (req, res) => {
    const { username } = req.body;
    
    if (!globalState.users) globalState.users = {};
    if (!globalState.messages) globalState.messages = [];
    if (!globalState.groups) globalState.groups = [];

    if (username && globalState.users[username]) {
        globalState.users[username].lastSeen = Date.now();
    }
    
    const activeUsers = {};
    const now = Date.now();
    
    Object.keys(globalState.users).forEach(u => {
        activeUsers[u] = {
            online: (now - globalState.users[u].lastSeen) < 10000,
            avatar: globalState.users[u].avatar || null
        };
    });
    
    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: globalState.groups
    });
});

// --- РАБОТА С СООБЩЕНИЯМИ ---

app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) {
        return res.status(400).json({ success: false, error: 'Неполные данные' });
    }
    
    if (!globalState.messages) {
        globalState.messages = [];
    }
    
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from,
        to: to || null,
        text,
        isGroup: !!isGroup,
        timestamp: Date.now()
    };
    
    globalState.messages.push(newMessage);
    saveData(); // Сохраняем новое сообщение
    res.json({ success: true, message: newMessage });
});

app.post('/api/messages/delete', (req, res) => {
    const { messageId, username } = req.body;
    
    if (!globalState.messages) return res.status(404).json({ success: false, error: 'Сообщений нет' });
    
    const index = globalState.messages.findIndex(m => m.id === messageId);
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }
    if (globalState.messages[index].from !== username) {
        return res.status(403).json({ success: false, error: 'Нет прав на удаление' });
    }
    
    globalState.messages.splice(index, 1);
    saveData(); // Сохраняем после удаления
    res.json({ success: true });
});

// --- РАБОТА С ГРУППАМИ ---

app.post('/api/groups/create', (req, res) => {
    const { name, creator } = req.body;
    if (!name || !creator) {
        return res.status(400).json({ success: false, error: 'Неполные данные' });
    }
    
    if (!globalState.groups) {
        globalState.groups = [];
    }
    
    if (globalState.groups.some(g => g.name === name)) {
        return res.status(400).json({ success: false, error: 'Группа с таким названием уже есть' });
    }
    
    const newGroup = { name, creator };
    globalState.groups.push(newGroup);
    saveData(); // Сохраняем новую группу
    res.json({ success: true, group: newGroup });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
