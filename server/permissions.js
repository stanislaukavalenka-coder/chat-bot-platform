// Все возможные права в системе
const ALL_PERMISSIONS = [
  'view_chats',
  'reply_chats',
  'view_clients',
  'edit_clients',
  'broadcast',
  'rules',
  'settings',
  'managers',
  'yclients',
];

// Названия для UI
const PERMISSION_LABELS = {
  view_chats: 'Просмотр чатов',
  reply_chats: 'Ответы в чатах',
  view_clients: 'Просмотр клиентов',
  edit_clients: 'Редактирование клиентов',
  broadcast: 'Рассылки',
  rules: 'Сценарии / автоответы',
  settings: 'Настройки бота',
  managers: 'Управление менеджерами',
  yclients: 'YCLIENTS',
};

// Пресеты ролей
const ROLE_PRESETS = {
  admin: ALL_PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {}),
  manager: {
    view_chats: true,
    reply_chats: true,
    view_clients: true,
    edit_clients: true,
    broadcast: true,
    rules: false,
    settings: false,
    managers: false,
    yclients: false,
  },
  viewer: {
    view_chats: true,
    reply_chats: false,
    view_clients: true,
    edit_clients: false,
    broadcast: false,
    rules: false,
    settings: false,
    managers: false,
    yclients: false,
  },
};

/**
 * Распарсить JSON-строку прав из таблицы
 */
function parsePermissions(str) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/**
 * Сериализовать объект прав в строку
 */
function serializePermissions(obj) {
  return JSON.stringify(obj);
}

module.exports = {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PRESETS,
  parsePermissions,
  serializePermissions,
};
