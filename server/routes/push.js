const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');

// GET /api/push/subscriptions
router.get('/subscriptions', auth, async (req, res) => {
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    const subs = data
      .filter(row => row[0] && row[0].trim() !== '' && row[0].trim() !== 'subscription')
      .map(row => {
        try { return { subscription: JSON.parse(row[0]), userId: row[1] }; }
        catch { return null; }
      })
      .filter(Boolean);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения подписок' });
  }
});

// POST /api/push/subscribe
router.post('/subscribe', auth, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id || 'admin';
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Неверные данные подписки' });
  }
  try {
    const data = await getSheetData('PushSubscriptions!A:B');

    // Ищем все строки с этим userId
    const userRows = [];
    data.forEach((row, idx) => {
      if (row[1] === userId) {
        let endpoint = null;
        try { endpoint = JSON.parse(row[0]).endpoint; } catch {}
        userRows.push({ idx, endpoint });
      }
    });

    const sameEndpoint = userRows.find(r => r.endpoint === subscription.endpoint);

    if (sameEndpoint) {
      // Обновляем существующую подписку
      const rowNum = sameEndpoint.idx + 2;
      await updateSheetData(`PushSubscriptions!A${rowNum}:B${rowNum}`, [
        [JSON.stringify(subscription), userId]
      ]);
    } else {
      // Удаляем все старые подписки этого пользователя и добавляем новую
      for (const r of userRows) {
        const rowNum = r.idx + 2;
        await updateSheetData(`PushSubscriptions!A${rowNum}:B${rowNum}`, [['', '']]);
      }
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

// DELETE /api/push/unsubscribe
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
