import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { pingServer } from './net.js';
import { buildAccountsEmbed, buildStatusEmbed, buildTabEmbed, statusInfo } from './render.js';
import { isValidNick, sleep } from './utils.js';

const guildOnly = (command) =>
  command.setContexts(InteractionContextType.Guild);

export const commandData = [
  guildOnly(new SlashCommandBuilder().setName('list').setDescription('Показать таблист сервера — кто сейчас онлайн')),

  guildOnly(
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Запустить бота-аккаунт на сервере')
      .addStringOption((option) =>
        option
          .setName('nick')
          .setDescription('Ник (3–16 символов: A–Z, a–z, 0–9, _)')
          .setRequired(true)
          .setAutocomplete(true),
      ),
  ),

  guildOnly(new SlashCommandBuilder().setName('joinall').setDescription('Запустить все сохранённые аккаунты')),

  guildOnly(
    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Выключить бота-аккаунт')
      .addStringOption((option) =>
        option.setName('nick').setDescription('Ник запущенного бота').setRequired(true).setAutocomplete(true),
      ),
  ),

  guildOnly(new SlashCommandBuilder().setName('leaveall').setDescription('Выключить всех ботов')),

  guildOnly(new SlashCommandBuilder().setName('accounts').setDescription('Список сохранённых аккаунтов и их статус')),

  guildOnly(
    new SlashCommandBuilder()
      .setName('add')
      .setDescription('Добавить ник в список сохранённых аккаунтов')
      .addStringOption((option) =>
        option.setName('nick').setDescription('Ник (3–16 символов: A–Z, a–z, 0–9, _)').setRequired(true),
      ),
  ),

  guildOnly(
    new SlashCommandBuilder()
      .setName('remove')
      .setDescription('Удалить ник из списка (и выключить, если запущен)')
      .addStringOption((option) =>
        option.setName('nick').setDescription('Ник из списка').setRequired(true).setAutocomplete(true),
      ),
  ),

  guildOnly(new SlashCommandBuilder().setName('status').setDescription('Статус ботов, аптайм и ошибки')),
];

const ephemeral = { flags: MessageFlags.Ephemeral };

async function collectTabData(manager, mcConfig) {
  const tab = manager.tabList();
  const ping = await pingServer(mcConfig)
    .then((info) => ({ info }))
    .catch((error) => ({ error }));

  const info = ping.info ?? null;

  let players = tab;
  let source;

  if (tab.length > 0) {
    source = 'tab-лист бота';
  } else if (info?.players?.sample?.length) {
    players = info.players.sample.map((p) => p.name).filter(Boolean);
    source = 'ping (сэмпл)';
  } else if (info) {
    source = 'ping';
  } else {
    source = 'ping не отвечает';
  }

  return {
    host: mcConfig.host,
    port: mcConfig.port,
    players,
    bots: manager.online().map((s) => s.name),
    online: tab.length > 0 ? tab.length : (info?.players?.online ?? 0),
    max: info?.players?.max ?? null,
    version: info?.version?.name ?? manager.version ?? mcConfig.version ?? null,
    source,
    pingError: ping.error?.message ?? null,
  };
}

async function cmdList(interaction, { manager, config }) {
  await interaction.deferReply();

  const data = await collectTabData(manager, config.mc);
  const refreshRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tablist:refresh')
      .setLabel('Обновить')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [buildTabEmbed(data)], components: [refreshRow] });
}

async function cmdJoin(interaction, { manager, store, config }) {
  const nick = interaction.options.getString('nick', true).trim();

  if (!isValidNick(nick)) {
    return interaction.reply({
      content: '❌ Ник должен быть **3–16** символов: латиница, цифры и `_`.',
      ...ephemeral,
    });
  }

  await interaction.deferReply(ephemeral);

  let added = false;
  if (!store.has(nick)) {
    store.add(nick);
    await store.save();
    added = true;
  }

  const result = await manager.join(nick);
  if (!result.ok) {
    const content =
      result.reason === 'already'
        ? `⚠️ \`${nick}\` уже запущен (${statusInfo(result.session).label}).`
        : `⚠️ Запуск \`${nick}\` отменён.`;
    return interaction.editReply({ content });
  }

  return interaction.editReply({
    content: [
      `🚀 Запускаю \`${nick}\` на \`${config.mc.host}:${config.mc.port}\`...`,
      added ? '➕ Ник добавлен в сохранённые.' : null,
      'Статус — `/status`, таблист — `/list`.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

async function cmdJoinAll(interaction, { manager, store, config }) {
  const names = store.names().filter((name) => isValidNick(name) && !manager.isActive(name));

  if (!names.length) {
    return interaction.reply({
      content: '🤷 Нет аккаунтов для запуска: список пуст или все уже запущены.',
      ...ephemeral,
    });
  }

  await interaction.deferReply(ephemeral);

  const lines = [];
  for (const [index, name] of names.entries()) {
    const result = await manager.join(name);
    lines.push(`${result.ok ? '🚀' : '⚠️'} \`${name}\``);
    if (index < names.length - 1) await sleep(config.mc.joinDelayMs);
  }

  return interaction.editReply({
    content: [`Запуск ${names.length} аккаунт(ов):`, ...lines, '', 'Проверить: `/status` или `/list`.'].join('\n'),
  });
}

async function cmdLeave(interaction, { manager }) {
  const nick = interaction.options.getString('nick', true).trim();
  const session = manager.get(nick);

  if (!session) {
    return interaction.reply({ content: `⚠️ \`${nick}\` не запускался.`, ...ephemeral });
  }
  if (session.status === 'offline') {
    return interaction.reply({ content: `⚠️ \`${session.name}\` уже выключен.`, ...ephemeral });
  }

  manager.leave(session.name);
  return interaction.reply({ content: `🛑 \`${session.name}\` выключен.`, ...ephemeral });
}

async function cmdLeaveAll(interaction, { manager }) {
  const active = manager.list().filter((s) => s.status !== 'offline');

  if (!active.length) {
    return interaction.reply({ content: '🤷 Нет запущенных ботов.', ...ephemeral });
  }

  for (const session of active) manager.leave(session.name);
  return interaction.reply({
    content: `🛑 Выключено: ${active.map((s) => `\`${s.name}\``).join(', ')}`,
    ...ephemeral,
  });
}

async function cmdAccounts(interaction, { manager, store }) {
  return interaction.reply({ embeds: [buildAccountsEmbed(store.names(), manager)] });
}

async function cmdAdd(interaction, { store }) {
  const nick = interaction.options.getString('nick', true).trim();

  if (!isValidNick(nick)) {
    return interaction.reply({
      content: '❌ Ник должен быть **3–16** символов: латиница, цифры и `_`.',
      ...ephemeral,
    });
  }

  if (store.has(nick)) {
    return interaction.reply({ content: `ℹ️ \`${nick}\` уже в списке.`, ...ephemeral });
  }

  store.add(nick);
  await store.save();
  return interaction.reply({ content: `➕ \`${nick}\` добавлен. Запуск: \`/join ${nick}\`.`, ...ephemeral });
}

async function cmdRemove(interaction, { manager, store }) {
  const nick = interaction.options.getString('nick', true).trim();
  const stored = store.names().find((name) => name.toLowerCase() === nick.toLowerCase());

  if (!stored) {
    return interaction.reply({ content: `⚠️ \`${nick}\` нет в списке.`, ...ephemeral });
  }

  const session = manager.get(stored);
  const wasActive = Boolean(session && session.status !== 'offline');
  if (wasActive) manager.leave(stored);

  store.remove(stored);
  await store.save();

  return interaction.reply({
    content: `🗑 \`${stored}\` удалён из списка${wasActive ? ' и выключен' : ''}.`,
    ...ephemeral,
  });
}

async function cmdStatus(interaction, { manager, config }) {
  const mc = { ...config.mc, version: manager.version ?? config.mc.version };
  return interaction.reply({ embeds: [buildStatusEmbed(manager.list(), mc)] });
}

const handlers = {
  list: cmdList,
  join: cmdJoin,
  joinall: cmdJoinAll,
  leave: cmdLeave,
  leaveall: cmdLeaveAll,
  accounts: cmdAccounts,
  add: cmdAdd,
  remove: cmdRemove,
  status: cmdStatus,
};

export async function handleCommand(interaction, context) {
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  return handler(interaction, context);
}

export async function handleAutocomplete(interaction, { manager, store }) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== 'nick') return interaction.respond([]).catch(() => {});

  const query = String(focused.value ?? '').toLowerCase();
  let names = [];

  if (interaction.commandName === 'join') {
    names = store.names().filter((name) => !manager.isActive(name));
  } else if (interaction.commandName === 'leave') {
    names = manager
      .list()
      .filter((session) => session.status !== 'offline')
      .map((session) => session.name);
  } else if (interaction.commandName === 'remove') {
    names = store.names();
  }

  const choices = names
    .filter((name) => name.toLowerCase().includes(query))
    .slice(0, 25)
    .map((name) => ({ name, value: name }));

  return interaction.respond(choices).catch(() => {});
}

export async function handleButton(interaction, { manager, config }) {
  if (interaction.customId !== 'tablist:refresh') return;

  await interaction.deferUpdate().catch(() => {});
  const data = await collectTabData(manager, config.mc);
  await interaction.editReply({ embeds: [buildTabEmbed(data)] }).catch(() => {});
}

export { collectTabData };
