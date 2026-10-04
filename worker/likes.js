// Likes are browser-scoped records, independent of page views and giscus.
const cookieName = 'daybook_visitor';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(value, status = 200, cookie) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
  if (cookie) headers['Set-Cookie'] = `${cookieName}=${cookie}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`;
  return new Response(JSON.stringify(value), { status, headers });
}

function articlePath(raw) {
  if (typeof raw !== 'string' || raw.length > 1024 || !raw.startsWith('/') || raw.startsWith('//')) return null;
  try {
    const path = decodeURI(new URL(raw, 'https://daybook.invalid').pathname).replace(/\/+$/, '') + '/';
    return /^\/(?:en_US\/)?(?:notes|memos)\/.+\/$/.test(path) ? path : null;
  } catch { return null; }
}

async function readBody(request) {
  if (!request.body) throw new Error('Missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) { await reader.cancel(); throw new Error('Body too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function handleLikes(request, env, hashVisitorToken) {
  const url = new URL(request.url);
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'Forbidden' }, 403);
  let paths;
  let desired;
  if (request.method === 'PUT') {
    if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden' }, 403);
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Expected JSON' }, 415);
    let body;
    try { body = await readBody(request); } catch { return json({ error: 'Invalid body' }, 400); }
    if (!body || typeof body.liked !== 'boolean') return json({ error: 'Expected liked boolean' }, 400);
    paths = [articlePath(body.path)];
    desired = body.liked;
  } else {
    paths = [...new Set(url.searchParams.getAll('path').map(articlePath))];
  }
  if (!paths.length || paths.length > 50 || paths.includes(null)) return json({ error: 'Invalid article paths' }, 400);

  try {
    // Fail closed: only currently published articles may receive likes.
    const response = await env.ASSETS.fetch(new URL('/routes.json', url.origin));
    if (!response.ok) return json({ error: 'Routes unavailable' }, 503);
    const routes = await response.json();
    if (!Array.isArray(routes)) return json({ error: 'Routes unavailable' }, 503);
    const published = new Set(routes.map(articlePath).filter(Boolean));
    if (paths.some(path => !published.has(path))) return json({ error: 'Unknown article' }, 404);

    const saved = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const token = saved && uuid.test(saved) ? saved : crypto.randomUUID();
    const visitor = await hashVisitorToken(token, env.STATS_SALT || 'daybook-default-salt');
    const statements = [];
    if (desired !== undefined) {
      statements.push(desired
        ? env.DB.prepare('INSERT INTO likes (path, visitor_hash) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(paths[0], visitor)
        : env.DB.prepare('DELETE FROM likes WHERE path = ? AND visitor_hash = ?').bind(paths[0], visitor));
    }
    for (const path of paths) {
      statements.push(env.DB.prepare(`SELECT ? AS path,
        COALESCE((SELECT count FROM like_counts WHERE path = ?), 0) AS count,
        EXISTS(SELECT 1 FROM likes WHERE path = ? AND visitor_hash = ?) AS liked`).bind(path, path, path, visitor));
    }
    // D1 batch commits the mutation and its count triggers atomically.
    const results = await env.DB.batch(statements);
    const items = results.slice(desired === undefined ? 0 : 1).map(result => {
      const row = result.results[0];
      return { path: row.path, count: row.count, liked: Boolean(row.liked) };
    });
    return json({ items }, 200, token !== saved ? token : undefined);
  } catch (error) {
    console.error('[Likes] Request failed', error);
    return json({ error: 'Likes unavailable' }, 503);
  }
}
