const socket = io();

// DOM
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
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const chatName = document.getElementById('chat-name');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const searchInput = document.getElementById('search-chat');
const newChatBtn = document.getElementById('new-chat-btn');

let currentUser = '';
let isLoginMode = true;
let typingTimeout;
let activeRoom = null;          // текущая комната
let activeContact = null;       // имя собеседника
const messagesCache = {};       // хранение сообщений по комнатам

// Переключение режимов (вход / регистрация)
function setMode(mode) {
  isLoginMode = mode;
  if (mode) {
    modalTitle.textContent = 'Вход';
    modalSubtitle.textContent = 'Войдите в аккаунт';
    submitBtn.textContent = 'Войти';
    document.querySelector('.toggle-mode').innerHTML = 'Нет аккаунта? <a href="#" id="toggle-mode-link">Зарегистрироваться</a>';
  } else {
    modalTitle.textContent = 'Регистрация';
    modalSubtitle.textContent = 'Создайте новый аккаунт';
    submitBtn.textContent = 'Зарегистрироваться';
    document.querySelector('.toggle-mode').innerHTML = 'Уже есть аккаунт? <a href="#" id="toggle-mode-link">Войти</a>';
  }
  document.getElementById('toggle-mode-link').addEventListener('click', (e) => {
    e.preventDefault();
    setMode(!isLoginMode);
  });
  errorMsg.textContent = '';
}
toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  setMode(!isLoginMode);
});

// Отправка формы аутентификации
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
      initApp();
    } else {
      errorMsg.textContent = response.message;
    }
  });
}
submitBtn.addEventListener('click', submitAuth);
[usernameInput, passwordInput].forEach(inp => inp.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') submitAuth();
}));

// Инициализация после входа
function initApp() {
  // Запрашиваем список онлайн пользователей
  socket.emit('request online users');
  // Обработчик обновления списка
  socket.on('online users', (users) => {
    renderContactList(users.filter(u => u !== currentUser));
  });

  // Когда кто-то входит/выходит, обновляем
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', () => socket.emit('request online users'));

  // Восстановление интерфейса при возврате на мобильных
  checkMobileView();
}

// Отрисовка списка контактов
function renderContactList(users) {
  chatList.innerHTML = '';
  users.forEach(username => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.user = username;
    div.innerHTML = `
      <div class="chat-avatar">${username.charAt(0).toUpperCase()}</div>
      <div class="chat-info">
        <div class="chat-name">${username}</div>
        <div class="chat-last-msg">Нажмите, чтобы начать чат</div>
      </div>
    `;
    div.addEventListener('click', () => openChat(username));
    chatList.appendChild(div);
  });
}

// Открыть чат с контактом
function openChat(username) {
  if (activeContact === username) return;

  // Покидаем предыдущую комнату, если была
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    // Сохраняем текущие сообщения в кеш
    if (messagesEl.children.length > 0) {
      messagesCache[activeRoom] = messagesEl.innerHTML;
    }
  }

  // Устанавливаем активный контакт
  activeContact = username;
  chatName.textContent = username;
  chatAvatar.textContent = username.charAt(0).toUpperCase();
  chatStatus.textContent = 'онлайн';

  // Вычисляем комнату и присоединяемся
  const room = [currentUser, username].sort().join(':');
  socket.emit('join room', { with: username }, (response) => {
    if (response && response.success) {
      activeRoom = room;
      // Загружаем историю из кеша, если есть
      if (messagesCache[activeRoom]) {
        messagesEl.innerHTML = messagesCache[activeRoom];
      } else {
        messagesEl.innerHTML = '';
      }
      scrollToBottom();
    }
  });

  // На мобильных скрываем сайдбар
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
  }
}

// Добавление сообщения в текущий чат
function addMessage(user, text, time) {
  const row = document.createElement('div');
  row.className = `message-row ${user === currentUser ? 'own' : 'other'}`;
  row.innerHTML = `
    <div class="message-bubble">${text}</div>
    <span class="message-time">${time}</span>
  `;
  messagesEl.appendChild(row);
  scrollToBottom();
}

// Прокрутка
function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
messagesContainer.addEventListener('scroll', () => {
  const threshold = 150;
  const dist = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
  scrollBottomBtn.classList.toggle('visible', dist > threshold);
});
scrollBottomBtn.addEventListener('click', scrollToBottom);

// Отправка сообщения
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeRoom) return;
  socket.emit('chat message', { room: activeRoom, text });
  messageInput.value = '';
  socket.emit('stop typing', { room: activeRoom });
  clearTimeout(typingTimeout);
}
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// Индикатор печати
messageInput.addEventListener('input', () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
});

// Приём сообщений
socket.on('chat message', (data) => {
  if (data.user !== currentUser) {
    addMessage(data.user, data.text, data.time);
  }
});

socket.on('typing', (data) => {
  if (data.user !== currentUser) {
    chatStatus.textContent = 'печатает...';
    chatStatus.style.color = 'var(--accent)';
  }
});
socket.on('stop typing', (data) => {
  if (data.user !== currentUser) {
    chatStatus.textContent = 'онлайн';
    chatStatus.style.color = '';
  }
});

// Мобильная навигация
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

// Поиск по контактам
searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(item => {
    const name = item.dataset.user.toLowerCase();
    item.style.display = name.includes(term) ? 'flex' : 'none';
  });
});

// Заглушки для кнопок
document.getElementById('emoji-btn').addEventListener('click', () => {
  messageInput.value += '😊';
});
document.getElementById('attach-btn').addEventListener('click', () => {
  alert('Прикрепление файлов — в разработке');
});
document.getElementById('mic-btn').addEventListener('click', () => {
  alert('Голосовые сообщения — в разработке');
});

// Кнопка обновления списка контактов
newChatBtn.addEventListener('click', () => {
  socket.emit('request online users');
});
