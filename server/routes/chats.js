const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, appendSheetData, updateSheetData } = require('../sheets');
const { bot } = require('../bot');

// GET /api/chats
router.get('/', auth, async (req, res) => {
  try {
    const chats = await getSheetData('Chats!A:J');
    const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
    const messages = await getSheetData('Messages!A:F');

    const unreadCounts = {};
    messages.forEach(row => {
      if (row[1] && row[5] !== 'TRUE') {
        unreadCounts[row[1]] = (unreadCounts[row[1]] || 0) + 1;
      }
    });

    const result = validChats.map(row => {
      const firstName = row[1] || '';
      const lastName = row[9] || '';
      const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'Клиент';
      return {
        chatId: row[0],
        name: firstName,          // имя
        lastName: lastName,       // фамилия
        displayName: displayName, // полное имя для отображения
        phone: row[2] || '',
        lastMessage: row[3] || '',
        lastTime: row[4] || '',
        lastSender: row[5] || 'client',
        city: row[6] || '',
        source: row[7] || 'Telegram',
        username: row[8] || '',
        unread: unreadCounts[row[0]] || 0
      };
    });

    result.sort((a, b) => {
      const tA = a.lastTime ? new Date(a.lastTime).getTime() : 0;
      const tB = b.lastTime ? new Date(b.lastTime).getTime() : 0;
      return tB - tA;
    });

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(result);
  } catch (err) {
    console.error('Ошибка загрузки чатов:', err);
    res.status(500).json({ error: 'Ошибка загрузки чатов' });
  }
});

// GET /api/chats/:chatId/messages
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

// POST /api/chats/message
router.post('/message', auth, async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ error: 'Не хватает данных' });
  }

  try {
    await appendSheetData('Messages!A:F', [
      [Date.now(), chatId, 'manager', text, new Date().toISOString(), 'TRUE']
    ]);

    await bot.api.sendMessage(chatId, text);

    const chats = await getSheetData('Chats!A:J');
    const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === chatId.toString()) + 2;
    if (rowIndex >= 2) {
      await updateSheetData(`Chats!D${rowIndex}:F${rowIndex}`, [
        [text, new Date().toISOString(), 'manager']
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отправки:', err);
    res.status(500).json({ error: 'Не удалось отправить' });
  }
});

// PUT /api/chats/:chatId/read
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
