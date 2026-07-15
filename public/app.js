// ========================================
// ===== ТОЛЬКО ДИЗАЙН - МИНИМАЛЬНЫЙ JS =====
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Danumes - Только дизайн');

  // ===== ПЕРЕКЛЮЧЕНИЕ ТЕМ =====
  const themeButtons = document.querySelectorAll('.theme-selector button');
  
  themeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      // Убираем активный класс у всех
      themeButtons.forEach(b => b.classList.remove('active'));
      // Добавляем активный класс текущему
      this.classList.add('active');
      
      // Применяем тему
      const theme = this.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      
      // Показываем уведомление
      showToast(`🎨 Тема: ${theme}`);
    });
  });

  // ===== ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛКИ НАСТРОЕК =====
  const settingsBtn = document.querySelector('.icon-btn[title="Настройки"]');
  const settingsModal = document.getElementById('settingsModal');
  const settingsClose = settingsModal?.querySelector('.modal-close');
  const settingsOverlay = settingsModal?.querySelector('.modal-overlay');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
    });

    if (settingsClose) {
      settingsClose.addEventListener('click', () => {
        settingsModal.style.display = 'none';
      });
    }

    if (settingsOverlay) {
      settingsOverlay.addEventListener('click', () => {
        settingsModal.style.display = 'none';
      });
    }
  }

  // ===== ОТКРЫТИЕ/ЗАКРЫТИЕ МОДАЛКИ ИЗОБРАЖЕНИЙ =====
  const imageModal = document.getElementById('imageModal');
  const imageModalClose = imageModal?.querySelector('.modal-close');
  const imageOverlay = imageModal?.querySelector('.modal-overlay');

  // Клик по изображению в сообщении
  document.querySelectorAll('.image-message').forEach(img => {
    img.addEventListener('click', function() {
      if (imageModal) {
        const modalImg = imageModal.querySelector('img');
        if (modalImg) {
          modalImg.src = this.src;
        }
        imageModal.style.display = 'flex';
      }
    });
  });

  if (imageModalClose) {
    imageModalClose.addEventListener('click', () => {
      imageModal.style.display = 'none';
    });
  }

  if (imageOverlay) {
    imageOverlay.addEventListener('click', () => {
      imageModal.style.display = 'none';
    });
  }

  // ===== TOAST УВЕДОМЛЕНИЯ =====
  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ===== КНОПКА ВЫХОДА (демо) =====
  const logoutBtn = document.querySelector('.icon-btn[title="Выйти"]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Выйти из аккаунта?')) {
        showToast('👋 Выход из аккаунта');
      }
    });
  }

  // ===== КНОПКА "СОХРАНИТЬ" В НАСТРОЙКАХ =====
  const saveBtn = document.querySelector('.save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('✅ Настройки сохранены!');
    });
  }

  // ===== РЕАКЦИИ НА СООБЩЕНИЯ (демо) =====
  document.querySelectorAll('.reaction').forEach(reaction => {
    reaction.addEventListener('click', function() {
      this.classList.toggle('active');
      
      const count = this.querySelector('.count');
      if (count) {
        let num = parseInt(count.textContent) || 0;
        if (this.classList.contains('active')) {
          num += 1;
        } else {
          num -= 1;
        }
        count.textContent = num;
      }
    });
  });

  // ===== КНОПКИ ПРИНЯТЬ/ОТКЛОНИТЬ ЗАЯВКУ =====
  document.querySelectorAll('.accept-request-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const item = this.closest('.pending-request-item');
      const name = item?.querySelector('.request-name')?.textContent || 'Пользователь';
      showToast(`✅ Заявка от ${name} принята!`);
      item?.remove();
    });
  });

  document.querySelectorAll('.reject-request-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const item = this.closest('.pending-request-item');
      const name = item?.querySelector('.request-name')?.textContent || 'Пользователь';
      showToast(`👋 Заявка от ${name} отклонена`);
      item?.remove();
    });
  });

  // ===== ПЕРЕКЛЮЧЕНИЕ МЕЖДУ ВХОДОМ И РЕГИСТРАЦИЕЙ =====
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const loginPage = document.getElementById('loginPage');
  const registerPage = document.getElementById('registerPage');

  if (showRegister && loginPage && registerPage) {
    showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      loginPage.style.display = 'none';
      registerPage.style.display = 'flex';
    });
  }

  if (showLogin && loginPage && registerPage) {
    showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      loginPage.style.display = 'flex';
      registerPage.style.display = 'none';
    });
  }

  // ===== ФОРМЫ (демо) =====
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('✅ Вход выполнен! (демо)');
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
  });

  document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('✅ Регистрация успешна! (демо)');
    document.getElementById('registerPage').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
  });

  // ===== ПРИЛОЖЕНИЕ ПОКАЗАНО СРАЗУ =====
  // Если хочешь сразу видеть мессенджер без входа - раскомментируй:
  // document.getElementById('loginPage').style.display = 'none';
  // document.getElementById('app').style.display = 'flex';

  console.log('✅ Дизайн готов!');
});

// ===== ДОБАВЛЯЕМ СТИЛИ ДЛЯ TOAST =====
const toastStyles = document.createElement('style');
toastStyles.textContent = `
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: #fff;
    padding: 10px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    z-index: 99999;
    max-width: 90%;
    text-align: center;
    animation: toastIn 0.3s ease;
    backdrop-filter: blur(10px);
  }
  
  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }
`;
document.head.appendChild(toastStyles);
