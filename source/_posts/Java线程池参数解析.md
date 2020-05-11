---
title: Java线程池参数解析
date: 2020-03-27 19:41:37
toc: true
tags: Java
categories:
  - Java
thumbnail: https://image.leejay.top/image/20200327/wyNA37eRaKgk.jpg
---

## 前言

`今天在学习多线程设计模式的时候，有讲到线程池相关的内容，有些东西觉得很有记录的价值，翻了翻之前的文章才发现没有线程池相关的内容，所以今天写一篇线程池的参数解析，用于以后的翻阅与复习。`

## 线程池

`最早我们使用线程的都是使用继承Thread类、实现Runnable接口这种类似单个线程启动的方式，后来引入了线程池，关于线程池，最早的时候使用Exectors的四种静态方法创建线程池，后来阿里规范建议我们使用ThreadPoolExector的构造创建线程池(Exectors内部就是使用该构造实现的)，这样能够更加了解线程池的创建方式，也能有效的避免OOM的情况。`

<!--more -->
``` java
public ThreadPoolExecutor(int corePoolSize,
                        int maximumPoolSize,
                        long keepAliveTime,
                        TimeUnit unit,
                        BlockingQueue<Runnable> workQueue,
                        ThreadFactory threadFactory,
                        RejectedExecutionHandler handler) {
    // 参数校验及赋值省略
}
```

- corePoolSize
`线程池核心线程数量，即使闲置或超时也不会回收的线程。关于corePoolSize有一个公式(来自java并发编程实战)用于计算不同cpu下的它的大小。`

```java
NThreads = NCpus * UCpus * (1 + W/C)
NThreads：线程数量
NCpus：cpu核数(Runtime.getRuntime().availableProcessors()可计算)
UCpus: cpu使用率(0~1)
W/C： wait time/compute time  Cpu运行类型分为I/O密集型(W)和计算密集型(C)
```
> 假设：CPU使用率是100%，那么公式可以变成：NThreads = NCpus * (1 + W/C)，
> 1. 如果是I/O密集型(数据库交互、文件上传下载、网络数据传输等)W越大，那么 W/C > 1， NThreads >= 2 * NCpus，具体项目还是要多测试，不想测试就取最小值2NCpus。
> 2. 如果是计算密集型(复杂算法之类的)，W 接近于0 NThreads >= NCpus，推荐NCpus+1，这样即使当计算密集型线程偶尔由于缺失故障或者其他原因线程暂停，这个额外的线程也能确保CPU时钟周期不被浪费， 至于多一个cpu上下文切换是否值得，具体项目具体测试。
> 所以得出结论推荐： I/O密集型： NThread = 2NCpu。 计算密集型  NThread = NCpus + 1

- maximumPoolSize
`线程池最大线程数量，一般是corePoolSize数量的2倍`

- keepAliveTime
`非核心线程闲置的时候，超过这个时间就会被回收。`

- TimeUnit
`超时时间单位，支持s、ms等。`

- workQueue
`阻塞队列BlockingQueue<Runnable>的实现类，用于缓存任务task。`

 - ArrayBlockingQueue 基于数组的BlockingQueue，元素个数有最大限制的BlockingQueue。
 - LinkedBlockingQueue 基于链表的BlockingQueue，元素个数没有最大限制的BlockingQueue。
 - PriorityBlockingQueue 带有优先级的BlockingQueue，数据的优先级是由实现comparable接口的对象决定的。
 - DelayQueue Delayed对象构成的BlockingQueue，一定时间之后才能够take。
 - SynchronousQueue 直接传递的BlockingQueue 如果p角色先put，在c角色take之前，p会一直阻塞。相反如果c先take，在p角色put之前，c会一直阻塞。
 - ConcurrentLinkedQueue 元素个数没有最大限制的线程安全队列。

- ThreadFactory
`可以理解成线程的来源，还可以设置线程的名称、类型和是否daemon等属性。`

```java
// 设置线程名前缀
ThreadFactory factory = new CustomizableThreadFactory("Thread-pool-");

// 或者使用guava的jar
ThreadFactory factory = new ThreadFactoryBuilder().setNameFormat("Demo-pool-%d").build();
```

- RejectedExecutionHandler
`当任务队列全部满了之后，线程池对于新的任务的拒绝策略，`

|拒绝策略|拒绝行为|
|:--|:--|
|AbortPolicy|抛出RejectedExecutionException|
|DiscardPolicy|什么也不做，直接忽略|
|DiscardOldestPolicy|丢弃执行队列中最老的任务，尝试为当前提交的任务腾出位置|
|CallerRunsPolicy|直接由提交任务者执行这个任务(比如main线程)|

- 流程简析

```java
public class ThreadPool {
    public static void main(String[] args) {
        ThreadFactory threadFactory = Executors.defaultThreadFactory();
        ThreadPoolExecutor threadPoolExecutor = new ThreadPoolExecutor(
                2,
                4, // 最多四个线程执行任务
                60L,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(10),// 因为20个任务，多于queue指定的10个，肯定会执行reject策略
                new CustomizableThreadFactory("Thread-pool-"),
                new ThreadPoolExecutor.DiscardOldestPolicy()
        );

        // 提交20个任务
        for (int i = 0; i < 20; i++) {
            threadPoolExecutor.execute(() -> {
                System.out.println(Thread.currentThread().getName() + " do something ");
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            });
        }
        threadPoolExecutor.shutdown();
    }
}

```
> 当一个任务添加到线程池的时候:
> 1. 如果此时线程池内线程数量小于corePoolSize，即使已存在的线程处于空闲，线程池也会创建新的线程来处理被添加的任务。
> 2. 如果此时线程池中线程数量等于corePoolSize，但是任务队列queue未满，任务将会放入缓冲队列。
> 3. 如果此时线程池中线程数量大于corePoolSize，任务队列queue满，并且线程池线程数量小于maximumPoolSize，创建新的线程处理该任务。
> 4.  如果此时线程池中的数量大于corePoolSize，任务队列queue满，并且线程池中线程数量等于maximumPoolSize，那么通过handler所指定的策略来处理此任务。

## 后记
`线程池是并发中比较重要的一部分，也是面试经常遇到的，今天先记录下相关参数，后面再记录下线程池的源码分析。`