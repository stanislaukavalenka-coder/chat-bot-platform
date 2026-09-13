const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Отправить приглашение новому менеджеру
 */
async function sendInvite({ email, firstName, password, botName, appUrl }) {
  const subject = `Приглашение в ${botName || 'чат-бот'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3390ec;">Здравствуйте, ${firstName}!</h2>
      <p>Вас пригласили управлять чат-ботом <strong>«${botName || 'Чат-бот'}»</strong>.</p>
      <p>Для входа в админку используйте данные ниже:</p>
      <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Логин:</strong> ${email}</p>
        <p style="margin: 4px 0;"><strong>Пароль:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
      </div>
      <p><a href="${appUrl}" style="background: #3390ec; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Войти в админку</a></p>
      <p style="color: #8a9aa9; font-size: 13px; margin-top: 24px;">Рекомендуем сменить пароль в первый же вход в разделе «Мои настройки».</p>
    </div>
  `;

  return transporter.sendMail({
    from: `"${botName || 'Чат-бот'}" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html,
  });
}

/**
 * Отправить новый пароль (при сбросе)
 */
async function sendPasswordReset({ email, firstName, password, appUrl }) {
  const subject = 'Ваш новый пароль';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3390ec;">Здравствуйте, ${firstName}!</h2>
      <p>Мы сбросили ваш пароль от админки чат-бота.</p>
      <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Логин:</strong> ${email}</p>
        <p style="margin: 4px 0;"><strong>Новый пароль:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
      </div>
      <p><a href="${appUrl}" style="background: #3390ec; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Войти в админку</a></p>
    </div>
  `;

  return transporter.sendMail({
    from: `"Чат-бот" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html,
  });
}

module.exports = { sendInvite, sendPasswordReset };
