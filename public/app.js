const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const socketUrl = protocol + window.location.host;

let socket;

function connectWebSocket() {
    socket = new WebSocket(socketUrl);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Если сообщение пришло от другого окна/пользователя
        if (data.sender !== 'me') {
            displayMessage(data.text, 'incoming');
        }
    };

    socket.onclose = () => {
        setTimeout(connectWebSocket, 3000);
    };
}

const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');

// Отправка сообщений
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        text: text,
        sender: 'me'
    };

    // Шлем на сервер
    socket.send(JSON.stringify(messageData));
    
    // Отрисовываем у себя как исходящее
    displayMessage(text, 'outgoing');
    
    messageInput.value = '';
    messageInput.focus();
});

function displayMessage(text, type) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', type);
    
    // Получаем текущее системное время в стиле iOS чатов
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    messageEl.innerHTML = `
        <span class="msg-text">${text}</span>
        <span class="msg-time">${timeStr}</span>
    `;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// --- ОЖИВЛЯЕМ КНОПКИ И ТАБЫ ---
document.getElementById('back-btn').addEventListener('click', () => alert('Переход назад к списку всех ЛС (в разработке)'));
document.getElementById('call-btn').addEventListener('click', () => alert('Звонок пользователю Test...'));

// Логика переключения вкладок внизу
const tabs = document.querySelectorAll('.tab-item');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        console.log(`Открыта вкладка: ${tab.querySelector('.tab-label').innerText}`);
    });
});

// Запуск сети
connectWebSocket();
