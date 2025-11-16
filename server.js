const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Инициализация базы данных
const db = new sqlite3.Database('./festival.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к БД:', err);
  } else {
    console.log('Подключено к базе данных SQLite');
    initDatabase();
  }
});

// Создание таблиц
function initDatabase() {
  db.serialize(() => {
    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      is_admin INTEGER DEFAULT 0,
      theme TEXT DEFAULT 'light',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица мероприятий
    db.run(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration INTEGER NOT NULL,
      description TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Таблица регистраций на мероприятия
    db.run(`CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(id),
      UNIQUE(user_id, event_id)
    )`);

    // Создаем администратора по умолчанию
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (name, email, password, is_admin) 
            VALUES ('Администратор', 'admin@festival.ru', ?, 1)`, [adminPassword]);
  });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'festival-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Проверка авторизации
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  next();
}

// Проверка прав администратора
function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Требуются права администратора' });
  }
  next();
}

// === МАРШРУТЫ АУТЕНТИФИКАЦИИ ===

// Регистрация
app.post('/api/register', async (req, res) => {
  const { name, email, password, phone, isAdmin } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const is_admin = isAdmin ? 1 : 0;

    db.run(
      `INSERT INTO users (name, email, password, phone, is_admin) VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, phone, is_admin],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email уже зарегистрирован' });
          }
          return res.status(500).json({ error: 'Ошибка регистрации' });
        }
        res.json({ success: true, message: 'Регистрация успешна' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.is_admin === 1,
        theme: user.theme
      }
    });
  });
});

// Выход
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Получить текущего пользователя
app.get('/api/user', requireAuth, (req, res) => {
  db.get('SELECT id, name, email, phone, is_admin, theme, created_at FROM users WHERE id = ?', 
    [req.session.userId], 
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json({
        ...user,
        isAdmin: user.is_admin === 1
      });
    }
  );
});

// Обновить тему
app.put('/api/user/theme', requireAuth, (req, res) => {
  const { theme } = req.body;
  
  db.run('UPDATE users SET theme = ? WHERE id = ?', 
    [theme, req.session.userId], 
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка обновления темы' });
      }
      res.json({ success: true, theme });
    }
  );
});

// === МАРШРУТЫ МЕРОПРИЯТИЙ ===

// Получить все мероприятия
app.get('/api/events', requireAuth, (req, res) => {
  db.all('SELECT * FROM events ORDER BY date, start_time', [], (err, events) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка получения мероприятий' });
    }
    res.json(events);
  });
});

// Создать мероприятие (только админ)
app.post('/api/events', requireAdmin, (req, res) => {
  const { name, type, location, date, start_time, duration, description } = req.body;

  if (!name || !type || !location || !date || !start_time || !duration) {
    return res.status(400).json({ error: 'Заполните все обязательные поля' });
  }

  db.run(
    `INSERT INTO events (name, type, location, date, start_time, duration, description, created_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, type, location, date, start_time, duration, description, req.session.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Ошибка создания мероприятия' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Удалить мероприятие (только админ)
app.delete('/api/events/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM events WHERE id = ?', [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка удаления мероприятия' });
    }
    db.run('DELETE FROM registrations WHERE event_id = ?', [req.params.id]);
    res.json({ success: true });
  });
});

// === МАРШРУТЫ РЕГИСТРАЦИЙ ===

// Получить регистрации пользователя
app.get('/api/registrations', requireAuth, (req, res) => {
  db.all(
    `SELECT e.*, r.registered_at 
     FROM registrations r 
     JOIN events e ON r.event_id = e.id 
     WHERE r.user_id = ? 
     ORDER BY e.date, e.start_time`,
    [req.session.userId],
    (err, registrations) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка получения регистраций' });
      }
      res.json(registrations);
    }
  );
});

// Зарегистрироваться на мероприятие
app.post('/api/registrations', requireAuth, (req, res) => {
  const { eventId } = req.body;

  db.run(
    'INSERT INTO registrations (user_id, event_id) VALUES (?, ?)',
    [req.session.userId, eventId],
    (err) => {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Вы уже зарегистрированы на это мероприятие' });
        }
        return res.status(500).json({ error: 'Ошибка регистрации' });
      }
      res.json({ success: true });
    }
  );
});

// Отменить регистрацию
app.delete('/api/registrations/:eventId', requireAuth, (req, res) => {
  db.run(
    'DELETE FROM registrations WHERE user_id = ? AND event_id = ?',
    [req.session.userId, req.params.eventId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка отмены регистрации' });
      }
      res.json({ success: true });
    }
  );
});

// Статистика для админа
app.get('/api/stats', requireAdmin, (req, res) => {
  db.get('SELECT COUNT(*) as total_events FROM events', [], (err, events) => {
    db.get('SELECT COUNT(*) as total_users FROM users', [], (err2, users) => {
      db.get('SELECT COUNT(*) as total_registrations FROM registrations', [], (err3, registrations) => {
        res.json({
          events: events.total_events,
          users: users.total_users,
          registrations: registrations.total_registrations
        });
      });
    });
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});