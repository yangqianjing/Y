---
layout: post
title: "Docker 部署指南：把本地服务一键搬到服务器"
date: 2026-07-15
categories: ["运维"]
tags: ["Docker", "部署"]
read_time: "9 分钟"
---

Docker Compose 适合把多个服务的镜像、端口、数据卷和环境变量集中写进一个配置文件。

<!-- more -->

部署时最容易忽略的是数据卷和日志策略。容器可以随时重建，但数据不能依赖容器本身保存。
