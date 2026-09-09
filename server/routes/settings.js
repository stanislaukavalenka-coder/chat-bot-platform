const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');

// GET /api/settings – получить токен бота
router.get('/', auth, async (req, res) => {
  try {
    const settings = await getSheetData('Settings!A:B');
    const row = settings.find(r => r[0] === 'bot_token');
    const botToken = row ? row[1] : '';
    res.json({ botToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки настроек' });
  }
});

// PUT /api/settings – обновить токен бота
router.put('/', auth, async (req, res) => {
  const { botToken } = req.body;
  if (!botToken) {
    return res.status(400).json({ error: 'Токен обязателен' });
  }

  try {
    const settings = await getSheetData('Settings!A:B');
    const rowIndex = settings.findIndex(r => r[0] === 'bot_token') + 2;

    if (rowIndex >= 2) {
      await updateSheetData(`Settings!B${rowIndex}:B${rowIndex}`, [[botToken]]);
    } else {
      await appendSheetData('Settings!A:B', [['bot_token', botToken]]);
    }

    // Здесь можно было бы перезапустить бота с новым токеном, но для простоты просто сохраняем
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

module.exports = router;