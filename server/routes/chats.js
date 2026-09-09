const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');
const { bot } = require('../bot');

// GET /api/chats – список всех чатов с непрочитанными
router.get('/', auth, async (req, res) => {
  try {
    const chats = await getSheetData('Chats!A:E');
    // Фильтруем строки с пустым chat_id
    const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
    const messages = await getSheetData('Messages!A:F');

    const unreadCounts = {};
    messages.forEach(row => {
      if (row[1] && row[5] !== 'TRUE') {
        unreadCounts[row[1]] = (unreadCounts[row[1]] || 0) + 1;
      }
    });

    const result = validChats.map(row => ({
      chatId: row[0],
      name: row[1] || 'Клиент',
      phone: row[2] || '',
      lastMessage: row[3] || '',
      lastTime: row[4] || '',
      unread: unreadCounts[row[0]] || 0
    }));

    res.json(result);
  } catch (err) {
    console.error('Ошибка загрузки чатов:', err);
    res.status(500).json({ error: 'Ошибка загрузки чатов' });
  }
});

// GET /api/chats/:chatId/messages – история сообщений
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const messages = await getSheetData('Messages!A:F');
    const filtered = messages
      .filter(row => row[1] && row[1].toString() === chatId.toString())
      .map(row => ({
        id: row[0],
        sender: row[2],
        text: row[3],
        time: row[4],
        isRead: row[5] === 'TRUE'
      }));
    res.json(filtered);
  } catch (err) {
    console.error('Ошибка загрузки сообщений:', err);
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
    // Сохраняем сообщение менеджера
    await appendSheetData('Messages!A:F', [
      [Date.now(), chatId, 'manager', text, new Date().toISOString(), 'TRUE']
    ]);

    // Отправляем в Telegram
    await bot.api.sendMessage(chatId, text);

    // Обновляем последнее сообщение в чате
    const chats = await getSheetData('Chats!A:E');
    const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
    const chatRow = validChats.find(row => row[0].toString() === chatId.toString());
    if (chatRow) {
      const rowIndex = chats.indexOf(chatRow) + 2;
      await updateSheetData(`Chats!D${rowIndex}:E${rowIndex}`, [
        [text, new Date().toISOString()]
      ]);
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
      if (row[1] && row[1].toString() === chatId.toString() && row[5] !== 'TRUE') {
        const rowNum = index + 2;
        return updateSheetData(`Messages!F${rowNum}:F${rowNum}`, [['TRUE']]);
      }
      return null;
    });
    await Promise.all(updates.filter(Boolean));
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка обновления прочитанных:', err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

module.exports = router;
