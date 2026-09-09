const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Введите пароль' });
  }

  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    return res.status(500).json({ error: 'Пароль не настроен на сервере' });
  }

  if (password !== adminPass) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const token = jwt.sign(
    { role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token });
});

module.exports = router;
