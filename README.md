# Y Blog

这是一个使用 Jekyll 构建、可直接部署到 GitHub Pages 的个人博客。

## 文件

- `index.html`：博客首页，包含文章归档、分类筛选、明暗主题切换和响应式布局。
- `_posts/`：博客笔记，使用 Markdown 编写。
- `_layouts/post.html`：文章详情页模板。
- `_data/categories.yml`：分类名称和颜色。
- `assets/css/post.css`：文章页样式。

## 新增笔记

在 `_posts/` 中创建文件，文件名格式为：

```text
YYYY-MM-DD-文章英文标题.md
```

文章顶部填写 Front Matter：

```yaml
---
layout: post
title: "你的文章标题"
date: 2026-08-23
categories: ["运维"]
tags: ["Docker", "部署"]
subcategory: "Docker"
---
```

分类目前支持：

```text
前端 / 后端 / 运维 / AI 工具 / 随笔
```

文章可以使用 `subcategory` 指定一级分类下的子分类，例如：

```yaml
categories: ["运维"]
subcategory: "MySQL"
tags: ["数据库", "SQL"]
```

首页会根据文章的 `subcategory` 自动生成子分类筛选。未填写 `subcategory` 的文章不会出现在子分类筛选中。

写完后提交并推送：

```powershell
git add .
git commit -m "Add a new note"
git push origin main
```

首页会自动读取 `_posts` 中的文章，分类数量也会自动更新，不需要手动修改 `index.html`。

## 部署到 GitHub Pages

1. 将本仓库推送到 GitHub。
2. 打开仓库的 `Settings`。
3. 进入 `Pages`。
4. 在 `Build and deployment` 中选择 `Deploy from a branch`。
5. 分支选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub Pages 自动发布。
