const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');

router.get('/subscriptions', auth, async (req, res) => {
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    const subs = data.filter(row => row[0]).map(row => ({
      subscription: JSON.parse(row[0]),
      userId: row[1]
    }));
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения подписок' });
  }
});

router.post('/subscribe', auth, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id || 'admin';
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Неверные данные подписки' });
  }
  try {
    const existing = await getSheetData('PushSubscriptions!A:B');
    const rowIndex = existing.findIndex(row => row[1] === userId) + 2;
    if (rowIndex >= 2) {
      await updateSheetData(`PushSubscriptions!A${rowIndex}:B${rowIndex}`, [
        [JSON.stringify(subscription), userId]
      ]);
    } else {
      await appendSheetData('PushSubscriptions!A:B', [
        [JSON.stringify(subscription), userId]
      ]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сохранения подписки' });
  }
});

router.delete('/unsubscribe', auth, async (req, res) => {
  const userId = req.user.id || 'admin';
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    const rowIndex = data.findIndex(row => row[1] === userId) + 2;
    if (rowIndex >= 2) {
      await updateSheetData(`PushSubscriptions!A${rowIndex}:B${rowIndex}`, [['', '']]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отписки' });
  }
});

module.exports = router;
