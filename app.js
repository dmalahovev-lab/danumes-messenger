<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>DanuChat</title>
  
  <!-- Шрифт Inter -->
  <link rel="preconnect" href="https://googleapis.com">
  <link rel="preconnect" href="https://gstatic.com" crossorigin>
  <link href="https://googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  
  <!-- Иконки Lucide -->
  <script src="https://unpkg.com"></script>
  
  <link rel="stylesheet" href="style.css">
</head>
<body class="glass-mode">

  <!-- ============================================= -->
  <!-- ЭКРАН 0: АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ -->
  <!-- ============================================= -->
  <div id="screen-auth" class="auth-container">
    <div class="auth-island">
      <div class="auth-logo">t</div>
      <h2 id="auth-title">Войти в DanuChat</h2>
      
      <!-- Форма ввода -->
      <div class="auth-form">
        <div class="auth-input-wrapper">
          <input type="text" id="auth-username" placeholder="Имя пользователя">
        </div>
        <div class="auth-input-wrapper hidden-auth-field" id="email-field">
          <input type="email" id="auth-email" placeholder="Email адрес">
        </div>
        <div class="auth-input-wrapper">
          <input type="password" id="auth-password" placeholder="Пароль">
        </div>
        
        <button class="btn-auth-submit" id="btn-auth-action" onclick="handleAuthSubmit()">Войти</button>
      </div>

      <!-- Переключатель между Входом и Регистрацией -->
      <div class="auth-toggle-text">
        <span id="auth-toggle-hint">Ещё нет аккаунта?</span>
        <button id="btn-auth-toggle" onclick="toggleAuthMode()">Зарегистрироваться</button>
      </div>
    </div>
  </div>

  <!-- ============================================= -->
  <!-- ОСНОВНОЙ ИНТЕРФЕЙС МЕССЕНДЖЕРА (СКРЫТ ДО ВХОДА) -->
  <!-- ============================================= -->
  <div id="main-messenger-layout" class="app-layout auth-hidden">
    
    <!-- ЛЕВАЯ ПАНЕЛЬ: СПИСОК ЧАТОВ -->
    <aside id="panel-chats" class="messenger-panel">
      <header class="ios-header">
        <button class="btn-circle avatar-main" onclick="logout()">t</button>
        <div class="header-island">Чаты</div>
        <button class="btn-circle btn-action">
          <i data-lucide="square-pen"></i>
        </button>
      </header>

      <!-- Список диалогов -->
      <main class="chats-list">
        <!-- Добавили id="chat-item-test" для отслеживания активности -->
        <div id="chat-item-test" class="chat-item" onclick="selectChat('test-id')">
          <div class="chat-avatar blue-gradient">t</div>
          <div class="chat-details">
            <div class="chat-row">
              <span class="chat-name">Test</span>
              <span class="chat-time" id="chat-last-time">12:45</span>
            </div>
            <div class="chat-row">
              <p class="chat-preview" id="chat-last-preview">Тестовое сообщение</p>
              <span class="badge-unread" id="chat-unread-badge">1</span>
            </div>
          </div>
        </div>
      </main>

      <!-- Нижний Таб-бар -->
      <nav class="ios-tabbar">
        <div class="tabbar-main-island">
          <button class="tab-item">
            <i data-lucide="user"></i>
            <span>Вы</span>
          </button>
          <button class="tab-item active">
            <i data-lucide="message-square"></i>
            <span>Чаты</span>
          </button>
          <button class="tab-item" onclick="toggleGlassEffect()">
            <i data-lucide="sliders"></i>
            <span>Стекло</span>
          </button>
        </div>
        <button class="btn-circle btn-search">
          <i data-lucide="search"></i>
        </button>
      </nav>
    </aside>

    <!-- ПРАВАЯ ПАНЕЛЬ: ОКНО ПЕРЕПИСКИ -->
    <section id="panel-dialog" class="messenger-panel mobile-hidden">
      <!-- Заглушка, когда ни один чат не выбран на ПК -->
      <div id="dialog-placeholder" class="dialog-empty-state">
        <div class="placeholder-icon"><i data-lucide="message-square-dashed"></i></div>
        <p>Выберите чат, чтобы начать общение</p>
      </div>

      <!-- Основное содержимое чата (скрыто, пока не кликнешь на чат) -->
      <div id="dialog-active-content" class="dialog-content-wrapper hidden-content">
        <header class="ios-header">
          <button class="btn-circle btn-back" onclick="closeChatMobile()">
            <i data-lucide="chevron-left"></i>
          </button>
          <div class="header-island dialog-status-island">
            <span class="user-name">test</span>
            <span class="user-status">в сети</span>
          </div>
          <div class="btn-circle chat-avatar blue-gradient">t</div>
        </header>

        <!-- Окно сообщений -->
        <main class="messages-container" id="messages-view">
          <div class="message msg-incoming">
            <div class="msg-bubble">
              Тестовое сообщение
              <span class="msg-time">12:40</span>
            </div>
          </div>
          <div class="message msg-outgoing">
            <div class="msg-bubble">
              Тестовое сообщение
              <div class="msg-meta">
                <span class="msg-time">12:42</span>
                <i data-lucide="check-check" class="icon-status-read"></i>
              </div>
            </div>
          </div>
        </main>

        <!-- Панель ввода -->
        <footer class="ios-footer">
          <button class="btn-circle btn-plus">
            <i data-lucide="plus"></i>
          </button>
          
          <div class="input-island">
            <input type="text" placeholder="Сообщение" id="message-input" autocomplete="off">
          </div>
          
          <button class="btn-circle btn-mic" id="btn-send" onclick="handleSendClick()">
            <i data-lucide="mic" id="mic-icon"></i>
          </button>
        </footer>
      </div>
    </section>

  </div>

  <script src="app.js"></script>
</body>
</html>
