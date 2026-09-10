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
      .slice(1) // убираем заголовок
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
        if (err.statusCode === 410 || err.statusCode === 404) {
          // TODO: удалить невалидную подписку
        }
      }
    }
  } catch (err) {
    console.error('Ошибка получения подписок для push:', err);
  }
}

// ---------- ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ ----------
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const userName = ctx.from.first_name || ctx.from.username || 'Клиент';
  const username = ctx.from.username || 'без username';

  // --- Обновление таблицы Chats ---
  const chats = await getSheetData('Chats!A:E');
  const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
  const chatRow = validChats.find(row => row[0].toString() === userId.toString());

  if (!chatRow) {
    // Новый пользователь — добавляем строку и просим телефон
    await appendSheetData('Chats!A:E', [
      [userId, username, '', text, new Date().toISOString()]
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
    // Пользователь уже есть — обновляем последнее сообщение и время
    const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;
    if (rowIndex >= 2) {
      await updateSheetData(`Chats!D${rowIndex}:E${rowIndex}`, [
        [text, new Date().toISOString()]
      ]);
    } else {
      // Fallback: если вдруг не нашли — добавляем новую строку
      await appendSheetData('Chats!A:E', [
        [userId, username, '', text, new Date().toISOString()]
      ]);
    }
  }

  // --- Сохранение сообщения клиента в Messages ---
  await appendSheetData('Messages!A:F', [
    [ctx.message.message_id, userId, 'client', text, new Date().toISOString(), 'FALSE']
  ]);

  // --- Проверка автоответов ---
  const rules = await getSheetData('Rules!A:D');
  const matchingRule = rules.find(row =>
    row[2] === 'TRUE' && text.toLowerCase().includes(row[0].toLowerCase())
  );

  if (matchingRule) {
    await ctx.reply(matchingRule[1]);
    await appendSheetData('Messages!A:F', [
      [`bot_${ctx.message.message_id}`, userId, 'bot', matchingRule[1], new Date().toISOString(), 'TRUE']
    ]);
  }

  // --- Отправка push-уведомлений менеджерам ---
  await sendPushToSubscribers(
    `📩 Новое сообщение от ${userName}`,
    text,
    'https://chat-bot-platform-8mge.onrender.com/'
  );
});

// ---------- ОБРАБОТЧИК КОНТАКТА (номер телефона) ----------
bot.on('message:contact', async (ctx) => {
  const userId = ctx.from.id;
  const phone = ctx.message.contact.phone_number;

  // Обновляем телефон в Chats (столбец C)
  const chats = await getSheetData('Chats!A:E');
  const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;

  if (rowIndex >= 2) {
    await updateSheetData(`Chats!C${rowIndex}:C${rowIndex}`, [[phone]]);
    await ctx.reply('Спасибо! Номер сохранён. Теперь можете задать свой вопрос.', {
      reply_markup: { remove_keyboard: true }
    });
  } else {
    // Если пользователя нет в Chats (например, отправил контакт первым)
    const userName = ctx.from.first_name || ctx.from.username || 'Клиент';
    const username = ctx.from.username || 'без username';
    await appendSheetData('Chats!A:E', [
      [userId, username, phone, 'Поделился контактом', new Date().toISOString()]
    ]);
    await ctx.reply('Спасибо! Номер сохранён.', {
      reply_markup: { remove_keyboard: true }
    });
  }
});

module.exports = { bot };
