---
date: 2026-08-23
lang: zh_CN
tags:
  - Daybook
  - Frontmatter
  - Guide
summary: Daybook 文章 frontmatter 的完整字段参考，并说明文件路径、单语文章和双语文章之间的关系。
draft: false
math: false
pinned: false
comment: true
toc: true
---

长文放在 `vault/notes/`，碎碎念放在 `vault/memos/`。在 Obsidian 中打开 `vault/` 后，它们分别对应 `notes/` 和 `memos/`。每篇内容都在文件开头使用 YAML frontmatter 描述元数据。

最小可用形式只有一个必填字段 `date`：

```yaml
---
date: 2026-08-23
---
```

文章标题直接使用 Markdown 文件名（去掉 `.md`），不再读取 `title` 属性。例如 `我的第一篇文章.md` 的标题就是“我的第一篇文章”。Memos 时间线直接展示正文，不重复显示文件名标题；搜索、链接和详情页仍用文件名识别它。

如果省略 `lang`，Daybook 默认按 `zh-CN` 处理。

## URL 由文件路径决定

Daybook **没有 `slug` frontmatter 字段**。文章 slug 来自 Markdown 文件在 `notes/` 或 `memos/` 下的相对路径。

例如：

```text
notes/hello.md
→ /notes/hello/

notes/journal/2026-08-23.md
→ /notes/journal/2026-08-23/

memos/雨天清单.md
→ /memos/雨天清单/
```

因此重命名文件或移动目录会改变文章路径；重命名也会改变展示标题。删除旧 `title` 属性时应保留现有文件名，以维持原 URL。对于已经公开的文章，最好把文件路径视为稳定的公开 URL。 ^frontmatter-path-rule

## 完整示例

```yaml
---
date: 2026-08-23
updated: 2026-08-24
lang: zh_CN
i18n_key: complete-example
tags:
  - Daybook
  - Notes
summary: 一段用于列表和 SEO 的简短摘要。
draft: false
math: false
pinned: false
toc: true
comment: true
---
```

## 字段说明

| 字段 | 必填 | 含义 |
| --- | --- | --- |
| `date` | 是 | 发布日期，用于排序、归档及发布元数据。支持 `YYYY-MM-DD` 或 RFC 3339，如 `2026-10-02T21:30:00+08:00`。缺失或无效时会跳过该文件并报告。 |
| `updated` | 否 | 最后更新日期；Notes 和 Memos 都可使用。Memos 支持与 `date` 相同的日期或带时区时间格式，在时间线和详情页显示；为空时不显示，且不改变发布时间排序。 |
| `lang` | 否 | 文章语言，只接受 `zh-CN` 或 `en`；省略时为 `zh-CN`。 |
| `i18n_key` | 否 | 把不同语言文件归入同一个文章组。单语文章通常省略。 |
| `tags` | 否 | 标签数组。每个语言版本可以使用自己的展示文本。 |
| `location` | 否 | Memos 的纯文本地点，例如 `书桌前`；不要求坐标。 |
| `summary` | 否 | 文章摘要，用于列表和页面元数据。 |
| `draft` | 否 | `true` 时整篇文章在构建阶段被跳过，不生成详情页。默认 `false`。 |
| `math` | 否 | 标记文章需要数学公式支持。含 KaTeX 内容时设为 `true`。 |
| `pinned` | 否 | `true` 时在对应的 Notes 列表或 Memos 时间线置顶并显示图钉标记；`false` 或省略时不置顶。 |
| `toc` | 否 | 是否显示文章目录。省略时默认为开启。 |
| `comment` | 否 | 文章级评论开关，用于覆盖站点的评论设置。 |

所有非草稿笔记都会生成详情页，并进入 Notes、归档、标签页、搜索索引、RSS、sitemap 和关系图。Memos 有单独的时间线，不进入归档页，但与 Notes 共用 RSS、搜索、双链和关系图。尚未准备公开的内容应设置 `draft: true`。

## Memos 示例

新建 `vault/memos/傍晚散步.md`：

```markdown
---
date: 2026-10-02T18:30:00+08:00
tags: [日常, 随想]
location: 河边
pinned: false
---
走着走着想到：短暂的想法也值得记录。

回来再读一遍 [[notes/静夜思|《静夜思》]]。
```

时间可省略，此时使用 `date: 2026-10-02`。只有 `date` 必填；`tags`、`location`、`draft` 都可省略。短文可以用列表、引用、图片或普通段落，自由保留 Markdown 正文。Memos 页面可以组合使用日历和标签筛选，搜索正文、文件名、日期、地点及标签。时间线完整展示正文，图片最多展示四张；更多图片可进入详情页查看。

Notes 和 Memos 可以互相使用双链；同名文件存在时，用 `[[notes/文件名]]` 或 `[[memos/文件名]]` 明确目标。

需要置顶某篇随记时，在属性中设置 `pinned: true`，重新构建后生效。多篇置顶随记按发布日期倒序排列，随后是同样按日期倒序排列的普通随记。设置 `pinned: false` 或删除该属性即可取消置顶。置顶不会绕过搜索、日历或标签筛选。[[memos/阅读间隙|阅读间隙]]是置顶示例。

Memos 不计算字数或阅读时长，详情页不提供阅读模式。置顶属性已统一由 `pin` 改名为 `pinned`，旧文件请修改属性名。

## 单语文章

单语文章只需要选择语言，不需要构造一个只有一份文件的翻译键：

```yaml
---
date: 2026-08-23
lang: en_US
---
```

如果当前界面语言没有对应版本，Daybook 会回退到文章已有的版本。[[Shakespeare|Shakespeare 示例]]就是一篇纯英文文章。

## 多语言文章

双语文章使用两份 Markdown，并共享同一个 `i18n_key`：

中文：

```yaml
---
date: 2026-06-25
lang: zh_CN
i18n_key: thoughts-in-a-quiet-night
---
```

英文：

```yaml
---
date: 2026-06-25
lang: en_US
i18n_key: thoughts-in-a-quiet-night
---
```

同一个 `i18n_key` 下，同一种语言只能出现一次。Daybook 会优先选择当前界面的语言；缺少该语言时，优先回退到中文，再回退到英文。

建议一组翻译保持一致的 `date`，而文件名、`summary`、`tags` 和正文则分别按各自语言编写。

实际效果可查看《静夜思》与其英文版本。

## Frontmatter 与站点配置的边界

Frontmatter 描述**一篇文章**；站点标题、作者、SEO 首页信息、评论服务、统计和分享文本则属于 Vault 根目录的 `daybook.yaml`。

继续阅读 [[daybook-yaml|daybook.yaml 配置]]。
