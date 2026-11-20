import { logger } from './logger.js';

const ACCEPTED = 3;
const SUCCESSFULLY_LOADED = 0;

/**
 * Servers often force a resource pack and hold the login/configuration phase
 * until the client answers. Mineflayer's built-in auto-accept writes a UUID
 * object, which some newer protocols serialize incorrectly, so the client
 * hangs in "configuration" forever. We answer ourselves with the raw UUID.
 */
export function attachResourcePackHandler(bot) {
  // Replace mineflayer's built-in handlers to avoid duplicate/broken replies.
  bot._client.removeAllListeners('add_resource_pack');
  bot._client.removeAllListeners('resource_pack_send');

  const reply = (payload, label) => {
    try {
      bot._client.write('resource_pack_receive', { ...payload, result: ACCEPTED });
      bot._client.write('resource_pack_receive', { ...payload, result: SUCCESSFULLY_LOADED });
      logger.info(`Ресурспак принят${label ? ` (${label})` : ''}`);
    } catch (err) {
      logger.warn(`Не удалось ответить на ресурспак: ${err.message}`);
    }
  };

  bot._client.on('add_resource_pack', (data) => {
    if (!data?.uuid) return;
    reply({ uuid: data.uuid }, 'add_resource_pack');
  });

  bot._client.on('resource_pack_send', (data) => {
    if (!data?.hash) return;
    reply({ hash: data.hash }, 'resource_pack_send');
  });
}
