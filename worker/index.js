/**
 * Normalize path to be consistent with daybook's frontend logic
 */
function normalizePath(p) {
  try {
    const url = new URL(p, "http://localhost");
    let pathname = url.pathname;
    pathname = pathname.replace(/\/+/g, '/');
    if (pathname !== '/' && !pathname.endsWith('/')) {
      pathname += '/';
    }
    return pathname;
  } catch {
    let pathname = p.split('?')[0].split('#')[0];
    pathname = pathname.replace(/\/+/g, '/');
    if (!pathname.startsWith('/')) pathname = '/' + pathname;
    if (pathname !== '/' && !pathname.endsWith('/')) {
      pathname += '/';
    }
    return pathname;
  }
}

/**
 * Basic allowlist to avoid tracking irrelevant assets if requested directly
 */
function isWhitelisted(p) {
  if (p === '/') return true;
  if (p === '/notes/') return true;
  if (p === '/archive/') return true;
  if (p === '/graph/') return true;
  if (p === '/about/') return true;
  if (p.startsWith('/notes/') && p.length > '/notes/'.length) return true;
  return false;
}

/**
 * Hash visitor ID to preserve privacy
 */
async function hashVisitorId(id, salt) {
  const msgUint8 = new TextEncoder().encode(id + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/hit') {
      if (request.method !== 'POST') {
        return new Response("Method Not Allowed", { status: 405 });
      }

      try {
        const body = await request.json();
        if (!body.path || !body.visitorId) {
          return new Response("Bad Request", { status: 400 });
        }

        const normalizedPath = normalizePath(body.path);
        if (!isWhitelisted(normalizedPath)) {
          return new Response("Forbidden", { status: 403 });
        }

        const salt = env.STATS_SALT || "daybook-default-salt";
        const visitorHash = await hashVisitorId(body.visitorId, salt);

        // Prepare D1 batch
        const updatePage = env.DB.prepare(
          `INSERT INTO page_stats (path, views, updated_at) VALUES (?, 1, CURRENT_TIMESTAMP)
           ON CONFLICT(path) DO UPDATE SET views = views + 1, updated_at = CURRENT_TIMESTAMP`
        ).bind(normalizedPath);

        const updateSite = env.DB.prepare(
          `UPDATE site_stats SET value = value + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'total_views'`
        );

        const updateVisitor = env.DB.prepare(
          `INSERT INTO visitors (visitor_hash, first_seen_at, last_seen_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(visitor_hash) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`
        ).bind(visitorHash);

        await env.DB.batch([updatePage, updateSite, updateVisitor]);

        // Fetch the new stats to return
        const getPage = env.DB.prepare(`SELECT views FROM page_stats WHERE path = ?`).bind(normalizedPath);
        const getSite = env.DB.prepare(`SELECT value FROM site_stats WHERE key = 'total_views'`);
        const getVisitors = env.DB.prepare(`SELECT count(*) as count FROM visitors`);

        const results = await env.DB.batch([getPage, getSite, getVisitors]);
        const pageViews = results[0].results?.[0]?.views || 1;
        const totalViews = results[1].results?.[0]?.value || 1;
        const visitors = results[2].results?.[0]?.count || 1;

        return new Response(JSON.stringify({
          path: normalizedPath,
          pageViews,
          totalViews,
          visitors
        }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          }
        });

      } catch (err) {
        console.error("hit api error", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    if (url.pathname === '/api/stats') {
      if (request.method !== 'GET') {
        return new Response("Method Not Allowed", { status: 405 });
      }
      
      const rawPath = url.searchParams.get("path");
      if (!rawPath) {
        return new Response("Bad Request", { status: 400 });
      }

      const normalizedPath = normalizePath(rawPath);
      if (!isWhitelisted(normalizedPath)) {
        return new Response("Forbidden", { status: 403 });
      }

      try {
        const getPage = env.DB.prepare(`SELECT views FROM page_stats WHERE path = ?`).bind(normalizedPath);
        const getSite = env.DB.prepare(`SELECT value FROM site_stats WHERE key = 'total_views'`);
        const getVisitors = env.DB.prepare(`SELECT count(*) as count FROM visitors`);

        const results = await env.DB.batch([getPage, getSite, getVisitors]);
        const pageViews = results[0].results?.[0]?.views || 0;
        const totalViews = results[1].results?.[0]?.value || 0;
        const visitors = results[2].results?.[0]?.count || 0;

        return new Response(JSON.stringify({
          path: normalizedPath,
          pageViews,
          totalViews,
          visitors
        }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60"
          }
        });
      } catch (err) {
        console.error("stats api error", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};
