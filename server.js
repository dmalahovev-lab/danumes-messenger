// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище подключенных пользователей
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Новое подключение. Всего онлайн: ${clients.size}`);

    ws.on('message', (message) => {
        // Пересылаем сообщение всем активным пользователям
        for (let client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
            }
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Пользователь отключился. Всего онлайн: ${clients.size}`);
    });
});

server.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
