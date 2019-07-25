---
title: Java并发编程概念
top: true
date: 2019-07-08 17:28:08
tags: Java Concurrent
toc: true
categories:
  - Java Concurrent
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4mghnm1y2j30sg0lcaan.jpg
---

## 线程相关概念

### 进程

_进程是操作系统中最重要的抽象概念之一,是系统进行资源分配和调度的基本单位,也是线程的容器_

---

### 线程

_线程是操作系统能够进行运算的最小单位,被包含在进程之中,是进程实际运作单位,又称为轻量级进程_

Q: 多线程会更快吗?

A: 并发执行有时会因为上下文切换和资源调度的问题,导致执行速度没有串行快

---

### 并发和并行

- 并行: 并行是指两个或者多个事件在同一时刻发.
- 并发: 并发是指两个或多个事件在同一时间间隔内发生

  !["并发和并行图解"](https://i.loli.net/2019/07/08/5d230eaa3a24b16538.png)

  👉👉*<font color="red">并行是两个队伍分别使用一台咖啡机,并发是两个队伍依次轮流使用一台咖啡机.</font>*

<!-- more -->

---

### 线程的安全性

- 当`多个线程访问某个类`的时候,这个类始终都能表现出正确的行为,说明这个类是线程安全的

- 无状态对象(不包含域&也不包含其他类中域的引用)是线程安全的

---

### 竞态条件&数据竞争

- 竞态条件: 由于不恰当的执行时序而出现不正确的结果,最常见的一种竞态类型是: 先检查后执行. 通过一个可能失效的观测结果来决定下一步动作

- 数据竞争: 如果在访问共享的非 final 类型的域时没有采用同步来进行协同就会出现数据竞争

---

### Synchronized

> <a href="../Synchronized锁详解">Synchronized 锁详解</a>

### 死锁

- 代码展示

```java
public class DeadLock {

    private static final String A = "A";
    private static final String B = "B";

    private void deadLock() {
        Thread t1 = new Thread(() -> {
            synchronized (A) {
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                synchronized (B) {
                    System.out.println("Get Lock B");
                }
            }
        });

        Thread t2 = new Thread(() -> {
            synchronized (B) {
                synchronized (A) {
                    System.out.println("Get Lock A");
                }
            }
        });

        t1.start();
        t2.start();
    }

    public static void main(String[] args) {
        new DeadLock().deadLock();
    }
}
```

- 使用 jconsole 查看线程

  _Thread-0 和 Thread-1 分别都 Blocked 了,都在等待对方释放锁_

    <img src="https://i.loli.net/2019/07/16/5d2d750c5845998231.png">

    <img src="https://i.loli.net/2019/07/16/5d2d74b809e3e35520.png">

- 如何避免死锁
  - 避免一个线程获取多个锁
  - 避免一个线程在锁内同时占用多个资源,尽量保证只占用一个资源
  - 尝试使用定时锁时,采用 Lock.tryLock(timeout)来替代 synchronized
  - 数据库锁需要保证枷锁和解锁都在同一个数据库连接中

---

### 资源限制

- 资源限制是指: 在进行并发编程的时候, 程序的执行速度受限于计算机硬件资源或者软件资源, 会导致程序执行速度变慢

- 针对硬件资源的限制: 可以通过使用集群来避免.

- 针对软件资源的限制: 可以使用资源池将资源复用

---

### 原子性

_不可被中断的一个或一系列操作_

#### 处理器实现原子性

- 使用总线锁保证原子性
  使用处理器提供的一个`LOCK#信号`,当一个处理器在总线上输出此信号时,其他处理器的请求被阻塞住, 那么该处理器可以独占共享内存.

- 使用缓存锁保证原子性

  缓存锁定是指<font color="green">内存区域如果被缓存在处理器的缓存行中,并且在 Lock 操作期间被锁定, 那么当它执行锁操作回写到内存时, 处理器不在总线上声言 LOCK#信号, 而是修改内存的内存地址, 并允许它的缓存一致性来保证操作的原子性</font>

  - 当操作的数据不能被缓存在处理器内部，或操作的数据跨多个缓存行(cache line)时，则处理器会调用总线锁定。
  - 有些处理器不支持缓存锁定

#### Java 实现原子性

- 使用循环 CAS 实现原子操作

  - ABA 问题: AtomicStampedReference 引用加标志进行 CAS
  - 循环时间长开销大: 自旋 CAS 会导致非常大的 CPU 执行开销
  - 只能保证一个共享变量的原子操作

- 使用锁机制实现原子操作

  _除了偏向锁,其余的锁都使用循环 CAS 实现_

---

### Java 内存模型

#### 并发编程的两个问题:

_Java 的并发采用的是共享内存模型_

- 线程之间如何通信

  - 共享内存: 线程之间共享程序的公共状态, 通过`写-读内存中的公共状态`进行`隐式`通讯
  - 消息传递: 线程之间必须通过`发送消息`来`显式`的进行通讯

- 线程之间如何同步

  _同步是指程序中用于控制不同线程间操作发生相对顺序的机制_

  - 在共享内存中, 同步是`显式`进行的
  - 在消息传递中, 同步是`隐式`进行的(消息发送必须在消息接收之前)

#### Java 内存模型抽象结构

- Java 内存模型(JMM)

  抽象角度来说, JMM 定义了线程和主内存之间的抽象关系: `线程之间的共享变量存储在主内存, 每个线程都有一个私有的本地内存(抽象概念), 本地内存存储了该线程以读/写共享变量的副本`

  <img title="Java抽象内存模型" style="width: 500px;" src="https://i.loli.net/2019/07/22/5d3522689a1b940442.png"><

  如果线程 A 和线程 B 之间要通信的话:

  1. 线程 A 把本地内存中更新过的内存变量刷新到主内存中去
  2. 线程 B 到主内存中去读取线程 A 之前已更新过的共享变量

- 从源代码到指令序列的重排序

  - 编译器优化的重排序
    `编译器在不改变单线程程序的语义`前提下, 可以重新安排语句对应的执行顺序.
  - 指令集并行的重排序
    现代处理器采用了`指令级并行技术`来将多条指令重叠执行. 如果不存在数据依赖性, 处理器可以改变语句对应机器指令的执行顺序.
  - 内存系统的重排序
    由于`处理器使用缓存和读/写缓冲区`, 这使得加载和存储操作看上去可能是在乱序执行.(如下案例)

* 并发编程模型的类型
  现代的处理器使用`写缓冲区`临时保存向内存写入的数据, 但是每个`处理器上的写缓冲区只对所在的处理器可见`, 会导致`处理器对内存的读/写操作不一定与内存实际发生的读/写操作一致`.

  <img src="https://i.loli.net/2019/07/23/5d36db5712f7a91689.png">

  <img src="https://i.loli.net/2019/07/23/5d36db6bc175182042.png">

  > 因为处理器对内存和内存对处理器操作的不一致, 加之现代的处理器都会使用写缓冲区, 因此`现代的处理器都会允许对写-读操作进行重排序, 不允许对数据依赖操作做重排序.`

  为了保证内存可见性，Java 编译器在生成指令序列的适当位置会插入`内存屏障指令`来禁止特定类型的处理器重排序

#### 重排序

_编译器和处理器为了优化程序性能而对指令序列进行重新排序的一种手段_

#### 数据依赖性

_如果两个操作访问同一个变量, 且这两个操作中有一个为写操作, 此时这两个操作之间就存在数据依赖性_

`(单个处理器或单个线程下)`编译器和处理器在重排序时, 会遵守数据依赖性, 编译器和处理器`不会改变`存在数据依赖关系的两个操作的执行顺序。

#### as-if-serial 语义

_不管怎么重排序(编译器和处理器为了提高并行度), `(单线程)程序`的执行结果不能被改变. 编译器、runtime 和处理器都必须遵守 as-if-serial 语义_

#### 重排序对多线程的影响

_在多线程的情况下, 1,2,3,4 步的重排序会导致结果的改变_

```java
public class ReorderByConcurrent {

    private int i = 0;
    private boolean flag = false;

    private void write() {
        i = 1; // 1
        flag = true; // 2
    }

    private void reader() {
        if (flag) { // 3
            int j = i * i; // 4
            System.out.println("j: " + j);
        }
    }

    public static void main(String[] args) {
        ReorderByConcurrent reorderByConcurrent = new ReorderByConcurrent();
        new Thread(reorderByConcurrent::write).start();
        new Thread(reorderByConcurrent::reader).start();
    }
}

```

#### volatile

- volatile 变量具有可见性: `对于一个volatile变量的读, 总是能看到(任意线程)对这个volatile变量最后的写入`和原子性: `对任意单个volatile变量的读/写具有原子性`.

- 当写一个 volatile 变量时, JMM 会把`该线程对应的本地内存中的共享变量值刷新到主内存`.

- 当读取一个 volatile 变量时, JMM 会把该`线程对应的本地内存设置为无效. 线程接下来将从内存中读取变量`.

- volatile 内存语义
  线程 A 写一个 volatile 变量, 实质上是线程 A 向接下来将要读这个 volatile 变量的某个线程发出了(其对共享变量所做修改的)消息.

  线程 B 读一个 volatile 变量, 实质上是线程 B 接收了之前某个线程发出的(其对共享变量所做修改的)消息.

  线程 A 写一个 volatile 变量, 随后线程 B 读这个 volatile 变量, 这个过程实质上是线程 A 通过主内存对线程 B 发送消息

  <img src="https://i.loli.net/2019/07/23/5d36b1265d37759780.png">

- volatile 重排序规则表

  <img src="https://i.loli.net/2019/07/23/5d36b396e0b0598024.png">

  > 例如: 当第一个操作是`普通读/写`时, 如果第二个操作是`volatile写`, 则编译器不能重排序这两个操作.

- 内存屏障

  _为了实现 volatile 的内存语义, 编译器在生成字节码时, `会在指令序列中插入内存屏障来禁止特定类型的处理器重排序`, JMM 采用的是基于保守策略的内存屏障插入策略_

  在每个`volatile写操作`的`前面`插入一个`StoreStore屏障`
  在每个`volatile写操作`的`后面`插入一个`StoreLoad屏障`
  在每个`volatile读操作`的`后面`插入一个`LoadLoad屏障`
  在每个`volatile读操作`的`后面`插入一个`LoadStore屏障`

   <img src="https://i.loli.net/2019/07/23/5d36bd0dc4ab122337.png">

  > 最后的 StoreLoad 屏障不能省略. 因为第二个 volatile 写之后, 方法立即 return. 此时编译器可能无法准确断定后面是否会有 volatile 读或写, 为了安全起见, 编译器通常会在这里插入一个 StoreLoad 屏障.

#### 锁的内存语义

_锁除了`让临界区互斥执行外`, 还可以让`释放锁的线程向获取同一个锁的线程发送消息`_

- 当线程释放锁时, `JMM 会把当前线程对应的本地内存中的共享变量刷新到主内存中`.

- 当程序获取锁时, `JMM 会把该线程对应的本地内存设置为无效`, 从而使被监视器保护的临界代码必须从主内存中读取共享变量.

- 锁释放和获取的内存语义

  线程 A 释放一个锁, 实质上是线程 A 向接下来将要获取这个锁的某个线程发出了(`线程 A 对共享变量所做修改的`)消息

  线程 B 获取一个锁, 实质上是线程 B 接收了之前某个线程发出的(`在释放这个锁之前对共享变量所做修改的`)消息

  线程 A 释放锁, 随后线程 B 获取这个锁, 这个过程实质上是线程 A 通过主内存向线程 B 发送消息.

- concurrent 包构成

  <img src="https://i.loli.net/2019/07/23/5d36c650590a773428.png">

---

### final

- final 域的重排序规则

  - 在构造函数内对一个 final 域的写入, 与随后把这个被构造对象的引用赋值给一个引用变量, 这两个操作之间不能重排序

  - 初次读一个包含 final 域的对象的引用, 与随后初次读这个 final 域, 这两个操作之间不能重排序

  ```java
  public class FinalExample {
      int i;  // 普通变量
      final int j; // final变量
      static FinalExample obj;
      public FinalExample () { // 构造函数
          i = 1; // 写普通域
          j = 2; // 写final域
      }
      // 线程A调用
      public static void writer() {
          obj = new FinalExample();
      }
      // 线程B调用
      public static void reader() {
          FinalExample object = obj; // 读对象引用
          int a = object.i; // 读普通域
          int b = object.j; // 读final域
      }
  }
  ```

- 为什么增强 final 语义

  通过为 final 域增加写和读重排序规则, 可以提供初始化安全保证: 只要对象是正确构造的`被构造对象的引用在构造函数中没有逸出`, 那么不需要使用用同步`指lock和volatile的使用`就可以保证任意线程都能看到这个 final 域在构造函数中被初始化之后的值.

---

### happens-before

_在 JMM 中, 如果一个操作性的结果需要对另外一个操作可见, 那么这两个操作(可以是一个线程之内,也可以是不同线程之间)执行必须要存在 happens-before 关系_

#### happens-before 语义

JSR-133 使用 happens-before 的概念来指定两个操作之间的执行顺序. 由于这两个操作可以在一个线程或在不同线程之间, 因此 JMM 可以通过 happens-before 关系提供跨线程的内存可见性保证(`如果线程A写操作a与线程B的读操作b之间存在happens-before, 尽管a操作和b操作在不同线程中执行, 但JMM保证a操作对b操作的可见性`)

as-if-serial 语义保证`单线程内程序的执行结果不被改变`, happens-before 关系保证`正确的多线程程序的执行结果不被改变`

#### happens-before 规则:

- 程序顺序规则: 一个线程中的每个操作, happens-before 于该线程中的任意后续操作

- 锁定规则: 对一个锁的解锁, happens-before 于随后对这个锁的加锁

- volatile 变量规则: 对一个 volatile 域的写, happens-before 于任意后续对这个 volatile 域的读

- 传递规则: 如果操作 A 先行发生于操作 B, 而操作 B 又先行发生于操作 C, 则可以得出操作 A 先行发生于操作 C

- start()规则: 如果线程 A 执行操作 ThreadB.start()（启动线程 B）, 那么 A 线程的 ThreadB.start()操作 happens-before 于线程 B 中的任意操作

- join()规则: 如果线程 A 执行操作 ThreadB.join()并成功返回, 那么线程 B 中的任意操作 happens-before 于线程 A 从 ThreadB.join()操作成功返回, `即线程B中的任意操作都对线程A可见`

> 两个操作之间具有`happens-before`关系, 并不意味着前一个操作必须要在后一个操作前执行(`JMM保证结果的前提下并不排斥重排序`). `happens-before仅仅要求前一个操作(执行结果)对后一个操作可见, 且前一个操作按顺序排在第二个操作之前`

---

### 双重锁定检查

#### 代码展示

```java
public class SafeLazyInitialization {

    private static Instance instance;

    /**
     * 线程不安全版单例
     */
    public static Instance getInstanceUnSafe() {
        if (null == instance) {
            instance = new Instance();
        }
        return instance;
    }

    /**
     * 线程安全单例-低性能版
     */
    public synchronized static Instance getInstanceSafe() {
        if (null == instance) {
            instance = new Instance();
        }
        return instance;
    }

    /**
     * 双重锁定检查版单例
     */
    public static Instance getInstanceDoubleCheckedLocking() {
        // 第一次检查
        if (null == instance) {
            // 加锁
            synchronized (SafeLazyInitialization.class) {
                // 第二次检查
                if (null == instance) {
                    /*
                     * 问题根源: instance引用的对象可能还没有完成初始化
                     * 正常情况: 1.分配对象的内存空间 2.初始化对象 3.设置instance指向刚分配的内存地址 4.初次访问
                     * 问题分析: 重排序问题导致 2和3步顺序调换 并不影响4步
                     * 解决办法: 1.不允许2,3重排序 2.允许2,3步重排序,但是不允许其他线程看到这个重排序
                     */
                    instance = new Instance();
                }
            }
        }
        return instance;
    }
}

class Instance {
    Instance() {
        System.out.println("对象初始化");
    }
}

```

#### 解决方案

- 基于 volatile

```java
// 修改对象引用为volatile禁止重排序
private volatile static Instance correctInstance;
```

- 基于类初始化

```java
public class InstanceFactory {
    private static class InstanceHolder {
        // 线程A获取到锁执行初始化, 线程B没有锁只能等待,同时也看不到线程A的初始化操作
        public static Instance instance = new Instance();
    }

    public static Instance getInstance() {
        return InstanceHolder.instance;
    }
}
```

<img src="https://i.loli.net/2019/07/25/5d397a34584c987718.png">

> JVM 在类的初始化阶段(`即在Class被加载后, 且被线程使用之前`),会执行类的初始化. 在此期间, JVM 会去获取一个锁, `这个锁可以同步多个线程对同一个类的初始化`.

---

## 知识拓展

### 拓展 1: 单核和多核 cpu 在不同的 os 下进程和线程问题

- 单核 cpu 可以并发实现同时执行多个进程(或者说线程): 它只能把 CPU 运行时间划分成若干个时间段,再将时间段分配给各个线程执行，在一个时间段的线程代码运行时，其它线程处于挂起状态.

- 多核 cpu 可以并行实现同时执行多个进程(或者说线程): 当一个 CPU 执行一个线程时，另一个 CPU 可以执行另一个线程，两个线程互不抢占 CPU 资源，可以同时进行.

- 但是在 windows 系统下: 多核 cpu 下只能并发执行多进程,但是可以并行实现多线程(待验证)

### 拓展 2: 如何理解进程和线程的多种方式

- 单进程单线程：一个人在一个桌子上吃菜
- 单进程多线程：多个人在同一个桌子上一起吃菜.
- 多进程单线程：多个人每个人在自己的桌子上吃菜.
- 对于 Windows 来说, 加一张桌子开销很大, 所以 Windows 鼓励大家在一个桌子上吃菜, 所以需要面对线程资源争抢与同步的问题.
- 对 Linux 而言, 开一张新桌子开销很小, 所以可以尽可能多开新桌子, 但是在不同桌子上说话不方便, 所以需要研究进程间的通信.

### 拓展 3: 交替打印奇偶数

```java
@Slf4j
public class PrintNumber {
    private AtomicBoolean flag = new AtomicBoolean(Boolean.TRUE);
    private AtomicInteger atomicInteger = new AtomicInteger(0);
    private static final int COUNT = 100;

    public static void main(String[] args) {
        PrintNumber printNumber = new PrintNumber();

        /*
         * 利用的是全局变量和wait&notify的使用
         */
        new Thread(() -> {
            while (printNumber.atomicInteger.get() < COUNT) {
                synchronized (printNumber) {
                    if (printNumber.flag.get()) {
                        log.info("偶数: {}", printNumber.atomicInteger.getAndIncrement());
                        printNumber.flag.getAndSet(Boolean.FALSE);
                        printNumber.notify();
                    } else {
                        try {
                            printNumber.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }).start();

        new Thread(() -> {
            while (printNumber.atomicInteger.get() < COUNT) {
                synchronized (printNumber) {
                    if (!printNumber.flag.get()) {
                        log.info("奇数: {}", printNumber.atomicInteger.getAndIncrement());
                        printNumber.flag.getAndSet(Boolean.TRUE);
                        printNumber.notify();
                    } else {
                        try {
                            printNumber.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }).start();
    }
}
```
