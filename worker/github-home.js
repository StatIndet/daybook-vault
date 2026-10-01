// Keep these classes aligned with Daybook's embedded GitHub homepage template.
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => new Intl.NumberFormat('en-US').format(value || 0);
const icon = name => `<span class="material-symbol" aria-hidden="true">${name}</span>`;
const link = (url, content, attributes = '') => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" ${attributes}>${content}</a>`;
const date = value => escape((value || '').slice(0, 10));
const avatar = (url, size) => { const parsed = new URL(url); parsed.searchParams.set('s', size); return escape(parsed.href); };

function repo(r) {
  return `<article class="github-repository"><div class="github-repository-heading">${link(r.htmlURL, icon('book') + `<span>${escape(r.name)}</span>`)}${r.archived ? '<span class="github-badge">Archived</span>' : ''}</div>${r.fork ? '<p class="github-fork">Fork</p>' : ''}${r.description ? `<p class="github-repository-description">${escape(r.description)}</p>` : ''}${r.topics?.length ? `<div class="github-topics">${r.topics.map(t => `<span>${escape(t)}</span>`).join('')}</div>` : ''}<div class="github-repository-meta">${r.language ? `<span><i class="github-language-dot" ${/^#[a-f\d]{6}$/i.test(r.languageColor || '') ? `style="background-color:${r.languageColor}"` : ''}></i>${escape(r.language)}</span>` : ''}${link(`${r.htmlURL}/stargazers`, icon('star') + number(r.stars), 'aria-label="Stars" data-tooltip="Stars"')}${link(`${r.htmlURL}/forks`, icon('fork_right') + number(r.forks), 'aria-label="Forks" data-tooltip="Forks"')}${r.homepage ? link(r.homepage, icon('open_in_new'), 'aria-label="Website" data-tooltip="Website"') : ''}</div></article>`;
}

export function renderHome(p, english = false) {
  const t = (zh, en) => english ? en : zh;
  const detail = (symbol, content) => `<li>${icon(symbol)}${content}</li>`;
  const contact = (symbol, url, label) => `<li>${link(url, icon(symbol) + `<span>${escape(label)}</span>`)}</li>`;
  const repositories = values => values?.length ? `<div class="github-repositories"><div class="github-repository-grid">${values.map(repo).join('')}</div></div>` : '';
  const contributions = p.contributions ? `<section class="github-contributions"><h2>${number(p.contributions.total)} ${t('次贡献 · 过去一年', 'contributions in the last year')}</h2><div class="github-calendar-scroll"><div class="github-calendar" role="img" aria-label="${t('GitHub 贡献日历', 'GitHub contribution calendar')}">${p.contributions.weeks.map(w => `<div class="github-calendar-week">${w.days.map(d => `<span class="github-calendar-day" data-level="${Number(d.level)}" data-tooltip="${escape(d.date)}: ${Number(d.count)}" aria-label="${escape(d.date)}: ${Number(d.count)}"></span>`).join('')}</div>`).join('')}</div></div><div class="github-calendar-key"><span>${t('少', 'Less')}</span>${[0, 1, 2, 3, 4].map(level => `<i data-level="${level}"></i>`).join('')}<span>${t('多', 'More')}</span></div></section>` : '';
  return `<section class="github-home" data-github-home data-github-login="${escape(p.login)}" aria-label="GitHub">
<aside class="github-profile"><div class="github-profile-identity">${link(p.htmlURL, `<img class="hero-avatar" src="${avatar(p.avatarURL, 260)}" srcset="${avatar(p.avatarURL, 96)} 96w, ${avatar(p.avatarURL, 260)} 260w, ${avatar(p.avatarURL, 520)} 520w" sizes="(max-width:640px) 88px, (max-width:960px) 160px, 260px" width="260" height="260" fetchpriority="high" alt="${escape(p.name)}">`, 'class="hero-avatar-wrap" data-site-avatar')}<h1 class="github-profile-name">${escape(p.name || p.login)}<span>${escape(p.login)}</span></h1></div>
${p.status ? `<p class="github-profile-status">${escape(p.status.emoji)} ${escape(p.status.message)}</p>` : ''}${p.bio ? `<p class="github-profile-bio">${escape(p.bio)}</p>` : ''}<p class="github-followers">${link(`${p.htmlURL}?tab=followers`, icon('group') + `<span><strong>${number(p.followers)}</strong> ${t('关注者', 'followers')}</span>`)}<span>·</span>${link(`${p.htmlURL}?tab=following`, `<strong>${number(p.following)}</strong> ${t('关注', 'following')}`)}</p>
<ul class="github-profile-details">${p.company ? detail('domain', `<span>${escape(p.company)}</span>`) : ''}${p.location ? detail('location_on', `<span>${escape(p.location)}</span>`) : ''}${p.email ? `<li><a href="mailto:${escape(p.email)}">${icon('mail')}<span>${escape(p.email)}</span></a></li>` : ''}${p.blog ? contact('link', p.blog, p.blog) : ''}${p.twitterUsername ? contact('alternate_email', `https://x.com/${encodeURIComponent(p.twitterUsername)}`, p.twitterUsername) : ''}${(p.socialAccounts || []).map(a => contact('link', a.url, a.url)).join('')}${p.createdAt ? detail('calendar_month', `<span>${t('加入于', 'Joined')} <time datetime="${escape(p.createdAt)}">${date(p.createdAt)}</time></span>`) : ''}</ul>
${p.organizations?.length ? `<section class="github-organizations"><h2>${t('组织', 'Organizations')}</h2><div>${p.organizations.map(o => link(o.htmlURL, `<img src="${escape(o.avatarURL)}" alt="${escape(o.login)}" width="36" height="36" loading="lazy">`, `data-tooltip="${escape(o.login)} · ${escape(o.description)}"`)).join('')}</div></section>` : ''}</aside>
<div class="github-overview">${p.readmeHTML ? `<section class="github-readme" id="github-readme"><div class="github-readme-content markdown">${p.readmeHTML}</div></section>` : ''}${repositories(p.pinnedRepositories)}${contributions}
</div></section>`;
}

export function rewriteHome(response, profile, request) {
  const url = new URL(request.url);
  const english = url.pathname.startsWith('/en_US');
  const title = profile.name && profile.name !== profile.login ? `${profile.name} (${profile.login})` : profile.login;
  const bio = [...(profile.bio || '').replace(/\s+/g, ' ').trim()];
  const description = bio.length > 160 ? bio.slice(0, 157).join('') + '...' : bio.join('');
  const image = new URL(profile.avatarURL);
  image.searchParams.set('s', '520');
  const jsonld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'Person', '@id': `${url.origin}/#person`, name: profile.name || profile.login, alternateName: profile.login, description, image: image.href, url: profile.htmlURL, sameAs: [profile.htmlURL, ...(profile.socialAccounts || []).map(a => a.url)].filter(Boolean) }, { '@type': 'WebSite', '@id': `${url.origin}${english ? '/en_US/' : '/'}#website`, url: `${url.origin}${english ? '/en_US/' : '/'}`, name: title, description, author: { '@id': `${url.origin}/#person` } }] };
  const setMeta = value => ({ element(el) { el.setAttribute('content', value); } });
  const rewrite = new HTMLRewriter()
    .on('[data-github-home]', { element(el) { el.replace(renderHome(profile, english), { html: true }); } })
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[name="description"],meta[property="og:description"],meta[name="twitter:description"]', setMeta(description))
    .on('meta[property="og:title"],meta[name="twitter:title"]', setMeta(title))
    .on('meta[property="og:image"],meta[name="twitter:image"]', setMeta(image.href))
    .on('.side-avatar', { element(el) {
      const src = new URL(profile.avatarURL);
      src.searchParams.set('s', '260');
      el.setAttribute('src', src.href);
    } })
    .on('script[type="application/ld+json"]', { element(el) { el.setInnerContent(JSON.stringify(jsonld).replace(/</g, '\\u003c'), { html: true }); } });
  // Empty Bio must remove old descriptions, including for crawlers.
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.delete('ETag');
  headers.delete('Content-Length');
  headers.delete('Last-Modified');
  return rewrite.transform(new Response(response.body, { status: response.status, headers }));
}
