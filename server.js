const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_FILE = path.join(__dirname, 'database.json');

// Проверка и инициализация базы данных JSON
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.users) db.users = {};
        if (!db.messages) db.messages = {};
    } catch (e) {
        console.error("Ошибка чтения базы, создаем чистую...");
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let activeConnections = {}; // socket.id -> username

io.on('connection', (socket) => {

    // 1. Регистрация нового аккаунта
    socket.on('register_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();

        if (!username || !password) {
            return socket.emit('auth_error', 'Заполните все поля!');
        }
        if (db.users[username]) {
            return socket.emit
