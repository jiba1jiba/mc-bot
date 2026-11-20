import { config } from '../src/config.js';
import { BotManager } from '../src/manager.js';

const nick = process.argv[2];
if (!nick) {
  console.error('Укажите ник: npm run test-join -- serphut1');
  process.exit(1);
}

const manager = new BotManager({ ...config.mc, reconnect: process.argv.includes('--reconnect') });
manager.on('change', (session) => {
  console.log(
    `[change] ${session.name}: ${session.status}${session.lastError ? ` (${session.lastError})` : ''}`,
  );
});

console.log(`Сервер: ${config.mc.host}:${config.mc.port}`);
const result = await manager.join(nick);
console.log(`[join] ${nick}: ${result.ok ? 'ok' : result.reason}`);

await new Promise((resolve) => setTimeout(resolve, 15_000));
console.log('[таблист]', manager.tabList());
console.log('[статус]', manager.list().map((s) => `${s.name}=${s.status}`).join(', '));

manager.shutdown();
setTimeout(() => process.exit(0), 1500);
