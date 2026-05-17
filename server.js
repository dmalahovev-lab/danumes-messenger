const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());

// Гарантированная отдача оригинального интерфейса в корень сайта
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// Инициализация Supabase клиента через системные переменные на Render
const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "your-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

io.on('connection', async (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // При подключении вытягиваем всю историю сообщений из Supabase
    try {
        const { data: history, error } = await supabase
            .from('messages')
            .select('username, text, created_at')
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        if (history) {
            // Преобразуем временную метку БД в красивый формат часов:минут для дизайна
            const formattedHistory = history.map(msg => {
                const date = new Date(msg.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return {
                    username: msg.username,
                    text: msg.text,
                    time: timeStr
                };
            });
            
            socket.emit('chat history', formattedHistory);
        }
    } catch (err) {
        console.error("Ошибка загрузки истории из Supabase:", err.message);
    }

    // Обработка отправки нового сообщения
    socket.on('chat message', async (data) => {
        console.log('Новое сообщение received:', data);

        try {
            // Запись сообщения в таблицу Supabase
            const { error } = await supabase
                .from('messages')
                .insert([{ username: data.username, text: data.text }]);

            if (error) throw error;

            // Генерируем текущее время для мгновенной рассылки
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Рассылаем всем активным пользователям в сети
            io.emit('chat message', {
                username: data.username,
                text: data.text,
                time: currentTime
            });
        } catch (err) {
            console.error("Ошибка сохранения в базу данных:", err.message);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
