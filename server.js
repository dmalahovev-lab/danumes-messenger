const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Хранилище сообщений в памяти сервера
let globalMessages = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Простые и надежные маршруты для синхронизации сообщений
app.get('/api/messages', (req, res) => {
    res.json(globalMessages);
});

app.post('/api/messages/send', (req, res) => {
    const newMsg = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        from: req.body.from,
        to: req.body.to,
        text: req.body.text
    };
    globalMessages.push(newMsg);
    res.json({ success: true, messages: globalMessages });
});

app.post('/api/messages/delete', (req, res) => {
    globalMessages = globalMessages.filter(msg => msg.id !== req.body.msgId);
    res.json({ success: true, messages: globalMessages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер DanuMes запущен на порту ${PORT}`);
});
