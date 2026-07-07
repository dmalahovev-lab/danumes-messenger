// Автоматическая загрузка иконок и настроек темы
window.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  const savedGlassMode = localStorage.getItem('glassMode');
  if (savedGlassMode === 'false') {
    document.body.classList.remove('glass-mode');
  }
});

// Клик по чату: на ПК просто переключает активный элемент, на мобилке — сдвигает экраны
function selectChat(chatId) {
  console.log("Выбран чат:", chatId);
  
  // Для мобильных устройств: активируем слайд-эффект переключения
  const panelChats = document.getElementById('panel-chats');
  const panelDialog = document.getElementById('panel-dialog');
  
  if (window.innerWidth <= 768) {
    panelChats.classList.add('mobile-left');
    panelDialog.classList.remove('mobile-hidden');
  }
}

// Кнопка Назад на мобильных телефонах
function closeChatMobile() {
  const panelChats = document.getElementById('panel-chats');
  const panelDialog = document.getElementById('panel-dialog');
  
  panelChats.classList.remove('mobile-left');
  panelDialog.classList.add('mobile-hidden');
}

// Включение/выключение стеклянного эффекта
function toggleGlassEffect() {
  const body = document.body;
  body.classList.toggle('glass-mode');
  const isGlass = body.classList.contains('glass-mode');
  localStorage.setItem('glassMode', isGlass);
}

// Изменение состояния кнопки отправки при вводе текста (Микрофон -> Стрелочка)
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const micIcon = document.getElementById('mic-icon');

messageInput.addEventListener('input', (e) => {
  const text = e.target.value.trim();
  
  if (text.length > 0) {
    btnSend.style.background = 'var(--accent-blue)';
    micIcon.setAttribute('data-lucide', 'arrow-up');
  } else {
    btnSend.style.background = 'var(--island-bg)';
    micIcon.setAttribute('data-lucide', 'mic');
  }
  lucide.createIcons();
});

// Отправка сообщений по Enter
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (text.length > 0) {
      sendMessage(text);
    }
  }
});

function sendMessage(text) {
  console.log("Отправка сообщения:", text);
  messageInput.value = '';
  btnSend.style.background = 'var(--island-bg)';
  micIcon.setAttribute('data-lucide', 'mic');
  lucide.createIcons();
}
