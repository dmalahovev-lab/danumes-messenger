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

const settingsModal = $('settings-modal');
const settingsNickname = $('settings-nickname');
const themeGrid = $('theme-grid');
const settingsOldPass = $('settings-old-pass');
const settingsNewPass = $('settings-new-pass');

const createModal = $('create-modal');
const createTitle = $('create-title');
const entityName = $('entity-name');
const membersLabel = $('members-label');
const membersList = $('members-list');

const plusModal = $('plus-modal');
const menuGroupBtn = $('menu-group-btn');
const menuChannelBtn = $('menu-channel-btn');

const contextMenu = $('context-menu');

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

const replyBar = $('reply-bar');
const replyText = $('reply-text');
const replyCancel = $('reply-cancel');

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
let replyTo = null;

// ========== ТЕМЫ ==========
const themes = {
  'blue-dark':   { bg:'#0a0a0f', accent:'#4a9eff', gradient:'radial-gradient(ellipse at 30% 20%, rgba(74,158,255,0.08) 0%, transparent 60%), #0a0a0f' },
  'green-dark':  { bg:'#0a0f0a', accent:'#4caf50', gradient:'radial-gradient(ellipse at 30% 20%, rgba(76,175,80,0.08) 0%, transparent 60%), #0a0f0a' },
  'purple-dark': { bg:'#0f0a15', accent:'#9c27b0', gradient:'radial-gradient(ellipse at 30% 20%, rgba(156,39,176,0.08) 0%, transparent 60%), #0f0a15' },
  'sunset':      { bg:'#1a0a0a', accent:'#ff6b35', gradient:'radial-gradient(ellipse at 30% 20%, rgba(255,107,53,0.1) 0%, transparent 60%), #1a0a0a' },
  'ocean':       { bg:'#0a1a1a', accent:'#00bcd4', gradient:'radial-gradient(ellipse at 30% 20%, rgba(0,188,212,0.08) 0%, transparent 60%), #0a1a1a' }
};
let currentTheme = localStorage.getItem('theme') || 'blue-dark';
applyTheme(currentTheme);

function applyTheme(name) {
  const t = themes[name];
  if (!t) return;
  currentTheme = name;
  localStorage.setItem('theme', name);
  document.documentElement.style.setProperty('--bg', t.bg);
  document.documentElement.style.setProperty('--accent', t.accent);
  document.querySelector('.app-bg').style.background = t.gradient;
  const plusBtn = $('plus-btn');
  if (plusBtn) {
    plusBtn.style.background = t.accent + '22';
    plusBtn.style.borderColor = t.accent + '44';
    plusBtn.style.color = t.accent;
  }
}

// ========== АВТОРИЗАЦИЯ ==========
function switchMode() {
  isLogin = !isLogin;
  modalTitle.textContent = isLogin ? 'Вход' : 'Регистрация';
  modalSub.textContent = isLogin ? 'Войдите в аккаунт' : 'Создайте аккаунт';
  loginBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  toggleText.innerHTML = isLogin ? 'Нет аккаунта? <a href="#" id="toggle-link">Зарегистрироваться</a>' : 'Есть аккаунт? <a href="#" id="toggle-link">Войти</a>';
  document.getElementById('toggle-link').onclick = (e) => { e.preventDefault(); switchMode(); };
  loginError.textContent = '';
}
toggleLink.onclick = (e) => { e.preventDefault(); switchMode(); };

loginBtn.onclick = () => {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();
  if (!u || !p) { loginError.textContent = 'Заполните все поля'; return; }
  socket.emit(isLogin ? 'login' : 'register', { username: u, password: p }, (res) => {
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
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initApp() {
  socket.emit('request online users');

  socket.on('online users', (users) => {
    onlineUsers = users;
    renderChats();
  });

  socket.on('groups list', (groups) => {
    allGroups = groups;
    renderChats();
  });

  socket.on('channels list', (channels) => {
    allChannels = channels;
    renderChats();
  });

 // ВАЖНО: принимаем ВСЕ сообщения без фильтрации (как раньше)
socket.on('chat message', (data) => {
  addMsg(data.user, data.text, data.time, data.id, data.replyTo);
  // Сохраняем в кеш ВСЕГДА для комнаты, к которой относится сообщение
  if (data.room) {
    if (!msgCache[data.room]) msgCache[data.room] = '';
    msgCache[data.room] += messagesDiv.innerHTML; // временно добавим, потом перезапишем при открытии
  }
});

  socket.on('delete message', (data) => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) { el.innerHTML = '<em style="color:gray">Удалено</em>'; }
    if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
  });

  socket.on('reaction', (data) => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) {
      let r = el.querySelector('.reactions');
      if (!r) { r = document.createElement('div'); r.className = 'reactions'; el.appendChild(r); }
      const ex = r.querySelector(`[data-emoji="${data.emoji}"]`);
      if (ex) { ex.textContent = data.emoji + ' ' + (parseInt(ex.dataset.count)+1); ex.dataset.count = parseInt(ex.dataset.count)+1; }
      else { const s = document.createElement('span'); s.className = 'reaction-badge'; s.textContent = data.emoji + ' 1'; s.dataset.emoji = data.emoji; s.dataset.count = '1'; r.appendChild(s); }
    }
  });

  socket.on('typing', () => { chatStatus.textContent = 'печатает...'; });
  socket.on('stop typing', () => {
    chatStatus.textContent = (activeType === 'channel') ? 'канал' : (activeType === 'group') ? 'группа' : (onlineUsers.includes(activeContact) ? 'онлайн' : 'офлайн');
  });
}

// ========== РЕНДЕР ==========
function renderChats() {
  chatList.innerHTML = '';
  allChannels.forEach((ch) => {
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📢</div><div class="info"><div class="name">${ch.name}</div><div class="last">Канал</div></div>`;
    div.onclick = () => openChat(ch.name, ch.room, 'channel');
    chatList.appendChild(div);
  });
  allGroups.forEach((g) => {
    if (!g.members.includes(currentUser)) return;
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d)">${g.name[0]}</div><div class="info"><div class="name">${g.name}</div><div class="last">Группа</div></div>`;
    div.onclick = () => openChat(g.name, g.room, 'group');
    chatList.appendChild(div);
  });
  onlineUsers.filter(u => u !== currentUser).forEach((u) => {
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar">${u[0].toUpperCase()}</div><div class="info"><div class="name">${u}</div><div class="last">В сети</div></div>`;
    div.onclick = () => openChat(u, null, 'user');
    chatList.appendChild(div);
  });
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(name, room, type) {
  // Сохраняем текущий чат
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    msgCache[activeRoom] = messagesDiv.innerHTML;
  }

  activeContact = name;
  activeType = type;
  activeRoom = room || [currentUser, name].sort().join(':');

  chatTitle.textContent = name;
  messagesDiv.innerHTML = msgCache[activeRoom] || '';
  chatAvatar.textContent = (type === 'channel') ? '📢' : name[0].toUpperCase();

  // Показываем поле ввода только если админ в канале, иначе скрываем
  if (type === 'channel') {
    const channel = allChannels.find(c => c.room === room);
    composer.style.display = (channel && channel.admin === currentUser) ? 'flex' : 'none';
  } else {
    composer.style.display = 'flex';
  }

  socket.emit('join room', { room: activeRoom });
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// ========== СООБЩЕНИЯ ==========
function addMsg(user, text, time, id, replyData) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  div.dataset.user = user;
  div.dataset.id = id || Date.now().toString();
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let replyHTML = '';
  if (replyData && replyData.user) {
    replyHTML = `<div class="reply-preview">↩ ${replyData.user}: ${(replyData.text||'').substring(0,30)}</div>`;
  }
  div.innerHTML = (activeType === 'group' || activeType === 'channel')
    ? `${replyHTML}<div class="sender">${user}</div>${safe}<div class="time">${time}</div>`
    : `${replyHTML}${safe}<div class="time">${time}</div>`;

  // Контекстное меню (ПКМ)
  div.oncontextmenu = (e) => {
    e.preventDefault();
    contextTarget = div;
    contextMenu.style.display = 'block';
    if (div.classList.contains('own')) {
      contextMenu.style.left = (e.pageX - 200) + 'px';
    } else {
      contextMenu.style.left = e.pageX + 'px';
    }
    contextMenu.style.top = e.pageY + 'px';
  };

  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

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
  socket.emit('stop typing', { room: activeRoom });
  clearTimeout(typingTimer);
  msgInput.focus();
}

$('send-btn').onclick = sendMsg;
msgInput.onkeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
};

// Индикатор печати
msgInput.oninput = () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
};

// ========== КОНТЕКСТНОЕ МЕНЮ ==========
document.onclick = (e) => {
  if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
};

$('context-copy').onclick = () => {
  if (contextTarget) navigator.clipboard.writeText(contextTarget.textContent.replace(/↩.*\n?/, '').trim());
  contextMenu.style.display = 'none';
};

$('context-reply').onclick = () => {
  if (contextTarget) {
    replyTo = {
      id: contextTarget.dataset.id,
      user: contextTarget.dataset.user,
      text: contextTarget.textContent.substring(0, 30)
    };
    replyText.textContent = `${replyTo.user}: ${replyTo.text}`;
    replyBar.style.display = 'flex';
    msgInput.focus();
  }
  contextMenu.style.display = 'none';
};

$('context-delete').onclick = () => {
  if (contextTarget && contextTarget.dataset.user === currentUser) {
    socket.emit('delete message', { room: activeRoom, id: contextTarget.dataset.id });
  }
  contextMenu.style.display = 'none';
};

$('context-reactions').onclick = () => {
  if (contextTarget) {
    const picker = $('reactions-picker');
    picker.innerHTML = '';
    ['❤️','👍','😢','😂','🔥','😮','👏','🎉'].forEach((emoji) => {
      const span = document.createElement('span');
      span.className = 'reaction-emoji';
      span.textContent = emoji;
      span.onclick = () => {
        socket.emit('reaction', { room: activeRoom, id: contextTarget.dataset.id, emoji });
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

replyCancel.onclick = () => {
  replyTo = null;
  replyBar.style.display = 'none';
};

// ========== ПЛЮС ==========
$('plus-btn').onclick = () => { plusModal.style.display = 'flex'; };
$('close-plus').onclick = () => { plusModal.style.display = 'none'; };
plusModal.onclick = (e) => { if (e.target === plusModal) plusModal.style.display = 'none'; };

menuGroupBtn.onclick = () => {
  plusModal.style.display = 'none';
  creatingMode = 'group';
  createTitle.textContent = 'Новая группа';
  membersLabel.style.display = 'block';
  membersList.style.display = 'block';
  entityName.value = '';
  selectedMembers.clear();
  renderMembers();
  createModal.style.display = 'flex';
};

menuChannelBtn.onclick = () => {
  plusModal.style.display = 'none';
  creatingMode = 'channel';
  createTitle.textContent = 'Новый канал';
  membersLabel.style.display = 'none';
  membersList.style.display = 'none';
  entityName.value = '';
  createModal.style.display = 'flex';
};

$('close-create').onclick = () => { createModal.style.display = 'none'; };

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(u => u !== currentUser).forEach((u) => {
    const div = document.createElement('div'); div.className = 'member-item';
    if (selectedMembers.has(u)) div.classList.add('selected');
    div.innerHTML = `<div class="avatar-sm">${u[0]}</div><span>${u}</span><span class="check">✓</span>`;
    div.onclick = () => {
      if (selectedMembers.has(u)) { selectedMembers.delete(u); div.classList.remove('selected'); }
      else { selectedMembers.add(u); div.classList.add('selected'); }
    };
    membersList.appendChild(div);
  });
}

$('create-btn').onclick = () => {
  const name = entityName.value.trim();
  if (!name) return;
  if (creatingMode === 'group') {
    if (selectedMembers.size === 0) return;
    socket.emit('create group', { name, members: Array.from(selectedMembers) }, () => { createModal.style.display = 'none'; });
  } else {
    socket.emit('create channel', { name }, () => { createModal.style.display = 'none'; });
  }
};

// ========== НАСТРОЙКИ ==========
$('settings-btn').onclick = () => {
  settingsNickname.value = currentUser;
  settingsOldPass.value = '';
  settingsNewPass.value = '';
  renderThemeGrid();
  settingsModal.style.display = 'flex';
};

$('close-settings').onclick = () => { settingsModal.style.display = 'none'; };

function renderThemeGrid() {
  themeGrid.innerHTML = '';
  Object.entries(themes).forEach(([key, t]) => {
    const div = document.createElement('div'); div.className = 'theme-item';
    if (key === currentTheme) div.classList.add('active');
    div.style.background = t.gradient;
    div.onclick = () => { applyTheme(key); renderThemeGrid(); };
    themeGrid.appendChild(div);
  });
}

$('save-settings-btn').onclick = () => {
  const nick = settingsNickname.value.trim();
  if (nick && nick !== currentUser) {
    socket.emit('change username', { oldUsername: currentUser, newUsername: nick }, (res) => {
      if (res.success) {
        currentUser = nick;
        $('my-name').textContent = nick;
        $('my-avatar').textContent = nick[0].toUpperCase();
      }
    });
  }
  const oldPass = settingsOldPass.value;
  const newPass = settingsNewPass.value;
  if (oldPass && newPass) {
    socket.emit('change password', { oldPassword: oldPass, newPassword: newPass }, (res) => {
      alert(res.success ? 'Пароль изменён' : res.message);
    });
  }
  setTimeout(() => { settingsModal.style.display = 'none'; }, 300);
};

// ========== ПРОФИЛЬ ==========
$('user-info').onclick = () => showProfile(true);
chatAvatar.onclick = () => { if (activeType === 'user') showProfile(false); };
$('chat-info').onclick = () => { if (activeType === 'user') showProfile(false); };

function showProfile(isSelf) {
  profileAvatar.textContent = (isSelf ? currentUser : activeContact)[0].toUpperCase();
  profileName.textContent = isSelf ? currentUser : activeContact;
  selfActions.style.display = isSelf ? 'flex' : 'none';
  contactActions.style.display = isSelf ? 'none' : 'block';
  profileModal.style.display = 'flex';
}

$('close-profile').onclick = () => { profileModal.style.display = 'none'; };
$('back-btn-profile').onclick = () => { profileModal.style.display = 'none'; };
$('logout-btn').onclick = () => { socket.emit('logout'); location.reload(); };

// ========== ПОИСК ==========
searchInput.oninput = () => {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach((el) => {
    const name = el.querySelector('.name');
    el.style.display = name && name.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
  });
};

// ========== АДАПТИВ ==========
$('back-btn').onclick = () => { sidebar.classList.remove('hidden'); };
window.onresize = () => {
  if (window.innerWidth > 768) sidebar.classList.remove('hidden');
};
