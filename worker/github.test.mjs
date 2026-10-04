import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { after, test } from 'node:test';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Exercise the real Workers HTMLRewriter rather than replacing it with a mock.
const harness = `
import { readProfile, fetchProfile, refreshProfile, cleanReadme } from './github-sync.js';
import { rewriteHome } from './github-home.js';
import worker from './index.js';
export default { async fetch(request, env, ctx) {
  const input = await request.json();
  const originalFetch = globalThis.fetch;
  let writes = [];
  const mockEnv = {
    GITHUB_USERNAME: 'example', GITHUB_TOKEN: input.token,
    GITHUB_CACHE: input.noKV ? undefined : { async get() { if(input.kvFailure) throw new Error('KV unavailable'); return input.cached || null; }, async put(key,value) { writes.push({key,value:JSON.parse(value)}); } },
    ASSETS: { async fetch(assetRequest) {
      const url = new URL(typeof assetRequest === 'string' ? assetRequest : assetRequest.url || assetRequest);
      if(url.pathname === '/github-profile.json') return input.assetFailure ? new Response('missing',{status:404}) : Response.json(input.built || null);
      if(assetRequest.headers?.has('If-None-Match')) return new Response(null,{status:304});
      return new Response(input.html, {headers:{'Content-Type':'text/html','ETag':'static-only','Last-Modified':'Mon, 01 Jan 2024 00:00:00 GMT'}});
    } }
  };
  globalThis.fetch = async(url, init) => {
    if(!String(url).startsWith('https://api.github.com')) throw new Error('Unexpected upstream');
    const path = new URL(url).pathname;
    const publicOnly = path === '/repos/example/example/readme' || path === '/users/example/starred';
    if(publicOnly && init.headers.Authorization) throw new Error('Privileged token sent to public-only endpoint');
    if(input.token && !publicOnly && init.headers.Authorization !== 'Bearer '+input.token) throw new Error('Missing server token');
    const fixture = input.responses?.[path];
    if(!fixture) return new Response('unavailable',{status:503});
    return new Response(typeof fixture.body === 'string' ? fixture.body : JSON.stringify(fixture.body), {status:fixture.status || 200,headers:fixture.headers});
  };
  try {
    if(input.action === 'read') return Response.json(await readProfile(mockEnv, new Request('https://example.com/')));
    if(input.action === 'fetch') return Response.json(await fetchProfile(mockEnv, input.cached));
    if(input.action === 'refresh') { await refreshProfile(mockEnv); return Response.json(writes); }
    if(input.action === 'readme') return new Response(await cleanReadme(input.html,'example'));
    if(input.action === 'rewrite') return rewriteHome(new Response(input.html,{headers:{'Content-Type':'text/html','ETag':'old','Last-Modified':'old'}}),input.built,new Request(input.url || 'https://example.com/'));
    if(input.action === 'worker') return worker.fetch(new Request(input.url || 'https://example.com/',{headers:{'If-None-Match':'static-only'}}), mockEnv, ctx);
    return new Response('Bad action',{status:400});
  } catch(error) { return Response.json({error:error.message,writes},{status:500}); }
  finally { globalThis.fetch = originalFetch; }
} };
`;
const root = fileURLToPath(new URL('.', import.meta.url));
const modules = [{ type: 'ESModule', path: root + 'test-harness.js', contents: harness }];
for (const file of ['index.js', 'github-sync.js', 'github-home.js', 'likes.js', 'privacy.js']) modules.push({ type: 'ESModule', path: root + file, contents: await readFile(root + file, 'utf8') });
// The bundled workerd supports this date; the production config can stay newer.
const options = { modules, compatibilityDate: '2026-08-27', cf: false, logRequests: false };
const runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
after(() => runtime.dispose());
const call = input => runtime.dispatchFetch('http://localhost/test', { method: 'POST', body: JSON.stringify(input) });
const profile = (bio = 'Current bio', fetchedAt = '2026-09-30T12:00:00Z') => ({ login: 'example', name: 'Public Name', bio, htmlURL: 'https://github.com/example', avatarURL: 'https://avatars.githubusercontent.com/u/1', fetchedAt, createdAt: '2020-01-02T00:00:00Z', readmeHTML: '<p>README</p>', readmeURL: 'https://github.com/example/example#readme', repositories: [], pinnedRepositories: [], socialAccounts: [], organizations: [], events: [] });
const sourceHTML = '<html><head><title>Old title</title><meta name="description" content="Old bio"><meta property="og:description" content="Old bio"><meta name="twitter:description" content="Old bio"><meta property="og:title" content="Old title"><meta name="twitter:title" content="Old title"><meta property="og:image" content="old.jpg"><meta name="twitter:image" content="old.jpg"><script type="application/ld+json">{}</script></head><body><img class="side-avatar" src="old.jpg"><section data-github-home>Old home</section></body></html>';

test('KV outage and malformed cache fall back to a static snapshot, with no visitor GitHub requests', async () => {
  let response = await call({ action: 'read', kvFailure: true, built: profile() });
  assert.equal((await response.json()).bio, 'Current bio');
  response = await call({ action: 'read', cached: { login: 'wrong-user' }, built: profile() });
  assert.equal((await response.json()).login, 'example');
  response = await call({ action: 'read', noKV: true, assetFailure: true });
  assert.equal(await response.json(), null);
});

test('a fresh deployment wins over old KV, and the latest cron snapshot wins over a build', async () => {
  let response = await call({ action: 'read', cached: profile('Old KV', '2026-09-28T00:00:00Z'), built: profile('New build') });
  assert.equal((await response.json()).bio, 'New build');
  response = await call({ action: 'read', cached: { ...profile('New cron', '2026-10-01T00:00:00Z'), token: 'must-not-escape' }, built: profile() });
  const data = await response.json();
  assert.equal(data.bio, 'New cron');
  assert.equal(data.token, undefined);
});

test('README sanitization removes active HTML and resolves repository images', async () => {
  const response = await call({ action: 'readme', html: '<p>Hello</p><script>alert(1)</script><meta http-equiv="refresh" content="0;url=bad"><img src="images/test.png" srcset="javascript:bad 2x" onerror="bad()"><a href="docs/guide.md">Docs</a><a href="javascript:bad()">Unsafe</a>' });
  const html = await response.text();
  assert.match(html, /https:\/\/raw.githubusercontent.com\/example\/example\/HEAD\/images\/test.png/);
  assert.match(html, /https:\/\/github.com\/example\/example\/blob\/HEAD\/docs\/guide.md/);
  assert.doesNotMatch(html, /script|http-equiv|srcset|onerror|javascript:/);
});

test('empty Bio clears SEO descriptions and updates the public identity and avatars', async () => {
  const response = await call({ action: 'rewrite', built: profile(''), html: sourceHTML });
  const html = await response.text();
  assert.doesNotMatch(html, /Old bio|Old home|Old title|old.jpg/);
  assert.match(html, /<title>Public Name \(example\)<\/title>/);
  assert.match(html, /name="description" content=""/);
  assert.match(html, /s=520/);
  assert.equal(response.headers.get('ETag'), null);
  assert.equal(response.headers.get('Last-Modified'), null);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
});

test('homepage conditional requests do not use a static-only 304 validator', async () => {
  const response = await call({ action: 'worker', built: profile('Updated on cron'), html: sourceHTML });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Updated on cron/);
});

test('cron upstream failure preserves KV instead of caching an error', async () => {
  const response = await call({ action: 'refresh', cached: profile(), built: profile(), responses: { '/users/example': { status: 403, body: {} } } });
  assert.equal(response.status, 500);
  assert.deepEqual((await response.json()).writes, []);
});

test('optional failures retain previous sections and private repositories are filtered', async () => {
  const previous = { ...profile('Old'), repositories: [{ name: 'old-project' }], readmeHTML: '<p>Old README</p>' };
  const response = await call({ action: 'fetch', cached: previous, responses: {
    '/users/example': { body: { login: 'example', name: 'New', bio: 'Fresh', avatar_url: profile().avatarURL, html_url: profile().htmlURL } },
    '/users/example/repos': { body: [{ name: 'public', full_name: 'example/public', html_url: 'https://github.com/example/public', private: false }, { name: 'private', private: true }] },
    '/repos/example/example/readme': { status: 404, body: '' },
  } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.bio, 'Fresh');
  assert.deepEqual(data.repositories.map(r => r.name), ['public']);
  assert.equal(data.readmeHTML, '');
  assert.equal(data.readmeURL, '');
});

test('GraphQL public pins and calendar survive without emitting credentials or private repos', async () => {
  const response = await call({ action: 'fetch', token: 'server-only-secret', responses: {
    '/users/example': { body: { login: 'example', email: 'public@example.com', avatar_url: profile().avatarURL, html_url: profile().htmlURL } },
    '/users/example/social_accounts': { body: [] }, '/users/example/orgs': { body: [] }, '/users/example/repos': { body: [{ name: 'public', full_name: 'example/public', html_url: 'https://github.com/example/public', language: 'Go' }] }, '/users/example/events/public': { body: [] }, '/users/example/starred': { body: [] }, '/repos/example/example/readme': { status: 404, body: '' },
    '/graphql': { body: { data: { user: {
      pronouns: 'he/him', status: { emoji: '🌱', message: 'Growing' },
      pinnedItems: { nodes: [{ name: 'public', nameWithOwner: 'example/public', url: 'https://github.com/example/public', isPrivate: false, primaryLanguage: { name: 'Go', color: '#00ADD8' }, repositoryTopics: { nodes: [{ topic: { name: 'blog' } }] } }, { name: 'private', isPrivate: true }] },
      contributionsCollection: { contributionCalendar: { totalContributions: 3, weeks: [{ contributionDays: [{ date: '2026-09-30', contributionCount: 3, contributionLevel: 'THIRD_QUARTILE' }] }] } },
    } } } },
  } });
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /server-only-secret|"name":"private"/);
  const data = JSON.parse(text);
  assert.deepEqual(data.pinnedRepositories[0].topics, ['blog']);
  assert.equal(data.pinnedRepositories[0].languageColor, '#00ADD8');
  assert.equal(data.repositories[0].languageColor, '#00ADD8');
  assert.equal(data.contributions.weeks[0].days[0].level, 3);
  assert.equal(data.status.message, 'Growing');
  assert.equal(data.pronouns, 'he/him');
  assert.equal(data.email, 'public@example.com');
});

test('scheduled public activity keeps local build labels and destination links', async () => {
  const response = await call({ action: 'fetch', responses: {
    '/users/example': { body: { login: 'example', avatar_url: profile().avatarURL, html_url: profile().htmlURL } },
    '/users/example/events/public': { body: [
      { type: 'PushEvent', public: true, repo: { name: 'example/public' }, created_at: '2026-10-01T00:00:00Z', payload: { ref: 'refs/heads/main' } },
      { type: 'IssuesEvent', public: true, repo: { name: 'example/public' }, created_at: '2026-10-01T00:00:00Z', payload: { action: 'opened', issue: { title: 'Visible issue', html_url: 'https://github.com/example/public/issues/7' } } },
      { type: 'PushEvent', public: false, repo: { name: 'example/private' }, payload: { ref: 'secret-branch' } },
    ] },
  } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.events.map(e => e.summary), ['Pushed to main', 'opened issue: Visible issue']);
  assert.equal(data.events[1].url, 'https://github.com/example/public/issues/7');
});

test('refreshed homepage keeps README and pins while removing extra sections', async () => {
  const built = { ...profile(),
    pinnedRepositories: [{ name: 'pinned-project', htmlURL: 'https://github.com/example/pinned-project' }],
    repositories: [{ name: 'unlisted-project', htmlURL: 'https://github.com/example/unlisted-project' }],
    events: [{ summary: 'Unlisted activity', url: 'https://github.com/example/unlisted-project' }],
  };
  for (const url of ['https://example.com/', 'https://example.com/en_US/']) {
    const response = await call({ action: 'rewrite', html: sourceHTML, built, url });
    const html = await response.text();
    assert.match(html, /<p>README<\/p>/);
    assert.match(html, /pinned-project/);
    assert.doesNotMatch(html, /github-profile-link|github-gists|github-tabs|github-readme-heading|github-activity|unlisted-project|Unlisted activity|>Public<|<h2>(?:置顶仓库|Pinned)<\/h2>/);
    assert.match(html, /data-tooltip="Stars"/);
  }
});

test('refreshed contacts use local brand icons, the built favicon and a Material fallback', async () => {
  const built = { ...profile(), blog: 'https://daybook.page', socialAccounts: [
    { provider: 'generic', url: 'https://space.bilibili.com/123' },
    { provider: 'generic', url: 'https://ko-fi.com/example' },
    { provider: 'generic', url: 'https://ifdian.net/a/example' },
    { provider: 'generic', url: 'https://buymeacoffee.com/example' },
    { provider: 'generic', url: 'https://unknown.example/profile' },
    { provider: 'generic', url: 'https://ko-fi.com.evil.example/profile' },
  ] };
  const html = sourceHTML.replace('</head>', '<link rel="icon" href="/custom-favicon.svg"></head>').replace('data-github-home>', 'data-github-home data-site-url="https://daybook.page">');
  for (const url of ['https://example.com/', 'https://example.com/en_US/']) {
    const response = await call({ action: 'rewrite', html, built, url });
    assert.equal(response.status, 200);
    const output = await response.text();
    const contacts = output.match(/<ul class="github-profile-details">([\s\S]*?)<\/ul>/)[1];
    for (const icon of ['custom-favicon', 'icons/social/bilibili', 'icons/social/kofi', 'icons/social/afdian', 'icons/social/buymeacoffee']) assert.ok(contacts.includes('/' + icon + '.svg'), icon);
    for (const unknown of ['unknown.example/profile', 'ko-fi.com.evil.example/profile']) assert.ok(contacts.includes('class="material-symbol" aria-hidden="true">link</span><span>https://' + unknown));
  }
});

test('profile pronouns and public email render safely in both locales', async () => {
  for (const url of ['https://example.com/', 'https://example.com/en_US/']) {
    const response = await call({ action: 'rewrite', built: { ...profile(), pronouns: 'he/him <test>', email: 'public@example.com' }, html: sourceHTML, url });
    const html = await response.text();
    assert.match(html, /class="github-profile-pronouns">he\/him &lt;test&gt;<\/small>/);
    assert.match(html, /href="mailto:public@example.com"><span class="material-symbol" aria-hidden="true">mail<\/span>/);
  }
});
