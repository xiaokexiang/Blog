---
title: Java并发编程实战
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

- 当多个线程访问某个类的时候,这个类始终都能表现出正确的行为,说明这个类是线程安全的

- 无状态对象(不包含域&也不包含其他类中域的引用)是线程安全的

---

### 竞态条件&数据竞争

- 竞态条件: 由于不恰当的执行时序而出现不正确的结果,最常见的一种竞态类型是: 先检查后执行. 通过一个可能失效的观测结果来决定下一步动作

- 数据竞争: 如果在访问共享的非 final 类型的域时没有采用同步来进行协同就会出现数据竞争

---

### Volatile

- Volatile 确保将变量的更新通知到其他线程,Volatile 变量不会被缓存在寄存器或者对其他处理器不可见的地方,因此在读取 Volatile 类型的变量时总会返回最新写入的值

- 加锁机制既可以确保可见性又可以确保原子性,而 Volatile 变量只能确保可见性,所以又称为轻量锁

- 将 Volatile 修饰的变量转成汇编语言,发现添加了 lock 前缀,lock 会导致处理器独占总线,进而处理器独占系统共享内存:

  - <font color="red">Lock 指令将当前处理器缓存行的数据写回到系统内存</font>
  - <font color="red">这个写回内存的操作会使其他 cpu 里面缓存了该内存地址的数据无效</font>

  > 缓存一致性: 每个处理器通过嗅探在总线上传播的数据来检查自己的缓存是不是过期了,如果发现自己缓存行对应的内存地址被修改了,会将缓存行设置成无效,在重新请求该数据的时候,会重新从系统内存中读取数据到处理器缓存中

---

### synchronized

- 具体表现三种形式:

  - 对于普通同步方法: 锁是当前的实例对象
  - 对于静态同步方法: 锁是当前类 class 对象
  - 对于同步代码块: 锁是括号中配置的对象

- 基于同步代码块的锁实现

  - 通过 monitorenter 和 monitorexit 来实现
  - 在代码块开始处添加 monitorenter,代码块结束和异常处添加 monitorexit
  - 任何对象都有一个 monitor 与之关联,当一个 monitor 被持有之后,对象就会变成锁定状态
  - 线程执行到 monitorenter 处,会尝试去获取该对象对应 monitor 的所有权(即对象的锁)

- java 对象头

  - synchronized 所用的锁时存储在 java 对象头中
  - java 对象头包括 Mark Word(存储对象的 hashCode 或锁信息), Class MetaData Address(存储到对象类型数据的指针)和 Array Length(数组长度如若当前对象是数组)
  - Mark Word(分 32bit 和 64bit)在不同状态锁下的变化

    <img src="https://i.loli.net/2019/07/17/5d2edc4133a1d93211.png">

- 锁的升级与对比

  - 级别由低到高`(只能升不能降)`: 无锁状态 -> 偏向锁状态 -> 轻量锁状态 -> 重量级锁状态

  - 偏向锁的获取和撤销流程:

    - 线程 A 在获取锁时, 会测试对象头的 Mark Word 和线程栈帧的锁记录里是否存在着指定当前线程的偏向锁, 测试成功线程 A 就会获取锁.
    - 如果测试失败则会再测试 Mark Word 中偏向锁的标识是否是 <font color="green">1(表明当前是偏向锁)</font>,是则会尝试使用`CAS`将对象头的偏向锁指向当前线程 A,如果`CAS`获取失败,则表示有竞争, 会在全局安全点时, 挂起持有偏向锁的线程, `将偏向锁升级为轻量锁`, 然后阻塞在安全点的线程继续往下执行.
    - <font color="green">偏向锁使用了一种等到竞争才会释放的锁的机制</font>,只有当其他线程尝试竞争偏向锁时,持有偏向锁的线程才会释放锁. 偏向锁的撤销,需要等待<font color="green">全局安全点(在这个时间点上没有正在执行的字节码)</font>, 会暂停拥有偏向锁的线程,其次检查持有偏向锁的线程是否还存活.
    - 如果线程仍活着,拥有偏向锁的栈会被执行，遍历偏向对象的锁记录,栈中的锁记录和对象头的 Mark Word 要么`重新偏向于其他线程`,`要么恢复到无锁或者标记对象不适合作为偏向锁,然后唤醒暂停的线程.如果不处于活动状态,就会将对象头设置为无锁状态`.

        <img title="偏向锁的获取和撤销流程" src="https://i.loli.net/2019/07/17/5d2ed459683b482153.png">

      > 偏向锁`JDK1.6`之后默认延迟打开, 可以通过`-XX: BiasedLockingStartupDelay=0`来关闭延迟启动, 或使用 `-XX: -UseBiasedLocking=false`来关闭偏向锁,程序默认会进入轻量锁状态.

  - 轻量锁获取与撤销流程:

    - 在执行同步代码块之前,如果同步对象的状态是无锁状态, 那么 JVM 会在当前线程的栈帧中建立一个名为`锁记录(Lock Record)`的空间, 用于存储对象头中的 Mark Word 拷贝(官方称为 Displaced Mark Word)

    - Mark Word 复制到锁记录中成功后, JVM 使用`CAS`尝试将对象头中的 Mark Word 更新为指向`Lock Record`的指针, 并将 Lock Record 中 owner 指针指向 Mark Word

        <img title="图片来源: https://www.cnblogs.com/paddix/p/5405678.html" src="https://i.loli.net/2019/07/17/5d2ee7449fe3281316.png">

    - 如果更新成功, 那么线程就拥有对象的锁, 并将对象头中的 Mark Word 锁标识位设置成 00

    - 如果更新操作失败, JVM 会检查对象的 Mark Word 是否指向当前线程的栈帧, 如果是就说明当前线程已持有这个对象的锁, 然后就直接进入同步代码块执行, 否则就说明多个线程竞争锁,此时`轻量锁膨胀为重量锁, 锁标识位变成'10', Mark Word中存储的就是指向重量级锁的指针, 后面等待锁的线程也要进入阻塞状态`, 而当前线程为了获取锁,会使用<font color="red">自旋</font>来尝试获取锁.

      > 自旋(spinlock): 是指当一个线程在获取锁的时候，如果锁已经被其它线程获取，那么该线程将循环等待，然后不断的判断锁是否能够被成功获取，直到获取到锁才会退出循环。

---

### ThreadLocal

_ThreadLocal 类能使线程中的某个值与保存值的对象关联起来,通过 get&set 方法为每个使用该变量的线程都保有一份独立的副本_

---

### Final

_Final 用于构造不可变对象,Final 类型的域时不可变的,但是如果 Final 域引用的对象是可变的,那么就可以修改_

---

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
