const { Bot } = require('grammy');
const webPush = require('web-push');
const { getSheetData, appendSheetData, updateSheetData } = require('./sheets');

// Настройка VAPID
webPush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const bot = new Bot(process.env.BOT_TOKEN);

// Функция отправки push-уведомлений
async function sendPushToSubscribers(title, body, url) {
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    // Пропускаем первую строку (заголовки) и проверяем валидность JSON
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

bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const username = ctx.from.username || 'без username';

  const chats = await getSheetData('Chats!A:E');
  const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
  let chatRow = validChats.find(row => row[0].toString() === userId.toString());

  if (!chatRow) {
    await appendSheetData('Chats!A:E', [
      [userId, username, '', text, new Date().toISOString()]
    ]);
  } else {
    const rowIndex = chats.findIndex(row => row[0] && row[0].toString() === userId.toString()) + 2;
  if (rowIndex >= 2) {
    await updateSheetData(`Chats!D${rowIndex}:E${rowIndex}`, [
      [text, new Date().toISOString()]
    ]);
  } else {
    // Если не найден (на всякий случай) – добавляем новую строку
    await appendSheetData('Chats!A:E', [
      [userId, username, '', text, new Date().toISOString()]
    ]);
  }
}

  await appendSheetData('Messages!A:F', [
    [Date.now(), userId, 'client', text, new Date().toISOString(), 'FALSE']
  ]);

  const rules = await getSheetData('Rules!A:D');
  const matchingRule = rules.find(row =>
    row[2] === 'TRUE' && text.toLowerCase().includes(row[0].toLowerCase())
  );
  if (matchingRule) {
    await ctx.reply(matchingRule[1]);
    await appendSheetData('Messages!A:F', [
      [Date.now() + 1, userId, 'bot', matchingRule[1], new Date().toISOString(), 'TRUE']
    ]);
  }

  // Отправка push-уведомлений
  const userName = ctx.from.username || 'Клиент';
  await sendPushToSubscribers(
    `${userName}`,
    text,
    'https://chat-bot-platform-8mge.onrender.com/'
  );
});

module.exports = { bot };
