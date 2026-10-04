const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function identityCookie(request, name) {
  const value = (request.headers.get('Cookie') || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return value && uuid.test(value) ? value : null;
}

export function setIdentityCookie(headers, name, token) {
  headers.append('Set-Cookie', `${name}=${token || ''}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${token ? 31536000 : 0}`);
}

export async function readBody(request) {
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

export async function handlePrivacy(request, env, hashVisitorToken) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', Vary: 'Cookie' });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'Forbidden' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Expected JSON' }, 415);
  let body;
  try { body = await readBody(request); } catch { return json({ error: 'Invalid body' }, 400); }
  if (typeof body?.analytics !== 'boolean') return json({ error: 'Expected analytics boolean' }, 400);

  // This endpoint alone creates the analytics Cookie. Delayed hit responses
  // can never recreate it after a withdrawal.
  if (body.analytics) {
    if (!identityCookie(request, 'daybook_analytics')) setIdentityCookie(headers, 'daybook_analytics', crypto.randomUUID());
  } else {
    setIdentityCookie(headers, 'daybook_analytics', null);
  }

  const legacy = identityCookie(request, 'daybook_visitor');
  if (legacy) {
    // Preserve existing likes before retiring the old multipurpose identity.
    // Do not give a functional identity to readers who have never liked a post.
    if (!identityCookie(request, 'daybook_engagement')) {
      try {
        const hash = await hashVisitorToken(legacy, env.STATS_SALT || 'daybook-default-salt');
        const liked = await env.DB.prepare('SELECT 1 AS liked FROM likes WHERE visitor_hash = ? LIMIT 1').bind(hash).first();
        if (liked) setIdentityCookie(headers, 'daybook_engagement', legacy);
      } catch {
        // Keep legacy likes recoverable, but still clear analytics on withdrawal.
        return json({ error: 'Legacy likes unavailable' }, 503);
      }
    }
    setIdentityCookie(headers, 'daybook_visitor', null);
  }
  return json({ version: 1, analytics: body.analytics });
}
