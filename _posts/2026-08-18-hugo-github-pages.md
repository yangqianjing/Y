---
layout: post
title: "Hugo + GitHub Pages：十分钟上线你的第一个免费博客"
date: 2026-08-18
categories: ["运维"]
tags: ["GitHub Pages", "部署"]
subcategory: "GitHub Pages"
featured: true
---

从安装静态站点生成器、准备文章目录，到把代码推送到 GitHub Pages，静态博客的部署链路其实很短。

<!-- more -->

## 为什么选择静态博客

文章最终会变成 HTML 文件，不需要运行数据库和后端服务。对于个人笔记来说，部署简单、访问速度快，也方便用 Git 管理每一次修改。

## 基本流程

1. 在本地创建博客仓库。
2. 使用 Markdown 编写文章。
3. 提交并推送到 GitHub。
4. 在仓库设置中开启 GitHub Pages。

之后每次推送新的文章，GitHub Pages 都会重新构建站点。
