import mc from 'minecraft-protocol';

/**
 * Server-list ping. Does not join the server, just asks the MOTD/version/players.
 * Works even when no bot is connected.
 */
export function pingServer({ host, port }, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(
      () => finish(reject, new Error('таймаут пинга (сервер не ответил)')),
      timeoutMs,
    );

    try {
      mc.ping({ host, port, closeTimeout: timeoutMs }, (err, response) => {
        if (err) finish(reject, err);
        else finish(resolve, response);
      });
    } catch (err) {
      finish(reject, err);
    }
  });
}
