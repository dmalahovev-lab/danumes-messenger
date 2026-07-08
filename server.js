<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Danumes</title>
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="app-bg"></div>

  <!-- Логин -->
  <div id="login-modal" class="modal">
    <div class="modal-card">
      <h2 id="modal-title">Вход</h2>
      <p class="modal-sub">Войдите в аккаунт</p>
      <input type="text" id="login-username" class="input" placeholder="Логин">
      <input type="password" id="login-password" class="input" placeholder="Пароль">
      <div id="login-error" class="error"></div>
      <button id="login-btn" class="btn">Войти</button>
      <p class="toggle">Нет аккаунта? <a href="#" id="toggle-link">Зарегистрироваться</a></p>
    </div>
  </div>

  <!-- Профиль -->
  <div id="profile-modal" class="modal" style="display:none;">
    <div class="modal-card">
      <button class="close" id="close-profile">✕</button>
      <div class="big-avatar" id="profile-avatar">?</div>
      <h2 id="profile-name">User</h2>
      <p>В сети</p>
      <div id="self-actions">
        <button id="change-pass-btn" class="btn-outline">Сменить пароль</button>
        <button id="logout-btn" class="btn-outline red">Выйти</button>
      </div>
      <div id="pass-form" style="display:none;">
        <input type="password" id="old-pass" class="input" placeholder="Старый пароль">
        <input type="password" id="new-pass" class="input" placeholder="Новый пароль">
        <div id="pass-error" class="error"></div>
        <button id="save-pass-btn" class="btn">Сохранить</button>
      </div>
      <div id="contact-actions" style="display:none;">
        <button id="back-btn-profile" class="btn-outline">← Назад</button>
      </div>
    </div>
  </div>

  <!-- Создание группы/канала -->
  <div id="create-modal" class="modal" style="display:none;">
    <div class="modal-card">
      <button class="close" id="close-create">✕</button>
      <h2 id="create-title">Новая группа</h2>
      <input type="text" id="entity-name" class="input" placeholder="Название">
      <p id="members-label" style="margin-top:12px;">Выберите участников</p>
      <div id="members-list" class="members-list"></div>
      <button id="create-btn" class="btn">Создать</button>
    </div>
  </div>

  <!-- Меню плюсика -->
  <div id="plus-menu" class="dropdown" style="display:none;">
    <div class="dropdown-item" id="menu-group">👥 Создать группу</div>
    <div class="dropdown-item" id="menu-channel">📢 Создать канал</div>
  </div>

  <!-- Основной интерфейс -->
  <div id="app" class="app" style="display:none;">
    <!-- Сайдбар -->
    <div id="sidebar" class="sidebar">
      <div class="sidebar-head">
        <div class="user-info" id="user-info">
          <div class="avatar" id="my-avatar">?</div>
          <span id="my-name">User</span>
        </div>
        <div style="position:relative;">
          <button id="plus-btn" class="icon-btn plus">+</button>
        </div>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" id="search" class="input" placeholder="Поиск...">
      </div>
      <div id="chat-list" class="chat-list"></div>
    </div>

    <!-- Чат -->
    <div id="chat" class="chat">
      <div class="chat-head">
        <button id="back-btn" class="icon-btn back">←</button>
        <div class="avatar" id="chat-avatar">?</div>
        <div id="chat-info">
          <h3 id="chat-title">Выберите чат</h3>
          <span id="chat-status">офлайн</span>
        </div>
      </div>
      <div id="messages-box" class="messages-box">
        <div id="messages" class="messages"></div>
      </div>
      <div class="composer" id="composer">
        <input type="text" id="msg-input" class="input msg-input" placeholder="Сообщение...">
        <button id="send-btn" class="send-btn">↑</button>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script src="app.js"></script>
</body>
</html>
