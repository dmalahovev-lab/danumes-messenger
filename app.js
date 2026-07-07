// public/app.js

// Автоматически выбираем протокол (ws:// или wss:// для Render)
const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
const socketUrl = protocol + window.location.host;

let socket;

function connectWebSocket() {
    socket = new WebSocket(socketUrl);

    socket.onopen = () => {
        console.log('Успешно подключились к серверу Telegram Liquid!');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        displayMessage(data.text, data.type);
    };

    socket.onclose = () => {
        console.log('Соединение закрыто. Переподключение через 3 секунды...');
        setTimeout(connectWebSocket, 3000); // Авто-переподключение, если Render "уснул"
    };
}

const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');

// Генерация уникального ID для сессии, чтобы отличать свои сообщения от чужих
const mySessionId = Math.random().toString(36).substring(2, 9);

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    const messageData = {
        text: text,
        senderId: mySessionId
    };

    // Отправляем на сервер
    socket.send(JSON.stringify(messageData));
    
    // Сразу отображаем у себя как исходящее
    displayMessage(text, 'outgoing');
    
    messageInput.value = '';
    messageInput.focus();
});

function displayMessage(text, type) {
    // Если это сообщение пришло от сервера, проверяем тип
    // Для простоты в этой базовой версии сервер шлет данные всем.
    // Если мы сами его отправили, то повторно не добавляем incoming.
    
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', type);
    messageEl.innerText = text;
    
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Запуск подключения
connectWebSocket();
