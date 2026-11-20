import mineflayer from 'mineflayer';
import { EventEmitter } from 'node:events';
import { logger } from './logger.js';
import { formatReason } from './utils.js';
import { resolveVersion } from './version.js';
import { attachResourcePackHandler } from './resourcepack.js';

const ACTIVE_STATUSES = new Set(['connecting', 'online', 'reconnecting']);

// Kicks that will never succeed on retry — don't hammer the server.
const PERMANENT_KICK =
  /(whitelist|вайтлист|banned|забан|blacklist|ч[её]рный список|not allowed|duplicate_login|already (logged|connected|online)|уже (в игре|зашёл|зашел|подключ[её]н))/i;

export class BotManager extends EventEmitter {
  constructor(mcConfig) {
    super();
    this.mc = mcConfig;
    this.version = mcConfig.version !== 'auto' ? mcConfig.version : null;
    this.versionPromise = null;
    /** @type {Map<string, object>} key = lowercased nickname */
    this.sessions = new Map();
  }

  async ensureVersion() {
    if (this.mc.version && this.mc.version !== 'auto') return this.mc.version;
    if (this.version) return this.version;
    if (!this.versionPromise) {
      this.versionPromise = resolveVersion(this.mc)
        .then((version) => {
          this.version = version;
          logger.info(`Версия Minecraft определена автоматически: ${version}`);
          return version;
        })
        .finally(() => {
          this.versionPromise = null;
        });
    }

    try {
      return await this.versionPromise;
    } catch (err) {
      logger.warn(`Не удалось определить версию (${err.message}); использую 1.21.4`);
      return '1.21.4';
    }
  }

  get(name) {
    if (!name) return null;
    return this.sessions.get(String(name).toLowerCase()) ?? null;
  }

  list() {
    return [...this.sessions.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  online() {
    return this.list().filter((s) => s.status === 'online' && s.bot);
  }

  isActive(name) {
    const session = this.get(name);
    return Boolean(session && ACTIVE_STATUSES.has(session.status));
  }

  async join(name) {
    const existing = this.get(name);
    if (existing && ACTIVE_STATUSES.has(existing.status)) {
      return { ok: false, reason: 'already', session: existing };
    }

    const session = {
      key: name.toLowerCase(),
      name,
      version: null,
      status: 'connecting',
      bot: null,
      startedAt: Date.now(),
      connectedAt: null,
      disconnectedAt: null,
      attempts: 0,
      lastError: null,
      endReason: null,
      reconnectAt: null,
      reconnectTimer: null,
      manualStop: false,
      reconnectDisabled: false,
    };

    // Reserve the nickname before the async version lookup, so two simultaneous
    // /join calls can't create two bots with the same name.
    this.sessions.set(session.key, session);
    this.emit('change', session);

    session.version = await this.ensureVersion();

    if (session.manualStop) {
      session.status = 'offline';
      this.emit('change', session);
      return { ok: false, reason: 'stopped', session };
    }

    this._connect(session);
    return { ok: true, session };
  }

  _connect(session) {
    if (session.manualStop) return;
    session.status = session.attempts > 0 ? 'reconnecting' : 'connecting';

    let bot;
    try {
      bot = mineflayer.createBot({
        host: this.mc.host,
        port: this.mc.port,
        username: session.name,
        auth: this.mc.auth,
        version: session.version ?? this.version ?? this.mc.version,
        viewDistance: this.mc.viewDistance,
        physicsEnabled: this.mc.physics,
        hideErrors: true,
        checkTimeoutInterval: 60_000,
      });
    } catch (err) {
      session.lastError = err?.message ?? String(err);
      logger.error(`[${session.name}] не удалось создать бота: ${session.lastError}`);
      this._scheduleReconnect(session);
      return;
    }

    session.bot = bot;
    attachResourcePackHandler(bot);

    bot.once('login', () => {
      session.status = 'online';
      session.connectedAt = Date.now();
      session.disconnectedAt = null;
      session.attempts = 0;
      session.lastError = null;
      session.endReason = null;
      logger.info(`[${session.name}] вошёл на ${this.mc.host}:${this.mc.port}`);
      this.emit('change', session);
    });

    bot.on('spawn', () => {
      if (session.status !== 'online') {
        session.status = 'online';
        session.connectedAt ??= Date.now();
        this.emit('change', session);
      }
    });

    bot.on('kicked', (reason) => {
      const text = formatReason(reason);
      session.lastError = `кик: ${text}`;

      if (PERMANENT_KICK.test(text)) {
        session.reconnectDisabled = true;
        logger.warn(`[${session.name}] ${session.lastError} — автопереподключение отключено`);
      } else {
        logger.warn(`[${session.name}] ${session.lastError}`);
      }

      this.emit('change', session);
    });

    bot.on('error', (err) => {
      const message = err?.message ?? String(err);
      logger.error(`[${session.name}] ошибка: ${message}`);
      // Don't overwrite a more useful kick reason (e.g. whitelist) with ECONNRESET.
      if (!session.lastError?.startsWith('кик:')) session.lastError = message;
    });

    bot.on('end', (reason) => {
      session.bot = null;
      if (reason) session.endReason = formatReason(reason);

      if (session.manualStop) {
        session.status = 'offline';
        session.disconnectedAt = Date.now();
        this.emit('change', session);
        return;
      }

      logger.warn(`[${session.name}] соединение закрыто: ${session.endReason ?? 'без причины'}`);
      this._scheduleReconnect(session);
    });

    this.emit('change', session);
  }

  _scheduleReconnect(session) {
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    if (session.manualStop) {
      session.status = 'offline';
      this.emit('change', session);
      return;
    }

    if (!this.mc.reconnect) {
      session.status = 'offline';
      session.disconnectedAt = Date.now();
      this.emit('change', session);
      return;
    }

    if (session.reconnectDisabled) {
      session.status = 'offline';
      session.disconnectedAt = Date.now();
      this.emit('change', session);
      return;
    }

    if (this.mc.maxReconnects > 0 && session.attempts >= this.mc.maxReconnects) {
      session.status = 'offline';
      session.disconnectedAt = Date.now();
      session.lastError = `переподключение остановлено после ${session.attempts} попыток`;
      logger.error(`[${session.name}] ${session.lastError}`);
      this.emit('change', session);
      return;
    }

    session.attempts += 1;
    const delay = Math.min(
      this.mc.reconnectDelayMs * 1.7 ** (session.attempts - 1),
      this.mc.maxReconnectDelayMs,
    );

    session.status = 'reconnecting';
    session.reconnectAt = Date.now() + delay;
    session.reconnectTimer = setTimeout(() => {
      session.reconnectTimer = null;
      session.reconnectAt = null;
      this._connect(session);
    }, delay);

    this.emit('change', session);
  }

  leave(name) {
    const session = this.get(name);
    if (!session) return { ok: false, reason: 'notfound' };

    session.manualStop = true;
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = null;
    }

    const bot = session.bot;
    session.bot = null;
    session.status = 'offline';
    session.disconnectedAt = Date.now();

    if (bot) {
      try {
        bot.quit('Выключение по команде');
      } catch {
        try {
          bot.end();
        } catch {
          /* ignore */
        }
      }
    }

    this.emit('change', session);
    return { ok: true, session };
  }

  /** Full player list from tabs of all connected bots. */
  tabList() {
    const names = new Set();
    for (const session of this.online()) {
      for (const name of Object.keys(session.bot.players ?? {})) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  shutdown() {
    for (const session of this.list()) {
      session.manualStop = true;
      if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
      if (session.bot) {
        try {
          session.bot.quit('Бот выключается');
        } catch {
          /* ignore */
        }
      }
      session.bot = null;
      session.status = 'offline';
    }
  }
}
