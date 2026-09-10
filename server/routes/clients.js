const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getSheetData, updateSheetData } = require('../sheets');

// GET /api/clients
router.get('/', auth, async (req, res) => {
  try {
    const chats = await getSheetData('Chats!A:I');
    const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');

    const clients = validChats.map(row => ({
      chatId: row[0],
      name: row[1] || '',
      phone: row[2] || '',
      lastMessage: row[3] || '',
      lastTime: row[4] || '',
      lastSender: row[5] || 'client',
      city: row[6] || '',
      source: row[7] || 'Telegram',
      username: row[8] || ''
    }));

    clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(clients);
  } catch (err) {
    console.error('Ошибка загрузки клиентов:', err);
    res.status(500).json({ error: 'Ошибка загрузки клиентов' });
  }
});

// PUT /api/clients/:chatId
router.put('/:chatId', auth, async (req, res) => {
  const chatId = req.params.chatId;
  const { name, phone, city, username } = req.body;

  try {
    const chats = await getSheetData('Chats!A:I');
    const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === chatId.toString()) + 2;

    if (rowIndex < 2) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    if (name !== undefined) await updateSheetData(`Chats!B${rowIndex}:B${rowIndex}`, [[name]]);
    if (phone !== undefined) await updateSheetData(`Chats!C${rowIndex}:C${rowIndex}`, [[phone]]);
    if (city !== undefined) await updateSheetData(`Chats!G${rowIndex}:G${rowIndex}`, [[city]]);
    if (username !== undefined) await updateSheetData(`Chats!I${rowIndex}:I${rowIndex}`, [[username]]);

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка обновления клиента:', err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

module.exports = router;
