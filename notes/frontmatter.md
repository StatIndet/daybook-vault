---
title: 文章 Frontmatter
date: 2026-08-23
lang: zh-CN
tags:
  - Daybook
  - Frontmatter
  - Guide
summary: Daybook 文章 frontmatter 的完整字段参考，并说明文件路径、单语文章和双语文章之间的关系。
draft: false
listed: true
math: false
pin: false
comment: true
toc: true
---

每篇 Daybook 文章都是 `notes/` 下的 Markdown 文件，并在文件开头使用 YAML frontmatter 描述元数据。

最小可用形式只有两个必填字段：

```yaml
---
title: 我的第一篇文章
date: 2026-08-23
---
```

如果省略 `lang`，Daybook 默认按 `zh-CN` 处理。

## URL 由文件路径决定

Daybook **没有 `slug` frontmatter 字段**。文章 slug 来自 Markdown 文件在 `notes/` 下的相对路径。

例如：

```text
notes/hello.md
→ /notes/hello/

notes/journal/2026-08-23.md
→ /notes/journal/2026-08-23/
```

因此重命名文件或移动目录会改变文章路径。对于已经公开的文章，最好把文件路径视为稳定的公开 URL。 ^frontmatter-path-rule

## 完整示例

```yaml
---
title: 一篇完整示例
date: 2026-08-23
updated: 2026-08-24
lang: zh-CN
i18n_key: complete-example
tags:
  - Daybook
  - Notes
summary: 一段用于列表和 SEO 的简短摘要。
draft: false
listed: true
math: false
pin: false
toc: true
comment: true
---
```

## 字段说明

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `title` | 是 | 文章标题。为空时构建会把该笔记视为无效。 |
| `date` | 是 | 发布日期，用于排序、归档及发布元数据。建议使用 `YYYY-MM-DD`。 |
| `updated` | 否 | 最后更新日期；为空时不单独显示修改日期。 |
| `lang` | 否 | 文章语言，只接受 `zh-CN` 或 `en`；省略时为 `zh-CN`。 |
| `i18n_key` | 否 | 把不同语言文件归入同一个文章组。单语文章通常省略。 |
| `tags` | 否 | 标签数组。每个语言版本可以使用自己的展示文本。 |
| `summary` | 否 | 文章摘要，用于列表和页面元数据。 |
| `draft` | 否 | `true` 时整篇文章在构建阶段被跳过，不生成详情页。默认 `false`。 |
| `listed` | 否 | `false` 时不进入主要文章列表、归档、RSS、sitemap 与关系图常规集合，但详情页仍会生成。默认 `true`。 |
| `math` | 否 | 标记文章需要数学公式支持。含 KaTeX 内容时设为 `true`。 |
| `pin` | 否 | 标记文章的置顶状态，由文章列表界面展示。默认 `false`。 |
| `toc` | 否 | 是否显示文章目录。省略时默认为开启。 |
| `comment` | 否 | 文章级评论开关，用于覆盖站点的评论设置。 |

> [!note]
> 当前搜索索引收录所有非 `draft` 版本，因此 `listed: false` 不等同于“完全不可发现”。如果内容尚未准备公开，应使用 `draft: true`。

## 单语文章

单语文章只需要选择语言，不需要构造一个只有一份文件的翻译键：

```yaml
---
title: An English Note
date: 2026-08-23
lang: en
---
```

如果当前界面语言没有对应版本，Daybook 会回退到文章已有的版本。[[Shakespeare|Shakespeare 示例]]就是一篇纯英文文章。

## 多语言文章

双语文章使用两份 Markdown，并共享同一个 `i18n_key`：

中文：

```yaml
---
title: 静夜思
date: 2026-06-25
lang: zh-CN
i18n_key: thoughts-in-a-quiet-night
---
```

英文：

```yaml
---
title: Thoughts in a Quiet Night
date: 2026-06-25
lang: en
i18n_key: thoughts-in-a-quiet-night
---
```

同一个 `i18n_key` 下，同一种语言只能出现一次。Daybook 会优先选择当前界面的语言；缺少该语言时，优先回退到中文，再回退到英文。

建议一组翻译保持一致的 `date` 与 `listed`，而 `title`、`summary`、`tags` 和正文则分别按各自语言编写。

实际效果可查看《静夜思》与其英文版本。

## Frontmatter 与站点配置的边界

Frontmatter 描述**一篇文章**；站点标题、作者、SEO 首页信息、评论服务、统计和分享文本则属于 Vault 根目录的 `daybook.yaml`。

继续阅读 [[daybook-yaml|daybook.yaml 配置]]。
