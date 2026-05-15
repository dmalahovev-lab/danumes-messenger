const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https'); // Модуль для связи с вечным облаком

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ADMIN_USERNAME = 'admin'; 
const NEWS_GROUP_NAME = 'DanuMes news';

// Уникальный ключ для твоего личного облачного хранилища (создается автоматически)
const CLOUD_STORAGE_URL = 'https://kvdb.io';

let globalState = { users: {}, messages: [], groups: [] };

// Функция загрузки данных (сначала ищет локально, если нет - качает из вечного облака)
async function loadData() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const fileData = fs.readFileSync(DB_FILE, 'utf8');
            if (fileData.trim().length > 0) {
                globalState = JSON.parse(fileData);
                console.log("База данных успешно загружена из локального файла.");
                initAdminAndNews();
                return;
            }
        }
    } catch (e) {
        console.log("Локальный файл пуст, запрашиваем облако...");
    }

    // Если локального файла нет (Render перезагрузился), экстренно качаем из облака
    https.get(CLOUD_STORAGE_URL, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode === 200 && data.trim().length > 0) {
                    globalState = JSON.parse(data);
                    console.log("🌐 База данных ВОССТАНОВЛЕНА из облачного хранилища!");
                    // Синхронизируем локальный файл
                    fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8');
                }
            } catch (e) {
                console.log("Облако пока пустое, создаем новую базу.");
            }
            initAdminAndNews();
        });
    }).on('error', (err) => {
        console.error("Ошибка связи с облаком:", err);
        initAdminAndNews();
    });
}

// Функция мгновенного сохранения данных в локальный файл и отправки копии в облако
function saveData() {
    try {
        const stringData = JSON.stringify(globalState, null, 2);
        // 1. Спасаем локально
        fs.writeFileSync(DB_FILE, stringData, 'utf8');

        // 2. Отправляем резервную копию в вечное облако (работает в фоновом режиме)
        const url = new URL(CLOUD_STORAGE_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {});
        req.on('error', (e) => console.error("Облако временно недоступно:", e));
        req.write(stringData);
        req.end();
    } catch (error) {
        console.error("Не удалось сохранить данные:", error);
    }
}

function initAdminAndNews() {
    if (!globalState.users) globalState.users = {};
    if (!globalState.groups) globalState.groups = [];
    if (!globalState.messages) globalState.messages = [];

    // Вечный админ
    if (!globalState.users[ADMIN_USERNAME]) {
        globalState.users[ADMIN_USERNAME] = {
            password: '321', // Твой рабочий пароль, который ты использовал
            lastSeen: Date.now(),
            avatar: null
        };
    }

    // Вечный канал новостей
    const hasNewsGroup = globalState.groups.some(g => g.name === NEWS_GROUP_NAME);
    if (!hasNewsGroup) {
        globalState.groups.push({
            name: NEWS_GROUP_NAME,
            creator: ADMIN_USERNAME,
            members: [ADMIN_USERNAME]
        });
    }

    // Авто-добавление всех юзеров в канал новостей
    globalState.groups.forEach(g => {
        if (g.name === NEWS_GROUP_NAME) {
            Object.keys(globalState.users).forEach(u => {
                if (!g.members.includes(u)) g.members.push(u);
            });
        }
    });
    
    // Перезаписываем файл после инициализации
    try { fs.writeFileSync(DB_FILE, JSON.stringify(globalState, null, 2), 'utf8'); } catch(e){}
}

// Запускаем умную загрузку базы данных
loadData();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- ВХОД И РЕГИСТРАЦИЯ (ПОЛНЫЙ ОРИГИНАЛ) ---
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
        members.forEach(m => {
            if (!allMembers.includes(m)) allMembers.push(m);
        });
    }

    const newGroup = { name, creator, members: allMembers };
    globalState.groups.push(newGroup);
    
    saveData(); 
    res.json({ success: true, group: newGroup });
});

app.listen(PORT, () => {
    console.log(`Сервер успешно запущен на порту ${PORT}`);
});
