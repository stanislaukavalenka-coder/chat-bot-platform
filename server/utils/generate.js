/**
 * Генерация случайного пароля (10 символов: буквы + цифры)
 */
function generatePassword(length = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

/**
 * Валидация email (простая)
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Нормализация email — в нижний регистр, без пробелов
 */
function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

module.exports = { generatePassword, isValidEmail, normalizeEmail };
