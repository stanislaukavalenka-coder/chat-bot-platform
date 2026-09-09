require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');                // ← добавлено
const { bot } = require('./bot');
const { webhookCallback } = require('grammy');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/webhook', webhookCallback(bot, 'express'));

const authRoutes = require('./routes/auth');
const chatsRoutes = require('./routes/chats');
const settingsRoutes = require('./routes/settings');
const rulesRoutes = require('./routes/rules');

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/rules', rulesRoutes);

// Правильный путь к public
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
