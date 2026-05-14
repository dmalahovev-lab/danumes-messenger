const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DB_FILE = path.join(__dirname, 'database.json');

// Стабильная проверка базы данных на ошибки парсинга файлов
let db = { users: {}, messages: {} };
if (fs.existsSync(DB_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Ошибка чтения БД, создаем чистую...");
    }
}

function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let activeConnections = {}; 

io.on('connection', (socket) => {

    // 1. Регистрация нового аккаунта
    socket.on('register_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();
        
        if (!username || !password) return socket.emit('auth_error', 'Заполните все поля!');
        if (db.users[username]) return socket.emit('auth_error', 'Пользователь с таким именем уже существует!');
        
        db.users[username] = { password: password, avatar: "🤖", status: "Доступен" };
        saveDB();
        socket.emit('auth_success', 'Регистрация успешна! Теперь вы можете войти.');
    });

    // 2. Вход в существующий аккаунт
    socket.on('login_account', (data) => {
        const username = data.username.trim();
        const password = data.password.trim();
        
        if (!db.users[username] || db.users[username].password !== password) {
            return socket.emit('auth_error', 'Недействительный Логин/
