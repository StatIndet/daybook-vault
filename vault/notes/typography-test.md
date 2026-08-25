---
title: 排版、字体与富文本
date: 2026-06-23
updated: 2026-08-23
lang: zh-CN
tags:
  - Typography
  - Fonts
  - Markdown
summary: 一篇用于观察 Daybook 自托管字体、正文混排、代码高亮与常见富文本元素的排版样张。
draft: false
listed: true
math: false
pin: false
comment: true
toc: true
---

Daybook 将主要字体随站点资源一起提供，浏览文章时不需要再向第三方字体 CDN 请求正文或代码字体。默认排版中，正文与大部分界面使用 **LXGW WenKai Screen**，代码使用 **Maple Mono CN**；元数据、签名、Logo 与图标则使用各自的专用字体。

这篇文章不要求读者记住字体文件的位置。它更像一张排版样张：在一页中放入中文、英文、数字、标点、代码与常见富文本，便于观察主题在真实内容中的表现。

## 正文与中英文混排

春水初生，春林初盛。A quiet paragraph can move naturally between 中文、English words、numbers such as 2026 and punctuation such as `()`, `[]`, `—` and `…`.

Daybook 的默认字体栈仍然保留系统字体作为回退，因此即使某个字符不在首选字体中，也应由浏览器选择可用字形继续显示。

### 常见强调

这里有 **加粗文本**、*斜体文本*、***加粗斜体***、~~删除线~~，以及 Obsidian 风格的 ==高亮文本==。

行内代码使用等宽字体，例如 `daybook build`、`const value = a !== b` 和 `user?.profile ?? null`。

> 好的排版并不要求每个元素都引人注目。正文、代码、引用和元数据各自承担清晰的层级即可。

## 列表与表格

- 正文：LXGW WenKai Screen
- 代码：Maple Mono CN
- 文章元数据：Cormorant Garamond Meta
- Logo：Daybook Fraunces
- 英文签名：Daybook Allura
- 图标：Material Symbols Rounded

| 内容 | 主要字体角色 | 目的 |
| --- | --- | --- |
| 正文与 UI | LXGW WenKai Screen | 长文阅读与界面文本 |
| 行内代码与代码块 | Maple Mono CN | 等宽排版与代码连字 |
| 日期等元数据 | Cormorant Garamond Meta | 与正文形成轻微层级差 |
| Logo / 签名 | 装饰字体 | 品牌与签名元素 |
| 操作图标 | Material Symbols Rounded | 界面图标 |

## 代码块

带语言标记的 fenced code block 会使用 Chroma 进行语法高亮，并带有复制按钮。

```typescript
type Article = {
  title: string;
  published: boolean;
};

const article: Article = {
  title: "A small Daybook example",
  published: true,
};

const label = article.published ? "published" : "draft";
console.log(label);
```

Go 代码同样适用：

```go
package main

import "fmt"

func main() {
    for i := 1; i <= 3; i++ {
        fmt.Printf("note %d\n", i)
    }
}
```

没有语言标记的代码块仍会保持等宽排版：

```text
0123456789
Il1 O0
=> !== <= >= ?? ?.
```

## 富文本不止是字体

排版还包括引用、表格、任务列表、脚注、Callout、折叠块、图片图注、数学公式与 Mermaid 等内容结构。完整写法见 [[markdown-syntax|Markdown、Obsidian 与 Daybook 语法]]。

如果需要查看更密集的扩展组件示例，可继续阅读 [[Markdown扩展语法测试页|Markdown 扩展语法测试页]]。
