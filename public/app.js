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

const createModal = $('create-modal');
const createTitle = $('create-title');
const entityName = $('entity-name');
const membersLabel = $('members-label');
const membersList = $('members-list');

const plusMenu = $('plus-menu');

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
let activeType = null; // 'user', 'group', 'channel'
let typingTimer;
let selectedMembers = new Set();
let creatingMode = 'group';
let onlineUsers = [];
let allGroups = [];
let allChannels = [];
const msgCache = {};

// ===== АВТОРИЗАЦИЯ =====
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

// ===== ИНИЦИАЛИЗАЦИЯ =====
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
    if (data.user !== currentUser) addMsg(data.user, data.text, data.time);
  });
  
  socket.on('typing', () => { chatStatus.textContent = 'печатает...'; chatStatus.style.color = '#4a9eff'; });
  socket.on('stop typing', () => {
    updateStatus();
    chatStatus.style.color = '';
  });
  
  if (window.innerWidth <= 768) sidebar.classList.add('hidden');
}

// ===== РЕНДЕР СПИСКА ЧАТОВ =====
function renderAll() {
  chatList.innerHTML = '';
  
  // Каналы
  allChannels.forEach(ch => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c);">📢</div><div class="info"><div class="name">${ch.name}</div><div class="last">Канал · ${ch.subscribers.length} подписчиков</div></div>`;
    div.addEventListener('click', () => openChat(ch.name, ch.room, 'channel'));
    chatList.appendChild(div);
  });
  
  // Группы
  allGroups.forEach(g => {
    if (!g.members.includes(currentUser)) return;
    const online = g.members.filter(m => onlineUsers.includes(m)).length;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d);">${g.name[0].toUpperCase()}</div><div class="info"><div class="name">${g.name}</div><div class="last">${g.members.length} участников · ${online} онлайн</div></div>`;
    div.addEventListener('click', () => openChat(g.name, g.room, 'group'));
    chatList.appendChild(div);
  });
  
  // Пользователи
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="avatar">${u[0].toUpperCase()}</div><div class="info"><div class="name">${u}</div><div class="last">Нажмите для чата</div></div>`;
    div.addEventListener('click', () => openChat(u, null, 'user'));
    chatList.appendChild(div);
  });
}

// ===== ОТКРЫТИЕ ЧАТА =====
function openChat(name, room, type) {
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    if (messagesDiv.children.length) msgCache[activeRoom] = messagesDiv.innerHTML;
  }
  
  activeContact = name;
  activeType = type;
  // Для личного чата генерируем комнату, иначе используем готовый room
  if (!room) {
    activeRoom = [currentUser, name].sort().join(':');
  } else {
    activeRoom = room;
  }
  
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

// ===== СООБЩЕНИЯ =====
function addMsg(user, text, time) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  if (activeType === 'group' || activeType === 'channel') {
    div.innerHTML = `<div class="sender">${user}</div>${safe}<div class="time">${time}</div>`;
  } else {
    div.innerHTML = `${safe}<div class="time">${time}</div>`;
  }
  
  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
  if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
}

function sendMsg() {
  const text = msgInput.value.trim();
  if (!text) return;
  
  // Если комната не установлена (ни один чат не выбран), пытаемся создать комнату по активному контакту
  if (!activeRoom && activeContact) {
    activeRoom = [currentUser, activeContact].sort().join(':');
    socket.emit('join room', { room: activeRoom });
  }
  
  if (!activeRoom) {
    alert('Сначала выберите чат');
    return;
  }
  
  socket.emit('chat message', { room: activeRoom, text });
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

// ===== ПЛЮСИК (ИСПРАВЛЕНО) =====
// Убедимся, что кнопка получается корректно
const plusBtn = $('plus-btn');
if (plusBtn) {
  plusBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    // Переключаем видимость меню
    if (plusMenu.style.display === 'block') {
      plusMenu.style.display = 'none';
    } else {
      plusMenu.style.display = 'block';
    }
  });
} else {
  console.error('Кнопка плюса не найдена!');
}

// Закрываем меню при клике вне
document.addEventListener('click', function(e) {
  if (!plusMenu.contains(e.target) && e.target !== plusBtn) {
    plusMenu.style.display = 'none';
  }
});

$('menu-group').addEventListener('click', function(e) {
  e.stopPropagation();
  plusMenu.style.display = 'none';
  creatingMode = 'group';
  createTitle.textContent = 'Новая группа';
  membersLabel.style.display = 'block';
  membersList.style.display = 'block';
  entityName.value = '';
  selectedMembers.clear();
  renderMembers();
  createModal.style.display = 'flex';
});

$('menu-channel').addEventListener('click', function(e) {
  e.stopPropagation();
  plusMenu.style.display = 'none';
  creatingMode = 'channel';
  createTitle.textContent = 'Новый канал';
  membersLabel.style.display = 'none';
  membersList.style.display = 'none';
  entityName.value = '';
  createModal.style.display = 'flex';
});

$('close-create').addEventListener('click', function() {
  createModal.style.display = 'none';
});

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const div = document.createElement('div');
    div.className = 'member-item';
    if (selectedMembers.has(u)) div.classList.add('selected');
    div.innerHTML = `<div class="avatar-sm">${u[0].toUpperCase()}</div><span class="member-name">${u}</span><span class="check">✓</span>`;
    div.addEventListener('click', function() {
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

$('create-btn').addEventListener('click', function() {
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
      if (res.success) {
        createModal.style.display = 'none';
      } else {
        alert(res.message);
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
