import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

const DEFAULT_ACCOUNTS = ['serphut', 'serphut1', 'serphut2', 'serphut3'];

export class Store {
  constructor(dir, accounts = []) {
    this.dir = dir;
    this.file = path.join(dir, 'accounts.json');
    this.accounts = accounts;
  }

  static async load(dir, seed = DEFAULT_ACCOUNTS) {
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'accounts.json');

    try {
      const raw = JSON.parse(await fs.readFile(file, 'utf8'));
      const accounts = Array.isArray(raw?.accounts) ? raw.accounts : [];
      const normalized = accounts
        .map((a) => (typeof a === 'string' ? { name: a } : a))
        .filter((a) => a && typeof a.name === 'string')
        .map((a) => ({ name: a.name, addedAt: a.addedAt ?? null }));
      return new Store(dir, normalized);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Не удалось прочитать ${file}: ${err.message}. Создаю новый список.`);
        try {
          await fs.rename(file, `${file}.bak-${Date.now()}`);
        } catch {
          /* ignore */
        }
      }
      const initial = seed.length ? seed : DEFAULT_ACCOUNTS;
      const store = new Store(
        dir,
        initial.map((name) => ({ name, addedAt: new Date().toISOString() })),
      );
      await store.save();
      logger.info(`Создан список аккаунтов: ${initial.join(', ')}`);
      return store;
    }
  }

  names() {
    return this.accounts.map((a) => a.name);
  }

  has(name) {
    const key = String(name).toLowerCase();
    return this.accounts.some((a) => a.name.toLowerCase() === key);
  }

  add(name) {
    if (!name || this.has(name)) return false;
    this.accounts.push({ name, addedAt: new Date().toISOString() });
    return true;
  }

  remove(name) {
    const key = String(name).toLowerCase();
    const index = this.accounts.findIndex((a) => a.name.toLowerCase() === key);
    if (index === -1) return false;
    this.accounts.splice(index, 1);
    return true;
  }

  async save() {
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify({ accounts: this.accounts }, null, 2)}\n`, 'utf8');
    await fs.rename(tmp, this.file);
  }
}
