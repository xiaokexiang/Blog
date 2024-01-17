---
title: "Netty框架入门"
date: 2020-12-14T17:58:49+08:00
description: "网络编程框架: Netty结构、组件知识点入门。"
tags: ["Netty ", "NetWork"]
categories: [
  "Netty"
]
slug: netty
---

## Netty

> OIO：最开始表示为旧的输入/输出（Old I/O），后又可以理解为阻塞输入/输出（Block I/O）。
>
> NIO：最开始表示为新的输入/输出（New I/O），后又可以理解为非阻塞输入/输出（Non-Block I/O）。

### 核心组件

#### 组件概览

![](https://image.leejay.top/FoaBOgwzVOuNzRywEDPxFkExNsLp)

#### Channel

基于Socket的进一步封装，降低了Socket的复杂度。包含众多的实现：`NioSocketChannel`、`NioServerSocketChannel`等。

#### EventLoop

Netty的核心抽象，用于处理连接的生命周期中所发生的事件。

![](https://image.leejay.top/Fr14vBy5nx_nPDGN2DBd0CRVN_ay)

> 1. 一个EventLoopGroup包含一个或多个EventLoop。
> 2. 一个EventLoop在其生命周期中只和一个Thread绑定。该EventLoop处理的I/O都在该Thread上被处理。
> 3. 一个Channel在其生命周期中只会被注册到一个EventLoop中。
> 4. 一个EventLoop可以被分配个一个或多个Channel。
> 5. EventLoop执行任务时，会先判断当前`执行任务的线程是否是当前EventLoop的绑定线程`，不是则入队等待下一次处理。

```java
bootstrap.handle(new ChannelInitializer<SocketChannel>() {
    @Override
    protected void initChannel(SocketChannel ch) throws Exception {
        // 通过channel绑定的eventLoop来实现调度任务
        ch.eventLoop().scheduleAtFixedRate(
            () -> log.info("do something ..."),
            1L,
            1L,
            TimeUnit.SECONDS);
    });
```

> 使用Channel绑定的EventLoop实现定时任务调度。

#### ChannelFuture

因为Netty的操作都是异步的，基于`Future`的`ChannelFuture`的接口，添加`ChannelFutureListener`来实现某个操作完成时被通知。

> 同属于一个channel的操作都会被保证以它们`被调用的顺序`来执行。

#### ChannelHandler

用于处理`所有进出站的数据`的事件处理器。实现类包括`ChannelInboundHandler`、`ChannelOutboundHandler`。

```java
public interface ChannelHandler {}

public interface ChannelInboundHandler 
    	extends ChannelHandler {}

public class ChannelInboundHandlerAdapter 
    	extends ChannelHandlerAdapter implements ChannelInboundHandler {}

public abstract class SimpleChannelInboundHandler<I> 
    	extends ChannelInboundHandlerAdapter {}
```

#### ChannelPipeline

用于存储`ChannelHandler链`的容器。在应用程序初始化时（BootStrap引导）通过`ChannelInitializer`将自定义的`ChannelHandler`注册到`ChannelPipeline`中。

```java
public interface ChannelPipeline
        extends ChannelInboundInvoker, ChannelOutboundInvoker, 
				Iterable<Entry<String, ChannelHandler>> {}
```

> 接口的继承表明：ChannelPipeline可以处理`入站和出站`的ChannelHandler链。

```java
public class EchoClient {
    Bootstrap bootstrap = new Bootstrap()
        .handler(new ChannelInitializer<SocketChannel>() {
            @Override
            protected void initChannel(SocketChannel ch) {
                // 将自定义的ChannelHandler加入到ChannelPipeline的最后
                ch.pipeline().addLast(
                    new EchoClientHandlerFirst(), 
                    new EchoClientHandler(), 
                    new EchoClientHandlerLast());
            }
        });
}

@Slf4j
@ChannelHandler.Sharable
public class EchoClientHandlerFirst extends SimpleChannelInboundHandler<ByteBuf> {

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) throws Exception {
        log.info("EchoClientHandlerFirst received: {}", msg.toString(CharsetUtil.UTF_8));
        // 使用Unpooled.copiedBuffer()处理ByteBuf的release问题
        // 将msg传递到下个ChannelHandler
        ctx.fireChannelRead(Unpooled.copiedBuffer(msg));
    }
}

@Slf4j
@ChannelHandler.Sharable
public class EchoClientHandler extends SimpleChannelInboundHandler<ByteBuf> {

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) {
        // client接收到信息时被调用
        log.info("EchoClientHandler received: {}", msg.toString(CharsetUtil.UTF_8));
        ctx.fireChannelRead(Unpooled.copiedBuffer(msg));
    }
}

@Slf4j
@ChannelHandler.Sharable
public class EchoClientHandlerLast extends SimpleChannelInboundHandler<ByteBuf> {

    @Override
    protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) throws Exception {
        log.info("EchoClientHandlerLast received: {}", msg.toString(CharsetUtil.UTF_8));
    }
}
```

> 通过`handler方法`将ChannelPipeline绑定到bootstrap中，ChannelPipeline中的ChannelHandler的顺序由`添加时的顺序`决定。
>
> 即为：EchoClientHandlerFirst -> EchoClientHandler -> EchoClientHandlerLast。

![](https://image.leejay.top/Fuyanerz_JSEi_Msd-OOYXYxkjN-)

> 入站和出站是相对的，以上图为例：Server端入站即是Client端的出站，Server端的出站即是Client端的入站。
>
> 虽然ChannelInboundHandler和ChannelOutboundHandler都扩展自ChannelHandler，但是Netty能够保证`数据旨在具有相同的两个类型的ChannelHandler中传递。`

#### ChannelHandlerContext

作为参数传递由上一个ChannelHandler传递到下一个ChannelHandler中。包含

```java
@ChannelHandler.Sharable
public class EchoClientHandler extends SimpleChannelInboundHandler<ByteBuf> {

    @Override
    public void channelActive(ChannelHandlerContext ctx) {
        // channel是活跃时被调用
        ctx.writeAndFlush(Unpooled.copiedBuffer("Netty Rock", CharsetUtil.UTF_8));
        // 从下一个ChannelHandler开始流动
        ctx.fireChannelRead(Unpooled.copiedBuffer(msg));
        // 从第一个ChannelHandler开始流动
        // ctx.pipeline().fireChannelRead(Unpooled.copiedBuffer(msg));
    }
}
```

> 可以通过`ChannelHandlerContext`写入消息，消息会从`下一个ChannelHandler`开始流动。
>
> 如果是将消息写入`Channel`，那么会从`第一个ChannelHandler`开始流动。

#### Bootstrap

服务端和客户端采用了不同的引导，主要的区别在于：

1. 客户端Bootstrp连接到`远程的地址和端口`，而服务端则绑定到`本地的端口`。
2. 客户端只需要一个`EventLoopGroup`，而服务端需要两个，其中一个只包含`ServerChannel`，代表服务自身的已绑定到某个本地端口的正在监听的socket，另一个包含所有已创建的、用于传入客户端连接的channel。

```java
Bootstrap bootstrap = new Bootstrap();// client
ServerBootstrap bootstrap = new ServerBootstrap();// server
```

----

### Channel

#### Channel's API

![](https://image.leejay.top/FtELlIBc5Eva4RcRK9P30RL-QDES)

> Channel是`线程安全`的，在多线程下发送消息，其顺序由发送的顺序决定。

#### Channel的内置传输

- NIO

提供基于JDK的NIO进行封装的API，所有I/O操作都是异步的，其核心就是`Selector`选择器（和某个线程绑定），会在：`新的Channel已被接受且就绪`、`Channel连接已经完成`、`Channel有已就绪的可供读取的数据`、`Channel可用于写数据`时发出通知。

![](https://image.leejay.top/FvMwqVoSwPIQ8_wJTxUQfwoe5OZj)

- Epoll

基于Linux的Epoll特性（一个高度可扩展的I/O事件通知特性），相比原生的JDK-NIO有更强的性能，但执行流程与NIO相同。

- OIO

原生JDK中的BIO是阻塞实现，Netty利用了`SO_TIMEOUT`标识，当阻塞一定时长时，抛出`SocketTimeOut`异常并捕获该异常，并继续循环，在EventLoop下次运行时将再次尝试。

![](https://image.leejay.top/FnOwK-sLN9h3FvLyL7vI6ERsGWaW)

- Local

用于同一个JVM中运行的客户端和服务器程序之间的异步通信，它并没有绑定物理网络地址，不接受真正的网络流量。

- Embedded

将一组`ChannelHandler`作为帮助类嵌入到其他的`ChannelHandler`内部，而不需要去修改代码。

##### 总结

|          | Channel                  | EventLoopGroup      | 支持协议         | 使用需求                   |
| -------- | ------------------------ | ------------------- | ---------------- | -------------------------- |
| NIO      | NioServerSocketChannel   | NioEventLoopGroupNi | TCP/UDP/SCTP/UDT | 代码库中没有非阻塞调用     |
| Epoll    | EpollServerSocketChannel | EpollEventLoopGroup | TCP/UDP          | 相比NIO，在Linux上推荐使用 |
| OIO      | OioServerSocketChannel   | OioEventLoopGroup   | TCP/UDP/SCTP/UDT | 阻塞代码库（JDBC等）       |
| Local    | LocalServerChannel       | LocalEventLoopGroup | -                | 同一个JVM内部的通信        |
| Embedded | EmbeddedEventLoop        | EmbeddedChannel     | -                | 测试ChannelHandler的实现   |

---

### ByteBuf

**`ByteBuf`**是基于JDK原生的`ByteBuffer`封装而来的字节容器。通过`ByteBuf`抽象类和`ByteBufHolder`接口进行暴露。具有`自定义缓冲区类型扩展`、`基于零拷贝`、`按需增长`、`读写使用不同的索引`、`支持池化`等优点。

#### ByteBuf类

ByteBuf维护了两个不同的索引：读索引 & 写索引（这与ByteBuffer类不同，它只维护了一个索引），初始情况两者都为0，且不应超过capacity。ByteBuf可以指定一个初始容量，但最大不超过`Integer.MAX_VALUE`，内置的API中`以Read、Write开头的方法会推动索引变化，而get、set开头的则不会`。

##### ByteBuf的使用模式

- 堆缓冲区

将数据存储在JVM的堆空间中，又被称为`支撑数组`。其能在没有池化的情况下提供快速的分配与释放，适合有遗留数据需要处理的情况。

```java
public void dump() {
    ByteBuf byteBuf = ...;
    if (byteBuf.hasArray()) { // 判断是否有支撑数组
        byte[] array = byteBuf.array(); // 若有就获取该数组的引用
        int offset = byteBuf.arrayOffset() + byteBuf.readerIndex();  // 计算第一个字节的偏移量
        int length = byteBuf.readableBytes(); // 计算可读字节的长度
    }
}
```

- 直接缓冲区

自JDK1.4后允许JVM调用本地方法(native)来分配堆外内存(又称为直接内存)。主要是为了避免`I/O操作前后将缓冲区内容复制到一个中间缓冲区`。相比于`堆内缓冲区`，`直接缓冲区`的分配和释放都是昂贵的。

```java
public void direct() {
    ByteBuf directBuffer = Unpooled.directBuffer(16);
    if (!directBuffer.hasArray()) { // 判断是否有支撑数组
        // 还未读的字节大小
        int length = directBuffer.readableBytes();
        byte[] array = new byte[length];
        // 获取剩下的未读数据
        directBuffer.getBytes(directBuffer.readerIndex(), array);
    }
}
```

- 复合缓冲区

是多个`ByteBuf`的一个聚合视图，是JDK原生所没有的功能。此类型可以同时包含堆内缓冲区和直接缓冲区，如果只有一个ByteBuf的实例，那么`hasArray()`会返回该实例的`hasArray()`的值，否则返回false。

```java
public void composite() {
    CompositeByteBuf compositeByteBuf = Unpooled.compositeBuffer();
    // 添加堆内和堆外两种模式的数据
    compositeByteBuf.addComponents(
        Unpooled.directBuffer(16), Unpooled.copiedBuffer("Hello".getBytes()));
}
```

#### ByteBuf字节操作

![](https://image.leejay.top/FlQi0WTAq7pvHL8xIgMUQIYrPqcf)

> 1. 初始状态下：`readIndex = writeIndex = 0`，若`readIndex | writeIndex > capacity-1`或`readIndex > WriteIndex`，则会抛出`indexOutOfBoundException`。
> 2. 可丢弃字节，可以理解为已读字节，`[0, readIndex]`部分的字节已被全部读取，`(readIndex, writeIndex]`部分的字节可以被读取，`(writeIndex，capacity)`部分的字节尚未被写入。
> 3. 调用`discardReadBytes()`方法后会丢弃`已读字节`并回收他们，此时`readIndex`会被移动到缓冲区的开始位置。
> 4. `get/set`开头的方法不会修改index的位置，而`read/write`则会修改。

##### 派生缓冲区

```java
public void test() {
    // slice类似String的slice切分
    ByteBuf byteBuf = Unpooled.copiedBuffer("Netty in Action rocks!", CharsetUtil.UTF_8);
    ByteBuf sliceBuf = byteBuf.slice(0, 15);
    byteBuf.setByte(0, 'J');
    System.out.println(byteBuf.getByte(0) == sliceBuf.getByte(0));// true

    // copy方法会复制一份缓冲区的真是副本，复制出的ByteBuf具有独立的数据副本
    ByteBuf copyBuf = byteBuf.copy();
    byteBuf.setByte(0, 'N');
    System.out.println(byteBuf.getByte(0) == copyBuf.getByte(0));// false

    // duplicate返回一个新的ByteBuf实例，但是readIndex & writeIndex都是与原ByteBuf共享的
    ByteBuf duplicate = byteBuf.duplicate();
    byteBuf.setByte(0, 'J');
    System.out.println(byteBuf.getByte(0) == duplicate.getByte(0));// true

    // print 'J' index of byteBuf: 0
    System.out.println(byteBuf.indexOf(0, 15, "J".getBytes()[0]));
}
```

> 非特殊需要，`slice()`方法能满足就用该方法，避免`复制`带来的内存开销。

#### ByteBufHolder接口

`ByteBuf`的容器，为了满足除了基本的`ByteBuf`数据负载外，还要满足类似`HTTP`响应返回的各种属性值，`ByteBufHolder`包含`一个ByteBuf对象`，可以按需实现不同的需求。

```java
DefaultByteBufHolder byteBufHolder = new DefaultByteBufHolder(
    													Unpooled.copiedBuffer("hello".getBytes()));
```

#### ByteBuf分配

##### ByteBufAllocator

Netty基于ByteBufAllocator接口实现了ByteBuf的`池化`，它可以分配任意类型的ByteBuf实例。

```java
public void alloc() {
    // Netty默认的分配
    ByteBufAllocator allocator = new PooledByteBufAllocator();
    allocator.buffer(); //堆或直接缓冲区
    allocator.heapBuffer(); // 堆内缓冲区
    allocator.directBuffer(); // 直接缓冲区
    allocator.compositeBuffer(); // 复合缓冲区
}
```

> Netty默认使用`PooledByteBufAllocator`类作为分配的规则。但也提供了`UnpooledByteBufAllocator`。前者`池化`了ByteBuf实例以提高性能并最大程度减少内存碎片，后者则`不池化`ByteBuf实例，每次调用都返回一个新的实例。

我们还可以通过`Channel`对象或绑定到Channel的`ChannelHandlerContext`来获取`ByteBufAllocator`的引用。

```java
public interface ChannelHandlerContext extends AttributeMap, 
											   ChannelInboundInvoker, ChannelOutboundInvoker {
  	ByteBufAllocator alloc();
}
```

##### Unpooled缓冲区

```java
public void unPool() {
    Unpooled.copiedBuffer("Hello".getBytes());
    Unpooled.directBuffer();
    Unpooled.buffer();
    Unpooled.wrappedBuffer("Hello".getBytes());
}
```

> copiedBuffer()与wrappedBuffer()的区别在于：前者会生成一个`新的完全独立`的ByteBuf，而后者与传入的byte[]仍是共享的(类似duplicate()。且它们底层是创建`堆内`缓冲区。

##### ByteBufUtil

用于操作ByteBuf的静态方法，和池化无关，可单独使用。常用的有`equals（比较两个ByteBuf是否相等）`、`hexDump（返回ByteBuf的十六进制内容）`等。

##### 引用计数法

在Netty的池化中，存有一个重要的概念：`引用计数法`，只要该实例的引用大于0，就不会被释放，如果引用降低到0，那该实例就会被释放。一般由最后访问的该实例的那一方负责释放。

```java
public interface ReferenceCounted {
    int refCnt();
    ReferenceCounted retain();
    ReferenceCounted retain(int increment);
    ReferenceCounted touch();
    ReferenceCounted touch(Object hint);
    boolean release();
    boolean release(int decrement);
}
```

#### ByteBuf总结

![](https://image.leejay.top/Fs8QHe15SgVPrHy60QimS6HBGYTt)

---

### ChannelHandler & ChannelPipeline

#### ChannelHandler生命周期

![](https://image.leejay.top/FjS0ITByNINX_7YdfLPRgAVgkWdr)

##### ChannelHandlerAdapter

`ChannelInboudHandler & ChannelOutboundHandler`都继承了该类，在`ChannelHandler加入ChannelPipeline或被移除时`被调用。

```java
public abstract class ChannelHandlerAdapter implements ChannelHandler {

    // 只作用于健康检查，所以不适用volatile修饰
    boolean added;

    // 如果isSharable()为true就抛出IllegalStateException}异常
    protected void ensureNotSharable() {
        if (isSharable()) {
            throw new IllegalStateException("ChannelHandler " + getClass().getName() + " is not allowed to be shared");
        }
    }

    // 判断ChannelHandlerAdapter的子类是否可共享的
    public boolean isSharable() {
        Class<?> clazz = getClass();
        // 基于ThreadLocal实现，WeakHashMap
        // @link https://leejay.top/post/threadlocal%E5%86%85%E5%AD%98%E6%B3%84%E6%BC%8F/
        Map<Class<?>, Boolean> cache = InternalThreadLocalMap.get().handlerSharableCache();
        Boolean sharable = cache.get(clazz);
        if (sharable == null) {
            // 如果value不存在，那么判断该类是否有Sharable注解
            sharable = clazz.isAnnotationPresent(Sharable.class);
            // 将结果保存到ThreadLocalMap中
            cache.put(clazz, sharable);
        }
        return sharable;
    }

    // 加入ChannelPipeline时触发
    @Override
    public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
    }

    // 被ChannelPipeline移除时触发
    @Override
    public void handlerRemoved(ChannelHandlerContext ctx) throws Exception {
    }

    // 调用ChannelHandlerContext#fireExceptionCaught传递到下一个ChannelHandler
    @Skip
    @Override
    @Deprecated
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        ctx.fireExceptionCaught(cause);
    }
}
```

- 处理入站异常

```java
@Slf4j
@ChannelHandler.Sharable
public class MyChannelInboundHandler extends ChannelInboundHandlerAdapter {
	@Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace(); // 打印堆栈信息
        ctx.close(); // 关闭channel连接
    }
}
```

> 默认情况下，会将当前异常转发给下一个ChannelHandler，如果当前ChannelHandler已是最后一个Handler，如果不处理则会被Netty记录并打印Warning日志。

- 出站异常

出站异常，不再使用类似入站异常`exceptionCaught()`的模式，而是有两种方式可以选择。

```java
// 1. 添加监听器到ChannelFuture
ChannelFuture future = bootstrap.bind().sync();
future.channel().write("Hello").addListener((ChannelFutureListener) f -> {
    if (!f.isSuccess()) {
        f.cause().printStackTrace();
        f.channel().close();
    }
});

// 2. 在ChannelOutboundHandler#write()时处理
@Slf4j
@ChannelHandler.Sharable
public class MyChannelInboundHandler extends ChannelInboundHandlerAdapter {
    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        // 请求通过Channel将数据写到远程节点时被调用
        promise.addListener((ChannelFutureListener) future -> {
            if (!future.isSuccess()) {
                future.cause().printStackTrace();
                future.channel().close();
            }
        });
    }
}
```

##### ChannelInboudHandler

作用于`数据被接收时`或与其`对应的channel状态改变`时被调用。一般通过继承`ChannelInboundHandler`来实现自定义的ChannelHandler，但是需要我们显示的`释放与池化的ByteBuf实例相关的内存`。

```java
@Slf4j
@ChannelHandler.Sharable
public class MyChannelInboundHandler extends ChannelInboundHandlerAdapter {

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        ReferenceCountUtil.release(msg);
    }

    @Override
    public void channelRegistered(ChannelHandlerContext ctx) throws Exception {
        log.info("channelRegistered ...");
    }

    @Override
    public void channelUnregistered(ChannelHandlerContext ctx) throws Exception {
        log.info("channelUnregistered ...");
    }

    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        log.info("channelActive ...");
    }

    @Override
    public void channelInactive(ChannelHandlerContext ctx) throws Exception {
        log.info("channelInactive ...");
    }

    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        log.info("channelReadComplete ...");
    }

    @Override
    public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
        log.info("userEventTriggered ...");
    }

    @Override
    public void channelWritabilityChanged(ChannelHandlerContext ctx) throws Exception {
        log.info("channelWritabilityChanged ...");
    }
}
```

> `@Sharable`起到一个标识符的作用，表明其修饰的ChannelHandler能够被多个ChannelPipeline安全的共享。但并不代表被修饰的ChannelHandler就一定线程安全。

但是我们更推荐使用`SimpleChannelInboundHandler<T>`，因为该类内置了释放内存的相关代码。

```java
public abstract class SimpleChannelInboundHandler<I> extends ChannelInboundHandlerAdapter {
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        boolean release = true;
        try {
            if (acceptInboundMessage(msg)) {
                @SuppressWarnings("unchecked")
                I imsg = (I) msg;
                channelRead0(ctx, imsg);// 调用子类的channelRead0方法
            } else {
                release = false; // 如果不需要释放内存，那么就
                ctx.fireChannelRead(msg);
            }
        } finally {
            // 如果autoRelease为true，且处理了该msg，那么则需要释放资源
            if (autoRelease && release) {
                ReferenceCountUtil.release(msg);
            }
        }
    }
}
```

> 核心逻辑：判断是否需要处理该msg，如果需要那么对数据进行转换并调用`子类的channelRead0()`，不需要处理则将msg交给ChannelPipeline中的`下一个channelHandler`。
>
> 不管是否对数据进行处理，都最终会调用`ReferenceCountUtil.release(msg)`来释放池化的资源。
>
> 我们需要避免`存储指向任何消息的引用`，因为消息资源最终会被释放。

Netty内置了`ResourceLeakDetector类`来对应用程序进行内存泄漏检测。

| 级别         | 描述                                                         |
| ------------ | ------------------------------------------------------------ |
| **DISBALED** | 禁用泄露检测                                                 |
| **SIMPLE**   | 使用1%的默认采样率检测并报告任何发现的泄露（默认）           |
| **ADVANCED** | 使用默认的采样率，报告发现的任何泄露和对应消息被访问的位置   |
| **PARANOID** | 类似**ADVANCED**，但每次都会对消息的访问进行采样，会影响性能 |

> `java -Dio.netty.leakDetectionLevel=ADVANCED`

##### ChannelOutboundHandler

```java
@ChannelHandler.Sharable
public class MyChannelOutboundHandler extends ChannelOutboundHandlerAdapter {

    @Override
    public void bind(ChannelHandlerContext ctx, 
                     SocketAddress localAddress, 
                     ChannelPromise promise) throws Exception {
        // Channel绑定到本地地址触发
    }

    @Override
    public void connect(ChannelHandlerContext ctx, 
                        SocketAddress remoteAddress, 
                        SocketAddress localAddress, 
                        ChannelPromise promise) throws Exception {
        // Channel连接到远端时触发
    }

    @Override
    public void disconnect(ChannelHandlerContext ctx, ChannelPromise promise) throws Exception {
        // Channel从远端节点断开时调用
    }

    @Override
    public void close(ChannelHandlerContext ctx, ChannelPromise promise) throws Exception {
        // 请求关闭Channel时被调用
    }

    @Override
    public void deregister(ChannelHandlerContext ctx, ChannelPromise promise) throws Exception {
        // 从EventLoop上注销时被调用
    }

    @Override
    public void read(ChannelHandlerContext ctx) throws Exception {
        // 从Channel上读取更多数据时被调用
    }

    @Override
    public void write(ChannelHandlerContext ctx, Object msg, ChannelPromise promise) throws Exception {
        // 请求通过Channel将数据写到远程节点时被调用
    }

    @Override
    public void flush(ChannelHandlerContext ctx) throws Exception {
        // Channel将数据刷到远程节点被调用
    }
}
```

> ChannelPromise是`ChannelFuture(基于Future的子类)`的子类，用于在操作完成时得到通知。当Promise被完成之后，那么Future则不能进行任何修改。

#### ChannelPipeline

ChannelPipeline是存储ChannelHandler链的容器，每个新创建的ChannelHandler都会被分配一个新的ChannelPipeline。当执行ChannelPipeline中的ChannelHandler链时，Netty会默认的判断当前类型是否与事件运行方向一致（入站或出站）。

```java
public interface ChannelPipeline
        extends ChannelInboundInvoker, 
				ChannelOutboundInvoker, Iterable<Entry<String, ChannelHandler>> {
    ChannelPipeline addFirst(ChannelHandler... handlers);
    ChannelPipeline addLast(ChannelHandler... handlers);
    ChannelPipeline remove(ChannelHandler handler);
    ...
}
```

> ChannelPipeline可以根据需要，动态的添加或删除ChannelHandler。且可以响应入站和出站事件。

#### ChannelHandlerContext

ChannelHandlerContext代表了ChannelHandler和ChannelPipeline之间的关联，每有一盒ChannelHandler添加创建到Pipeline，都会创建ChannelHandlerContext与之关联，且`它们之间的关联永不会变`。

![](https://image.leejay.top/FjKwRQeXB8Lo0Yh-6vNRkb0Qyyue)

> 1. Channel与ChannelPipeline绑定，ChannelPipeline包含多个ChannelHandler，一个ChannelHandler可以属于多个不同的ChannelPipeline，`每个ChannelHandler都有唯一一个ChannelHandlerContext与之对应`。
>
> 2. 通过Channel发送消息会从`ChannelPipeline的头开始流动`，如果通过某个ChannelHandler的ChannelHandlerContext发送消息，那么会`从该ChannelHandler的下个ChannelHandler`开始流动。

---

### 编解码器

#### 抽象解码器

解码器本质上继承了`ChannelInboundHandlerAdapter`，可以作为`ChannelHandler`加入到`ChannelPipeline`。

- ByteToMessageDecoder

```java
public class ToIntegerDecoder extends ByteToMessageDecoder {
    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
        // 如果可读字节数多于4个，那么将其添加到解码消息的list中
        if (in.readableBytes() >= 4) {
            out.add(in.readInt());
        }
    }
}
```

> 将入站的字节按照长度为4转换为消息

- ReplayingDecoder<T>

```java
public class ToIntegerDecoder2 extends ReplayingDecoder<Void> {
    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
        // 相比实现ByteToMessageDecoder，不需要判断是否存在可读字节，由父类实现
        out.add(in.readInt());
    }
}
```

> 相比`ByteToMessageDecoder`抽象类，`ReplayingDecoder`不需要额外判断当前是否有字节数可读。
>
> `ByteToMessageDecoder`适合处理不复杂的逻辑，如果逻辑复杂建议使用`ReplayingDecoder`。

- MessageToMessageDecoder<T>

```java
public class IntegerToStringDecoder extends MessageToMessageDecoder<Integer> {
    @Override
    protected void decode(ChannelHandlerContext ctx, Integer msg, List<Object> out) throws Exception {
        out.add(String.valueOf(msg));
    }
}
```

> 将指定类型的消息转换为另一种类型，然后调用下一个`ChannelInboundHandler`。

#### 抽象编码器

编码器本质上实现了`ChannelOutboundHandlerAdapter`，可以作为`ChannelHandler`添加到`ChannelPipeline`。

- MessageToByteEncoder

```java
public class ShortToByteEncoder extends MessageToByteEncoder<Short> {
    @Override
    protected void encode(ChannelHandlerContext ctx, Short msg, ByteBuf out) throws Exception {
        out.writeShort(msg);
    }
}
```

> 出站过程中将消息转换为`ByteBuf`字节。

- MessageToMessageEncoder<T>

```java
public class IntegerToStringEncoder extends MessageToMessageEncoder<Integer> {
    @Override
    protected void encode(ChannelHandlerContext ctx, Integer msg, List<Object> out) throws Exception {
        out.add(String.valueOf(msg));
    }
}
```

> 将指定类型的消息转换为另一种类型，然后调用下一个`ChannelOutboundHandler`。

#### 高级抽象编解码器

高级抽象编解码器是对编码、解码器两者的结合，同样是可以作为`ChannelHandler`加入到`ChannelPipeline`中。

- ByteToMessageCodec<T>

```java
public class MyByteToMessageCodec extends ByteToMessageCodec<Integer> {

    @Override
    protected void encode(ChannelHandlerContext ctx, Integer msg, ByteBuf out) throws Exception {
        out.writeByte(msg);
    }

    @Override
    protected void decode(ChannelHandlerContext ctx, ByteBuf in, List<Object> out) throws Exception {
        // byte -> Integer
        if (in.readableBytes() >= 2) {
            out.add(in.readInt());
        }
    }
}
```

> `ByteToMessage`编解码器同时包含编码和解码，分别是`入站的解码和出站的编码`。

- MessageToMessageCodec<IN, OUT>

```java
public class MyMessageToMessageCodec extends MessageToMessageCodec<Integer, String> {

    @Override
    protected void encode(ChannelHandlerContext ctx, String msg, List<Object> out) throws Exception {
        out.add(Integer.valueOf(msg));
    }

    @Override
    protected void decode(ChannelHandlerContext ctx, Integer msg, List<Object> out) throws Exception {
        out.add(String.valueOf(msg));
    }
}
```

> `MessageToMessage`编解码器主要是处理入站和出站中的某种消息类型转换为另一种消息类型。

- CombinedChannelDuplexHandler

```java
public class MyCombinedChannelDuplexHandler extends CombinedChannelDuplexHandler<ToIntegerDecoder, ShortToByteEncoder> {

    public MyCombinedChannelDuplexHandler(ToIntegerDecoder inboundHandler, ShortToByteEncoder outboundHandler) {
        super(inboundHandler, outboundHandler);
    }
}
```

> `CombinedChannelDuplexHandler`抽象类相比`MessageToMessageCodec`，主要是为了解决编解码器的复用问题，将编解码器作为构造参数传入。

#### 内置的编解码器

##### 应用程序连接协议

- Ssl加密解密

```java
public class SslChannelInitializer extends ChannelInitializer<Channel> {
    private final SslContext context;
    private final boolean startTls;

    public SslChannelInitializer(SslContext context, boolean startTls) {
        this.context = context;
        this.startTls = startTls;
    }

    @Override
    protected void initChannel(Channel ch) throws Exception {
        SSLEngine sslEngine = context.newEngine(ch.alloc());
        // SSL/TLS加密解密一般作为第一个handler
        ch.pipeline().addFirst("ssl", new SslHandler(sslEngine, startTls));
    }
}
```

> 一般将SslHandler作为ChannelPipeline中的第一个handler。

- Http/Https

```java
public class HttpPipelineInitializer extends ChannelInitializer<Channel> {
    private final boolean isClient;

    public HttpPipelineInitializer(boolean isClient) {
        this.isClient = isClient;
    }

    @Override
    protected void initChannel(Channel ch) throws Exception {
        ChannelPipeline pipeline = ch.pipeline();
        // 因为http是由客户端发起的通信，客户端需要对请求加密，接受服务端的响应解密
        if (isClient) {
            pipeline.addLast(new HttpResponseDecoder());
            pipeline.addLast(new HttpRequestEncoder());
        } else {
            // 服务端接受客户端请求需要先解密，返回响应加密
            pipeline.addLast(new HttpResponseEncoder());
            pipeline.addLast(new HttpRequestDecoder());
        }
    }
}
```

> 基于Http是`请求/响应`类型，由客户端发起请求，服务端响应请求，所以客户端需要对请求加密，接受服务端的响应解密，服务端接受客户端请求需要先解密，返回响应加密。

- Http/Https聚合

```java
public class HttpAggregatorInitializer extends ChannelInitializer<Channel> {
    private final boolean isClient;

    public HttpAggregatorInitializer(boolean isClient) {
        this.isClient = isClient;
    }

    @Override
    protected void initChannel(Channel ch) throws Exception {
        ChannelPipeline pipeline = ch.pipeline();
        if (isClient) {
            // HttpRequestEncoder + HttpResponseDecoder
            pipeline.addLast(new HttpClientCodec());
        } else {
            // HttpResponseDecoder + HttpRequestEncoder
            pipeline.addLast(new HttpServerCodec());
        }
        // 聚合http，限制不超过512kb
        pipeline.addLast(new HttpObjectAggregator(512 * 1024));
    }
}
```

> 因为Http/Https的数据是可以分成多个部分传送的，所以我们可以使用聚合得到一个完整的数据。但相对性能要差一些，并且我们可以指定限制`Http content`的大小。

- WebSocket

```java
public class WebSocketServerInitializer extends ChannelInitializer<Channel> {

    @Override
    protected void initChannel(Channel ch) throws Exception {
        ch.pipeline().addLast(
                new HttpServerCodec(), // 处理http
                new HttpObjectAggregator(512 * 1024), // 处理http数据聚合
                new WebSocketServerProtocolHandler("/websocket"), // 处理/websocket路径
                new TextFrameHandler(), // 处理text格式
                new BinaryFrameHandler(), // 处理binary格式
                new ContinuationFrameHandler() // 处理属于上一个binary或text的数据
        );
    }

    static final class TextFrameHandler 
        extends SimpleChannelInboundHandler<TextWebSocketFrame> {
        @Override
        protected void channelRead0(ChannelHandlerContext ctx, TextWebSocketFrame msg) 
            throws Exception {

        }
    }

    static final class BinaryFrameHandler 
        extends SimpleChannelInboundHandler<BinaryWebSocketFrame> {
        @Override
        protected void channelRead0(ChannelHandlerContext ctx, BinaryWebSocketFrame msg) 
            throws Exception {
        }
    }

    static final class ContinuationFrameHandler 
        extends SimpleChannelInboundHandler<ContinuationWebSocketFrame> {
        @Override
        protected void channelRead0(ChannelHandlerContext ctx, ContinuationWebSocketFrame msg) 
            throws Exception {
        }
    }
}
```

> WebSocket是`基于Http的应用层协议`。在处理WebSocket数据之前，我们需要先使用http相关ChannelHandler处理数据，然后再使用WebSocket相关的channelHandler处理。

##### 连接超时与空闲

- IdleStateHandler

```java
public class IdleStateHandlerInitializer extends ChannelInitializer<Channel> {
    @Override
    protected void initChannel(Channel ch) throws Exception {
        ChannelPipeline pipeline = ch.pipeline();
        pipeline.addLast(new IdleStateHandler(0, 0, 60, TimeUnit.SECONDS));
        pipeline.addLast(new HeartBeatHandler());
    }

    static class HeartBeatHandler extends ChannelInboundHandlerAdapter {
        private static final ByteBuf HEARTBEAT_SEQUENCE = Unpooled.unreleasableBuffer(
                Unpooled.copiedBuffer("HEART_BEAT", CharsetUtil.ISO_8859_1));

        @Override
        public void userEventTriggered(ChannelHandlerContext ctx, Object evt) throws Exception {
            // 如果空闲连接时间太长，那么发送心跳事件
            if (evt instanceof IdleStateEvent) {
                ctx.writeAndFlush(HEARTBEAT_SEQUENCE.duplicate())
                        .addListener(ChannelFutureListener.CLOSE_ON_FAILURE);
            } else {
                super.userEventTriggered(ctx, evt);
            }
        }
    }
}
```

> 如果连接空闲时间太长，那么我们发送`IdleStateEvent`，在下游的`userEventTriggered`中处理。

- Read/WriteTimeoutHandler

除了`IdleStateHandler`的空闲连接处理，还可以处理`Read/Write`超时问题，需要交给下游的`ChannelHandler`中的`exeptionCaught`方法来处理。

```java
public class ReadTimeoutHandler extends IdleStateHandler {
    // 指定读取超时时间
    public ReadTimeoutHandler(int timeoutSeconds) {
        this(timeoutSeconds, TimeUnit.SECONDS);
    }
}

public class WriteTimeoutHandler extends ChannelOutboundHandlerAdapter {
    public WriteTimeoutHandler(int timeoutSeconds) {
        this(timeoutSeconds, TimeUnit.SECONDS);
    }
}
```

##### 基于分隔符的解码器

- LineBasedFrameDecoder

```java
public class LineBasedHandlerInitializer extends ChannelInitializer<Channel> {
    @Override
    protected void initChannel(Channel ch) throws Exception {
        // 行尾符分割并限制最大长度
        ch.pipeline().addLast(new LineBasedFrameDecoder(64 * 1024), new FrameHandler());
    }

    static final class FrameHandler extends SimpleChannelInboundHandler<ByteBuf> {
        @Override
        protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) throws Exception {
        }
    }
}
```

- DelimiterBasedFrameDecoder

相比`LineBasedFrameDecoder`，`DelimiterBasedFrameDecoder`的性能要稍低，它是使用用户指定的分隔符来提取帧的通用解码器。

##### 基于长度的解码器

- FixedLengthFrameDecoder

每次解码都按照一定的长度进行解码，长度是在创建的时候通过构造函数指定的。

```java
public class FixedLengthFrameDecoder extends ByteToMessageDecoder {
	public FixedLengthFrameDecoder(int frameLength) {
        checkPositive(frameLength, "frameLength");
        this.frameLength = frameLength;
    }
}
```

- LengthFieldBasedFrameDecoder

```java
public class LengthBasedInitializer extends ChannelInitializer<Channel> {
    @Override
    protected void initChannel(Channel ch) throws Exception {
        ch.pipeline().addLast(
                // 最大长度，字段编码起始地址，长度编码长度
                new LengthFieldBasedFrameDecoder(64 * 1024, 0, 8),
                new FrameHandler());
    }

    static final class FrameHandler extends SimpleChannelInboundHandler<ByteBuf> {
        @Override
        protected void channelRead0(ChannelHandlerContext ctx, ByteBuf msg) throws Exception {
        }
    }
}
```

> 相比`FixedLengthFrameDecoder`，`LengthFieldBasedFrameDecoder`可以指定长度编码的起始位置和编码长度，更加的灵活，适合每次长度都不同的情况。

---

