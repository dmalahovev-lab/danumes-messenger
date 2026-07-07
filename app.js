// Железобетонная инициализация иконок сразу после загрузки страницы
window.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  } else {
    console.error("Библиотека иконок Lucide не загрузилась.");
  }

  // Восстановление режима стекла из памяти
  const savedGlassMode = localStorage.getItem('glassMode');
  if (savedGlassMode === 'false') {
    document.body.classList.remove('glass-mode');
  }
});

// Переключение между экранами с плавной анимацией iOS слайдинга
function switchScreen(screenId) {
  const chatsScreen = document.getElementById('screen-chats');
  const dialogScreen = document.getElementById('screen-dialog');

  if (screenId === 'screen-dialog') {
    chatsScreen.classList.add('hidden');
    dialogScreen.classList.remove('hidden');
  } else {
    dialogScreen.classList.add('hidden');
    chatsScreen.classList.remove('hidden');
  }
}

// Функция-переключатель стеклянного режима (Liquid Glass)
function toggleGlassEffect() {
  const body = document.body;
  body.classList.toggle('glass-mode');
  
  const isGlass = body.classList.contains('glass-mode');
  localStorage.setItem('glassMode', isGlass);
}

// Логика изменения кнопки ввода текста (Микрофон <-> Отправить)
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

// Обработка отправки сообщения по нажатию клавиши Enter на ПК
messageInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    
    const text = messageInput.value.trim();
    if (text.length > 0) {
      sendMessage(text);
    }
  }
});

// Функция отправки (Пока временная заглушка до подключения сокетов)
function sendMessage(text) {
  console.log("Отправка сообщения:", text);
  messageInput.value = '';
  
  btnSend.style.background = 'var(--island-bg)';
  micIcon.setAttribute('data-lucide', 'mic');
  lucide.createIcons();
}
