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

// Функция отправки push-уведомлений всем подписанным менеджерам
async function sendPushToSubscribers(title, body, url) {
  try {
    const data = await getSheetData('PushSubscriptions!A:B');
    // Фильтруем строки с данными
    const subscriptions = data
      .filter(row => row[0] && row[0].trim() !== '')
      .map(row => JSON.parse(row[0]));

    if (subscriptions.length === 0) {
      console.log('Нет подписок для отправки push');
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
        // Если подписка невалидна (410 Gone или 404 Not Found), можно удалить
        if (err.statusCode === 410 || err.statusCode === 404) {
          // TODO: удалить невалидную подписку из таблицы
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

  // Получаем все строки и фильтруем пустые chat_id
  const chats = await getSheetData('Chats!A:E');
  const validChats = chats.filter(row => row[0] && row[0].toString().trim() !== '');
  let chatRow = validChats.find(row => row[0].toString() === userId.toString());

  if (!chatRow) {
    // Новый пользователь – добавляем строку
    await appendSheetData('Chats!A:E', [
      [userId, username, '', text, new Date().toISOString()]
    ]);
  } else {
    // Обновляем последнее сообщение и время в существующей строке
    const rowIndex = chats.indexOf(chatRow) + 2; // +2 из-за заголовка
    await updateSheetData(`Chats!D${rowIndex}:E${rowIndex}`, [
      [text, new Date().toISOString()]
    ]);
  }

  // Сохраняем сообщение клиента в Messages
  await appendSheetData('Messages!A:F', [
    [Date.now(), userId, 'client', text, new Date().toISOString(), 'FALSE']
  ]);

  // Проверяем автоответы
  const rules = await getSheetData('Rules!A:D');
  const matchingRule = rules.find(row =>
    row[2] === 'TRUE' && text.toLowerCase().includes(row[0].toLowerCase())
  );
  if (matchingRule) {
    await ctx.reply(matchingRule[1]);
    // Сохраняем ответ бота
    await appendSheetData('Messages!A:F', [
      [Date.now() + 1, userId, 'bot', matchingRule[1], new Date().toISOString(), 'TRUE']
    ]);
  }

  // ---- ОТПРАВКА PUSH-УВЕДОМЛЕНИЙ МЕНЕДЖЕРАМ ----
  const userName = ctx.from.username || 'Клиент';
  await sendPushToSubscribers(
    `Новое сообщение от ${userName}`,
    text,
    'https://chat-bot-platform-8mge.onrender.com/'
  );
});

module.exports = { bot };
