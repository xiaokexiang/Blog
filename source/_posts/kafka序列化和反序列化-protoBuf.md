---
title: kafka序列化和反序列化-protoBuf
date: 2018-06-17 16:36:59
tags: Kafka
categories:
- Kafka
---
## 含义

Google Protocol Buffer( 简称 Protobuf) 是 Google 公司内部的混合语言数据标准。
Protocol Buffers 是一种轻便高效的结构化数据存储格式，可以用于结构化数据串行化，或者说序列化。它很适合做数据存储或 RPC 数据交换格式。可用于通讯协议、数据存储等领域的语言无关、平台无关、可扩展的序列化结构数据格式。目前提供了 C++、Java、Python 三种语言的 API。
> Github：https://github.com/protocolbuffers/protobuf
> 基于C++的protoBuf：https://www.ibm.com/developerworks/cn/linux/l-cn-gpb/index.html

## 软件下载

* <a href="https://github.com/protocolbuffers/protobuf/releases">win版protoBuf解析工具</a>

## protoBuf编译文件

* 在解压出来的文件夹中bin/目录下新建文件example.proto

```java
  syntax = "proto2"; //指定proto的语法，不写默认是proto2

  package kafkaProtoBuf; //声明一个包名，用来防止不同消息类型的命名冲突，类似于nameSpace
  option java_package = "top.leejay.kafka.kafkaProtoBuf"; //指定编译的protoBuf文件的路径，必须和项目路径一直否则出错
  option java_outer_classname = "ExampleProto";  //指定protoBuf文件的编译后名称

  message Example{
    required int64 id = 1; // required：该值是必须要设置的
    required string name = 2;// repeated：该字段可以重复任意多次（包括0次），类似于list
    optional string email = 3; // optional ：该字段可以有0个或1个值(不超过1个)
    required int32 sex = 4;
}
```
* 打开CMD输入：
`protoc -I=C:\Desktop\protoc-3.6.1-win32 --java_out=C:\ C:\Desktop\protoc-3.6.1-win32\bin\Example.proto`
-I对应的是protoc.exe所在的文件路径，--java_out对应的是protoBuf编译后文件的输出路径，最后对应的是自定义protoBuf文件的路径
* 最后出现以protoBuf中定义的文件路径的文件夹及java文件

## 使用spring-kafka实现kafka发送接收

* 添加依赖
```java
       <!--protoBuf-->
        <dependency>
            <groupId>com.google.protobuf</groupId>
            <artifactId>protobuf-java</artifactId>
            <version>3.5.1</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.kafka</groupId>
            <artifactId>spring-kafka</artifactId>
        </dependency>
```
* 序列化
```java
@Slf4j
public class ProtoSerializer implements Serializer<ExampleProto.Example> {
    @Override
    public void configure(Map<String, ?> configs, boolean isKey) {

    }

    @Override
    public byte[] serialize(String topic, ExampleProto.Example data) {
        if (data == null) {
            log.error("data is null .....");
            return null;
        }
        return data.toByteArray();
    }

    @Override
    public void close() {

    }
}
```

* 反序列化
```java
public class ProtoDeserializer implements Deserializer<ExampleProto.Example> {
    @Override
    public void configure(Map<String, ?> configs, boolean isKey) {

    }

    @Override
    public ExampleProto.Example deserialize(String topic, byte[] data) {
        if (null == data || data.length <= 0) {
            return null;
        }
        ExampleProto.Example example;
        try {
            example = ExampleProto.Example.parseFrom(data);
        } catch (InvalidProtocolBufferException e) {
            throw new SerializationException("Error when deserializing byte[] to Example due to unsupported encoding!");
        }
        return example;
    }

    @Override
    public void close() {

    }
}
```
* kafkaAutoConfig
```java
  @Configuration
  @EnableKafka
  @EnableConfigurationProperties(KafkaProperties.class)
  public class KafkaAutoConfig {
    @Autowired
    private KafkaProperties kafkaProperties;

    /**
     * 构建kafka消费工厂
     */
    @Bean(name = "concurrentkafkaConsumerFactory")
    public ConcurrentKafkaListenerContainerFactory<String, ExampleProto.Example> kafkaFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, kafkaProperties.getBootstrapServers());
        configProps.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        configProps.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, ProtoDeserializer.class);
        configProps.put(ConsumerConfig.GROUP_ID_CONFIG, kafkaProperties.getGroupId());
        configProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, kafkaProperties.getAutoOffsetReset());
        ConcurrentKafkaListenerContainerFactory<String, ExampleProto.Example> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        ConsumerFactory<String, ExampleProto.Example> basicConsumerFactory = new DefaultKafkaConsumerFactory<>(
                        configProps,
                        new StringDeserializer(),
                        new ProtoDeserializer());
        factory.setConsumerFactory(basicConsumerFactory);
        return factory;
    }

    /**
     * 构建kafka生产者
     */
    @Bean(name = "kafkaProducer")
    public KafkaTemplate<String, String> kafkaTemplate() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, kafkaProperties.getBootstrapServers());
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ProtoSerializer.class);
        return new KafkaTemplate<>(new DefaultKafkaProducerFactory<>(configProps));
    }
}
```
* 测试类
```java
  @Component
  @Slf4j
  public class KafkaTest {

    @Resource(name = "kafkaProducer")
    private KafkaTemplate kafkaTemplate;

    /**
     * 消费数据
     */
    @KafkaListener(topics = {"${cvf.kafka.producerTopic}"}, containerFactory = "concurrentkafkaConsumerFactory")
    public void listenConsumer(ConsumerRecord<String, ExampleProto.Example> record) {
        ExampleProto.Example value = record.value();
        log.info("当前读取的数据是: {}", value);
    }

    /**
     * 发送数据
     */
    public void sendMessage() {
        ExampleProto.Example.Builder builder = ExampleProto.Example.newBuilder();
        builder.setEmail("123@qq.com");
        builder.setId(1L);
        builder.setName("protoBuf");
        builder.setSex(1);
        ExampleProto.Example build = builder.build();
        ListenableFuture sendResult = kafkaTemplate.send("lucky", build);
        // 添加回调
        sendResult.addCallback(o ->
                        log.info("send to success,msg：{}", build)
                , throwable ->
                        log.error("send to failed,msg：")
        );
    }
}
```
<font color="red">springboot集成的spring-kafka,构建消费工厂之后,通过kafkaListener注解实现持续监听的效果,等同于while(true)的poll效果</font>
