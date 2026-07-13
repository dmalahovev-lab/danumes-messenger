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

// ========================================
// ===== ИНИЦИАЛИЗАЦИЯ =====
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Danumes загружен!');
  initSocket();
  checkAuth();
  initEvents();
  initEmojiGrid();
  initContextMenu();
});

// ========================================
// ===== СОКЕТ =====
// ========================================

function initSocket() {
  socket = io();
  
  socket.on('connect', () => {
    console.log('✅ Socket подключен');
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

  socket.on('friend_request', (data) => {
    showToast(`📩 ${data.display_name || data.username} отправил(а) заявку`);
    friendsState.pendingRequests.push(data);
    updatePendingRequestsUI();
  });

  socket.on('friend_accepted', (data) => {
    showToast(`🎉 ${data.display_name || data.username} принял(а) заявку!`);
    loadFriends();
  });

  socket.on('friend_rejected', (data) => {
    showToast(`👋 ${data.username} отклонил(а) заявку`);
    loadFriends();
  });

  socket.on('connect_error', () => {
    showToast('❌ Ошибка соединения с сервером');
  });
}

// ========================================
// ===== АУТЕНТИФИКАЦИЯ =====
// ========================================

function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    showLogin();
    return;
  }

  fetch('/api/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(res => {
    if (res.ok) return res.json();
    throw new Error('Not authenticated');
  })
  .then(user => {
    currentUser = user;
    showApp();
    loadChats();
    loadFriends();
    if (socket) socket.emit('register', currentUser.id);
    if (user.theme) {
      document.documentElement.setAttribute('data-theme', user.theme);
      // Обновляем активную тему в селекторе
      document.querySelectorAll('.theme-selector button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === user.theme);
      });
    }
  })
  .catch(() => {
    localStorage.removeItem('token');
    showLogin();
  });
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
// ===== СОБЫТИЯ =====
// ========================================

function initEvents() {
  // Логин
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showApp();
        loadChats();
        loadFriends();
        if (socket) socket.emit('register', currentUser.id);
        if (currentUser.theme) {
          document.documentElement.setAttribute('data-theme', currentUser.theme);
        }
        showToast('✅ Добро пожаловать!');
        errorEl.textContent = '';
      } else {
        errorEl.textContent = data.error || 'Ошибка входа';
      }
    } catch (error) {
      errorEl.textContent = 'Ошибка соединения с сервером';
    }
  });

  // Регистрация
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        currentUser = data.user;
        showApp();
        loadChats();
        loadFriends();
        if (socket) socket.emit('register', currentUser.id);
        showToast('✅ Регистрация успешна!');
        setTimeout(() => openSettings(), 500);
      } else {
        errorEl.textContent = data.error || 'Ошибка регистрации';
      }
    } catch (error) {
      errorEl.textContent = 'Ошибка соединения с сервером';
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
  document.getElementById('settingsForm').addEventListener('submit', saveSettings);

  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('searchInput').addEventListener('input', handleSearch);

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
    document.getElementById('sidebar').classList.add('hidden');
  });

  document.getElementById('imageModalClose').addEventListener('click', closeImageModal);

  document.getElementById('changeAvatarBtn').addEventListener('click', () => {
    const grid = document.getElementById('emojiGrid');
    grid.style.display = grid.style.display === 'none' ? 'grid' : 'none';
  });

  // Заявки в друзья
  document.getElementById('friendRequestsToggle').addEventListener('click', () => {
    const list = document.getElementById('pendingRequestsList');
    list.style.display = list.style.display === 'none' ? 'block' : 'none';
    updatePendingRequestsUI();
  });

  // Темы
  document.querySelectorAll('.theme-selector button').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.theme-selector button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const theme = this.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      // Сохраняем в скрытое поле
      document.getElementById('settingsTheme')?.remove();
      const input = document.createElement('input');
      input.type = 'hidden';
      input.id = 'settingsTheme';
      input.value = theme;
      document.getElementById('settingsForm').appendChild(input);
    });
  });

  // Контекстное меню
  document.addEventListener('contextmenu', async (e) => {
    const chatItem = e.target.closest('.chat-item');
    if (chatItem && chatItem.dataset.userId) {
      e.preventDefault();
      showContextMenu(e, chatItem.dataset.userId);
    }
  });

  // Закрытие модалок по клику на оверлей
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('settingsModal').style.display = 'none';
      document.getElementById('imageModal').style.display = 'none';
    });
  });
}

// ========================================
// ===== ПОИСК =====
// ========================================

async function handleSearch() {
  const query = this.value.trim();
  const container = document.getElementById('searchResults');
  
  if (query.length < 1) {
    container.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`/api/search/users?query=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
    if (data.success && data.users.length > 0) {
      container.innerHTML = data.users.map(user => `
        <div class="search-result-item" data-user-id="${user.id}">
          <div class="avatar">${user.avatar_url || '👤'}</div>
          <div>
            <div class="name">${user.display_name || user.username}</div>
            <div class="username">@${user.username}</div>
          </div>
        </div>
      `).join('');
      
      container.style.display = 'block';
      
      container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          container.style.display = 'none';
          document.getElementById('searchInput').value = '';
          startChatWithUser(item.dataset.userId);
        });
      });
    } else {
      container.innerHTML = '<div style="padding:12px 16px;color:#999;font-size:13px;">Пользователи не найдены</div>';
      container.style.display = 'block';
    }
  } catch (error) {
    console.error('Search error:', error);
  }
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrap')) {
    document.getElementById('searchResults').style.display = 'none';
  }
});

// ========================================
// ===== ДРУЗЬЯ =====
// ========================================

async function loadFriends() {
  try {
    const res = await fetch('/api/friends', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
    if (data.success) {
      friendsState.friends = data.friends || [];
      friendsState.pendingRequests = data.pendingRequests || [];
      updatePendingRequestsUI();
    }
  } catch (error) {
    console.error('Error loading friends:', error);
  }
}

function updatePendingRequestsUI() {
  const list = document.getElementById('pendingRequestsList');
  const badge = document.getElementById('friendRequestsBadge');
  const requests = friendsState.pendingRequests || [];

  if (badge) {
    badge.textContent = requests.length;
    badge.style.display = requests.length > 0 ? 'block' : 'none';
  }

  if (!list) return;

  if (requests.length === 0) {
    list.innerHTML = '<div style="padding:10px 16px;color:#999;font-size:13px;">Нет заявок</div>';
    return;
  }

  list.innerHTML = requests.map(req => `
    <div class="pending-request-item" data-request-id="${req.id}">
      <div class="request-user-info">
        <div class="request-avatar">${req.avatar_url || '👤'}</div>
        <div class="request-name">${req.display_name || req.username}</div>
      </div>
      <div class="request-actions">
        <button class="accept-request-btn" data-request-id="${req.id}">✅</button>
        <button class="reject-request-btn" data-request-id="${req.id}">❌</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.accept-request-btn').forEach(btn => {
    btn.addEventListener('click', () => acceptFriendRequest(btn.dataset.requestId));
  });

  list.querySelectorAll('.reject-request-btn').forEach(btn => {
    btn.addEventListener('click', () => rejectFriendRequest(btn.dataset.requestId));
  });
}

async function acceptFriendRequest(requestId) {
  try {
    const res = await fetch('/api/friends/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ requestId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('🎉 Вы теперь друзья!');
      loadFriends();
      loadChats();
    }
  } catch (error) {
    showToast('❌ Ошибка');
  }
}

async function rejectFriendRequest(requestId) {
  try {
    const res = await fetch('/api/friends/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ requestId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('👋 Заявка отклонена');
      loadFriends();
    }
  } catch (error) {
    showToast('❌ Ошибка');
  }
}

async function sendFriendRequest(userId) {
  try {
    const res = await fetch('/api/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ friendId: userId })
    });

    const data = await res.json();
    if (data.success) {
      showToast('✅ Заявка отправлена!');
    } else {
      showToast('❌ ' + data.error);
    }
  } catch (error) {
    showToast('❌ Ошибка');
  }
}

async function removeFriend(userId) {
  if (!confirm('Удалить из друзей?')) return;
  try {
    const res = await fetch(`/api/friends/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    if (res.ok) {
      showToast('✅ Удалено из друзей');
      loadFriends();
      loadChats();
    }
  } catch (error) {
    showToast('❌ Ошибка');
  }
}

async function checkFriendStatus(userId) {
  try {
    const res = await fetch(`/api/friends/status/${userId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    return await res.json();
  } catch (error) {
    return { status: 'none' };
  }
}

// ========================================
// ===== КОНТЕКСТНОЕ МЕНЮ =====
// ========================================

function showContextMenu(e, userId) {
  const menu = document.getElementById('contextMenu');
  menu.dataset.userId = userId;
  
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 140) + 'px';

  checkFriendStatus(userId).then(status => {
    const addBtn = menu.querySelector('[data-action="add-friend"]');
    const removeBtn = menu.querySelector('[data-action="remove-friend"]');
    
    if (status.status === 'accepted') {
      addBtn.style.display = 'none';
      removeBtn.style.display = 'flex';
    } else if (status.status === 'pending') {
      addBtn.textContent = '⏳ Заявка отправлена';
      addBtn.style.opacity = '0.5';
      addBtn.style.pointerEvents = 'none';
      removeBtn.style.display = 'none';
    } else {
      addBtn.textContent = '👤 Добавить в друзья';
      addBtn.style.opacity = '1';
      addBtn.style.pointerEvents = 'auto';
      addBtn.style.display = 'flex';
      removeBtn.style.display = 'none';
    }
  });
}

function hideContextMenu() {
  document.getElementById('contextMenu').style.display = 'none';
}

function initContextMenu() {
  const menu = document.getElementById('contextMenu');
  
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const userId = menu.dataset.userId;
      const action = item.dataset.action;
      
      hideContextMenu();
      
      if (action === 'add-friend') sendFriendRequest(userId);
      else if (action === 'remove-friend') removeFriend(userId);
      else if (action === 'start-chat') startChatWithUser(userId);
      else if (action === 'view-profile') showToast('👁️ Профиль в разработке');
    });
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) hideContextMenu();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });
}

// ========================================
// ===== ЧАТЫ =====
// ========================================

async function loadChats() {
  try {
    const res = await fetch('/api/chats', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
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
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;font-size:14px;">Нет чатов</div>';
    return;
  }

  container.innerHTML = chats.map(chat => {
    let name = chat.name || 'Чат';
    let avatar = '💬';
    let userId = null;

    if (chat.type === 'personal' && chat.otherUser) {
      name = chat.otherUser.display_name || chat.otherUser.username;
      avatar = chat.otherUser.avatar_url || '👤';
      userId = chat.otherUser.id;
    }

    const lastMsg = chat.messages?.length > 0 ? chat.messages[chat.messages.length - 1] : null;
    const lastText = lastMsg ? lastMsg.content || '📎 Файл' : 'Нет сообщений';
    const time = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';

    return `
      <div class="chat-item ${currentChat && currentChat.id === chat.id ? 'active' : ''}" 
           data-chat-id="${chat.id}"
           data-user-id="${userId || ''}">
        <div class="avatar">${avatar}</div>
        <div class="info">
          <div class="name">${name}</div>
          <div class="last-message">${lastText}</div>
        </div>
        <div class="time">${time}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const chat = chats.find(c => c.id === item.dataset.chatId);
      if (chat) openChat(chat);
    });
  });
}

async function openChat(chat) {
  currentChat = chat;
  
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('chatHeader').style.display = 'flex';
  document.getElementById('messagesContainer').style.display = 'flex';
  document.getElementById('inputArea').style.display = 'flex';

  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
  }

  let name = chat.name || 'Чат';
  let avatar = '💬';
  if (chat.type === 'personal' && chat.otherUser) {
    name = chat.otherUser.display_name || chat.otherUser.username;
    avatar = chat.otherUser.avatar_url || '👤';
  }

  document.getElementById('chatUserAvatar').textContent = avatar;
  document.getElementById('chatUserName').textContent = name;
  document.getElementById('chatUserStatus').textContent = 'В сети';

  renderChats();
  await loadMessages(chat.id);
  socket.emit('join_chat', chat.id);
  
  // Прокрутка вниз
  setTimeout(() => {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
  }, 100);
}

async function loadMessages(chatId) {
  try {
    const res = await fetch(`/api/messages/${chatId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });

    const data = await res.json();
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
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Нет сообщений</div>';
    return;
  }

  container.innerHTML = chatMessages.map(msg => {
    const isSent = msg.sender_id === currentUser.id;
    const senderName = msg.sender?.display_name || msg.sender?.username || 'Пользователь';

    let content = msg.content || '';
    if (msg.type === 'image' && msg.file_url) {
      content = `<img src="${msg.file_url}" class="image-message" onclick="openImageModal('${msg.file_url}')">`;
    } else if (msg.type === 'file' && msg.file_url) {
      content = `<div>📎 <a href="${msg.file_url}" target="_blank" style="color:#27A5E7;text-decoration:none;">Файл</a></div>`;
    }

    let reactionsHtml = '';
    if (msg.reactions) {
      const groups = {};
      for (const [uid, reaction] of Object.entries(msg.reactions)) {
        if (!groups[reaction]) groups[reaction] = [];
        groups[reaction].push(uid);
      }
      reactionsHtml = Object.entries(groups).map(([reaction, users]) => {
        const active = users.includes(currentUser.id);
        return `<span class="reaction ${active ? 'active' : ''}" onclick="toggleReaction('${msg.id}','${reaction}')">
          ${reaction} <span class="count">${users.length}</span>
        </span>`;
      }).join('');
    }

    return `
      <div class="message ${isSent ? 'sent' : 'received'}">
        ${!isSent ? `<div class="sender">${senderName}</div>` : ''}
        <div class="content">${content}</div>
        ${reactionsHtml ? `<div class="reactions">${reactionsHtml}</div>` : ''}
        <div class="time">${new Date(msg.created_at).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    `;
  }).join('');

  const container2 = document.getElementById('messagesContainer');
  container2.scrollTop = container2.scrollHeight;
}

// ========================================
// ===== СООБЩЕНИЯ =====
// ========================================

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content || !currentChat) return;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        chatId: currentChat.id,
        content: content,
        type: 'text'
      })
    });

    const data = await res.json();
    if (data.success) {
      input.value = '';
    }
  } catch (error) {
    showToast('❌ Ошибка отправки');
  }
}

async function uploadFile(file) {
  if (!currentChat) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          chatId: currentChat.id,
          content: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          fileUrl: data.fileUrl
        })
      });
    }
  } catch (error) {
    showToast('❌ Ошибка загрузки');
  }
}

async function toggleReaction(messageId, reaction) {
  try {
    await fetch(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ reaction })
    });
  } catch (error) {
    console.error('Reaction error:', error);
  }
}

// ========================================
// ===== ЧАТ С ПОЛЬЗОВАТЕЛЕМ =====
// ========================================

function startChatWithUser(userId) {
  console.log('➡️ Начинаем чат с пользователем:', userId);
  
  // Ищем существующий чат
  let existing = chats.find(c => 
    c.type === 'personal' && 
    c.participants && 
    c.participants.includes(userId)
  );

  if (existing) {
    console.log('✅ Найден существующий чат:', existing.id);
    openChat(existing);
  } else {
    console.log('🆕 Создаём новый чат');
    createChat(userId);
  }
}

async function createChat(userId) {
  try {
    const res = await fetch('/api/chats', {
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

    const data = await res.json();
    console.log('📦 Ответ создания чата:', data);
    
    if (data.success) {
      await loadChats();
      // Ищем созданный чат
      const chat = chats.find(c => c.id === data.chatId || c.id === data.chat?.id);
      if (chat) {
        console.log('✅ Чат создан, открываем');
        openChat(chat);
      } else {
        // Если не нашли, пробуем ещё раз загрузить
        setTimeout(async () => {
          await loadChats();
          const chat2 = chats.find(c => c.id === data.chatId || c.id === data.chat?.id);
          if (chat2) openChat(chat2);
        }, 500);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка создания чата:', error);
    showToast('❌ Ошибка создания чата');
  }
}

// ========================================
// ===== НАСТРОЙКИ =====
// ========================================

function openSettings() {
  if (!currentUser) return;
  const modal = document.getElementById('settingsModal');
  modal.style.display = 'flex';

  document.getElementById('settingsDisplayName').value = currentUser.display_name || '';
  document.getElementById('settingsBio').value = currentUser.bio || '';
  document.getElementById('settingsAvatarPreview').textContent = currentUser.avatar_url || '👤';

  const theme = currentUser.theme || 'light';
  document.querySelectorAll('.theme-selector button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  
  // Устанавливаем скрытое поле для темы
  let themeInput = document.getElementById('settingsTheme');
  if (!themeInput) {
    themeInput = document.createElement('input');
    themeInput.type = 'hidden';
    themeInput.id = 'settingsTheme';
    document.getElementById('settingsForm').appendChild(themeInput);
  }
  themeInput.value = theme;
}

function closeSettings() {
  document.getElementById('settingsModal').style.display = 'none';
}

function initEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = emojis.map(e => 
    `<button onclick="selectAvatar('${e}')">${e}</button>`
  ).join('');
}

function selectAvatar(emoji) {
  document.querySelectorAll('#emojiGrid button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('settingsAvatarPreview').textContent = emoji;
}

async function saveSettings(e) {
  e.preventDefault();
  
  const themeInput = document.getElementById('settingsTheme');
  const theme = themeInput ? themeInput.value : 'light';
  
  const data = {
    avatar_url: document.getElementById('settingsAvatarPreview').textContent || '👤',
    display_name: document.getElementById('settingsDisplayName').value,
    bio: document.getElementById('settingsBio').value,
    theme: theme
  };

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      currentUser = result.user;
      updateUserProfile();
      document.documentElement.setAttribute('data-theme', theme);
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
// ===== TOAST =====
// ========================================

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

console.log('✅ Danumes готов!');
