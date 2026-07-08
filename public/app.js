// Новые DOM-элементы
const createGroupPlus = document.getElementById('create-group-plus');
const createGroupModal = document.getElementById('create-group-modal');
const closeGroupModal = document.getElementById('close-group-modal');
const groupNameInput = document.getElementById('group-name-input');
const groupMembersList = document.getElementById('group-members-list');
const createGroupBtn = document.getElementById('create-group-btn');

let selectedMembers = new Set();
let allOnlineUsers = [];

// Добавь этот код в конец секции с обработчиками:

// ========== СОЗДАНИЕ ГРУППЫ ==========
createGroupPlus.addEventListener('click', () => {
  selectedMembers.clear();
  groupNameInput.value = '';
  renderGroupMemberList();
  createGroupModal.style.display = 'flex';
});

closeGroupModal.addEventListener('click', () => {
  createGroupModal.style.display = 'none';
});

function renderGroupMemberList() {
  groupMembersList.innerHTML = '';
  allOnlineUsers
    .filter(u => u !== currentUser)
    .forEach(username => {
      const div = document.createElement('div');
      div.className = 'group-member-item';
      div.dataset.user = username;
      if (selectedMembers.has(username)) {
        div.classList.add('selected');
      }
      div.innerHTML = `
        <div class="avatar">${username.charAt(0).toUpperCase()}</div>
        <span class="contact-name">${username}</span>
        <span class="check-mark">✓</span>
      `;
      div.addEventListener('click', () => {
        if (selectedMembers.has(username)) {
          selectedMembers.delete(username);
          div.classList.remove('selected');
        } else {
          selectedMembers.add(username);
          div.classList.add('selected');
        }
      });
      groupMembersList.appendChild(div);
    });
}

// Обновляем список всех пользователей при каждом обновлении
socket.on('online users', users => {
  allOnlineUsers = users;
  renderContacts(users.filter(u => u !== currentUser));
});

createGroupBtn.addEventListener('click', () => {
  const groupName = groupNameInput.value.trim();
  if (!groupName) {
    alert('Введите название группы');
    return;
  }
  if (selectedMembers.size === 0) {
    alert('Выберите хотя бы одного участника');
    return;
  }

  // Создаём группу локально (серверную логику можно добавить позже)
  const members = Array.from(selectedMembers);
  const room = [currentUser, ...members].sort().join(':');
  
  // Добавляем группу в список чатов
  const groupDiv = document.createElement('div');
  groupDiv.className = 'contact-item';
  groupDiv.dataset.user = groupName;
  groupDiv.dataset.room = room;
  groupDiv.dataset.isGroup = 'true';
  groupDiv.innerHTML = `
    <div class="avatar">${groupName.charAt(0).toUpperCase()}</div>
    <div class="contact-info">
      <div class="contact-name">${groupName}</div>
      <div class="contact-last">Группа: ${members.join(', ')}</div>
    </div>
  `;
  groupDiv.addEventListener('click', () => {
    openChat(groupName, room);
  });
  contactsList.prepend(groupDiv);

  // Закрываем модалку
  createGroupModal.style.display = 'none';
  selectedMembers.clear();
});
