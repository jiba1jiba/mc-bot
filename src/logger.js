const time = () =>
  new Date().toLocaleTimeString('ru-RU', { hour12: false });

const fmt = (args) =>
  args
    .map((a) => (a instanceof Error ? (a.stack ?? a.message) : typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');

export const logger = {
  info: (...args) => console.log(`[${time()}] [INFO] ${fmt(args)}`),
  warn: (...args) => console.warn(`[${time()}] [WARN] ${fmt(args)}`),
  error: (...args) => console.error(`[${time()}] [ERR ] ${fmt(args)}`),
};
