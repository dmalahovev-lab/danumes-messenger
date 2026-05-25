// Функция saveEdit - исправлена (меню закрывается)
async function saveEdit(messageId) {
    const input = document.getElementById('editInput');
    const newText = input?.value.trim();
    if (newText && newText !== messages.find(m => m.id === messageId)?.text) {
        const result = await api('PUT', `/edit-message/${messageId}`, { text: newText });
        if (result.success) {
            editingMessageId = null;
            await loadMessages();
            showToast('Сообщение изменено', 'success');
        } else {
            showToast('Ошибка редактирования', 'error');
        }
    }
    editingMessageId = null;
    loadMessages(); // Перезагружаем чтобы убрать поле редактирования
}

// Функция renderMessages - реакции обновляются в реальном времени
// (уже есть в полном коде выше)

// Функция selectChat - исправлена
function selectChat(chatId, type, groupId = null) {
    if (currentChat === chatId && currentChatType === type) return;
    
    currentChat = chatId;
    currentChatType = type;
    currentGroupId = groupId;
    editingMessageId = null;
    
    if (type === 'user') {
        const user = allUsers.find(u => u.username === chatId);
        currentChatAvatar = user?.avatar || '👤';
    } else {
        currentChatAvatar = '👥';
    }
    
    renderSidebar();
    renderChatArea();
    loadMessages();
}
