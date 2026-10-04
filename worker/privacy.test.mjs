import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const root = fileURLToPath(new URL('.', import.meta.url));
const modules = [{ type: 'ESModule', path: root + 'privacy-harness.js', contents: `
import worker from './index.js';
export default { fetch(request, env, ctx) {
  return worker.fetch(request, { ...env,
    ASSETS: { fetch: async () => Response.json(['/notes/example/']) },
    SITE_PRESENCE: { idFromName: () => 'global', get: () => ({ fetch: async req => Response.json({ id: req.headers.get('X-Visitor-Hash') }) }) }
  }, ctx);
}};` }];
for (const file of ['index.js', 'privacy.js', 'likes.js', 'github-sync.js', 'github-home.js']) modules.push({ type: 'ESModule', path: root + file, contents: await readFile(root + file, 'utf8') });
const options = { modules, compatibilityDate: '2026-08-27', cf: false, logRequests: false, d1Databases: ['DB'] };
const runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
after(() => runtime.dispose());
const db = await runtime.getD1Database('DB');
for (const file of ['0001_init.sql', '0002_likes.sql']) {
  const sql = (await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8')).replace(/--[^\n]*/g, '');
  for (const statement of sql.match(/CREATE TRIGGER[\s\S]*?END;|(?:CREATE TABLE|CREATE INDEX|INSERT)[^;]+;/g)) await db.exec(statement.replace(/\s+/g, ' '));
}
const base = 'https://example.com';
const call = (path, body, cookie, headers = {}) => runtime.dispatchFetch(base + path, {
  method: path === '/api/hit' ? 'POST' : 'PUT',
  headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(body),
});
const cookieFor = (response, name) => response.headers.getSetCookie().find(cookie => cookie.startsWith(name + '='))?.split(';')[0];
const rows = async () => (await db.prepare('SELECT COUNT(*) AS n FROM visitors').first()).n;

test('consent separates visitor identity from aggregate views, likes and presence', async () => {
  const fresh = await call('/api/privacy', { analytics: false });
  assert.deepEqual(await fresh.json(), { version: 1, analytics: false });
  assert.match(fresh.headers.get('Set-Cookie'), /daybook_analytics=;.*Max-Age=0/);
  const first = await call('/api/hit', { path: '/', analytics: false });
  assert.equal(first.headers.get('Set-Cookie'), null);
  assert.deepEqual(await first.json(), { path: '/', pageViews: 1, totalViews: 1, visitors: 0 });
  const legacy = 'daybook_visitor=12345678-1234-4234-8234-123456789abc';
  await call('/api/hit', { path: '/' }, legacy);
  assert.equal(await rows(), 0, 'Old clients do not establish a statistics identity');

  const granted = await call('/api/privacy', { analytics: true });
  const analytics = cookieFor(granted, 'daybook_analytics');
  assert.match(analytics, /^daybook_analytics=.+/);
  const accepted = await call('/api/hit', { path: '/', analytics: true, countView: false }, analytics);
  assert.equal((await accepted.json()).pageViews, 2, 'Changing consent does not double-count a view');
  assert.equal(await rows(), 1);
  await call('/api/hit', { path: '/', analytics: false }, analytics);
  assert.equal(await rows(), 1, 'Cookie alone never enables statistics');

  const read = await runtime.dispatchFetch(base + '/api/likes?path=/notes/example/', { headers: { Cookie: analytics } });
  assert.equal(read.headers.get('Set-Cookie'), null);
  assert.equal((await read.json()).items[0].liked, false);
  const liked = await call('/api/likes', { path: '/notes/example/', liked: true }, analytics);
  const engagement = cookieFor(liked, 'daybook_engagement');
  assert.match(engagement, /^daybook_engagement=.+/);
  assert.notEqual(engagement.split('=')[1], analytics.split('=')[1]);
  await call('/api/hit', { path: '/', analytics: true }, engagement);
  assert.equal(await rows(), 1, 'Likes Cookie cannot become an analytics identity');

  const withdrawn = await call('/api/privacy', { analytics: false }, analytics + '; ' + engagement);
  assert.match(withdrawn.headers.get('Set-Cookie'), /daybook_analytics=;.*Max-Age=0/);
  assert.equal(cookieFor(withdrawn, 'daybook_engagement'), undefined);
  const late = await call('/api/hit', { path: '/', analytics: true }, analytics);
  assert.equal(late.headers.get('Set-Cookie'), null, 'An old in-flight hit cannot recreate a deleted Cookie');
  const stillLiked = await runtime.dispatchFetch(base + '/api/likes?path=/notes/example/', { headers: { Cookie: engagement } });
  assert.equal((await stillLiked.json()).items[0].liked, true);

  const presence = () => runtime.dispatchFetch(base + '/api/presence?path=/', { headers: { Origin: base, Upgrade: 'websocket', Cookie: analytics + '; ' + engagement } }).then(res => res.json());
  assert.notEqual((await presence()).id, (await presence()).id, 'Presence identifies connections, not returning browsers');
});

test('legacy likes survive retiring the old multipurpose cookie', async () => {
  const token = crypto.randomUUID();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('daybook-default-salt'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const hash = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))).toString('hex');
  await db.prepare('INSERT INTO likes (path, visitor_hash) VALUES (?, ?)').bind('/notes/example/', hash).run();
  const migrated = await call('/api/privacy', { analytics: false }, 'daybook_visitor=' + token);
  assert.equal(cookieFor(migrated, 'daybook_engagement'), 'daybook_engagement=' + token);
  assert.match(migrated.headers.getSetCookie().find(value => value.startsWith('daybook_visitor=')), /Max-Age=0/);
  const withoutLikes = await call('/api/privacy', { analytics: false }, 'daybook_visitor=' + crypto.randomUUID());
  assert.equal(cookieFor(withoutLikes, 'daybook_engagement'), undefined);
});

test('invalid and cross-site choices cannot grant consent', async () => {
  for (const body of [null, {}, { analytics: 'true' }]) assert.equal((await call('/api/privacy', body)).status, 400);
  assert.equal((await call('/api/privacy', { analytics: true }, null, { Origin: 'https://evil.test' })).status, 403);
  assert.equal((await call('/api/privacy', { analytics: true }, null, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await call('/api/privacy', { analytics: true }, null, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await call('/api/privacy', { analytics: true, padding: ' '.repeat(2048) })).status, 400);
  assert.equal((await runtime.dispatchFetch(base + '/api/privacy')).status, 405);
});
