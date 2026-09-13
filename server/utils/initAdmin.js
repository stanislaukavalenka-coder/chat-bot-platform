const bcrypt = require('bcrypt');
const { getSheetData, appendSheetData } = require('../sheets');
const { serializePermissions, ROLE_PRESETS } = require('../permissions');

async function ensureFirstAdmin() {
  try {
    const managers = await getSheetData('Managers!A:J');
    const hasActive = managers.some(row => row[0] && row[5] === 'admin' && (row[6] === 'TRUE' || row[6] === true));
    if (hasActive) {
      console.log('✅ Администратор уже существует');
      return;
    }

    const email = (process.env.ADMIN_EMAIL || process.env.SMTP_USER || '').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    if (!email) {
      console.error('❌ ADMIN_EMAIL или SMTP_USER не задан — не могу создать первого админа');
      return;
    }

    const hash = await bcrypt.hash(password, 10);
    await appendSheetData('Managers!A:J', [
      [
        1,
        'Администратор',
        '',
        email,
        hash,
        'admin',
        'TRUE',
        serializePermissions(ROLE_PRESETS.admin),
        new Date().toISOString(),
        '',
      ],
    ]);

    console.log(`✅ Создан первый администратор: ${email} (пароль: ${password})`);
  } catch (err) {
    console.error('Ошибка создания первого админа:', err.message);
  }
}

module.exports = { ensureFirstAdmin };
