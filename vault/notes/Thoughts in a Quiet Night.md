---
title: Thoughts in a Quiet Night
date: 2026-06-25
updated: 2026-08-23
lang: en
i18n_key: thoughts-in-a-quiet-night
tags:
  - Poetry
  - Tang-Poetry
  - Li-Bai
summary: A short English rendering of Li Bai’s poem, paired with the Chinese original to demonstrate Daybook’s bilingual article model.
draft: false
listed: true
math: false
pin: false
comment: true
toc: false
---

Before my bed, the moonlight gleams;\
I wonder if it is frost upon the ground.\
I raise my head and gaze at the bright moon;\
I lower my head and think of home.

## About this example

This file and its Chinese counterpart share:

```yaml
i18n_key: thoughts-in-a-quiet-night
```

The two files keep their own title, summary, tags, body, and language, while Daybook groups them as one article. The article metadata can then offer the other language without duplicating the entry as two unrelated posts.

For a bilingual pair, use exactly one `zh-CN` version and one `en` version for the same `i18n_key`. Keeping fields such as `date` and `listed` consistent between the two versions makes the result easier to reason about.

See [[frontmatter|Article frontmatter]] for the complete rule set. For a single-language article, compare the English-only Shakespeare sample.
