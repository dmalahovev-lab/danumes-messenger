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
const messagesList = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');
const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const chatName = document.getElementById('chat-name');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const searchInput = document.getElementById('search-chat');

let currentUser = '';
let isLoginMode = true; // true = вход, false = регистрация
let typingTimeout;
let currentChat = null;

// Переключение режимов
toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
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
  // Перепривязываем ссылку заново, т.к. мы заменили HTML
  document.getElementById('toggle-mode-link').addEventListener('click', toggleLinkClick);
  errorMsg.textContent = '';
});

// Повторный обработчик для переключения (костыль, но рабочий)
function toggleLinkClick(e) {
  e.preventDefault();
  toggleLink.dispatchEvent(new Event('click'));
}
document.getElementById('toggle-mode-link').addEventListener('click', toggleLinkClick);

// Отправка формы входа/регистрации
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
      initChat(); // инициализация интерфейса после входа
      checkMobileView();
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

// Сокеты
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

// ... (далее весь остальной код сообщений, отправки, сайдбара, как в предыдущем app.js, но с функцией initChat)
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

// Остальные функции (addMessage, sendMessage, openChat, checkMobileView и т.д.) скопируйте из предыдущего app.js без изменений, кроме того, что нужно удалить старую логику логина (она уже не нужна).
// Я приведу здесь полный консолидированный app.js, чтобы не было путаницы.
