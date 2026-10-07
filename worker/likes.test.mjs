import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const root = fileURLToPath(new URL('.', import.meta.url));
const harness = `import worker from './index.js';
export default { fetch(request, env, ctx) {
  return worker.fetch(request, { ...env, ASSETS: { fetch: async () =>
    request.headers.has('X-Fail-Routes') ? new Response('missing', {status: 404}) :
    Response.json(['/notes/example/', '/memos/随记/', '/en_US/notes/example/', '/notes/parallel/', '/notes/rollback/', '/about/', '/en_US/about/'].filter(path => !request.headers.has('X-Omit-About') || !path.endsWith('/about/')))
  } }, ctx);
}};`;
const modules = [{ type: 'ESModule', path: root + 'likes-harness.js', contents: harness }];
for (const file of ['index.js', 'likes.js', 'privacy.js', 'github-sync.js', 'github-home.js']) modules.push({ type: 'ESModule', path: root + file, contents: await readFile(root + file, 'utf8') });
const options = { modules, compatibilityDate: '2026-08-27', cf: false, logRequests: false, d1Databases: ['DB'] };
const runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
after(() => runtime.dispose());
const db = await runtime.getD1Database('DB');
// D1 exec is line-oriented; each complete SQL statement (including a trigger)
// belongs on one line in the migration runner used by this test.
const migration = await readFile(new URL('../migrations/0002_likes.sql', import.meta.url), 'utf8');
const statements = migration.replace(/--[^\n]*/g, '').match(/CREATE TRIGGER[\s\S]*?END;|CREATE TABLE[\s\S]*?;/g);
for (const statement of statements) await db.exec(statement.replace(/\s+/g, ' '));
const base = 'https://example.com';
const get = (paths, cookie, extra = {}) => runtime.dispatchFetch(`${base}/api/likes?${new URLSearchParams(paths.map(path => ['path', path]))}`, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...extra } });
const put = (path, liked, cookie, extra = {}) => runtime.dispatchFetch(`${base}/api/likes`, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: JSON.stringify({ path, liked }) });
const state = async response => { assert.equal(response.status, 200, await response.clone().text()); return (await response.json()).items[0]; };
const cookieFor = response => response.headers.get('Set-Cookie')?.split(';')[0];

test('likes survive revisits, deduplicate retries, cancel once, and remain private to each browser', async () => {
  const first = await get(['/notes/example/']);
  assert.equal(cookieFor(first), undefined, 'Reading likes must not create a Cookie');
  assert.match(first.headers.get('Cache-Control'), /no-store/);
  assert.deepEqual(await state(first), { path: '/notes/example/', count: 0, liked: false });
  const created = await put('/notes/example/', true);
  const cookie = cookieFor(created);
  assert.match(cookie, /^daybook_engagement=/);
  assert.match(created.headers.get('Set-Cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal((await state(created)).count, 1);
  assert.equal((await state(await put('/notes/example/', true, cookie))).count, 1);
  const revisited = await get(['/notes/example/?ui=en_US#heading'], cookie);
  assert.equal(cookieFor(revisited), undefined);
  assert.deepEqual(await state(revisited), { path: '/notes/example/', count: 1, liked: true });
  const other = await get(['/notes/example/']);
  assert.equal(cookieFor(other), undefined);
  assert.deepEqual(await state(other), { path: '/notes/example/', count: 1, liked: false });
  const otherCreated = await put('/notes/example/', true);
  const otherCookie = cookieFor(otherCreated);
  assert.equal((await state(otherCreated)).count, 2);
  assert.deepEqual(await state(await put('/notes/example/', false, cookie)), { path: '/notes/example/', count: 1, liked: false });
  assert.equal((await state(await put('/notes/example/', false, cookie))).count, 1);
  assert.equal((await state(await get(['/notes/example/'], otherCookie))).liked, true);
});

test('published About pages support reading, liking, revisiting and cancelling', async () => {
  for (const path of ['/about/', '/en_US/about/']) {
    const first = await get([path]);
    assert.equal(cookieFor(first), undefined);
    assert.deepEqual(await state(first), { path, count: 0, liked: false });
    const created = await put(path, true);
    const cookie = cookieFor(created);
    assert.match(cookie, /^daybook_engagement=/);
    assert.deepEqual(await state(created), { path, count: 1, liked: true });
    assert.deepEqual(await state(await get([path + '?ui=en_US#top'], cookie)), { path, count: 1, liked: true });
    assert.deepEqual(await state(await put(path, true, cookie)), { path, count: 1, liked: true });
    assert.deepEqual(await state(await put(path, false, cookie)), { path, count: 0, liked: false });
    assert.equal((await get([path], null, { 'X-Omit-About': '1' })).status, 404);
    assert.equal((await put(path, true, null, { 'X-Omit-About': '1' })).status, 404);
    assert.equal((await get([path], null, { 'X-Fail-Routes': '1' })).status, 503);
  }
  for (const path of ['/about/child/', '/aboutness/', '/archive/']) {
    assert.equal((await put(path, true)).status, 400);
  }
});

test('encoded memo paths, batch reads, and an existing engagement Cookie share the same identity', async () => {
  const cookie = 'daybook_engagement=12345678-1234-4234-8234-123456789abc';
  assert.equal((await state(await put('/memos/%E9%9A%8F%E8%AE%B0/', true, cookie))).path, '/memos/随记/');
  const response = await get(['/memos/随记/', '/en_US/notes/example/'], cookie);
  assert.equal(cookieFor(response), undefined);
  const data = await response.json();
  assert.deepEqual(data.items.map(item => item.liked), [true, false]);
});

test('concurrent duplicates and cancellations keep the total consistent', async () => {
  const cookies = Array.from({ length: 8 }, () => `daybook_engagement=${crypto.randomUUID()}`);
  await Promise.all(cookies.flatMap(cookie => [put('/notes/parallel/', true, cookie), put('/notes/parallel/', true, cookie)]));
  assert.equal((await state(await get(['/notes/parallel/']))).count, 8);
  await Promise.all(cookies.flatMap(cookie => [put('/notes/parallel/', false, cookie), put('/notes/parallel/', false, cookie)]));
  assert.equal((await state(await get(['/notes/parallel/']))).count, 0);
});

test('rejects unpublished paths, malformed requests and cross-site mutations without writing', async () => {
  assert.equal((await get(['/notes/draft/'])).status, 404);
  for (const path of ['/', '/memos/', '/notes/%ZZ/', '//evil.test/notes/example/']) assert.equal((await get([path])).status, 400);
  assert.equal((await get(['/notes/example/'], null, { 'X-Fail-Routes': '1' })).status, 503);
  assert.equal((await put('/notes/example/', true, null, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await put('/notes/example/', true, null, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await put('/notes/example/', 'true')).status, 400);
  assert.equal((await put('/notes/example/', true, null, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await runtime.dispatchFetch(base + '/api/likes', { method: 'POST' })).status, 405);
  const tooBig = await runtime.dispatchFetch(base + '/api/likes', { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: ' '.repeat(2050) });
  assert.equal(tooBig.status, 400);
});

test('a failed count trigger rolls back the like record', async () => {
  await db.exec("CREATE TRIGGER fail_count BEFORE INSERT ON like_counts WHEN NEW.path = '/notes/rollback/' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  assert.equal((await put('/notes/rollback/', true)).status, 503);
  assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM likes WHERE path = '/notes/rollback/'").first()).n, 0);
});
