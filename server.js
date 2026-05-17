const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path'); // Добавили стандартный модуль для путей
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());

// ЖЕЛЕЗНЫЙ МАРШРУТ ДЛЯ ОТДАЧИ СТРАНИЦЫ
// Теперь при заходе на сайт сервер гарантированно отправит файл index.html
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

// Инициализация клиента Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "your-anon-key";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

io.on('connection', async (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Извлечение истории сообщений при подключении пользователя
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
        console.error("Ошибка загрузки истории:", err.message);
    }

    // Прием нового сообщения и сохранение в базу данных
    socket.on('chat message', async (data) => {
        console.log('Новое сообщение received:', data);

        try {
            const { error } = await supabase
                .from('messages')
                .insert([{ username: data.username || 'Аноним', text: data.text }]);

            if (error) throw error;

            // Мгновенная рассылка сообщения всем клиентам
            io.emit('chat message', data);
        } catch (err) {
            console.error("Ошибка保存:", err.message);
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
