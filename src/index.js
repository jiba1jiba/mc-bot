import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import http from 'node:http';
import { config } from './config.js';
import { logger } from './logger.js';
import { BotManager } from './manager.js';
import { Store } from './store.js';
import { registerCommands } from './register.js';
import { handleAutocomplete, handleButton, handleCommand } from './commands.js';
import { isValidNick, sleep } from './utils.js';

if (!config.token) {
  logger.error('Не задан DISCORD_TOKEN. Скопируйте .env.example в .env и вставьте токен бота.');
  process.exit(1);
}

const store = await Store.load(config.dataDir, config.accounts);
logger.info(
  store.names().length
    ? `Сохранённые аккаунты: ${store.names().join(', ')}`
    : 'Список аккаунтов пуст — добавьте ники через /add',
);
const manager = new BotManager(config.mc);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const context = { manager, store, config };

// Optional HTTP endpoint for free PaaS hosts (Render/Koyeb) that expect a port.
// Locally PORT is usually unset, so nothing listens.
if (process.env.PORT && Number.isFinite(Number(process.env.PORT))) {
  const port = Number(process.env.PORT);
  const health = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('mc-alts-bot: alive');
  });
  health.listen(port, '0.0.0.0', () => logger.info(`Health-сервер слушает порт ${port}`));
  health.on('error', (err) => logger.warn(`Health-сервер: ${err.message}`));
}

function hasAccess(interaction) {
  if (config.allowEveryone) return true;
  if (!interaction.inCachedGuild()) return false;
  if (config.adminUserIds.includes(interaction.user.id)) return true;
  if (config.adminRoleId && interaction.member.roles.cache.has(config.adminRoleId)) return true;
  if (!config.adminUserIds.length && !config.adminRoleId) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  }
  return false;
}

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Discord: вошёл как ${readyClient.user.tag}`);

  readyClient.user.setPresence({
    status: 'online',
    activities: [
      { name: `${config.mc.host}:${config.mc.port}`, type: ActivityType.Watching },
    ],
  });

  try {
    await registerCommands(readyClient.user.id);
  } catch (err) {
    logger.error(`Не удалось зарегистрировать слэш-команды: ${err.message}`);
  }

  logger.info(
    `Minecraft: ${config.mc.host}:${config.mc.port} · клиент ${
      manager.version ?? (config.mc.version === 'auto' ? 'auto (определю при запуске бота)' : config.mc.version)
    } · режим ${config.mc.auth}`,
  );

  if (config.autoJoin) {
    const names = store.names().filter(isValidNick);
    logger.info(`AUTO_JOIN: запускаю ${names.length} аккаунт(ов) через 3 сек...`);
    setTimeout(() => {
      void (async () => {
        for (const [index, name] of names.entries()) {
          const result = await manager.join(name);
          if (!result.ok) logger.warn(`[${name}] уже запущен, пропускаю`);
          if (index < names.length - 1) await sleep(config.mc.joinDelayMs);
        }
      })();
    }, 3000);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      if (!hasAccess(interaction)) return interaction.respond([]).catch(() => {});
      return await handleAutocomplete(interaction, context);
    }

    if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

    if (!hasAccess(interaction)) {
      const payload = {
        content:
          '⛔ Нет доступа. Нужно право «Управление сервером» (или роль/юзер из `ADMIN_ROLE_ID` / `ADMIN_USER_IDS` в `.env`).',
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) return interaction.editReply({ content: payload.content }).catch(() => {});
      return interaction.reply(payload).catch(() => {});
    }

    if (interaction.isChatInputCommand()) return await handleCommand(interaction, context);
    if (interaction.isButton()) return await handleButton(interaction, context);
  } catch (err) {
    const label = interaction.isChatInputCommand()
      ? `/${interaction.commandName}`
      : (interaction.customId ?? 'interaction');
    logger.error(`Ошибка обработки ${label}:`, err);
    const message = `❌ Ошибка: ${err?.message ?? err}`;
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message });
      else if (interaction.isRepliable()) {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
      }
    } catch {
      /* ignore */
    }
  }
});

client.on(Events.Error, (err) => logger.error('Discord client error:', err));

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal}: выключаю ботов и бота Discord...`);
  manager.shutdown();
  client.destroy();
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
process.on('uncaughtException', (err) => logger.error('Uncaught exception:', err));

client.login(config.token).catch((err) => {
  logger.error(`Не удалось войти в Discord: ${err.message}`);
  process.exit(1);
});
