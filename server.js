const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const https = require('https');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  allowEIO3: true
});

app.use(express.static(path.join(__dirname)));

// --- НАСТРОЙКИ CLOUDFLARE KV ---
const CLOUDFLARE_ACCOUNT_ID = '315776b94c3e5574096cfecc515248bc';
const CLOUDFLARE_NAMESPACE_ID = '1b46ee655188445ca7b277fb8634dca0';
const CLOUDFLARE_API_TOKEN = 'cfut_SS1xHLjBmPurWiP1cwYW1WckTJC4q3ukFbM7zyW49d264d59'; 

function cloudflareRequest(key, method, bodyData = null) {
  return new Promise((resolve) => {
    const pathUrl = `/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_NAMESPACE_ID}/values/${key}`;
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

    req.on('error', (err) => { resolve(null); });
    if (payload) req.write(payload);
    req.end();
  });
}
// --------------------------------

// Постоянные админские аккаунты
const permanentUsers = [
  { username: 'Danumala', password: 'danyajukovka', hasVerifiedBadge: true, hasNewsAccess: true },
  { username: 'RunFly', password: 'GGWWXXJJ2001', hasVerifiedBadge: true, hasNewsAccess: false }
];

let messages = [];
let registeredUsers = []; // Тут будут храниться все зарегистрированные пользователи

// Загружаем сообщения и пользователей из Cloudflare при старте
async function initData() {
  const msgRes = await cloudflareRequest('danumes_chat_history', 'GET');
  if (msgRes && msgRes.status === 200) {
    try { messages = JSON.parse(msgRes.body); } catch (e) {}
  }

  const userRes = await cloudflareRequest('danumes_users_list', 'GET');
  if (userRes && userRes.status === 200) {
    try { registeredUsers = JSON.parse(userRes.body); } catch (e) {}
  }
  console.log(`[Бэкенд] База готова. Сообщений: ${messages.length}, Пользователей: ${registeredUsers.length}`);
}
initData();

io.on('connection', (socket) => {
  socket.emit('init-messages', messages);

  // Обработка Входа
  socket.on('login-attempt', (data) => {
    // 1. Ищем сначала среди админов
    let user = permanentUsers.find(u => u.username === data.username && u.password === data.password);
    
    // 2. Если не админ, ищем в списке зарегистрированных в Cloudflare
    if (!user) {
      user = registeredUsers.find(u => u.username === data.username && u.password === data.password);
    }

    if (user) {
      socket.emit('login-success', {
        username: user.username,
        hasVerifiedBadge: user.hasVerifiedBadge || false,
        hasNewsAccess: user.hasNewsAccess || false
      });
    } else {
      socket.emit('login-failure');
    }
  });

  // Обработка новой Регистрации (сохраняем навсегда)
  socket.on('register-attempt', async (data) => {
    const userExists = registeredUsers.some(u => u.username === data.username) || permanentUsers.some(u => u.username === data.username);
    
    if (userExists) {
      socket.emit('register-failure', { message: 'Имя уже занято!' });
    } else {
      const newUser = {
        username: data.username,
        password: data.password,
        hasVerifiedBadge: false,
        hasNewsAccess: false
      };
      
      registeredUsers.push(newUser);
      socket.emit('register-success', newUser);

      // Сохраняем обновленный список пользователей в Cloudflare KV
      await cloudflareRequest('danumes_users_list', 'PUT', registeredUsers);
    }
  });

  socket.on('send-message', async (data) => {
    const isVerifiedUser = permanentUsers.some(u => u.username === data.username);
    const isDanumala = data.username === 'Danumala';
    
    const newMessage = {
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVerified: isVerifiedUser,
      newsAccess: isDanumala
    };

    messages.push(newMessage);
    io.emit('new-message', newMessage);

    await cloudflareRequest('danumes_chat_history', 'PUT', messages);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер Danumes активен на порту ${PORT}`);
});
