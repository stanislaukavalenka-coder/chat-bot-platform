const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Определяем путь к credentials.json
let keyFilePath;
const localPath = path.join(__dirname, 'credentials.json');
const renderPath = '/etc/secrets/credentials.json';

if (fs.existsSync(renderPath)) {
  keyFilePath = renderPath;
  console.log('✅ Используем credentials.json из /etc/secrets/');
} else if (fs.existsSync(localPath)) {
  keyFilePath = localPath;
  console.log('✅ Используем локальный credentials.json');
} else {
  console.error('❌ credentials.json не найден');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Чтение данных БЕЗ первой строки (заголовков)
async function getSheetData(range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const values = res.data.values || [];
  // Пропускаем первую строку с заголовками
  return values.slice(1);
}

// Запись данных
async function appendSheetData(range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
}

// Обновление диапазона
async function updateSheetData(range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values },
  });
}

module.exports = { getSheetData, appendSheetData, updateSheetData };
