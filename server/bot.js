const { Bot } = require('grammy');
const webPush = require('web-push');
const { getSheetData, appendSheetData, updateSheetData } = require('./sheets');

// Настройка VAPID для push-уведомлений
webPush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const bot = new Bot(process.env.BOT_TOKEN);

// ---------- ФУНКЦИЯ ОТПРАВКИ PUSH-УВЕДОМЛЕНИЙ ----------
async function sendPushToSubscribers(title, body, url) {
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    const subscriptions = data
      .filter(row => row[0] && row[0].trim() !== '' && row[0].trim() !== 'subscription')
      .map(row => {
        try {
          return JSON.parse(row[0]);
        } catch (e) {
          console.error('Невалидный JSON в подписке:', row[0]);
          return null;
        }
      })
      .filter(sub => sub !== null && sub.endpoint);

    if (subscriptions.length === 0) {
      console.log('Нет валидных подписок для отправки push');
      return;
    }

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

// ---------- ОБНОВЛЕНИЕ ПОСЛЕДНЕГО СООБЩЕНИЯ В CHATS ----------
async function updateChatLastMessage(userId, text, sender) {
  const chats = await getSheetData('Chats!A:H');
  const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;
  if (rowIndex >= 2) {
    await updateSheetData(`Chats!D${rowIndex}:F${rowIndex}`, [
      [text, new Date().toISOString(), sender]
    ]);
  }
}

// ---------- ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ ----------
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const userName = ctx.from.first_name || ctx.from.username || 'Клиент';
  const username = ctx.from.username || 'без username';

  const chats = await getSheetData('Chats!A:H');
  const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
  const chatRow = validChats.find(row => row[0].toString() === userId.toString());

  if (!chatRow) {
    // Новый пользователь — добавляем строку с source = Telegram
    await appendSheetData('Chats!A:H', [
      [userId, username, '', text, new Date().toISOString(), 'client', '', 'Telegram']
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
    // Обновляем только last_message, last_time, last_sender
    await updateChatLastMessage(userId, text, 'client');
  }

  // Сохранение сообщения клиента в Messages
  await appendSheetData('Messages!A:F', [
    [ctx.message.message_id, userId, 'client', text, new Date().toISOString(), 'FALSE']
  ]);

  // Проверка автоответов
  const rules = await getSheetData('Rules!A:D');
  const matchingRule = rules.find(row =>
    row[2] === 'TRUE' && text.toLowerCase().includes(row[0].toLowerCase())
  );

  if (matchingRule) {
    await ctx.reply(matchingRule[1]);
    await appendSheetData('Messages!A:F', [
      [`bot_${ctx.message.message_id}`, userId, 'bot', matchingRule[1], new Date().toISOString(), 'TRUE']
    ]);
    // Обновляем last_message как bot
    await updateChatLastMessage(userId, matchingRule[1], 'bot');
  }

  // Push-уведомления
  await sendPushToSubscribers(
    `📩 Новое сообщение от ${userName}`,
    text,
    'https://chat-bot-platform-8mge.onrender.com/'
  );
});

// ---------- ОБРАБОТЧИК КОНТАКТА ----------
bot.on('message:contact', async (ctx) => {
  const userId = ctx.from.id;
  const phone = ctx.message.contact.phone_number;

  const chats = await getSheetData('Chats!A:H');
  const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;

  if (rowIndex >= 2) {
    await updateSheetData(`Chats!C${rowIndex}:C${rowIndex}`, [[phone]]);
    await ctx.reply('Спасибо! Номер сохранён. Теперь можете задать свой вопрос.', {
      reply_markup: { remove_keyboard: true }
    });
  } else {
    const userName = ctx.from.first_name || ctx.from.username || 'Клиент';
    const username = ctx.from.username || 'без username';
    await appendSheetData('Chats!A:H', [
      [userId, username, phone, 'Поделился контактом', new Date().toISOString(), 'client', '', 'Telegram']
    ]);
    await ctx.reply('Спасибо! Номер сохранён.', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

module.exports = { bot };
