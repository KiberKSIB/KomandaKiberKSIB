let allEvents = [];

// Проверка авторизации и инициализация
document.addEventListener('DOMContentLoaded', async () => {
    const user = checkAuth();
    if (!user || !user.isAdmin) {
        alert('Доступ запрещен');
        window.location.href = '/index.html';
        return;
    }
    
    // Инициализация темы
    initTheme();
    addThemeToggle();
    
    // Отображаем приветствие
    document.getElementById('adminGreeting').textContent = `Администратор: ${user.name}`;
    
    // Загружаем данные
    await loadEvents();
    await loadStats();
    
    // Обработчики
    document.getElementById('eventForm').addEventListener('submit', handleAddEvent);
    document.getElementById('adminSearchInput').addEventListener('input', filterEvents);
    document.getElementById('exportBtn').addEventListener('click', exportEvents);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllEvents);
    document.getElementById('adminProfileLink').addEventListener('click', (e) => {
        e.preventDefault();
        showAdminProfile();
    });
});

// Инициализация темы
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Добавление кнопки переключения темы
function addThemeToggle() {
    const header = document.querySelector('header');
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌓';
    themeToggle.onclick = toggleTheme;
    themeToggle.title = 'Переключить тему';
    header.appendChild(themeToggle);
}

// Переключение темы
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Сохраняем на сервере
    fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
    }).catch(err => console.error('Ошибка сохранения темы:', err));
}

// Загрузка мероприятий
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        if (response.ok) {
            allEvents = await response.json();
            displayEvents(allEvents);
            document.getElementById('totalEvents').textContent = allEvents.length;
        }
    } catch (error) {
        console.error('Ошибка загрузки мероприятий:', error);
        alert('Не удалось загрузить мероприятия');
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('statsEvents').textContent = stats.events;
            document.getElementById('statsUsers').textContent = stats.users;
            document.getElementById('statsRegistrations').textContent = stats.registrations;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Отображение мероприятий
function displayEvents(events) {
    const list = document.getElementById('adminEventsList');
    
    if (events.length === 0) {
        list.innerHTML = '<p class="loading">Нет мероприятий</p>';
        return;
    }
    
    list.innerHTML = events.map(event => `
        <div class="admin-event-card">
            <div class="admin-event-info">
                <h4>${event.name}</h4>
                <div class="event-meta">
                    <span class="event-tag">${event.type}</span>
                    <span>📍 ${event.location}</span>
                    <span>📅 ${formatDate(event.date)}</span>
                    <span>🕐 ${event.start_time}</span>
                    <span>⏱️ ${event.duration} мин</span>
                </div>
                ${event.description ? `<p style="margin-top: 10px; color: var(--text-secondary);">${event.description}</p>` : ''}
            </div>
            <div class="admin-event-actions">
                <button class="btn btn-danger btn-small" onclick="deleteEvent(${event.id})">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `).join('');
}

// Добавление мероприятия
async function handleAddEvent(e) {
    e.preventDefault();
    
    const eventData = {
        name: document.getElementById('eventName').value,
        type: document.getElementById('eventType').value,
        location: document.getElementById('eventLocation').value,
        date: document.getElementById('eventDate').value,
        start_time: document.getElementById('eventStartTime').value,
        duration: parseInt(document.getElementById('eventDuration').value),
        description: document.getElementById('eventDescription').value
    };
    
    try {
        const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });
        
        if (response.ok) {
            showSuccess('Мероприятие успешно добавлено!');
            document.getElementById('eventForm').reset();
            await loadEvents();
            await loadStats();
        } else {
            const data = await response.json();
            alert(data.error || 'Ошибка добавления мероприятия');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка подключения к серверу');
    }
}

// Удаление мероприятия
async function deleteEvent(id) {
    if (!confirm('Вы уверены, что хотите удалить это мероприятие?')) return;
    
    try {
        const response = await fetch(`/api/events/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showSuccess('Мероприятие удалено!');
            await loadEvents();
            await loadStats();
        } else {
            alert('Ошибка удаления мероприятия');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка удаления мероприятия');
    }
}

// Фильтрация мероприятий
function filterEvents() {
    const search = document.getElementById('adminSearchInput').value.toLowerCase();
    
    const filtered = allEvents.filter(event => 
        event.name.toLowerCase().includes(search) ||
        event.type.toLowerCase().includes(search) ||
        event.location.toLowerCase().includes(search) ||
        event.description?.toLowerCase().includes(search)
    );
    
    displayEvents(filtered);
}

// Экспорт мероприятий в JSON
function exportEvents() {
    const dataStr = JSON.stringify(allEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Очистка всех мероприятий
async function clearAllEvents() {
    if (!confirm('ВНИМАНИЕ! Это удалит ВСЕ мероприятия. Продолжить?')) return;
    if (!confirm('Вы абсолютно уверены? Это действие нельзя отменить!')) return;
    
    try {
        for (const event of allEvents) {
            await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
        }
        showSuccess('Все мероприятия удалены!');
        await loadEvents();
        await loadStats();
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка очистки мероприятий');
    }
}

// Показать профиль администратора
async function showAdminProfile() {
    try {
        const response = await fetch('/api/user');
        const user = await response.json();
        
        document.getElementById('adminProfileName').textContent = user.name;
        document.getElementById('adminProfileEmail').textContent = user.email;
        document.getElementById('adminProfilePhone').textContent = user.phone || 'Не указан';
        document.getElementById('adminProfileDate').textContent = formatDate(user.created_at.split('T')[0]);
        
        await loadStats();
        
        document.getElementById('managementSection').style.display = 'none';
        document.getElementById('adminProfileSection').style.display = 'block';
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить профиль');
    }
}

// Показать секцию управления
function showManagementSection() {
    document.getElementById('adminProfileSection').style.display = 'none';
    document.getElementById('managementSection').style.display = 'block';
}

// Показать сообщение об успехе
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message show';
    successDiv.textContent = message;
    
    const main = document.querySelector('main');
    main.insertBefore(successDiv, main.firstChild);
    
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Форматирование даты
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// Выход
function logout() {
    if (confirm('Вы действительно хотите выйти?')) {
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                localStorage.removeItem('user');
                window.location.href = '/index.html';
            });
    }
}