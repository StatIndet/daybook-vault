// Public GitHub data only. Secrets are read from bindings, never cached or returned.
const maxBytes = 8 * 1024 * 1024;
const apiRoot = 'https://api.github.com';

async function readBounded(response) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) throw new Error('GitHub response exceeds size limit');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(result);
}

export function safeURL(value) {
  if (!value) return '';
  try {
    const raw = String(value).trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

async function api(env, path, { html = false, body, publicOnly = false } = {}) {
  const headers = { Accept: html ? 'application/vnd.github.html+json' : 'application/vnd.github+json', 'User-Agent': 'Daybook-GitHub-Profile', 'X-GitHub-Api-Version': '2022-11-28' };
  if (env.GITHUB_TOKEN && !publicOnly) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiRoot}${path}`, { headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return { data: html ? '' : [], headers: response.headers };
  if (!response.ok) throw new Error(`GitHub ${path.split('?')[0]}: HTTP ${response.status}`);
  const content = await readBounded(response);
  return { data: html ? content : JSON.parse(content), headers: response.headers };
}

function repository(r) {
  return { name: r.name, fullName: r.full_name || r.nameWithOwner, htmlURL: safeURL(r.html_url || r.url), description: r.description || '', language: r.language || r.primaryLanguage?.name || '', languageColor: r.primaryLanguage?.color || '', stars: r.stargazers_count ?? r.stargazerCount ?? 0, forks: r.forks_count ?? r.forkCount ?? 0, archived: r.archived ?? r.isArchived ?? false, fork: r.fork ?? r.isFork ?? false, topics: r.topics || [], updatedAt: r.updated_at || r.updatedAt, homepage: safeURL(r.homepage || r.homepageUrl) };
}

// Match local builds so scheduled refreshes preserve event labels and targets.
function event(e) {
  const payload = e.payload || {};
  const repoURL = `https://github.com/${e.repo.name}`;
  let summary = e.type.replace(/Event$/, '');
  let url = repoURL;
  switch (e.type) {
    case 'PushEvent': summary = `Pushed to ${(payload.ref || '').replace(/^refs\/heads\//, '')}`; break;
    case 'WatchEvent': summary = 'Starred repository'; break;
    case 'ForkEvent': summary = 'Forked repository'; break;
    case 'IssuesEvent': summary = `${payload.action || ''} issue: ${payload.issue?.title || ''}`; url = payload.issue?.html_url || repoURL; break;
    case 'PullRequestEvent': summary = `${payload.action || ''} pull request: ${payload.pull_request?.title || ''}`; url = payload.pull_request?.html_url || repoURL; break;
    case 'ReleaseEvent': summary = `${payload.action || ''} release: ${payload.release?.name || ''}`; url = payload.release?.html_url || repoURL; break;
    case 'CreateEvent': summary = `Created ${payload.ref || ''}`; break;
  }
  return { type: e.type, repoName: e.repo.name, repoURL, url: safeURL(url), createdAt: e.created_at, summary };
}

export async function cleanReadme(html, username) {
  const allowedTags = new Set('a p h1 h2 h3 h4 h5 h6 br hr pre code blockquote ol ul li dl dt dd table thead tbody tfoot tr th td em strong del s b i u sup sub img details summary div span kbd samp mark picture'.split(' '));
  const allowedAttributes = new Set('class id title href src alt width height loading decoding open colspan rowspan align target rel'.split(' '));
  const response = new Response(html, { headers: { 'Content-Type': 'text/html' } });
  return new HTMLRewriter()
    .on('script, style, iframe, object, embed, form, input, button', { element(el) { el.remove(); } })
    .on('*', { element(el) {
      if (!allowedTags.has(el.tagName)) { el.removeAndKeepContent(); return; }
      for (const [name] of [...el.attributes]) { if (!allowedAttributes.has(name)) el.removeAttribute(name); }
      for (const name of ['href', 'src']) {
        const value = el.getAttribute(name);
        if (!value) continue;
        if (name === 'href' && value.startsWith('#')) continue;
        try {
          const base = name === 'src' ? `https://raw.githubusercontent.com/${username}/${username}/HEAD/` : `https://github.com/${username}/${username}/blob/HEAD/`;
          const url = new URL(value, value.startsWith('/') ? 'https://github.com/' : base);
          if (!['https:', 'http:', ...(name === 'href' ? ['mailto:'] : [])].includes(url.protocol) || url.username || url.password) el.removeAttribute(name);
          else el.setAttribute(name, url.href);
        } catch { el.removeAttribute(name); }
      }
      if (el.tagName === 'a') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
      if (el.tagName === 'img') { el.setAttribute('loading', 'lazy'); el.setAttribute('decoding', 'async'); }
    } }).transform(response).text();
}

export async function fetchProfile(env, previous = null) {
  const username = env.GITHUB_USERNAME;
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username || '')) throw new Error('Invalid GITHUB_USERNAME');
  const prefix = `/users/${encodeURIComponent(username)}`;
  const { data: user } = await api(env, prefix);
  if (!user.login || user.login.toLowerCase() !== username.toLowerCase()) throw new Error('GitHub profile identity mismatch');
  const profile = { ...(previous || {}), login: user.login, name: user.name || '', bio: user.bio || '', avatarURL: safeURL(user.avatar_url), htmlURL: safeURL(user.html_url), company: user.company || '', blog: safeURL(user.blog), location: user.location || '', email: user.email || '', twitterUsername: user.twitter_username || '', followers: user.followers, following: user.following, publicRepos: user.public_repos, publicGists: user.public_gists, createdAt: user.created_at, updatedAt: user.updated_at, fetchedAt: new Date().toISOString(), cached: false };
  const tasks = [
    (async () => { const { data } = await api(env, `${prefix}/social_accounts?per_page=100`); profile.socialAccounts = data.map(a => ({ provider: a.provider, url: safeURL(a.url) })).filter(a => a.url); })(),
    (async () => { const { data } = await api(env, `${prefix}/orgs?per_page=100`); profile.organizations = data.map(o => ({ login: o.login, avatarURL: safeURL(o.avatar_url), htmlURL: `https://github.com/${encodeURIComponent(o.login)}`, description: o.description || '' })); })(),
    (async () => {
      const repos = [];
      for (let page = 1; page <= 100; page++) {
        const { data } = await api(env, `${prefix}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
        repos.push(...data.filter(r => !r.private).map(repository));
        if (data.length < 100) { profile.repositories = repos; return; }
      }
      throw new Error('GitHub repository pagination limit exceeded');
    })(),
    (async () => {
      const { data } = await api(env, `${prefix}/events/public?per_page=30`);
      profile.events = data.filter(e => e.public).map(event);
    })(),
    (async () => { const { data } = await api(env, `/repos/${username}/${username}/readme`, { html: true, publicOnly: true }); profile.readmeHTML = await cleanReadme(data, username); profile.readmeURL = data ? `https://github.com/${username}/${username}#readme` : ''; })(),
    (async () => {
      const { data, headers } = await api(env, `${prefix}/starred?per_page=1`, { publicOnly: true });
      const last = (headers.get('Link') || '').split(',').find(l => /rel="last"/.test(l));
      profile.stars = last ? Number(new URL(last.match(/<([^>]+)>/)[1]).searchParams.get('page')) : data.length;
      profile.starsAvailable = true;
    })(),
  ];
  const results = await Promise.allSettled(tasks);
  for (const result of results) if (result.status === 'rejected') console.warn(JSON.stringify({ event: 'github_section_refresh_failed', message: result.reason.message }));
  if (env.GITHUB_TOKEN) {
    try {
      const { data } = await api(env, '/graphql', { body: { query: `query($login:String!){user(login:$login){pronouns status{emoji message} pinnedItems(first:6,types:[REPOSITORY]){nodes{... on Repository{name nameWithOwner url description isPrivate isArchived isFork stargazerCount forkCount homepageUrl updatedAt primaryLanguage{name color} repositoryTopics(first:20){nodes{topic{name}}}}}} contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}}}}`, variables: { login: username } } });
      if (data.errors?.length || !data.data?.user) throw new Error('GitHub GraphQL response unavailable');
      const graph = data.data.user;
      profile.pronouns = graph.pronouns || '';
      profile.status = graph.status;
      profile.pinnedRepositories = graph.pinnedItems.nodes.filter(r => r && !r.isPrivate && r.name).map(r => repository({ ...r, topics: (r.repositoryTopics?.nodes || []).map(t => t.topic.name) }));
      for (const repo of profile.repositories || []) {
        const pinned = profile.pinnedRepositories.find(p => p.fullName === repo.fullName);
        if (pinned) repo.languageColor = pinned.languageColor;
      }
      const levels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
      profile.contributions = { total: graph.contributionsCollection.contributionCalendar.totalContributions, weeks: graph.contributionsCollection.contributionCalendar.weeks.map(w => ({ days: w.contributionDays.map(d => ({ date: d.date, count: d.contributionCount, level: Math.max(0, levels.indexOf(d.contributionLevel)) })) })) };
    } catch (error) { console.warn(JSON.stringify({ event: 'github_graphql_refresh_failed', message: error.message })); }
  }
  return snapshot(profile, username);
}

// Project only the public output schema, so cache metadata and any accidental
// legacy fields cannot reach /api/github or the homepage.
function snapshot(value, username) {
  if (!value || typeof value !== 'object' || typeof value.login !== 'string' || value.login.toLowerCase() !== username?.toLowerCase() || !safeURL(value.avatarURL) || !safeURL(value.htmlURL)) return null;
  const output = {};
  for (const field of ['login', 'name', 'pronouns', 'bio', 'company', 'location', 'email', 'twitterUsername', 'createdAt', 'updatedAt', 'fetchedAt', 'readmeHTML']) output[field] = typeof value[field] === 'string' ? value[field] : '';
  for (const field of ['avatarURL', 'htmlURL', 'blog', 'readmeURL']) output[field] = safeURL(value[field]);
  const count = raw => Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
  const string = raw => typeof raw === 'string' ? raw : '';
  const list = raw => Array.isArray(raw) ? raw : [];
  const objects = raw => list(raw).filter(item => item && typeof item === 'object');
  for (const field of ['followers', 'following', 'publicRepos', 'publicGists', 'stars']) output[field] = count(value[field]);
  output.starsAvailable = value.starsAvailable === true;
  output.cached = value.cached === true;
  output.socialAccounts = objects(value.socialAccounts).map(a => ({ provider: string(a.provider), url: safeURL(a.url) })).filter(a => a.url);
  output.organizations = objects(value.organizations).map(o => ({ login: string(o.login), htmlURL: safeURL(o.htmlURL), avatarURL: safeURL(o.avatarURL), description: string(o.description) }));
  const publicRepository = r => ({ name: string(r.name), fullName: string(r.fullName), htmlURL: safeURL(r.htmlURL), description: string(r.description), language: string(r.language), languageColor: /^#[a-f\d]{6}$/i.test(r.languageColor || '') ? r.languageColor : '', stars: count(r.stars), forks: count(r.forks), archived: r.archived === true, fork: r.fork === true, topics: list(r.topics).filter(t => typeof t === 'string'), updatedAt: string(r.updatedAt), homepage: safeURL(r.homepage) });
  for (const field of ['repositories', 'pinnedRepositories']) output[field] = objects(value[field]).filter(r => !r.private && !r.isPrivate).map(publicRepository);
  output.events = objects(value.events).filter(e => e.public !== false).map(e => ({ type: string(e.type), repoName: string(e.repoName), repoURL: safeURL(e.repoURL), url: safeURL(e.url), createdAt: string(e.createdAt), summary: string(e.summary) }));
  if (value.status && typeof value.status.message === 'string') output.status = { emoji: String(value.status.emoji || ''), message: value.status.message };
  if (value.contributions && Array.isArray(value.contributions.weeks)) output.contributions = { total: count(value.contributions.total), weeks: objects(value.contributions.weeks).map(w => ({ days: objects(w.days).map(d => ({ date: string(d.date), count: count(d.count), level: Math.min(4, count(d.level)) })) })) };
  return output;
}

export async function readProfile(env, request) {
  const key = `profile:${(env.GITHUB_USERNAME || '').toLowerCase()}`;
  const results = await Promise.allSettled([
    env.GITHUB_CACHE ? env.GITHUB_CACHE.get(key, 'json') : Promise.resolve(null),
    (async () => {
      const response = await env.ASSETS.fetch(new URL('/github-profile.json', request.url));
      return response.ok ? JSON.parse(await readBounded(response)) : null;
    })(),
  ]);
  const profiles = results.map(result => result.status === 'fulfilled' ? snapshot(result.value, env.GITHUB_USERNAME) : null).filter(Boolean);
  // A deployment can contain a newer local build than the last scheduled KV
  // refresh. Always retain the newest successful upstream snapshot.
  profiles.sort((a, b) => (Date.parse(b.fetchedAt) || 0) - (Date.parse(a.fetchedAt) || 0));
  const selected = profiles[0] || null;
  if (selected) selected.readmeHTML = await cleanReadme(selected.readmeHTML, selected.login);
  return selected;
}

export async function refreshProfile(env) {
  if (!env.GITHUB_CACHE) throw new Error('GITHUB_CACHE binding is missing');
  const request = new Request('https://daybook.invalid/');
  const previous = await readProfile(env, request);
  const profile = await fetchProfile(env, previous);
  // Keep the last success indefinitely when the upstream is unavailable.
  await env.GITHUB_CACHE.put(`profile:${profile.login.toLowerCase()}`, JSON.stringify(profile));
  console.log(JSON.stringify({ event: 'github_profile_refreshed', login: profile.login, fetchedAt: profile.fetchedAt }));
}
