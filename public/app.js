// ===== СОСТОЯНИЕ =====
let currentUser = null;
let currentChat = null;
let socket = null;
let chats = [];
let messages = {};
let friendsState = {
  friends: [],
  pendingRequests: [],
  sentRequests: [],
  requestCount: 0
};
let emojis = ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😗', '😙',
  '😚', '🥲', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  '🥵', '🥶', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮',
  '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢',
  '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤',
  '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
  '👺', '👻', '👽', '👾', '🤖', '💋', '💌', '💘', '💝', '💖',
  '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛',
  '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫'
];

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  initSocket();
  initEventListeners();
  initEmojiGrid();
  initContextMenu();
  initFriendSocketHandlers();

  // Загружаем друзей
  await loadFriends();

  // Обработчик правого клика
  document.addEventListener('contextmenu', async (e) => {
    const chatItem = e.target.closest('.chat-item');
    if (chatItem && chatItem.dataset.userId) {
      e.preventDefault();
      const userId = chatItem.dataset.userId;
      const username = chatItem.dataset.username || 'Пользователь';
      const nickname = chatItem.dataset.nickname || '';
      const avatar = chatItem.dataset.avatar || '👤';
      showContextMenu(e, userId, username, nickname, avatar);
    }
  });

  // Toggle заявок
  const toggle = document.getElementById('friendRequestsToggle');
  const list = document.getElementById('pendingRequestsList');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      if (list.style.display === 'none' || list.style.display === '') {
        list.style.display = 'block';
        updatePendingRequestsUI();
      } else {
        list.style.display = 'none';
      }
    });
  }
});

// ===== АУТЕНТИФИКАЦИЯ =====
async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    showLogin();
    return;
  }

  try {
    const response = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const user = await response.json();
      currentUser = user;
      showApp();
      await loadChats();
      return;
    }
  } catch (error) {
    console.error('Auth error:', error);
  }

  localStorage.removeItem('token');
  showLogin();
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('app').style.display = 'none';
}

function showRegister() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('registerPage').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateUserProfile();
}

// ===== СОКЕТ =====
function initSocket() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('Socket connected');
    if (currentUser) {
      socket.emit('register', currentUser.id);
    }
  });

  socket.on('new_message', (message) => {
    if (!messages[message.chat_id]) {
      messages[message.chat_id] = [];
    }
    messages[message.chat_id].push(message);
    
    if (currentChat && currentChat.id === message.chat_id) {
      renderMessages();
    }
    
    loadChats();
  });

  socket.on('message_edited', (message) => {
    const chatMessages = messages[message.chat_id];
    if (chatMessages) {
      const index = chatMessages.findIndex(m => m.id === message.id);
      if (index !== -1) {
        chatMessages[index] = message;
        if (currentChat && currentChat.id === message.chat_id) {
          renderMessages();
        }
      }
    }
  });

  socket.on('message_deleted', (messageId) => {
    for (const chatId in messages) {
      const index = messages[chatId].findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages[chatId].splice(index, 1);
        if (currentChat && currentChat.id === chatId) {
          renderMessages();
        }
        break;
      }
    }
    loadChats();
  });

  socket.on('reaction_updated', (data) => {
    for (const chatId in messages) {
      const msg = messages[chatId].find(m => m.id === data.messageId);
      if (msg) {
        msg.reactions = data.reactions;
        if (currentChat && currentChat.id === chatId) {
          renderMessages();
        }
        break;
      }
    }
  });
}

// ===== СОБЫТИЯ =====
function initEventListeners() {
  // Логин
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showApp();
        await loadChats();
        socket.emit('register', currentUser.id);
      } else {
        showToast('❌ ' + data.error);
      }
    } catch (error) {
      showToast('❌ Ошибка входа');
    }
  });

  // Регистрация
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showApp();
        await loadChats();
        socket.emit('register', currentUser.id);
        showToast('✅ Регистрация успешна!');
      } else {
        showToast('❌ ' + data.error);
      }
    } catch (error) {
      showToast('❌ Ошибка регистрации');
    }
  });

  document.getElementById('showRegister').addEventListener('click', showRegister);
  document.getElementById('showLogin').addEventListener('click', showLogin);

  // Выход
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    currentUser = null;
    showLogin();
    if (socket) socket.disconnect();
  });

  // Настройки
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  // Отправка сообщения
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Поиск
  document.getElementById('searchInput').addEventListener('input', searchChats);

  // Эмодзи
  document.getElementById('emojiBtn').addEventListener('click', toggleEmojiPicker);

  // Прикрепление файла
  document.getElementById('attachBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,audio/*,video/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await uploadFile(file);
    };
    input.click();
  });

  // Назад (мобилка)
  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('chatArea').classList.remove('chat-open');
  });

  // Закрытие модалки изображений
  document.getElementById('imageModalClose').addEventListener('click', closeImageModal);
  document.getElementById('imageModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImageModal();
  });

  // Голосовые сообщения
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  document.getElementById('voiceBtn').addEventListener('mousedown', startRecording);
  document.getElementById('voiceBtn').addEventListener('mouseup', stopRecording);
  document.getElementById('voiceBtn').addEventListener('mouseleave', stopRecording);

  async function startRecording() {
    if (!currentChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      isRecording = true;

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if (audioBlob.size > 0) {
          const file = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
          await uploadFile(file);
        }
        stream.getTracks().forEach(track => track.stop());
        isRecording = false;
      };

      mediaRecorder.start();
      document.getElementById('voiceBtn').style.color = '#f44336';
      showToast('🎤 Запись...');
    } catch (error) {
      showToast('❌ Нет доступа к микрофону');
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      document.getElementById('voiceBtn').style.color = '';
    }
  }
}

// ===== ЧАТЫ =====
async function loadChats() {
  try {
    const response = await fetch('/api/chats', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await response.json();
    if (data.success) {
      chats = data.chats;
      renderChats();
    }
  } catch (error) {
    console.error('Error loading chats:', error);
  }
}

function renderChats() {
  const container = document.getElementById('chatList');
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = chats;
  if (search) {
    filtered = chats.filter(chat => {
      if (chat.type === 'personal' && chat.otherUser) {
        const name = chat.otherUser.nickname || chat.otherUser.username;
        return name.toLowerCase().includes(search);
      }
      return chat.name && chat.name.toLowerCase().includes(search);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет чатов</div>';
    return;
  }

  container.innerHTML = filtered.map(chat => {
    let name = chat.name || 'Чат';
    let avatar = '💬';
    let userId = null;
    let username = '';
    let nickname = '';

    if (chat.type === 'personal' && chat.otherUser) {
      name = chat.otherUser.nickname || chat.otherUser.username;
      avatar = chat.otherUser.avatar || '👤';
      userId = chat.otherUser.id;
      username = chat.otherUser.username;
      nickname = chat.otherUser.nickname;
    }

    const lastMsg = chat.messages && chat.messages.length > 0 
      ? chat.messages[chat.messages.length - 1] 
      : null;
    const lastText = lastMsg ? lastMsg.content || (lastMsg.type === 'image' ? '📷 Изображение' : '🎤 Голосовое') : 'Нет сообщений';
    const time = lastMsg ? formatTime(lastMsg.created_at) : '';

    return `
      <div class="chat-item ${currentChat && currentChat.id === chat.id ? 'active' : ''}" 
           data-chat-id="${chat.id}"
           data-user-id="${userId || ''}"
           data-username="${username || ''}"
           data-nickname="${nickname || ''}"
           data-avatar="${avatar}">
        <div class="avatar">${avatar}</div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="last-message">${lastText}</div>
        </div>
        <div class="time">${time}</div>
      </div>
    `;
  }).join('');

  // Обработчики
  container.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.chatId;
      const chat = chats.find(c => c.id === chatId);
      if (chat) openChat(chat);
    });
  });
}

function searchChats() {
  renderChats();
}

async function openChat(chat) {
  currentChat = chat;
  renderChats();

  // На мобилке
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('chatArea').classList.add('chat-open');
  }

  // Загружаем сообщения
  await loadMessages(chat.id);

  // Заголовок
  let name = chat.name || 'Чат';
  let avatar = '💬';
  if (chat.type === 'personal' && chat.otherUser) {
    name = chat.otherUser.nickname || chat.otherUser.username;
    avatar = chat.otherUser.avatar || '👤';
  }

  document.getElementById('chatUserAvatar').textContent = avatar;
  document.getElementById('chatUserName').textContent = name;
  document.getElementById('chatUserStatus').textContent = 'В сети';

  // Вход в комнату
  socket.emit('join_chat', chat.id);
}

async function loadMessages(chatId) {
  try {
    const response = await fetch(`/api/messages/${chatId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await response.json();
    if (data.success) {
      messages[chatId] = data.messages;
      renderMessages();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

function renderMessages() {
  const container = document.getElementById('messages');
  const chatMessages = messages[currentChat?.id] || [];

  if (chatMessages.length === 0) {
    container.innerHTML = '<div class="empty-state">Напишите первое сообщение</div>';
    return;
  }

  container.innerHTML = chatMessages.map(msg => {
    const isSent = msg.sender_id === currentUser.id;
    const senderName = msg.sender?.nickname || msg.sender?.username || 'Пользователь';

    let content = msg.content || '';
    if (msg.type === 'image' && msg.file_url) {
      content = `<img src="${msg.file_url}" class="image-message" onclick="openImageModal('${msg.file_url}')">`;
    } else if (msg.type === 'voice' && msg.file_url) {
      content = `<div class="voice-message">
        <button onclick="playVoice('${msg.file_url}')">▶️</button>
        <span>Голосовое сообщение</span>
      </div>`;
    } else if (msg.type === 'file' && msg.file_url) {
      content = `<div class="file">
        <span>📎</span>
        <a href="${msg.file_url}" target="_blank">Скачать файл</a>
      </div>`;
    }

    // Реакции
    let reactionsHtml = '';
    if (msg.reactions) {
      const reactionGroups = {};
      for (const [userId, reaction] of Object.entries(msg.reactions)) {
        if (!reactionGroups[reaction]) reactionGroups[reaction] = [];
        reactionGroups[reaction].push(userId);
      }

      reactionsHtml = Object.entries(reactionGroups).map(([reaction, users]) => {
        const isActive = users.includes(currentUser.id);
        return `<span class="reaction ${isActive ? 'active' : ''}" 
                     onclick="toggleReaction('${msg.id}', '${reaction}')">
          ${reaction} <span class="count">${users.length}</span>
        </span>`;
      }).join('');
    }

    return `
      <div class="message ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">
        ${!isSent ? `<div class="sender">${senderName}</div>` : ''}
        <div class="content">${content}</div>
        ${reactionsHtml ? `<div class="reactions">${reactionsHtml}</div>` : ''}
        <div class="time">
          ${formatTime(msg.created_at)}
          ${msg.edited ? '<span class="edited">(ред.)</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  // Скролл вниз
  const container2 = document.getElementById('messagesContainer');
  container2.scrollTop = container2.scrollHeight;
}

// ===== СООБЩЕНИЯ =====
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentChat) return;

  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        chatId: currentChat.id,
        content,
        type: 'text'
      })
    });

    const data = await response.json();
    if (data.success) {
      input.value = '';
      // Сообщение добавится через Socket
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function uploadFile(file) {
  if (!currentChat) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    const data = await response.json();
    if (data.success) {
      // Отправляем сообщение с файлом
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('audio/') ? 'voice' : 'file';

      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          chatId: currentChat.id,
          content: file.name,
          type,
          fileUrl: data.fileUrl
        })
      });
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    showToast('❌ Ошибка загрузки файла');
  }
}

// ===== РЕАКЦИИ =====
async function toggleReaction(messageId, reaction) {
  try {
    const response = await fetch(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ reaction })
    });

    const data = await response.json();
    if (data.success) {
      // Обновляем локально
      const chatMessages = messages[currentChat?.id];
      if (chatMessages) {
        const msg = chatMessages.find(m => m.id === messageId);
        if (msg) {
          msg.reactions = data.reactions;
          renderMessages();
        }
      }
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
  }
}

// ===== НАСТРОЙКИ =====
function openSettings() {
  if (!currentUser) return;
  const modal = document.getElementById('settingsModal');
  modal.style.display = 'flex';

  document.getElementById('settingsUsername').value = currentUser.username || '';
  document.getElementById('settingsNickname').value = currentUser.nickname || '';
  document.getElementById('settingsEmail').value = currentUser.email || '';
  document.getElementById('settingsGender').value = currentUser.gender || '';
  document.getElementById('settingsDescription').value = currentUser.description || '';
  document.getElementById('visibilityEmail').checked = currentUser.visibility?.email !== false;
  document.getElementById('visibilityGender').checked = currentUser.visibility?.gender !== false;
  document.getElementById('visibilityDescription').checked = currentUser.visibility?.description !== false;
  document.getElementById('settingsTheme').value = currentUser.theme || 'blue';

  // Аватар
  document.querySelectorAll('#emojiGrid button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === currentUser.avatar);
  });
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function initEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = emojis.map(emoji => 
    `<button type="button" onclick="selectAvatar('${emoji}')">${emoji}</button>`
  ).join('');
}

function selectAvatar(emoji) {
  document.querySelectorAll('#emojiGrid button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === emoji);
  });
}

async function saveSettings() {
  const data = {
    avatar: document.querySelector('#emojiGrid button.active')?.textContent || '👤',
    nickname: document.getElementById('settingsNickname').value,
    email: document.getElementById('settingsEmail').value,
    gender: document.getElementById('settingsGender').value,
    description: document.getElementById('settingsDescription').value,
    visibility: {
      email: document.getElementById('visibilityEmail').checked,
      gender: document.getElementById('visibilityGender').checked,
      description: document.getElementById('visibilityDescription').checked
    },
    theme: document.getElementById('settingsTheme').value
  };

  try {
    const response = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (result.success) {
      currentUser = result.user;
      updateUserProfile();
      document.documentElement.setAttribute('data-theme', data.theme);
      closeSettings();
      showToast('✅ Настройки сохранены');
    }
  } catch (error) {
    showToast('❌ Ошибка сохранения');
  }
}

function updateUserProfile() {
  if (!currentUser) return;
  document.getElementById('userAvatar').textContent = currentUser.avatar || '👤';
  document.getElementById('userName').textContent = currentUser.nickname || currentUser.username;
  document.getElementById('userStatus').textContent = 'В сети';

  if (currentUser.theme) {
    document.documentElement.setAttribute('data-theme', currentUser.theme);
  }
}

// ===== ИЗОБРАЖЕНИЯ =====
function openImageModal(src) {
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModal').style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('imageModal').style.display = 'none';
}

// ===== ГОЛОСОВЫЕ =====
function playVoice(url) {
  const audio = new Audio(url);
  audio.play();
}

// ===== УТИЛИТЫ =====
function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== ДРУЗЬЯ =====
async function loadFriends() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch('/api/friends', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load friends');
    
    const data = await response.json();
    
    friendsState = {
      friends: data.friends || [],
      pendingRequests: data.pendingRequests || [],
      sentRequests: data.sentRequests || [],
      requestCount: data.pendingRequests ? data.pendingRequests.length : 0
    };
    
    updatePendingRequestsUI();
    return data;
  } catch (error) {
    console.error('Error loading friends:', error);
    return null;
  }
}

async function sendFriendRequest(userId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('❌ Вы не авторизованы');
      return;
    }

    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ friendId: userId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send friend request');
    }
    
    showToast('✅ Заявка в друзья отправлена!');
    await loadFriends();
  } catch (error) {
    console.error('Error sending friend request:', error);
    showToast(error.message || '❌ Не удалось отправить заявку');
  }
}

async function acceptFriendRequest(requestId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('❌ Вы не авторизованы');
      return;
    }

    const response = await fetch('/api/friends/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ requestId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to accept friend request');
    }
    
    showToast('🎉 Вы теперь друзья!');
    await loadFriends();
    await loadChats();
  } catch (error) {
    console.error('Error accepting friend request:', error);
    showToast('❌ Не удалось принять заявку');
  }
}

async function rejectFriendRequest(requestId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('❌ Вы не авторизованы');
      return;
    }

    const response = await fetch('/api/friends/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ requestId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reject friend request');
    }
    
    showToast('👋 Заявка отклонена');
    await loadFriends();
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    showToast('❌ Не удалось отклонить заявку');
  }
}

async function removeFriend(friendId) {
  if (!confirm('Удалить пользователя из друзей?')) return;
  
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('❌ Вы не авторизованы');
      return;
    }

    const response = await fetch(`/api/friends/${friendId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove friend');
    }
    
    showToast('✅ Пользователь удалён из друзей');
    await loadFriends();
    await loadChats();
  } catch (error) {
    console.error('Error removing friend:', error);
    showToast('❌ Не удалось удалить из друзей');
  }
}

async function checkFriendStatus(userId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { status: 'none', requestId: null, isSender: false };
    }

    const response = await fetch(`/api/friends/status/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to check friend status');
    
    return await response.json();
  } catch (error) {
    console.error('Error checking friend status:', error);
    return { status: 'none', requestId: null, isSender: false };
  }
}

function updatePendingRequestsUI() {
  const pendingRequests = friendsState.pendingRequests || [];
  const requestCount = pendingRequests.length;
  
  const badge = document.getElementById('friendRequestsBadge');
  if (badge) {
    if (requestCount > 0) {
      badge.textContent = requestCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
  
  const container = document.getElementById('pendingRequestsList');
  if (!container) return;
  
  if (pendingRequests.length === 0) {
    container.innerHTML = '<div style="padding: 10px; color: #666; text-align: center; font-size: 13px;">Нет новых заявок</div>';
    return;
  }
  
  container.innerHTML = pendingRequests.map(request => `
    <div class="pending-request-item" data-request-id="${request.id}">
      <div class="request-user-info">
        <div class="request-avatar">${request.avatar || '👤'}</div>
        <div class="request-name">${request.nickname || request.username}</div>
      </div>
      <div class="request-actions">
        <button class="accept-request-btn" data-request-id="${request.id}" title="Принять">✅</button>
        <button class="reject-request-btn" data-request-id="${request.id}" title="Отклонить">❌</button>
      </div>
    </div>
  `);
  
  container.querySelectorAll('.accept-request-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      acceptFriendRequest(btn.dataset.requestId);
    });
  });
  
  container.querySelectorAll('.reject-request-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      rejectFriendRequest(btn.dataset.requestId);
    });
  });
}

function showContextMenu(e, userId, username, nickname, avatar) {
  e.preventDefault();
  e.stopPropagation();
  
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  checkFriendStatus(userId).then(status => {
    const addFriendAction = menu.querySelector('[data-action="add-friend"]');
    const removeFriendAction = menu.querySelector('[data-action="remove-friend"]');
    
    if (!addFriendAction || !removeFriendAction) return;
    
    addFriendAction.style.display = 'flex';
    addFriendAction.style.opacity = '1';
    addFriendAction.style.pointerEvents = 'auto';
    removeFriendAction.style.display = 'none';
    
    if (status.status === 'accepted') {
      addFriendAction.style.display = 'none';
      removeFriendAction.style.display = 'flex';
    } else if (status.status === 'pending') {
      if (status.isSender) {
        addFriendAction.innerHTML = '<span>⏳</span> Заявка отправлена';
        addFriendAction.style.opacity = '0.5';
        addFriendAction.style.pointerEvents = 'none';
      } else {
        addFriendAction.innerHTML = '<span>📩</span> Заявка от пользователя';
        addFriendAction.style.opacity = '0.5';
        addFriendAction.style.pointerEvents = 'none';
      }
      removeFriendAction.style.display = 'none';
    } else {
      addFriendAction.innerHTML = '<span>👤</span> Добавить в друзья';
      addFriendAction.style.display = 'flex';
      addFriendAction.style.opacity = '1';
      addFriendAction.style.pointerEvents = 'auto';
      removeFriendAction.style.display = 'none';
    }
    
    menu.dataset.userId = userId;
    menu.dataset.username = username || 'Пользователь';
    menu.dataset.nickname = nickname || '';
    menu.dataset.avatar = avatar || '👤';
    
    const menuWidth = 200;
    const menuHeight = 180;
    let left = e.clientX;
    let top = e.clientY;
    
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (top + menuHeight > window.innerHeight) {
      top = window.innerHeight - menuHeight - 10;
    }
    
    menu.style.display = 'block';
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  });
}

function hideContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (menu) {
    menu.style.display = 'none';
  }
}

function initContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      const userId = menu.dataset.userId;
      
      hideContextMenu();
      
      switch (action) {
        case 'add-friend':
          await sendFriendRequest(userId);
          break;
        case 'remove-friend':
          await removeFriend(userId);
          break;
        case 'view-profile':
          showToast('👁️ Просмотр профиля в разработке');
          break;
        case 'start-chat':
          startChatWithUser(userId);
          break;
      }
    });
  });
  
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      hideContextMenu();
    }
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideContextMenu();
    }
  });
}

function startChatWithUser(userId) {
  let existingChat = null;
  
  if (chats) {
    existingChat = chats.find(chat => 
      chat.type === 'personal' && 
      chat.participants && 
      chat.participants.includes(userId)
    );
  }
  
  if (existingChat) {
    openChat(existingChat);
  } else {
    createPersonalChat(userId);
  }
}

async function createPersonalChat(userId) {
  try {
    const response = await fetch('/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        type: 'personal',
        participants: [userId]
      })
    });

    const data = await response.json();
    if (data.success) {
      await loadChats();
      const chat = chats.find(c => c.id === data.chatId || c.id === data.chat?.id);
      if (chat) openChat(chat);
    }
  } catch (error) {
    console.error('Error creating chat:', error);
    showToast('❌ Не удалось создать чат');
  }
}

function initFriendSocketHandlers() {
  if (typeof socket === 'undefined' || !socket) {
    console.log('Socket not initialized yet');
    return;
  }
  
  socket.on('friend_request', (data) => {
    console.log('📩 Новая заявка в друзья:', data);
    showToast(`📩 ${data.nickname || data.username} отправил(а) заявку в друзья`);
    
    friendsState.pendingRequests.push({
      id: data.id,
      userId: data.userId,
      username: data.username,
      nickname: data.nickname,
      avatar: data.avatar,
      createdAt: data.createdAt
    });
    
    updatePendingRequestsUI();
  });
  
  socket.on('friend_accepted', (data) => {
    console.log('🎉 Заявка принята:', data);
    showToast(`🎉 ${data.nickname || data.username} принял(а) вашу заявку в друзья!`);
    loadFriends();
    loadChats();
  });
  
  socket.on('friend_rejected', (data) => {
    console.log('😔 Заявка отклонена:', data);
    showToast(`😔 ${data.username} отклонил(а) вашу заявку в друзья`);
    loadFriends();
  });
}

// ===== СТИЛИ ДЛЯ TOAST =====
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  .toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: white;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    z-index: 99999;
    max-width: 90%;
    text-align: center;
    animation: slideUp 0.3s ease;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    transition: opacity 0.3s;
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
  
  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: #666;
    font-size: 14px;
  }
`;
document.head.appendChild(toastStyle);

console.log('✅ Danumes загружен!');
