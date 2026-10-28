const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/features/auth/services/sessionObserver.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { observeSession } = exportsObject;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const session = id => ({ user: { id }, access_token: 'fixture-' + id });
function fixture({ initial, loadAccount = async id => ({ id }), firstRead } = {}) {
  let current = initial ?? null, listener, reads = 0, unsubscribed = false;
  const snapshots = [], queue = [], accountReads = [];
  const stop = observeSession({
    getSession: () => { reads++; return reads === 1 && firstRead ? firstRead.promise : Promise.resolve(current); },
    subscribe: callback => { listener = callback; return () => { unsubscribed = true; }; },
    loadAccount: id => { accountReads.push(id); return loadAccount(id); },
    publish: value => snapshots.push(value),
    errorMessage: () => 'Permiso rechazado',
    defer: run => { const job = { run, cancelled: false }; queue.push(job); return () => { job.cancelled = true; }; },
  });
  return {
    snapshots, accountReads, stop,
    emit(value) { current = value; listener(value); },
    storage(value) { current = value; },
    async flush() { await tick(); while (queue.length) { const job = queue.shift(); if (!job.cancelled) job.run(); await tick(); } },
    last() { return snapshots.at(-1); },
    unsubscribed() { return unsubscribed; },
  };
}

test('a delayed anonymous initial read cannot overwrite the confirmed signup session', async () => {
  const firstRead = deferred(), f = fixture({ firstRead });
  f.emit(session('confirmed'));
  await f.flush();
  assert.equal(f.last().estado, 'con-sesion');
  firstRead.resolve(null);
  await f.flush();
  assert.equal(f.last().usuario.id, 'confirmed');
  assert.equal(f.last().cuenta.id, 'confirmed');
  assert.equal(f.last().estado, 'con-sesion');
  f.stop();
});

test('logout discards in-flight account errors rather than showing a stale permission error', async () => {
  const account = deferred(), f = fixture({ initial: session('old'), loadAccount: () => account.promise });
  await f.flush();
  assert.equal(f.accountReads.length, 1);
  f.emit(null);
  account.reject(new Error('permission denied'));
  await f.flush();
  assert.equal(f.last().estado, 'sin-sesion');
  assert.equal(f.last().cuenta, null);
  assert.equal(f.last().error, null);
  f.stop();
});

test('an older account response cannot replace the new user after a second sign-in', async () => {
  const old = deferred(), f = fixture({ initial: session('old'), loadAccount: id => id === 'old' ? old.promise : Promise.resolve({ id }) });
  await f.flush();
  f.emit(session('new'));
  assert.equal(f.last().estado, 'cargando');
  assert.equal(f.last().cuenta, null);
  await f.flush();
  old.resolve({ id: 'old' });
  await f.flush();
  assert.equal(f.last().usuario.id, 'new');
  assert.equal(f.last().cuenta.id, 'new');
  f.stop();
});

test('account reads wait for the current SDK session rather than using an outdated event', async () => {
  const f = fixture();
  f.emit(session('outdated'));
  f.storage(session('current'));
  await f.flush();
  assert.deepEqual(f.accountReads, ['current']);
  assert.equal(f.last().cuenta.id, 'current');
  f.stop();
});

test('current permission errors stay errors, and disposal cancels scheduled reads', async () => {
  const failed = fixture({ initial: session('current'), loadAccount: async () => { throw Error('RLS'); } });
  await failed.flush();
  assert.equal(failed.last().estado, 'error');
  assert.equal(failed.last().error, 'Permiso rechazado');
  assert.equal(failed.last().cuenta, null);
  failed.stop();
  const disposed = fixture();
  disposed.emit(session('current'));
  disposed.stop();
  await disposed.flush();
  assert.deepEqual(disposed.accountReads, []);
  assert.equal(disposed.unsubscribed(), true);
});
