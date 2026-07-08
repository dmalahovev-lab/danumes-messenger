const socket = io();

// === DOM ===
const $ = (id) => document.getElementById(id);

const loginModal = $('login-modal');
const loginUsername = $('login-username');
const loginPassword = $('login-password');
const loginError = $('login-error');
const loginBtn = $('login-btn');
const modalTitle = $('modal-title');
const toggleLink = $('toggle-link');

const profileModal = $('profile-modal');
const profileAvatar = $('profile-avatar');
const profileName = $('profile-name');
const selfActions = $('self-actions');
const contactActions = $('contact-actions');
const passForm = $('pass-form');
const oldPass = $('old-pass');
const newPass = $('new-pass');
const passError = $('pass-error');
const savePassBtn = $('save-pass-btn');
const closeProfile = $('close-profile');
const changePassBtn = $('change-pass-btn');
const logoutBtn = $('logout-btn');
const backBtnProfile = $('back-btn-profile');

const createModal = $('create-modal');
const closeCreate = $('close-create');
const createTitle = $('create-title');
const entityName = $('entity-name');
const membersLabel = $('members-label');
const membersList = $('members-list');
const createBtn = $('create-btn');

const plusMenu = $('plus-menu');
const plusBtn = $('plus-btn');
const menuGroup = $('menu-group');
const menuChannel = $('menu-channel');

const appDiv = $('app');
const sidebar = $('sidebar');
const chatList = $('chat-list');
const messagesDiv = $('messages');
const messagesBox = $('messages-box');
const msgInput = $('msg-input');
const sendBtn = $('send-btn');
const chatTitle = $('chat-title');
const chatStatus = $('chat-status');
const chatAvatar = $('chat-avatar');
const searchInput = $('search');
const backBtn = $('back-btn');
const composer = $('composer');

const myAvatar = $('my-avatar');
const myName = $('my-name');
const userInfo = $('user-info');
const chatInfo = $('chat-info');

let currentUser = '';
let isLogin = true;
let activeRoom = null;
let activeContact = null;
let activeType = null; // 'user' | 'group' | 'channel'
let typingTimer;
let selectedMembers = new Set();
let creatingMode = 'group';
let onlineUsers = [];
let allGroups = [];
let allChannels = [];
const msgCache = {};

// === АВТОРИЗАЦИЯ ===
function switchMode() {
  isLogin = !isLogin;
  modalTitle.textContent = isLogin ? 'Вход' : 'Регистрация';
  loginBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  document.querySelector('.toggle').innerHTML = isLogin 
    ? 'Нет аккаунта? <a href="#" id="toggle-link">Зарегистрироваться</a>'
    : 'Есть аккаунт? <a href="#" id="toggle-link">Войти</a>';
  document.getElementById('toggle-link').addEventListener('click', (e) => { e.preventDefault(); switchMode(); });
  loginError.textContent = '';
}

toggleLink.addEventListener('click', (e) => { e.preventDefault(); switchMode(); });

function doAuth() {
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();
  if (!username || !password) { loginError.textContent = 'Заполните поля'; return; }
  
  socket.emit(isLogin ? 'login' : 'register', { username, password }, (res) => {
    if (res.success) {
      currentUser = res.username;
      loginModal.style.display = 'none';
      appDiv.style.display = 'flex';
      myAvatar.textContent = currentUser[0].toUpperCase();
      myName.textContent = currentUser;
      init();
    } else {
      loginError.textContent = res.message;
    }
  });
}

loginBtn.addEventListener('click', doAuth);
[loginUsername, loginPassword].forEach(el => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAuth(); }));

// === ИНИЦИАЛИЗАЦИЯ ===
function init() {
  socket.emit('request online users');
  
  socket.on('online users', (users) => {
    onlineUsers = users;
    renderAll();
  });
  
  socket.on('groups list', (groups) => {
    allGroups = groups;
    renderAll();
  });
  
  socket.on('channels list', (channels) => {
    allChannels = channels;
    renderAll();
  });
  
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', () => socket.emit('request online users'));
  
  // Приём сообщений
  socket.on('chat message', (data) => {
    if (data.user !== currentUser) addMessage(data.user, data.text, data.time);
  });
  
  socket.on('typing', () => { chatStatus.textContent = 'печатает...'; });
  socket.on('stop typing', () => { updateStatus(); });
}

// === РЕНДЕР СПИСКА ЧАТОВ ===
function renderAll() {
  chatList.innerHTML = '';
  
  // Каналы
  allChannels.forEach(ch => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `
      <div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c);">📢</div>
      <div class="info"><div class="name">${ch.name}</div><div class="last">Канал · ${ch.subscribers.length} подписчиков</div></div>
    `;
    div.addEventListener('click', () => openChat(ch.name, ch.room, 'channel'));
    chatList.appendChild(div);
  });
  
  // Группы
  allGroups.forEach(g => {
    if (!g.members.includes(currentUser)) return;
    const online = g.members.filter(m => onlineUsers.includes(m)).length;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `
      <div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d);">${g.name[0].toUpperCase()}</div>
      <div class="info"><div class="name">${g.name}</div><div class="last">${g.members.length} участников · ${online} онлайн</div></div>
    `;
    div.addEventListener('click', () => openChat(g.name, g.room, 'group'));
    chatList.appendChild(div);
  });
  
  // Пользователи
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `
      <div class="avatar">${u[0].toUpperCase()}</div>
      <div class="info"><div class="name">${u}</div><div class="last">Нажмите для чата</div></div>
    `;
    div.addEventListener('click', () => openChat(u, null, 'user'));
    chatList.appendChild(div);
  });
}

// === ОТКРЫТИЕ ЧАТА ===
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
    const ch = allChannels.find(c => c.room === room);
    composer.style.display = (ch && ch.admin === currentUser) ? 'flex' : 'none';
    chatStatus.textContent = 'канал';
  } else if (type === 'group') {
    chatAvatar.textContent = name[0].toUpperCase();
    chatAvatar.style.background = 'linear-gradient(135deg,#4ecdc4,#44a08d)';
    const g = allGroups.find(gr => gr.room === room);
    const online = g ? g.members.filter(m => onlineUsers.includes(m)).length : 0;
    chatStatus.textContent = `${g?.members.length || 0} участников · ${online} онлайн`;
    composer.style.display = 'flex';
  } else {
    chatAvatar.textContent = name[0].toUpperCase();
    chatAvatar.style.background = 'linear-gradient(135deg,#4a9eff,#6c5ce7)';
    chatStatus.textContent = onlineUsers.includes(name) ? 'онлайн' : 'офлайн';
    composer.style.display = 'flex';
  }
  
  socket.emit('join room', { room: activeRoom }, (res) => {
    if (!res || !res.success) console.error('Ошибка входа в комнату');
  });
  
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
  } else chatStatus.textContent = onlineUsers.includes(activeContact) ? 'онлайн' : 'офлайн';
}

// === СООБЩЕНИЯ ===
function addMessage(user, text, time) {
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

function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !activeRoom) return;
  
  socket.emit('chat message', { room: activeRoom, text });
  msgInput.value = '';
  socket.emit('stop typing', { room: activeRoom });
  clearTimeout(typingTimer);
}

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

msgInput.addEventListener('input', () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
});

// === ПЛЮСИК ===
plusBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenu.style.display = plusMenu.style.display === 'block' ? 'none' : 'block';
});

document.addEventListener('click', () => { plusMenu.style.display = 'none'; });

menuGroup.addEventListener('click', (e) => {
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

menuChannel.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenu.style.display = 'none';
  creatingMode = 'channel';
  createTitle.textContent = 'Новый канал';
  membersLabel.style.display = 'none';
  membersList.style.display = 'none';
  entityName.value = '';
  createModal.style.display = 'flex';
});

closeCreate.addEventListener('click', () => { createModal.style.display = 'none'; });

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const div = document.createElement('div');
    div.className = 'member-item';
    if (selectedMembers.has(u)) div.classList.add('selected');
    div.innerHTML = `<div class="avatar">${u[0].toUpperCase()}</div><span class="name">${u}</span><span class="check">✓</span>`;
    div.addEventListener('click', () => {
      if (selectedMembers.has(u)) { selectedMembers.delete(u); div.classList.remove('selected'); }
      else { selectedMembers.add(u); div.classList.add('selected'); }
    });
    membersList.appendChild(div);
  });
}

createBtn.addEventListener('click', () => {
  const name = entityName.value.trim();
  if (!name) return alert('Введите название');
  
  if (creatingMode === 'group') {
    if (selectedMembers.size === 0) return alert('Выберите участников');
    socket.emit('create group', { name, members: Array.from(selectedMembers) }, (res) => {
      if (res.success) { createModal.style.display = 'none'; selectedMembers.clear(); }
      else alert(res.message);
    });
  } else {
    socket.emit('create channel', { name }, (res) => {
      if (res.success) { createModal.style.display = 'none'; }
      else alert(res.message);
    });
  }
});

// === ПРОФИЛЬ ===
userInfo.addEventListener('click', () => showProfile(true));
chatAvatar.addEventListener('click', () => { if (activeType === 'user') showProfile(false); });
chatInfo.addEventListener('click', () => { if (activeType === 'user') showProfile(false); });

function showProfile(isSelf) {
  const name = isSelf ? currentUser : activeContact;
  profileAvatar.textContent = name[0].toUpperCase();
  profileName.textContent = name;
  selfActions.style.display = isSelf ? 'flex' : 'none';
  contactActions.style.display = isSelf ? 'none' : 'block';
  passForm.style.display = 'none';
  profileModal.style.display = 'flex';
}

closeProfile.addEventListener('click', () => { profileModal.style.display = 'none'; });
backBtnProfile.addEventListener('click', () => { profileModal.style.display = 'none'; });

changePassBtn.addEventListener('click', () => { passForm.style.display = 'block'; });
savePassBtn.addEventListener('click', () => {
  const old = oldPass.value;
  const newP = newPass.value;
  if (!old || !newP) { passError.textContent = 'Заполните поля'; return; }
  socket.emit('change password', { oldPassword: old, newPassword: newP }, (res) => {
    passError.textContent = res.message || (res.success ? 'Пароль изменён' : '');
    passError.style.color = res.success ? '#4caf50' : '#ff6b6b';
  });
});

logoutBtn.addEventListener('click', () => {
  socket.emit('logout');
  location.reload();
});

// === ПОИСК ===
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(el => {
    const name = el.querySelector('.name')?.textContent.toLowerCase() || '';
    el.style.display = name.includes(q) ? 'flex' : 'none';
  });
});

// === АДАПТИВ ===
backBtn.addEventListener('click', () => { sidebar.classList.remove('hidden'); });
window.addEventListener('resize', () => {
  if (window.innerWidth > 768) sidebar.classList.remove('hidden');
});
