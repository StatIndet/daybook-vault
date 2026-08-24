---
title: 附件与远程媒体
date: 2026-06-29
updated: 2026-08-23
lang: zh-CN
tags:
  - Daybook
  - Obsidian
  - Media
summary: 介绍 Daybook 如何处理 Vault 内附件，以及如何用远程 HTTP(S) 资源嵌入图片、PDF、音频、视频和音乐。
draft: false
listed: true
math: false
pin: false
comment: true
toc: true
---

Daybook 对附件采用一条简单的规则：**Vault 中受支持的媒体文件作为本地附件处理；远程媒体则由文章显式引用 HTTP(S) URL。**

目录名本身不会决定附件“本地”还是“远程”。例如 `attachments/picture/`、`attachments/pdf/` 和 `attachments/music/` 只是组织文件的方式，不会自动把某个子目录上传到 R2。

## Vault 内附件

构建时，Daybook 会扫描 Vault 中受支持的媒体，并按 Vault 相对路径复制到 `public/`。当前支持：

- 图片：PNG、JPEG、GIF、WebP、AVIF、SVG
- 音频：FLAC、MP3、WAV、OGG、M4A
- 视频：MP4、WebM、MOV
- PDF

当前示例 Vault 的 Obsidian 配置把附件目录设为 `attachments`，但 Daybook 也会读取 `.obsidian/app.json` 中的 `attachmentFolderPath` 来辅助解析链接。

### 图片

最直接的写法是 Obsidian embed：

```markdown
![[attachments/picture/shelby.jpg]]
```

可以指定对齐与宽度：

```markdown
![[attachments/picture/shelby.jpg|center|480]]
```

实际效果：

![[attachments/picture/shelby.jpg|center|480]]

如果文件名在整个 Vault 中唯一，也可以只写文件名。大型 Vault 中更推荐明确路径；如果存在多个同名附件，Daybook 会给出歧义警告，而不是猜测应该使用哪一个。

### PDF

```markdown
![[attachments/pdf/shi-jian-lun.pdf]]
```

实际效果：

![[attachments/pdf/shi-jian-lun.pdf]]

### 音频


![[Justin Timberlake; Carey Mulligan; Stark Sands - Five Hundred Miles.flac]]

如果文件超过 25 MiB。Daybook 会提示它可能超过 Cloudflare Pages 的单文件限制，因此较大的音频或视频更适合放在对象存储或其他静态文件服务中，再使用远程 URL。

## 远程媒体

远程资源不需要位于 Cloudflare R2。任何浏览器可访问的 `http://` 或 `https://` 媒体 URL 都可以作为来源；R2、S3、对象存储、自建静态站点或其他 CDN 只是不同的托管方式。

### 图片

```markdown
::image{url="https://static.daybook.page/picture/shelby.jpg" width="720" align="center" caption="Remote image"}
```

::image{url="https://static.daybook.page/picture/shelby.jpg" width="720" align="center" caption="Remote image"}

`::image` 支持 `url`、`alt`、`caption`、`width` 与 `align`。

### PDF

```markdown
::pdf{url="https://static.daybook.page/pdf/shi-jian-lun.pdf" height="720" caption="Remote PDF"}
```

::pdf{url="https://static.daybook.page/pdf/shi-jian-lun.pdf" height="720" caption="Remote PDF"}

`::pdf` 支持 `url`、`caption`、`width`、`height` 与 `align`。

### 音频

```markdown
::audio{url="https://static.daybook.page/audio/JayChou-ai-zai-xi-yuan-qian.FLAC"}
```

::audio{url="https://static.daybook.page/audio/JayChou-ai-zai-xi-yuan-qian.FLAC"}

`::audio` 还支持 `caption`、`width`、`align`、`autoplay`、`muted` 与 `loop`。

### 视频

```markdown
::video{url="https://static.daybook.page/video/1130650335-1-208.mp4" width="720" align="center"}
```

::video{url="https://static.daybook.page/video/1130650335-1-208.mp4" width="720" align="center"}

`::video` 还支持 `caption`、`height`、`poster`、`autoplay`、`muted` 与 `loop`。

### 音乐播放器

`::music` 使用独立的 Daybook 音乐播放器。构建阶段会尝试读取远程音频的元数据；如果需要，也可以显式覆盖标题、艺术家或封面。

```markdown
::music{url="https://static.daybook.page/music/Five-Hundred-Miles.flac" loop="true"}
```

::music{url="https://static.daybook.page/music/Five-Hundred-Miles.flac" loop="true"}

可选字段为 `title`、`artist`、`cover` 与 `loop`。`cover` 也应使用可访问的远程 URL。

手动覆盖元数据：

```markdown
::music{url="https://static.daybook.page/music/Five-Hundred-Miles.flac" title="Example Track" artist="Example Artist" cover="https://static.daybook.page/picture/shelby.jpg"}
```

实际效果：

::music{url="https://static.daybook.page/music/Five-Hundred-Miles.flac" title="Example Track" artist="Example Artist" cover="https://static.daybook.page/picture/shelby.jpg"}

## 怎样选择

小型图片、PDF 或音频可以直接保留在 Vault 中，获得最自然的 Obsidian 写作体验。体积较大的媒体更适合外部存储，再通过远程 directive 引用。两种方式可以在同一篇文章中同时使用。

更多语法见 [[markdown-syntax|Markdown、Obsidian 与 Daybook 语法]]；站点级配置见 [[daybook-yaml|daybook.yaml 配置]]。
