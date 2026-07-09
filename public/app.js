const socket = io();
const $ = (id) => document.getElementById(id);

const loginModal = $('login-modal');
const loginUsername = $('login-username');
const loginPassword = $('login-password');
const loginBtn = $('login-btn');
const loginError = $('login-error');
const modalTitle = $('modal-title');
const modalSub = $('modal-sub');
const toggleLink = $('toggle-link');
const toggleText = $('toggle-text');

const profileModal = $('profile-modal');
const profileAvatar = $('profile-avatar');
const profileName = $('profile-name');
const selfActions = $('self-actions');
const contactActions = $('contact-actions');

const editModal = $('edit-modal');
const editTextarea = $('edit-textarea');
const editError = $('edit-error');

const settingsModal = $('settings-modal');
const settingsNickname = $('settings-nickname');
const themeGrid = $('theme-grid');
const settingsOldPass = $('settings-old-pass');
const settingsNewPass = $('settings-new-pass');
const settingsPassError = $('settings-pass-error');

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

const fileInput = $('file-input');
const attachBtn = $('attach-btn');
const chatMenuBtn = $('chat-menu-btn');
const chatMenu = $('chat-menu');
const chatMenuSearch = $('chat-menu-search');

let currentUser = '';
let isLogin = true;
let activeRoom = null;
let activeContact = null;
let activeType = null;
let typingTimer;
let selectedMembers = new Set();
let creatingMode = 'group';
let onlineUsers = [];
let allUsers = [];
let allGroups = [];
let allChannels = [];
let contextTarget = null;
let replyTo = null;

// КОРОТКИЙ ЗВУК
const sounds = {
  message: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gH9/f4B/f3+Af39/gA=='),
};

const themes = {
  'blue-dark': { bg:'#0a0a0f', accent:'#4a9eff', gradient:'radial-gradient(ellipse at 30% 20%, rgba(74,158,255,0.08) 0%, transparent 60%), #0a0a0f' },
  'green-dark': { bg:'#0a0f0a', accent:'#4caf50', gradient:'radial-gradient(ellipse at 30% 20%, rgba(76,175,80,0.08) 0%, transparent 60%), #0a0f0a' },
  'purple-dark': { bg:'#0f0a15', accent:'#9c27b0', gradient:'radial-gradient(ellipse at 30% 20%, rgba(156,39,176,0.08) 0%, transparent 60%), #0f0a15' },
  'sunset': { bg:'#1a0a0a', accent:'#ff6b35', gradient:'radial-gradient(ellipse at 30% 20%, rgba(255,107,53,0.1) 0%, transparent 60%), #1a0a0a' },
  'ocean': { bg:'#0a1a1a', accent:'#00bcd4', gradient:'radial-gradient(ellipse at 30% 20%, rgba(0,188,212,0.08) 0%, transparent 60%), #0a1a1a' },
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

// АВТОРИЗАЦИЯ
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
  if (u.length > 15) { loginError.textContent = 'Максимум 15 символов'; return; }
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

// ИНИЦИАЛИЗАЦИЯ
function initApp() {
  if ('Notification' in window) Notification.requestPermission();
  socket.emit('request online users');
  socket.emit('request all users');

  socket.on('online users', (users) => { onlineUsers = users; updateStatus(); renderChats(); });
  socket.on('all users', (users) => { allUsers = users; renderChats(); });
  socket.on('groups list', (groups) => { allGroups = groups; renderChats(); });
  socket.on('channels list', (channels) => { allChannels = channels; renderChats(); });

  socket.on('chat history', (messages) => {
    messagesDiv.innerHTML = '';
    messages.forEach(msg => addMsg(msg.username, msg.text, msg.time, msg.id, msg.reply_to));
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });

  socket.on('chat message', (data) => {
    addMsg(data.user, data.text, data.time, data.id, data.replyTo);
    if (data.user !== currentUser) {
      sounds.message.play().catch(() => {});
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(`Новое сообщение от ${data.user}`, { body: data.text.substring(0, 100) });
      }
    }
  });

  socket.on('edit message', (data) => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) {
      const safe = data.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const senderEl = el.querySelector('.sender');
      if (senderEl) {
        el.innerHTML = `<div class="sender">${data.user || senderEl.textContent}</div>${safe} <span style="color:gray;font-size:0.7rem;">(ред.)</span>`;
      } else {
        el.innerHTML = `${safe} <span style="color:gray;font-size:0.7rem;">(ред.)</span>`;
      }
    }
  });

  socket.on('delete message', (data) => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) { el.remove(); }
  });

  socket.on('reaction', (data) => {
    const el = document.querySelector(`[data-id="${data.id}"]`);
    if (el) {
      let r = el.querySelector('.reactions');
      if (!r) { r = document.createElement('div'); r.className = 'reactions'; el.appendChild(r); }
      const existing = r.querySelector(`[data-emoji="${data.emoji}"]`);
      if (existing) {
        existing.textContent = data.emoji + ' ' + (parseInt(existing.dataset.count || 1) + 1);
        existing.dataset.count = parseInt(existing.dataset.count || 1) + 1;
      } else {
        const span = document.createElement('span');
        span.className = 'reaction-badge';
        span.textContent = data.emoji + ' 1';
        span.dataset.emoji = data.emoji;
        span.dataset.count = '1';
        r.appendChild(span);
      }
    }
  });

  socket.on('typing', () => { chatStatus.textContent = 'печатает...'; });
  socket.on('stop typing', () => { updateStatus(); });
}

function updateStatus() {
  if (activeType === 'channel') chatStatus.textContent = 'канал';
  else if (activeType === 'group') {
    const g = allGroups.find(gr => gr.room === activeRoom);
    const online = g ? g.members.filter(m => onlineUsers.includes(m)).length : 0;
    chatStatus.textContent = `${g?.members.length || 0} участников · ${online} онлайн`;
  } else if (activeContact) {
    chatStatus.textContent = onlineUsers.includes(activeContact) ? 'онлайн' : 'офлайн';
  }
}

// РЕНДЕР
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

  const shownUsers = new Set();
  onlineUsers.forEach(u => { if (u !== currentUser) { shownUsers.add(u); addUserToChatList(u, true); } });
  allUsers.forEach(u => { if (u !== currentUser && !shownUsers.has(u)) { addUserToChatList(u, false); } });

  function addUserToChatList(u, online) {
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar">${u[0].toUpperCase()}</div><div class="info"><div class="name" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u}</div><div class="last">${online ? 'В сети' : 'Не в сети'}</div></div>`;
    div.onclick = () => { if (u !== currentUser) openChat(u, null, 'user'); };
    chatList.appendChild(div);
  }
}

// ОТКРЫТИЕ ЧАТА
function openChat(name, room, type) {
  if (activeRoom) socket.emit('leave room', { room: activeRoom });
  activeContact = name; activeType = type;
  activeRoom = room || [currentUser, name].sort().join(':');
  chatTitle.textContent = name;
  messagesDiv.innerHTML = '';
  chatAvatar.textContent = (type === 'channel') ? '📢' : (type === 'group') ? '👥' : name[0].toUpperCase();
  chatAvatar.style.background = (type === 'channel') ? 'linear-gradient(135deg,#f093fb,#f5576c)' : (type === 'group') ? 'linear-gradient(135deg,#4ecdc4,#44a08d)' : 'linear-gradient(135deg, var(--accent), #6c5ce7)';
  composer.style.display = (type === 'channel' && allChannels.find(c => c.room === room)?.admin !== currentUser) ? 'none' : 'flex';
  socket.emit('join room', { room: activeRoom });
  updateStatus();
}

// СООБЩЕНИЯ
function addMsg(user, text, time, id, replyData) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  div.dataset.user = user;
  div.dataset.id = id || Date.now().toString();

  let displayText = text;
  if (text.startsWith('[image]') && text.endsWith('[/image]')) {
    const url = text.slice(7, -8);
    displayText = `<img src="${url}" style="max-width:300px;border-radius:12px;cursor:pointer;width:100%;height:auto;" loading="lazy" onclick="window.open('${url}')">`;
  } else {
    displayText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let replyHTML = '';
  if (replyData && replyData.user) {
    replyHTML = `<div class="reply-preview">↩ ${replyData.user}: ${(replyData.text||'').substring(0,30)}</div>`;
  }

  div.innerHTML = (activeType === 'group' || activeType === 'channel')
    ? `${replyHTML}<div class="sender">${user}</div>${displayText}`
    : `${replyHTML}${displayText}`;

  div.oncontextmenu = (e) => {
    e.preventDefault();
    contextTarget = div;
    const editBtn = $('context-edit');
    const deleteBtn = $('context-delete');
    if (editBtn) editBtn.style.display = (user === currentUser) ? 'flex' : 'none';
    if (deleteBtn) deleteBtn.style.display = (user === currentUser) ? 'flex' : 'none';
    contextMenu.style.display = 'block';
    contextMenu.style.left = Math.min(e.pageX, window.innerWidth - 200) + 'px';
    contextMenu.style.top = Math.min(e.pageY, window.innerHeight - 200) + 'px';
  };

  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function sendMsg() {
  const text = msgInput.value.trim();
  if (!text || !activeRoom) return;
  if (activeContact === currentUser) { alert('Нельзя писать самому себе'); return; }
  if (text.length > 2000) { alert('Максимум 2000 символов'); return; }
  socket.emit('chat message', { room: activeRoom, text, id: Date.now().toString(), replyTo });
  msgInput.value = '';
  replyTo = null;
  replyBar.style.display = 'none';
  msgInput.focus();
}

$('send-btn').onclick = sendMsg;
msgInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };

// ФАЙЛЫ
attachBtn.onclick = () => fileInput.click();
fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Файл больше 5MB'); return; }
  try {
    const fileName = `chat/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const url = `https://pecfhqthefjxfeokyzza.supabase.co/storage/v1/object/chat-images/${fileName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY2ZocXRoZWZqeGZlb2t5enphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjQ0NTYsImV4cCI6MjA5OTE0MDQ1Nn0.TT8fPOoLiVx3GNx5XMtNJtHusefZWQRKM_hDxPJRUO8',
        'x-upsert': 'true'
      },
      body: file
    });
    if (!response.ok) throw new Error('Upload failed');
    const publicUrl = `https://pecfhqthefjxfeokyzza.supabase.co/storage/v1/object/public/chat-images/${fileName}`;
    socket.emit('chat message', { room: activeRoom, text: `[image]${publicUrl}[/image]`, id: Date.now().toString() });
  } catch (err) {
    alert('Ошибка загрузки: ' + err.message);
  }
  fileInput.value = '';
};

// КОНТЕКСТНОЕ МЕНЮ
document.onclick = (e) => {
  if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
  if (!chatMenu.contains(e.target) && e.target !== chatMenuBtn) chatMenu.style.display = 'none';
};

$('context-copy').onclick = () => { if (contextTarget) navigator.clipboard.writeText(contextTarget.textContent); contextMenu.style.display = 'none'; };
$('context-reply').onclick = () => {
  if (contextTarget) {
    replyTo = { id: contextTarget.dataset.id, user: contextTarget.dataset.user, text: contextTarget.textContent.substring(0, 30) };
    replyText.textContent = `${replyTo.user}: ${replyTo.text}`;
    replyBar.style.display = 'flex'; msgInput.focus();
  }
  contextMenu.style.display = 'none';
};
$('context-edit').onclick = () => {
  if (contextTarget && contextTarget.dataset.user === currentUser) {
    editTextarea.value = contextTarget.textContent.replace(/↩.*\n?/, '').replace(/\(ред.\)/, '').trim();
    editModal.style.display = 'flex'; editTextarea.focus();
  }
  contextMenu.style.display = 'none';
};
$('cancel-edit-btn').onclick = () => { editModal.style.display = 'none'; };
$('save-edit-btn').onclick = () => {
  const newText = editTextarea.value.trim();
  if (!newText) return;
  socket.emit('edit message', { room: activeRoom, id: contextTarget.dataset.id, text: newText });
  editModal.style.display = 'none';
};
$('context-delete').onclick = () => {
  if (contextTarget && contextTarget.dataset.user === currentUser) socket.emit('delete message', { room: activeRoom, id: contextTarget.dataset.id });
  contextMenu.style.display = 'none';
};
$('context-reactions').onclick = (e) => {
  e.stopPropagation();
  if (contextTarget) {
    const picker = $('reactions-picker'); picker.innerHTML = '';
    ['❤️','👍','😢','😂','🔥','😮','👏','🎉'].forEach((emoji) => {
      const span = document.createElement('span'); span.className = 'reaction-emoji'; span.textContent = emoji;
      span.onclick = () => { socket.emit('reaction', { room: activeRoom, id: contextTarget.dataset.id, emoji }); picker.style.display = 'none'; contextMenu.style.display = 'none'; };
      picker.appendChild(span);
    });
    const rect = contextMenu.getBoundingClientRect();
    picker.style.display = 'flex'; picker.style.left = rect.left + 'px'; picker.style.top = (rect.top - 60) + 'px';
  }
};
replyCancel.onclick = () => { replyTo = null; replyBar.style.display = 'none'; };

// МЕНЮ ЧАТА
chatMenuBtn.onclick = (e) => { e.stopPropagation(); chatMenu.style.display = chatMenu.style.display === 'block' ? 'none' : 'block'; };
chatMenuSearch.onclick = () => {
  chatMenu.style.display = 'none';
  const term = prompt('Поиск по сообщениям:'); if (!term) return;
  const allMsgs = messagesDiv.querySelectorAll('.msg'); let found = false;
  allMsgs.forEach(msg => {
    if (msg.textContent.toLowerCase().includes(term.toLowerCase())) { msg.style.background = 'rgba(255, 255, 0, 0.2)'; if (!found) { msg.scrollIntoView({ behavior: 'smooth', block: 'center' }); found = true; } }
    else { msg.style.background = ''; }
  });
  if (!found) alert('Ничего не найдено');
  setTimeout(() => allMsgs.forEach(msg => msg.style.background = ''), 3000);
};

// ПЛЮС, НАСТРОЙКИ, ПРОФИЛЬ, ПОИСК, АДАПТИВ — оставь без изменений как в предыдущей версии
