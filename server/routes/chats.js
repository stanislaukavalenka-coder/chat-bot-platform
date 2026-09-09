const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');
const { bot } = require('../bot');

// GET /api/chats – список всех чатов с непрочитанными
router.get('/', auth, async (req, res) => {
  try {
    const chats = await getSheetData('Chats!A:E'); // chat_id, name, phone, last_msg, last_time
    const messages = await getSheetData('Messages!A:F'); // id, chat_id, sender, text, time, is_read

    const unreadCounts = {};
    messages.forEach(row => {
      if (row[1] && row[5] !== 'TRUE') {
        unreadCounts[row[1]] = (unreadCounts[row[1]] || 0) + 1;
      }
    });

    const result = chats.map(row => ({
      chatId: row[0],
      name: row[1] || 'Клиент',
      phone: row[2] || '',
      lastMessage: row[3] || '',
      lastTime: row[4] || '',
      unread: unreadCounts[row[0]] || 0
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки чатов' });
  }
});

// GET /api/chats/:chatId/messages – история сообщений
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const messages = await getSheetData('Messages!A:F');
    const filtered = messages
      .filter(row => row[1] == chatId)
      .map(row => ({
        id: row[0],
        sender: row[2],
        text: row[3],
        time: row[4],
        isRead: row[5] === 'TRUE'
      }));
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// POST /api/chats/message – отправить сообщение от менеджера
router.post('/message', auth, async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }

  try {
    // Сохраняем сообщение
    await appendSheetData('Messages!A:F', [
      [Date.now(), chatId, 'manager', text, new Date().toISOString(), 'TRUE']
    ]);

    // Отправляем в Telegram
    await bot.api.sendMessage(chatId, text);

    // Обновляем последнее сообщение в чате
    const chats = await getSheetData('Chats!A:E');
    const rowIndex = chats.findIndex(row => row[0] == chatId) + 2;
    if (rowIndex >= 2) {
      await updateSheetData(`Chats!D${rowIndex}:E${rowIndex}`, [[text, new Date().toISOString()]]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отправки:', err);
    res.status(500).json({ error: 'Не удалось отправить' });
  }
});

// PUT /api/chats/:chatId/read – пометить все сообщения как прочитанные
router.put('/:chatId/read', auth, async (req, res) => {
  const chatId = req.params.chatId;
  try {
    const messages = await getSheetData('Messages!A:F');
    const updates = messages.map((row, index) => {
      if (row[1] == chatId && row[5] !== 'TRUE') {
        const rowNum = index + 2;
        return updateSheetData(`Messages!F${rowNum}:F${rowNum}`, [['TRUE']]);
      }
      return null;
    });
    await Promise.all(updates.filter(Boolean));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

module.exports = router;