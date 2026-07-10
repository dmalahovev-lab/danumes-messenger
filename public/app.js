const socket = io();
const $ = (id) => document.getElementById(id);

// ========== DOM-элементы ==========
const loginModal = $('login-modal');
const loginUsername = $('login-username');
const loginPassword = $('login-password');
const loginBtn = $('login-btn');
const loginError = $('login-error');
const modalTitle = $('modal-title');
const modalSub = $('modal-sub');
const toggleLink = $('toggle-link');
const toggleText = $('toggle-text');

const profileSetupModal = $('profile-setup-modal');
const setupEmojiPicker = $('setup-emoji-picker');
const setupDisplayName = $('setup-display-name');
const setupUsernameAlias = $('setup-username-alias');
const setupEmail = $('setup-email');
const setupGender = $('setup-gender');
const setupBio = $('setup-bio');
const setupSaveBtn = $('setup-save-btn');
let selectedSetupEmoji = '😊';

const profileModal = $('profile-modal');
const profileAvatar = $('profile-avatar');
const profileName = $('profile-name');
const profileDisplayName = $('profile-display-name');
const profileUsernameAlias = $('profile-username-alias');
const profileBio = $('profile-bio');
const profileEmail = $('profile-email');
const profileGender = $('profile-gender');
const profileSearchBtn = $('profile-search-btn');
const selfActions = $('self-actions');
const contactActions = $('contact-actions');

const editModal = $('edit-modal');
const editTextarea = $('edit-textarea');
const editError = $('edit-error');

const settingsModal = $('settings-modal');
const settingsEmojiPicker = $('settings-emoji-picker');
const settingsNickname = $('settings-nickname');
const settingsUsernameAlias = $('settings-username-alias');
const settingsEmail = $('settings-email');
const settingsGender = $('settings-gender');
const settingsBio = $('settings-bio');
const themeGrid = $('theme-grid');
const settingsOldPass = $('settings-old-pass');
const settingsNewPass = $('settings-new-pass');
const settingsPassError = $('settings-pass-error');
const visibilityEmail = $('visibility-email');
const visibilityGender = $('visibility-gender');
const visibilityBio = $('visibility-bio');
let selectedSettingsEmoji = null;

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
const voiceBtn = $('voice-btn');
const videoBtn = $('video-btn');
const chatMenuBtn = $('chat-menu-btn');
const chatMenu = $('chat-menu');
const chatMenuSearch = $('chat-menu-search');

const recordingIndicator = $('recording-indicator');
const recordingTimer = $('recording-timer');

const imageViewer = $('image-viewer');
const imageViewerImg = $('image-viewer-img');
const imageViewerClose = $('image-viewer-close');

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
let currentUserProfile = null;

// Переменные для записи
let mediaRecorder = null;
let audioChunks = [];
let videoChunks = [];
let recordingStream = null;
let recordingStartTime = null;
let recordingInterval = null;
let videoPreviewEl = null;

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

const emojiList = ['😊','😂','❤️','👍','😢','🔥','😮','👏','🎉','😡','🥺','😎','🤔','🙄','😴','🤗','😇','🤩','😈','💀','👻','👽','🤖','🐶','🦊','🐱','🐼','🐨','🦁','🐸'];

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

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function buildEmojiPicker(container, onSelect, currentEmoji) {
  container.innerHTML = '';
  emojiList.forEach(e => {
    const div = document.createElement('div');
    div.className = 'emoji-option';
    if (e === currentEmoji) div.classList.add('selected');
    div.textContent = e;
    div.onclick = () => {
      container.querySelectorAll('.emoji-option').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      onSelect(e);
    };
    container.appendChild(div);
  });
}

function updateLocalProfileUI() {
  if (!currentUserProfile) return;
  const avatar = $('my-avatar');
  avatar.textContent = currentUserProfile.avatar_url || currentUser[0].toUpperCase();
  avatar.style.backgroundImage = '';
  $('my-name').textContent = currentUserProfile.display_name || currentUser;
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
  if (u.length > 15) { loginError.textContent = 'Максимум 15 символов'; return; }
  socket.emit(isLogin ? 'login' : 'register', { username: u, password: p }, (res) => {
    if (res.success) {
      currentUser = res.username;
      loginModal.style.display = 'none';
      appDiv.style.display = 'flex';
      if (isLogin && res.profile) {
        currentUserProfile = res.profile;
        updateLocalProfileUI();
        if (!res.profile.profile_setup_complete) {
          buildEmojiPicker(setupEmojiPicker, (emoji) => { selectedSetupEmoji = emoji; }, '😊');
          profileSetupModal.style.display = 'flex';
        }
      }
      if (!isLogin) {
        currentUserProfile = null;
        buildEmojiPicker(setupEmojiPicker, (emoji) => { selectedSetupEmoji = emoji; }, '😊');
        profileSetupModal.style.display = 'flex';
      }
      initApp();
    } else {
      loginError.textContent = res.message;
    }
  });
};

// ========== ОФОРМЛЕНИЕ ПРОФИЛЯ ==========
setupSaveBtn.onclick = () => {
  const displayName = setupDisplayName.value.trim();
  const alias = setupUsernameAlias.value.trim();
  if (!displayName || !alias) return alert('Никнейм и псевдоним обязательны');
  if (!/^[a-zA-Z0-9_]+$/.test(alias)) return alert('Псевдоним только английские буквы, цифры и _');
  if (alias.length > 20) return alert('Псевдоним не более 20 символов');
  const profileData = {
    display_name: displayName,
    username_alias: alias,
    email: setupEmail.value.trim(),
    gender: setupGender.value,
    bio: setupBio.value.trim(),
    avatar_url: selectedSetupEmoji
  };
  socket.emit('update_profile', profileData, (res) => {
    if (res.success) {
      currentUserProfile = res.profile;
      updateLocalProfileUI();
      profileSetupModal.style.display = 'none';
    } else {
      alert(res.message);
    }
  });
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
function initApp() {
  if ('Notification' in window) Notification.requestPermission();
  socket.emit('request online users');
  socket.emit('request all users');

  socket.on('online users', (users) => { onlineUsers = users; updateStatus(); renderChats(); });
  socket.on('all users', (users) => { allUsers = users; renderChats(); });
  socket.on('groups list', (groups) => { allGroups = groups; renderChats(); });
  socket.on('channels list', (channels) => { allChannels = channels; renderChats(); });

  socket.on('user_profile_updated', (updatedUser) => {
    const idx = allUsers.findIndex(u => u.username === updatedUser.username);
    if (idx !== -1) {
      allUsers[idx].display_name = updatedUser.display_name;
      allUsers[idx].avatar_url = updatedUser.avatar_url;
    }
    renderChats();
  });

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
    if (el) el.remove();
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

// ========== РЕНДЕР ЧАТОВ ==========
function renderChats() {
  chatList.innerHTML = '';
  allChannels.forEach((ch) => {
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#f093fb,#f5576c);font-size:1.2rem;">📢</div><div class="info"><div class="name">${ch.name}</div><div class="last">Канал</div></div>`;
    div.onclick = () => openChat(ch.name, ch.room, 'channel');
    chatList.appendChild(div);
  });
  allGroups.forEach((g) => {
    if (!g.members.includes(currentUser)) return;
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#4ecdc4,#44a08d);font-size:1.2rem;">${g.name[0]}</div><div class="info"><div class="name">${g.name}</div><div class="last">Группа</div></div>`;
    div.onclick = () => openChat(g.name, g.room, 'group');
    chatList.appendChild(div);
  });

  const shownUsers = new Set();
  onlineUsers.forEach(u => { if (u !== currentUser) { shownUsers.add(u); addUserToChatList(u, true); } });
  allUsers.forEach(user => {
    if (user.username !== currentUser && !shownUsers.has(user.username)) {
      addUserToChatList(user.username, false, user.display_name, user.avatar_url);
    }
  });

  function addUserToChatList(username, online, displayName, avatarEmoji) {
    const userData = allUsers.find(u => u.username === username);
    const name = displayName || (userData?.display_name) || username;
    const ava = avatarEmoji || (userData?.avatar_url) || username[0].toUpperCase();
    const div = document.createElement('div'); div.className = 'chat-item';
    div.innerHTML = `<div class="avatar" style="font-size:1.2rem;">${ava}</div><div class="info"><div class="name" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div><div class="last">${online ? 'В сети' : 'Не в сети'}</div></div>`;
    div.onclick = () => openChat(username, null, 'user');
    chatList.appendChild(div);
  }
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openChat(name, room, type) {
  if (activeRoom) socket.emit('leave room', { room: activeRoom });
  activeContact = name; activeType = type;
  activeRoom = room || [currentUser, name].sort().join(':');

  let displayName = name;
  if (type === 'user') {
    const user = allUsers.find(u => u.username === name);
    if (user) displayName = user.display_name || name;
  }
  chatTitle.textContent = displayName;

  messagesDiv.innerHTML = '';
  const userData = allUsers.find(u => u.username === name);
  chatAvatar.textContent = (type === 'channel') ? '📢' : (type === 'group') ? '👥' : (userData?.avatar_url || name[0].toUpperCase());
  chatAvatar.style.background = (type === 'channel') ? 'linear-gradient(135deg,#f093fb,#f5576c)' : (type === 'group') ? 'linear-gradient(135deg,#4ecdc4,#44a08d)' : 'linear-gradient(135deg, var(--accent), #6c5ce7)';
  composer.style.display = (type === 'channel' && allChannels.find(c => c.room === room)?.admin !== currentUser) ? 'none' : 'flex';
  socket.emit('join room', { room: activeRoom });
  updateStatus();
}

// ========== СООБЩЕНИЯ ==========
function addMsg(user, text, time, id, replyData) {
  const div = document.createElement('div');
  div.className = `msg ${user === currentUser ? 'own' : 'other'}`;
  div.dataset.user = user;
  div.dataset.id = id || Date.now().toString();

  let displayText = text;
  if (text.startsWith('[voice]') && text.endsWith('[/voice]')) {
    const url = text.slice(7, -8);
    displayText = `<div class="voice-message-container"><audio controls src="${url}"></audio></div>`;
  } else if (text.startsWith('[video]') && text.endsWith('[/video]')) {
    const url = text.slice(7, -8);
    displayText = `<div class="video-message-container"><video controls src="${url}" style="max-width:250px;border-radius:12px;" playsinline></video></div>`;
  } else if (text.startsWith('[image]') && text.endsWith('[/image]')) {
    const url = text.slice(7, -8);
    displayText = `<img src="${url}" style="max-width:300px;border-radius:12px;cursor:pointer;width:100%;height:auto;" loading="lazy" onclick="openImageViewer('${url}')">`;
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
    contextMenu.style.display = 'block';
    contextMenu.style.left = Math.min(e.pageX, window.innerWidth - 200) + 'px';
    contextMenu.style.top = Math.min(e.pageY, window.innerHeight - 200) + 'px';
  };

  messagesDiv.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

// ========== ПРОСМОТР ИЗОБРАЖЕНИЙ ==========
window.openImageViewer = function(url) {
  imageViewerImg.src = url;
  imageViewer.style.display = 'flex';
};

imageViewerClose.onclick = () => {
  imageViewer.style.display = 'none';
  imageViewerImg.src = '';
};

imageViewer.onclick = (e) => {
  if (e.target === imageViewer) {
    imageViewer.style.display = 'none';
    imageViewerImg.src = '';
  }
};

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

msgInput.oninput = () => {
  if (!activeRoom) return;
  socket.emit('typing', { room: activeRoom });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => socket.emit('stop typing', { room: activeRoom }), 1000);
};

// ========== ЗАГРУЗКА ФАЙЛОВ И ЗАПИСЬ ==========
attachBtn.onclick = () => fileInput.click();
fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { alert('Файл больше 10MB'); return; }

  let prefix = '[image]';
  if (file.type.startsWith('audio/')) prefix = '[voice]';
  else if (file.type.startsWith('video/')) prefix = '[video]';

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
    socket.emit('chat message', { room: activeRoom, text: `${prefix}${publicUrl}[/${prefix.slice(1, -1)}]`, id: Date.now().toString() });
  } catch (err) {
    alert('Ошибка загрузки: ' + err.message);
  }
  fileInput.value = '';
};

// Голосовое сообщение
voiceBtn.addEventListener('mousedown', startVoiceRecording);
voiceBtn.addEventListener('mouseup', stopRecording);
voiceBtn.addEventListener('mouseleave', stopRecording);
voiceBtn.addEventListener('touchstart', startVoiceRecording);
voiceBtn.addEventListener('touchend', stopRecording);

videoBtn.addEventListener('mousedown', startVideoRecording);
videoBtn.addEventListener('mouseup', stopRecording);
videoBtn.addEventListener('mouseleave', stopRecording);
videoBtn.addEventListener('touchstart', startVideoRecording);
videoBtn.addEventListener('touchend', stopRecording);

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    startMediaRecording(stream, 'audio/webm');
  } catch (err) {
    alert('Нет доступа к микрофону');
  }
}

async function startVideoRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
    if (!videoPreviewEl) {
      videoPreviewEl = document.createElement('video');
      videoPreviewEl.style.position = 'fixed';
      videoPreviewEl.style.bottom = '100px';
      videoPreviewEl.style.right = '20px';
      videoPreviewEl.style.width = '150px';
      videoPreviewEl.style.height = '200px';
      videoPreviewEl.style.borderRadius = '12px';
      videoPreviewEl.style.objectFit = 'cover';
      videoPreviewEl.style.zIndex = '9999';
      videoPreviewEl.muted = true;
      videoPreviewEl.autoplay = true;
      document.body.appendChild(videoPreviewEl);
    }
    videoPreviewEl.srcObject = stream;
    startMediaRecording(stream, 'video/webm');
  } catch (err) {
    alert('Нет доступа к камере');
  }
}

function startMediaRecording(stream, mimeType) {
  recordingStream = stream;
  mediaRecorder = new MediaRecorder(stream, { mimeType });
  audioChunks = [];
  videoChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      if (mimeType.startsWith('audio')) audioChunks.push(e.data);
      else videoChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = async () => {
    recordingIndicator.style.display = 'none';
    clearInterval(recordingInterval);

    if (videoPreviewEl) {
      videoPreviewEl.srcObject = null;
      if (videoPreviewEl.parentNode) videoPreviewEl.parentNode.removeChild(videoPreviewEl);
      videoPreviewEl = null;
    }

    const chunks = mimeType.startsWith('audio') ? audioChunks : videoChunks;
    const blob = new Blob(chunks, { type: mimeType });
    const prefix = mimeType.startsWith('audio') ? '[voice]' : '[video]';

    try {
      const ext = mimeType.split('/')[1];
      const fileName = `chat/${Date.now()}_recording.${ext}`;
      const url = `https://pecfhqthefjxfeokyzza.supabase.co/storage/v1/object/chat-images/${fileName}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlY2ZocXRoZWZqeGZlb2t5enphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NjQ0NTYsImV4cCI6MjA5OTE0MDQ1Nn0.TT8fPOoLiVx3GNx5XMtNJtHusefZWQRKM_hDxPJRUO8',
          'x-upsert': 'true'
        },
        body: blob
      });
      if (!response.ok) throw new Error('Upload failed');
      const publicUrl = `https://pecfhqthefjxfeokyzza.supabase.co/storage/v1/object/public/chat-images/${fileName}`;
      socket.emit('chat message', { room: activeRoom, text: `${prefix}${publicUrl}[/${prefix.slice(1, -1)}]`, id: Date.now().toString() });
    } catch (err) {
      alert('Ошибка загрузки записи: ' + err.message);
    }

    recordingStream.getTracks().forEach(track => track.stop());
  };

  mediaRecorder.start();
  recordingStartTime = Date.now();
  recordingIndicator.style.display = 'block';
  recordingInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    recordingTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (elapsed >= 60) stopRecording();
  }, 1000);
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// ========== КОНТЕКСТНОЕ МЕНЮ ==========
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
  if (!chatMenu.contains(e.target) && e.target !== chatMenuBtn) chatMenu.style.display = 'none';
});

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
  if (contextTarget && contextTarget.dataset.user === currentUser) {
    socket.emit('delete message', { room: activeRoom, id: contextTarget.dataset.id });
  }
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

// ========== МЕНЮ ЧАТА ==========
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

// ========== ПЛЮС-МЕНЮ ==========
$('plus-btn').onclick = (e) => { e.stopPropagation(); plusModal.style.display = 'flex'; };
$('close-plus').onclick = () => { plusModal.style.display = 'none'; };
plusModal.onclick = (e) => { if (e.target === plusModal) plusModal.style.display = 'none'; };

menuGroupBtn.onclick = () => {
  plusModal.style.display = 'none'; creatingMode = 'group';
  createTitle.textContent = 'Новая группа'; membersLabel.style.display = 'block'; membersList.style.display = 'block';
  entityName.value = ''; selectedMembers.clear(); renderMembers(); createModal.style.display = 'flex';
};
menuChannelBtn.onclick = () => {
  plusModal.style.display = 'none'; creatingMode = 'channel';
  createTitle.textContent = 'Новый канал'; membersLabel.style.display = 'none'; membersList.style.display = 'none';
  entityName.value = ''; createModal.style.display = 'flex';
};
$('close-create').onclick = () => { createModal.style.display = 'none'; };

function renderMembers() {
  membersList.innerHTML = '';
  onlineUsers.filter(u => u !== currentUser).forEach((u) => {
    const div = document.createElement('div'); div.className = 'member-item';
    if (selectedMembers.has(u)) div.classList.add('selected');
    div.innerHTML = `<div class="avatar-sm">${u[0]}</div><span>${u}</span><span class="check">✓</span>`;
    div.onclick = () => { if (selectedMembers.has(u)) { selectedMembers.delete(u); div.classList.remove('selected'); } else { selectedMembers.add(u); div.classList.add('selected'); } };
    membersList.appendChild(div);
  });
}

$('create-btn').onclick = (e) => {
  e.stopPropagation();
  const btn = $('create-btn');
  if (btn.disabled) return;
  const name = entityName.value.trim();
  if (!name) return;
  btn.disabled = true;

  if (creatingMode === 'group') {
    if (selectedMembers.size === 0) { btn.disabled = false; return; }
    socket.emit('create group', { name, members: Array.from(selectedMembers) }, (res) => {
      btn.disabled = false;
      if (res.success) {
        createModal.style.display = 'none';
        selectedMembers.clear();
      } else {
        alert(res.message);
      }
    });
  } else {
    socket.emit('create channel', { name }, (res) => {
      btn.disabled = false;
      if (res.success) {
        createModal.style.display = 'none';
      } else {
        alert(res.message);
      }
    });
  }
};

// ========== НАСТРОЙКИ ==========
$('settings-btn').onclick = () => {
  if (!currentUserProfile) return;
  settingsNickname.value = currentUserProfile.display_name || '';
  settingsUsernameAlias.value = currentUserProfile.username_alias || '';
  settingsEmail.value = currentUserProfile.email || '';
  settingsGender.value = currentUserProfile.gender || '';
  settingsBio.value = currentUserProfile.bio || '';
  visibilityEmail.checked = currentUserProfile.visibility_email !== false;
  visibilityGender.checked = currentUserProfile.visibility_gender !== false;
  visibilityBio.checked = currentUserProfile.visibility_bio !== false;
  settingsOldPass.value = '';
  settingsNewPass.value = '';
  settingsPassError.textContent = '';
  buildEmojiPicker(settingsEmojiPicker, (emoji) => { selectedSettingsEmoji = emoji; }, currentUserProfile.avatar_url || '😊');
  renderThemeGrid();
  settingsModal.style.display = 'flex';
};
$('close-settings').onclick = () => { settingsModal.style.display = 'none'; };
settingsModal.onclick = (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; };

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
  const displayName = settingsNickname.value.trim();
  const alias = settingsUsernameAlias.value.trim();
  if (!displayName || !alias) return alert('Никнейм и псевдоним обязательны');
  if (!/^[a-zA-Z0-9_]+$/.test(alias)) return alert('Псевдоним только английские буквы, цифры и _');
  const profileData = {
    display_name: displayName,
    username_alias: alias,
    email: settingsEmail.value.trim(),
    gender: settingsGender.value,
    bio: settingsBio.value.trim(),
    avatar_url: selectedSettingsEmoji || currentUserProfile?.avatar_url || '😊',
    visibility_email: visibilityEmail.checked,
    visibility_gender: visibilityGender.checked,
    visibility_bio: visibilityBio.checked
  };
  socket.emit('update_profile', profileData, (res) => {
    if (res.success) {
      currentUserProfile = res.profile;
      updateLocalProfileUI();
      settingsPassError.textContent = 'Сохранено';
      settingsPassError.style.color = '#4caf50';
    } else {
      settingsPassError.textContent = res.message;
      settingsPassError.style.color = '#ff6b6b';
    }
  });
  const oldPass = settingsOldPass.value;
  const newPass = settingsNewPass.value;
  if (oldPass && newPass) {
    socket.emit('change password', { oldPassword: oldPass, newPassword: newPass }, (res) => {
      settingsPassError.textContent = res.success ? 'Пароль изменён' : res.message;
      settingsPassError.style.color = res.success ? '#4caf50' : '#ff6b6b';
    });
  }
  setTimeout(() => { settingsModal.style.display = 'none'; }, 300);
};

// ========== ПРОФИЛЬ ==========
function showProfile(isSelf) {
  if (isSelf) {
    const avatarEmoji = currentUserProfile?.avatar_url || currentUser?.[0]?.toUpperCase() || '?';
    profileAvatar.textContent = avatarEmoji;
    profileAvatar.style.backgroundImage = '';
    profileName.textContent = currentUserProfile?.display_name || currentUser;
    profileDisplayName.textContent = currentUserProfile?.display_name || '';
    profileUsernameAlias.textContent = currentUserProfile?.username_alias || '';
    profileBio.textContent = currentUserProfile?.bio || '';
    profileEmail.textContent = currentUserProfile?.email || '';
    profileGender.textContent = { male: 'Мужской', female: 'Женский', other: 'Другой' }[currentUserProfile?.gender] || '';
    selfActions.style.display = 'flex';
    contactActions.style.display = 'none';
  } else {
    socket.emit('get_user_profile', { username: activeContact }, (res) => {
      if (res.success && res.profile) {
        const p = res.profile;
        profileAvatar.textContent = p.avatar_url || activeContact?.[0]?.toUpperCase() || '?';
        profileAvatar.style.backgroundImage = '';
        profileName.textContent = p.display_name || activeContact;
        profileDisplayName.textContent = p.display_name || '';
        profileUsernameAlias.textContent = p.username_alias || '';
        profileBio.textContent = p.bio || '';
        profileEmail.textContent = p.email || '';
        profileGender.textContent = { male: 'Мужской', female: 'Женский', other: 'Другой' }[p.gender] || '';
      }
    });
    selfActions.style.display = 'none';
    contactActions.style.display = 'block';
  }
  profileModal.style.display = 'flex';
}

$('user-info').onclick = () => showProfile(true);
chatAvatar.onclick = () => { if (activeType === 'user') showProfile(false); };
$('chat-info').onclick = () => { if (activeType === 'user') showProfile(false); };

$('close-profile').onclick = () => { profileModal.style.display = 'none'; };
$('back-btn-profile').onclick = () => { profileModal.style.display = 'none'; };
$('logout-btn').onclick = () => { socket.emit('logout'); location.reload(); };

profileSearchBtn.onclick = () => {
  if (!activeContact) return;
  const term = prompt('Поиск сообщений от ' + activeContact);
  if (!term) return;
  const allMsgs = messagesDiv.querySelectorAll('.msg');
  let found = false;
  allMsgs.forEach(msg => {
    if (msg.dataset.user === activeContact && msg.textContent.toLowerCase().includes(term.toLowerCase())) {
      msg.style.background = 'rgba(255, 255, 0, 0.2)';
      if (!found) { msg.scrollIntoView({ behavior: 'smooth' }); found = true; }
    }
  });
  if (!found) alert('Ничего не найдено');
  setTimeout(() => allMsgs.forEach(m => m.style.background = ''), 3000);
};

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
window.addEventListener('resize', () => { if (window.innerWidth > 768) sidebar.classList.remove('hidden'); });
