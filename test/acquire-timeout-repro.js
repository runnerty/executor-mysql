/* eslint-disable no-console */
'use strict';

/**
 * Manual reproduction script (not wired to `npm test`).
 *
 * Reproduces a production failure mode observed on AWS RDS MySQL 8.0:
 * the server stalls halfway through the connection handshake and later
 * emits an out-of-sequence auth packet. mysql2 prints
 * `Warning: got packets out of order. Expected 2 but received 1`,
 * disarms nothing and the connection hangs forever:
 *   - `connectTimeout` was already disarmed by the FIRST byte received.
 *   - the query `timeout` never arms, because it is armed in
 *     `Query.start()` and the command never starts.
 * Without a bound on the acquisition phase, the executor never settles
 * and the whole Runnerty chain stays locked until the host is restarted.
 *
 * Run:  node test/acquire-timeout-repro.js
 * PASS: the executor settles with a connection-acquire-timeout error
 *       shortly after `queryTimeout` expires.
 * FAIL: nothing settles within 15s (behaviour prior to this fix).
 */

const net = require('net');
const MysqlExecutor = require('../index.js');

// Real handshake-init packet captured from MySQL 8.0.46 (seq 0).
const GREETING = Buffer.from(
  '4a0000000a382e302e3436000b0000004668526a4064266400ffffff0200ffdf1500000000000000000000' +
    '49697a0d1e43726870615e2f0063616368696e675f736861325f70617373776f726400',
  'hex'
);

// AuthMoreData (0x01) + 0x04 = caching_sha2 "perform full authentication",
// sent with sequence id 1 while the client expects 2 → triggers the exact
// "got packets out of order. Expected 2 but received 1" warning seen in
// production, then the client waits forever for the server public key.
const DESYNCED_AUTH_MORE_DATA = Buffer.from([0x02, 0x00, 0x00, 0x01, 0x01, 0x04]);

const QUERY_TIMEOUT_MS = 3000;
const VERDICT_AFTER_MS = 15000;

function startStallServer(cb) {
  const server = net.createServer(socket => {
    socket.write(GREETING);
    // Ignore the client HandshakeResponse entirely (stalled server) and
    // after 1s send the desynced auth packet. Keep the socket open.
    setTimeout(() => socket.write(DESYNCED_AUTH_MORE_DATA), 1000);
  });
  server.listen(0, '127.0.0.1', () => cb(server));
}

startStallServer(server => {
  const port = server.address().port;

  const executor = new MysqlExecutor({
    logger: { log: () => {} },
    checkExecutorParams: () => {},
    runtime: {},
    process: {
      id: 'ACQUIRE-TIMEOUT-REPRO',
      name: 'Acquire timeout repro',
      uId: 'repro-uid',
      exec: {},
      values: () => ({})
    }
  });

  const t0 = Date.now();
  let settled = false;

  // Capture the settle instead of going through the Runnerty runtime.
  executor.end = options => {
    settled = true;
    const elapsed = Date.now() - t0;
    const isError = options.end === 'error';
    const isAcquireTimeout = /acquire timeout/i.test(String(options.err_output || ''));
    const inTime = elapsed < QUERY_TIMEOUT_MS + 3000;
    console.log(`settled after ${elapsed}ms → end="${options.end}" err="${options.err_output}"`);
    if (isError && isAcquireTimeout && inTime) {
      console.log('PASS: acquisition phase bounded, process settled with an error');
      process.exit(0);
    }
    console.log('FAIL: settled, but not with the expected acquire-timeout error');
    process.exit(1);
  };

  executor.exec({
    user: 'root',
    password: 'whatever',
    database: 'whatever',
    host: '127.0.0.1',
    port,
    command: 'SELECT 1',
    queryTimeout: QUERY_TIMEOUT_MS
  });

  setTimeout(() => {
    if (!settled) {
      console.log(`FAIL: nothing settled after ${VERDICT_AFTER_MS}ms — the chain would hang forever`);
      process.exit(1);
    }
  }, VERDICT_AFTER_MS);
});
