import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const list = (value) =>
  String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  token: (process.env.DISCORD_TOKEN ?? '').trim(),
  clientId: (process.env.DISCORD_CLIENT_ID ?? '').trim(),
  guildId: (process.env.DISCORD_GUILD_ID ?? '').trim(),
  adminRoleId: (process.env.ADMIN_ROLE_ID ?? '').trim(),
  adminUserIds: list(process.env.ADMIN_USER_IDS),
  allowEveryone: bool(process.env.ALLOW_EVERYONE, false),
  autoJoin: bool(process.env.AUTO_JOIN, false),
  dataDir: (process.env.DATA_DIR ?? 'data').trim() || 'data',
  accounts: list(process.env.ACCOUNTS),
  mc: {
    host: (process.env.MC_HOST ?? '5.83.140.250').trim(),
    port: int(process.env.MC_PORT, 25588),
    version: (process.env.MC_VERSION ?? 'auto').trim() || 'auto',
    auth: (process.env.MC_AUTH ?? 'offline').trim() || 'offline',
    reconnect: bool(process.env.RECONNECT, true),
    maxReconnects: Math.max(0, int(process.env.MAX_RECONNECTS, 0)),
    reconnectDelayMs: Math.max(500, int(process.env.RECONNECT_DELAY_MS, 5000)),
    maxReconnectDelayMs: Math.max(1000, int(process.env.RECONNECT_MAX_DELAY_MS, 60000)),
    joinDelayMs: Math.max(0, int(process.env.JOIN_DELAY_MS, 1500)),
    viewDistance: (process.env.MC_VIEW_DISTANCE ?? 'tiny').trim() || 'tiny',
    physics: bool(process.env.MC_PHYSICS, false),
  },
};
