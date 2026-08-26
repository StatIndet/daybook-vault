package main

import (
	"os"
	"strings"
)

func main() {
	content, _ := os.ReadFile("vault/notes/daybook-yaml.md")
	s := string(content)

	s = strings.Replace(s, `seo:
  homeTitle:
    en: "My Daybook"
    zh: "我的 Daybook"
  homeDescription:
    en: "Welcome to my personal Daybook."
    zh: "欢迎来到我的个人 Daybook。"`, `seo:
  siteName:
    en: "My Daybook"
    zh: "我的笔记"
  homeTitle:
    en: "Notes from My Daybook"
    zh: "我的 Daybook · 随笔与记录"
  homeDescription:
    en: "Welcome to my personal Daybook."
    zh: "欢迎来到我的个人 Daybook。"`, -1)

    s = strings.Replace(s, `首页标题与描述分别配置中英文：`, `- **site.title**: Daybook 通用站点标题，也是配置缺省时的后备名称。
- **seo.siteName**: SEO 网站短名称，用于后缀（例如：文章标题 | 短名称）以及分享时的站点名。
- **seo.homeTitle**: 首页专属的完整 SEO 标题。
- **seo.homeDescription**: 首页的 SEO 描述。

配置示例：`, 1)

	os.WriteFile("vault/notes/daybook-yaml.md", []byte(s), 0644)
}
