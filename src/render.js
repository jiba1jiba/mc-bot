import { EmbedBuilder } from 'discord.js';
import { chunks, formatDuration, truncate } from './utils.js';

const STATUS = {
  online: { emoji: '🟢', label: 'онлайн' },
  connecting: { emoji: '🟡', label: 'подключение' },
  reconnecting: { emoji: '🟠', label: 'переподключение' },
  offline: { emoji: '⚪', label: 'выключен' },
};

export const statusInfo = (session) => STATUS[session.status] ?? STATUS.offline;

export function buildTabEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor(data.players.length ? 0x57f287 : 0xfee75c)
    .setTitle('📋 Таблист сервера')
    .setDescription(`\`${data.host}:${data.port}\``)
    .setFooter({
      text: `Источник: ${data.source} · ${new Date().toLocaleTimeString('ru-RU', { hour12: false })}`,
    })
    .setTimestamp(new Date());

  embed.addFields(
    {
      name: '🟢 Онлайн',
      value: data.max ? `**${data.online} / ${data.max}**` : `**${data.online}**`,
      inline: true,
    },
    { name: '🧩 Версия', value: truncate(data.version ?? '—', 100), inline: true },
    {
      name: '🤖 Мои боты',
      value: data.bots.length
        ? data.bots.slice(0, 25).map((b) => `\`${b}\``).join(', ') +
          (data.bots.length > 25 ? ` и ещё ${data.bots.length - 25}` : '')
        : 'нет',
      inline: true,
    },
  );

  if (data.pingError) {
    embed.addFields({
      name: '⚠️ Ping',
      value: `Сервер не ответил на ping: ${truncate(data.pingError, 200)}`,
    });
  }

  if (!data.players.length) {
    embed.addFields({
      name: '👥 Игроки',
      value: '_Никого нет, либо сервер скрывает список. Запустите бота через `/join`._',
    });
  } else {
    const botSet = new Set(data.bots.map((n) => n.toLowerCase()));
    const total = data.players.length;
    const shown = data.players.slice(0, 200);
    const lines = shown.map((name) =>
      botSet.has(name.toLowerCase()) ? `\`${name}\` 🤖` : `\`${name}\``,
    );

    const groups = chunks(lines, 40);
    groups.forEach((group, index) => {
      embed.addFields({
        name: index === 0 ? `👥 Игроки (${total})` : '…',
        value: group.join(' '),
      });
    });

    if (total > shown.length) {
      embed.addFields({ name: '…', value: `и ещё ${total - shown.length} игроков` });
    }
  }

  return embed;
}

export function buildStatusEmbed(sessions, mcConfig) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🛠 Статус ботов')
    .setDescription(
      `Сервер: \`${mcConfig.host}:${mcConfig.port}\`\nКлиент: \`${mcConfig.version}\` · режим: \`${mcConfig.auth}\``,
    )
    .setTimestamp(new Date());

  if (!sessions.length) {
    embed.addFields({ name: 'Пока пусто', value: 'Ни один аккаунт ещё не запускался.' });
    return embed;
  }

  const active = sessions.filter((s) => s.status !== 'offline').length;
  embed.addFields(
    { name: 'Активных', value: `**${active} / ${sessions.length}**`, inline: true },
    { name: 'Авто-реконнект', value: mcConfig.reconnect ? 'вкл' : 'выкл', inline: true },
  );

  for (const session of sessions.slice(0, 20)) {
    const info = statusInfo(session);
    const parts = [`${info.emoji} ${info.label}`];

    if (session.status === 'online' && session.connectedAt) {
      parts.push(`аптайм ${formatDuration(Date.now() - session.connectedAt)}`);
    } else if (session.status === 'reconnecting' && session.attempts) {
      parts.push(`попыток: ${session.attempts}`);
    }

    let value = parts.join(' · ');
    if (session.lastError) {
      value += `\n\`${truncate(session.lastError, 180).replaceAll('`', "'")}\``;
    }

    embed.addFields({ name: session.name, value, inline: false });
  }

  return embed;
}

export function buildAccountsEmbed(names, manager) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('🗂 Сохранённые аккаунты')
    .setDescription(`Всего: **${names.length}**\nДобавить: \`/add\` · Запустить: \`/join\``)
    .setTimestamp(new Date());

  if (!names.length) {
    embed.addFields({ name: 'Пусто', value: 'Добавьте аккаунт командой `/add`.' });
    return embed;
  }

  const shown = names.slice(0, 200);
  const lines = shown.map((name) => {
    const session = manager.get(name);
    if (!session) return `⚪ \`${name}\``;
    const info = statusInfo(session);
    return `${info.emoji} \`${name}\` — ${info.label}`;
  });

  const groups = chunks(lines, 25);
  groups.forEach((group, index) => {
    embed.addFields({
      name: index === 0 ? 'Список' : '…',
      value: group.join('\n'),
    });
  });

  if (names.length > shown.length) {
    embed.addFields({ name: '…', value: `и ещё ${names.length - shown.length} аккаунтов` });
  }

  return embed;
}
