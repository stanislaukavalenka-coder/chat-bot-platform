const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const { getSheetData, updateSheetData } = require('../sheets');
const { parsePermissions, serializePermissions, ROLE_PRESETS } = require('../permissions');
const { generatePassword } = require('../utils/generate');
const { sendPasswordReset } = require('../email');

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const managers = await getSheetData('Managers!A:J');
    // Ищем менеджера по email (столбец D)
    const rowIndex = managers.findIndex(row => row[3] && row[3].toString().toLowerCase() === normalizedEmail) + 2;

    if (rowIndex < 2) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    const manager = managers[rowIndex - 2];
    const isActive = manager[6] === 'TRUE' || manager[6] === true;
    if (!isActive) {
      return res.status(403).json({ error: 'Аккаунт отключён' });
    }

    const passwordHash = manager[4];
    if (!passwordHash) {
      return res.status(401).json({ error: 'Пароль не установлен' });
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const permissions = parsePermissions(manager[7]);
    const payload = {
      id: manager[0],
      name: [manager[1], manager[2]].filter(Boolean).join(' ') || manager[3],
      firstName: manager[1] || '',
      lastName: manager[2] || '',
      email: manager[3],
      role: manager[5] || 'manager',
      permissions,
    };

    // Обновляем last_login
    await updateSheetData(`Managers!J${rowIndex}:J${rowIndex}`, [[new Date().toISOString()]]);

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: payload });
  } catch (err) {
    console.error('Ошибка логина:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- GET /api/auth/me ----------
router.get('/me', auth, async (req, res) => {
  try {
    // Перечитываем из таблицы, чтобы подтянуть актуальные данные
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === req.user.id.toString());
    if (rowIndex === -1) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const manager = managers[rowIndex];
    const permissions = parsePermissions(manager[7]);
    res.json({
      id: manager[0],
      firstName: manager[1] || '',
      lastName: manager[2] || '',
      name: [manager[1], manager[2]].filter(Boolean).join(' ') || manager[3],
      email: manager[3],
      role: manager[5] || 'manager',
      permissions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ---------- PUT /api/auth/me — изменить имя/фамилию ----------
router.put('/me', auth, async (req, res) => {
  const { firstName, lastName } = req.body;
  try {
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === req.user.id.toString()) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (firstName !== undefined) await updateSheetData(`Managers!B${rowIndex}:B${rowIndex}`, [[firstName]]);
    if (lastName !== undefined) await updateSheetData(`Managers!C${rowIndex}:C${rowIndex}`, [[lastName]]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// ---------- PUT /api/auth/password — сменить пароль (знает старый) ----------
router.put('/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  }
  try {
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === req.user.id.toString()) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const manager = managers[rowIndex - 2];
    const isValid = await bcrypt.compare(oldPassword, manager[4]);
    if (!isValid) {
      return res.status(401).json({ error: 'Неверный старый пароль' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await updateSheetData(`Managers!E${rowIndex}:E${rowIndex}`, [[hash]]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});

// ---------- POST /api/auth/forgot — забыл пароль ----------
// ---------- POST /api/auth/forgot ----------
// Email-отправка отключена. Просим обратиться к администратору.
router.post('/forgot', async (req, res) => {
  res.json({
    success: true,
    message: 'Обратитесь к администратору на почту stanislaukavalenka@gmail.com для сброса пароля',
  });
});

module.exports = router;
