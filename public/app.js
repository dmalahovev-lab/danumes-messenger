const socket = io();

// ========== DOM-элементы ==========
const $ = (id) => document.getElementById(id);

const loginModal = $('login-modal');
const loginUsername = $('login-username');
const loginPassword = $('login-password');
const loginError = $('login-error');
const loginBtn = $('login-btn');
const modalTitle = $('modal-title');
const modalSub = $('modal-sub');
const toggleLink = $('toggle-link');
const toggleText = $('toggle-text');

const profileModal = $('profile-modal');
const profileAvatar = $('profile-avatar');
const profileName = $('profile-name');
const selfActions = $('self-actions');
const contactActions = $('contact-actions');
const passForm = $('pass-form');
const oldPass = $('old-pass');
const newPass = $('new-pass');
const passError = $('pass-error');

const settingsModal = $('settings-modal');
const settingsOldPass = $('settings-old-pass');
const settingsNewPass = $('settings-new-pass');
const settingsPassError = $('settings-pass-error');
const settingsNickname = $('settings-nickname');
const themeGrid = $('theme-grid');

const createModal = $('create-modal');
const createTitle = $('create-title');
const entityName = $('entity-name');
const membersLabel = $('members-label');
const membersList = $('members-list');

const plusModal = $('plus-modal');
const menuGroupBtn = $('menu-group-btn');
const menuChannelBtn = $('menu-channel-btn');

const contextMenu = $('context-menu');
const contextCopy = $('context-copy');
const contextDelete = $('context-delete');

const appDiv = $('app');
const sidebar = $('sidebar');
const chatList = $('chat-list');
const messagesDiv = $('messages');
const messagesBox = $('messages-box');
const msgInput = $('msg-input');
const chatTitle = $('chat-title');
const chatStatus = $('chat-status');
const chatAvatar = $('chat-avatar');
const composer = $('composer');
const searchInput = $('search');

let currentUser = '';
let isLogin = true;
let activeRoom = null;
let activeContact = null;
let activeType = null;
let typingTimer;
let selectedMembers = new Set();
let creatingMode = 'group';
let onlineUsers = [];
let allGroups = [];
let allChannels = [];
const msgCache = {};
let contextTarget = null;

// Звук уведомлений
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gA==');

// ========== ТЕМЫ ==========
const themes = {
  'blue-dark': {
    name: 'Синяя тёмная',
    bg: '#0a0a0f',
    accent: '#4a9eff',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(74, 158, 255, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(120, 80, 255, 0.04) 0%, transparent 55%), #0a0a0f'
  },
  'green-dark': {
    name: 'Зелёная тёмная',
    bg: '#0a0f0a',
    accent: '#4caf50',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(76, 175, 80, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(0, 200, 83, 0.04) 0%, transparent 55%), #0a0f0a'
  },
  'purple-dark': {
    name: 'Фиолетовая тёмная',
    bg: '#0f0a15',
    accent: '#9c27b0',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(156, 39, 176, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(233, 30, 99, 0.04) 0%, transparent 55%), #0f0a15'
  },
  'sunset': {
    name: 'Закат',
    bg: '#1a0a0a',
    accent: '#ff6b35',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(255, 107, 53, 0.08) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(255, 193, 7, 0.06) 0%, transparent 55%), #1a0a0a'
  },
  'ocean': {
    name: 'Океан',
    bg: '#0a1a1a',
    accent: '#00bcd4',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(0, 188, 212, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(0, 150, 136, 0.04) 0%, transparent 55%), #0a1a1a'
  },
  'light': {
    name: 'Светлая',
    bg: '#f5f5f7',
    accent: '#4a9eff',
    gradient: '#f5f5f7',
    isLight: true
  },
  'light-green': {
    name: 'Светло-зелёная',
    bg: '#f0f5f0',
    accent: '#4caf50',
    gradient: '#f0f5f0',
    isLight: true
  },
  'light-pink': {
    name: 'Розовая',
    bg: '#fff0f5',
    accent: '#e91e63',
    gradient: '#fff0f5',
    isLight: true
  }
};

let currentTheme = localStorage.getItem('danumes-theme') || 'blue-dark';

function applyTheme(themeName) {
  const theme = themes[themeName];
  if (!theme) return;
  
  currentTheme = themeName;
  localStorage.setItem('danumes-theme', themeName);
  
  const root = document.documentElement;
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-light', theme.accent);
  
  const appBg = document.querySelector('.app-bg');
  if (appBg) {
    appBg.style.background = theme.gradient;
  }
  
  if (theme.isLight) {
    root.style.setProperty('--text', '#1a1a1a');
    root.style.setProperty('--text-secondary', 'rgba(0, 0, 0, 0.6)');
    root.style.setProperty('--text-tertiary', 'rgba(0, 0, 0, 0.4)');
    root.style.setProperty('--glass-bg', 'rgba(0, 0, 0, 0.04)');
    root.style.setProperty('--glass-bg-hover', 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.08)');
  } else {
    root.style.setProperty('--text', '#ffffff');
    root.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.55)');
    root.style.setProperty('--text-tertiary', 'rgba(255, 255, 255, 0.35)');
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.04)');
    root.style.setProperty('--glass-bg-hover', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.06)');
  }
}

// Применяем сохранённую тему при загрузке
applyTheme(currentTheme);

// ========== АВТОРИЗАЦИЯ ==========
function switchMode() {
  isLogin = !isLogin;
  modalTitle.textContent = isLogin ? 'Вход' : 'Регистрация';
  modalSub.textContent = isLogin ? 'Войдите в аккаунт' : 'Создайте новый аккаунт';
  loginBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  toggleText.innerHTML = isLogin 
    ? 'Нет аккаунта? <a href="#" id="toggle-link">Зарегистрироваться</a>'
    : 'Есть аккаунт? <a href="#" id="toggle-link">Войти</a>';
  document.getElementById('toggle-link').addEventListener('click', e => { e.preventDefault(); switchMode(); });
  loginError.textContent = '';
}

toggleLink.addEventListener('click', e => { e.preventDefault(); switchMode(); });

function doAuth() {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();
  if (!u || !p) { loginError.textContent = 'Заполните все поля'; return; }
  
  socket.emit(isLogin ? 'login' : 'register', { username: u, password: p }, res => {
    if (res.success) {
      currentUser = res.username;
      loginModal.style.display = 'none';
      appDiv.style.display = 'flex';
      $('my-avatar').textContent = currentUser[0].toUpperCase();
      $('my-name').textContent = currentUser;
      initApp();
    } else {
      loginError.textContent = res.message;
    }
  });
}

loginBtn.addEventListener('click', doAuth);
[loginUsername, loginPassword].forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initApp() {
  socket.emit('request online users');
  
  socket.on('online users', users => {
    onlineUsers = users;
    renderAll();
  });
  
  socket.on('groups list', groups => {
    allGroups = groups;
    renderAll();
  });
  
  socket.on('channels list', channels => {
    allChannels = channels;
    renderAll();
  });
  
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', () => socket.emit('request online users'));
  
  socket.on('chat message', data => {
    addMsg(data.user, data.text, data.time);
    // Звук уведомления, если чат не в фокусе
    if (data.user !== currentUser && document.hidden) {
      notificationSound.play().catch(() => {});
    }
  });
  
  socket.on('typing', () => { 
    chatStatus.textContent = 'печатает...'; 
    chatStatus.style.color = '#4a9eff'; 
  });
  
  socket.on('stop typing', () => {
    updateStatus();
    chatStatus.style.color = '';
  });
  
  if (window.innerWidth <= 768) sidebar.classList.add('hidden');
}

// ========== РЕНДЕР ==========
function renderAll() {
  chatList.innerHTML = '';
  
  allChannels.forEach(ch => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c);">📢</div><div class="info"><div class="name">${ch.name}</div><div class="last">Канал · ${ch.subscribers.length} подписчиков</div></div>`;
    div.addEventListener('click', () => openChat(ch.name, ch.room, 'channel'));
    chatList.appendChild(div);
  });
  
  allGroups.forEach(g => {
    if (!g.members.includes(currentUser)) return;
    const online = g.members.filter(m => onlineUsers.includes(m)).length;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d);">${g.name[0].toUpperCase()}</div><div class="info"><div class="name">${g.name}</div><div class="last">${g.members.length} участников · ${online} онлайн</div></div>`;
    div.addEventListener('click', () => openChat(g.name, g.room, 'group'));
    chatList.appendChild(div);
  });
  
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar">${u[0].toUpperCase()}</div><div class="info"><div class="name">${u}</div><div class="last">Нажмите для чата</div></div>`;
    div.addEventListener('click', () => openChat(u, null, 'user'));
    chatList.appendChild(div);
  });
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(name, room, type) {
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    if (messagesDiv.children.length) msgCache[activeRoom] = messagesDiv.innerHTML;
  }
  
  activeContact = name;
  activeType = type;
  activeRoom = room || [currentUser, name].sort().join(':');
  
  chatTitle.textContent = name;
  messagesDiv.innerHTML = msgCache[activeRoom] || '';
  
  if (type === 'channel') {
    chatAvatar.innerHTML = '📢';
    chatAvatar.style.background = 'linear-gradient(135deg,#f093fb,#f5576c)';
    const ch = allChannels.find(c => c.room === activeRoom);
    composer.style.display = (ch && ch.admin === currentUser) ? 'flex' : 'none';
    chatStatus.textContent = 'канал';
  } else if (type === 'group') {
    chatAvatar.textContent = name[0].toUpperCase();
    chatAvatar.style.background = 'linear-gradient(135deg,#4ecdc4,#44a08d)';
    updateStatus();
    composer.style.display = 'flex';
  } else {
    chatAvatar.textContent = name[0].toUpperCase();
    chatAvatar.style.background = 'linear-gradient(135deg,#4a9eff,#6c5ce7)';
    updateStatus();
    composer.style.display = 'flex';
  }
  
  socket.emit('join room', { room: activeRoom });
  
  document.querySelectorAll('.chat-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('.name')?.textContent === name);
  });
  
  if (window.innerWidth <= 768) sidebar.classList.add('hidden');
  setTimeout(() => { messagesBox.scrollTop = messagesBox.scrollHeight; }, 100);
}

function updateStatus() {
  if (activeType === 'channel') chatStatus.textContent = 'канал';
  else if (activeType === 'group') {
    const g = allGroups.find(gr => gr.room === activeRoom);
    const online = g ? g.members.filter(m => onlineUsers.includes(m)).length : 0;
    chatStatus.textContent = `${g?.members.length || 0} участников · ${online} онлайн`;
  } else {
    chatStatus.textContent = onlineUsers.includes(activeContact) ? 'онлайн' : 'офлайн';
  }
}

// ========== СООБЩЕНИЯ ==========
function addMsg(user, text, time) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  div.dataset.user = user;
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  if (activeType === 'group' || activeType === 'channel') {
    div.innerHTML = `<div class="sender">${user}</div>${safe}<div class="time">${time}</div>`;
  } else {
    div.innerHTML = `${safe}<div class="time">${time}</div>`;
  }
  
  // Контекстное меню для своих сообщений
  if (user === currentUser) {
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextTarget = div;
      contextMenu.style.display = 'block';
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
    });
  }
  
  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
  if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
}

function sendMsg() {
  const text = msgInput.value.trim();
  if (!text) return;
  
  if (!activeRoom) {
    alert('Сначала выберите чат');
    return;
  }
  
  socket.emit('chat message', { room: activeRoom, text: text });
  msgInput.value = '';
  socket.emit('stop typing', { room: activeRoom });
  clearTimeout(typingTimer);
  msgInput.focus();
}

$('send-btn').addEventListener('click', sendMsg);
msgInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
});

msgInput.addEventListener('input', () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
});

// ========== КОНТЕКСТНОЕ МЕНЮ ==========
document.addEventListener('click', () => {
  contextMenu.style.display = 'none';
});

contextCopy.addEventListener('click', () => {
  if (contextTarget) {
    const text = contextTarget.querySelector('.bubble')?.textContent || contextTarget.textContent;
    navigator.clipboard.writeText(text.replace(/<[^>]*>/g, ''));
  }
  contextMenu.style.display = 'none';
});

contextDelete.addEventListener('click', () => {
  if (contextTarget) {
    contextTarget.remove();
    if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
  }
  contextMenu.style.display = 'none';
});

// ========== ПЛЮС МЕНЮ ==========
function openPlusMenu() {
  plusModal.style.display = 'flex';
}

$('plus-btn').addEventListener('click', openPlusMenu);

plusModal.addEventListener('click', (e) => {
  if (e.target === plusModal) plusModal.style.display = 'none';
});

menuGroupBtn.addEventListener('click', () => {
  plusModal.style.display = 'none';
  creatingMode = 'group';
  createTitle.textContent = 'Новая группа';
  membersLabel.style.display = 'block';
  membersList.style.display = 'block';
  entityName.value = '';
  selectedMembers.clear();
  renderMembers();
  createModal.style.display = 'flex';
});

menuChannelBtn.addEventListener('click', () => {
  plusModal.style.display = 'none';
  creatingMode = 'channel';
  createTitle.textContent = 'Новый канал';
  membersLabel.style.display = 'none';
  membersList.style.display = 'none';
  entityName.value = '';
  createModal.style.display = 'flex';
});

$('close-create').addEventListener('click', () => { createModal.style.display = 'none'; });

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const div = document.createElement('div');
    div.className = 'member-item';
    if (selectedMembers.has(u)) div.classList.add('selected');
    div.innerHTML = `<div class="avatar-sm">${u[0].toUpperCase()}</div><span class="member-name">${u}</span><span class="check">✓</span>`;
    div.addEventListener('click', () => {
      if (selectedMembers.has(u)) {
        selectedMembers.delete(u);
        div.classList.remove('selected');
      } else {
        selectedMembers.add(u);
        div.classList.add('selected');
      }
    });
    membersList.appendChild(div);
  });
}

$('create-btn').addEventListener('click', () => {
  const name = entityName.value.trim();
  if (!name) return alert('Введите название');
  
  if (creatingMode === 'group') {
    if (selectedMembers.size === 0) return alert('Выберите участников');
    socket.emit('create group', { name, members: Array.from(selectedMembers) }, res => {
      if (res.success) {
        createModal.style.display = 'none';
        selectedMembers.clear();
      } else {
        alert(res.message);
      }
    });
  } else {
    socket.emit('create channel', { name }, res => {
      if (res.success) createModal.style.display = 'none';
      else alert(res.message);
    });
  }
});

// ========== НАСТРОЙКИ ==========
function openSettings() {
  settingsOldPass.value = '';
  settingsNewPass.value = '';
  settingsPassError.textContent = '';
  settingsNickname.value = currentUser;
  renderThemeGrid();
  settingsModal.style.display = 'flex';
}

function renderThemeGrid() {
  themeGrid.innerHTML = '';
  Object.entries(themes).forEach(([key, theme]) => {
    const div = document.createElement('div');
    div.className = 'theme-item';
    if (key === currentTheme) div.classList.add('active');
    div.style.background = theme.gradient || theme.bg;
    div.style.borderColor = theme.accent;
    div.title = theme.name;
    div.addEventListener('click', () => {
      applyTheme(key);
      renderThemeGrid();
    });
    themeGrid.appendChild(div);
  });
}

$('settings-btn').addEventListener('click', openSettings);

$('close-settings').addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.style.display = 'none';
});

$('save-settings-btn').addEventListener('click', () => {
  const newNick = settingsNickname.value.trim();
  const oldPass = settingsOldPass.value;
  const newPass = settingsNewPass.value;
  
  if (newNick && newNick !== currentUser) {
    // Меняем никнейм (локально)
    currentUser = newNick;
    $('my-name').textContent = currentUser;
    $('sidebar-avatar').textContent = currentUser[0].toUpperCase();
    settingsPassError.textContent = 'Никнейм изменён';
    settingsPassError.style.color = '#4caf50';
  }
  
  if (oldPass && newPass) {
    socket.emit('change password', { oldPassword: oldPass, newPassword: newPass }, res => {
      if (res.success) {
        settingsPassError.textContent = 'Пароль изменён';
        settingsPassError.style.color = '#4caf50';
        settingsOldPass.value = '';
        settingsNewPass.value = '';
      } else {
        settingsPassError.textContent = res.message;
        settingsPassError.style.color = '#ff6b6b';
      }
    });
  }
});

// ===== ПРОФИЛЬ =====
$('user-info').addEventListener('click', () => showProfile(true));
chatAvatar.addEventListener('click', () => { if (activeType === 'user') showProfile(false); });
$('chat-info').addEventListener('click', () => { if (activeType === 'user') showProfile(false); });

function showProfile(isSelf) {
  const name = isSelf ? currentUser : activeContact;
  profileAvatar.textContent = name[0].toUpperCase();
  profileName.textContent = name;
  selfActions.style.display = isSelf ? 'flex' : 'none';
  contactActions.style.display = isSelf ? 'none' : 'block';
  passForm.style.display = 'none';
  profileModal.style.display = 'flex';
}

$('close-profile').addEventListener('click', () => { profileModal.style.display = 'none'; });
$('back-btn-profile').addEventListener('click', () => { profileModal.style.display = 'none'; });

$('change-pass-btn').addEventListener('click', () => { passForm.style.display = 'block'; });
$('save-pass-btn').addEventListener('click', () => {
  const old = oldPass.value;
  const np = newPass.value;
  if (!old || !np) { passError.textContent = 'Заполните поля'; return; }
  socket.emit('change password', { oldPassword: old, newPassword: np }, res => {
    passError.textContent = res.success ? 'Пароль изменён' : res.message;
    passError.style.color = res.success ? '#4caf50' : '#ff6b6b';
  });
});

$('logout-btn').addEventListener('click', () => {
  socket.emit('logout');
  location.reload();
});

// ===== ПОИСК =====
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(el => {
    const name = el.querySelector('.name')?.textContent.toLowerCase() || '';
    el.style.display = name.includes(q) ? 'flex' : 'none';
  });
});

// ===== АДАПТИВ =====
$('back-btn').addEventListener('click', () => { sidebar.classList.remove('hidden'); });
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) sidebar.classList.remove('hidden');
});
