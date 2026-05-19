const express = require('express');
const http = require('http');
const path = require('path');
const https = require('https');
const WebSocket = require('ws'); // Подключаем поддержку чистых веб-сокетов

const app = express();
const server = http.createServer(app);

// Настройка Socket.io для совместимости
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Настройка чистых WebSockets (ws) на том же сервере
const wss = new WebSocket.Server({ noServer: true });

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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', (err) => {
      console.error(`[KV Error] Ошибка запроса (${method}):`, err.message);
      resolve(null);
    });

    if (payload) req.write(payload);
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

// ПОЛЬЗОВАТЕЛИ
const permanentUsers = [
  { username: 'Danumala', password: 'danyajukovka', hasVerifiedBadge: true, hasNewsAccess: true },
  { username: 'RunFly', password: 'GGWWXXJJ2001', hasVerifiedBadge: true, hasNewsAccess: false }
];

let messages = [];

loadMessagesFromKV().then(savedMessages => {
  messages = savedMessages || [];
  console.log(`[Бэкенд] Чат готов. Сообщений в базе: ${messages.length}`);
});

// Функция для обработки отправки сообщений (общая для io и ws)
function handleIncomingMessage(data) {
  const checkUser = permanentUsers.find(u => u.username === data.username);
  const newMessage = {
    username: data.username,
    text: data.text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    isVerified: checkUser ? checkUser.hasVerifiedBadge : false,
    newsAccess: checkUser ? checkUser.hasNewsAccess : false
  };
  messages.push(newMessage);
  saveMessagesToKV(messages);
  return newMessage;
}

// 1. Логика для Socket.io
io.on('connection', (socket) => {
  socket.emit('init-messages', messages);
  socket.on('send-message', (data) => {
    const msg = handleIncomingMessage(data);
    io.emit('new-message', msg);
  });
});

// 2. Логика для чистых WebSockets (ws)
wss.on('connection', (ws) => {
  console.log('[WS] Клиент подключился');
  ws.send(JSON.stringify({ type: 'init-messages', data: messages }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'send-message') {
        const msg = handleIncomingMessage(data.data);
        // Рассылаем всем WS клиентам
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'new-message', data: msg }));
          }
        });
        // Дублируем в Socket.io на случай смешанного подключения
        io.emit('new-message', msg);
      }
    } catch (e) {
      console.error('[WS Error] Неверный формат сообщения');
    }
  });
});

// Интегрируем обработку ws запросов в наш http сервер
server.on('upgrade', (request, socket, head) => {
  if (request.headers['upgrade'] && request.headers['upgrade'].toLowerCase() === 'websocket') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер Danumes успешно запущен на порту ${PORT}`);
});
