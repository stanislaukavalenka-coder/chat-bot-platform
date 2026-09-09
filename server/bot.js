const { Bot } = require('grammy');
const { getSheetData, appendSheetData, updateSheetData } = require('./sheets');

const bot = new Bot(process.env.BOT_TOKEN);

bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const username = ctx.from.username || 'без username';

  // Проверяем, есть ли пользователь в Chats
  const chats = await getSheetData('Chats!A:E');
  let chatRow = chats.find(row => row[0] == userId);

  if (!chatRow) {
    await appendSheetData('Chats!A:E', [[userId, username, '', text, new Date().toISOString()]]);
  } else {
    const rowIndex = chats.indexOf(chatRow) + 2;
    await updateSheetData(`Chats!D${rowIndex}:E${rowIndex}`, [[text, new Date().toISOString()]]);
  }

  // Сохраняем сообщение
  await appendSheetData('Messages!A:F', [
    [Date.now(), userId, 'client', text, new Date().toISOString(), 'FALSE']
  ]);

  // Проверяем автоответы
  const rules = await getSheetData('Rules!A:D');
  const matchingRule = rules.find(row => row[2] === 'TRUE' && text.toLowerCase().includes(row[0].toLowerCase()));
  if (matchingRule) {
    await ctx.reply(matchingRule[1]);
    await appendSheetData('Messages!A:F', [
      [Date.now() + 1, userId, 'bot', matchingRule[1], new Date().toISOString(), 'TRUE']
    ]);
  }
});

module.exports = { bot };
