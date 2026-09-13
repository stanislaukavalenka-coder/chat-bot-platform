const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const authMw = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');
const { parsePermissions, serializePermissions, ROLE_PRESETS } = require('../permissions');
const { generatePassword, isValidEmail, normalizeEmail } = require('../utils/generate');
const { sendInvite } = require('../email');

// Все роуты — только для админа (кроме /me, он в auth.js)
router.use(authMw);
router.use(authMw.requireAdmin);

// ---------- GET /api/managers — список ----------
router.get('/', async (req, res) => {
  try {
    const managers = await getSheetData('Managers!A:J');
    const list = managers
      .filter(row => row[0])
      .map(row => ({
        id: row[0],
        firstName: row[1] || '',
        lastName: row[2] || '',
        name: [row[1], row[2]].filter(Boolean).join(' ') || row[3],
        email: row[3],
        role: row[5] || 'manager',
        active: row[6] === 'TRUE' || row[6] === true,
        permissions: parsePermissions(row[7]),
        invitedAt: row[8] || '',
        lastLogin: row[9] || '',
      }));
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки менеджеров' });
  }
});

// ---------- POST /api/managers — создать менеджера ----------
router.post('/', async (req, res) => {
  const { firstName, lastName, email, role, permissions } = req.body;

  if (!firstName || !email) {
    return res.status(400).json({ error: 'Имя и email обязательны' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Некорректный email' });
  }

  const normalizedEmail = normalizeEmail(email);
  const finalRole = role || 'manager';
  const finalPermissions = permissions || ROLE_PRESETS[finalRole] || ROLE_PRESETS.manager;

  try {
    const managers = await getSheetData('Managers!A:J');
    // Проверка на уникальность email
    const existing = managers.find(row => row[3] && row[3].toString().toLowerCase() === normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email уже используется' });
    }

    // Генерируем пароль
    const password = generatePassword(10);
    const hash = await bcrypt.hash(password, 10);

    // Новый id
    const ids = managers.map(row => parseInt(row[0]) || 0);
    const newId = Math.max(0, ...ids) + 1;

    await appendSheetData('Managers!A:J', [
      [
        newId,
        firstName,
        lastName || '',
        normalizedEmail,
        hash,
        finalRole,
        'TRUE',
        serializePermissions(finalPermissions),
        new Date().toISOString(),
        '',
      ],
    ]);

    // Отправляем приглашение
    let emailSent = true;
    let emailError = '';
    try {
      await sendInvite({
        email: normalizedEmail,
        firstName,
        password,
        botName: process.env.BOT_NAME || 'Чат-бот',
        appUrl: process.env.APP_URL || 'https://chat-bot-platform-8mge.onrender.com',
      });
    } catch (mailErr) {
      console.error('Ошибка отправки приглашения:', mailErr);
      emailSent = false;
      emailError = mailErr.message;
    }

    res.json({
      success: true,
      id: newId,
      emailSent,
      emailError,
      // В ответе возвращаем пароль, чтобы админ мог сообщить его вручную, если письмо не ушло
      tempPassword: emailSent ? undefined : password,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания менеджера' });
  }
});

// ---------- PUT /api/managers/:id — обновить данные ----------
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const { firstName, lastName, role, permissions, active } = req.body;

  try {
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === id.toString()) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Менеджер не найден' });
    }

    const manager = managers[rowIndex - 2];
    const isSelf = String(req.user.id) === String(id);

    // Защита: админ не может снять себе роль admin
    if (isSelf && role && role !== 'admin') {
      return res.status(400).json({ error: 'Нельзя снять с себя роль администратора' });
    }

    // Защита: админ не может снять себе право managers
    if (isSelf && permissions && !permissions.managers) {
      return res.status(400).json({ error: 'Нельзя снять с себя право управления менеджерами' });
    }

    // Защита: нельзя отключить себя
    if (isSelf && active === false) {
      return res.status(400).json({ error: 'Нельзя отключить свой аккаунт' });
    }

    if (firstName !== undefined) await updateSheetData(`Managers!B${rowIndex}:B${rowIndex}`, [[firstName]]);
    if (lastName !== undefined) await updateSheetData(`Managers!C${rowIndex}:C${rowIndex}`, [[lastName]]);
    if (role !== undefined) await updateSheetData(`Managers!F${rowIndex}:F${rowIndex}`, [[role]]);
    if (active !== undefined) await updateSheetData(`Managers!G${rowIndex}:G${rowIndex}`, [[active ? 'TRUE' : 'FALSE']]);
    if (permissions !== undefined) await updateSheetData(`Managers!H${rowIndex}:H${rowIndex}`, [[serializePermissions(permissions)]]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// ---------- PUT /api/managers/:id/password — сбросить пароль ----------
router.put('/:id/password', async (req, res) => {
  const id = req.params.id;
  try {
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === id.toString()) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Менеджер не найден' });
    }

    const manager = managers[rowIndex - 2];
    const password = generatePassword(10);
    const hash = await bcrypt.hash(password, 10);
    await updateSheetData(`Managers!E${rowIndex}:E${rowIndex}`, [[hash]]);

    // Отправляем письмо
    const { sendPasswordReset } = require('../email');
    let emailSent = true;
    try {
      await sendPasswordReset({
        email: manager[3],
        firstName: manager[1] || 'коллега',
        password,
        appUrl: process.env.APP_URL || 'https://chat-bot-platform-8mge.onrender.com',
      });
    } catch (mailErr) {
      console.error('Ошибка отправки письма:', mailErr);
      emailSent = false;
    }

    res.json({ success: true, emailSent, tempPassword: emailSent ? undefined : password });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
});

// ---------- DELETE /api/managers/:id ----------
router.delete('/:id', async (req, res) => {
  const id = req.params.id;

  if (String(req.user.id) === String(id)) {
    return res.status(400).json({ error: 'Нельзя удалить себя' });
  }

  try {
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === id.toString()) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Менеджер не найден' });
    }

    // Проверка: не последний ли это админ
    const admins = managers.filter(row => row[5] === 'admin' && (row[6] === 'TRUE' || row[6] === true));
    const targetManager = managers[rowIndex - 2];
    if (targetManager[5] === 'admin' && admins.length <= 1) {
      return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
    }

    // Очищаем строку (не удаляем — на случай восстановления)
    await updateSheetData(`Managers!A${rowIndex}:J${rowIndex}`, [['', '', '', '', '', '', '', '', '', '']]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = router;
