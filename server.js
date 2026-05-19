const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);

// Конфигурируем сокеты так, чтобы они подхватывали любое входящее соединение с Render
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // Обеспечивает совместимость со старыми версиями библиотек на фронтенде
});

app.use(express.static(path.join(__dirname)));

// --- НАСТРОЙКИ CLOUDFLARE KV ---
const CLOUDFLARE_ACCOUNT_ID = '315776b94c3e5574096cfecc515248bc';
const CLOUDFLARE_NAMESPACE_ID = '1b46ee655188445ca7b277fb8634dca0';
const CLOUDFLARE_API_TOKEN = 'cfut_SS1xHLjBmPurWiP1cwYW1WckTJC4q3ukFbM7zyW49d264d59'; 

function cloudflareRequest(method, bodyData = null) {
  return new Promise((resolve) => {
    const pathUrl = `/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_NAMESPACE_ID}/values/danumes_chat_history`;
    
    const payload = bodyData ? (typeof bodyData === 'object' ? JSON.stringify(bodyData) : String(bodyData)) : null;

    const options = {
      hostname: '://cloudflare.com',
      port: 443,
      path: pathUrl,
      method: method,
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'text/plain; charset=utf-8'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload, 'utf8');
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => {
      console.error(`[KV Error] Ошибка запроса (${method}):`, err.message);
      resolve(null);
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function saveMessagesToKV(messagesArray) {
  const res = await cloudflareRequest('PUT', messagesArray);
  if (res && res.status === 200) {
    console.log('[KV] Чат успешно синхронизирован с Cloudflare KV Pairs!');
  }
}

async function loadMessagesFromKV() {
  const res = await cloudflareRequest('GET');
  if (res && res.status === 200) {
    try {
      return JSON.parse(res.body);
    } catch (e) {
      console.error('[KV] База пуста. Начинаем с чистого листа.');
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
  console.log(`[Бэкенд] Чат готов. Сообщений в базе: ${messages.length}`);
}).catch(err => {
  console.error('[Бэкенд] Ошибка при старте базы:', err.message);
});

io.on('connection', (socket) => {
  console.log('Пользователь подключился к сокетам:', socket.id);

  // Сразу отправляем историю чата из Cloudflare при коннекте
  socket.emit('init-messages', messages);

  // Твоя базовая проверка авторизации
  socket.on('login-attempt', (data) => {
    const user = permanentUsers.find(u => u.username === data.username && u.password === data.password);
    if (user) {
      socket.emit('login-success', {
        username: user.username,
        hasVerifiedBadge: user.hasVerifiedBadge,
        hasNewsAccess: user.hasNewsAccess
      });
    } else {
      socket.emit('login-failure', { message: 'Неверные данные' });
    }
  });

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

    // Отправляем на вечное хранение в Cloudflare KV
    saveMessagesToKV(messages);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

// Render автоматически передает PORT через переменные окружения,
// но если его нет — резервируем 3000 порт.
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер Danumes запущен на порту ${PORT}`);
});
