// Инициализация темы
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Переключение темы
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Сохраняем тему на сервер, если пользователь авторизован
    if (localStorage.getItem('user')) {
        fetch('/api/user/theme', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: newTheme })
        }).catch(err => console.error('Ошибка сохранения темы:', err));
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    
    // Добавляем кнопку переключения темы
    const header = document.querySelector('header');
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌓';
    themeToggle.onclick = toggleTheme;
    themeToggle.title = 'Переключить тему';
    header.appendChild(themeToggle);
    
    const loginForm = document.getElementById('loginFormElement');
    const registerForm = document.getElementById('registerFormElement');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    // Переключение между формами
    showRegisterLink?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    });
    
    showLoginLink?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    });
    
    // Обработка входа
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Сохраняем данные пользователя
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Применяем сохраненную тему
                if (data.user.theme) {
                    document.documentElement.setAttribute('data-theme', data.user.theme);
                    localStorage.setItem('theme', data.user.theme);
                }
                
                // Перенаправляем в зависимости от роли
                if (data.user.isAdmin) {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/user.html';
                }
            } else {
                alert(data.error || 'Ошибка входа');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка подключения к серверу');
        }
    });
    
    // Обработка регистрации
    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const phone = document.getElementById('regPhone').value;
        
        if (password.length < 6) {
            alert('Пароль должен содержать минимум 6 символов');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Регистрация успешна! Теперь войдите в систему.');
                document.getElementById('registerForm').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';
                registerForm.reset();
            } else {
                alert(data.error || 'Ошибка регистрации');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка подключения к серверу');
        }
    });
});

// Проверка авторизации
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) {
        window.location.href = '/index.html';
        return null;
    }
    return user;
}

// Выход из системы
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Ошибка выхода:', error);
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    }
}