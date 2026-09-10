const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { bot } = require('../bot');

// Временное хранилище прогресса рассылок (в памяти)
// При перезапуске сервера сбрасывается — это нормально для MVP
const broadcasts = new Map();

// ---------- ФУНКЦИЯ ОТПРАВКИ В ФОНЕ ----------
async function runBroadcast(broadcastId, chatIds, text) {
  const broadcast = broadcasts.get(broadcastId);
  if (!broadcast) return;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (const chatId of chatIds) {
    try {
      await bot.api.sendMessage(chatId, text);
      broadcast.sent++;
      console.log(`✅ Отправлено ${chatId} (${broadcast.sent}/${broadcast.total})`);
    } catch (err) {
      broadcast.failed++;
      console.error(`❌ Ошибка отправки ${chatId}:`, err.message);
      // Если пользователь заблокировал бота — можно пометить как неактивного
      if (err.error_code === 403) {
        broadcast.blocked = (broadcast.blocked || 0) + 1;
      }
    }
    // Пауза между отправками (безопасно для Telegram)
    await sleep(500);
  }

  broadcast.status = 'completed';
  broadcast.finishedAt = new Date().toISOString();
  console.log(`🏁 Рассылка ${broadcastId} завершена: отправлено ${broadcast.sent}, ошибок ${broadcast.failed}`);
}

// ---------- POST /api/broadcast — запустить рассылку ----------
router.post('/', auth, async (req, res) => {
  const { chatIds, text } = req.body;

  if (!Array.isArray(chatIds) || chatIds.length === 0) {
    return res.status(400).json({ error: 'Не выбран ни один получатель' });
  }
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Текст сообщения обязателен' });
  }

  const broadcastId = Date.now().toString();
  broadcasts.set(broadcastId, {
    id: broadcastId,
    total: chatIds.length,
    sent: 0,
    failed: 0,
    blocked: 0,
    status: 'in_progress',
    startedAt: new Date().toISOString()
  });

  // Запускаем в фоне (не ждём завершения)
  runBroadcast(broadcastId, chatIds, text.trim()).catch(err => {
    console.error('Критическая ошибка рассылки:', err);
    const b = broadcasts.get(broadcastId);
    if (b) b.status = 'failed';
  });

  res.json({ success: true, broadcastId, total: chatIds.length });
});

// ---------- GET /api/broadcast/:id/status — статус рассылки ----------
router.get('/:id/status', auth, async (req, res) => {
  const broadcast = broadcasts.get(req.params.id);
  if (!broadcast) {
    return res.status(404).json({ error: 'Рассылка не найдена' });
  }
  res.json(broadcast);
});

// ---------- GET /api/broadcast/history — история (опционально) ----------
router.get('/history', auth, async (req, res) => {
  const list = Array.from(broadcasts.values()).sort((a, b) => b.id - a.id);
  res.json(list);
});

module.exports = router;
