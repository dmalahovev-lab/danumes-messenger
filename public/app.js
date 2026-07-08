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
const contextReply = $('context-reply');
const contextReactions = $('context-reactions');

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
const reactionsPicker = $('reactions-picker');
const voiceBtn = $('voice-btn');
const voiceTimer = $('voice-timer');
const recordingIndicator = $('recording-indicator');
const emojiBtn = $('emoji-btn');

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
let mediaRecorder = null;
let audioChunks = [];
let recordingStart = 0;
let recordingInterval = null;

const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gA==');

// ===== ТЕМЫ =====
const themes = {
  'blue-dark': {
    name: 'Синяя', bg: '#0a0a0f', accent: '#4a9eff', accentLight: '#6db3ff',
    glassBg: 'rgba(255, 255, 255, 0.04)', glassBgHover: 'rgba(255, 255, 255, 0.08)',
    glassBgActive: 'rgba(74, 158, 255, 0.15)', glassBorder: 'rgba(255, 255, 255, 0.06)',
    glassBorderHover: 'rgba(255, 255, 255, 0.12)', glassBorderActive: 'rgba(74, 158, 255, 0.4)',
    text: '#ffffff', textSecondary: 'rgba(255, 255, 255, 0.55)', textTertiary: 'rgba(255, 255, 255, 0.35)',
    plusBg: 'rgba(74, 158, 255, 0.15)', plusBorder: 'rgba(74, 158, 255, 0.3)', plusColor: '#4a9eff',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(74, 158, 255, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(120, 80, 255, 0.04) 0%, transparent 55%), #0a0a0f'
  },
  'green-dark': {
    name: 'Зелёная', bg: '#0a0f0a', accent: '#4caf50', accentLight: '#66bb6a',
    glassBg: 'rgba(255, 255, 255, 0.04)', glassBgHover: 'rgba(255, 255, 255, 0.08)',
    glassBgActive: 'rgba(76, 175, 80, 0.15)', glassBorder: 'rgba(255, 255, 255, 0.06)',
    glassBorderHover: 'rgba(255, 255, 255, 0.12)', glassBorderActive: 'rgba(76, 175, 80, 0.4)',
    text: '#ffffff', textSecondary: 'rgba(255, 255, 255, 0.55)', textTertiary: 'rgba(255, 255, 255, 0.35)',
    plusBg: 'rgba(76, 175, 80, 0.15)', plusBorder: 'rgba(76, 175, 80, 0.3)', plusColor: '#4caf50',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(76, 175, 80, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(0, 200, 83, 0.04) 0%, transparent 55%), #0a0f0a'
  },
  'purple-dark': {
    name: 'Фиолетовая', bg: '#0f0a15', accent: '#9c27b0', accentLight: '#ba68c8',
    glassBg: 'rgba(255, 255, 255, 0.04)', glassBgHover: 'rgba(255, 255, 255, 0.08)',
    glassBgActive: 'rgba(156, 39, 176, 0.15)', glassBorder: 'rgba(255, 255, 255, 0.06)',
    glassBorderHover: 'rgba(255, 255, 255, 0.12)', glassBorderActive: 'rgba(156, 39, 176, 0.4)',
    text: '#ffffff', textSecondary: 'rgba(255, 255, 255, 0.55)', textTertiary: 'rgba(255, 255, 255, 0.35)',
    plusBg: 'rgba(156, 39, 176, 0.15)', plusBorder: 'rgba(156, 39, 176, 0.3)', plusColor: '#9c27b0',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(156, 39, 176, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(233, 30, 99, 0.04) 0%, transparent 55%), #0f0a15'
  },
  'sunset': {
    name: 'Закат', bg: '#1a0a0a', accent: '#ff6b35', accentLight: '#ff8a50',
    glassBg: 'rgba(255, 255, 255, 0.04)', glassBgHover: 'rgba(255, 255, 255, 0.08)',
    glassBgActive: 'rgba(255, 107, 53, 0.15)', glassBorder: 'rgba(255, 255, 255, 0.06)',
    glassBorderHover: 'rgba(255, 255, 255, 0.12)', glassBorderActive: 'rgba(255, 107, 53, 0.4)',
    text: '#ffffff', textSecondary: 'rgba(255, 255, 255, 0.55)', textTertiary: 'rgba(255, 255, 255, 0.35)',
    plusBg: 'rgba(255, 107, 53, 0.15)', plusBorder: 'rgba(255, 107, 53, 0.3)', plusColor: '#ff6b35',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(255, 107, 53, 0.08) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(255, 193, 7, 0.06) 0%, transparent 55%), #1a0a0a'
  },
  'ocean': {
    name: 'Океан', bg: '#0a1a1a', accent: '#00bcd4', accentLight: '#26c6da',
    glassBg: 'rgba(255, 255, 255, 0.04)', glassBgHover: 'rgba(255, 255, 255, 0.08)',
    glassBgActive: 'rgba(0, 188, 212, 0.15)', glassBorder: 'rgba(255, 255, 255, 0.06)',
    glassBorderHover: 'rgba(255, 255, 255, 0.12)', glassBorderActive: 'rgba(0, 188, 212, 0.4)',
    text: '#ffffff', textSecondary: 'rgba(255, 255, 255, 0.55)', textTertiary: 'rgba(255, 255, 255, 0.35)',
    plusBg: 'rgba(0, 188, 212, 0.15)', plusBorder: 'rgba(0, 188, 212, 0.3)', plusColor: '#00bcd4',
    gradient: 'radial-gradient(ellipse at 20% 15%, rgba(0, 188, 212, 0.06) 0%, transparent 55%), radial-gradient(ellipse at 80% 85%, rgba(0, 150, 136, 0.04) 0%, transparent 55%), #0a1a1a'
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
  root.style.setProperty('--accent-light', theme.accentLight);
  root.style.setProperty('--glass-bg', theme.glassBg);
  root.style.setProperty('--glass-bg-hover', theme.glassBgHover);
  root.style.setProperty('--glass-bg-active', theme.glassBgActive);
  root.style.setProperty('--glass-border', theme.glassBorder);
  root.style.setProperty('--glass-border-hover', theme.glassBorderHover);
  root.style.setProperty('--glass-border-active', theme.glassBorderActive);
  root.style.setProperty('--text', theme.text);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--text-tertiary', theme.textTertiary);
  const appBg = document.querySelector('.app-bg');
  if (appBg) appBg.style.background = theme.gradient;
  const plusBtn = $('plus-btn');
  if (plusBtn) {
    plusBtn.style.background = theme.plusBg;
    plusBtn.style.borderColor = theme.plusBorder;
    plusBtn.style.color = theme.plusColor;
  }
}

applyTheme(currentTheme);

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
  socket.on('online users', users => { onlineUsers = users; renderAll(); });
  socket.on('groups list', groups => { allGroups = groups; renderAll(); });
  socket.on('channels list', channels => { allChannels = channels; renderAll(); });
  socket.on('user joined', () => socket.emit('request online users'));
  socket.on('user left', () => socket.emit('request online users'));
  
  // ИСПРАВЛЕНО: принимаем сообщения и для текущей комнаты тоже
  socket.on('chat message', data => {
    if (activeRoom) {
      // Проверяем, относится ли сообщение к текущей комнате
      const roomUsers = activeRoom.split(':');
      if (roomUsers.includes(data.user) || activeRoom === data.room || !data.room || data.room === activeRoom) {
        addMsg(data.user, data.text, data.time, data.id, data.replyTo);
        // Сохраняем в кеш
        msgCache[activeRoom] = messagesDiv.innerHTML;
      }
    }
    if (data.user !== currentUser && document.hidden) {
      notificationSound.play().catch(() => {});
    }
    // Подсветка упоминаний
    if (data.text.includes('@' + currentUser) && data.user !== currentUser) {
      const msgEl = messagesDiv.lastChild;
      if (msgEl) msgEl.classList.add('mentioned');
    }
  });
  
  socket.on('delete message', data => {
    const msgElement = document.querySelector(`[data-id="${data.id}"]`);
    if (msgElement) {
      msgElement.innerHTML = '<em style="color: var(--text-tertiary);">Сообщение удалено</em>';
      msgElement.classList.add('deleted');
    }
    if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
  });
  
  socket.on('reaction', data => {
    const msgEl = document.querySelector(`[data-id="${data.id}"]`);
    if (msgEl) {
      let reactionsDiv = msgEl.querySelector('.reactions');
      if (!reactionsDiv) {
        reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'reactions';
        msgEl.appendChild(reactionsDiv);
      }
      const existing = reactionsDiv.querySelector(`[data-emoji="${data.emoji}"]`);
      if (existing) {
        const count = parseInt(existing.dataset.count) + 1;
        existing.textContent = data.emoji + ' ' + count;
        existing.dataset.count = count;
      } else {
        const span = document.createElement('span');
        span.className = 'reaction-badge';
        span.textContent = data.emoji + ' 1';
        span.dataset.emoji = data.emoji;
        span.dataset.count = '1';
        reactionsDiv.appendChild(span);
      }
    }
  });
  
  socket.on('typing', () => { chatStatus.textContent = 'печатает...'; chatStatus.style.color = 'var(--accent)'; });
  socket.on('stop typing', () => { updateStatus(); chatStatus.style.color = ''; });
  
  if (window.innerWidth <= 768) sidebar.classList.add('hidden');
}

// ===== РЕНДЕР =====
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

// ===== ОТКРЫТИЕ ЧАТА (ИСПРАВЛЕНО) =====
function openChat(name, room, type) {
  if (activeRoom) {
    socket.emit('leave room', { room: activeRoom });
    if (messagesDiv.children.length) msgCache[activeRoom] = messagesDiv.innerHTML;
  }
  
  activeContact = name;
  activeType = type;
  activeRoom = room || [currentUser, name].sort().join(':');
  
  chatTitle.textContent = name;
  // ИСПРАВЛЕНО: показываем сохранённые сообщения
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
    chatAvatar.style.background = 'linear-gradient(135deg, var(--accent), #6c5ce7)';
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

// ===== СООБЩЕНИЯ (ИСПРАВЛЕНО) =====
function addMsg(user, text, time, id, replyToData) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  div.dataset.user = user;
  div.dataset.id = id || ('msg_' + Date.now() + '_' + Math.random());
  
  // Проверяем, есть ли аудио
  let content = '';
  if (text.startsWith('[Голосовое сообщение:')) {
    const audioSrc = replyToData; // audio data передаётся в replyTo
    content = `<div class="voice-msg" onclick="this.querySelector('audio').play()">🎤 ${text} <audio src="${audioSrc || ''}" preload="auto"></audio></div>`;
  } else {
    const safe = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const highlighted = safe.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
    content = highlighted;
  }
  
  let replyHTML = '';
  if (replyToData && replyToData.user) {
    replyHTML = `<div class="reply-preview">↩ ${replyToData.user}: ${(replyToData.text || '').substring(0, 50)}</div>`;
  }
  
  if (activeType === 'group' || activeType === 'channel') {
    div.innerHTML = `${replyHTML}<div class="sender">${user}</div>${content}<div class="time">${time}</div>`;
  } else {
    div.innerHTML = `${replyHTML}${content}<div class="time">${time}</div>`;
  }
  
  // Контекстное меню
  div.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextTarget = div;
    // Позиционируем меню
    contextMenu.style.display = 'block';
    contextMenu.style.left = Math.min(e.pageX, window.innerWidth - 200) + 'px';
    contextMenu.style.top = Math.min(e.pageY, window.innerHeight - 150) + 'px';
  });
  
  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
  if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
}

// ===== ОТВЕТ НА СООБЩЕНИЕ (ИСПРАВЛЕНО) =====
function startReply(msgEl) {
  const textEl = msgEl.querySelector('.voice-msg') || msgEl;
  let text = textEl.textContent.replace('🎤 ', '').trim();
  if (text.length > 50) text = text.substring(0, 50) + '...';
  
  replyTo = {
    id: msgEl.dataset.id,
    user: msgEl.dataset.user,
    text: text
  };
  replyText.textContent = `${replyTo.user}: ${text}`;
  replyBar.style.display = 'flex';
  msgInput.focus();
}

replyCancel.addEventListener('click', () => {
  replyTo = null;
  replyBar.style.display = 'none';
});

// ===== ОТПРАВКА =====
function sendMsg() {
  const text = msgInput.value.trim();
  if (!text) return;
  if (!activeRoom) { alert('Сначала выберите чат'); return; }
  
  const msgId = 'msg_' + Date.now() + '_' + Math.random();
  socket.emit('chat message', {
    room: activeRoom,
    text: text,
    id: msgId,
    replyTo: replyTo
  });
  
  msgInput.value = '';
  replyTo = null;
  replyBar.style.display = 'none';
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

// ===== КОНТЕКСТНОЕ МЕНЮ (ИСПРАВЛЕНО) =====
document.addEventListener('click', () => { contextMenu.style.display = 'none'; });

contextCopy.addEventListener('click', () => {
  if (contextTarget) {
    const text = contextTarget.textContent.replace(/↩.*\n?/g, '').replace(/🎤.*/g, '').trim();
    navigator.clipboard.writeText(text);
  }
  contextMenu.style.display = 'none';
});

contextReply.addEventListener('click', () => {
  if (contextTarget) startReply(contextTarget);
  contextMenu.style.display = 'none';
});

contextDelete.addEventListener('click', () => {
  if (contextTarget && activeRoom) {
    const msgId = contextTarget.dataset.id;
    contextTarget.innerHTML = '<em style="color: var(--text-tertiary);">Сообщение удалено</em>';
    contextTarget.classList.add('deleted');
    socket.emit('delete message', { room: activeRoom, id: msgId });
    if (activeRoom) msgCache[activeRoom] = messagesDiv.innerHTML;
  }
  contextMenu.style.display = 'none';
});

contextReactions.addEventListener('click', (e) => {
  e.stopPropagation();
  const rect = contextMenu.getBoundingClientRect();
  showReactionPicker(rect.left, rect.top - 60);
});

// ===== РЕАКЦИИ =====
const emojis = ['❤️', '👍', '😢', '😂', '🔥', '😮', '👏', '🎉'];

function showReactionPicker(x, y, msgId) {
  reactionsPicker.innerHTML = '';
  const targetId = msgId || (contextTarget ? contextTarget.dataset.id : null);
  if (!targetId) return;
  
  emojis.forEach(emoji => {
    const span = document.createElement('span');
    span.className = 'reaction-emoji';
    span.textContent = emoji;
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      socket.emit('reaction', { room: activeRoom, id: targetId, emoji });
      reactionsPicker.style.display = 'none';
      contextMenu.style.display = 'none';
    });
    reactionsPicker.appendChild(span);
  });
  reactionsPicker.style.display = 'flex';
  reactionsPicker.style.left = x + 'px';
  reactionsPicker.style.top = y + 'px';
}

document.addEventListener('click', (e) => {
  if (!reactionsPicker.contains(e.target)) {
    reactionsPicker.style.display = 'none';
  }
});

// ===== ГОЛОСОВЫЕ (ИСПРАВЛЕНО) =====
voiceBtn.addEventListener('mousedown', startRecording);
voiceBtn.addEventListener('mouseup', stopRecording);
voiceBtn.addEventListener('mouseleave', stopRecording);
voiceBtn.addEventListener('touchstart', startRecording);
voiceBtn.addEventListener('touchend', stopRecording);

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    
    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        const duration = Math.round((Date.now() - recordingStart) / 1000);
        socket.emit('chat message', {
          room: activeRoom,
          text: `[Голосовое сообщение: ${duration}с]`,
          id: 'msg_' + Date.now(),
          replyTo: { audio: reader.result }
        });
      };
      reader.readAsDataURL(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    recordingStart = Date.now();
    recordingIndicator.style.display = 'flex';
    recordingInterval = setInterval(() => {
      const seconds = Math.round((Date.now() - recordingStart) / 1000);
      voiceTimer.textContent = seconds + 'с';
    }, 1000);
  } catch (err) {
    alert('Нет доступа к микрофону');
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordingIndicator.style.display = 'none';
    clearInterval(recordingInterval);
  }
}

// ===== ПЛЮС МЕНЮ =====
$('plus-btn').addEventListener('click', () => plusModal.style.display = 'flex');
plusModal.addEventListener('click', (e) => { if (e.target === plusModal) plusModal.style.display = 'none'; });
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
    div.innerHTML = `<div class="avatar-sm" style="background:linear-gradient(135deg, var(--accent), #6c5ce7);">${u[0].toUpperCase()}</div><span class="member-name">${u}</span><span class="check">✓</span>`;
    div.addEventListener('click', () => {
      if (selectedMembers.has(u)) { selectedMembers.delete(u); div.classList.remove('selected'); }
      else { selectedMembers.add(u); div.classList.add('selected'); }
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
      if (res.success) { createModal.style.display = 'none'; selectedMembers.clear(); }
      else alert(res.message);
    });
  } else {
    socket.emit('create channel', { name }, res => {
      if (res.success) createModal.style.display = 'none';
      else alert(res.message);
    });
  }
});

// ===== НАСТРОЙКИ =====
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
$('close-settings').addEventListener('click', () => { settingsModal.style.display = 'none'; });
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; });

$('save-settings-btn').addEventListener('click', () => {
  const newNick = settingsNickname.value.trim();
  const oldPass = settingsOldPass.value;
  const newPass = settingsNewPass.value;
  
  if (newNick && newNick !== currentUser) {
    socket.emit('change username', { oldUsername: currentUser, newUsername: newNick }, res => {
      if (res.success) {
        currentUser = newNick;
        $('my-name').textContent = currentUser;
        $('my-avatar').textContent = currentUser[0].toUpperCase();
        settingsPassError.textContent = 'Никнейм изменён';
        settingsPassError.style.color = '#4caf50';
        socket.emit('request online users');
      } else {
        settingsPassError.textContent = res.message;
        settingsPassError.style.color = '#ff6b6b';
      }
    });
  }
  
  if (oldPass && newPass) {
    socket.emit('change password', { oldPassword: oldPass, newPassword: newPass }, res => {
      if (res.success) {
        settingsPassError.textContent = 'Пароль изменён';
        settingsPassError.style.color = '#4caf50';
      } else {
        settingsPassError.textContent = res.message;
        settingsPassError.style.color = '#ff6b6b';
      }
    });
  }
  
  setTimeout(() => { settingsModal.style.display = 'none'; }, 500);
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
$('logout-btn').addEventListener('click', () => { socket.emit('logout'); location.reload(); });

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
