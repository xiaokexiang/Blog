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

- 同步器的模板方法

  <img src="https://ws2.sinaimg.cn/large/006Xmmmggy1g5y53u9h0nj30xl0k5qfl.jpg">

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

- Node 设置尾节点

<img src="https://ws2.sinaimg.cn/large/006Xmmmggy1g60h1gfmf4j30nu07ewgr.jpg">

> 同步器拥有`首节点(head)`和`尾节点(tail)`, 没有成功获取同步状态的线程将使用`Node(Thread thread, Node mode)`构造成为 Node 节点, 通过`compareAndSetTail方法(CAS的线程安全方法)`设置成功后, 加入该队列的尾部, 与之前的尾节点建立连接

- Node 设置首节点

<img src="https://ws2.sinaimg.cn/large/006Xmmmggy1g60hiitmy6j30mq069q4t.jpg">

> 设置首节点是通过获取同步状态成功的线程来完成的, 由于只有一个线程能够成功获取到同步状态, 因此设置头节点的方法`并不需要使用 CAS 来保证`, 它只需要将`首节点设置成为原首节点的后继节点`并`断开原首节点的 next 引用`即可

- 自定义 Lock

```java
public class MyLock implements Lock {
    /**
     * 自定义Lock通过自定义同步器SyncQueue实现
     * 有些方法是调用同步器原有的方法,有些是调用自定义同步器中的方法
     */
    public static class SyncQueue extends AbstractQueuedSynchronizer {

        // 判断是否被当前线程占用
        @Override
        protected boolean isHeldExclusively() {
            return getState() == 1;
        }

        // 获取lock
        @Override
        protected boolean tryAcquire(int arg) {
            // 如果状态为0,就设成1
            if (compareAndSetState(0, 1)) {
                // 设置拥有独占访问权的线程
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }

        // 释放lock,状态设为0
        @Override
        protected boolean tryRelease(int arg) {
            // 如果为0说明已经释放过锁,抛出异常
            if (getState() == 0) {
                throw new IllegalMonitorStateException();
            }
            // 设置当前独占线程为null
            setExclusiveOwnerThread(null);
            // 将锁重置为0
            setState(0);
            return true;
        }

        // 将锁与当前condition条件队列关联, 为了实现wait,notify等功能
        Condition newCondition() {
            return new ConditionObject();
        }
    }

    private final SyncQueue syncQueue = new SyncQueue();

    @Override
    public void lock() {
        syncQueue.acquire(1);
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {
        syncQueue.acquireInterruptibly(1);
    }

    @Override
    public boolean tryLock() {
        return syncQueue.tryAcquire(1);
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return syncQueue.tryAcquireNanos(1, unit.toNanos(time));
    }

    @Override
    public void unlock() {
        syncQueue.release(1);
    }

    @Override
    public Condition newCondition() {
        return syncQueue.newCondition();
    }
}
```

---

### 同步器源码浅析

#### 独占式修改状态

_acquires(阻塞)在`独占模式`下, 会忽略 interrupts 中断, 通过调用至少一次 tryAcquire(非阻塞)来实现成功返回,否则线程会进入等待队列, 直到调用 tryAcquire 成功_

```java
/**
 * 1. 独占模式的方法入口
 */
public final void acquire(int arg) {
    // 这里调用的是子类重写的tryAcquire方法, 尝试更改状态,更改成功返回
	if (!tryAcquire(arg) &&
		acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
		selfInterrupt();
}

/**
 * 2. 子类重写的tryAcquire(非源码)
 */
@Override
protected boolean tryAcquire(int arg) {
    // CAS修改状态: 如果状态为0,就设成1
    if (compareAndSetState(0, 1)) {
        // 设置拥有独占访问权的线程
        setExclusiveOwnerThread(Thread.currentThread());
        return true;
    }
    return false;
}

/**
 * 3. 如果成功修改状态,会调用selfInterrupt方法中断当前线程
 */
static void selfInterrupt() {
    Thread.currentThread().interrupt();
}

/**
 * 4. 将没有成功修改状态的线程构建成Node添加到sync队列尾部
 */
private Node addWaiter(Node mode) {
    /**
      * mode值: Node.SHARED Node.EXCLUSIVE
      *
      *  currentThread, Node.EXCLUSIVE 构造Node对象
      */
    Node node = new Node(Thread.currentThread(), mode);
    // 创建名为pred的Node对象指向尾节点tail
    Node pred = tail;
    // 如果pred不为null,说明当前队列存在tail尾节点
    if (pred != null) {
        // 设置tail尾节点为当前node节点的prev节点
        node.prev = pred;
        // 通过CAS设置node节点为新的尾节点
        if (compareAndSetTail(pred, node)) {
            // 设置成功的话会将原尾节点的next指向新的node节点
            pred.next = node;
            return node;
        }
    }
    // 如果没有tail尾节点,执行enq方法
    enq(node);
    return node;
}

/**
 * 5. 插入节点到队列中,按需初始化
 */
private Node enq(final Node node) {
    // 死循环执行
    for (;;) {
        // 第一次: 新建Node对象t指向tail尾节点 第二次: tail不为null, t也不为null
        Node t = tail;
        // 如果t为null, 进行初始化
        if (t == null) { // Must initialize
            // 创建新的Node并使用CAS将其设置成head头节点
            if (compareAndSetHead(new Node()))
                // 如果head头节点设置成功, 将tail尾节点指向头节点
                tail = head;
        } else {
            // 第二次走else, 设置node的prev节点为尾节点
            node.prev = t;
            // 尝试通过CAS将node节点设置为尾节点
            if (compareAndSetTail(t, node)) {
                // 设置成功后设置原尾节点的next指向node节点
                t.next = node;
                // 打断死循环
                return t;
            }
        }
    }
}

/**
 * 6. 传入已加入队里尾部的Node节点
 */
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        // 死循环执行
        for (;;) {
            // node.predecessor(): 返回Node的prev节点
            final Node p = node.predecessor();
            // 查看p节点是否是head头节点, 如果相等说明node是第二个节点, 然后尝试CAS修改状态
            if (p == head && tryAcquire(arg)) {
                // 如果CAS修改成功, 设置node节点为head头节点
                setHead(node);
                // 将node节点的pre节点的next置为null(方便GC清理)
                p.next = null; // help GC
                // 修改failed状态
                failed = false;
                // 返回中断状态
                return interrupted;
            }
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}

/**
 * 7. 如果node节点不符合条件, 挂起线程
 */
 private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    int ws = pred.waitStatus;
    if (ws == Node.SIGNAL)
        /*
            * This node has already set status asking a release
            * to signal it, so it can safely park.
            */
        return true;
    if (ws > 0) {
        /*
            * Predecessor was cancelled. Skip over predecessors and
            * indicate retry.
            */
        do {
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        pred.next = node;
    } else {
        /*
            * waitStatus must be 0 or PROPAGATE.  Indicate that we
            * need a signal, but don't park yet.  Caller will need to
            * retry to make sure it cannot acquire before parking.
            */
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    return false;
}

/**
 * 8. 挂起当前线程等待唤醒
 */
private final boolean parkAndCheckInterrupt() {
    LockSupport.park(this);
    return Thread.interrupted();
}
```

#### 共享式修改状态
