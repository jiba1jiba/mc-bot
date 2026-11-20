import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { commandData } from './commands.js';
import { logger } from './logger.js';

export async function registerCommands(clientId) {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = commandData.map((command) => command.toJSON());
  const route = config.guildId
    ? Routes.applicationGuildCommands(clientId, config.guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body });

  logger.info(
    `Слэш-команды: ${commandData.map((c) => `/${c.name}`).join(' ')} → ${
      config.guildId ? `сервер ${config.guildId}` : 'глобально (может занять до часа)'
    }`,
  );
}
