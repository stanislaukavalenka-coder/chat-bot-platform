require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { bot } = require('./bot');
const { webhookCallback } = require('grammy');

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

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/clients', clientsRoutes);

// Раздача статики
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
