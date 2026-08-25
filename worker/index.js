/**
 * Normalize path and decode URI for consistent matching (especially for CJK)
 */
function normalizePath(p) {
  try {
    const url = new URL(p, "http://localhost");
    let pathname = decodeURI(url.pathname);
    pathname = pathname.replace(/\/+/g, '/');
    if (pathname !== '/' && !pathname.endsWith('/')) {
      pathname += '/';
    }
    return pathname;
  } catch {
    let pathname = decodeURI(p.split('?')[0].split('#')[0]);
    pathname = pathname.replace(/\/+/g, '/');
    if (!pathname.startsWith('/')) pathname = '/' + pathname;
    if (pathname !== '/' && !pathname.endsWith('/')) {
      pathname += '/';
    }
    return pathname;
  }
}

let cachedRoutes = null;
let routesCacheTime = 0;

/**
 * Dynamic whitelist using routes.json from ASSETS binding
 */
async function isWhitelisted(env, request, p) {
  if (p === '/') return true;
  if (p === '/notes/') return true;
  if (p === '/archive/') return true;
  if (p === '/graph/') return true;
  if (p === '/about/') return true;
  if (p === '/en/') return true;
  if (p === '/en/notes/') return true;
  if (p === '/en/archive/') return true;
  if (p === '/en/graph/') return true;
  if (p === '/en/about/') return true;

  if (Date.now() - routesCacheTime > 60000 || !cachedRoutes) {
    try {
      const url = new URL(request.url);
      const res = await env.ASSETS.fetch(new URL('/routes.json', url.origin));
      if (res.ok) {
        cachedRoutes = await res.json();
        routesCacheTime = Date.now();
      }
    } catch {
      // fallback
    }
  }

  if (cachedRoutes && cachedRoutes.length > 0) {
    if (cachedRoutes.includes(p)) return true;
    
    // tags fallback
    if (p.startsWith('/tags/') || p.startsWith('/en/tags/')) return true;
    
    return false;
  }

  // Fallback if routes.json fails
  if (p.startsWith('/notes/') && p.length > '/notes/'.length) return true;
  if (p.startsWith('/en/notes/') && p.length > '/en/notes/'.length) return true;
  if (p.startsWith('/tags/') && p.length > '/tags/'.length) return true;
  if (p.startsWith('/en/tags/') && p.length > '/en/tags/'.length) return true;
  if (p.startsWith('/en/') && p.length > '/en/'.length) return true;
  
  return false;
}

/**
 * Hash visitor token using HMAC-SHA256
 */
async function hashVisitorToken(token, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // GET /api/stats
    if (url.pathname === '/api/stats') {
      if (request.method !== 'GET') {
        return new Response("Method Not Allowed", { status: 405 });
      }
      
      const rawPath = url.searchParams.get("path");
      if (!rawPath) {
        return new Response("Bad Request", { status: 400 });
      }

      const normalizedPath = normalizePath(rawPath);
      if (!await isWhitelisted(env, request, normalizedPath)) {
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

    // POST /api/hit
    if (url.pathname === '/api/hit') {
      if (request.method !== 'POST') {
        return new Response("Method Not Allowed", { status: 405 });
      }

      try {
        const body = await request.json();
        if (!body.path) {
          return new Response("Bad Request", { status: 400 });
        }

        const normalizedPath = normalizePath(body.path);
        if (!await isWhitelisted(env, request, normalizedPath)) {
          return new Response("Forbidden", { status: 403 });
        }

        // We use a fallback salt instead of requiring the user to add a secret during one-click deployment.
        const salt = env.STATS_SALT || "daybook-default-salt";

        // Basic origin check
        const origin = request.headers.get("origin");
        if (origin) {
          const u = new URL(request.url);
          if (origin !== u.origin) {
            return new Response("Forbidden Origin", { status: 403 });
          }
        }

        // Bot check
        const ua = (request.headers.get("user-agent") || "").toLowerCase();
        if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider") || ua.includes("headless")) {
          return new Response("OK", { status: 200 }); // fake success for bots
        }

        // Visitor cookie logic
        let visitorToken = "";
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookies = cookieHeader.split(";").map(c => c.trim());
        for (const c of cookies) {
          if (c.startsWith("daybook_visitor=")) {
            visitorToken = c.substring("daybook_visitor=".length);
            break;
          }
        }

        let isNewVisitor = false;
        if (!visitorToken) {
          visitorToken = crypto.randomUUID();
          isNewVisitor = true;
        }

        const visitorHash = await hashVisitorToken(visitorToken, salt);

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

        const res = new Response(JSON.stringify({
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

        if (isNewVisitor) {
          // Set-Cookie
          res.headers.set("Set-Cookie", `daybook_visitor=${visitorToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${365 * 24 * 60 * 60}`);
        }

        return res;

      } catch (err) {
        if (err instanceof SyntaxError) {
          return new Response("Bad Request", { status: 400 });
        }
        console.error("hit api error", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }
    
    // GET /api/presence
    if (url.pathname === '/api/presence') {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }
      
      const rawPath = url.searchParams.get("path") || "/";
      const normalizedPath = normalizePath(rawPath);

      // Bot check
      const ua = (request.headers.get("user-agent") || "").toLowerCase();
      if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider") || ua.includes("headless")) {
        return new Response("OK", { status: 200 }); 
      }

      // Basic origin check
      const origin = request.headers.get("origin");
      if (origin) {
        if (origin !== url.origin) {
          return new Response("Forbidden Origin", { status: 403 });
        }
      }
      
      // Visitor cookie logic
      let visitorToken = "";
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookies = cookieHeader.split(";").map(c => c.trim());
      for (const c of cookies) {
        if (c.startsWith("daybook_visitor=")) {
          visitorToken = c.substring("daybook_visitor=".length);
          break;
        }
      }
      
      if (!visitorToken) {
        // Fallback for presence if cookie isn't set yet (or user blocked it)
        // We'll generate a random UUID just for this session so presence works minimally
        visitorToken = crypto.randomUUID();
      }

      const salt = env.STATS_SALT || "daybook-default-salt";
      const visitorHash = await hashVisitorToken(visitorToken, salt);

      const id = env.SITE_PRESENCE.idFromName("global");
      const obj = env.SITE_PRESENCE.get(id);

      // Create a new request to pass headers to the DO
      const doRequest = new Request(request.url, request);
      doRequest.headers.set("X-Visitor-Hash", visitorHash);
      doRequest.headers.set("X-Initial-Path", normalizedPath);

      return obj.fetch(doRequest);
    }

    return new Response("Not Found", { status: 404 });
  }
};

export class SitePresence {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const visitorHash = request.headers.get("X-Visitor-Hash");
    let currentPath = request.headers.get("X-Initial-Path") || "/";
    currentPath = normalizePath(currentPath);

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ visitorHash, currentPath });

    this.scheduleBroadcast();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  getPresenceStats() {
    const siteVisitors = new Set();
    const pageVisitors = new Map();

    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment) continue;
      const { visitorHash, currentPath } = attachment;

      siteVisitors.add(visitorHash);

      if (!pageVisitors.has(currentPath)) {
        pageVisitors.set(currentPath, new Set());
      }
      pageVisitors.get(currentPath).add(visitorHash);
    }

    const pageViewers = {};
    for (const [path, set] of pageVisitors.entries()) {
      pageViewers[path] = set.size;
    }

    return {
      siteViewers: siteVisitors.size,
      pageViewers
    };
  }

  broadcastUpdate() {
    const stats = this.getPresenceStats();
    const siteViewers = stats.siteViewers;
    const messageCache = new Map();

    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment) continue;
      
      const currentPath = attachment.currentPath;
      let msg = messageCache.get(currentPath);
      
      if (!msg) {
        msg = JSON.stringify({
          type: "presence",
          path: currentPath,
          pageViewers: stats.pageViewers[currentPath] || 0,
          siteViewers: siteViewers
        });
        messageCache.set(currentPath, msg);
      }
      
      try {
        ws.send(msg);
      } catch (e) {
        // ignore send error
      }
    }
  }

  scheduleBroadcast() {
    if (!this.broadcastPending) {
      this.broadcastPending = true;
      // Use setTimeout for debouncing slightly
      setTimeout(() => {
        this.broadcastPending = false;
        this.broadcastUpdate();
      }, 50);
    }
  }

  webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      if (data.type === "navigate" && data.path) {
        let newPath = normalizePath(data.path);
        const attachment = ws.deserializeAttachment();
        if (attachment) {
          attachment.currentPath = newPath;
          ws.serializeAttachment(attachment);
          this.scheduleBroadcast();
        }
      }
    } catch (e) {
      // ignore parsing errors
    }
  }

  webSocketClose(ws, code, reason, wasClean) {
    this.scheduleBroadcast();
  }

  webSocketError(ws, error) {
    this.scheduleBroadcast();
  }
}
