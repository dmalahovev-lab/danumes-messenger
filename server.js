<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>DanuMes — мессенджер</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0a0f1e;
            height: 100vh;
            overflow: hidden;
        }

        /* Основной контейнер на весь экран */
        .messenger {
            display: flex;
            height: 100vh;
            width: 100%;
            background: #111827;
        }

        /* Боковая панель — ширина как в Telegram, чуть шире */
        .sidebar {
            width: 300px;
            background: #1f2937;
            border-right: 1px solid #374151;
            display: flex;
            flex-direction: column;
            flex-shrink: 0;
        }

        /* Шапка панели */
        .sidebar-header {
            padding: 16px 20px;
            border-bottom: 1px solid #374151;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 70px;
        }
        .logo {
            font-size: 1.6rem;
            font-weight: 700;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .profile-btn {
            background: none;
            border: none;
            font-size: 34px;
            cursor: pointer;
            transition: 0.1s;
            line-height: 1;
            padding: 6px;
            border-radius: 50%;
        }
        .profile-btn:hover { background: #374151; }

        /* Поиск */
        .search-box {
            padding: 12px 16px;
            border-bottom: 1px solid #374151;
        }
        .search-box input {
            width: 100%;
            background: #111827;
            border: none;
            padding: 10px 16px;
            border-radius: 30px;
            color: #f3f4f6;
            font-size: 14px;
            outline: none;
        }
        .search-box input::placeholder { color: #6b7280; }

        /* Список чатов */
        .chats-list {
            flex: 1;
            overflow-y: auto;
        }
        .chat-item {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 12px 16px;
            cursor: pointer;
            transition: background 0.1s;
        }
        .chat-item:hover { background: #374151; }
        .chat-item.active { background: #374151; }
        .chat-avatar {
            width: 52px;
            height: 52px;
            background: #4b5563;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            flex-shrink: 0;
        }
        .chat-info {
            flex: 1;
            min-width: 0;
        }
        .chat-name {
            font-weight: 600;
            color: #f3f4f6;
            font-size: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .chat-lastmsg {
            font-size: 13px;
            color: #9ca3af;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 4px;
        }
        .online-dot {
            width: 10px;
            height: 10px;
            background: #22c55e;
            border-radius: 50%;
            display: inline-block;
            margin-left: 8px;
        }

        /* Основной чат */
        .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #111827;
            min-width: 0;
        }
        /* Шапка чата */
        .chat-header {
            height: 70px;
            padding: 0 20px;
            background: #1f2937;
            border-bottom: 1px solid #374151;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .chat-header-avatar {
            font-size: 42px;
        }
        .chat-header-info h3 {
            color: white;
            font-size: 18px;
            font-weight: 600;
        }
        .chat-header-info p {
            font-size: 13px;
            color: #9ca3af;
            margin-top: 2px;
        }
        /* Область сообщений */
        .messages-area {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .message {
            display: flex;
            max-width: 75%;
        }
        .message-own {
            align-self: flex-end;
            flex-direction: row-reverse;
        }
        .message-bubble {
            background: #1f2937;
            padding: 10px 16px;
            border-radius: 20px;
            border-bottom-left-radius: 4px;
            color: #f3f4f6;
            font-size: 15px;
            line-height: 1.45;
        }
        .message-own .message-bubble {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border-bottom-right-radius: 4px;
            border-bottom-left-radius: 20px;
        }
        .message-text {
            word-wrap: break-word;
        }
        .message-time {
            font-size: 11px;
            color: #9ca3af;
            text-align: right;
            margin-top: 6px;
        }
        .file-attach {
            display: inline-block;
            margin-top: 6px;
            background: rgba(255,255,255,0.1);
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 12px;
            text-decoration: none;
            color: #93c5fd;
        }
        /* Панель ввода */
        .input-area {
            padding: 16px 20px;
            background: #1f2937;
            display: flex;
            gap: 14px;
            align-items: center;
            border-top: 1px solid #374151;
        }
        .input-wrapper {
            flex: 1;
            background: #111827;
            border-radius: 30px;
            padding: 10px 16px;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        #messageInput {
            flex: 1;
            background: none;
            border: none;
            color: white;
            font-size: 15px;
            outline: none;
            padding: 4px 0;
        }
        .file-btn, .emoji-btn {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #9ca3af;
            padding: 4px;
            line-height: 1;
        }
        .send-btn {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border: none;
            width: 46px;
            height: 46px;
            border-radius: 50%;
            font-size: 22px;
            cursor: pointer;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Модалка смены аватара */
        .modal {
            display: none;
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-content {
            background: #1f2937;
            padding: 24px;
            border-radius: 32px;
            width: 320px;
            text-align: center;
        }
        .modal-content h3 {
            color: white;
            font-size: 18px;
            margin-bottom: 16px;
        }
        .emoji-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 14px;
            margin: 20px 0;
        }
        .emoji-option {
            font-size: 34px;
            cursor: pointer;
            transition: 0.05s;
        }
        .emoji-option:hover { transform: scale(1.1); }
        .close-modal {
            background: #3b82f6;
            border: none;
            padding: 10px;
            border-radius: 28px;
            color: white;
            width: 100%;
            font-size: 14px;
            cursor: pointer;
        }

        /* Формы входа/регистрации — красивые, как было */
        .auth-container {
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #0a0f1e;
        }
        .auth-card {
            background: #1f2937;
            padding: 40px;
            border-radius: 36px;
            width: 420px;
            box-shadow: 0 20px 35px rgba(0,0,0,0.4);
        }
        .auth-card h2 {
            color: white;
            font-size: 28px;
            margin-bottom: 28px;
            text-align: center;
        }
        .tabs {
            display: flex;
            gap: 16px;
            margin-bottom: 28px;
        }
        .tab {
            flex: 1;
            text-align: center;
            padding: 10px;
            background: #374151;
            border-radius: 40px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            color: #e5e7eb;
        }
        .tab.active {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
        }
        .auth-form input {
            width: 100%;
            background: #111827;
            border: 1px solid #374151;
            padding: 14px 18px;
            border-radius: 30px;
            color: white;
            font-size: 16px;
            margin-bottom: 20px;
            outline: none;
        }
        .auth-form input:focus {
            border-color: #3b82f6;
        }
        .auth-btn {
            width: 100%;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border: none;
            padding: 14px;
            border-radius: 40px;
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 12px;
        }
        .error-text {
            color: #f87171;
            font-size: 13px;
            text-align: center;
            margin-bottom: 16px;
        }

        /* Адаптив для узких экранов */
        @media (max-width: 680px) {
            .sidebar { width: 80px; }
            .chat-info, .logo { display: none; }
            .chat-avatar { width: 48px; height: 48px; font-size: 28px; }
            .chat-item { justify-content: center; padding: 12px 0; }
            .profile-btn { font-size: 28px; }
            .auth-card { width: 90%; padding: 24px; }
        }
    </style>
</head>
<body>
<div id="app"></div>

<script>
    let currentUser = null;
    let currentChat = null;
    let messages = [];
    let chats = [];
    let searchQuery = '';
    let pollInterval = null;

    async function api(method, url, data = null) {
        const opts = { method, headers: {} };
        if (data) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(data);
        }
        const res = await fetch(url, opts);
        return res.json();
    }

    async function loadChats() {
        if (!currentUser) return;
        const res = await api('GET', `/get-chats/${currentUser.username}`);
        chats = res;
        renderSidebar();
    }

    async function loadMessagesWith(partner) {
        if (!currentUser || !partner) return;
        const res = await api('GET', `/get-messages/${currentUser.username}/${partner}`);
        messages = res;
        renderChat();
    }

    async function sendMessage(text, fileUrl = null, fileName = null) {
        if (!text && !fileUrl) return;
        await api('POST', '/send-message', {
            from: currentUser.username,
            to: currentChat,
            text: text || '',
            fileUrl,
            fileName
        });
        await loadMessagesWith(currentChat);
        await loadChats();
    }

    async function uploadFile(file) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/upload-file', { method: 'POST', body: fd });
        return res.json();
    }

    async function updateAvatar(emoji) {
        await api('POST', '/update-avatar', { username: currentUser.username, avatar: emoji });
        currentUser.avatar = emoji;
        loadChats();
        renderSidebar();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
    }

    function renderSidebar() {
        const sidebarDiv = document.getElementById('sidebar');
        if (!sidebarDiv) return;
        let filtered = chats.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));
        let html = `
            <div class="sidebar-header">
                <div class="logo">DanuMes</div>
                <button class="profile-btn" id="profileBtn">${currentUser.avatar}</button>
            </div>
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="Поиск" value="${escapeHtml(searchQuery)}">
            </div>
            <div class="chats-list" id="chatsList">
        `;
        filtered.forEach(chat => {
            const activeClass = currentChat === chat.username ? 'active' : '';
            html += `
                <div class="chat-item ${activeClass}" data-chat="${chat.username}">
                    <div class="chat-avatar">${chat.avatar}</div>
                    <div class="chat-info">
                        <div class="chat-name">
                            ${escapeHtml(chat.username)}
                            ${chat.online ? '<span class="online-dot"></span>' : ''}
                        </div>
                        <div class="chat-lastmsg">${escapeHtml(chat.lastMessage)}</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        sidebarDiv.innerHTML = html;

        document.querySelectorAll('.chat-item').forEach(el => {
            el.addEventListener('click', () => {
                currentChat = el.dataset.chat;
                loadMessagesWith(currentChat);
                renderSidebar();
            });
        });
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderSidebar();
        });
        const profileBtn = document.getElementById('profileBtn');
        if (profileBtn) profileBtn.addEventListener('click', () => {
            document.getElementById('avatarModal').style.display = 'flex';
        });
    }

    function renderChat() {
        const mainDiv = document.getElementById('chatMain');
        if (!mainDiv) return;
        if (!currentChat) {
            mainDiv.innerHTML = `<div style="flex:1; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:16px;">Выберите чат</div>`;
            return;
        }
        const chatUser = chats.find(c => c.username === currentChat) || { username: currentChat, avatar: '👤', online: false };
        let messagesHtml = `<div class="messages-area" id="messagesList">`;
        messages.forEach(msg => {
            const isOwn = msg.from === currentUser.username;
            const time = new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            let filePart = '';
            if (msg.fileUrl) {
                filePart = `<a href="${msg.fileUrl}" target="_blank" class="file-attach">📎 ${escapeHtml(msg.fileName || 'Файл')}</a>`;
            }
            messagesHtml += `
                <div class="message ${isOwn ? 'message-own' : ''}">
                    <div class="message-bubble">
                        <div class="message-text">${escapeHtml(msg.text)}</div>
                        ${filePart}
                        <div class="message-time">${time}</div>
                    </div>
                </div>
            `;
        });
        messagesHtml += `</div>`;
        mainDiv.innerHTML = `
            <div class="chat-header">
                <div class="chat-header-avatar">${chatUser.avatar}</div>
                <div class="chat-header-info">
                    <h3>${escapeHtml(currentChat)} ${chatUser.online ? '<span class="online-dot"></span>' : ''}</h3>
                    <p>${chatUser.online ? 'онлайн' : 'офлайн'}</p>
                </div>
            </div>
            ${messagesHtml}
            <div class="input-area">
                <div class="input-wrapper">
                    <input type="text" id="messageInput" placeholder="Сообщение">
                    <label class="file-btn" id="fileLabel">📎</label>
                    <input type="file" id="fileInput" style="display:none">
                </div>
                <button class="send-btn" id="sendBtn">➤</button>
            </div>
        `;

        const msgInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const fileLabel = document.getElementById('fileLabel');
        const fileInput = document.getElementById('fileInput');

        const send = async () => {
            const text = msgInput.value.trim();
            if (fileInput.files.length) {
                const file = fileInput.files[0];
                const up = await uploadFile(file);
                if (up.success) {
                    await sendMessage(text, up.fileUrl, up.fileName);
                    fileInput.value = '';
                } else alert('Ошибка файла');
            } else if (text) {
                await sendMessage(text);
            }
            msgInput.value = '';
            const msgsDiv = document.getElementById('messagesList');
            if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
        };
        sendBtn.onclick = send;
        msgInput.onkeypress = (e) => { if (e.key === 'Enter') send(); };
        fileLabel.onclick = () => fileInput.click();
        fileInput.onchange = () => send();

        setTimeout(() => {
            const msgsDiv = document.getElementById('messagesList');
            if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
        }, 100);
    }

    function renderAuth() {
        document.getElementById('app').innerHTML = `
            <div class="auth-container">
                <div class="auth-card">
                    <h2>DanuMes</h2>
                    <div class="tabs">
                        <div class="tab active" id="loginTab">Вход</div>
                        <div class="tab" id="regTab">Регистрация</div>
                    </div>
                    <div id="loginPanel">
                        <input type="text" id="loginUsername" placeholder="Логин">
                        <input type="password" id="loginPassword" placeholder="Пароль">
                        <div id="loginError" class="error-text"></div>
                        <button id="doLogin" class="auth-btn">Войти</button>
                    </div>
                    <div id="regPanel" style="display:none;">
                        <input type="text" id="regUsername" placeholder="Логин">
                        <input type="password" id="regPassword" placeholder="Пароль">
                        <div id="regError" class="error-text"></div>
                        <button id="doReg" class="auth-btn">Зарегистрироваться</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('loginTab').onclick = () => {
            document.getElementById('loginPanel').style.display = 'block';
            document.getElementById('regPanel').style.display = 'none';
            document.getElementById('loginTab').classList.add('active');
            document.getElementById('regTab').classList.remove('active');
        };
        document.getElementById('regTab').onclick = () => {
            document.getElementById('loginPanel').style.display = 'none';
            document.getElementById('regPanel').style.display = 'block';
            document.getElementById('regTab').classList.add('active');
            document.getElementById('loginTab').classList.remove('active');
        };
        document.getElementById('doLogin').onclick = async () => {
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const res = await api('POST', '/login-attempt', { username, password });
            if (res.success) {
                currentUser = { username: res.username, avatar: res.avatar };
                await loadChats();
                startMessenger();
            } else {
                document.getElementById('loginError').innerText = res.error;
            }
        };
        document.getElementById('doReg').onclick = async () => {
            const username = document.getElementById('regUsername').value;
            const password = document.getElementById('regPassword').value;
            const res = await api('POST', '/register-attempt', { username, password });
            if (res.success) {
                alert('Регистрация успешна! Войдите.');
                document.getElementById('loginTab').click();
            } else {
                document.getElementById('regError').innerText = res.error;
            }
        };
    }

    function startMessenger() {
        document.getElementById('app').innerHTML = `
            <div class="messenger">
                <div class="sidebar" id="sidebar"></div>
                <div class="chat-main" id="chatMain"></div>
            </div>
            <div id="avatarModal" class="modal">
                <div class="modal-content">
                    <h3>Выбери аватар</h3>
                    <div class="emoji-grid" id="emojiGrid"></div>
                    <button class="close-modal" id="closeModal">Закрыть</button>
                </div>
            </div>
        `;
        const emojis = ['😀', '😎', '🥳', '😺', '🐶', '🦊', '🐼', '🐨', '👑', '🚀', '⭐', '❤️', '💎', '🔥', '👍', '🎉'];
        const grid = document.getElementById('emojiGrid');
        if (grid) {
            emojis.forEach(e => {
                const div = document.createElement('div');
                div.className = 'emoji-option';
                div.textContent = e;
                div.onclick = () => {
                    updateAvatar(e);
                    document.getElementById('avatarModal').style.display = 'none';
                };
                grid.appendChild(div);
            });
            document.getElementById('closeModal').onclick = () => {
                document.getElementById('avatarModal').style.display = 'none';
            };
        }
        renderSidebar();
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(() => {
            if (currentChat) loadMessagesWith(currentChat);
            loadChats();
        }, 3000);
    }

    renderAuth();
</script>
</body>
</html>
