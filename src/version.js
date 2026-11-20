import mcData from 'minecraft-data';
import { pingServer } from './net.js';

/**
 * Resolves the client version the server actually runs.
 * Ping reports the server's native protocol, which we map to a version
 * supported by mineflayer/minecraft-data. Falls back to parsing the MOTD.
 */
export async function resolveVersion(mcConfig) {
  if (mcConfig.version && mcConfig.version !== 'auto') return mcConfig.version;

  const info = await pingServer(mcConfig);
  const protocol = info?.version?.protocol;

  const byProtocol = mcData.versions.pc.find(
    (v) => v.version === protocol && !String(v.minecraftVersion).includes('-'),
  );
  if (byProtocol) return byProtocol.minecraftVersion;

  const name = String(info?.version?.name ?? '');
  const match = name.match(/\d+\.\d+(?:\.\d+)?/);
  if (match) {
    const exact = mcData.versions.pc.find((v) => v.minecraftVersion === match[0]);
    if (exact) return exact.minecraftVersion;
  }

  throw new Error(`не удалось определить версию сервера (${name || '?'}, protocol ${protocol ?? '?'})`);
}
