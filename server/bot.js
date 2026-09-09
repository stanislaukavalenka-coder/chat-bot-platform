const { Bot } = require('grammy');
const { getSheetData, appendSheetData, updateSheetData } = require('./sheets');

const bot = new Bot(process.env.BOT_TOKEN);

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
});

module.exports = { bot };
