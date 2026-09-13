const { Bot } = require('grammy');
const webPush = require('web-push');
const { getSheetData, appendSheetData, updateSheetData } = require('./sheets');

webPush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const bot = new Bot(process.env.BOT_TOKEN);

// ---------- PUSH ----------
router.post('/subscribe', auth, async (req, res) => {
  const subscription = req.body;
  const userId = req.user.id || 'admin';
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Неверные данные подписки' });
  }
  try {
    const data = await getSheetData('PushSubscriptions!A:B');

    // Ищем ВСЕ строки с этим userId
    const userRows = [];
    data.forEach((row, idx) => {
      if (row[1] === userId) {
        userRows.push({ idx, subJson: row[0], endpoint: (() => {
          try { return JSON.parse(row[0]).endpoint; } catch { return null; }
        })() });
      }
    });

    // Проверяем, есть ли уже подписка с таким же endpoint
    const sameEndpoint = userRows.find(r => r.endpoint === subscription.endpoint);

    if (sameEndpoint) {
      // Обновляем только эту строку
      const rowNum = sameEndpoint.idx + 2;
      await updateSheetData(`PushSubscriptions!A${rowNum}:B${rowNum}`, [
        [JSON.stringify(subscription), userId]
      ]);
    } else {
      // Удаляем все старые подписки этого userId и добавляем новую
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
// ---------- ОБНОВЛЕНИЕ ПОСЛЕДНЕГО СООБЩЕНИЯ ----------
async function updateChatLastMessage(userId, text, sender) {
  const chats = await getSheetData('Chats!A:J');
  const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;
  if (rowIndex >= 2) {
    await updateSheetData(`Chats!D${rowIndex}:F${rowIndex}`, [
      [text, new Date().toISOString(), sender]
    ]);
  }
}

// ---------- ТЕКСТОВЫЕ СООБЩЕНИЯ ----------
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const firstName = ctx.from.first_name || '';
  const lastName = ctx.from.last_name || '';
  const username = ctx.from.username || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Клиент';

  const chats = await getSheetData('Chats!A:J');
  const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
  const chatRow = validChats.find(row => row[0].toString() === userId.toString());

  if (!chatRow) {
    // Новый пользователь: B=имя, J=фамилия
    await appendSheetData('Chats!A:J', [
      [userId, firstName || username || 'Клиент', '', text, new Date().toISOString(), 'client', '', 'Telegram', username, lastName]
    ]);

    await ctx.reply(
      'Здравствуйте! Пожалуйста, поделитесь номером телефона кнопкой ниже, чтобы мы могли с вами связаться.',
      {
        reply_markup: {
          keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  } else {
    await updateChatLastMessage(userId, text, 'client');
  }

  await appendSheetData('Messages!A:F', [
    [ctx.message.message_id, userId, 'client', text, new Date().toISOString(), 'FALSE']
  ]);

  const rules = await getSheetData('Rules!A:D');
  const matchingRule = rules.find(row =>
    row[2] === 'TRUE' && text.toLowerCase().includes(row[0].toLowerCase())
  );

  if (matchingRule) {
    await ctx.reply(matchingRule[1]);
    await appendSheetData('Messages!A:F', [
      [`bot_${ctx.message.message_id}`, userId, 'bot', matchingRule[1], new Date().toISOString(), 'TRUE']
    ]);
    await updateChatLastMessage(userId, matchingRule[1], 'bot');
  }

  await sendPushToSubscribers(
    `📩 Новое сообщение от ${displayName}`,
    text,
    'https://chat-bot-platform-8mge.onrender.com/'
  );
});

// ---------- КОНТАКТ ----------
bot.on('message:contact', async (ctx) => {
  const userId = ctx.from.id;
  const phone = ctx.message.contact.phone_number;

  const chats = await getSheetData('Chats!A:J');
  const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;

  if (rowIndex >= 2) {
    await updateSheetData(`Chats!C${rowIndex}:C${rowIndex}`, [[phone]]);
    await ctx.reply('Спасибо! Номер сохранён. Теперь можете задать свой вопрос.', {
      reply_markup: { remove_keyboard: true }
    });
  } else {
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username || '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || 'Клиент';
    await appendSheetData('Chats!A:J', [
      [userId, firstName || username || 'Клиент', phone, 'Поделился контактом', new Date().toISOString(), 'client', '', 'Telegram', username, lastName]
    ]);
    await ctx.reply('Спасибо! Номер сохранён.', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

module.exports = { bot };
