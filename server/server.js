require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { bot } = require('./bot');
const { webhookCallback } = require('grammy');

const app = express();
app.use(cors());
app.use(express.json());

// Вебхук для Telegram
app.use('/webhook', webhookCallback(bot, 'express'));

// Роуты (создайте папки routes/ и middleware/)
const authRoutes = require('./routes/auth');
const chatsRoutes = require('./routes/chats');
const settingsRoutes = require('./routes/settings');
const rulesRoutes = require('./routes/rules');

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rules', rulesRoutes);

// Раздача статики (фронтенд)
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
