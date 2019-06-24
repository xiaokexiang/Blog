---
title: 安装kafka及配置详解
date: 2018-05-26 11:01:48
tags: Kafka
toc: true
categories:
- Kafka
thumbnail: http://ww1.sinaimg.cn/mw690/70ef936dly1g4a094xacdj20gs08g0ta.jpg
---
## linux上安装kafka
* 启动一个完整的kafka需要jdk8,kafka(发行版自带zookeeper),zookeeper(保存集群的元数据和消费者信息)
* 安装及启动命令
  * 启动zookeeper
  ``` bash 
  ./bin/zkServer.sh start
  ```
  * 查看端口
  ``` bash 
  telnet localhost 2181 输入srvr出现zooke相关信息 
  ```
  * 启动kafka
  ``` bash
  ./bin/kafka-server-start.sh -daemon config/server.properties 
  ```
  * 创建topic <font color="red">partitions指定topic分区数，replication-factor指定topic每个分区的副本数</font>
  ``` bash
   ./bin/kafka-topics.sh —create —zookeeper localhost 2181 —replication-factor 1 —partitions 1 —topic lucky 
   ```
  * 发送消息 <font color="red">这里的hostname 要和配置文件中一致</font>
  ```./bin/kafka-console-producer.sh —broker-list 192.168.0.106:9092 —topic lucky ```
  * 查看topic信息
  ``` bash
  ./bin/kafka-topics.sh —zookeeper localhost 2181 —describe —topic lucky 
  ```
  * 消費消息
  ``` bash
  ./bin/kafka-console-consumer.sh —zookeeper localhost:2181 —topic lucky —from-beginning
  ```

<!-- more -->
## broker配置详解
* broker.id：
每一个broker在集群中的唯一表示，要求是正数。当该服务器的IP地址发生改变时，broker.id没有变化，则不会影响consumers的消息情况
* port
默认监听9092端口
* zookeeper.connect
zookeeper的地址，默认是localhost:2181
* log.dirs
kafka数据的存放地址，多个地址的话用逗号分割/data/kafka-logs-1，/data/kafka-logs-2
* num.recovery.threads.per.data.dir
kafka使用可配置的线程池来处理日志片段，参数设置合理可以减少日志片段恢复时间。
    * 服务器正常启动时，用于打开每个分区的日志片段
    * 服务器崩溃后重启，用于检查和街区每个分区的日志片段
    * 服务器正常关闭，用于关闭日志片段

如果此参数值为8，log.dirs指定了三个路径，那总共需要24个线程。
* auto.create.topics.enable
当此参数为true，kafka会在以下几种情况下自动创建主题：
    * 当一个生产者开始往主题里写入消息时
    * 当一个消费者开始从主题读取消息时
    * 当任意一个客户端开始向主题发送元数据请求时



## 主题配置详解
* num.partitions
此参数指定了新创建的主题将包含多少个分区，如果启用了主题自动创建功能（默认启动），主题分区的个数就是此参数的值（默认是一个），基于负载均衡，分区的个数必须大于broker的个数。
* log.retention.ms
效果和log.retention.hour & log.retention.minutes一样，默认使用hour参数来配置，此参数决定数据可以被保存多久，默认是168小时，如果这三个参数都指定了值，默认取最小的那个参数。
* log.retention.bytes
指定了每个分区的保留的最大消息字节数，如果一个主题有8个分区，此参数设置为lGB，那么这个主题可以保存8G的消息数据。超出部分会被删除，和log.retention.ms数据谁先满足，就会按照谁的要求删除消息数据。
* log.segment.bytes
此参数指定日志片段的大小，满足之后会关闭当前日志片段，开启一个新的日志片段，此参数值越小，磁盘的IO越平凡，降低磁盘的整体效率。:bangbang:只有当日志片段关闭之后，消息才会进入过期流程，此时log.retention.ms/log.retention.bytes才会发生作用。
* log.segment.ms
指定日志片段关闭的时长，没有默认值，所以默认关闭日志片段是由大小决定的。
* message.max.bytes
此参数限制单个消息的大小，默认是1MB（压缩后大小），如果生产者发送消息大于此参数值，消息不会接受，还会收到broker返回的错误信息。
:bangbang:需要注意的是，如果消费者的fetch.message.max.bytes 值小于此参数，那么消费者就无法消费完全，会出现阻塞的问题。
