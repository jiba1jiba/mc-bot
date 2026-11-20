import { config } from './config.js';
import { logger } from './logger.js';
import { registerCommands } from './register.js';

if (!config.token || !config.clientId) {
  logger.error('Для ручной регистрации нужны DISCORD_TOKEN и DISCORD_CLIENT_ID в .env');
  process.exit(1);
}

try {
  await registerCommands(config.clientId);
} catch (err) {
  logger.error('Не удалось зарегистрировать команды:', err);
  process.exit(1);
}
