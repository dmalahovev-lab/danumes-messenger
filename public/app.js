const socket = io();

// DOM элементы
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

const sidebarAvatar = document.getElementById('sidebar-avatar');
const sidebarUsername = document.getElementById('sidebar-username');
const currentUserArea = document.getElementById('current-user-area');

// Группы
const createGroupPlus = document.getElementById('create-group-plus');
const createGroupModal = document.getElementById('create-group-modal');
const closeGroupModal = document.getElementById('close-group-modal');
const groupNameInput = document.getElementById('group-name-input');
const groupMembersList = document.getElementById('group-members-list');
const createGroupBtn = document.getElementById('create-group-btn');

let currentUser = '';
let isLoginMode = true;
let typingTimer;
let activeRoom = null;
let activeContact = null;
const messagesCache = {};
let selectedMembers = new Set();
let allOnlineUsers = [];

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
    renderContacts(users.filter(u => u !== currentUser));
  });
  
  socket.on('user joined', () => {
    socket.emit('request online users');
  });
  
  socket.on('user left', (data) => {
    socket.emit('request online users');
    if (activeContact === data.username) {
      chatStatus.textContent = 'офлайн';
      chatStatus.style.color = '';
    }
  });
  
  checkMobile();
}

function updateSidebarUser() {
  sidebarAvatar.textContent = currentUser.charAt(0).toUpperCase();
  sidebarUsername.textContent = currentUser;
}

// ========== РЕНДЕР КОНТАКТОВ ==========
function renderContacts(users) {
  // Сохраняем группы
  const existingGroups = [];
  contactsList.querySelectorAll('.contact-item[data-is-group="true"]').forEach(el => {
    existingGroups.push({
      name: el.dataset.user,
      room: el.dataset.room,
      members: el.querySelector('.contact-last')?.textContent.replace('Группа: ', '') || ''
    });
  });
  
  contactsList.innerHTML = '';
  
  // Восстанавливаем группы
  existingGroups.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'contact-item';
    groupDiv.dataset.user = group.name;
    groupDiv.dataset.room = group.room;
    groupDiv.dataset.isGroup = 'true';
    groupDiv.innerHTML = `
      <div class="avatar group-avatar">${group.name.charAt(0).toUpperCase()}</div>
      <div class="contact-info">
        <div class="contact-name">${group.name}</div>
        <div class="contact-last">Группа: ${group.members}</div>
      </div>
    `;
    groupDiv.addEventListener('click', () => {
      openChat(group.name, group.room);
    });
    contactsList.appendChild(groupDiv);
  });
  
  // Добавляем пользователей
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

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(username, forceRoom = null) {
  if (activeContact === username && !forceRoom) return;

  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    if (messagesList.children.length) {
      messagesCache[activeRoom] = messagesList.innerHTML;
    }
  }

  activeContact = username;
  chatName.textContent = username;
  chatAvatar.textContent = username.charAt(0).toUpperCase();
  chatStatus.textContent = 'онлайн';
  chatStatus.style.color = '';
  messagesList.innerHTML = '';

  const room = forceRoom || [currentUser, username].sort().join(':');
  
  socket.emit('join room', { with: username, room: room }, (res) => {
    if (res && res.success) {
      activeRoom = room;
      if (messagesCache[activeRoom]) {
        messagesList.innerHTML = messagesCache[activeRoom];
      }
      scrollToBottom();
    }
  });

  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
  }

  document.querySelectorAll('.contact-item').forEach(el => {
    el.classList.toggle('active', el.dataset.user === username);
  });
}

// ========== СООБЩЕНИЯ ==========
function addMessage(user, text, time) {
  const isOwn = user === currentUser;
  const row = document.createElement('div');
  row.className = `message-row ${isOwn ? 'own' : 'other'}`;
  const safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  row.innerHTML = `
    <div class="bubble">${safeText}</div>
    <span class="message-time">${time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  messagesList.appendChild(row);
  scrollToBottom();
  
  // Кешируем
  if (activeRoom) {
    messagesCache[activeRoom] = messagesList.innerHTML;
  }
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

// Индикатор печати
messageInput.addEventListener('input', () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    socket.emit('stop typing', { room: activeRoom });
  }, 1000);
});

// Приём сообщений
socket.on('chat message', (data) => {
  if (data.user !== currentUser) {
    addMessage(data.user, data.text, data.time);
  }
});

socket.on('typing', data => {
  if (data.user !== currentUser && activeContact === data.user) {
    chatStatus.textContent = 'печатает...';
    chatStatus.style.color = '#4a9eff';
  }
});

socket.on('stop typing', data => {
  if (data.user !== currentUser && activeContact === data.user) {
    chatStatus.textContent = 'онлайн';
    chatStatus.style.color = '';
  }
});

// ========== ПРОФИЛЬ ==========
currentUserArea.addEventListener('click', () => {
  showProfile(currentUser, true);
});

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

  if (isSelf) {
    selfActions.style.display = 'flex';
    contactActions.style.display = 'none';
    changePasswordForm.style.display = 'none';
    profileError.textContent = '';
  } else {
    selfActions.style.display = 'none';
    contactActions.style.display = 'block';
  }
  profileModal.style.display = 'flex';
}

closeProfile.addEventListener('click', () => {
  profileModal.style.display = 'none';
});

backToChatBtn.addEventListener('click', () => {
  profileModal.style.display = 'none';
});

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
      oldPasswordInp.value = '';
      newPasswordInp.value = '';
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
  usernameInp.value = '';
  passwordInp.value = '';
});

// ========== СОЗДАНИЕ ГРУППЫ ==========
createGroupPlus.addEventListener('click', () => {
  selectedMembers.clear();
  groupNameInput.value = '';
  renderGroupMemberList();
  createGroupModal.style.display = 'flex';
});

closeGroupModal.addEventListener('click', () => {
  createGroupModal.style.display = 'none';
});

function renderGroupMemberList() {
  groupMembersList.innerHTML = '';
  allOnlineUsers
    .filter(u => u !== currentUser)
    .forEach(username => {
      const div = document.createElement('div');
      div.className = 'group-member-item';
      div.dataset.user = username;
      if (selectedMembers.has(username)) {
        div.classList.add('selected');
      }
      div.innerHTML = `
        <div class="avatar">${username.charAt(0).toUpperCase()}</div>
        <span class="contact-name">${username}</span>
        <span class="check-mark">✓</span>
      `;
      div.addEventListener('click', () => {
        if (selectedMembers.has(username)) {
          selectedMembers.delete(username);
          div.classList.remove('selected');
        } else {
          selectedMembers.add(username);
          div.classList.add('selected');
        }
      });
      groupMembersList.appendChild(div);
    });
}

createGroupBtn.addEventListener('click', () => {
  const groupName = groupNameInput.value.trim();
  if (!groupName) {
    alert('Введите название группы');
    return;
  }
  if (selectedMembers.size === 0) {
    alert('Выберите хотя бы одного участника');
    return;
  }

  const members = Array.from(selectedMembers);
  const room = [currentUser, ...members].sort().join(':');
  
  const groupDiv = document.createElement('div');
  groupDiv.className = 'contact-item';
  groupDiv.dataset.user = groupName;
  groupDiv.dataset.room = room;
  groupDiv.dataset.isGroup = 'true';
  groupDiv.innerHTML = `
    <div class="avatar group-avatar">${groupName.charAt(0).toUpperCase()}</div>
    <div class="contact-info">
      <div class="contact-name">${groupName}</div>
      <div class="contact-last">Группа: ${members.join(', ')}</div>
    </div>
  `;
  groupDiv.addEventListener('click', () => {
    openChat(groupName, room);
  });
  
  contactsList.insertBefore(groupDiv, contactsList.firstChild);
  createGroupModal.style.display = 'none';
  selectedMembers.clear();
});

// ========== МОБИЛЬНАЯ ВЕРСИЯ ==========
function checkMobile() {
  if (window.innerWidth <= 768) {
    sidebar.classList.add('hidden');
  } else {
    sidebar.classList.remove('hidden');
  }
}

window.addEventListener('resize', checkMobile);

backBtn.addEventListener('click', () => {
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('hidden');
  }
});

// ========== ПОИСК ==========
searchContacts.addEventListener('input', e => {
  const term = e.target.value.toLowerCase();
  document.querySelectorAll('.contact-item').forEach(el => {
    const name = el.dataset.user.toLowerCase();
    el.style.display = name.includes(term) ? 'flex' : 'none';
  });
});

// ========== ЗАГЛУШКИ ==========
document.getElementById('emoji-btn').addEventListener('click', () => {
  messageInput.value += '😊';
  messageInput.focus();
});

document.getElementById('attach-btn').addEventListener('click', () => {
  alert('Вложения – в разработке');
});

document.getElementById('mic-btn').addEventListener('click', () => {
  alert('Голосовые – в разработке');
});
