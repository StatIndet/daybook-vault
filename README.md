# Daybook Vault

A starter vault and template repository for [Daybook](https://github.com/StatIndet/daybook), a minimalist static blog generator for Obsidian notes.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/StatIndet/daybook-vault)

## Deploy to Cloudflare

This template is configured for Cloudflare Workers Builds. Click the button above to automatically:
1. Clone this repository to your GitHub account.
2. Provision a D1 Database (for page-view statistics).
3. Provision a Durable Object namespace (for realtime viewing presence).
4. Build the static site and deploy the API worker to Cloudflare.

Subsequent git pushes to your repository will automatically trigger a new deployment.

## Writing in Obsidian

1. Open Obsidian and select **Open folder as vault**.
2. Select the `vault/` directory inside this repository.
3. Write articles in `vault/notes/`, short entries in `vault/memos/`, and place attachments in `vault/attachments/`.
4. The global Daybook configuration remains at the repository root (`daybook.yaml`), which is outside the Obsidian vault.
5. The built static site is output to `public/`, completely separate from your source files.

Notes and memos use the Markdown filename as their title; do not add a `title` property. Keep existing filenames to preserve published URLs. The only required property is a valid `date`, either `YYYY-MM-DD` or an RFC 3339 timestamp such as `2026-10-02T21:30:00+08:00`. `draft: true` keeps an entry out of every public output.

Memos appear in the `/memos/` timeline alongside Notes and Archive in the navigation. `tags` and a plain-text `location` are optional. The included memo examples demonstrate text, a quotation, a local image and a checklist. They share RSS, search, Obsidian links and the graph with notes, but do not appear in Archive. Calendar and tag filters combine with search across body text, filenames, dates, locations and tags. The timeline shows the full text and up to four images, with additional images available on the detail page. Use `[[notes/filename]]` or `[[memos/filename]]` to disambiguate links across the two directories.

The Obsidian templates are in `vault/_templates/daybook-note.md` and `vault/_templates/daybook-memo.md`. Use the updated local CLI described below until a release containing memos is available.

Set `pinned: true` in a memo's frontmatter to pin it above ordinary entries; both groups remain newest first. Set `pinned: false` or omit it to unpin, then rebuild. Search, calendar and tag filters still apply. The `阅读间隙` example is pinned, and the memo template defaults to `pinned: false`.

Memos support an optional `updated` property (a date or RFC 3339 timestamp), shown in the timeline and detail page without changing publication-date ordering. Memos do not calculate word counts or reading time, and their detail pages do not offer reader mode. The old `pin` frontmatter property has been renamed to `pinned` for both notes and memos; rename it in existing files.

## Local Build

To build the static site locally:

```bash
npm ci
npm run build
```

The output will be generated in the `public/` directory.

You can preview the site and the worker API locally using:

```bash
npm run dev
```

## Dependency updates

Dependabot checks npm dependencies weekly and opens pull requests that update both `package.json` and `package-lock.json`. Wrangler keeps a caret version range; the `increase` strategy raises its minimum version with each update. Keep both files committed and use `npm ci` for builds.

Before merging dependency updates, run `npm ci`, `npm run build` (set `DAYBOOK_BINARY` when testing an unreleased local CLI), and then `npm run test:worker`; the asset tests read the generated site. Apply local migrations with `npx wrangler d1 migrations apply DB --local`, start `npm run dev -- --local`, and check that the homepage and Worker API respond. Repeat this validation whenever changing `compatibility_date` in `wrangler.jsonc`; the locked Wrangler runtime must support that date.

Each repository created from this template needs its own Dependabot configuration on its default branch. Existing repositories must copy these dependency updates too; forks must explicitly enable Dependabot version updates in GitHub settings.

## Daybook Version

The Daybook CLI version used for building the site is specified in the `.daybook-version` file at the root of this repository.

- By default, it is set to `latest`, which will automatically fetch the latest stable release from GitHub.
- If you want a reproducible build environment, you can pin it to a specific release tag (e.g., `v2026.08.24.2`).

## Configuration

Configure your site globally in `daybook.yaml`. Leave `site.url` empty if you don't want to enforce a specific domain initially. You can configure it later once your domain is set up on Cloudflare.

## GitHub updates

The homepage is synchronized from the official GitHub APIs during every local build. This vault's Worker also refreshes a public profile snapshot in KV at minute 17 of each hour (UTC), then rewrites both the homepage HTML and SEO metadata on the server. Visitors do not wait for live GitHub requests. When GitHub is unavailable, the last successful snapshot remains available.

Set `github.username` in `daybook.yaml` and `GITHUB_USERNAME` in `wrangler.jsonc` to the same account. The `GITHUB_CACHE` namespace is automatically provisioned by Wrangler when deploying; an existing namespace can instead be selected by adding its `id` to the binding. Set `GITHUB_TOKEN` as a local build environment variable and a Worker secret to enable exact pinned repositories, contribution calendar and profile status. Use public-read access only; do not put credentials in YAML, the Worker config or committed files. The first build can run without a token and provides public REST data.

Use the updated Daybook CLI when building this vault. The setup script still follows `.daybook-version`; publishing this source change requires releasing the CLI or pointing the build to the corresponding compiled binary.

For local review before a release, build the CLI source and select that binary explicitly:

```bash
cd /home/statindet/Projects/daybook
go build -o /tmp/daybook-local ./cmd/daybook
cd /home/statindet/Documents/daybook-vault
DAYBOOK_BINARY=/tmp/daybook-local npm run build
```

Validate locally before publishing:

```bash
npm ci
npm run build
npx wrangler deploy --dry-run
npx wrangler types
npx wrangler dev --test-scheduled
```

With the local Worker running, visit `/`, `/en_US/`, and `/api/github`. Request `/__scheduled` to exercise the cron handler. Check that a changed GitHub Bio appears in the visible profile and in `description`, Open Graph, Twitter and JSON-LD metadata. The stats D1 database and presence Durable Object remain separate from the profile KV.

The placeholder D1 database ID must be replaced with your existing database ID before a real deployment. Generated pages, local KV state, `.dev.vars`, and `.daybook-cache` remain ignored.

## Comments

Comments use the public `StatIndet/giscus` Discussions repository and its Announcements category. `daybook.yaml` contains the repository/category IDs. Articles keep their canonical path as the discussion mapping; add `comment: false` to an article to disable comments. Reader settings can also disable loading. Posting requires GitHub sign-in. Historical Waline comments are not imported.

The updated CLI supplies four matching themes and fonts, including CORS headers for immutable assets. For local testing of this unreleased migration, use the `DAYBOOK_BINARY` build command above, then run `./.daybook/bin/daybook serve` and open `http://localhost:1313`. Local pages use local theme assets; posting still writes real Discussions, so use a dedicated test article. Deploy with the updated CLI release after review.

## Likes and RSS

The updated CLI adds anonymous, cancellable likes to note/memo details and the memos timeline when `stats.enabled: true`. The first like creates a `daybook_engagement` Cookie (one year), independent of statistics and giscus. Reading counts does not create a Cookie. Returning in the same browser restores the liked state. Clearing cookies, private browsing or changing devices creates a new anonymous identity; this is lightweight feedback, not verified one-person-one-vote. Likes are runtime records, not Markdown frontmatter, and rebuilding the site does not reset them. Keep published article paths and `STATS_SALT` stable to preserve associations.

Apply `migrations/0002_likes.sql` before serving the new Worker. The existing `npm run deploy` command applies pending remote migrations before deployment. For local preview, apply migrations locally first:

```bash
npx wrangler d1 migrations apply DB --local
npm run dev
```

`GET /api/likes?path=/notes/example/` returns `{ "items": [{ "path": "/notes/example/", "count": 0, "liked": false }] }`. Repeated `path` parameters support up to 50 articles. Same-origin `PUT /api/likes` with JSON `{ "path": "/notes/example/", "liked": true }` sets a like; `false` removes it. Duplicate requests are idempotent. Only published article routes are accepted, and personal responses are never publicly cached. A failed API request leaves the button's last confirmed state unchanged and allows retry. `npm run test:worker` covers real local D1 transactions, concurrency, cancellations and request validation.

Both the global RSS entry (in the mobile drawer on small screens) and article metadata subscribe to the same `/rss.xml` feed. The dialog offers an ordinary feed link and a copyable address for RSS readers. The feed includes published notes and memos with their title, link, publication date and optional summary. It is not an email subscription or a per-article edit/comment notification service. RSS works on static hosting without the Worker; use `wrangler dev` to preview actual likes rather than the static-only `daybook serve`.

## Privacy

Use the updated CLI and Worker together. With `stats.enabled: true`, a first-visit paper dialog asks about anonymous statistics, unchecked by default. Settings → Privacy reopens it. Closing without saving never grants consent. Preferences remain local and comments retain their existing lazy loading and Disable Comments control.

The browser stores `{ "analytics": boolean }` in `daybook:privacy:v1`. Before runtime APIs start, same-origin `PUT /api/privacy` synchronizes that choice (false for a first visit), returning `{ "version": 1, "analytics": boolean }`. Only this endpoint creates `daybook_analytics`, an HttpOnly, Secure, SameSite=Lax Cookie lasting up to one year. Denying or withdrawing deletes it. `POST /api/hit` counts aggregate page views without an identity, and updates anonymous visitors only with both `analytics: true` and the analytics Cookie. `countView: false` refreshes consent-related statistics without another page view. Hits never set Cookies, so delayed hits cannot recreate a withdrawn identity. Existing historical counts remain; new analytics hashes use a separate namespace from likes.

Presence uses a random ID for each WebSocket connection and does not read either Cookie. Multiple tabs can therefore count as multiple online connections. Likes work with either privacy choice. On upgrade, `/api/privacy` preserves an old `daybook_visitor` as an engagement Cookie only if it has existing likes, then expires the old Cookie; unused old identities are simply retired. No new schema migration is required beyond the existing stats and likes migrations.

The CLI pauses runtime APIs if this privacy protocol is missing or unavailable, while browsing remains available. Saving shows a retryable message if server cleanup cannot be confirmed. Local preview requires the Worker (`npm run dev`) for actual Cookie behavior; `daybook serve` serves only static UI. Worker privacy tests cover consent, withdrawal, identity separation, migration and invalid requests; the CLI browser tests cover the dialog, keyboard/mobile behavior, persistence and unavailable storage/backend handling.
