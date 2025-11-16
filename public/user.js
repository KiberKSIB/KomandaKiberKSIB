let allEvents = [];

let selectedEvents = [];

let userRegistrations = [];



// Проверка авторизации и инициализация

document.addEventListener('DOMContentLoaded', async () => {

    const user = checkAuth();

    if (!user) return;

    

    // Инициализация темы

    initTheme();

    addThemeToggle();

    

    // Отображаем приветствие

    document.getElementById('userGreeting').textContent = `Привет, ${user.name}!`;

    

    // Загружаем данные

    await loadEvents();

    await loadRegistrations();

    

    // Обработчики

    document.getElementById('searchInput').addEventListener('input', filterEvents);

    document.getElementById('typeFilter').addEventListener('change', filterEvents);

    document.getElementById('generateBtn').addEventListener('click', generateRoutes);

    document.getElementById('profileLink').addEventListener('click', (e) => {

        e.preventDefault();

        showProfileSection();

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



// Загрузка всех мероприятий

async function loadEvents() {

    try {

        const response = await fetch('/api/events');

        if (response.ok) {

            allEvents = await response.json();

            displayEvents(allEvents);

        }

    } catch (error) {

        console.error('Ошибка загрузки мероприятий:', error);

        alert('Не удалось загрузить мероприятия');

    }

}



// Загрузка регистраций пользователя

async function loadRegistrations() {

    try {

        const response = await fetch('/api/registrations');

        if (response.ok) {

            userRegistrations = await response.json();

        }

    } catch (error) {

        console.error('Ошибка загрузки регистраций:', error);

    }

}



// Отображение мероприятий

function displayEvents(events) {

    const list = document.getElementById('eventsList');

    

    if (events.length === 0) {

        list.innerHTML = '<p class="loading">Нет доступных мероприятий</p>';

        return;

    }

    

    list.innerHTML = events.map(event => `

        <div class="event-card ${selectedEvents.includes(event.id) ? 'selected' : ''}" 

             onclick="toggleEvent(${event.id})">

            <h4>${event.name}</h4>

            <div class="event-meta">

                <span class="event-tag">${event.type}</span>

                <span>📍 ${event.location}</span>

                <span>📅 ${formatDate(event.date)}</span>

                <span>🕐 ${event.start_time} (${event.duration} мин)</span>

            </div>

            ${event.description ? `<p style="margin-top: 10px; color: var(--text-secondary);">${event.description}</p>` : ''}

        </div>

    `).join('');

}



// Переключение выбора мероприятия

function toggleEvent(eventId) {

    const index = selectedEvents.indexOf(eventId);

    

    if (index === -1) {

        selectedEvents.push(eventId);

    } else {

        selectedEvents.splice(index, 1);

    }

    

    updateSelectedDisplay();

    document.getElementById('generateBtn').disabled = selectedEvents.length === 0;

}



// Обновление отображения выбранных мероприятий

function updateSelectedDisplay() {

    const count = document.getElementById('selectedCount');

    const list = document.getElementById('selectedList');

    

    count.textContent = selectedEvents.length;

    

    list.innerHTML = selectedEvents.map(id => {

        const event = allEvents.find(e => e.id === id);

        return `

            <div class="selected-item">

                <span>${event.name}</span>

                <button class="remove-btn" onclick="toggleEvent(${id})">✕</button>

            </div>

        `;

    }).join('');

    

    // Обновляем подсветку карточек

    document.querySelectorAll('.event-card').forEach(card => {

        const cardId = parseInt(card.getAttribute('onclick').match(/\d+/)[0]);

        card.classList.toggle('selected', selectedEvents.includes(cardId));

    });

}



// Фильтрация мероприятий

function filterEvents() {

    const search = document.getElementById('searchInput').value.toLowerCase();

    const type = document.getElementById('typeFilter').value;

    

    const filtered = allEvents.filter(event => {

        const matchSearch = !search || 

            event.name.toLowerCase().includes(search) ||

            event.location.toLowerCase().includes(search) ||

            event.description?.toLowerCase().includes(search);

        

        const matchType = !type || event.type === type;

        

        return matchSearch && matchType;

    });

    

    displayEvents(filtered);

}



// Генерация маршрутов

async function generateRoutes() {

    if (selectedEvents.length === 0) return;

    

    const events = selectedEvents.map(id => allEvents.find(e => e.id === id));

    

    // Группируем по дате

    const eventsByDate = events.reduce((acc, event) => {

        if (!acc[event.date]) acc[event.date] = [];

        acc[event.date].push(event);

        return acc;

    }, {});

    

    // Сортируем каждый день по времени

    Object.keys(eventsByDate).forEach(date => {

        eventsByDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time));

    });

    

    // Проверяем конфликты и создаем варианты

    const routes = [];

    

    for (const date in eventsByDate) {

        const dayEvents = eventsByDate[date];

        const validRoute = checkTimeConflicts(dayEvents);

        

        if (validRoute.length > 0) {

            routes.push({

                date,

                events: validRoute

            });

        }

    }

    

    // Регистрируем пользователя на выбранные мероприятия

    for (const eventId of selectedEvents) {

        try {

            await fetch('/api/registrations', {

                method: 'POST',

                headers: { 'Content-Type': 'application/json' },

                body: JSON.stringify({ eventId })

            });

        } catch (error) {

            console.error('Ошибка регистрации:', error);

        }

    }

    

    // Отображаем маршруты

    displayRoutes(routes);

}



// Проверка временных конфликтов

function checkTimeConflicts(events) {

    const validEvents = [];

    

    for (const event of events) {

        const eventStart = parseTime(event.start_time);

        const eventEnd = eventStart + event.duration;

        

        const hasConflict = validEvents.some(validEvent => {

            const validStart = parseTime(validEvent.start_time);

            const validEnd = validStart + validEvent.duration;

            

            return (eventStart < validEnd && eventEnd > validStart);

        });

        

        if (!hasConflict) {

            validEvents.push(event);

        }

    }

    

    return validEvents;

}



// Парсинг времени в минуты

function parseTime(timeStr) {

    const [hours, minutes] = timeStr.split(':').map(Number);

    return hours * 60 + minutes;

}



// Отображение маршрутов

function displayRoutes(routes) {

    const routesSection = document.getElementById('routesSection');

    const routesList = document.getElementById('routesList');

    

    if (routes.length === 0) {

        routesList.innerHTML = '<p class="loading">Не удалось построить маршрут без конфликтов</p>';

    } else {

        routesList.innerHTML = routes.map((route, index) => `

            <div class="route-card">

                <h3>Маршрут ${index + 1} - ${formatDate(route.date)}</h3>

                <div class="route-timeline">

                    ${route.events.map(event => `

                        <div class="timeline-item">

                            <div class="timeline-time">${event.start_time}</div>

                            <div class="timeline-content">

                                <h4>${event.name}</h4>

                                <p>${event.type} • ${event.location} • ${event.duration} мин</p>

                            </div>

                        </div>

                    `).join('')}

                </div>

            </div>

        `).join('');

    }

    

    document.getElementById('eventsSection').style.display = 'none';

    routesSection.style.display = 'block';

}



// Показать секцию мероприятий

function showEventsSection() {

    document.getElementById('routesSection').style.display = 'none';

    document.getElementById('profileSection').style.display = 'none';

    document.getElementById('eventsSection').style.display = 'block';

}



// Показать профиль

async function showProfileSection() {

    try {

        const response = await fetch('/api/user');

        const user = await response.json();

        

        document.getElementById('profileName').textContent = user.name;

        document.getElementById('profileEmail').textContent = user.email;

        document.getElementById('profilePhone').textContent = user.phone || 'Не указан';

        document.getElementById('profileDate').textContent = formatDate(user.created_at.split('T')[0]);

        

        // Загружаем зарегистрированные мероприятия

        const regResponse = await fetch('/api/registrations');

        const registrations = await regResponse.json();

        

        document.getElementById('registeredCount').textContent = registrations.length;

        

        const regList = document.getElementById('registeredEventsList');

        if (registrations.length === 0) {

            regList.innerHTML = '<p style="color: var(--text-secondary);">Нет записей</p>';

        } else {

            regList.innerHTML = registrations.map(event => `

                <div class="registered-event-item">

                    <div>

                        <h4>${event.name}</h4>

                        <p style="color: var(--text-secondary); font-size: 0.9rem;">

                            ${formatDate(event.date)} • ${event.start_time} • ${event.location}

                        </p>

                    </div>

                    <button class="btn btn-danger btn-small" onclick="cancelRegistration(${event.id})">

                        Отменить

                    </button>

                </div>

            `).join('');

        }

        

        document.getElementById('eventsSection').style.display = 'none';

        document.getElementById('routesSection').style.display = 'none';

        document.getElementById('profileSection').style.display = 'block';

    } catch (error) {

        console.error('Ошибка загрузки профиля:', error);

        alert('Не удалось загрузить профиль');

    }

}



// Отменить регистрацию

async function cancelRegistration(eventId) {

    if (!confirm('Вы уверены, что хотите отменить регистрацию?')) return;

    

    try {

        const response = await fetch(`/api/registrations/${eventId}`, {

            method: 'DELETE'

        });

        

        if (response.ok) {

            showProfileSection(); // Перезагружаем профиль

        } else {

            alert('Ошибка отмены регистрации');

        }

    } catch (error) {

        console.error('Ошибка:', error);

        alert('Ошибка отмены регистрации');

    }

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
async function generateRoutes() {
    if (selectedEvents.length === 0) return;
    
    const events = selectedEvents.map(id => allEvents.find(e => e.id === id));
    
    // Группируем по дате
    const eventsByDate = events.reduce((acc, event) => {
        if (!acc[event.date]) acc[event.date] = [];
        acc[event.date].push(event);
        return acc;
    }, {});
    
    // Генерируем все возможные маршруты для каждого дня
    const allRoutes = [];
    
    for (const date in eventsByDate) {
        const dayEvents = eventsByDate[date];
        
        // Сортируем по времени начала
        dayEvents.sort((a, b) => a.start_time.localeCompare(b.start_time));
        
        // Генерируем все возможные комбинации без конфликтов
        const dayRoutes = generateAllValidCombinations(dayEvents);
        
        // Добавляем дату к каждому маршруту
        dayRoutes.forEach(route => {
            allRoutes.push({
                date,
                events: route,
                score: calculateRouteScore(route)
            });
        });
    }
    
    // Сортируем маршруты по количеству мероприятий и времени
    allRoutes.sort((a, b) => b.score - a.score);
    
    // Берем топ-3 маршрута
    const topRoutes = allRoutes.slice(0, 3);
    
    // Регистрируем пользователя на выбранные мероприятия
    for (const eventId of selectedEvents) {
        try {
            await fetch('/api/registrations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId })
            });
        } catch (error) {
            console.error('Ошибка регистрации:', error);
        }
    }
    
    // Отображаем маршруты
    displayRoutes(topRoutes);
}

// Генерация всех валидных комбинаций мероприятий
function generateAllValidCombinations(events) {
    const allCombinations = [];
    
    // Рекурсивная функция для генерации комбинаций
    function generateCombinations(currentRoute, remainingEvents, startIndex) {
        // Добавляем текущий маршрут, если он не пустой
        if (currentRoute.length > 0) {
            allCombinations.push([...currentRoute]);
        }
        
        // Пробуем добавить каждое из оставшихся мероприятий
        for (let i = startIndex; i < remainingEvents.length; i++) {
            const nextEvent = remainingEvents[i];
            
            // Проверяем, нет ли конфликта с текущим маршрутом
            if (!hasTimeConflict(currentRoute, nextEvent)) {
                currentRoute.push(nextEvent);
                generateCombinations(currentRoute, remainingEvents, i + 1);
                currentRoute.pop();
            }
        }
    }
    
    generateCombinations([], events, 0);
    
    // Фильтруем и оставляем только уникальные и значимые маршруты
    return allCombinations
        .filter(route => route.length > 0)
        .sort((a, b) => b.length - a.length);
}

// Проверка конфликта времени для одного мероприятия с маршрутом
function hasTimeConflict(route, newEvent) {
    const newStart = parseTime(newEvent.start_time);
    const newEnd = newStart + newEvent.duration;
    
    return route.some(event => {
        const eventStart = parseTime(event.start_time);
        const eventEnd = eventStart + event.duration;
        
        return (newStart < eventEnd && newEnd > eventStart);
    });
}

// Вычисление оценки маршрута
function calculateRouteScore(route) {
    // Оценка = количество мероприятий * 100 + бонус за плотность расписания
    let score = route.length * 100;
    
    // Бонус за плотное расписание (меньше пустого времени между мероприятиями)
    if (route.length > 1) {
        for (let i = 0; i < route.length - 1; i++) {
            const currentEnd = parseTime(route[i].start_time) + route[i].duration;
            const nextStart = parseTime(route[i + 1].start_time);
            const gap = nextStart - currentEnd;
            
            // Небольшой перерыв (15-60 мин) - это хорошо
            if (gap >= 15 && gap <= 60) {
                score += 10;
            }
        }
    }
    
    return score;
}