    <script>
        let socket = null, currentUser = null, activeChat = { type: null, id: null };
        let isSelectionForRegister = false, selectedMessageId = null, selectedMessageFileUrl = null, selectedMessageFileName = null;
        let cachedActiveChats = [], cachedFriendsList = [];
        let localStream = null, peerConnection = null, currentCallSession = null, ringtoneInterval = null;
        let isMuted = false, typingTimeout = null;
        const rtcConfig = { iceServers: [{ urls: 'stun:://google.com' }] };

        function showToast(t) { const c = document.getElementById('toast-container'); const tr = document.createElement('div'); tr.className = 'toast'; tr.innerText = t; c.appendChild(tr); setTimeout(() => tr.remove(), 4000); }
        function playRingtone() { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); ringtoneInterval = setInterval(() => { let o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(440, ctx.currentTime); g.gain.setValueAtTime(0.2, ctx.currentTime); o.start(); o.stop(ctx.currentTime + 0.3); }, 1000); } catch(e){} }
        function stopRingtone() { clearInterval(ringtoneInterval); }

        // СВЯТОЙ КОД ПЕРЕКЛЮЧЕНИЯ ИЗ REPO TEST (100% ОРИГИНАЛ)
        document.getElementById('auth-toggle').addEventListener('click', () => {
            isSelectionForRegister = !isSelectionForRegister;
            document.getElementById('auth-header-text').innerText = isSelectionForRegister ? 'Регистрация в DanuMes' : 'Вход в DanuMes';
            document.getElementById('main-auth-btn').innerText = isSelectionForRegister ? 'Создать аккаунт' : 'Войти';
            document.getElementById('auth-toggle').innerText = isSelectionForRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Создать';
        });

        // СВЯТОЙ КОД АВТОРИЗАЦИИ ИЗ REPO TEST (ПЕРЕМЕННЫЕ USER И PASS)
        document.getElementById('main-auth-btn').addEventListener('click', async () => {
            const user = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value.trim();
            if (!user || !pass) return showToast('Заполните поля');
            const targetUrl = isSelectionForRegister ? '/api/register' : '/api/login';
            try {
                const response = await fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user, pass })
                });
                const data = await response.json();
                if (response.ok) {
                    currentUser = { username: user };
                    document.getElementById('auth-container').style.display = 'none';
                    document.getElementById('app-container').style.display = 'flex';
                    showToast(`Вы вошли под ником ${user}`);
                    initSocketChannels();
                } else { showToast(data.message || 'Ошибка авторизации'); }
            } catch (err) { showToast('Ошибка подключения к серверу'); }
        });

        function initSocketChannels() {
            socket = io({ 
                transports: ['websocket'], 
                upgrade: false,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 2000
            });
            
            socket.on('connect', () => { 
                socket.emit('register_user', currentUser.username); 
                buildSidebarStructure(); 
            });
            
            socket.on('auth_success_data', (data) => {
                if (data && data.avatar) document.getElementById('profile-preview-emoji').innerText = data.avatar;
            });

            // Прием списков приватности от Cloudflare
            socket.on('active_chats_list', (chats) => { cachedActiveChats = chats; renderSidebarList(); });
            socket.on('friends_list_data', (friends) => { cachedFriendsList = friends; renderFriendsList(); });
            
            socket.on('global_search_results', (results) => { renderSearchResults(results); });

            socket.on('update_groups', (groups) => {
                const c = document.getElementById('chats');
                c.querySelectorAll('.chat-item[data-type="group"]').forEach(e => e.remove());
                groups.forEach(g => {
                    const d = document.createElement('div');
                    d.className = 'chat-item'; d.setAttribute('data-type', 'group');
                    d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div class="avatar" style="width:30px;height:30px;font-size:14px;">👥</div><div class="chat-item-title">${g.name}</div></div><div class="chat-item-sub">Групповой чат</div>`;
                    d.onclick = () => selectChat('group', g.id, g.name);
                    c.appendChild(d);
                });
            });

            socket.on('group_left_success', () => {
                showToast("Вы вышли из группы");
                activeChat = { type: null, id: null };
                document.getElementById('current-chat-title').innerText = "Выберите чат";
                document.getElementById('chat-messages').innerHTML = '';
                document.getElementById('leave-group-btn').style.display = 'none';
            });

            socket.on('messages_history', (messages) => {
                const box = document.getElementById('chat-messages'); box.innerHTML = '';
                messages.forEach(renderSingleMessage); box.scrollTop = box.scrollHeight;
                if (activeChat.type === 'private') socket.emit('mark_as_read', { chatWith: activeChat.id });
            });

            socket.on('new_msg', (msg) => {
                if ((activeChat.type === msg.type && (activeChat.id === msg.to || activeChat.id === msg.author)) || (msg.type === 'news' && activeChat.id === 'danumes_news')) {
                    renderSingleMessage(msg); document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
                    if (activeChat.type === 'private' && msg.author !== currentUser.username) socket.emit('mark_as_read', { chatWith: activeChat.id });
                }
            });

            socket.on('msg_deleted', (messageId) => { const el = document.querySelector(`[data-id="${messageId}"]`); if (el) el.remove(); });
            socket.on('chat_read_by_recipient', (data) => { if (activeChat.type === 'private' && activeChat.id === data.readBy) { document.querySelectorAll('.message.outgoing .tick').forEach(t => t.innerText = '✓✓'); } });
            socket.on('user_typing_broadcast', (data) => { if (activeChat.type === 'private' && activeChat.id === data.from) { document.getElementById('typing-indicator').style.display = data.isTyping ? 'inline' : 'none'; } });
            
            socket.on('call_incoming', (data) => {
                currentCallSession = data;
                document.getElementById('call-status-title').innerText = "Входящий вызов";
                document.getElementById('caller-name').innerText = `Звонит ${data.from}`;
                document.getElementById('accept-call-btn').style.display = 'flex';
                document.getElementById('mute-call-btn').style.display = 'none';
                document.getElementById('call-modal').style.display = 'flex';
                playRingtone();
            });

            socket.on('start_handshake', async (data) => {
                peerConnection = new RTCPeerConnection(rtcConfig); localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
                peerConnection.ontrack = (e) => { document.getElementById('remote-audio').srcObject = e.streams; };
                peerConnection.onicecandidate = (e) => { if (e.candidate) socket.emit('ice_candidate', { to: data.from, candidate: e.candidate }); };
                const offer = await peerConnection.createOffer(); await peerConnection.setLocalDescription(offer); socket.emit('rtc_offer', { to: data.from, offer: offer });
            });

            socket.on('receive_offer', async (data) => {
                if (!peerConnection) { peerConnection = new RTCPeerConnection(rtcConfig); localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream)); peerConnection.ontrack = (e) => { document.getElementById('remote-audio').srcObject = e.streams; }; peerConnection.onicecandidate = (e) => { if (e.candidate) socket.emit('ice_candidate', { to: data.from, candidate: e.candidate }); }; }
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer)); const ans = await peerConnection.createAnswer(); await peerConnection.setLocalDescription(ans); socket.emit('rtc_answer', { to: data.from, answer: ans });
            });

            socket.on('receive_answer', async (data) => { if (peerConnection) await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer)); });
            socket.on('receive_ice', async (data) => { if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)); });
            socket.on('call_ended', endCallUI);
        }

        function buildSidebarStructure() {
            const c = document.getElementById('chats'); c.innerHTML = '';
            const n = document.createElement('div'); n.className = 'chat-item';
            n.innerHTML = `<div style="display:flex;align-items:center;gap:10px;"><div class="avatar" style="width:30px;height:30px;font-size:14px;">📢</div><div class="chat-item-title">Danumes News</div></div><div class="chat-item-sub">Канал новостей</div>`;
            n.onclick = () => selectChat('news', 'danumes_news', 'Danumes News');
            c.appendChild(n);
        }

        // Вывод только активных диалогов (Скрытый режим)
        function renderSidebarList() {
            const c = document.getElementById('chats');
            c.querySelectorAll('.chat-item[data-type="user"]').forEach(e => e.remove());
            
            // Если идет поиск, рендеринг сайдбара приостанавливается
            if(document.getElementById('search').value.trim() !== '') return;

            cachedActiveChats.forEach(u => {
                const d = document.createElement('div');
                d.className = 'chat-item'; d.setAttribute('data-type', 'user');
                let b = (u.username === 'Danumala' || u.username === 'RunFly') ? '<span class="badge-admin">✓</span>' : '';
                let a = u.avatar ? `<div class="avatar" style="width:30px;height:30px;font-size:16px;">${u.avatar}</div>` : `<div class="avatar" style="width:30px;height:30px;font-size:14px;">👤</div>`;
                let s = u.isOnline ? '<span style="color:#2ecc71;">● В сети</span>' : '<span style="color:var(--gray);">Не в сети</span>';
                d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">${a}<div class="chat-item-title">${u.username}${b}</div></div><div class="chat-item-sub">${s}</div>`;
                d.onclick = () => selectChat('private', u.username, u.username);
                c.appendChild(d);
            });
        }

        // Вывод списка вкладки Друзья
        function renderFriendsList() {
            const fBox = document.getElementById('friends'); fBox.innerHTML = '';
            if (cachedFriendsList.length === 0) { fBox.innerHTML = '<div style="color:var(--gray);text-align:center;padding:20px;font-size:14px;">Список друзей пуст</div>'; return; }
            
            cachedFriendsList.forEach(u => {
                const d = document.createElement('div');
                d.className = 'chat-item';
                let b = (u.username === 'Danumala' || u.username === 'RunFly') ? '<span class="badge-admin">✓</span>' : '';
                let a = u.avatar ? `<div class="avatar" style="width:30px;height:30px;font-size:16px;">${u.avatar}</div>` : `<div class="avatar" style="width:30px;height:30px;font-size:14px;">👤</div>`;
                let s = u.isOnline ? '<span style="color:#2ecc71;">● В сети</span>' : '<span style="color:var(--gray);">Не в сети</span>';
                d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">${a}<div class="chat-item-title">${u.username}${b}</div></div><div style="display:flex;flex-direction:column;align-items:end;gap:5px;"><div class="chat-item-sub">${s}</div><button class="add-friend-btn is-friend" onclick="event.stopPropagation(); toggleFriend('${u.username}')">Удалить</button></div>`;
                d.onclick = () => { document.getElementById('tab-chats-btn').click(); selectChat('private', u.username, u.username); };
                fBox.appendChild(d);
            });
        }

        // Рендеринг результатов живого скрытого поиска по никам
        function renderSearchResults(results) {
            const c = document.getElementById('chats');
            c.querySelectorAll('.chat-item[data-type="user"]').forEach(e => e.remove());
            
            const existingSection = c.querySelector('.search-section-title');
            if(existingSection) existingSection.remove();

            if(results.length > 0) {
                const sTitle = document.createElement('div'); sTitle.className = 'search-section-title'; sTitle.innerText = "Найденные глобально:";
                c.appendChild(sTitle);
            }

            results.forEach(u => {
                const d = document.createElement('div');
                d.className = 'chat-item'; d.setAttribute('data-type', 'user');
                let b = (u.username === 'Danumala' || u.username === 'RunFly') ? '<span class="badge-admin">✓</span>' : '';
                let a = u.avatar ? `<div class="avatar" style="width:30px;height:30px;font-size:16px;">${u.avatar}</div>` : `<div class="avatar" style="width:30px;height:30px;font-size:14px;">👤</div>`;
                let btnText = u.isFriend ? 'В друзьях' : 'Добавить';
                let btnClass = u.isFriend ? 'add-friend-btn is-friend' : 'add-friend-btn';
                
                d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;">${a}<div class="chat-item-title">${u.username}${b}</div></div><button class="${btnClass}" onclick="event.stopPropagation(); toggleFriend('${u.username}')">${btnText}</button>`;
                d.onclick = () => selectChat('private', u.username, u.username);
                c.appendChild(d);
            });
        }

        // Перехват ввода поиска (Поиск по всей скрытой базе)
        document.getElementById('search').addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (q === '') {
                const title = document.getElementById('chats').querySelector('.search-section-title');
                if(title) title.remove();
                renderSidebarList();
            } else if (socket) {
                socket.emit('global_search_user', q);
            }
        });

        function toggleFriend(name) { if (socket) socket.emit('toggle_friend', name); if(document.getElementById('search').value.trim() !== '') { socket.emit('global_search_user', document.getElementById('search').value.trim()); } }

        // Переключение Bento-табов
        document.getElementById('tab-chats-btn').addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.list-container').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active'); document.getElementById('chats-list-container').classList.add('active');
        });
        document.getElementById('tab-friends-btn').addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.list-container').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active'); document.getElementById('friends-list-container').classList.add('active');
        });

        function selectChat(type, id, title) {
            activeChat = { type, id };
            let b = (id === 'Danumala' || id === 'RunFly') ? '<span class="badge-admin">✓</span>' : '';
            document.getElementById('current-chat-title').innerHTML = title + b;
            
            // Кнопка выхода из групп: Показываем её, только если выбран тип 'group'
            document.getElementById('leave-group-btn').style.display = type === 'group' ? 'block' : 'none';

            if(type === 'private') {
                const userObj = cachedActiveChats.find(u => u.username === id) || cachedFriendsList.find(u => u.username === id);
                document.getElementById('header-avatar').innerText = (userObj && userObj.avatar) ? userObj.avatar : title.charAt(0).toUpperCase();
            } else {
                document.getElementById('header-avatar').innerText = type === 'group' ? '👥' : '📢';
            }
            
            document.getElementById('header-status').style.display = type === 'private' ? 'block' : 'none';
            document.getElementById('typing-indicator').style.display = 'none';
            document.getElementById('chat-messages').innerHTML = '';
            document.getElementById('call-btn').style.display = (type === 'private' && id !== 'danumes_news') ? 'inline-block' : 'none';
            if (socket) { socket.emit('load_messages', { type, id }); if (type === 'private') socket.emit('mark_as_read', { chatWith: id }); }
        }

        // Логика кнопки «Выйти из группы» в шапке чата
        document.getElementById('leave-group-btn').addEventListener('click', () => {
            if (activeChat.type === 'group' && activeChat.id && socket) {
                if(confirm(`Вы уверены, что хотите выйти из группы "${document.getElementById('current-chat-title').innerText.replace('✓', '')}"?`)) {
                    socket.emit('leave_group', activeChat.id);
                }
            }
        });

        function renderSingleMessage(msg) {
            const box = document.getElementById('chat-messages'); const div = document.createElement('div');
            const isOwn = msg.author === currentUser.username; div.className = `message ${isOwn ? 'outgoing' : 'incoming'}`;
            div.dataset.id = msg.id; div.dataset.author = msg.author;
            if (msg.fileUrl) { div.dataset.fileurl = msg.fileUrl; div.dataset.filename = msg.fileName; }
            if (msg.image) { div.dataset.fileurl = msg.image; div.dataset.filename = "image.jpg"; }
            let b = (msg.author === 'Danumala' || msg.author === 'RunFly') ? '<span class="badge-admin">✓</span>' : '';
            let t = isOwn ? `<span class="tick">${msg.read ? '✓✓' : '✓'}</span>` : '';
            let c = `<strong>${msg.author}${b}:</strong><br>`; 
            if (msg.text) c += `<span>${msg.text}</span>`;
            if (msg.image) { c += `<img src="${msg.image}" onclick="zoomImage('${msg.image}')">`; }
            if (msg.fileUrl && !msg.image) {
                c += `<div class="file-box" onclick="downloadFileDirectly('${msg.fileUrl}', '${msg.fileName}')">
                        <div class="file-icon">📄</div>
                        <div class="file-info-text">
                            <span class="file-name-span">${msg.fileName}</span>
                            <span class="file-action-label">Нажмите, чтобы скачать</span>
                        </div>
                      </div>`;
            }
            c += t; div.innerHTML = c; box.appendChild(div);
        }

        const sendMessage = () => {
            const input = document.getElementById('msg-input'); const text = input.value.trim(); if (!text || !activeChat.id) return;
            if (activeChat.id === 'danumes_news' && currentUser.username !== 'Danumala') return showToast('Писать в этот канал может только админ.');
            if (socket) { socket.emit('send_msg', { type: activeChat.type, to: activeChat.id, text: text }); socket.emit('typing_status', { type: activeChat.type, to: activeChat.id, isTyping: false }); }
            input.value = '';
        };
        document.getElementById('send-btn').addEventListener('click', sendMessage);
        document.getElementById('msg-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
        document.getElementById('msg-input').addEventListener('input', () => { if (activeChat.type === 'private' && socket) { socket.emit('typing_status', { type: 'private', to: activeChat.id, isTyping: true }); clearTimeout(typingTimeout); typingTimeout = setTimeout(() => { socket.emit('typing_status', { type: 'private', to: activeChat.id, isTyping: false }); }, 2000); } });

        document.getElementById('img-btn').addEventListener('click', () => document.getElementById('file-input').click());
        document.getElementById('file-input').addEventListener('change', (e) => {
            const file = e.target.files; if (!file || !activeChat.id) return;
            const r = new FileReader(); r.onload = (event) => {
                const isImage = file.type.startsWith('image/');
                let payloadData = event.target.result;
                if (isImage) {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas'); const MAX = 400; let w = img.width, h = img.height;
                        if (w > MAX) { h *= MAX / w; w = MAX; } canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        sendUploadRequest(canvas.toDataURL('image/jpeg', 0.4), file.name, true);
                    }; img.src = event.target.result;
                } else { sendUploadRequest(payloadData, file.name, false); }
            }; r.readAsDataURL(file);
        });

        async function sendUploadRequest(base64Data, originalName, isImage) {
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rawData: base64Data, fileName: originalName, isImage: isImage })
                });
                const data = await res.json();
                if (res.ok && socket) {
                    if (isImage) { socket.emit('send_msg', { type: activeChat.type, to: activeChat.id, image: data.url }); } 
                    else { socket.emit('send_msg', { type: activeChat.type, to: activeChat.id, fileUrl: data.url, fileName: data.name }); }
                }
            } catch(err) { showToast('Ошибка отправки файла.'); }
        }

        function zoomImage(src) { const overlay = document.getElementById('media-viewer-overlay'); const img = document.getElementById('viewer-img'); img.src = src; overlay.style.display = 'flex'; }
        document.getElementById('media-viewer-overlay').addEventListener('click', () => { document.getElementById('media-viewer-overlay').style.display = 'none'; });
        function downloadFileDirectly(url, name) { const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); document.body.removeChild(link); }

        document.getElementById('chat-messages').addEventListener('contextmenu', (e) => { 
            const msgEl = e.target.closest('.message'); if (!msgEl) return;
            e.preventDefault(); selectedMessageId = msgEl.dataset.id; selectedMessageFileUrl = msgEl.dataset.fileurl || null; selectedMessageFileName = msgEl.dataset.filename || null;
            const menu = document.getElementById('custom-context-menu');
            document.getElementById('ctx-download-btn').style.display = selectedMessageFileUrl ? 'block' : 'none';
            if (currentUser.username === 'Danumala' || currentUser.username === msgEl.dataset.author) { document.getElementById('ctx-delete-btn').style.display = 'block'; } else { document.getElementById('ctx-delete-btn').style.display = 'none'; }
            menu.style.left = `${e.pageX}px`; menu.style.top = `${e.pageY}px`; menu.style.display = 'block';
        });

        document.addEventListener('click', () => document.getElementById('custom-context-menu').style.display = 'none');
        document.getElementById('ctx-download-btn').addEventListener('click', () => { if (selectedMessageFileUrl && selectedMessageFileName) downloadFileDirectly(selectedMessageFileUrl, selectedMessageFileName); });
        document.getElementById('ctx-delete-btn').addEventListener('click', () => { if (selectedMessageId && socket) socket.emit('req_delete_message', { messageId: selectedMessageId, user: currentUser.username }); });

        document.getElementById('open-settings-btn').addEventListener('click', () => { const p = document.getElementById('settings-panel'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; });
        document.getElementById('close-settings-btn').addEventListener('click', () => { document.getElementById('settings-panel').style.display = 'none'; });
        document.getElementById('avatar-emoji-selector').addEventListener('click', (e) => { if (e.target.classList.contains('emoji-option')) { const sel = e.target.innerText; document.getElementById('profile-preview-emoji').innerText = sel; if (socket) socket.emit('update_profile_avatar', { avatar: sel }); showToast(`Аватар изменен на ${sel}!`); } });

        document.getElementById('open-group-modal-btn').addEventListener('click', () => {
            const list = document.getElementById('group-members-list'); list.innerHTML = '';
            cachedFriendsList.forEach(u => {
                list.innerHTML += `<label style="display:flex;align-items:center;gap:10px;margin-bottom:8px;cursor:pointer;"><input type="checkbox" value="${u.username}" class="group-member-checkbox"> 👤 ${u.username}</label>`;
            });
            document.getElementById('group-modal').style.display = 'flex';
        });
        document.getElementById('close-group-btn').addEventListener('click', () => { document.getElementById('group-modal').style.display = 'none'; });
        document.getElementById('submit-create-group').addEventListener('click', () => { const name = document.getElementById('group-name-input').value.trim(); if (!name) return showToast('Введите название группы'); const members = []; document.querySelectorAll('.group-member-checkbox:checked').forEach(cb => members.push(cb.value)); if (socket) socket.emit('create_private_group', { name: name, members: members }); document.getElementById('group-modal').style.display = 'none'; document.getElementById('group-name-input').value = ''; showToast(`Группа "${name}" создана!`); });

        document.getElementById('call-btn').addEventListener('click', async () => { document.getElementById('call-status-title').innerText = "Исходящий вызов"; document.getElementById('caller-name').innerText = `Звоним ${activeChat.id}...`; document.getElementById('accept-call-btn').style.display = 'none'; document.getElementById('mute-call-btn').style.display = 'flex'; document.getElementById('call-modal').style.display = 'flex'; localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); currentCallSession = { from: currentUser.username, to: activeChat.id }; if (socket) socket.emit('call_init', { to: activeChat.id, from: currentUser.username }); });
        document.getElementById('accept-call-btn').addEventListener('click', async () => { stopRingtone(); document.getElementById('call-status-title').innerText = "Разговор..."; document.getElementById('accept-call-btn').style.display = 'none'; document.getElementById('mute-call-btn').style.display = 'flex'; localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); if (socket) socket.emit('call_accepted', { to: currentCallSession.from, from: currentUser.username }); });
        document.getElementById('mute-call-btn').addEventListener('click', () => { if (localStream) { isMuted = !isMuted; localStream.getAudioTracks().enabled = !isMuted; const m = document.getElementById('mute-call-btn'); if (isMuted) { m.classList.add('active'); m.innerText = "🔇"; } else { m.classList.remove('active'); m.innerText = "🎙"; } } });
        const endCallUI = () => { stopRingtone(); document.getElementById('call-modal').style.display = 'none'; if (peerConnection) { peerConnection.close(); peerConnection = null; } if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; } isMuted = false; const m = document.getElementById('mute-call-btn'); m.classList.remove('active'); m.innerText = "🎙"; showToast('Звонок завершен'); };
        document.getElementById('reject-call-btn').addEventListener('click', () => { if (currentCallSession && socket) { const target = currentCallSession.from === currentUser.username ? currentCallSession.to : currentCallSession.from; socket.emit('call_rejected', { to: target }); } endCallUI(); });
    </script>
</body>
</html>
const usersOnline = {};

app.post('/api/register', (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ message: 'Заполните все поля' });
    if (db.users[user]) return res.status(400).json({ message: 'Пользователь уже существует' });
    db.users[user] = { password: pass, avatar: null, friends: [] };
    saveDB();
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    if (!user || !pass) return res.status(400).json({ message: 'Заполните все поля' });
    if (user === 'Danumala' && !db.users['Danumala']) { db.users['Danumala'] = { password: 'danyajukovka', avatar: null, friends: [] }; saveDB(); }
    if (user === 'RunFly' && !db.users['RunFly']) { db.users['RunFly'] = { password: 'GGWWXXJJ2001', avatar: null, friends: [] }; saveDB(); }
    const account = db.users[user];
    if (!account || account.password !== pass) { return res.status(400).json({ message: 'Неверное имя пользователя или пароль' }); }
    res.json({ success: true });
});

app.post('/api/upload', (req, res) => {
    const { rawData, fileName, isImage } = req.body;
    if (!rawData || !fileName) return res.status(400).json({ message: 'Данные файла не переданы' });
    try {
        const base64Data = rawData.replace(/^data:.*;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = path.extname(fileName);
        const safeName = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
        const filePath = path.join(UPLOADS_DIR, safeName);
        fs.writeFileSync(filePath, buffer);
        res.json({ url: `/uploads/${safeName}`, name: fileName, isImage: isImage });
    } catch(err) { res.status(500).json({ message: 'Ошибка записи файла' }); }
});

app.post('/api/messages/delete', (req, res) => {
    const { messageId, user } = req.body;
    const msgIndex = db.messages.findIndex(m => m.id === messageId);
    if (msgIndex !== -1) {
        const msg = db.messages[msgIndex];
        if (user === 'Danumala' || msg.author === user) {
            db.messages.splice(msgIndex, 1);
            saveDB();
            io.emit('msg_deleted', messageId);
            return res.json({ success: true });
        }
    }
    res.status(400).json({ message: 'Нет прав или сообщение не найдено' });
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

function sendActiveChatsAndFriends(socket, username) {
    if (!username || !db.users[username]) return;
    if (!db.users[username].friends) db.users[username].friends = [];
    const activeInteractions = new Set();
    db.messages.forEach(m => {
        if (m.type === 'private') {
            if (m.author === username) activeInteractions.add(m.to);
            if (m.to === username) activeInteractions.add(m.author);
        }
    });
    const activeChatsData = Array.from(activeInteractions).map(user => ({
        username: user,
        avatar: db.users[user] ? db.users[user].avatar : null,
        isOnline: !!usersOnline[user]
    }));
    const friendsData = db.users[username].friends.map(friend => ({
        username: friend,
        avatar: db.users[friend] ? db.users[friend].avatar : null,
        isOnline: !!usersOnline[friend]
    }));
    socket.emit('active_chats_list', activeChatsData);
    socket.emit('friends_list_data', friendsData);
}
io.on('connection', (socket) => {
    let sessionUser = null;

    socket.on('register_user', (username) => {
        if (!username) return;
        sessionUser = username;
        usersOnline[username] = socket.id;
        const userAvatar = db.users[username] ? db.users[username].avatar : null;
        socket.emit('auth_success_data', { avatar: userAvatar });
        sendActiveChatsAndFriends(socket, username);
        Object.keys(usersOnline).forEach(u => {
            const ts = io.sockets.sockets.get(usersOnline[u]);
            if (ts) sendActiveChatsAndFriends(ts, u);
        });
        sendGroupsList(socket);
    });

    function sendGroupsList(targetSocket) {
        if (!sessionUser) return;
        const userGroups = [];
        Object.keys(db.groups).forEach(groupId => {
            const group = db.groups[groupId];
            if (group.members && group.members.includes(sessionUser)) {
                userGroups.push({ id: groupId, name: group.name });
            }
        });
        targetSocket.emit('update_groups', userGroups);
    }

    socket.on('get_online_users', () => { if (sessionUser) sendActiveChatsAndFriends(socket, sessionUser); });

    socket.on('global_search_user', (query) => {
        if (!sessionUser || !query) return;
        const q = query.toLowerCase().trim();
        const results = Object.keys(db.users)
            .filter(username => username !== sessionUser && username.toLowerCase().includes(q))
            .map(username => ({
                username: username,
                avatar: db.users[username].avatar || null,
                isFriend: db.users[sessionUser].friends ? db.users[sessionUser].friends.includes(username) : false
            }));
        socket.emit('global_search_results', results);
    });

    socket.on('toggle_friend', (targetUser) => {
        if (!sessionUser || !db.users[sessionUser] || !db.users[targetUser]) return;
        if (!db.users[sessionUser].friends) db.users[sessionUser].friends = [];
        const index = db.users[sessionUser].friends.indexOf(targetUser);
        if (index === -1) { db.users[sessionUser].friends.push(targetUser); } else { db.users[sessionUser].friends.splice(index, 1); }
        saveDB();
        sendActiveChatsAndFriends(socket, sessionUser);
    });

    socket.on('leave_group', (groupId) => {
        if (!sessionUser || !db.groups[groupId]) return;
        const index = db.groups[groupId].members.indexOf(sessionUser);
        if (index !== -1) {
            db.groups[groupId].members.splice(index, 1);
            if (db.groups[groupId].members.length === 0) { delete db.groups[groupId]; }
            saveDB();
            sendGroupsList(socket);
            socket.emit('group_left_success');
        }
    });

    socket.on('create_private_group', (data) => {
        if (!sessionUser) return;
        const groupId = 'group_' + Date.now();
        const members = data.members;
        if (!members.includes(sessionUser)) members.push(sessionUser);
        db.groups[groupId] = { name: data.name, creator: sessionUser, members: members };
        saveDB();
        members.forEach(member => {
            const targetSocketId = usersOnline[member];
            if (targetSocketId) { const ts = io.sockets.sockets.get(targetSocketId); if (ts) sendGroupsList(ts); }
        });
    });

    socket.on('load_messages', (query) => {
        let history = [];
        if (query.type === 'news') {
            history = db.messages.filter(m => m.type === 'news');
        } else if (query.type === 'group') {
            const group = db.groups[query.id];
            if (group && group.members.includes(sessionUser)) history = db.messages.filter(m => m.type === 'group' && m.to === query.id);
        } else {
            history = db.messages.filter(m => m.type === 'private' && ((m.to === query.id && m.author === sessionUser) || (m.to === sessionUser && m.author === query.id)));
        }
        socket.emit('messages_history', history);
    });

    socket.on('send_msg', (data) => {
        if (data.type === 'news' && sessionUser !== 'Danumala') return;
        if (data.type === 'group') {
            const group = db.groups[data.to];
            if (!group || !group.members.includes(sessionUser)) return;
        }
        const newMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            type: data.type,
            to: data.to,
            author: sessionUser,
            text: data.text || '',
            image: data.image || null,
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
            time: new Date().toISOString(),
            read: false
        };
        db.messages.push(newMsg);
        saveDB();
        if (data.type === 'news') {
            io.emit('new_msg', newMsg);
        } else if (data.type === 'group') {
            const group = db.groups[data.to];
            group.members.forEach(member => { const ts = usersOnline[member]; if (ts) io.to(ts).emit('new_msg', newMsg); });
        } else {
            const ts = usersOnline[data.to];
            if (ts) {
                io.to(ts).emit('new_msg', newMsg);
                const targetSocket = io.sockets.sockets.get(ts);
                if (targetSocket) sendActiveChatsAndFriends(targetSocket, data.to);
            }
            socket.emit('new_msg', newMsg);
            sendActiveChatsAndFriends(socket, sessionUser);
        }
    });

    socket.on('mark_as_read', (data) => {
        let changed = false;
        db.messages.forEach(m => { if (m.type === 'private' && m.author === data.chatWith && m.to === sessionUser && !m.read) { m.read = true; changed = true; } });
        if (changed) { saveDB(); const ts = usersOnline[data.chatWith]; if (ts) io.to(ts).emit('chat_read_by_recipient', { readBy: sessionUser }); }
    });

    socket.on('typing_status', (data) => { if (data.type === 'private') { const ts = usersOnline[data.to]; if (ts) io.to(ts).emit('user_typing_broadcast', { from: sessionUser, isTyping: data.isTyping }); } });

    socket.on('req_delete_message', (data) => {
        const msgIndex = db.messages.findIndex(m => m.id === data.messageId);
        if (msgIndex !== -1) {
            const msg = db.messages[msgIndex];
            if (data.user === 'Danumala' || msg.author === data.user) { db.messages.splice(msgIndex, 1); saveDB(); io.emit('msg_deleted', data.messageId); }
        }
    });

    socket.on('disconnect', () => {
        if (sessionUser && usersOnline[sessionUser] === socket.id) {
            delete usersOnline[sessionUser];
            Object.keys(usersOnline).forEach(u => {
                const targetSocket = io.sockets.sockets.get(usersOnline[u]);
                if (targetSocket) sendActiveChatsAndFriends(targetSocket, u);
            });
        }
    });
});

server.listen(PORT, () => { console.log(`Сервер запущен на порту ${PORT}`); });
