const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Глобальная база данных мессенджера в памяти сервера
let globalState = {
    users: [],       // Список пользователей: [{name, password, avatar, status, lastSeen}]
    messages: [],    // Список сообщений: [{id, from, to, text}]
    groups: []       // Список глобальных групп: [{name: "Группа", members: ["Вася", "Петя"]}]
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// НОВЫЙ МАРШРУТ: Обновление статуса «В сети» и получение актуальных глобальных данных
app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    
    if (username) {
        // Ищем пользователя и обновляем timestamp его последнего запроса
        const user = globalState.users.find(u => u.name === username);
        if (user) {
            user.lastSeen = Date.now();
        }
    }
    
    // Вычисляем, кто сейчас в сети (активность за последние 10 секунд)
    const activeUsers = globalState.users.map(u => {
        const isOnline = u.lastSeen && (Date.now() - u.lastSeen < 10000);
        return {
            name: u.name,
            avatar: u.avatar,
            status: isOnline ? "В сети" : "Был(а) недавно"
        };
    });

    res.json({
        users: activeUsers,
        messages: globalState.messages,
        groups: globalState.groups
    });
});

// НОВЫЙ МАРШРУТ: Глобальное создание группы на сервере
app.post('/api/groups/create', (req, res) => {
    const { groupName, members } = req.body;
    
    if (!groupName) {
        return res.json({ success: false, msg: 'Укажите название группы' });
    }
    
    // Проверяем, существует ли уже группа с таким именем
    if (globalState.groups.some(g => g.name.toLowerCase() === groupName.toLowerCase())) {
        return res.json({ success: false, msg: 'Такая группа уже существует' });
    }
    
    const newGroup = { name: groupName, members: members || [] };
    globalState.groups.push(newGroup);
    
    res.json({ success: true, groups: globalState.groups });
});

// МАРШРУТ СИНХРОНИЗАЦИИ (Оставлен для совместимости со старыми модулями)
app.post('/api/sync', (req, res) => {
    if (req.body.users) {
        req.body.users.forEach(u => {
            if (!globalState.users.some(existing => existing.name === u.name)) {
                u.lastSeen = Date.now();
                globalState.users.push(u);
            }
        });
    }
    if (req.body.messages) {
        globalState.messages = req.body.messages;
    }
    res.json(globalState);
});

// МАРШРУТ: Регистрация (ВООБЩЕ НЕ ТРОНУТ)
app.post('/api/register', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    if (!username || !password) {
        return res.json({ success: false, msg: 'Заполните все поля' });
    }

    if (globalState.users.some(u => u.name === username)) {
        return res.json({ success: false, msg: 'Пользователь уже существует' });
    }

    const newUser = { name: username, password: password, avatar: "🤖", status: "Доступен", lastSeen: Date.now() };
    globalState.users.push(newUser);

    return res.json({ success: true, msg: 'Аккаунт успешно создан! Нажмите "Войти"', newUser });
});

// МАРШРУТ: Вход (ВООБЩЕ НЕ ТРОНУТ)
app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    const password = (req.body.pass || '').trim();

    let user = globalState.users.find(u => u.name === username);
    if (!user) {
        user = { name: username, password: password, avatar: "🤖", status: "Доступен", lastSeen: Date.now() };
        globalState.users.push(user);
    }

    if (user.password !== password) {
        return res.json({ success: false, msg: 'Недействительный Логин/Пароль' });
    }

    user.lastSeen = Date.now();

    return res.json({
        success: true,
        user: { name: username, avatar: user.avatar, status: "В сети" }
    });
});

// МАРШРУТ: Список пользователей
app.get('/api/users', (req, res) => {
    res.json(globalState.users);
});

// МАРШРУТ: Получить историю сообщений
app.get('/api/messages', (req, res) => {
    res.json(globalState.messages);
});

// МАРШРУТ: Отправить сообщение
app.post('/api/messages/send', (req, res) => {
    const newMsg = {
        id: Date.now().toString(),
        from: req.body.from,
        to: req.body.to,
        text: req.body.text
    };
    globalState.messages.push(newMsg);
    res.json({ success: true, messages: globalState.messages });
});

// МАРШРУТ: Удалить сообщение
app.post('/api/messages/delete', (req, res) => {
    globalState.messages = globalState.messages.filter(msg => msg.id !== req.body.msgId);
    res.json({ success: true, messages: globalState.messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
