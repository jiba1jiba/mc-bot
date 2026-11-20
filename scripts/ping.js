import { config } from '../src/config.js';
import { pingServer } from '../src/net.js';

try {
  const info = await pingServer(config.mc);
  console.log(`Сервер: ${config.mc.host}:${config.mc.port}`);
  console.log(`Версия: ${info.version?.name ?? '?'} (protocol ${info.version?.protocol ?? '?'})`);
  console.log(`Онлайн: ${info.players?.online ?? '?'} / ${info.players?.max ?? '?'}`);
  const sample = info.players?.sample?.map((p) => p.name) ?? [];
  console.log(`Игроки: ${sample.length ? sample.join(', ') : '(список скрыт)'}`);
  const motd = typeof info.description === 'string' ? info.description : info.description?.text;
  if (motd) console.log(`MOTD: ${motd.replace(/\n/g, ' | ')}`);
} catch (err) {
  console.error(`Не удалось пропинговать ${config.mc.host}:${config.mc.port}: ${err.message}`);
  process.exit(1);
}
