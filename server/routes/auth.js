const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getSheetData } = require('../sheets');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Введите пароль' });
  }

  try {
    // Получаем хеш пароля из таблицы Settings (строка admin_password)
    const settings = await getSheetData('Settings!A:B');
    const row = settings.find(r => r[0] === 'admin_password');
    let storedHash = row ? row[1] : null;

    // Если в таблице нет пароля, используем из переменной окружения
    if (!storedHash) {
      storedHash = process.env.ADMIN_PASSWORD;
      if (!storedHash) {
        return res.status(500).json({ error: 'Пароль не настроен' });
      }
    }

    const isValid = await bcrypt.compare(password, storedHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const token = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;