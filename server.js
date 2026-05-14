const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let onlineUsers = {}; // socket.id -> username

io.on('connection', (socket) => {
    socket.on('register_user', (username) => {
        onlineUsers[socket.id] = username;
    });

    socket.on('send_direct_message', (data) => {
        const target
