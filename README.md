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
3. Write your articles in `vault/notes/` and place attachments in `vault/attachments/`.
4. The global Daybook configuration remains at the repository root (`daybook.yaml`), which is outside the Obsidian vault.
5. The built static site is output to `public/`, completely separate from your source files.

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

## Daybook Version

The Daybook CLI version used for building the site is specified in the `.daybook-version` file at the root of this repository.

- By default, it is set to `latest`, which will automatically fetch the latest stable release from GitHub.
- If you want a reproducible build environment, you can pin it to a specific release tag (e.g., `v2026.08.24.2`).

## Configuration

Configure your site globally in `daybook.yaml`. Leave `site.url` empty if you don't want to enforce a specific domain initially. You can configure it later once your domain is set up on Cloudflare.
