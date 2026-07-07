// Переменная текущего режима входа
let authMode = 'login';

// Запуск при старте страницы
window.addEventListener('DOMContentLoaded', () => {
  // Перерисовываем иконки Lucide
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  
  // Проверяем режим стекла
  const savedGlassMode = localStorage.getItem('glassMode');
  if (savedGlassMode === 'false') {
    document.body.classList.remove('glass-mode');
  }

  // Навешиваем Enter на поле ввода сообщения, если оно есть
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

// Переключатель "Войти" / "Зарегистрироваться"
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

// Нажатие на кнопку Войти / Создать аккаунт
function handleAuthSubmit() {
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');

  if (!usernameInput || !passwordInput) return;

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    alert('Пожалуйста, введите имя пользователя и пароль!');
    return;
  }

  // Пропускаем в мессенджер
  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('main-messenger-layout').classList.remove('auth-hidden');
  
  // Обновляем иконки внутри мессенджера
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Открытие чата из списка
function selectChat(chatId) {
  const testChatItem = document.getElementById('chat-item-test');
  const unreadBadge = document.getElementById('chat-unread-badge');
  const placeholder = document.getElementById('dialog-placeholder');
  const activeContent = document.getElementById('dialog-active-content');

  if (testChatItem) testChatItem.classList.add('active');
  if (unreadBadge) unreadBadge.classList.add('hidden-badge');
  if (placeholder) placeholder.style.display = 'none';
  if (activeContent) activeContent.classList.remove('hidden-content');

  // Адаптив под мобилки
  if (window.innerWidth <= 768) {
    document.getElementById('panel-chats').classList.add('mobile-left');
    document.getElementById('panel-dialog').classList.remove('mobile-hidden');
  }
  
  scrollToBottom();
}

// Назад к списку чатов на смартфонах
function closeChatMobile() {
  document.getElementById('panel-chats').classList.remove('mobile-left');
  document.getElementById('panel-dialog').classList.add('mobile-hidden');
}

// Выход из мессенджера обратно к окну входа
function logout() {
  document.getElementById('main-messenger-layout').classList.add('auth-hidden');
  document.getElementById('screen-auth').classList.remove('hidden');
}

// Переключение эффекта жидкого стекла
function toggleGlassEffect() {
  const body = document.body;
  body.classList.toggle('glass-mode');
  const isGlass = body.classList.contains('glass-mode');
  localStorage.setItem('glassMode', isGlass);
}

// Логика набора текста в поле (Микрофон меняется на Стрелочку отправки)
function handleInputMessage(inputElement) {
  const btnSend = document.getElementById('btn-send');
  const micIcon = document.getElementById('mic-icon');
  if (!btnSend || !micIcon) return;

  const text = inputElement.value.trim();
  if (text.length > 0) {
    btnSend.style.background = 'var(--accent-blue)';
    btnSend.style.color = 'white';
    micIcon.setAttribute('data-lucide', 'arrow-up');
  } else {
    btnSend.style.background = 'var(--island-bg)';
    btnSend.style.color = 'var(--text-primary)';
    micIcon.setAttribute('data-lucide', 'mic');
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Клик по кнопке отправки сообщения
function handleSendClick() {
  const messageInput = document.getElementById('message-input');
  if (!messageInput) return;

  const text = messageInput.value.trim();
  if (text.length > 0) {
    executeSendMessage(text);
  }
}

// Рендеринг нового сообщения на экран
function executeSendMessage(text) {
  const messagesView = document.getElementById('messages-view');
  const messageInput = document.getElementById('message-input');
  const btnSend = document.getElementById('btn-send');
  const micIcon = document.getElementById('mic-icon');
  
  if (!messagesView || !messageInput) return;
  
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const messageNode = document.createElement('div');
  const isEmoji = /^\p{Emoji}$/u.test(text) || /^\p{Emoji}\p{Emoji}$/u.test(text);

  if (isEmoji) {
    // 3D эмодзи-стикер
    messageNode.className = 'message msg-outgoing item-sticker';
    messageNode.innerHTML = `
      <div class="sticker-wrapper">
        <span class="mock-sticker">${text}</span>
        <div class="msg-meta">
          <span class="msg-time">${timeString}</span>
          <i data-lucide="check" class="icon-status-read"></i>
        </div>
      </div>
    `;
  } else {
    // Стильное iMessage облачко
    messageNode.className = 'message msg-outgoing';
    messageNode.style.justifyContent = 'flex-end';
    messageNode.innerHTML = `
      <div class="msg-bubble" style="background: var(--accent-blue); color: white; border-bottom-right-radius: 6px;">
        ${text}
        <div class="msg-meta">
          <span class="msg-time" style="color: rgba(255,255,255,0.7)">${timeString}</span>
          <i data-lucide="check" style="color: white; width:12px; height:12px;"></i>
        </div>
      </div>
    `;
  }

  messagesView.appendChild(messageNode);
  
  // Обновляем текст в левой панели
  const lastPreview = document.getElementById('chat-last-preview');
  const lastTime = document.getElementById('chat-last-time');
  if (lastPreview) lastPreview.textContent = text;
  if (lastTime) lastTime.textContent = timeString;

  // Сброс поля
  messageInput.value = '';
  if (btnSend && micIcon) {
    btnSend.style.background = 'var(--island-bg)';
    btnSend.style.color = 'var(--text-primary)';
    micIcon.setAttribute('data-lucide', 'mic');
  }
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  scrollToBottom();
}

function scrollToBottom() {
  const messagesView = document.getElementById('messages-view');
  if (messagesView) {
    messagesView.scrollTop = messagesView.scrollHeight;
  }
}
