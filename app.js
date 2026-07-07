// Переключение между экранами с плавной анимацией iOS слайдинга
function switchScreen(screenId) {
  // Находим оба экрана приложения
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
  
  // Сохраняем выбор пользователя в память браузера, чтобы он не сбрасывался при перезагрузке
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
    // Если пользователь начал писать текст, плавно меняем микрофон на стрелочку отправки
    btnSend.style.background = 'var(--accent-blue)';
    micIcon.setAttribute('data-lucide', 'arrow-up');
  } else {
    // Если поле пустое, возвращаем микрофон и стандартный цвет графита
    btnSend.style.background = 'var(--island-bg)';
    micIcon.setAttribute('data-lucide', 'mic');
  }
  // Перерисовываем иконки библиотеки Lucide, чтобы изменения применились
  lucide.createIcons();
});

// Считываем сохраненные настройки стеклянного эффекта при запуске приложения
window.addEventListener('DOMContentLoaded', () => {
  const savedGlassMode = localStorage.getItem('glassMode');
  if (savedGlassMode === 'false') {
    document.body.classList.remove('glass-mode');
  }
});
