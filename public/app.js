const socket = io();

// Получение элементов
function g(id) { return document.getElementById(id); }

// Логин
const loginModal = g('login-modal');
const loginUsername = g('login-username');
const loginPassword = g('login-password');
const loginBtn = g('login-btn');
const loginError = g('login-error');
const modalTitle = g('modal-title');
const modalSub = g('modal-sub');
const toggleLink = g('toggle-link');
const toggleText = g('toggle-text');

// Профиль
const profileModal = g('profile-modal');
const profileAvatar = g('profile-avatar');
const profileName = g('profile-name');
const selfActions = g('self-actions');
const contactActions = g('contact-actions');

// Настройки
const settingsModal = g('settings-modal');
const settingsNickname = g('settings-nickname');
const themeGrid = g('theme-grid');

// Создание
const createModal = g('create-modal');
const createTitle = g('create-title');
const entityName = g('entity-name');
const membersLabel = g('members-label');
const membersList = g('members-list');

// Плюс
const plusModal = g('plus-modal');
const menuGroupBtn = g('menu-group-btn');
const menuChannelBtn = g('menu-channel-btn');

// Контекстное меню
const contextMenu = g('context-menu');

// Основное
const appDiv = g('app');
const sidebar = g('sidebar');
const chatList = g('chat-list');
const messagesDiv = g('messages');
const messagesBox = g('messages-box');
const msgInput = g('msg-input');
const chatTitle = g('chat-title');
const chatStatus = g('chat-status');
const chatAvatar = g('chat-avatar');
const composer = g('composer');
const searchInput = g('search');

const replyBar = g('reply-bar');
const replyText = g('reply-text');
const replyCancel = g('reply-cancel');

let currentUser = '';
let isLogin = true;
let activeRoom = null;
let activeContact = null;
let activeType = null;
let selectedMembers = new Set();
let onlineUsers = [];
let allGroups = [];
let allChannels = [];
const msgCache = {};
let contextTarget = null;
let replyTo = null;

// Темы
const themes = {
  'blue-dark': '#0a0a0f',
  'green-dark': '#0a0f0a',
  'purple-dark': '#0f0a15',
  'sunset': '#1a0a0a',
  'ocean': '#0a1a1a'
};

let currentTheme = localStorage.getItem('theme') || 'blue-dark';
document.body.style.background = themes[currentTheme];

// АВТОРИЗАЦИЯ
toggleLink.onclick = function(e) {
  e.preventDefault();
  isLogin = !isLogin;
  modalTitle.textContent = isLogin ? 'Вход' : 'Регистрация';
  modalSub.textContent = isLogin ? 'Войдите в аккаунт' : 'Создайте аккаунт';
  loginBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  toggleText.innerHTML = isLogin ? 'Нет аккаунта? <a href="#" id="toggle-link">Зарегистрироваться</a>' : 'Есть аккаунт? <a href="#" id="toggle-link">Войти</a>';
  g('toggle-link').onclick = toggleLink.onclick;
};

loginBtn.onclick = function() {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();
  if (!u || !p) { loginError.textContent = 'Заполните поля'; return; }
  socket.emit(isLogin ? 'login' : 'register', { username: u, password: p }, function(res) {
    if (res.success) {
      currentUser = res.username;
      loginModal.style.display = 'none';
      appDiv.style.display = 'flex';
      g('my-avatar').textContent = currentUser[0].toUpperCase();
      g('my-name').textContent = currentUser;
      init();
    } else {
      loginError.textContent = res.message;
    }
  });
};

// ИНИЦИАЛИЗАЦИЯ
function init() {
  socket.emit('request online users');
  
  socket.on('online users', function(users) {
    onlineUsers = users;
    renderChats();
  });
  
  socket.on('groups list', function(groups) {
    allGroups = groups;
    renderChats();
  });
  
  socket.on('channels list', function(channels) {
    allChannels = channels;
    renderChats();
  });
  
  socket.on('chat message', function(data) {
    addMessage(data.user, data.text, data.time, data.id, data.replyTo);
    msgCache[activeRoom] = messagesDiv.innerHTML;
  });
  
  socket.on('delete message', function(data) {
    const el = document.querySelector('[data-id="' + data.id + '"]');
    if (el) { el.innerHTML = '<em style="color:gray">Удалено</em>'; }
  });
  
  socket.on('reaction', function(data) {
    const el = document.querySelector('[data-id="' + data.id + '"]');
    if (el) {
      let r = el.querySelector('.reactions');
      if (!r) { r = document.createElement('div'); r.className = 'reactions'; el.appendChild(r); }
      const ex = r.querySelector('[data-emoji="' + data.emoji + '"]');
      if (ex) { ex.textContent = data.emoji + ' ' + (parseInt(ex.dataset.count)+1); ex.dataset.count = parseInt(ex.dataset.count)+1; }
      else { const s = document.createElement('span'); s.className = 'reaction-badge'; s.textContent = data.emoji + ' 1'; s.dataset.emoji = data.emoji; s.dataset.count = '1'; r.appendChild(s); }
    }
  });
  
  socket.on('typing', function() { chatStatus.textContent = 'печатает...'; });
  socket.on('stop typing', function() {
    if (activeType === 'channel') chatStatus.textContent = 'канал';
    else if (activeType === 'group') chatStatus.textContent = 'группа';
    else chatStatus.textContent = onlineUsers.includes(activeContact) ? 'онлайн' : 'офлайн';
  });
}

// РЕНДЕР ЧАТОВ
function renderChats() {
  chatList.innerHTML = '';
  
  allChannels.forEach(function(ch) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = '<div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📢</div><div class="info"><div class="name">'+ch.name+'</div><div class="last">Канал</div></div>';
    div.onclick = function() { openChat(ch.name, ch.room, 'channel'); };
    chatList.appendChild(div);
  });
  
  allGroups.forEach(function(g) {
    if (!g.members.includes(currentUser)) return;
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = '<div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d)">'+g.name[0]+'</div><div class="info"><div class="name">'+g.name+'</div><div class="last">Группа</div></div>';
    div.onclick = function() { openChat(g.name, g.room, 'group'); };
    chatList.appendChild(div);
  });
  
  onlineUsers.filter(function(u) { return u !== currentUser; }).forEach(function(u) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = '<div class="avatar">'+u[0].toUpperCase()+'</div><div class="info"><div class="name">'+u+'</div><div class="last">В сети</div></div>';
    div.onclick = function() { openChat(u, null, 'user'); };
    chatList.appendChild(div);
  });
}

// ОТКРЫТИЕ ЧАТА
function openChat(name, room, type) {
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    msgCache[activeRoom] = messagesDiv.innerHTML;
  }
  activeContact = name;
  activeType = type;
  activeRoom = room || [currentUser, name].sort().join(':');
  chatTitle.textContent = name;
  messagesDiv.innerHTML = msgCache[activeRoom] || '';
  chatAvatar.textContent = type === 'channel' ? '📢' : name[0].toUpperCase();
  composer.style.display = 'flex';
  socket.emit('join room', { room: activeRoom });
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// ДОБАВЛЕНИЕ СООБЩЕНИЯ
function addMessage(user, text, time, id, replyData) {
  const div = document.createElement('div');
  div.className = 'msg ' + (user === currentUser ? 'own' : 'other');
  div.dataset.user = user;
  div.dataset.id = id || Date.now().toString();
  
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let replyHTML = '';
  if (replyData && replyData.user) {
    replyHTML = '<div class="reply-preview">↩ ' + replyData.user + ': ' + (replyData.text||'').substring(0,30) + '</div>';
  }
  
  if (activeType === 'group' || activeType === 'channel') {
    div.innerHTML = replyHTML + '<div class="sender">' + user + '</div>' + safe + '<div class="time">' + time + '</div>';
  } else {
    div.innerHTML = replyHTML + safe + '<div class="time">' + time + '</div>';
  }
  
  div.oncontextmenu = function(e) {
    e.preventDefault();
    contextTarget = div;
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
  };
  
  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// ОТПРАВКА
function sendMsg() {
  const text = msgInput.value.trim();
  if (!text || !activeRoom) return;
  socket.emit('chat message', {
    room: activeRoom,
    text: text,
    id: Date.now().toString(),
    replyTo: replyTo
  });
  msgInput.value = '';
  replyTo = null;
  replyBar.style.display = 'none';
}

g('send-btn').onclick = sendMsg;
msgInput.onkeydown = function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMsg();
  }
};

// КОНТЕКСТНОЕ МЕНЮ
document.onclick = function(e) {
  if (!contextMenu.contains(e.target)) {
    contextMenu.style.display = 'none';
  }
};

g('context-copy').onclick = function() {
  if (contextTarget) {
    const text = contextTarget.textContent.replace(/↩.*\n?/, '').trim();
    navigator.clipboard.writeText(text);
  }
  contextMenu.style.display = 'none';
};

g('context-reply').onclick = function() {
  if (contextTarget) {
    replyTo = {
      id: contextTarget.dataset.id,
      user: contextTarget.dataset.user,
      text: contextTarget.textContent.substring(0, 30)
    };
    replyText.textContent = replyTo.user + ': ' + replyTo.text;
    replyBar.style.display = 'flex';
    msgInput.focus();
  }
  contextMenu.style.display = 'none';
};

g('context-delete').onclick = function() {
  if (contextTarget && contextTarget.dataset.user === currentUser) {
    socket.emit('delete message', { room: activeRoom, id: contextTarget.dataset.id });
  }
  contextMenu.style.display = 'none';
};

g('context-reactions').onclick = function() {
  if (contextTarget) {
    const picker = g('reactions-picker');
    picker.innerHTML = '';
    ['❤️','👍','😢','😂','🔥','😮','👏','🎉'].forEach(function(emoji) {
      const span = document.createElement('span');
      span.className = 'reaction-emoji';
      span.textContent = emoji;
      span.onclick = function() {
        socket.emit('reaction', { room: activeRoom, id: contextTarget.dataset.id, emoji: emoji });
        picker.style.display = 'none';
        contextMenu.style.display = 'none';
      };
      picker.appendChild(span);
    });
    const rect = contextMenu.getBoundingClientRect();
    picker.style.display = 'flex';
    picker.style.left = rect.left + 'px';
    picker.style.top = (rect.top - 60) + 'px';
  }
};

replyCancel.onclick = function() {
  replyTo = null;
  replyBar.style.display = 'none';
};

// ПЛЮС
g('plus-btn').onclick = function() { plusModal.style.display = 'flex'; };
plusModal.onclick = function(e) { if (e.target === plusModal) plusModal.style.display = 'none'; };

menuGroupBtn.onclick = function() {
  plusModal.style.display = 'none';
  createTitle.textContent = 'Новая группа';
  membersLabel.style.display = 'block';
  membersList.style.display = 'block';
  entityName.value = '';
  selectedMembers.clear();
  renderMembers();
  createModal.style.display = 'flex';
};

menuChannelBtn.onclick = function() {
  plusModal.style.display = 'none';
  createTitle.textContent = 'Новый канал';
  membersLabel.style.display = 'none';
  membersList.style.display = 'none';
  entityName.value = '';
  createModal.style.display = 'flex';
};

g('close-create').onclick = function() { createModal.style.display = 'none'; };

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(function(u) { return u !== currentUser; }).forEach(function(u) {
    const div = document.createElement('div');
    div.className = 'member-item';
    if (selectedMembers.has(u)) div.classList.add('selected');
    div.innerHTML = '<div class="avatar-sm">'+u[0]+'</div><span>'+u+'</span><span class="check">✓</span>';
    div.onclick = function() {
      if (selectedMembers.has(u)) { selectedMembers.delete(u); div.classList.remove('selected'); }
      else { selectedMembers.add(u); div.classList.add('selected'); }
    };
    membersList.appendChild(div);
  });
}

g('create-btn').onclick = function() {
  const name = entityName.value.trim();
  if (!name) return;
  if (createTitle.textContent.includes('группа')) {
    if (selectedMembers.size === 0) return;
    socket.emit('create group', { name: name, members: Array.from(selectedMembers) }, function() {
      createModal.style.display = 'none';
    });
  } else {
    socket.emit('create channel', { name: name }, function() {
      createModal.style.display = 'none';
    });
  }
};

// НАСТРОЙКИ
g('settings-btn').onclick = function() {
  settingsNickname.value = currentUser;
  renderThemeGrid();
  settingsModal.style.display = 'flex';
};

g('close-settings').onclick = function() { settingsModal.style.display = 'none'; };

function renderThemeGrid() {
  themeGrid.innerHTML = '';
  Object.entries(themes).forEach(function(arr) {
    const key = arr[0];
    const color = arr[1];
    const div = document.createElement('div');
    div.className = 'theme-item';
    if (key === currentTheme) div.classList.add('active');
    div.style.background = color;
    div.onclick = function() {
      currentTheme = key;
      localStorage.setItem('theme', key);
      document.body.style.background = color;
      renderThemeGrid();
    };
    themeGrid.appendChild(div);
  });
}

g('save-settings-btn').onclick = function() {
  const nick = settingsNickname.value.trim();
  if (nick && nick !== currentUser) {
    socket.emit('change username', { oldUsername: currentUser, newUsername: nick }, function(res) {
      if (res.success) {
        currentUser = nick;
        g('my-name').textContent = nick;
        g('my-avatar').textContent = nick[0].toUpperCase();
      }
    });
  }
  setTimeout(function() { settingsModal.style.display = 'none'; }, 300);
};

// ПРОФИЛЬ
g('user-info').onclick = function() { showProfile(true); };
chatAvatar.onclick = function() { if (activeType === 'user') showProfile(false); };
g('chat-info').onclick = function() { if (activeType === 'user') showProfile(false); };

function showProfile(isSelf) {
  profileAvatar.textContent = (isSelf ? currentUser : activeContact)[0].toUpperCase();
  profileName.textContent = isSelf ? currentUser : activeContact;
  selfActions.style.display = isSelf ? 'flex' : 'none';
  contactActions.style.display = isSelf ? 'none' : 'block';
  profileModal.style.display = 'flex';
}

g('close-profile').onclick = function() { profileModal.style.display = 'none'; };
g('back-btn-profile').onclick = function() { profileModal.style.display = 'none'; };
g('logout-btn').onclick = function() { socket.emit('logout'); location.reload(); };

// ПОИСК
searchInput.oninput = function() {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(function(el) {
    const name = el.querySelector('.name');
    el.style.display = name && name.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
  });
};

// АДАПТИВ
g('back-btn').onclick = function() { sidebar.classList.remove('hidden'); };
