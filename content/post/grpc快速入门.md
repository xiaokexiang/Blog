---
title: "Grpc快速入门"
date: 2022-04-22T16:29:25+08:00
description: "grpc是一款高性能、开源的通用Rpc框架"
tags: ["grpc "]
categories: [
  "grpc"
]
hideReadMore: true
---

## Grpc快速入门

> <a href="https://grpc.io/">grpc</a>是一款高性能、开源的通用Rpc框架。由google开源，默认使用<a href="https://github.com/protocolbuffers/protobuf">protobuf</a>作为定义接口的语言(IDL)和底层的消息交换格式，使用Http/2作为传输协议。

---

### Rpc简介

Rpc(remote procedure call)，即远程过程调用。服务器A上的服务想调用服务器B上的服务提供的方法，因为不存在于同一个内存空间，不能直接调用，需要通过网络来表达调用的语义和传达调用的数据。

> Rpc像调用本地方法一样去调用远程方法。

#### Http与Rpc

Rpc是一个完整的远程调用方法，通常包括通信协议（http和tcp）和序列化协议（json、xml、protobuf等）。

#### Http与Tcp

为什么使用自定义tcp协议实现进程通信？

http传输协议头中包含冗余的部分，且使用了文本编码（body仍是二进制编码），非常占用字节数。使用自定义tcp协议，能够有效提升传输效率，提升性能。

#### Grpc与Restful

|              |     Grpc     |    Restful     |
| :----------: | :----------: | :------------: |
| **消息编码** |   protobuf   |      json      |
| **传输协议** |    Http/2    |      Http      |
| **传输形式** | 支持流式传输 | 不支持流式传输 |

---

### Grpc概述

![](https://grpc.io/img/landing-2.svg)

> - 使用protobuf作为IDL和底层消息的交换格式。
> - protobuf支持多种语言，所以Grpc也是跨语言的。
> - 客户端持有存根(Stub)提供与服务器相同的方法。

---

### Grpc-Java

使用Java语言作为客户端和服务端的语言来演示grpc的实现。

#### pom配置

```xml
<dependency>
    <groupId>io.grpc</groupId>
    <artifactId>grpc-netty-shaded</artifactId>
    <version>1.45.1</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.grpc</groupId>
    <artifactId>grpc-protobuf</artifactId>
    <version>1.45.1</version>
</dependency>
<dependency>
    <groupId>io.grpc</groupId>
    <artifactId>grpc-stub</artifactId>
    <version>1.45.1</version>
</dependency>
<dependency> <!-- necessary for Java 9+ -->
    <groupId>org.apache.tomcat</groupId>
    <artifactId>annotations-api</artifactId>
    <version>6.0.53</version>
    <scope>provided</scope>
</dependency>

<build>
    <extensions>
        <extension>
            <groupId>kr.motd.maven</groupId>
            <artifactId>os-maven-plugin</artifactId>
            <version>1.6.2</version>
        </extension>
    </extensions>
    <plugins>
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
            <configuration>
                <excludes>
                    <exclude>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </exclude>
                </excludes>
            </configuration>
        </plugin>
        <plugin>
            <groupId>org.xolstice.maven.plugins</groupId>
            <artifactId>protobuf-maven-plugin</artifactId>
            <version>0.6.1</version>
            <configuration>
         <protocArtifact>com.google.protobuf:protoc:3.19.2:exe:${os.detected.classifier}</protocArtifact>
                <pluginId>grpc-java</pluginId>
                <pluginArtifact>io.grpc:protoc-gen-grpc-java:1.45.1:exe:${os.detected.classifier}</pluginArtifact>
                <!-- 此处填写你编写protobuf文件的路径 -->
                <protoSourceRoot>src/main/resources/proto</protoSourceRoot>
            </configuration>
            <executions>
                <execution>
                    <goals>
                        <goal>compile</goal>
                        <goal>compile-custom</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```



#### protobuf文件

```protobuf
syntax = "proto3";
option java_multiple_files = true; // 内部类、枚举、服务不会以内部类的形式出现
option java_package = "top.leejay.grpc.hello"; // 包名
option java_outer_classname = "HelloProto"; // 生成的java类文件的名称

service Hello {
  rpc SayHello (HelloRequest) returns (HelloResponse) {}
}

message HelloRequest {
  string name = 1;
}

message HelloResponse {
  string message = 1;
}
```

> 此protobuf定义了：client传入name，server返回message。

#### 生成java文件

执行maven命令：`mvn clean compile`。

![](https://image.leejay.top/Fg5pzhGGmlFanQW-Rk4hwWZhNPLq)

> 编译后的文件在target目录下，如上图所示。

#### 服务端

```java
public class GrpcServer extends HelloGrpc.HelloImplBase {

    @Override
    public void sayHello(HelloRequest request, StreamObserver<HelloResponse> responseObserver) {
        HelloResponse message = HelloResponse.newBuilder().setMessage("你发送的信息是: " + request.getName()).build();
        responseObserver.onNext(message);
        responseObserver.onCompleted();
    }

    public static void main(String[] args) throws IOException, InterruptedException {
        Server server = ServerBuilder.forPort(10010)
                .addService(new GrpcServer())
                .build()
                .start();
        System.out.println("grpc服务端已启动，监听端口: 10010");
        server.awaitTermination(); // wait等待请求
    }
}
```

#### 客户端

```java
public class GrpcClient {

    private final ManagedChannel channel;

    private final HelloGrpc.HelloBlockingStub stub;

    public GrpcClient(String host, int port) {
        ManagedChannel channel = ManagedChannelBuilder.forAddress(host, port).usePlaintext().build();
        this.channel = channel;
        this.stub = HelloGrpc.newBlockingStub(channel);
    }

    public String sayHello(String name) {
        HelloRequest request = HelloRequest.newBuilder().setName(name).build();
        HelloResponse response = stub.sayHello(request);
        return response.getMessage();
    }

    public void shutdown() {
        channel.shutdown();
    }

    public static void main(String[] args) {
        GrpcClient client = new GrpcClient("127.0.0.1", 10010);
        String message = client.sayHello("Hello World");
        System.out.println("从服务端获取返回数据: " + message);
        client.shutdown();
    }
}
```

#### 基于postman的客户端

![](https://image.leejay.top/FvBldfku-Txj6XE9qKpS3X5-OA5C)

