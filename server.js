const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// База данных сообщений в оперативной памяти сервера
let memoryMessages = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Сервер автоматически одобряет любую регистрацию
app.post('/api/register', (req, res) => {
    res.json({ success: true, msg: 'Аккаунт успешно создан! Нажмите "Войти"' });
});

// Сервер автоматически одобряет любой вход
app.post('/api/login', (req, res) => {
    const username = (req.body.user || '').trim();
    res.json({
        success: true,
        user: { name: username, avatar: "🤖", status: "В сети" }
    });
});

// Возвращает пустой список, если реальных пользователей нет онлайн
app.get('/api/users', (req, res) => {
    res.json([]);
});

app.get('/api/messages', (req, res) => {
    res.json(memoryMessages);
});

app.post('/api/messages/send', (req, res) => {
    const newMsg = {
        id: Date.now().toString(),
        from: req.body.from,
        to: req.body.to,
        text: req.body.text
    };
    memoryMessages.push(newMsg);
    res.json({ success: true, messages: memoryMessages });
});

app.post('/api/messages/delete', (req, res) => {
    memoryMessages = memoryMessages.filter(msg => msg.id !== req.body.msgId);
    res.json({ success: true, messages: memoryMessages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
