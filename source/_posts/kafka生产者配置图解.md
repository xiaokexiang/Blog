---
title: kafka生产者配置图解
date: 2018-06-03 12:55:15
tags: Kafka
categories:
- Kafka
---
## kafka生产者配置图解
<iframe id="embed_dom" name="embed_dom" frameborder="1" style="display:block;width:700px; height:551px;" src="https://www.processon.com/embed/5bdbfc15e4b0fc2dc1a75278">
</iframe>

## 生产者配置详解

### acks
此参数指定了多少个分区副本收到消息，生产者才会认为消息的写入是成功的
``` bash
 acks=0，生产者在成功写入消息之前不会等待任何来自服务器的响应
 acks=1，只要集群的首领节点收到消息，生产者就会一个来自服务器的成功响应。
 acks=all，只有当所有参与复制的节点全部收到消息时，生产者才会收到一个来自服务器的成功响应
```
### buffer.memory
此参数设置生产者内存缓冲区的大小，发送消息会先发送到缓冲区，如果此参数过小，会导致消息发送阻塞。

### block.on.buffer.full
此参数表示在跑出异常之前可以阻塞多久，结合buffer.memory使用，在0.9版本之后换成了max.block.ms

### compression.type
压缩算法，由snappy、gzip、lz4

### retries
此参数决定了生产者可以重发消息的次数，如果达到这个次数，生产者会放弃重试并返回错误，默认生产者会在每次重试之间等待100ms（由retry.backoff.off决定），如果是临时性错误，可以通过重试实现。

### batch.size
当有多个消息需要被发送到同一个分区时，生产者会把他们放到同一个批次里面，该参数指定了一个批次可以使用的内存大小，此参数值越小，生产者需频繁发送消息，会增加额外的开销。batch.size基于字节数，并不是满了才会发送，此参数设置的大并不会导致延迟，只是会有更多内存。

### linger.ms
此参数指定了生产者在发送批次之前等待更多消息加入的时间，只有有可用的线程，哪怕批次里面只有一条信息也会发送出去，设置linger.ms更大，会增加延迟，也会提升吞吐量。

### client.id
服务器用于识别客户端的标识，是任意的字符串。

### max.in.filght.requests.per.connection
此参数指定了生产者在接收到服务器响应之前可以发送多少个消息。如果设置为1，可以保证消息的顺序性。

### max.block.ms
此参数指定了在调用send()方法或使用partitiFor()方法获取元数据时生产者的阻塞时间。当时间满足参数时会抛出异常。

### max.request.size
此参数用于控制生产者发送的请求大小，他可以指能发送的单个消息的最大值，也可以指单个请求里所有消息的总的大小。


