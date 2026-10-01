---
title: daybook.yaml 配置
date: 2026-08-23
lang: zh_CN
tags:
  - Daybook
  - Configuration
  - Guide
summary: Daybook Vault 根目录中 daybook.yaml 的完整配置说明，包括站点资料、作者、SEO、Waline、统计与分享文本。
draft: false
listed: true
math: false
pin: false
comment: true
toc: true
---

`daybook.yaml` 是 Daybook 的站点级配置文件，放在 **Vault 根目录**。`daybook build` 会从当前工作目录读取它；文件不存在或 YAML 无法解析时，构建会直接报错。

文章自己的标题、日期、语言等信息不写在这里，而是写在各自的 frontmatter 中。两者的分工可参考 [[frontmatter|文章 Frontmatter]]。

## 一份可直接修改的示例

```yaml
site:
  name:
    en: "My Daybook"
    zh: "我的笔记"
  url: "https://example.com"
  startedAt: "2024-01-01"
  favicon: ""

github:
  username: "StatIndet"
  tokenEnv: "GITHUB_TOKEN"
  apiURL: "/api/github"

profile:
  author:
    logoText: "Daybook"
    aboutUrl: "/about/"
  social: []

comment:
  enabled: false
  provider: "waline"
  waline:
    serverURL: ""
    lang: "zh-CN"
    pageSize: 10
    commentSorting: "latest"
    search: false
    imageUploader: false

stats:
  enabled: true

share:
  text: '「{Title}」'
```

本地预览时，`site.url` 也可以使用 `http://localhost:1313`。正式部署后应改为最终公开地址。

## site

### `title`

站点名称。为空时使用 `Daybook`。

### `url`

站点的公开基础 URL，用于生成 canonical、分享链接、sitemap 等绝对地址。非空时必须以 `http://` 或 `https://` 开头。

```yaml
url: "https://example.com"
```

### `startedAt`

站点起始日期。建议使用 `YYYY-MM-DD`。为空时当前实现使用 `2026-06-08` 作为默认值。

### `favicon`

自定义 favicon 的路径，**相对于 Vault 根目录**。为空时使用 Daybook 内置 favicon。

例如源文件位于：

```text
assets/favicon.svg
```

则可写：

```yaml
favicon: "assets/favicon.svg"
```

构建时如果这里指定的文件不存在，Daybook 会报错。

## `github`

首页以 GitHub 为唯一资料上游，每次 `daybook build` 更新公开资料、头像、Bio、README、仓库、组织、关注数和公开动态。Bio 同时进入首页 description、Open Graph、Twitter 和 JSON-LD。配置中的作者名、英文名、头像、slogan 和首页 SEO 文案不再用于覆盖 GitHub 信息。

- `username`：GitHub 用户名。
- `tokenEnv`：构建进程中保存 GitHub token 的环境变量名，默认为 `GITHUB_TOKEN`。token 不写入配置或构建产物。没有 token 也可以读取公开 REST 数据；精确置顶仓库、贡献日历和状态需要 GraphQL token。
- `apiURL`：vault Worker 的公开资料端点，默认 `/api/github`。

本地缓存位于 `.daybook-cache/github/`，上游不可用时复用最后一次成功的数据；从未成功同步时构建会明确报错。GitHub 成就徽章未由官方 API 提供，因此不渲染猜测的数据。

Cloudflare 定时更新由 vault 的 Worker 实现：`GITHUB_CACHE` KV 保存快照，Cron 每小时更新，服务端一并改写首页内容与 SEO。GitHub 请求失败不清除已有快照。

## `profile`

仅保留站点级的固定 Logo 和页脚偏好：

```yaml
profile:
  author:
    logoText: "Daybook"
    aboutUrl: "/about/"
  social: []
```

`logoText` 控制固定 Logo，`aboutUrl` 控制站内作者链接。`social` 的平台格式继续兼容旧配置，但首页的社交信息来自 GitHub。文章、笔记等页面右侧不再展示中英文作者名与 slogan。

## `seo`

- **site.name**: Daybook 本地化网站短名称，用于非首页后缀（例如：文章标题 | 短名称）、RSS 以及分享时的站点名。
- **seo.homeTitle**: 首页专属的完整 SEO 标题。
- **seo.homeDescription**: 首页的 SEO 描述。

配置示例：

```yaml
seo:
  siteName:
    en: "My Daybook"
    zh: "我的笔记"
  homeTitle:
    en: "Notes from My Daybook"
    zh: "我的 Daybook · 随笔与记录"
  homeDescription:
    en: "Welcome to my personal Daybook."
    zh: "欢迎来到我的个人 Daybook。"
```

文章详情页的 SEO 标题、摘要、发布日期和标签主要来自文章 frontmatter，因此首页配置与文章配置互不替代。

## `comment`

Daybook 当前内置 Waline 前端集成：

```yaml
comment:
  enabled: true
  provider: "waline"
  waline:
    serverURL: "https://comment.example.com"
    lang: "zh-CN"
    pageSize: 10
    commentSorting: "latest"
    search: false
    imageUploader: false
```

- `enabled`：站点级评论开关。
- `provider`：当前实现使用 `waline`。
- `serverURL`：Waline 服务地址。启用 Waline 却不填写该字段时，Daybook 会警告并关闭评论。
- `lang`：Waline 界面语言；为空时默认 `zh-CN`。
- `pageSize`：每页评论数；`0` 会回退到 `10`。
- `commentSorting`：评论排序；为空时默认 `latest`。
- `search`：是否启用 Waline 搜索相关能力。
- `imageUploader`：是否启用 Waline 图片上传入口。

单篇文章还可以通过 frontmatter 的 `comment: true/false` 覆盖文章级行为。

## `stats`

```yaml
stats:
  enabled: true
```

控制 Daybook 的访问统计功能是否启用。这个字段本身只表达站点配置，不会在本地凭空创建 Cloudflare D1 等外部资源；部署环境仍需要提供统计功能所需的后端绑定。

## `share`

```yaml
share:
  text: '「{Title}」'
```

定义文章分享时使用的文本模板。`{Title}` 会被当前文章标题替换。

例如文章标题为 `静夜思` 时，上面的模板会得到：

```text
「静夜思」
```

为空时 Daybook 使用内置的标题模板。

## 配置与内容保持独立

`daybook.yaml` 适合存放站点级、可以公开提交到仓库的设置；文章自身的元数据放在 frontmatter，正文保持 Markdown。这样更换站点名称或评论服务时，不需要批量修改每一篇文章。

写作语法继续见 [[markdown-syntax|Markdown、Obsidian 与 Daybook 语法]]；附件规则见 [[obsidian-media-local-remote-test|附件与远程媒体]]。
