---
title: kafka消费者及配置详解
date: 2018-06-05 13:15:34
tags: Kafka
toc: true
categories:
- Kafka
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccmvpfgqj30gs08ggm2.jpg

---
## 消费者和消费群组
kafka消费者从属于消费群组，一个群组里面订阅的是**<font color="red" >同一个主题</font>**,每个消费者接受主题一部分分区的消息.

<img border="1" src="http://assets.processon.com/chart_image/5be25a1ee4b0ad314e803ffc.png" />
* 允许多个消费者群组消费同一个topic，每个群组都会收到全部的消息，不管有没有其他群组存在。
* 注意：在同一个消费者组中，不要让消费者的数量大于分区的数量，否则会出现有消费者无分区数据可消费。
<!-- more -->
## 协调器和分区再均衡

### 再均衡
分区的所有权从一个消费者转移到另外一个消费者，再均衡期间会导致整个群组一小段时间不可用，同时当前的读取状态丢失。

### 协调器
在 kafka-0.10 版本，Kafka 在服务端引入了组协调器(GroupCoordinator)，每个 Kafka Server 启动时都会创建一个 GroupCoordinator实例，**用于管理部分消费者组和该消费者组下的每个消费者的消费偏移量**。同时在客户端引入了消费者协调器(ConsumerCoordinator)，<font color="red">实例化一个消费者就会实例化一个 ConsumerCoordinator 对象</font>，ConsumerCoordinator 负责同一个消费者组下各消费者与服务端的 GroupCoordinator 进行通信。

## 协调器详解

### 群组协调器的作用(只有群组才有)

* 负责对其管理的组员(消费者)提交的相关请求进行处理
* <font color="red">与消费者之间建立连接，并从与之连接的消费者之间选出一个 leader</font>
* 当 leader 分配好消费者与分区的订阅关系后，会把结果发送给组协调器，组协调器再把结果返回给各个消费者
* <font color="red">管理与之连接的消费者的消费偏移量的提交，将每个消费者的消费偏移量保存到kafka的内部主题中(_consumer_topic)</font>
* <font color="red">通过心跳检测消费者与自己的连接状态</font>
* 启动组协调器的时候创建一个定时任务，用于清理过期的消费组元数据以及过去的消费偏移量信息

### 消费者协调器的作用

* 处理更新消费者缓存的 Metadata 请求
* <font color="red">向组协调器发起加入消费者组的请求</font>
* 对本消费者加入消费者前后的相应处理
* <font color="red">请求离开消费者组(例如当消费者取消订阅时)</font>
* 向组协调器发送提交偏移量的请求
* <font color="red">通过一个定时的心跳检测任务来让组协调器感知自己的运行状态</font>
* Leader消费者的 ConsumerCoordinator 还负责执行分区的分配，一个消费者组中消费者 leader 由组协调器选出，leader 消费者的 ConsumerCoordinator 负责消费者与分区的分配，然后把分配结果发送给组协调器，然后组协调器再把分配结果返回给其他消费者的消费者协调器，这样减轻了服务端的负担

### 消费者协调器和组协调器的交互：
  * 心跳
   * 消费者协调器通过和组协调器发送心跳来维持它们和群组的从属关系以及它们对分区的所有权关系。只要消费者以正常的时间间隔发送心跳，就被认为是活跃的，说明它还在读取分区里的消息。消费者会在轮询获取消息或提交偏移量时发送心跳。

   * 如果消费者停止发送心跳的时间足够长，会话就会过期，组协调器认为它已经死亡，就会触发一次再均衡。

   * 在 0.10 版本里，心跳任务由一个独立的心跳线程来执行，可以在轮询获取消息的空档发送心跳。这样一来，发送心跳的频率（也就是组协调器群检测消费者运行状态的时间）与消息轮询的频率（由处理消息所花费的时间来确定）之间就是相互独立的。
   
   * 在0.10 版本的 Kafka 里，可以指定消费者在离开群组并触发再均衡之前可以有多长时间不进行消息轮询，这样可以避免出现活锁（livelock），比如有时候应用程序并没有崩溃，只是由于某些原因导致无法正常运行。这个配置与session.timeout.ms 是相互独立的，后者用于控制检测消费者发生崩溃的时间和停止发送心跳的时间。

  * 分区再均衡
   发生分区再均衡的3种情况：
    * 一个新的消费者加入群组时，它读取的是原本由其他消费者读取的消息。
    * 当一个消费者被关闭或发生崩溃时，它就离开群组，原本由它读取的分区将由群组里的其他消费者来读取。如果一个消费者主动离开消费组，消费者会通知组协调器它将要离开群组，组协调器会立即触发一次再均衡，尽量降低处理停顿。如果一个消费者意外发生崩溃，没有通知组协调器就停止读取消息，组协调器会等待几秒钟，确认它死亡了才会触发再均衡。在这几秒钟时间里，死掉的消费者不会读取分区里的消息。
    * 在主题发生变化时，比如管理员添加了新的分区，会发生分区重分配。
	
   <font color="red">分区的所有权从一个消费者转移到另一个消费者，这样的行为被称为分区再均衡</font>。再均衡非常重要，它为消费者群组带来了高可用性和伸缩性（我们可以放心地添加或移除消费者），不过在正常情况下，我们并不希望发生这样的行为。<font color="red">在再均衡期间，消费者无法读取消息，造成整个群组一小段时间的不可用。另外，当分区被重新分配给另一个消费者时，消费者当前的读取状态会丢失，它有可能还需要去刷新缓存，在它重新恢复状态之前会拖慢应用程序</font>。

  * leader 消费者分配分区的策略 

    * 当消费者要加入群组时，它会向群组协调器发送一个 JoinGroup 请求。<font color="red">第一个加入群组的消费者将成为leader消费者</font>。leader消费者从组协调器那里获得群组的成员列表（列表中包含了所有最近发送过心跳的消费者，它们被认为是活跃的），并负责给每一个消费者分配分区。

    * <font color="green">每个消费者的消费者协调器在向组协调器请求加入组时，都会把自己支持的分区分配策略报告给组协调器(轮询或者是按跨度分配或者其他)，组协调器选出该消费组下所有消费者都支持的的分区分配策略发送给leader消费者，leader消费者根据这个分区分配策略进行分配。</font>

    完毕之后，leader消费者把分配情况列表发送给组协调器，消费者协调器再把这些信息发送给所有消费者。每个消费者只能看到自己的分配信息，只有leader消费者知道群组里所有消费者的分配信息。这个过程会在每次再均衡时重复发生。
<img border="1"  src="http://assets.processon.com/chart_image/5be285fee4b0ee7475725a7b.png"/>
> 参考资料： https://cloud.tencent.com/developer/article/1336570 & kafka权威指南

## 轮询
一旦消费者订阅了主题，轮询就会处理所有细节，包括：群组协调，分区再均衡，发送心跳和获取数据

``` java
    try {
            // 消费者订阅topic
            kafkaConsumer.subscribe(Collections.singletonList("lucky"));
            for (; ; ) {
                /**
                 * 1.每次轮询间隔0.1s,在次时间内等待服务器返回数据
                 * 2.新消费者的第一次轮询期间会发生包括:加入群组,接受分配的分区,再均衡和心跳,都是在轮询期间发生
                 */
                ConsumerRecords<String, String> recorders = kafkaConsumer.poll(100);
                Map<String, Integer> recorderMap = Maps.newHashMap();
                for (ConsumerRecord<String, String> recorder : recorders) {
                    log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                            recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
                    int updateCount = 1;
                    if (recorderMap.containsKey(recorder.value())) {
                        updateCount = recorderMap.get(recorder.value()) + 1;
                    }
                    recorderMap.put(recorder.value(), updateCount);
                    System.out.println(JSONObject.toJSON(recorderMap));
                }
            }
        } finally {
            // 关闭消费者，会立即触发一次再均衡
            kafkaConsumer.close();
        }
    }
```
## 消费者配置参数详解

* fetch.min.bytes：
<font color="red">消费者从服务器获取记录的最小字节数</font>。broker判断当前可用的数据量小于此参数的指定的大小，会等到数据量足够再返回。

* fetch.max.wait.ms：
<font color="red">结合fetch.min.bytes参数，指broker的等待时间</font>，要么就返回fetch.min.bytes参数指定的大小，要么就在延时满足后返回当前的数据，看哪个条件先满足，建议设的小一些，满足SLA降低潜在延时.

* max.partition.fetch.bytes：
<font color="red">指定了服务器从每个分区里返回给消费者的最大字节数，默认值是1MB</font>，poll()方法从每个分区里面返回的数据不能超过此参数设置的大小，假如有10个分区和5个消费者，此参数值为1MB，则每个消费者至少需要2MB的内存，建议多设置些防止消费者崩溃，其他消费者承担更多的分区消费任务。<font color="red">此参数必须 > max.message.size(broker接收最大字节数)，否则会出现消费者无法消费完整消息，一直重试，但无法解决该非临时性错误</font>，<font color="green">如果此参数值过大，消费者处理消息时间过长，来不及下一次轮询，会导致会话过期或者再均衡，也可以通过设置会话过期时间来避免</font>。

* session.timeout.ms：
<font color="red">指定了消费者在被认为死亡之前可以与服务器断开连接的时间，默认3s</font>。如果消费者在此参数的设置时间之内没有发送心跳给群组协调器，会被认为已死亡。<font color="red">可以理解成消费者可以多久不发送心跳。此参数值<默认值，会导致意外的再均衡，此参数>默认值，可以更快的检测到崩溃的节点</font>。

* heartbeat.interval.ms：
指定了poll()方法向协调器发送心跳的频率，默认是session.timeout.ms的三分之一。

* auto.offset.reset：
<font color="green">指定了消费者在读取一个没有偏移量或者偏移量无效的情况下该如何处理，默认值是latest（从最新记录开始读取），另一个值是earliest（从起始位置读取）</font>。

* enable.auto.commit：
在下一章详解。

* partition.assignment.strategy：
分区分配策略，由PartitionAssignor实现分区分配给消费者，kafka有两个默认分配策略：
  * Range(org.apache.kafka.clients.consumer.RangeAssignor)
    主题内的分区个数是奇数，同时使用了Range策略，第一个消费者可能会比第二个消费者分到更多的分区。
  * RoundRobin(org.apache.kafka.clients.consumer.RoundRobinAssignor)
    一般来说如果所有消费者都订阅相同的主题，RoundRobin会给所有消费者分配相同数量的分区（或最多就差一个分区）。

* client.id：
该属性可以是任意字符串，broker用它来识别从客户端传过来的消息，用于日志，度量指标和配额里。

* max.poll.records：
<font color="green">该属性用于控制单次调用call()方法能够返回的记录数量，可以控制在轮询里需要处理的数据量。</font>


## 提交和偏移量
### 提交
更新分区当前位置的操作

### 偏移量
_customer_offset这个特殊主题中包含每个分区的偏移量，用于消费者从偏移量指定的地方继续处理，不同的提交方式会导致消息者读取消息丢失或者重复读。

### 自动提交：
<font color="red">消费者自动提交偏移量，enable.auto.commit设为true，提交间隔由auto.commit.interval.ms控制，默认是5s</font>。自动提交在轮询期间进行，消费者每次进行轮询时会检查是否该提交偏移量了，如果是就会提交上一次轮询返回的偏移量。会导致情况：<font color="green">在默认5s的期间发生再均衡，新消费者还是会按照上次轮询的偏移量消费，导致消息重复消费</font>。

### 手动提交
手动提交偏移量，解决消息丢失，减少消费重复消费。
```java
       for (; ; ) {
            ConsumerRecords<String, String> recorders = kafkaConsumer.poll(100);
            for (ConsumerRecord<String, String> recorder : recorders) {
                log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                        recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
            }
            try {
                // 只要没有发生不可恢复的错误，commitSync()方法会一直尝试直到提交成功，未得到broker回应前会一直阻塞
                kafkaConsumer.commitSync();
            } catch (CommitFailedException e) {
                log.error(e.getMessage());
            }
        }
```

### 异步提交
相对commitSync(),commitAsync()提交错误不会进行重试,但是支持回调，因为异步重试，会导致重复消息（<font color="red">假设第一个请求提交偏移量2000，但是因为通信问题，后一个提交请求3000已经提交成功，此时会导致第一个请求会覆盖第二个请求，这个时候出现再均衡，会导致消息重复消费</font>）。
```java
      for (; ; ) {
            ConsumerRecords<String, String> recorders = kafkaConsumer.poll(100);
            for (ConsumerRecord<String, String> recorder : recorders) {
                log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                        recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
            }
            try {
                // 异步提交失败不会进行重试，支持回调OffsetCommitCallback
                kafkaConsumer.commitAsync((offsets, exception) -> {
                    if (null != exception) {
                        log.error("Commit failed for offsets {}", offsets, exception);
                    }
                });
            } catch (CommitFailedException e) {
                log.error(e.getMessage());
            }
        }
```
实现重试异步提交的思路：
1.实现一个单调递增的序列维护异步提交的顺序。
2.每次异步提交在回调里面递增序列号。
3.重试之前，先检查回调的序列号和即将提交的偏移量是否相等。
4.相等即可安全的重试否则说明已有新偏移量提交。

### 同步和异步组合提交
```java
      try {
            for (; ; ) {
                ConsumerRecords<String, String> recorders = kafkaConsumer.poll(100);
                for (ConsumerRecord<String, String> recorder : recorders) {
                    log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                            recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
                }
                // 每一次消费后都异步提交一次offset，即使这次失败，下次也可能会成功
                kafkaConsumer.commitAsync();
            }
        } catch (Exception e) {
            log.error(e.getMessage());
        }finally {
            try {
                // 关闭消费者会签同步提交会一直重试，知道提交成功或者发生无法恢复的错误
                kafkaConsumer.commitSync();
            }finally {
                kafkaConsumer.close();
            }
        }
```
### 提交特定的偏移量
commitSync和commitAsync只会提交最后一个偏移量，可以通过提交特定偏移量实现
```java
        // 用于跟踪偏移量的map
        Map<TopicPartition, OffsetAndMetadata> currentOffset = Maps.newHashMap();
        int count = 0;
        for (; ; ) {
            ConsumerRecords<String, String> recorders = kafkaConsumer.poll(100);
            for (ConsumerRecord<String, String> recorder : recorders) {
                log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                        recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
                currentOffset.put(new TopicPartition(recorder.topic(), recorder.partition()),
                        new OffsetAndMetadata(recorder.offset() + 1, "no metadata"));
                // 每1000次提交一次偏移量
                if (count % 1000 == 0) {
                    kafkaConsumer.commitAsync(currentOffset, (offsets, exception) -> {
                        if (null != exception) {
                            log.error(exception.getMessage());
                        }
                    });
                    count++;
                }
            }
        }
```
## 再均衡监听器

只有触发再均衡操作，才会生效此监听器。通过实现ConsumerRebalanceListener接口，有两个实现方法：
``` java
onPartitionRevoked(Collection <TopicPartition> partitons）
```

此方法会在<font color="red">再均衡之前和消费者停止读取消息之后</font>被调用,在这里提交偏移量，下一个消费者就知道从哪里开始消费。
```java
   /**
     * 构建跟踪偏移量的map
     */
    private Map<TopicPartition, OffsetAndMetadata> currentOffset = Maps.newHashMap();

    /**
     * 再均衡接口实现监听
     */
    private class HandleRebalance implements ConsumerRebalanceListener {

        /**
         * 再均衡之前,停止读取消息之后，在此提交偏移量，下个消费者可以直接读取
         */
        @Override
        public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
            System.out.println("Lost partitions in rebalance, Committing current");
            // 提交的是最近处理的偏移量,而不是这个批次中正在处理的最后一个偏移量
            kafkaConsumer.commitSync(currentOffset);
        }

        /**
         * 重新分配分区之后,开始读取消息之前
         */
        @Override
        public void onPartitionsAssigned(Collection<TopicPartition> partitions) {

        }
    }
    /**
     * 使用同步和异步组合方式提交,结合再均衡之前,停止消费消息之后提交偏移量
     */
    @Test
    public void rebalanceListener() {
        try {
            // 一定要把ConsumerRebalanceListener对象传递给subscribe
            kafkaConsumer.subscribe(Collections.singletonList("lucky"), new HandleRebalance());
            for (; ; ) {
                ConsumerRecords<String, String> recorders = kafkaConsumer.poll(100);
                for (ConsumerRecord<String, String> recorder : recorders) {
                    log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                            recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
                    currentOffset.put(new TopicPartition(recorder.topic(), recorder.partition()),
                            new OffsetAndMetadata(recorder.offset() + 1, "no metadata"));
                }
            }
        } catch (WakeupException e) {
            // 忽略异常,正在关闭消费者
        } catch (Exception e) {
            log.error("Unexpected error", e);
        } finally {
            try {
                kafkaConsumer.commitSync(currentOffset);
            } finally {
                kafkaConsumer.close();
                log.info("Closed consumer and we are done");
            }
        }
    }
```

``` java
onPartitionAssigned(Collection <TopicPartition> partitons）
```
此方法会在<font color="red">重新分配分区之后和消费者开始读取消息之前</font>被调用

## 特定偏移量处开始处理
* 再均衡监听器及时保存偏移量，结合seek(partition，offset)可以指定消费者从正确的位置开始消费。
```java
kafkaConsumer.seek(new TopicPartition(topicName,0),offset);
```

## 如何退出循环
通过另一个线程调用consumer.wakeup()方法，此方法是消费者唯一一个可以从其他线程里安全调用的方法。可以退出poll()并抛出WakeUpException，无需处理，只是跳出循环的一种方式。如果是主线程，在shutdownHook()中调用该方法。
源代码： http://bit.ly/2u47e9A
```java
@Slf4j
public class SimpleMovingAvgNewConsumer {
    private Properties kafkaProps = new Properties();
    private String waitTime;
    private KafkaConsumer<String, String> consumer;

    private void Configure(String servers, String groupId) {
        kafkaProps.put("group.id", groupId);
        kafkaProps.put("bootstrap.servers", servers);
        kafkaProps.put("auto.offset.reset", "earliest");
        kafkaProps.put("key.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        kafkaProps.put("value.deserializer", "org.apache.kafka.common.serialization.StringDeserializer");
        consumer = new KafkaConsumer<>(kafkaProps);
    }

    /**
     * 主线程，退出需要调用shutdownHook,其他线程使用wakeup()
     */
    public static void main(String[] args) {
        if (args.length == 0) {
            System.out.println("SimpleMovingAvgZkConsumer {brokers} {group.id} {topic} {window-size}");
            return;
        }
        final SimpleMovingAvgNewConsumer movingAvgNewConsumer = new SimpleMovingAvgNewConsumer();
        String brokers = args[0];
        String groupId = args[1];
        String topic = args[2];
        // 构建kafkaConsumer
        movingAvgNewConsumer.Configure(brokers, groupId);
        // 构建主线程
        final Thread mainThread = new Thread();
        // 构建shutdownHook 可以干净的退出
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("Starting exit ....");
            // shutdownHook是一个单独的线程,所以consumer通过wakeup()安全退出
            movingAvgNewConsumer.consumer.wakeup();
            try {
                // join只有在start后才会同步,在A线程中B线程join,会先执行完B再执行A
                mainThread.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }));
        try {
            movingAvgNewConsumer.consumer.subscribe(Collections.singletonList(topic));
            // 循环直到ctrl+c ,shutdownHook将会在退出时清理干净
            for (; ; ) {
                ConsumerRecords<String, String> records = movingAvgNewConsumer.consumer.poll(1000);
                System.out.println(System.currentTimeMillis() + "-- waiting for data...");
                for (ConsumerRecord<String, String> recorder : records) {
                    log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                            recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
                    for (TopicPartition tp : movingAvgNewConsumer.consumer.assignment()) {
                        System.out.println("Committing offset at position:" + movingAvgNewConsumer.consumer.position(tp));
                    }
                    movingAvgNewConsumer.consumer.commitSync();
                }
            }
        } catch (WakeupException e) {
            //忽略此异常
        } finally {
            movingAvgNewConsumer.consumer.close();
            System.out.println("Closed consumer and we are done");
        }
    }
}
```
## 反序列化器
查看使用protobuf实现正反序列化blog：
## 独立的消费者
如果是一个消费者从一个主题的所有分区或者某个特定的分区读取数据，只需要把主题或者分区分配给消费者，然后读取消息并提交偏移量。一个消费者可以订阅主题或者为自己分配分区，但是二者不能同时。
```java
        List<PartitionInfo> partitionInfos;
        //返回当前主题下的所有分区,如果读取特定分区,不需要查询只需要构建TopicPartition时传入指定主题&分区即可
        partitionInfos = kafkaConsumer.partitionsFor("lucky");
        List<TopicPartition> partitions = Lists.newArrayList();
        if (null != partitionInfos) {
            for (PartitionInfo partitionInfo : partitionInfos) {
                partitions.add(new TopicPartition(partitionInfo.topic(), partitionInfo.partition()));
                // 调用assign方法分配分区
                kafkaConsumer.assign(partitions);
                for (; ; ) {
                    ConsumerRecords<String, String> recorders = kafkaConsumer.poll(1000);
                    for (ConsumerRecord<String, String> recorder : recorders) {
                        log.info("当前消费者获取的信息: 分区是{},主题是: {},偏移量是: {},key是: {},值是: {}",
                                recorder.partition(), recorder.topic(), recorder.offset(), recorder.key(), recorder.value());
                    }
                    kafkaConsumer.commitSync();
                }
            }
        }
```
<font color="red">如果添加了分区，消费者不会接收到通知，所以需要周期性的调用partitionFor()方法来检查是否有新分区加入或者添加后重启应用程序，启动群组协调器</font>。









