const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git'); // Библиотека вечного сохранения в Git

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Инициализируем инструмент авто-сохранений в гитхаб
const git = simpleGit();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ADMIN_USERNAME = 'Danumala'; 
const NEWS_GROUP_NAME = 'DanuMes news';

// Безопасное чтение базы данных
function loadData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const fileData = fs.readFileSync(DB_FILE, 'utf8');
            if (fileData.trim().length > 0) {
                return JSON.parse(fileData);
            }
        }
    } catch (error) {
        console.error("Ошибка при чтении базы данных:", error);
    }
    return { users: {}, messages: [], groups: [] };
}

let globalState = loadData();

// Функция сохранения базы данных в файл + авто-пуш на GitHub
async function saveData() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8');
        
        // Автоматически отправляем файл database.json в твой GitHub репозиторий
        await git.add(DB_FILE);
        await git.commit('auto: update database backups');
        await git.push();
        console.log("🔒 База данных успешно сохранена и отправлена на вечное хранение в GitHub!");
    } catch (error) {
        console.error("Фоновое сохранение в репозиторий:", error.message);
    }
}

function initAdminAndNews() {
    if (!globalState.users) globalState.users = {};
    if (!globalState.groups) globalState.groups = [];
    if (!globalState.messages) globalState.messages = [];

    // Твой вечный админский профиль
    if (!globalState.users[ADMIN_USERNAME]) {
        globalState.users[ADMIN_USERNAME] = {
            password: 'danyajukovka',
            lastSeen: Date.now(),
            avatar: null
        };
    }

    // Вечный новостной канал
    const hasNewsGroup = globalState.groups.some(g => g.name === NEWS_GROUP_NAME);
    if (!hasNewsGroup) {
        globalState.groups.push({
            name: NEWS_GROUP_NAME,
            creator: ADMIN_USERNAME,
            members: [ADMIN_USERNAME]
        });
    }

    // Авто-добавление всех в новости
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME) {
            Object.keys(globalState.users).forEach(u => {
                if (!g.members.includes(u)) g.members.push(u);
            });
        }
    });
}

initAdminAndNews();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (ПОЛНЫЙ ОРИГИНАЛ С АВТОСОХРАНЕНИЕМ) ---
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
    
    globalState.users[username] = { password, lastSeen: Date.now(), avatar: null };
    
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME && !g.members.includes(username)) {
            g.members.push(username);
        }
    });

    saveData(); 
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

    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME && !g.members.includes(username)) {
            g.members.push(username);
        }
    });

    saveData(); 
    res.json({ success: true });
});

app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/register'); });
app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/login'); });

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

app.post('/api/messages/send', (req, res) => {
    const { from, to, text, isGroup } = req.body;
    if (!from || !text) return res.status(400).json({ success: false, error: 'Неполные данные' });
    
    if (!globalState.messages) globalState.messages = [];

    if (isGroup && to === NEWS_GROUP_NAME && from !== ADMIN_USERNAME) {
        return res.status(403).json({ success: false, error: 'Только администратор может писать в этот канал!' });
    }
    
    const newMessage = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        from, to: to || null, text, isGroup: !!isGroup, timestamp: Date.now()
    };
    globalState.messages.push(newMessage);
    
    saveData(); 
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
        members.forEach(m => { if (!allMembers.includes(m)) allMembers.push(m); });
    }

    const newGroup = { name, creator, members: allMembers };
    globalState.groups.push(newGroup);
    
    saveData(); 
    res.json({ success: true, group: newGroup });
});

app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
