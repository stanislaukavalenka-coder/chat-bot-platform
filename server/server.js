require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { bot } = require('./bot');
const { webhookCallback } = require('grammy');
const { ensureFirstAdmin } = require('./utils/initAdmin');

const app = express();
app.use(cors());
app.use(express.json());

// Вебхук для Telegram
app.use('/webhook', webhookCallback(bot, 'express'));

// Роуты
const authRoutes = require('./routes/auth');
const chatsRoutes = require('./routes/chats');
const settingsRoutes = require('./routes/settings');
const rulesRoutes = require('./routes/rules');
const pushRoutes = require('./routes/push');
const clientsRoutes = require('./routes/clients');
const broadcastRoutes = require('./routes/broadcast');
const managersRoutes = require('./routes/managers');

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/managers', managersRoutes);

// Раздача статики
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  // Проверяем и создаём первого админа
  await ensureFirstAdmin();
});
