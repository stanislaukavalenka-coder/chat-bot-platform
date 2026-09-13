const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const authMw = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');
const { parsePermissions, serializePermissions, ROLE_PRESETS } = require('../permissions');
const { generatePassword, isValidEmail, normalizeEmail } = require('../utils/generate');

// Все роуты — только для админа
router.use(authMw);
router.use(authMw.requireAdmin);

// ---------- GET /api/managers ----------
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

// ---------- POST /api/managers — создать ----------
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
    const existing = managers.find(row => row[3] && row[3].toString().toLowerCase() === normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'Email уже используется' });
    }

    const password = generatePassword(10);
    const hash = await bcrypt.hash(password, 10);

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

    // Возвращаем пароль в ответе — админ скопирует и передаст вручную
    res.json({
      success: true,
      id: newId,
      tempPassword: password,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания менеджера' });
  }
});

// ---------- PUT /api/managers/:id — обновить ----------
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const { firstName, lastName, role, permissions, active } = req.body;

  try {
    const managers = await getSheetData('Managers!A:J');
    const rowIndex = managers.findIndex(row => row[0] && row[0].toString() === id.toString()) + 2;
    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Менеджер не найден' });
    }

    const isSelf = String(req.user.id) === String(id);

    if (isSelf && role && role !== 'admin') {
      return res.status(400).json({ error: 'Нельзя снять с себя роль администратора' });
    }
    if (isSelf && permissions && !permissions.managers) {
      return res.status(400).json({ error: 'Нельзя снять с себя право управления менеджерами' });
    }
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

    const password = generatePassword(10);
    const hash = await bcrypt.hash(password, 10);
    await updateSheetData(`Managers!E${rowIndex}:E${rowIndex}`, [[hash]]);

    // Возвращаем новый пароль — админ скопирует и передаст вручную
    res.json({ success: true, tempPassword: password });
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

    const admins = managers.filter(row => row[5] === 'admin' && (row[6] === 'TRUE' || row[6] === true));
    const target = managers[rowIndex - 2];
    if (target[5] === 'admin' && admins.length <= 1) {
      return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
    }

    await updateSheetData(`Managers!A${rowIndex}:J${rowIndex}`, [['', '', '', '', '', '', '', '', '', '']]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

module.exports = router;
