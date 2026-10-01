import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const workerDir = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(await readFile(publicDir + 'assets-manifest.json', 'utf8'));
const routes = JSON.parse(await readFile(publicDir + 'routes.json', 'utf8'));
const modules = [];
for (const file of ['index.js', 'github-sync.js', 'github-home.js']) modules.push({ type: 'ESModule', path: workerDir + file, contents: await readFile(workerDir + file, 'utf8') });
const options = {
  modules, compatibilityDate: '2026-08-27', cf: false, logRequests: false,
  bindings: { GITHUB_USERNAME: 'StatIndet' },
  assets: { directory: publicDir, binding: 'ASSETS', run_worker_first: true, routerConfig: { has_user_worker: true } },
};
const runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
after(() => runtime.dispose());
const immutable = 'public, max-age=31536000, immutable';
const revalidate = 'public, max-age=0, must-revalidate';

async function assertPolicy(path, expected) {
  const response = await runtime.dispatchFetch('http://localhost' + path);
  assert.equal(response.status, 200, path + (response.status === 200 ? '' : ': ' + await response.text()));
  assert.equal(response.headers.get('Cache-Control'), expected, path + ' must have one unambiguous cache policy');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff', path);
  return response;
}

test('content-hashed CSS, font CSS, font binaries and image textures are immutable', async () => {
  const originals = ['/css/bundles/common.css', '/vendor/fonts/lxgw-wenkai-screen/regular/result.css', '/vendor/fonts/material-symbols/material-symbols-rounded.woff2', '/images/settings-paper.webp'];
  for (const original of originals) {
    const hashed = manifest[original];
    assert.ok(hashed?.startsWith('/immutable/'), original + ' must be fingerprinted');
    await assertPolicy(hashed, immutable);
  }
});

test('HTML at the root, translated and nested article paths revalidates', async () => {
  const article = routes.find(path => path.startsWith('/notes/') && path.split('/').filter(Boolean).length > 1);
  assert.ok(article, 'built vault must have an article route');
  for (const path of ['/', '/en_US/', '/notes/', '/en_US/notes/', article, article + 'index.html']) await assertPolicy(path, revalidate);
});

test('original vendor assets and public snapshots revalidate', async () => {
  for (const path of ['/vendor/fonts/material-symbols/material-symbols-rounded.woff2', '/vendor/fonts/lxgw-wenkai-screen/regular/result.css', '/assets-manifest.json', '/github-profile.json']) await assertPolicy(path, revalidate);
});

test('homepage Worker rewrite retains revalidation and removes static validators', async () => {
  const response = await assertPolicy('/', revalidate);
  assert.equal(response.headers.get('ETag'), null);
  assert.equal(response.headers.get('Last-Modified'), null);
  assert.match(await response.text(), /data-github-home/);
});
