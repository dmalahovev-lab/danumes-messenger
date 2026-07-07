const socket = io();

// DOM элементы
const loginModal = document.getElementById('login-modal');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const appContainer = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const messagesList = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const chatName = document.getElementById('chat-name');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const searchInput = document.getElementById('search-chat');

let currentUser = '';
let typingTimeout;
let currentChat = null; // для будущего — пока общий чат
const onlineUsers = new Map();

// === Логика входа ===
loginBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (name) {
    currentUser = name;
    socket.emit('new user', name);
    loginModal.style.display = 'none';
    appContainer.style.display = 'flex';
    // По умолчанию показываем сайдбар (на мобильных скроем позже)
    checkMobileView();
  }
});

// === Socket events ===
socket.on('chat message', (data) => {
  addMessage(data.user, data.text, data.id === socket.id, data.time);
});

socket.on('typing', (data) => {
  if (data.id !== socket.id) {
    chatStatus.textContent = 'печатает...';
    chatStatus.style.color = 'var(--accent)';
  }
});

socket.on('stop typing', (id) => {
  if (id !== socket.id) {
    chatStatus.textContent = 'онлайн';
    chatStatus.style.color = '';
  }
});

socket.on('online users', (users) => {
  // Можем использовать для обновления чат-листа, пока просто обновим статус
  if (currentChat) {
    const online = users.includes(currentChat);
    chatStatus.textContent = online ? 'онлайн' : 'офлайн';
  }
});

// === Работа с сообщениями ===
function addMessage(user, text, isOwn, time) {
  const row = document.createElement('div');
  row.className = `message-row ${isOwn ? 'own' : 'other'}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  timeSpan.textContent = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  row.appendChild(bubble);
  row.appendChild(timeSpan);
  messagesList.appendChild(row);
  scrollToBottom();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Автопрокрутка и кнопка "вниз"
messagesContainer.addEventListener('scroll', () => {
  const threshold = 150;
  const distanceFromBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
  if (distanceFromBottom > threshold) {
    scrollBottomBtn.classList.add('visible');
  } else {
    scrollBottomBtn.classList.remove('visible');
  }
});
scrollBottomBtn.addEventListener('click', () => scrollToBottom());

// === Отправка сообщения ===
function sendMessage() {
  const text = messageInput.value.trim();
  if (text && currentUser) {
    socket.emit('chat message', text);
    messageInput.value = '';
    // Останавливаем индикатор печати
    socket.emit('stop typing');
    clearTimeout(typingTimeout);
  }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Индикатор печати
messageInput.addEventListener('input', () => {
  socket.emit('typing');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('stop typing');
  }, 1000);
});

// === Управление сайдбаром (мобильные) ===
function checkMobileView() {
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
    // Показываем область чата на полный экран
  } else {
    sidebar.classList.remove('hidden');
  }
}
window.addEventListener('resize', checkMobileView);

backBtn.addEventListener('click', () => {
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('hidden');
  }
});

// При клике по чату (пока у нас только общий чат, но заготовка)
chatList.addEventListener('click', (e) => {
  const chatItem = e.target.closest('.chat-item');
  if (chatItem) {
    const chatUser = chatItem.dataset.user;
    openChat(chatUser);
    if (window.innerWidth <= 768) {
      sidebar.classList.add('hidden');
    }
  }
});

function openChat(user) {
  currentChat = user;
  chatName.textContent = user;
  chatAvatar.textContent = user.charAt(0).toUpperCase();
  // обновить статус
  const online = onlineUsers.has(user);
  chatStatus.textContent = online ? 'онлайн' : 'офлайн';
  // Очистить и загрузить историю? Пока без истории
  messagesList.innerHTML = '';
}

// Обработка поиска
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(item => {
    const name = item.dataset.user.toLowerCase();
    item.style.display = name.includes(term) ? 'flex' : 'none';
  });
});

// Заглушка для новых кнопок
document.getElementById('emoji-btn').addEventListener('click', () => {
  messageInput.value += '😊';
});
document.getElementById('attach-btn').addEventListener('click', () => {
  alert('Функция прикрепления файлов скоро появится');
});
document.getElementById('mic-btn').addEventListener('click', () => {
  alert('Голосовые сообщения пока не реализованы');
});

// Первоначальная загрузка чатов (создаём общий чат «Общий»)
function initGeneralChat() {
  const generalDiv = document.createElement('div');
  generalDiv.className = 'chat-item active';
  generalDiv.dataset.user = 'Общий';
  generalDiv.innerHTML = `
    <div class="chat-avatar">О</div>
    <div class="chat-info">
      <div class="chat-name">Общий чат</div>
      <div class="chat-last-msg">Начните общение</div>
    </div>
  `;
  chatList.appendChild(generalDiv);
  openChat('Общий');
}
initGeneralChat();

// Обработка новых пользователей для чат-листа (добавим их как контакты)
socket.on('user joined', ({ id, name }) => {
  if (name !== currentUser && !document.querySelector(`.chat-item[data-user="${name}"]`)) {
    addUserToChatList(name);
  }
});

function addUserToChatList(name) {
  const div = document.createElement('div');
  div.className = 'chat-item';
  div.dataset.user = name;
  div.innerHTML = `
    <div class="chat-avatar">${name.charAt(0).toUpperCase()}</div>
    <div class="chat-info">
      <div class="chat-name">${name}</div>
      <div class="chat-last-msg">Новый участник</div>
    </div>
  `;
  chatList.appendChild(div);
}
