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
async function sendPushToSubscribers(title, body, url) {
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    const subscriptions = data
      .filter(row => row[0] && row[0].trim() !== '' && row[0].trim() !== 'subscription')
      .map(row => {
        try { return JSON.parse(row[0]); } catch { return null; }
      })
      .filter(sub => sub !== null && sub.endpoint);

    if (subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url: url || '/' });
    const options = { TTL: 60 };

    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(subscription, payload, options);
        console.log('Push уведомление отправлено');
      } catch (err) {
        console.error('Ошибка отправки push:', err.message);
      }
    }
  } catch (err) {
    console.error('Ошибка получения подписок для push:', err);
  }
}

// ---------- ОБНОВЛЕНИЕ ПОСЛЕДНЕГО СООБЩЕНИЯ ----------
async function updateChatLastMessage(userId, text, sender) {
  const chats = await getSheetData('Chats!A:I');
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
  const username = ctx.from.username || '';
  const displayName = firstName || username || 'Клиент';
  const userName = displayName;

  const chats = await getSheetData('Chats!A:I');
  const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
  const chatRow = validChats.find(row => row[0].toString() === userId.toString());

  if (!chatRow) {
    // Новый пользователь
    await appendSheetData('Chats!A:I', [
      [userId, displayName, '', text, new Date().toISOString(), 'client', '', 'Telegram', username]
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
    `📩 Новое сообщение от ${userName}`,
    text,
    'https://chat-bot-platform-8mge.onrender.com/'
  );
});

// ---------- КОНТАКТ ----------
bot.on('message:contact', async (ctx) => {
  const userId = ctx.from.id;
  const phone = ctx.message.contact.phone_number;

  const chats = await getSheetData('Chats!A:I');
  const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;

  if (rowIndex >= 2) {
    await updateSheetData(`Chats!C${rowIndex}:C${rowIndex}`, [[phone]]);
    await ctx.reply('Спасибо! Номер сохранён. Теперь можете задать свой вопрос.', {
      reply_markup: { remove_keyboard: true }
    });
  } else {
    const firstName = ctx.from.first_name || '';
    const username = ctx.from.username || '';
    const displayName = firstName || username || 'Клиент';
    await appendSheetData('Chats!A:I', [
      [userId, displayName, phone, 'Поделился контактом', new Date().toISOString(), 'client', '', 'Telegram', username]
    ]);
    await ctx.reply('Спасибо! Номер сохранён.', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

module.exports = { bot };
