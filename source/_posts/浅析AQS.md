---
title: 浅析AQS
top: true
date: 2019-08-15 15:04:47
tags: Java Concurrent
toc: true
categories:
  - Java Concurrent
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4mghnm1y2j30sg0lcaan.jpg
---

## 同步器

_AbstractQueuedSynchronizer(简称 AQS)是用来构建锁或者其他同步组件的基础框架, 它使用了一个 int 成员变量表示同步状态, 通过内置的 `FIFO双向` 队列来完成同步状态的管理. 同步器的主要使用方式是`继承`, 子类通过`继承同步器并实现它的抽象方法`来管理同步状态_

### 同步器概念

- 同步器是实现锁(也可以任意同步组件)的关键, 在锁的实现中聚合同步器, 利用同步器实现锁的语义.
- 锁是`面向使用者`的, 同步器`面向的是锁的实现者`
- 同步器拥有`独占(排他)模式: 其他线程对状态的获取会被阻止`和`共享模式: 多个线程获取状态都可以成功`
- 同步器可重写的方法

  <img src="https://ae01.alicdn.com/kf/H8ff733ff598947acbe4cfe6699d3bc81d.jpg">

  <img src="https://ws3.sinaimg.cn/large/006Xmmmgly1g5y51pl3fhj30xd08ijul.jpg">

<!--more-->

- 同步器使用了的模板方法设计模式

  > 模板方法模式是类的行为模式. 准备一个抽象类, `将部分逻辑以具体方法以及具体构造函数的形式实现, 然后声明一些抽象方法来迫使子类实现剩余的逻辑`. `不同的子类可以以不同的方式`实现这些抽象方法, 从而对剩余的逻辑有不同的实现.

---

### 同步队列

- Node

  _Node 作为 AQS 类的内部类, 是构成 FIFO 双向队列的元素_

- Node 的成员变量及构造

```java
static final class Node {
        /**
         * 节点状态
         * CANCELLED 1: 节点取消
         * SIGNAL -1: 节点等待触发
         * CONDITION -2: 节点等待条件
         * PROPAGATE -3: 节点状态需要向后传播。
         * 只有当前线程的前一个节点是SIGNAL时, 当前线程才会挂起
         */
        volatile int waitStatus;

        // 前一个Node
        volatile Node prev;

        // 下一个Node
        volatile Node next;

        /**
         * 加入队列时的线程
         */
        volatile Thread thread;

        /**
         * 存储condition队列中的后继节点
         */
        Node nextWaiter;

        // 用于head node 或 tail node的初始化
        Node() {
        }

        // 用于addWaiter方法
        Node(Thread thread, Node mode) {
            this.nextWaiter = mode;
            this.thread = thread;
        }

        // 用于Condition
        Node(Thread thread, int waitStatus) {
            this.waitStatus = waitStatus;
            this.thread = thread;
        }
    }
```

> Node 类中的四种 waitStatus
> `CANCELED(1)`: 因为等待超时(timeout)或者中断(interrupt), 节点会被置为取消状态. 处于取消状态的节点不会再去竞争锁, 也就是说不会再被阻塞. 节点会一直保持取消状态, 而不会转换为其他状态. 处于 CANCELED 的节点会被移出队列, 被 GC 回收.
> `SIGNAL(-1)`: 表明当前的后继结点正在或者将要被阻塞(通过使用 LockSupport.pack 方法), 因此当前的节点被释放(release)或者被取消时(cancel)时, 要唤醒它的后继结点(通过 LockSupport.unpark 方法).
> `CONDITION(-2)`: 表明当前节点在条件队列中, 因为等待某个条件而被阻塞.
> `PROPAGATE(-3)`: 在共享模式下可以认为资源有多个, 因此当前线程被唤醒之后, 可能还有剩余的资源可以唤醒其他线程. 该状态用来表明后续节点会传播唤醒的操作. 需要注意的是只有头节点才可以设置为该状态.
> 0：新创建的节点会处于这种状态
> 资料来源: <a href="http://blog.zhangjikai.com/2017/04/15/%E3%80%90Java-%E5%B9%B6%E5%8F%91%E3%80%91%E8%AF%A6%E8%A7%A3-AbstractQueuedSynchronizer/">Java 并发详解</a>

---

### 同步器源码浅析

#### 独占锁获取

_acquires(阻塞)在`独占模式`下, 会忽略 interrupts 中断, 通过调用至少一次 tryAcquire(非阻塞)来实现成功返回,否则线程会进入等待队列, 直到调用 tryAcquire 成功_

- 独占模式的方法入口

```java
public final void acquire(int arg) {
    // 这里调用的是子类重写的tryAcquire方法, 尝试更改状态,更改成功返回
	if (!tryAcquire(arg) &&
        // acquireQueued()返回是否被中断过,因为不能及时响应中断,只有在获取锁之后返回true, 调用selfInterrupt()中断
		acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
		selfInterrupt();
}
```

> acquire()方法作为独占模式的方法入口, 会尝试使用`tryAcquire(此类方法一般由子类实现)`方法去获取锁(或叫修改状态).
> 如果无法成功获取, 会将当前 Thread 构建成 Node 节点加入 Sync 队列, 队列中的每个线程都是一个 Node 的节点,构成了`类似 CHL 的双向队列`.
> 如果 tryAcquire 无法获取锁且 acquireQueued 返回 true(`当前线程被中断过`), 则会执行 selfInterrupt 方法打断当前线程.

- 子类重写的 tryAcquire(非源码)

```java
@Override
protected boolean tryAcquire(int arg) {
    // CAS 修改状态: 如果状态为 0,就设成 1
    if (compareAndSetState(0, 1)) {
        // 设置拥有独占访问权的线程
        setExclusiveOwnerThread(Thread.currentThread());
        return true;
    }
    return false;
}
```

> 在 tryAcquire()方法中获取锁需要使用 CAS 方法保证原子性

- 将没有成功修改状态的线程构建成 Node 添加到 sync 队列尾部

```java
private Node addWaiter(Node mode) {
    /**
     * mode 值: Node.SHARED Node.EXCLUSIVE
     */
    Node node = new Node(Thread.currentThread(), mode);
    // 新建名为 pred 的 Node 对象引用指向 tail节点
    Node pred = tail;
    // 如果 pred 不为 null,说明当前队列存在 tail 尾节点
    if (pred != null) {
        // 设置 tail 尾节点为当前 node 节点的 prev 节点
        node.prev = pred;
        // 通过 CAS 设置 node 节点为新的尾节点
        if (compareAndSetTail(pred, node)) {
            // 设置成功的话会将原尾节点的 next 指向新的 node 节点
            pred.next = node;
            return node;
        }
    }
    // 如果没有 tail 尾节点,执行 enq 方法
    enq(node);
    // 返回新加入队列的node节点
    return node;
}

// 循环执行直到插入节点到队列中,按需初始化
private Node enq(final Node node) {
    // 死循环执行, 目的是为了节点正确添加
    for (;;) {
     // 第一次: 新建的 Node 对象 t 引用指向 tail节点  第二次: tail 不为 null, t 也不为 null
        Node t = tail;
        // 如果 t 为 null, 进行初始化
        if (t == null) { // Must initialize
            // 创建新的 Node 并使用 CAS 将其设置成 head 头节点
            if (compareAndSetHead(new Node()))
                // 如果 head 头节点设置成功, tail 节点指向 head 节点, 此时队列中就一个节点
                tail = head;
        } else {
            // 第二次走 else, 设置 node 的 prev 节点为尾节点
            node.prev = t;
            // 尝试通过 CAS 将 node 节点设置为尾节点
            if (compareAndSetTail(t, node)) {
                // 设置成功后设置原尾节点的 next 指向 node 节点, 此时队列中有两个节点
                t.next = node;
                // 打断死循环
                return t;
            }
        }
    }
}
```

<img src="https://ws2.sinaimg.cn/large/006Xmmmggy1g60h1gfmf4j30nu07ewgr.jpg">

> addWaiter 方法中如果 tail 节点是不为 null, 则会通过 `CAS 方法将 node 节点添加到队列尾部`, 如果 tail 节点为 null ,则调用 enq 方法(`循环执行直到node插入到队列中`)将 node 节点加入队列尾部.

- acquireQueued 方法中将当前线程挂起等待唤醒并返回是否被中断

```java
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
    boolean interrupted = false;
    // 死循环执行
    for (;;) {
        // node.predecessor(): 返回 Node 的 prev 节点
        final Node p = node.predecessor();
        // 查看 p 节点是否是 head 头节点, 如果相等说明 node 是第二个节点, 然后尝试 CAS 修改状态
        if (p == head && tryAcquire(arg)) {
            // 如果 CAS 修改成功, 设置 node 节点为 head 头节点, 并删除原 head节点
            setHead(node);
            // 将 head节点的 next 置为 null(方便 GC 清理)
            p.next = null; // help GC
            // 修改 failed 状态
            failed = false;
            // 返回中断状态
            return interrupted;
        }
        // 如果 node 的 prev 节点不是队列的 head 节点 或 node 的 prev节点时 队列的 head 节点但无法获取锁
        // shouldParkAfterFailedAcquire 检查是否可以挂起当前线程, parkAndCheckInterrupt则是挂起当前线程
        if (shouldParkAfterFailedAcquire(p, node) &&
        parkAndCheckInterrupt())
            // interrupted表明当前线程被中断过
            interrupted = true;
        }
    } finally {
        //如果有异常
        if (failed)
            //取消请求，将当前节点从队列中移除,这个方法后面解析
            cancelAcquire(node);
    }
}

```

<img src="https://ws2.sinaimg.cn/large/006Xmmmggy1g60hiitmy6j30mq069q4t.jpg">

> 需要注意的是:
>
> 1. 如果 node 节点的 prev 节点是 head 节点, 那么会使用`自旋(循环)`的方式不断请求锁, 直到成功获取锁
> 2. 成功获取锁之后, 因为已经获取锁(修改状态), 设置头节点的方法`并不需要使用 CAS 来保证`, 它只需要将`首节点设置成为原首节点的后继节点`并`断开原首节点的 next 引用`即可
> 3. 如果当前 node 节点的 prev 节点不是 head 节点或前继节点无法获取锁, 那么会检查是否可以挂起当前线程(`Node.SIGNAL可以挂起`)
> 4. 如果在整个等待过程中被中断过，则返回 true，否则返回 false. `如果线程在等待过程中被中断过, 它是不响应的. 只是获取锁后才再进行自我中断 selfInterrupt(), 将中断补上`.

- 检查是否可以挂起当前线程

```java
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    // 获取node的prev节点的waitStatus
    int ws = pred.waitStatus;
    // 如果node前继节点等待状态是Node.SIGNAL, 则可以安全的挂起node节点对应的线程
    if (ws == Node.SIGNAL)
        return true;
    if (ws > 0) {
        // 表明当前线程的前继节点处于 CANCELED 的状态
        do {
            // 获取前继节点的前一个节点
            node.prev = pred = pred.prev;
            // 向前查找直到第一个waitStatus<=0的pred节点
        } while (pred.waitStatus > 0);
            // 将pred的next设置为node节点
            pred.next = node;
    } else {
        //使用CAS将node的前继节点的waitStatus修改为Node.SIGNAL
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    return false;
}
```

> 如果 `node 的前继节点的 waitStatus 是 Node.SIGNA`L, 说明`node 的前继节点在 release 的时候会通知 node 节点`, 所以可以安全的挂起 node 对应的线程.
> 如果队列中的节点的 waitStatus 为 `CANCELED`, 表明这个节点会失效, 随时会被 GC 掉

- 挂起当前线程等待唤醒并返回中断状态

```java
private final boolean parkAndCheckInterrupt() {
    // 挂起线程等待unpark
    LockSupport.park(this);
    // 返回当前线程中断状态并重置中断状态为false
    return Thread.interrupted();
}
```

> 需要注意的是:
> Thread.interrupted 方法调用的 currentThread().isInterrupted(true)表明: `在返回当前线程的中断状态之后, 会将线程中断状态重置为false;`
> 因为 node 的 waitStatus 是 Node.SIGNAL, 所以在 node 的前继节点 release 的时候会唤醒 node 节点

- 独占锁获取流程

<img src="https://ae01.alicdn.com/kf/H258e0712847540a6b26587efd099c9c7u.jpg">

#### 独占锁释放

```java
public final boolean release(int arg) {
    // 调用子类的tryRelease()方法
    if (tryRelease(arg)) {
        // 获取head头节点
        Node h = head;
        // 如果head不为null且waitStatus不为0
        if (h != null && h.waitStatus != 0)
            //
            unparkSuccessor(h);
        return true;
    }
    return false;
}

private void unparkSuccessor(Node node) {
    // 获取节点的waitStatus
    int ws = node.waitStatus;
    if (ws < 0)
        // 如果ws小于0, 将其设置成初始状态0
        compareAndSetWaitStatus(node, ws, 0);
    // 获取node(也是head头节点)的next节点
    Node s = node.next;
    // 如果next节点为null 或 next节点的waitStatus为CANCELLED
    if (s == null || s.waitStatus > 0) {
        s = null;
        // 从tail尾节点向前查找直到不为CANCELLED的节点
        for (Node t = tail; t != null && t != node; t = t.prev)
            if (t.waitStatus <= 0)
                s = t;
    }
    // 唤醒离head头节点最近的节点
    if (s != null)
        LockSupport.unpark(s.thread);
}
```

> 需要注意的是:
>
> 1. 独占锁的释放是不存在竞争的, 如果 tryRelease()不成功说明当前线程没有锁
> 2. 在 unparkSuccessor 方法中, 如果发现`头节点的后继结点为 null 或者处于 CANCELLED 状态, 会从 tail 尾部往前找离头节点最近的需要唤醒的节点`, 然后唤醒该节点.

#### 共享锁获取

#### 共享锁释放
