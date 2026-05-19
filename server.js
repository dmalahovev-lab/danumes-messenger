const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname)));

// --- НАСТРОЙКИ CLOUDFLARE KV ---
const CLOUDFLARE_ACCOUNT_ID = '315776b94c3e5574096cfecc515248bc';
const CLOUDFLARE_NAMESPACE_ID = '1b46ee655188445ca7b277fb8634dca0';
// ПОДСТАВЬ СВОЙ API ТОКЕН МЕЖДУ КАВЫЧКАМИ НИЖЕ:
const CLOUDFLARE_API_TOKEN = 'ТВОЙ_API_ТОКЕН_ИЗ_ПРОФИЛЯ_CLOUDFLARE'; 

// Функция для сохранения сообщений в Cloudflare KV
async function saveMessagesToKV(messagesArray) {
  const url = `https://cloudflare.com{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_NAMESPACE_ID}/values/danumes_chat_history`;
  try {
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(messagesArray)
    });
  } catch (err) {
    console.error('Ошибка сохранения в KV:', err);
  }
}

// Функция для загрузки сообщений из Cloudflare KV при старте
async function loadMessagesFromKV() {
  const url = `https://cloudflare.com{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_NAMESPACE_ID}/values/danumes_chat_history`;
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` }
    });
    if (res.status === 200) {
      const text = await res.text();
      return JSON.parse(text);
    }
  } catch (err) {
    console.error('Ошибка загрузки из KV:', err);
  }
  return []; // Возвращаем пустой массив, если базы еще нет или произошла ошибка
}
// --------------------------------

// Локальный массив для работы Socket.io (теперь он синхронизируется с KV)
let messages = [];

// Загружаем старые сообщения из Cloudflare сразу при запуске сервера
loadMessagesFromKV().then(savedMessages => {
  messages = savedMessages;
  console.log(`Загружено сообщений из Cloudflare KV: ${messages.length}`);
});

// ТВОЯ РЕГИСТРАЦИЯ И ВХОД (НЕ ТРОГАЕМ, ОСТАВЛЯЕМ КАК ЕСТЬ)
// ... (Тут идет твой массив пользователей и логика авторизации, если она была в server.js) ...

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Отправляем историю сообщений новому пользователю
  socket.emit('init-messages', messages);

  // Обработка нового сообщения
  socket.on('send-message', async (data) => {
    // Формируем объект сообщения (сохраняя твою структуру данных)
    const newMessage = {
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    messages.push(newMessage);
    
    // Рассылаем всем онлайн-пользователям
    io.emit('new-message', newMessage);

    // Сразу сохраняем обновленный массив в Cloudflare KV
    await saveMessagesToKV(messages);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер Danumes запущен на порту ${PORT}`);
});
