---
title: "Kafka 基础与实践"
date: 2026-08-24
categories: ["运维"]
subcategory: "Kafka"
tags: ["消息队列"]
---

### 1. 什么是 Kafka？

* **官方定义**：**Apache Kafka 是一个开源的**分布式事件流处理平台（Distributed Event Streaming Platform）**，用于高性能数据管道，流分析，数据集成和关键任务应用。

* **自己的理解**：**Kafka 就是企业架构里面**超大型、带磁盘持久化、绝不宕机的中央邮局** 各个业务系统（微服务）不再互相直接通信，而是把数据统统扔进 Kafka，谁想看谁就自己去订阅

### 2. 核心概念

#### 2.1 Topic（主题）

⚡**topic**（主题）是消息的逻辑分类，类似于数据库中的 '表 '，生产者向**topic** 发送消息，消费者从 **topic** 读取消息

```shell
# 创建topic
5eb5fd28f875:/# /opt/kafka/bin/kafka-topics.sh --create --topic 0325-topic --partitions 3 --repli
cation-factor 1 --bootstrap-server localhost:9092
Created topic 0325-topic.

# 查看已存在的topic
5eb5fd28f875:/# /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
0325-topic
test-topic
```

#### 2.2 Partition（分区）

:zap:**Partition** （分区）是 **Topic** 的物理分片，每个 **Topic** 可以拆分为多个 **Partition**，分布在不同的 **Broker** 上，实现并行处理和水平扩展

```shell
5eb5fd28f875:/opt/kafka/bin# bash kafka-topics.sh --describe --bootstrap-server localhost:9092 --topic test-topic
Topic: test-topic       TopicId: MKgT9jRQRAa3wDKenv8x2w PartitionCount: 3       ReplicationFactor: 3    Configs: 
        Topic: test-topic       Partition: 0    Leader: 1       Replicas: 1,2,3 Isr: 2,3,1
        Topic: test-topic       Partition: 1    Leader: 2       Replicas: 2,3,1 Isr: 2,3,1
        Topic: test-topic       Partition: 2    Leader: 3       Replicas: 3,1,2 Isr: 3,2,1
```

#### 2.3 Offset（偏移量）

:zap:**Offset**（偏移量）是消息在某个**Partition**中的唯一序号，单调递增，消费者通过记录 **Offset** 来追踪自己读到了哪条消息

```shell
/opt/kafka/bin/kafka-consumer-groups.sh --describe --bootstrap-server localhost:9092 --group my-ops-group
```

#### 2.4 Consumer Group（消费组）

:zap:Consumer Group（消费组）是一组共同消费同一个topic的消费实例，组内每个Partition 只会被一个消费者消费，实现负载均衡；不同的 Consumer Group 之间相互独立，互不影响

是这样的：

> 消费组无需手动创建，当消费者启动并指定 `group.id` 后，Kafka 会自动创建对应的消费组。

```shell
# 创建一个消费者，并绑定消费者
/opt/kafka/bin/kafka-console-consumer.sh --topic test-topic --bootstrap-server localhost:9092 --group my-ops-group --from-beginning

# 列出所有的消费组
5eb5fd28f875:/# /opt/kafka/bin/kafka-consumer-groups.sh --list --bootstrap-server localhost:9092
my-ops-group

# 查看某个消费组的详细信息
bash kafka-consumer-groups.sh --describe  --bootstrap-server localhost:9092 --group my-ops-group
```

