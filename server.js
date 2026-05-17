const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// 1. Инициализация Supabase
// Переменные окружения SUPABASE_URL и SUPABASE_KEY нужно задать на Render
const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "your-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Обработка Socket.io соединений
io.on('connection', async (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Отдаем историю сообщений из Supabase при подключении
    try {
        const { data: history, error } = await supabase
            .from('messages')
            .select('username, text')
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        if (history) {
            socket.emit('chat history', history);
        }
    } catch (err) {
        console.error("Ошибка загрузки истории из Supabase:", err.message);
    }

    // Принимаем новое сообщение от клиента
    socket.on('chat message', async (data) => {
        console.log('Новое сообщение received:', data);

        try {
            // Сохраняем в Supabase
            const { error } = await supabase
                .from('messages')
                .insert([{ username: data.username || 'Аноним', text: data.text }]);

            if (error) throw error;

            // Пересылаем сообщение всем активным клиентам
            io.emit('chat message', data);
        } catch (err) {
            console.error("Ошибка сохранения в Supabase:", err.message);
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
