// ===== СОСТОЯНИЕ =====
let currentUser = null;
let currentChat = null;
let socket = null;
let chats = [];
let messages = {};

// ===== СОСТОЯНИЕ ДЛЯ ДРУЗЕЙ =====
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

// ========================================
// ===== ИНИЦИАЛИЗАЦИЯ =====
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Danumes инициализируется...');
  
  initSocket();
  await checkAuth();
  initEventListeners();
  initEmojiGrid();
  initContextMenu();
  initFriendSocketHandlers();

  await loadFriends();

  // Обработчик правого клика
  document.addEventListener('contextmenu', async (e) => {
    const chatItem = e.target.closest('.chat-item');
    if (chatItem && chatItem.dataset.userId) {
      e.preventDefault();
      const userId = chatItem.dataset.userId;
      const username = chatItem.dataset.username || 'Пользователь';
      const displayName = chatItem.dataset.displayName || '';
      const avatarUrl = chatItem.dataset.avatarUrl || '👤';
      showContextMenu(e, userId, username, displayName, avatarUrl);
    }
  });

  // Выбор темы
  document.querySelectorAll('.theme-selector button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.theme-selector button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const theme = this.dataset.theme;
      document.getElementById('settingsTheme').value = theme;
      document.documentElement.setAttribute('data-theme', theme);
    });
  });

  // Кнопка смены аватара
  document.getElementById('changeAvatarBtn')?.addEventListener('click', () => {
    const grid = document.getElementById('emojiGrid');
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
  });

  console.log('✅ Danumes готов к работе!');
});

// ========================================
// ===== АУТЕНТИФИКАЦИЯ =====
// ========================================

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    showLogin();
    return;
  }

  try {
    const response = await fetch('/api/me', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const user = await response.json();
      currentUser = user;
      showApp();
      await loadChats();
      await loadFriends();
      
      if (socket) {
        socket.emit('register', currentUser.id);
      }

      if (currentUser.theme) {
        document.documentElement.setAttribute('data-theme', currentUser.theme);
      }
      
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

// ========================================
// ===== СОКЕТ =====
// ========================================

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

// ========================================
// ===== СОБЫТИЯ =====
// ========================================

function initEventListeners() {
  // Логин
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!username || !password) {
      showToast('❌ Заполните все поля');
      return;
    }

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
        await loadFriends();
        
        if (socket) {
          socket.emit('register', currentUser.id);
        }

        if (currentUser.theme) {
          document.documentElement.setAttribute('data-theme', currentUser.theme);
        }
        
        showToast('✅ Добро пожаловать!');
      } else {
        showToast('❌ ' + (data.error || 'Ошибка входа'));
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('❌ Ошибка соединения с сервером');
    }
  });

  // Регистрация
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername')?.value;
    const email = document.getElementById('registerEmail')?.value;
    const password = document.getElementById('registerPassword')?.value;
    
    if (!username || !email || !password) {
      showToast('❌ Заполните все поля');
      return;
    }

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
        await loadFriends();
        
        if (socket) {
          socket.emit('register', currentUser.id);
        }

        if (currentUser.theme) {
          document.documentElement.setAttribute('data-theme', currentUser.theme);
        }
        
        showToast('✅ Регистрация успешна! Заполните профиль');
        
        setTimeout(() => {
          openSettings();
        }, 500);
      } else {
        showToast('❌ ' + (data.error || 'Ошибка регистрации'));
      }
    } catch (error) {
      console.error('Register error:', error);
      showToast('❌ Ошибка соединения с сервером');
    }
  });

  document.getElementById('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    showRegister();
  });

  document.getElementById('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    currentUser = null;
    showLogin();
    if (socket) socket.disconnect();
  });

  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('searchInput').addEventListener('input', handleSearch);

  document.getElementById('emojiBtn').addEventListener('click', toggleEmojiPicker);

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

  document.getElementById('backBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('hidden');
    document.getElementById('chatArea').classList.remove('chat-open');
  });

  document.getElementById('imageModalClose').addEventListener('click', closeImageModal);
  document.getElementById('imageModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImageModal();
  });

  // Голосовые
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
      document.getElementById('voiceBtn').style.color = '#e74c3c';
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

// ========================================
// ===== ПОИСК =====
// ========================================

async function handleSearch() {
  const query = this.value.trim();
  const resultsContainer = document.getElementById('searchResults');
  
  if (query.length < 1) {
    resultsContainer.style.display = 'none';
    return;
  }

  try {
    const response = await fetch(`/api/search/users?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await response.json();
    
    if (data.success && data.users.length > 0) {
      resultsContainer.innerHTML = data.users.map(user => `
        <div class="search-result-item" data-user-id="${user.id}">
          <div class="avatar">${user.avatar_url || '👤'}</div>
          <div>
            <div class="name">${user.display_name || user.username}</div>
            <div class="username">@${user.username}</div>
          </div>
        </div>
      `).join('');
      
      resultsContainer.style.display = 'block';
      
      resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
          const userId = this.dataset.userId;
          resultsContainer.style.display = 'none';
          document.getElementById('searchInput').value = '';
          startChatWithUser(userId);
        });
      });
    } else {
      resultsContainer.innerHTML = '<div style="padding:12px 16px;color:#999;font-size:13px;">Пользователи не найдены</div>';
      resultsContainer.style.display = 'block';
    }
  } catch (error) {
    console.error('Search error:', error);
  }
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('searchResults').style.display = 'none';
  }
});

// ========================================
// ===== ЧАТЫ =====
// ========================================

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
  if (!container) return;

  if (chats.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;font-size:14px;">Нет чатов<br><span style="font-size:12px;">Найдите пользователя через поиск</span></div>';
    return;
  }

  container.innerHTML = chats.map(chat => {
    let name = chat.name || 'Чат';
    let avatar = '💬';
    let userId = null;
    let username = '';
    let displayName = '';
    let avatarUrl = '';

    if (chat.type === 'personal' && chat.otherUser) {
      name = chat.otherUser.display_name || chat.otherUser.username;
      avatar = chat.otherUser.avatar_url || '👤';
      userId = chat.otherUser.id;
      username = chat.otherUser.username;
      displayName = chat.otherUser.display_name;
      avatarUrl = chat.otherUser.avatar_url;
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
           data-display-name="${displayName || ''}"
           data-avatar-url="${avatarUrl || ''}">
        <div class="avatar">${avatar}</div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="last-message">${lastText}</div>
        </div>
        <div class="meta">
          <div class="time">${time}</div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chatId = item.dataset.chatId;
      const chat = chats.find(c => c.id === chatId);
      if (chat) openChat(chat);
    });
  });
}

async function openChat(chat) {
  currentChat = chat;
  renderChats();

  // Показываем элементы чата
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatHeader').style.display = 'flex';
  document.getElementById('messagesContainer').style.display = 'flex';
  document.getElementById('inputArea').style.display = 'flex';

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
  }

  await loadMessages(chat.id);

  let name = chat.name || 'Чат';
  let avatar = '💬';
  if (chat.type === 'personal' && chat.otherUser) {
    name = chat.otherUser.display_name || chat.otherUser.username;
    avatar = chat.otherUser.avatar_url || '👤';
  }

  document.getElementById('chatUserAvatar').textContent = avatar;
  document.getElementById('chatUserName').textContent = name;
  document.getElementById('chatUserStatus').textContent = 'был(а) недавно';

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
  if (!container) return;
  
  const chatMessages = messages[currentChat?.id] || [];

  if (chatMessages.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;font-size:14px;">Напишите первое сообщение</div>';
    return;
  }

  container.innerHTML = chatMessages.map(msg => {
    const isSent = msg.sender_id === currentUser.id;
    const senderName = msg.sender?.display_name || msg.sender?.username || 'Пользователь';

    let content = msg.content || '';
    if (msg.type === 'image' && msg.file_url) {
      content = `<img src="${msg.file_url}" class="image-message" onclick="openImageModal('${msg.file_url}')">`;
    } else if (msg.type === 'voice' && msg.file_url) {
      content = `<div style="display:flex;align-items:center;gap:8px;">
        <button onclick="playVoice('${msg.file_url}')" style="background:none;border:none;font-size:18px;cursor:pointer;">▶️</button>
        <span>Голосовое сообщение</span>
      </div>`;
    } else if (msg.type === 'file' && msg.file_url) {
      content = `<div style="display:flex;align-items:center;gap:8px;">
        <span>📎</span>
        <a href="${msg.file_url}" target="_blank" style="color:#27A5E7;text-decoration:none;">Скачать файл</a>
      </div>`;
    }

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
          ${msg.edited ? ' (ред.)' : ''}
        </div>
      </div>
    `;
  }).join('');

  const container2 = document.getElementById('messagesContainer');
  if (container2) {
    container2.scrollTop = container2.scrollHeight;
  }
}

// ========================================
// ===== СООБЩЕНИЯ =====
// ========================================

async function sendMessage() {
  const input = document.getElementById('messageInput');
  if (!input) return;
  
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

// ========================================
// ===== РЕАКЦИИ =====
// ========================================

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

// ========================================
// ===== НАСТРОЙКИ =====
// ========================================

function openSettings() {
  if (!currentUser) return;
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  
  modal.style.display = 'flex';

  document.getElementById('settingsDisplayName').value = currentUser.display_name || '';
  document.getElementById('settingsUsername').value = currentUser.username || '';
  document.getElementById('settingsBio').value = currentUser.bio || '';
  document.getElementById('settingsTheme').value = currentUser.theme || 'light';

  // Аватар
  document.getElementById('settingsAvatarPreview').textContent = currentUser.avatar_url || '👤';
  document.querySelectorAll('#emojiGrid button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === currentUser.avatar_url);
  });

  // Тема
  document.querySelectorAll('.theme-selector button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === (currentUser.theme || 'light'));
  });
}

function closeSettings() {
  const modal = document.getElementById('settingsModal');
  if (modal) modal.style.display = 'none';
}

function initEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  if (!grid) return;
  
  grid.innerHTML = emojis.map(emoji => 
    `<button type="button" onclick="selectAvatar('${emoji}')">${emoji}</button>`
  ).join('');
}

function selectAvatar(emoji) {
  document.querySelectorAll('#emojiGrid button').forEach(btn => {
    btn.classList.toggle('active', btn.textContent === emoji);
  });
  document.getElementById('settingsAvatarPreview').textContent = emoji;
}

async function saveSettings() {
  const data = {
    avatar_url: document.getElementById('settingsAvatarPreview').textContent || '👤',
    display_name: document.getElementById('settingsDisplayName').value,
    username: document.getElementById('settingsUsername').value,
    bio: document.getElementById('settingsBio').value,
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
  
  document.getElementById('userAvatar').textContent = currentUser.avatar_url || '👤';
  document.getElementById('userName').textContent = currentUser.display_name || currentUser.username;

  if (currentUser.theme) {
    document.documentElement.setAttribute('data-theme', currentUser.theme);
  }
}

// ========================================
// ===== ИЗОБРАЖЕНИЯ =====
// ========================================

function openImageModal(src) {
  document.getElementById('modalImage').src = src;
  document.getElementById('imageModal').style.display = 'flex';
}

function closeImageModal() {
  document.getElementById('imageModal').style.display = 'none';
}

// ========================================
// ===== УТИЛИТЫ =====
// ========================================

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

function toggleEmojiPicker() {
  const input = document.getElementById('messageInput');
  if (input) {
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    input.value += randomEmoji;
    input.focus();
  }
}

// ========================================
// ===== ДРУЗЬЯ (осталось без изменений) =====
// ========================================

// ... (все функции друзей из предыдущей версии)
