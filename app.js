let authMode = 'login';

window.addEventListener('DOMContentLoaded', () => {
  const savedGlassMode = localStorage.getItem('glassMode');
  if (savedGlassMode === 'false') {
    document.body.classList.remove('glass-mode');
  }

  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendClick();
      }
    });
  }
});

function toggleAuthMode() {
  const authTitle = document.getElementById('auth-title');
  const emailField = document.getElementById('email-field');
  const btnAuthAction = document.getElementById('auth-submit-trigger');
  const authToggleHint = document.getElementById('auth-toggle-hint');
  const btnAuthToggle = document.getElementById('btn-auth-toggle');

  if (authMode === 'login') {
    authMode = 'register';
    authTitle.textContent = 'Регистрация в DanuChat';
    emailField.classList.remove('hidden-auth-field');
    btnAuthAction.textContent = 'Создать аккаунт';
    authToggleHint.textContent = 'Уже есть аккаунт?';
    btnAuthToggle.textContent = 'Войти';
  } else {
    authMode = 'login';
    authTitle.textContent = 'Войти в DanuChat';
    emailField.classList.add('hidden-auth-field');
    btnAuthAction.textContent = 'Войти';
    authToggleHint.textContent = 'Ещё нет аккаунта?';
    btnAuthToggle.textContent = 'Зарегистрироваться';
  }
}

function handleAuthSubmit() {
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    alert('Пожалуйста, введите данные!');
    return;
  }

  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('main-messenger-layout').classList.remove('auth-hidden');
}

function selectChat(chatId) {
  document.getElementById('chat-item-test').classList.add('active');
  document.getElementById('chat-unread-badge').classList.add('hidden-badge');
  document.getElementById('dialog-placeholder').style.display = 'none';
  document.getElementById('dialog-active-content').classList.remove('hidden-content');

  if (window.innerWidth <= 768) {
    document.getElementById('panel-chats').classList.add('mobile-left');
    document.getElementById('panel-dialog').classList.remove('mobile-hidden');
  }
  scrollToBottom();
}

function closeChatMobile() {
  document.getElementById('panel-chats').classList.remove('mobile-left');
  document.getElementById('panel-dialog').classList.add('mobile-hidden');
}

function toggleGlassEffect() {
  const body = document.body;
  body.classList.toggle('glass-mode');
  const isGlass = body.classList.contains('glass-mode');
  localStorage.setItem('glassMode', isGlass);
}

function logout() {
  document.getElementById('main-messenger-layout').classList.add('auth-hidden');
  document.getElementById('screen-auth').classList.remove('hidden');
}

// РАБОТА КНОПОК УПРАВЛЕНИЯ ВВОДА ДО МЕЛЬЧАЙШИХ ДЕТАЛЕЙ

// 1. Оживление кнопки "Плюс" (Прикрепление медиафайлов)
function triggerAttachFile() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,audio/*';
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert(`Файл "${file.name}" успешно выбран для отправки (Загрузка в Supabase в разработке)`);
    }
  };
  fileInput.click();
}

// 2. Включение / Выключение шторки эмодзи-пикера
function toggleEmojiPicker() {
  const picker = document.getElementById('emoji-picker-popup');
  if (picker) picker.classList.toggle('hidden-emoji');
}

// 3. Выбор эмодзи из панели в поле ввода
function insertEmoji(emoji) {
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.value += emoji;
    handleInputMessage(messageInput); // Переключаем микрофон на стрелочку
  }
  toggleEmojiPicker(); // Прячем панель смайликов
}

function handleInputMessage(inputElement) {
  const btnSend = document.getElementById('btn-send');
  const iconContainer = document.getElementById('send-icon-container');
  if (!btnSend || !iconContainer) return;

  const text = inputElement.value.trim();
  if (text.length > 0) {
    btnSend.style.background = 'var(--accent-blue)';
    btnSend.style.color = 'white';
    iconContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" x2="12" y1="19" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;
  } else {
    btnSend.style.background = 'var(--island-bg)';
    btnSend.style.color = 'var(--text-primary)';
    iconContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
  }
}

function handleSendClick() {
  const messageInput = document.getElementById('message-input');
  if (!messageInput) return;

  const text = messageInput.value.trim();
  if (text.length > 0) {
    executeSendMessage(text);
  } else {
    // 4. Оживление кнопки Микрофона, если поле ввода пустое (Запись ГС)
    alert("🎙️ Запись голосового сообщения начата... Скажите что-нибудь!");
  }
}

function executeSendMessage(text) {
  const messagesView = document.getElementById('messages-view');
  const messageInput = document.getElementById('message-input');
  const btnSend = document.getElementById('btn-send');
  const iconContainer = document.getElementById('send-icon-container');
  if (!messagesView || !messageInput) return;
  
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messageNode = document.createElement('div');
  
  const isEmoji = /^\p{Emoji}$/u.test(text) || /^\p{Emoji}\p{Emoji}$/u.test(text);

  if (isEmoji) {
    messageNode.className = 'message msg-outgoing item-sticker';
    messageNode.innerHTML = `
      <div class="sticker-wrapper">
        <span class="mock-sticker">${text}</span>
        <div class="msg-meta">
          <span class="msg-time">${timeString}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      </div>
    `;
  } else {
    messageNode.className = 'message msg-outgoing';
    messageNode.innerHTML = `
      <div class="msg-bubble">
        ${text}
        <div class="msg-meta">
          <span class="msg-time">${timeString}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px; height:12px; color:white;"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
      </div>
    `;
  }

  messagesView.appendChild(messageNode);
  
  const lastPreview = document.getElementById('chat-last-preview');
  const lastTime = document.getElementById('chat-last-time');
  if (lastPreview) lastPreview.textContent = text;
  if (lastTime) lastTime.textContent = timeString;

  messageInput.value = '';
  if (btnSend && iconContainer) {
    btnSend.style.background = 'var(--island-bg)';
    btnSend.style.color = 'var(--text-primary)';
    iconContainer.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
  }
  scrollToBottom();
}

function scrollToBottom() {
  const messagesView = document.getElementById('messages-view');
  if (messagesView) messagesView.scrollTop = messagesView.scrollHeight;
}
