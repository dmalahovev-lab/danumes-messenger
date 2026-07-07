const socket = io();

// DOM-элементы
const loginModal = document.getElementById('login-modal');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-message');
const modalTitle = document.getElementById('modal-title');
const modalSubtitle = document.getElementById('modal-subtitle');
const toggleLink = document.getElementById('toggle-mode-link');
const appContainer = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const chatList = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const messagesList = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const chatName = document.getElementById('chat-name');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const searchInput = document.getElementById('search-chat');
const emojiBtn = document.getElementById('emoji-btn');
const attachBtn = document.getElementById('attach-btn');
const micBtn = document.getElementById('mic-btn');

let currentUser = '';
let isLoginMode = true;
let typingTimeout;
let currentChat = null;

// === Переключение режимов (вход/регистрация) ===
function setMode(mode) {
  isLoginMode = mode;
  if (mode) {
    modalTitle.textContent = 'Вход';
    modalSubtitle.textContent = 'Войдите в аккаунт';
    submitBtn.textContent = 'Войти';
    toggleLink.textContent = 'Зарегистрироваться';
    document.querySelector('.toggle-mode').innerHTML = 'Нет аккаунта? <a href="#" id="toggle-mode-link">Зарегистрироваться</a>';
  } else {
    modalTitle.textContent = 'Регистрация';
    modalSubtitle.textContent = 'Создайте новый аккаунт';
    submitBtn.textContent = 'Зарегистрироваться';
    toggleLink.textContent = 'Войти';
    document.querySelector('.toggle-mode').innerHTML = 'Уже есть аккаунт? <a href="#" id="toggle-mode-link">Войти</a>';
  }
  // Перепривязываем обработчик на новую ссылку
  document.getElementById('toggle-mode-link').addEventListener('click', (e) => {
    e.preventDefault();
    setMode(!isLoginMode);
  });
  errorMsg.textContent = '';
}

// Инициализация обработчика переключения
toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  setMode(!isLoginMode);
});

// === Отправка формы аутентификации ===
function submitAuth() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) {
    errorMsg.textContent = 'Заполните все поля';
    return;
  }

  const eventName = isLoginMode ? 'login' : 'register';
  socket.emit(eventName, { username, password }, (response) => {
    if (response.success) {
      currentUser = response.username;
      loginModal.style.display = 'none';
      appContainer.style.display = 'flex';
      initChat();          // Заполняем чат-лист общим чатом
      checkMobileView();   // Адаптив
    } else {
      errorMsg.textContent = response.message;
    }
  });
}

submitBtn.addEventListener('click', submitAuth);
[usernameInput, passwordInput].forEach(input => {
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAuth();
  });
});

// === Инициализация интерфейса после входа ===
function initChat() {
  // Создаём общий чат
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

// === Открыть чат ===
function openChat(user) {
  currentChat = user;
  chatName.textContent = user;
  chatAvatar.textContent = user.charAt(0).toUpperCase();
  // Статус можно оставить заглушкой или привязать к онлайну
  chatStatus.textContent = 'онлайн';
  messagesList.innerHTML = '';
}

// === Добавление сообщения ===
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

// === Прокрутка ===
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messagesContainer.addEventListener('scroll', () => {
  const threshold = 150;
  const distance = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
  scrollBottomBtn.classList.toggle('visible', distance > threshold);
});
scrollBottomBtn.addEventListener('click', scrollToBottom);

// === Отправка сообщения ===
function sendMessage() {
  const text = messageInput.value.trim();
  if (text && currentUser) {
    socket.emit('chat message', text);
    messageInput.value = '';
    socket.emit('stop typing');
    clearTimeout(typingTimeout);
  }
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Индикатор печати
messageInput.addEventListener('input', () => {
  socket.emit('typing');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('stop typing'), 1000);
});

// === Управление сайдбаром (мобильные) ===
function checkMobileView() {
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
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

// Клик по чату (для общего чата)
chatList.addEventListener('click', (e) => {
  const chatItem = e.target.closest('.chat-item');
  if (chatItem) {
    const user = chatItem.dataset.user;
    openChat(user);
    if (window.innerWidth <= 768) {
      sidebar.classList.add('hidden');
    }
  }
});

// Поиск по чатам
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(item => {
    const name = item.dataset.user.toLowerCase();
    item.style.display = name.includes(term) ? 'flex' : 'none';
  });
});

// Заглушки для кнопок
emojiBtn.addEventListener('click', () => {
  messageInput.value += '😊';
});
attachBtn.addEventListener('click', () => alert('Прикрепление файлов — в разработке'));
micBtn.addEventListener('click', () => alert('Голосовые сообщения — в разработке'));

// Сокеты: приём сообщений, индикатор печати
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
