const socket = io();

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

// ===== ТЕМЫ =====
const themes = {
  'blue-dark': { name: 'Синяя', bg: '#0a0a0f', accent: '#4a9eff', gradient: 'radial-gradient(ellipse at 20% 15%, rgba(74,158,255,0.06) 0%, transparent 55%), #0a0a0f' },
  'green-dark': { name: 'Зелёная', bg: '#0a0f0a', accent: '#4caf50', gradient: 'radial-gradient(ellipse at 20% 15%, rgba(76,175,80,0.06) 0%, transparent 55%), #0a0f0a' },
  'purple-dark': { name: 'Фиолетовая', bg: '#0f0a15', accent: '#9c27b0', gradient: 'radial-gradient(ellipse at 20% 15%, rgba(156,39,176,0.06) 0%, transparent 55%), #0f0a15' },
  'sunset': { name: 'Закат', bg: '#1a0a0a', accent: '#ff6b35', gradient: 'radial-gradient(ellipse at 20% 15%, rgba(255,107,53,0.08) 0%, transparent 55%), #1a0a0a' },
  'ocean': { name: 'Океан', bg: '#0a1a1a', accent: '#00bcd4', gradient: 'radial-gradient(ellipse at 20% 15%, rgba(0,188,212,0.06) 0%, transparent 55%), #0a1a1a' }
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
}

// ===== АВТОРИЗАЦИЯ =====
function switchMode() {
  isLogin = !isLogin;
  modalTitle.textContent = isLogin ? 'Вход' : 'Регистрация';
  loginBtn.textContent = isLogin ? 'Войти' : 'Зарегистрироваться';
  toggleText.innerHTML = isLogin ? 'Нет аккаунта? <a href="#" id="toggle-link">Зарегистрироваться</a>' : 'Есть аккаунт? <a href="#" id="toggle-link">Войти</a>';
  $('toggle-link').addEventListener('click', e => { e.preventDefault(); switchMode(); });
}

toggleLink.addEventListener('click', e => { e.preventDefault(); switchMode(); });

function doAuth() {
  const u = loginUsername.value.trim();
  const p = loginPassword.value.trim();
  if (!u || !p) return;
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
[loginUsername, loginPassword].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); }));

// ===== ИНИЦИАЛИЗАЦИЯ =====
function initApp() {
  socket.emit('request online users');
  socket.on('online users', users => { onlineUsers = users; renderAll(); });
  socket.on('groups list', groups => { allGroups = groups; renderAll(); });
  socket.on('channels list', channels => { allChannels = channels; renderAll(); });
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', () => socket.emit('request online users'));
  
  socket.on('chat message', data => {
    addMsg(data.user, data.text, data.time, data.id, data.replyTo);
    msgCache[activeRoom] = messagesDiv.innerHTML;
  });
  
  socket.on('delete message', data => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) { el.innerHTML = '<em style="color:gray">Удалено</em>'; el.classList.add('deleted'); }
    msgCache[activeRoom] = messagesDiv.innerHTML;
  });
  
  socket.on('reaction', data => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) {
      let r = el.querySelector('.reactions');
      if (!r) { r = document.createElement('div'); r.className = 'reactions'; el.appendChild(r); }
      const ex = r.querySelector(`[data-emoji="${data.emoji}"]`);
      if (ex) { ex.textContent = data.emoji + ' ' + (parseInt(ex.dataset.count) + 1); ex.dataset.count = parseInt(ex.dataset.count) + 1; }
      else { const s = document.createElement('span'); s.className = 'reaction-badge'; s.textContent = data.emoji + ' 1'; s.dataset.emoji = data.emoji; s.dataset.count = '1'; r.appendChild(s); }
    }
  });
  
  socket.on('typing', () => { chatStatus.textContent = 'печатает...'; });
  socket.on('stop typing', () => updateStatus());
}

// ===== РЕНДЕР =====
function renderAll() {
  chatList.innerHTML = '';
  allChannels.forEach(ch => {
    const d = document.createElement('div'); d.className = 'chat-item';
    d.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c)">📢</div><div class="info"><div class="name">${ch.name}</div><div class="last">Канал</div></div>`;
    d.addEventListener('click', () => openChat(ch.name, ch.room, 'channel'));
    chatList.appendChild(d);
  });
  allGroups.forEach(g => {
    if (!g.members.includes(currentUser)) return;
    const d = document.createElement('div'); d.className = 'chat-item';
    d.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d)">${g.name[0]}</div><div class="info"><div class="name">${g.name}</div><div class="last">Группа</div></div>`;
    d.addEventListener('click', () => openChat(g.name, g.room, 'group'));
    chatList.appendChild(d);
  });
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const d = document.createElement('div'); d.className = 'chat-item';
    d.innerHTML = `<div class="avatar">${u[0].toUpperCase()}</div><div class="info"><div class="name">${u}</div><div class="last">В сети</div></div>`;
    d.addEventListener('click', () => openChat(u, null, 'user'));
    chatList.appendChild(d);
  });
}

function openChat(name, room, type) {
  if (activeRoom) { socket.emit('leave room', { room: activeRoom }); msgCache[activeRoom] = messagesDiv.innerHTML; }
  activeContact = name; activeType = type; activeRoom = room || [currentUser, name].sort().join(':');
  chatTitle.textContent = name;
  messagesDiv.innerHTML = msgCache[activeRoom] || '';
  chatAvatar.textContent = (type === 'channel') ? '📢' : name[0].toUpperCase();
  composer.style.display = (type === 'channel' && allChannels.find(c => c.room === room)?.admin !== currentUser) ? 'none' : 'flex';
  updateStatus();
  socket.emit('join room', { room: activeRoom });
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function updateStatus() {
  if (activeType === 'channel') chatStatus.textContent = 'канал';
  else if (activeType === 'group') chatStatus.textContent = 'группа';
  else chatStatus.textContent = onlineUsers.includes(activeContact) ? 'онлайн' : 'офлайн';
}

// ===== СООБЩЕНИЯ =====
function addMsg(user, text, time, id, replyData) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  div.dataset.user = user;
  div.dataset.id = id || Date.now().toString();
  const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let replyHTML = replyData ? `<div class="reply-preview">↩ ${replyData.user}: ${(replyData.text||'').substring(0,30)}</div>` : '';
  div.innerHTML = (activeType === 'group' || activeType === 'channel') 
    ? `${replyHTML}<div class="sender">${user}</div>${safe}<div class="time">${time}</div>`
    : `${replyHTML}${safe}<div class="time">${time}</div>`;
  
  div.addEventListener('contextmenu', e => {
    e.preventDefault();
    contextTarget = div;
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
  });
  
  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function sendMsg() {
  const text = msgInput.value.trim();
  if (!text || !activeRoom) return;
  socket.emit('chat message', { room: activeRoom, text, id: Date.now().toString(), replyTo });
  msgInput.value = '';
  replyTo = null;
  replyBar.style.display = 'none';
}

$('send-btn').addEventListener('click', sendMsg);
msgInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });

// ===== КОНТЕКСТНОЕ МЕНЮ =====
document.addEventListener('click', () => { contextMenu.style.display = 'none'; });

$('context-copy').addEventListener('click', () => {
  if (contextTarget) navigator.clipboard.writeText(contextTarget.textContent.replace(/↩.*\n?/, '').trim());
  contextMenu.style.display = 'none';
});

$('context-reply').addEventListener('click', () => {
  if (contextTarget) {
    replyTo = { id: contextTarget.dataset.id, user: contextTarget.dataset.user, text: contextTarget.textContent.substring(0, 30) };
    replyText.textContent = `${replyTo.user}: ${replyTo.text}`;
    replyBar.style.display = 'flex';
    msgInput.focus();
  }
  contextMenu.style.display = 'none';
});

$('context-delete').addEventListener('click', () => {
  if (contextTarget && contextTarget.dataset.user === currentUser) {
    socket.emit('delete message', { room: activeRoom, id: contextTarget.dataset.id });
  }
  contextMenu.style.display = 'none';
});

$('context-reactions').addEventListener('click', () => {
  if (contextTarget) {
    const picker = $('reactions-picker');
    picker.innerHTML = '';
    ['❤️','👍','😢','😂','🔥','😮','👏','🎉'].forEach(e => {
      const s = document.createElement('span');
      s.className = 'reaction-emoji';
      s.textContent = e;
      s.addEventListener('click', () => {
        socket.emit('reaction', { room: activeRoom, id: contextTarget.dataset.id, emoji: e });
        picker.style.display = 'none';
        contextMenu.style.display = 'none';
      });
      picker.appendChild(s);
    });
    const r = contextMenu.getBoundingClientRect();
    picker.style.display = 'flex';
    picker.style.left = r.left + 'px';
    picker.style.top = (r.top - 60) + 'px';
  }
});

replyCancel.addEventListener('click', () => { replyTo = null; replyBar.style.display = 'none'; });

// ===== ПЛЮС =====
$('plus-btn').addEventListener('click', () => { plusModal.style.display = 'flex'; });
plusModal.addEventListener('click', e => { if (e.target === plusModal) plusModal.style.display = 'none'; });
menuGroupBtn.addEventListener('click', () => {
  plusModal.style.display = 'none'; creatingMode = 'group';
  createTitle.textContent = 'Новая группа'; membersLabel.style.display = 'block'; membersList.style.display = 'block';
  entityName.value = ''; selectedMembers.clear(); renderMembers(); createModal.style.display = 'flex';
});
menuChannelBtn.addEventListener('click', () => {
  plusModal.style.display = 'none'; creatingMode = 'channel';
  createTitle.textContent = 'Новый канал'; membersLabel.style.display = 'none'; membersList.style.display = 'none';
  entityName.value = ''; createModal.style.display = 'flex';
});
$('close-create').addEventListener('click', () => { createModal.style.display = 'none'; });

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(u => u !== currentUser).forEach(u => {
    const d = document.createElement('div'); d.className = 'member-item';
    if (selectedMembers.has(u)) d.classList.add('selected');
    d.innerHTML = `<div class="avatar-sm">${u[0]}</div><span>${u}</span><span class="check">✓</span>`;
    d.addEventListener('click', () => {
      if (selectedMembers.has(u)) { selectedMembers.delete(u); d.classList.remove('selected'); }
      else { selectedMembers.add(u); d.classList.add('selected'); }
    });
    membersList.appendChild(d);
  });
}

$('create-btn').addEventListener('click', () => {
  const name = entityName.value.trim();
  if (!name) return;
  if (creatingMode === 'group') {
    if (selectedMembers.size === 0) return;
    socket.emit('create group', { name, members: Array.from(selectedMembers) }, () => { createModal.style.display = 'none'; });
  } else {
    socket.emit('create channel', { name }, () => { createModal.style.display = 'none'; });
  }
});

// ===== НАСТРОЙКИ =====
$('settings-btn').addEventListener('click', () => {
  settingsNickname.value = currentUser;
  renderThemeGrid();
  settingsModal.style.display = 'flex';
});
$('close-settings').addEventListener('click', () => { settingsModal.style.display = 'none'; });

function renderThemeGrid() {
  themeGrid.innerHTML = '';
  Object.entries(themes).forEach(([k, t]) => {
    const d = document.createElement('div'); d.className = 'theme-item';
    if (k === currentTheme) d.classList.add('active');
    d.style.background = t.gradient;
    d.addEventListener('click', () => { applyTheme(k); renderThemeGrid(); });
    themeGrid.appendChild(d);
  });
}

$('save-settings-btn').addEventListener('click', () => {
  const nick = settingsNickname.value.trim();
  if (nick && nick !== currentUser) {
    socket.emit('change username', { oldUsername: currentUser, newUsername: nick }, res => {
      if (res.success) { currentUser = nick; $('my-name').textContent = nick; $('my-avatar').textContent = nick[0].toUpperCase(); }
    });
  }
  setTimeout(() => { settingsModal.style.display = 'none'; }, 300);
});

// ===== ПРОФИЛЬ =====
$('user-info').addEventListener('click', () => showProfile(true));
chatAvatar.addEventListener('click', () => { if (activeType === 'user') showProfile(false); });
$('chat-info').addEventListener('click', () => { if (activeType === 'user') showProfile(false); });

function showProfile(isSelf) {
  profileAvatar.textContent = (isSelf ? currentUser : activeContact)[0].toUpperCase();
  profileName.textContent = isSelf ? currentUser : activeContact;
  selfActions.style.display = isSelf ? 'flex' : 'none';
  contactActions.style.display = isSelf ? 'none' : 'block';
  profileModal.style.display = 'flex';
}

$('close-profile').addEventListener('click', () => { profileModal.style.display = 'none'; });
$('back-btn-profile').addEventListener('click', () => { profileModal.style.display = 'none'; });
$('logout-btn').addEventListener('click', () => { socket.emit('logout'); location.reload(); });

// ===== ПОИСК =====
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  document.querySelectorAll('.chat-item').forEach(el => {
    el.style.display = el.querySelector('.name')?.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
  });
});

// ===== АДАПТИВ =====
$('back-btn').addEventListener('click', () => { sidebar.classList.remove('hidden'); });
