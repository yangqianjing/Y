---
layout: post
title: "Helm-基础学习"
date: 2026-08-24
categories: ["运维"]
tags: ["k8s", "基础"]
subcategory: "k8s"
---

# Helm学习-基础学习

### 什么是 Helm？

**Helm** 是 Kubernetes 的包管理工具，类似于 Linux 的 apt/yum 或 Node.js 的npm。它可以以一条命令部署复杂的 Kubernetes 应用，不需要手动管理大量的 YAML 文件。

### 1.核心概念

#### 1.1 Chart

:book:Helm 的基本打包单位，包含一组 Kubernetes 资源的模板文件。可以理解为一个“应用安装包”

```shell
mychart/
├── Chart.yaml          # Chart 的元信息（名称、版本等）
├── values.yaml         # 默认配置值
├── charts/             # 依赖的子 Chart
└── templates/          # Kubernetes 资源模板
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

#### 1.2 Repository

🗂️存储和分享 Chart 的仓库，类似 docker hub

#### 1.3 Release

🚀Chart 部署到集群后的一个运行实例。同一个 chart 可以在同一集群中部署多次，每次是不同的 Release

------

**常用命令**

```shell
# 添加仓库
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 搜索 Chart
helm search repo nginx

# 安装（创建 Release）
helm install my-nginx bitnami/nginx

# 安装时自定义配置
helm install my-nginx bitnami/nginx --set service.type=NodePort
helm install my-nginx bitnami/nginx -f custom-values.yaml

# 查看已安装的 Release
helm list

# 升级 Release
helm upgrade my-nginx bitnami/nginx --set replicaCount=3

# 回滚到上一个版本
helm rollback my-nginx 1

# 卸载
helm uninstall my-nginx

# 查看 Chart 的默认配置
helm show values bitnami/nginx
```

### 2.helm实操

使用helm安装的时候，需要指定从**哪个仓库安装哪个chart**

```shell
# 1. 添加仓库
helm repo add bitnami https://charts.bitnami.com/bitnami

# 2. 更新索引
helm repo update

# 3. 安装
helm install my-nginx bitnami/nginx
#               |        |       |
#            Release名  仓库名  Chart名
```

常用命令                                                                                  用途

------

helm list                                                                                   看所有已安装的实例

------

helm status <名称>                                                                看某个实例的状态

------

helm get values <名称>                                                          看配置

------

helm get manifest <名称>                                                       看资源详情

------

helm history  <名称>                                                                看版本历史

------

helm uninstall <名称>                                                               删除Release创建的资源            

------

:zap:**一个小技巧**

如果只想删除但是保留历史记录（方便以后查看或回滚）

```shell
helm uninstall 名称  --keep-history

# 然后还可以看到历史：
helm history 名称
# status 会显示 uninstalled
```

### 3.helm常见状态

|       状态       |             含义              |
| :--------------: | :---------------------------: |
|     deployed     |         当前活跃版本          |
|   supereseded    |   曾经成功，已被新版本替代    |
|      failed      |           操作失败            |
| pending-install  |       安装中（卡住了）        |
| pending-upgrade  |       升级中（卡住了）        |
| pending-rollback |       回滚中（卡住了）        |
|   uninstalling   |            卸载中             |
|   uninstalled    | 已卸载（需要 --keep-history） |

