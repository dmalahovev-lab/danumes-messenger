// ===== СОСТОЯНИЕ =====
let currentUser = null;
let currentChat = null;
let socket = null;
let chats = [];

// ========================================
// ===== ИНИЦИАЛИЗАЦИЯ =====
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Danumes загружен!');
  initSocket();
  checkAuth();
  initEvents();
});

// ========================================
// ===== СОКЕТ =====
// ========================================

function initSocket() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('✅ Socket подключен');
    if (currentUser) {
      socket.emit('register', currentUser.id);
    }
  });

  socket.on('new_message', (message) => {
    console.log('Новое сообщение:', message);
    if (currentChat && currentChat.id === message.chat_id) {
      renderMessages();
    }
    loadChats();
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Ошибка Socket:', error);
    showToast('❌ Ошибка соединения с сервером');
  });
}

// ========================================
// ===== АУТЕНТИФИКАЦИЯ =====
// ========================================

function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    showLogin();
    return;
  }

  fetch('/api/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (res.ok) return res.json();
    throw new Error('Not authenticated');
  })
  .then(user => {
    currentUser = user;
    showApp();
    loadChats();
    if (socket) socket.emit('register', currentUser.id);
  })
  .catch(() => {
    localStorage.removeItem('token');
    showLogin();
  });
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'block';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('app').style.display = 'none';
}

function showRegister() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'block';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
}

// ========================================
// ===== СОБЫТИЯ =====
// ========================================

function initEvents() {
  // Логин
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showApp();
        loadChats();
        if (socket) socket.emit('register', currentUser.id);
        showToast('✅ Добро пожаловать!');
      } else {
        document.getElementById('loginError').textContent = data.error || 'Ошибка входа';
      }
    } catch (error) {
      document.getElementById('loginError').textContent = 'Ошибка соединения с сервером';
    }
  });

  // Регистрация
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showApp();
        loadChats();
        if (socket) socket.emit('register', currentUser.id);
        showToast('✅ Регистрация успешна!');
      } else {
        document.getElementById('registerError').textContent = data.error || 'Ошибка регистрации';
      }
    } catch (error) {
      document.getElementById('registerError').textContent = 'Ошибка соединения с сервером';
    }
  });

  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showRegister();
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    currentUser = null;
    showLogin();
    if (socket) socket.disconnect();
  });

  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('searchInput').addEventListener('input', handleSearch);
}

// ========================================
// ===== ПОИСК =====
// ========================================

async function handleSearch() {
  const query = this.value.trim();
  if (query.length < 2) return;

  try {
    const res = await fetch(`/api/search/users?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
    if (data.success && data.users.length > 0) {
      showToast(`Найдено ${data.users.length} пользователей`);
    }
  } catch (error) {
    console.error('Search error:', error);
  }
}

// ========================================
// ===== ЧАТЫ =====
// ========================================

async function loadChats() {
  try {
    const res = await fetch('/api/chats', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
    if (data.success) {
      chats = data.chats;
      renderChats();
    }
  } catch (error) {
    console.error('Error loading chats:', error);
    showToast('❌ Ошибка загрузки чатов');
  }
}

function renderChats() {
  const container = document.getElementById('chatList');
  if (!container) return;

  if (chats.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Нет чатов</div>';
    return;
  }

  container.innerHTML = chats.map(chat => {
    let name = chat.name || 'Чат';
    if (chat.type === 'personal' && chat.otherUser) {
      name = chat.otherUser.display_name || chat.otherUser.username;
    }

    return `
      <div class="chat-item" data-chat-id="${chat.id}" 
           style="padding:10px;cursor:pointer;border-bottom:1px solid #eee;">
        <div style="font-weight:500;">${name}</div>
        <div style="font-size:12px;color:#999;">${chat.messages?.length || 0} сообщений</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.chatId;
      const chat = chats.find(c => c.id === chatId);
      if (chat) openChat(chat);
    });
  });
}

async function openChat(chat) {
  currentChat = chat;
  
  let name = chat.name || 'Чат';
  if (chat.type === 'personal' && chat.otherUser) {
    name = chat.otherUser.display_name || chat.otherUser.username;
  }
  
  document.getElementById('chatUserName').textContent = name;
  document.getElementById('messages').innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Загрузка...</div>';

  try {
    const res = await fetch(`/api/messages/${chat.id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
    if (data.success) {
      messages[chat.id] = data.messages;
      renderMessages();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  socket.emit('join_chat', chat.id);
}

let messages = {};

function renderMessages() {
  const container = document.getElementById('messages');
  const chatMessages = messages[currentChat?.id] || [];

  if (chatMessages.length === 0) {
    container.innerHTML = '<div style="color:#999;text-align:center;padding:20px;">Нет сообщений</div>';
    return;
  }

  container.innerHTML = chatMessages.map(msg => {
    const isSent = msg.sender_id === currentUser.id;
    const senderName = msg.sender?.display_name || msg.sender?.username || 'Пользователь';

    return `
      <div style="margin:4px 0;text-align:${isSent ? 'right' : 'left'};">
        <div style="display:inline-block;padding:8px 12px;border-radius:12px;background:${isSent ? '#27A5E7' : '#f0f0f0'};color:${isSent ? 'white' : 'black'};max-width:70%;">
          ${!isSent ? `<div style="font-size:11px;font-weight:600;color:#27A5E7;">${senderName}</div>` : ''}
          <div>${msg.content || '📎 Файл'}</div>
          <div style="font-size:10px;opacity:0.5;margin-top:2px;">${new Date(msg.created_at).toLocaleTimeString()}</div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

// ========================================
// ===== СООБЩЕНИЯ =====
// ========================================

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentChat) return;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        chatId: currentChat.id,
        content: content,
        type: 'text'
      })
    });

    const data = await res.json();
    if (data.success) {
      input.value = '';
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('❌ Ошибка отправки');
  }
}

// ========================================
// ===== УТИЛИТЫ =====
// ========================================

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    z-index: 9999;
    font-size: 14px;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

console.log('✅ Danumes загружен!');
