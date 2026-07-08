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

const profileModal = document.getElementById('profile-modal');
const profileAvatar = document.getElementById('profile-avatar');
const profileName = document.getElementById('profile-name');
const profileStatus = document.getElementById('profile-status-text');
const selfActions = document.getElementById('self-profile-actions');
const contactActions = document.getElementById('contact-profile-actions');
const changePasswordBtn = document.getElementById('change-password-btn');
const logoutBtn = document.getElementById('logout-btn');
const changePasswordForm = document.getElementById('change-password-form');
const oldPasswordInp = document.getElementById('old-password');
const newPasswordInp = document.getElementById('new-password');
const profileError = document.getElementById('profile-error');
const savePasswordBtn = document.getElementById('save-password-btn');
const closeProfile = document.getElementById('close-profile');
const backToChatBtn = document.getElementById('back-to-chat-btn');

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
const composer = document.getElementById('composer');

const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarUsername = document.getElementById('sidebar-username');
const currentUserArea = document.getElementById('current-user-area');

// Плюсик и меню
const createGroupPlus = document.getElementById('create-group-plus');
const plusMenu = document.getElementById('plus-menu');
const menuCreateGroup = document.getElementById('menu-create-group');
const menuCreateChannel = document.getElementById('menu-create-channel');

// Модалка создания
const createGroupModal = document.getElementById('create-group-modal');
const closeGroupModal = document.getElementById('close-group-modal');
const createModalTitle = document.getElementById('create-modal-title');
const entityNameInput = document.getElementById('entity-name-input');
const membersLabel = document.getElementById('members-label');
const entityMembersList = document.getElementById('entity-members-list');
const createEntityBtn = document.getElementById('create-entity-btn');

let currentUser = '';
let isLoginMode = true;
let typingTimer;
let activeRoom = null;
let activeContact = null;
let activeChatType = null; // 'user', 'group', 'channel'
const messagesCache = {};
let selectedMembers = new Set();
let allOnlineUsers = [];
let creatingMode = 'group'; // 'group' или 'channel'

// ========== АВТОРИЗАЦИЯ ==========
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
      updateSidebarUser();
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

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initApp() {
  socket.emit('request online users');
  
  socket.on('online users', users => {
    allOnlineUsers = users;
    renderAllChats();
  });
  
  socket.on('groups list', groups => {
    window.allGroups = groups;
    renderAllChats();
  });
  
  socket.on('channels list', channels => {
    window.allChannels = channels;
    renderAllChats();
  });
  
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', (data) => {
    socket.emit('request online users');
    if (activeContact === data.username) {
      chatStatus.textContent = 'офлайн';
    }
  });
  
  checkMobile();
}

function updateSidebarUser() {
  sidebarAvatar.textContent = currentUser.charAt(0).toUpperCase();
  sidebarUsername.textContent = currentUser;
}

// ========== РЕНДЕР ВСЕХ ЧАТОВ ==========
function renderAllChats() {
  contactsList.innerHTML = '';
  
  // Каналы
  (window.allChannels || []).forEach(channel => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.user = channel.name;
    div.dataset.room = channel.room;
    div.dataset.type = 'channel';
    div.innerHTML = `
      <div class="avatar channel-avatar">📢</div>
      <div class="contact-info">
        <div class="contact-name">${channel.name}</div>
        <div class="contact-last">Канал · ${channel.subscribers.length} подписчиков</div>
      </div>
    `;
    div.addEventListener('click', () => openChat(channel.name, channel.room, 'channel'));
    contactsList.appendChild(div);
  });
  
  // Группы
  (window.allGroups || []).forEach(group => {
    if (!group.members.includes(currentUser)) return;
    const onlineCount = group.members.filter(m => allOnlineUsers.includes(m)).length;
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.user = group.name;
    div.dataset.room = group.room;
    div.dataset.type = 'group';
    div.innerHTML = `
      <div class="avatar group-avatar">${group.name.charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${group.name}</div>
        <div class="contact-last">${group.members.length} участников · ${onlineCount} онлайн</div>
      </div>
    `;
    div.addEventListener('click', () => openChat(group.name, group.room, 'group'));
    contactsList.appendChild(div);
  });
  
  // Пользователи
  allOnlineUsers.filter(u => u !== currentUser).forEach(name => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.dataset.user = name;
    div.dataset.type = 'user';
    div.innerHTML = `
      <div class="avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${name}</div>
        <div class="contact-last">Нажмите для чата</div>
      </div>
    `;
    div.addEventListener('click', () => openChat(name, null, 'user'));
    contactsList.appendChild(div);
  });
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(name, room, type) {
  if (activeContact === name) return;

  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    if (messagesList.children.length) {
      messagesCache[activeRoom] = messagesList.innerHTML;
    }
  }

  activeContact = name;
  activeChatType = type;
  chatName.textContent = name;
  
  if (type === 'channel') {
    chatAvatar.innerHTML = '📢';
    chatAvatar.className = 'avatar channel-avatar';
    chatStatus.textContent = 'канал';
    composer.style.display = 'none'; // Скрываем поле ввода для обычных пользователей
    // Проверяем, админ ли текущий пользователь
    const channel = (window.allChannels || []).find(c => c.room === room);
    if (channel && channel.admin === currentUser) {
      composer.style.display = 'flex';
    }
  } else if (type === 'group') {
    chatAvatar.textContent = name.charAt(0).toUpperCase();
    chatAvatar.className = 'avatar group-avatar';
    const group = (window.allGroups || []).find(g => g.room === room);
    const onlineCount = group ? group.members.filter(m => allOnlineUsers.includes(m)).length : 0;
    chatStatus.textContent = `${group?.members.length || 0} участников · ${onlineCount} онлайн`;
    composer.style.display = 'flex';
  } else {
    chatAvatar.textContent = name.charAt(0).toUpperCase();
    chatAvatar.className = 'avatar';
    chatStatus.textContent = 'онлайн';
    composer.style.display = 'flex';
  }
  
  messagesList.innerHTML = '';

  const finalRoom = room || [currentUser, name].sort().join(':');
  
  socket.emit('join room', { room: finalRoom }, (res) => {
    if (res && res.success) {
      activeRoom = finalRoom;
      if (messagesCache[activeRoom]) {
        messagesList.innerHTML = messagesCache[activeRoom];
      }
      scrollToBottom();
    }
  });

  if (window.innerWidth <= 768) sidebar.classList.add('hidden');

  document.querySelectorAll('.contact-item').forEach(el => {
    el.classList.toggle('active', el.dataset.user === name);
  });
}

// ========== СООБЩЕНИЯ ==========
function addMessage(user, text, time) {
  const row = document.createElement('div');
  row.className = `message-row ${user === currentUser ? 'own' : 'other'}`;
  const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  row.innerHTML = `
    <div class="bubble"><strong>${user}</strong><br>${safeText}</div>
    <span class="message-time">${time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  messagesList.appendChild(row);
  scrollToBottom();
  if (activeRoom) messagesCache[activeRoom] = messagesList.innerHTML;
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
  messageInput.focus();
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

messageInput.addEventListener('input', () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
});

socket.on('chat message', (data) => {
  if (data.user !== currentUser) {
    addMessage(data.user, data.text, data.time);
  }
});

socket.on('typing', data => {
  if (data.user !== currentUser) {
    chatStatus.textContent = 'печатает...';
    chatStatus.style.color = '#4a9eff';
  }
});

socket.on('stop typing', data => {
  if (data.user !== currentUser) {
    chatStatus.textContent = activeChatType === 'channel' ? 'канал' : 'онлайн';
    chatStatus.style.color = '';
  }
});

// ========== ПРОФИЛЬ ==========
currentUserArea.addEventListener('click', () => showProfile(currentUser, true));
chatAvatar.addEventListener('click', () => {
  if (activeContact) showProfile(activeContact, false);
});
document.getElementById('chat-header-info-clickable').addEventListener('click', () => {
  if (activeContact) showProfile(activeContact, false);
});

function showProfile(username, isSelf) {
  profileAvatar.textContent = username.charAt(0).toUpperCase();
  profileName.textContent = username;
  profileStatus.textContent = 'онлайн';
  selfActions.style.display = isSelf ? 'flex' : 'none';
  contactActions.style.display = isSelf ? 'none' : 'block';
  changePasswordForm.style.display = 'none';
  profileError.textContent = '';
  profileModal.style.display = 'flex';
}

closeProfile.addEventListener('click', () => profileModal.style.display = 'none');
backToChatBtn.addEventListener('click', () => profileModal.style.display = 'none');

changePasswordBtn.addEventListener('click', () => {
  changePasswordForm.style.display = 'block';
  profileError.textContent = '';
});

savePasswordBtn.addEventListener('click', () => {
  const oldPass = oldPasswordInp.value;
  const newPass = newPasswordInp.value;
  if (!oldPass || !newPass) {
    profileError.textContent = 'Заполните поля';
    return;
  }
  socket.emit('change password', { oldPassword: oldPass, newPassword: newPass }, (res) => {
    if (res.success) {
      profileError.textContent = 'Пароль изменён';
      profileError.style.color = '#4caf50';
    } else {
      profileError.textContent = res.message;
      profileError.style.color = '#ff6b6b';
    }
  });
});

logoutBtn.addEventListener('click', () => {
  socket.emit('logout');
  currentUser = '';
  activeRoom = null;
  activeContact = null;
  appContainer.style.display = 'none';
  profileModal.style.display = 'none';
  loginModal.style.display = 'flex';
  setMode(true);
});

// ========== ПЛЮСИК И МЕНЮ ==========
createGroupPlus.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenu.style.display = plusMenu.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('click', () => {
  plusMenu.style.display = 'none';
});

menuCreateGroup.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenu.style.display = 'none';
  creatingMode = 'group';
  createModalTitle.textContent = 'Новая группа';
  membersLabel.style.display = 'block';
  entityMembersList.style.display = 'block';
  entityNameInput.value = '';
  selectedMembers.clear();
  renderMemberSelection();
  createGroupModal.style.display = 'flex';
});

menuCreateChannel.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenu.style.display = 'none';
  creatingMode = 'channel';
  createModalTitle.textContent = 'Новый канал';
  membersLabel.style.display = 'none';
  entityMembersList.style.display =
