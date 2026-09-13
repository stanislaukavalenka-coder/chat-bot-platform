const jwt = require('jsonwebtoken');

// Проверка JWT — добавляет req.user
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Не авторизован' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, email, role, permissions }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

// Проверка конкретного права — использовать после auth
module.exports.requirePermission = (permission) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  if (req.user.role === 'admin') {
    return next(); // админ всегда пропускается
  }
  const permissions = req.user.permissions || {};
  if (!permissions[permission]) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  next();
};

// Проверка, что пользователь — админ
module.exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Только для администратора' });
  }
  next();
};
