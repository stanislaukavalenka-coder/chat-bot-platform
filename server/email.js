const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.SMTP_USER || 'onboarding@resend.dev';
const FROM_NAME = process.env.BOT_NAME || 'Чат-бот';

async function sendInvite({ email, firstName, password, botName, appUrl }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3390ec;">Здравствуйте, ${firstName}!</h2>
      <p>Вас пригласили управлять чат-ботом <strong>«${botName || 'Чат-бот'}»</strong>.</p>
      <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Логин:</strong> ${email}</p>
        <p style="margin: 4px 0;"><strong>Пароль:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
      </div>
      <p><a href="${appUrl}" style="background: #3390ec; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Войти в админку</a></p>
      <p style="color: #8a9aa9; font-size: 13px; margin-top: 24px;">Рекомендуем сменить пароль в первый же вход.</p>
    </div>
  `;

  return resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: email,
    subject: `Приглашение в ${botName || 'чат-бот'}`,
    html,
  });
}

async function sendPasswordReset({ email, firstName, password, appUrl }) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3390ec;">Здравствуйте, ${firstName}!</h2>
      <p>Мы сбросили ваш пароль от админки.</p>
      <div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Логин:</strong> ${email}</p>
        <p style="margin: 4px 0;"><strong>Новый пароль:</strong> <code style="background: white; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
      </div>
      <p><a href="${appUrl}" style="background: #3390ec; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">Войти в админку</a></p>
    </div>
  `;

  return resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: email,
    subject: 'Ваш новый пароль',
    html,
  });
}

module.exports = { sendInvite, sendPasswordReset };
