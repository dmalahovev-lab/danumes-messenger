const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express(); // ТУТ ИСПРАВЛЕНО!
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
const CLOUDFLARE_API_TOKEN = 'cfut_SS1xHLjBmPurWiP1cwYW1WckTJC4q3ukFbM7zyW49d264d59'; 

// Безопасная функция для работы с Cloudflare API
async function cloudflareRequest(method, body = null) {
  const url = `https://cloudflare.com{CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_NAMESPACE_ID}/values/danumes_chat_history`;
  
  try {
    const myFetch = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
    const options = {
      method: method,
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'text/plain'
      }
    };
    if (body) {
      options.body = typeof body === 'object' ? JSON.stringify(body) : String(body);
    }
    return await myFetch(url, options);
  } catch (err) {
    console.error(`[KV] Ошибка сети (${method}):`, err.message);
    return null;
  }
}

async function saveMessagesToKV(messagesArray) {
  await cloudflareRequest('PUT', messagesArray);
}

async function loadMessagesFromKV() {
  const res = await cloudflareRequest('GET');
  if (res && res.status === 200) {
    try {
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      console.error('[KV] Ошибка парсинга JSON:', e.message);
    }
  }
  return [];
}
// --------------------------------

// СПИСОК ПОЛЬЗОВАТЕЛЕЙ С ГАЛОЧКАМИ И ДОСТУПОМ
const permanentUsers = [
  {
    username: 'Danumala',
    password: 'danyajukovka',
    hasVerifiedBadge: true,
    hasNewsAccess: true
  },
  {
    username: 'RunFly',
    password: 'GGWWXXJJ2001',
    hasVerifiedBadge: true,
    hasNewsAccess: false
  }
];

let messages = [];

loadMessagesFromKV().then(savedMessages => {
  messages = savedMessages || [];
  console.log(`[Бэкенд] Успешно загружено сообщений из Cloudflare KV: ${messages.length}`);
}).catch(err => {
  console.error('[Бэкенд] Ошибка старта:', err.message);
});

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Отдаем историю чата при подключении
  socket.emit('init-messages', messages);

  // Обработка авторизации (если используется на фронте)
  socket.on('login-attempt', (data) => {
    const user = permanentUsers.find(u => u.username === data.username && u.password === data.password);
    if (user) {
      socket.emit('login-success', {
        username: user.username,
        hasVerifiedBadge: user.hasVerifiedBadge,
        hasNewsAccess: user.hasNewsAccess
      });
    } else {
      socket.emit('login-failure', { message: 'Неверные данные или обычный аккаунт' });
    }
  });

  // Отправка сообщений
  socket.on('send-message', async (data) => {
    const checkUser = permanentUsers.find(u => u.username === data.username);
    
    const newMessage = {
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: checkUser ? checkUser.hasVerifiedBadge : false,
      newsAccess: checkUser ? checkUser.hasNewsAccess : false
    };

    messages.push(newMessage);
    io.emit('new-message', newMessage);

    // Сохраняем обновленный массив в Cloudflare KV
    saveMessagesToKV(messages);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер Danumes запущен на порту ${PORT}`);
});
