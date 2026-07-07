const socket = io();

// DOM
const loginModal = document.getElementById('login-modal');
const usernameInp = document.getElementById('username-input');
const passwordInp = document.getElementById('password-input');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-msg');
const modalTitle = document.getElementById('modal-title');
const modalSub = document.getElementById('modal-subtitle');
const toggleLink = document.getElementById('toggle-mode-link');
const toggleText = document.getElementById('toggle-mode-text');
const appContainer = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const contactsList = document.getElementById('contacts-list');
const messagesContainer = document.getElementById('messages-container');
const messagesList = document.getElementById('messages-list');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');
const scrollBottom = document.getElementById('scroll-bottom');
const chatName = document.getElementById('chat-name');
const chatStatus = document.getElementById('chat-status');
const chatAvatar = document.getElementById('chat-avatar');
const searchContacts = document.getElementById('search-contacts');
const refreshBtn = document.getElementById('refresh-contacts');

let currentUser = '';
let isLoginMode = true;
let typingTimer;
let activeRoom = null;
let activeContact = null;
const messagesCache = {};

// Переключение режимов
function setMode(mode) {
  isLoginMode = mode;
  if (mode) {
    modalTitle.textContent = 'Вход';
    modalSub.textContent = 'Войдите в аккаунт';
    submitBtn.textContent = 'Войти';
    toggleText.textContent = 'Нет аккаунта?';
    toggleLink.textContent = 'Зарегистрироваться';
  } else {
    modalTitle.textContent = 'Регистрация';
    modalSub.textContent = 'Создайте новый аккаунт';
    submitBtn.textContent = 'Зарегистрироваться';
    toggleText.textContent = 'Уже есть аккаунт?';
    toggleLink.textContent = 'Войти';
  }
  errorMsg.textContent = '';
}
toggleLink.addEventListener('click', (e) => {
  e.preventDefault();
  setMode(!isLoginMode);
});

function submitAuth() {
  const username = usernameInp.value.trim();
  const password = passwordInp.value.trim();
  if (!username || !password) {
    errorMsg.textContent = 'Заполните все поля';
    return;
  }
  const event = isLoginMode ? 'login' : 'register';
  socket.emit(event, { username, password }, (res) => {
    if (res.success) {
      currentUser = res.username;
      loginModal.style.display = 'none';
      appContainer.style.display = 'flex';
      initApp();
    } else {
      errorMsg.textContent = res.message;
    }
  });
}
submitBtn.addEventListener('click', submitAuth);
[usernameInp, passwordInp].forEach(el => el.addEventListener('keypress', e => {
  if (e.key === 'Enter') submitAuth();
}));

function initApp() {
  socket.emit('request online users');
  socket.on('online users', users => {
    renderContacts(users.filter(u => u !== currentUser));
  });
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', () => socket.emit('request online users'));
  checkMobile();
}

function renderContacts(users) {
  contactsList.innerHTML = '';
  users.forEach(name => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.user = name;
    div.innerHTML = `
      <div class="avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${name}</div>
        <div class="contact-last">Нажмите для чата</div>
      </div>
    `;
    div.addEventListener('click', () => openChat(name));
    contactsList.appendChild(div);
  });
}

function openChat(username) {
  if (activeContact === username) return;
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    if (messagesList.children.length) messagesCache[activeRoom] = messagesList.innerHTML;
  }
  activeContact = username;
  chatName.textContent = username;
  chatAvatar.textContent = username.charAt(0).toUpperCase();
  chatStatus.textContent = 'онлайн';
  const room = [currentUser, username].sort().join(':');
  socket.emit('join room', { with: username }, (res) => {
    if (res && res.success) {
      activeRoom = room;
      messagesList.innerHTML = messagesCache[activeRoom] || '';
      scrollToBottom();
    }
  });
  if (window.innerWidth <= 768) sidebar.classList.add('hidden');
}

function addMessage(user, text, time) {
  const row = document.createElement('div');
  row.className = `message-row ${user === currentUser ? 'own' : 'other'}`;
  row.innerHTML = `<div class="bubble">${text}</div><span class="message-time">${time}</span>`;
  messagesList.appendChild(row);
  scrollToBottom();
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
messagesContainer.addEventListener('scroll', () => {
  const dist = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
  scrollBottom.classList.toggle('visible', dist > 150);
});
scrollBottom.addEventListener('click', scrollToBottom);

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !activeRoom) return;
  socket.emit('chat message', { room: activeRoom, text });
  messageInput.value = '';
  socket.emit('stop typing', { room: activeRoom });
  clearTimeout(typingTimer);
}
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

messageInput.addEventListener('input', () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
});

socket.on('chat message', data => {
  if (data.user !== currentUser) addMessage(data.user, data.text, data.time);
});
socket.on('typing', data => {
  if (data.user !== currentUser) { chatStatus.textContent = 'печатает...'; chatStatus.style.color = '#5e9eff'; }
});
socket.on('stop typing', data => {
  if (data.user !== currentUser) { chatStatus.textContent = 'онлайн'; chatStatus.style.color = ''; }
});

function checkMobile() {
  if (window.innerWidth <= 768) sidebar.classList.add('hidden');
  else sidebar.classList.remove('hidden');
}
window.addEventListener('resize', checkMobile);
backBtn.addEventListener('click', () => {
  if (window.innerWidth <= 768) sidebar.classList.remove('hidden');
});

searchContacts.addEventListener('input', e => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.contact-item').forEach(el => {
    el.style.display = el.dataset.user.toLowerCase().includes(term) ? 'flex' : 'none';
  });
});

document.getElementById('emoji-btn').addEventListener('click', () => messageInput.value += '😊');
document.getElementById('attach-btn').addEventListener('click', () => alert('Вложения – в разработке'));
document.getElementById('mic-btn').addEventListener('click', () => alert('Голосовые – в разработке'));
refreshBtn.addEventListener('click', () => socket.emit('request online users'));
