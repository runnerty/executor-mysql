'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const MysqlExecutor = require('../index.js');

function createExecutor() {
  const executor = new MysqlExecutor({
    logger: { log: () => {} },
    checkExecutorParams: () => {},
    runtime: {},
    process: { id: 'TEST', name: 'Test', uId: 'test-uid', exec: {}, values: () => ({}) }
  });
  executor.settles = [];
  executor.end = options => executor.settles.push(options.end);
  return executor;
}

// Fake pool whose end() throws on a second call, like mysql2 does
// ("Can't add new command when connection is in closed state").
function createPool() {
  const pool = { queryStream: new EventEmitter(), ends: 0 };
  pool.query = () => pool.queryStream;
  pool.end = () => {
    if (++pool.ends > 1) throw new Error("Can't add new command when connection is in closed state");
  };
  return pool;
}

// After a `queryTimeout` error, mysql2 still delivers the late result and emits
// `end` once the server answers: the pool must be ended only once.
test('late end after a query timeout error ends the pool once and settles once', async () => {
  const executor = createExecutor();
  const pool = createPool();
  await executor.executeQuery(pool, 'SELECT SLEEP(10)', { queryTimeout: 1000 });

  pool.queryStream.emit('error', new Error('Query inactivity timeout'));
  pool.queryStream.emit('result', { 'SLEEP(10)': 0 });
  assert.doesNotThrow(() => pool.queryStream.emit('end'));

  assert.strictEqual(pool.ends, 1);
  assert.deepStrictEqual(executor.settles, ['error']);
});
