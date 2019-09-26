---
title: 浅析AQS
date: 2019-08-15 15:04:47
tags: Java Concurrent
toc: true
categories:
  - Java Concurrent
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4mghnm1y2j30sg0lcaan.jpg
---

## 同步器

_AbstractQueuedSynchronizer(简称 AQS)是用来构建锁或者其他同步组件的基础框架, 它使用了一个 int 成员变量表示同步状态, 采用基于 `CLH队列的变种(CLH节点会自旋,而AQS的node会阻塞, 只有前继节点是头结点才会自旋获取状态)`来完成同步状态的管理. 同步器的主要使用方式是`继承`, 子类通过`继承同步器并实现它的抽象方法`来管理同步状态_

### 同步器概念

- 同步器是实现锁(也可以任意同步组件)的关键, 在锁的实现中聚合同步器, 利用同步器实现锁的语义.
- 锁是`面向使用者`的, 同步器`面向的是锁的实现者`
- 同步器的队列包括`sync`队列和`condition`条件队列
- 同步器拥有`独占(排他)模式: 其他线程对状态的获取会被阻止`和`共享模式: 多个线程获取状态都可以成功`
- 同步器可重写的方法

  <img src="https://ae01.alicdn.com/kf/H97106cdd6b0b45058ed8bc3c089613ceg.png">
  <img src="https://ae01.alicdn.com/kf/Hdb2eba8955dd43a08e8d4b89d261d8f22.png">

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

> 1. acquire()方法作为独占模式的方法入口, 会尝试使用`tryAcquire(此类方法一般由子类实现)`方法去获取锁(或叫修改状态)
> 2. 如果无法成功获取, 会将当前 Thread 构建成 Node 节点加入 Sync 队列, 队列中的每个线程都是一个 Node 的节点,构成了`类似 CHL 的双向队列`.
> 3. 如果 tryAcquire 无法获取锁且 acquireQueued 返回 true(`当前线程被中断过`), 则会执行 selfInterrupt 方法打断当前线程.

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

<!-- <img src="https://ws2.sinaimg.cn/large/006Xmmmggy1g60h1gfmf4j30nu07ewgr.jpg"> -->

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
        // 只有当node的前继节点时head头节点的时候才尝试去获取同步状态
        // 因为只有前继节点是head节点, release的时候才会唤醒后继节点
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

> 1. 如果 `node 的前继节点的 waitStatus 是 Node.SIGNA`L, 说明`node 的前继节点在 release 的时候会通知 node 节点`, 所以可以安全的挂起 node 对应的线程.
> 2. 如果队列中的节点的 waitStatus 为 `CANCELED`, 表明这个节点会失效, 随时会被 GC 掉

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
>
> 1. Thread.interrupted 方法调用的 currentThread().isInterrupted(true)表明: `在返回当前线程的中断状态之后, 会将线程中断状态重置为false;`
> 2. 因为 node 的 waitStatus 是 Node.SIGNAL, 所以在 node 的前继节点 release 的时候会唤醒 node 节点

- 独占锁获取流程

<img border="1" src="https://ae01.alicdn.com/kf/H89b76c457c614027917a7ddebebca103g.jpg">

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

---

#### 共享锁获取

- 共享锁方法入口

```java
public final void acquireShared(int arg) {
    // tryAcquireShared(arg)由具体的lock实现, 与独占锁不同的是这里通过返回的int值进行判断而不是boolean
    if (tryAcquireShared(arg) < 0)
        doAcquireShared(arg);
}

private void doAcquireShared(int arg) {
    // 除了node mode其余和独占锁一致, 构建(currentThread, Node.SHARED)添加到sync队列尾部并返回新增节点(简称SN)
    final Node node = addWaiter(Node.SHARED);
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            // 获取SN前驱节点
            final Node p = node.predecessor();
            // 判断前驱节点是不是head头节点
            if (p == head) {
                // 调用子类的实现类尝试去获取锁
                int r = tryAcquireShared(arg);
                // 当获取共享锁成功, 需要唤醒后继节点
                if (r >= 0) {
                    setHeadAndPropagate(node, r);
                    p.next = null; // help GC
                    if (interrupted)
                        selfInterrupt();
                    failed = false;
                    return;
                }
            }
            // 查看当前线程是否需要挂起, 需要就挂起当前线程
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

> 需要注意的是:
>
> 1. 共享锁在构建 Node 时, mode 为 Node.SHARE. 而独占锁为 Node.EXCLUSIVE
> 2. 独占锁的 tryAcquire 方法返回的是 boolean 值. 共享锁的 tryAcquireShared 返回的是 int 值, 其中:
>    `返回值小于0，则代表当前线程获取共享锁失败` > `返回值大于0，则代表当前线程获取共享锁成功，并且接下来其他线程尝试获取共享锁的行为很可能成功` > `返回值值等于0，则代表当前线程获取共享锁成功，但是接下来其他线程尝试获取共享锁的行为会失败`

- setHeadAndPropagate(node, r)

`独占锁在释放锁时会唤醒后继节点(setHead)，而共享锁在获取和释放锁的时候都会唤醒后继节点(setHeadAndPropagate)，这是最大的不同`

```java
private void setHeadAndPropagate(Node node, int propagate) {
    // 记录原有的head用于后面对比
    Node h = head;
    // 将SN设置为队列的新head头节点(独占锁也拥有此方法)
    setHead(node);
    // 原头节点h==null 或 h.waitStatus<0, 现头节点head==null 或 head.waitStatus<0
    // waitStatus包括CANCELLED,SIGNAL和PROPAGATE三种，因为shouldParkAfterFailedAcquire()会修改为SIGNAL,所以这里用<0
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        (h = head) == null || h.waitStatus < 0) {
        Node s = node.next;
        // 判断SN后继节点是否为null 或 SN后继节点若在共享模式下等待就返回true
        if (s == null || s.isShared())
            // 唤醒后继节点
            doReleaseShared();
    }
}

static final Node SHARED = new Node();
Node(Thread thread, Node mode) {
    this.nextWaiter = mode;// 构建共享node的时候, mode值为Node.SHARED
    this.thread = thread;
}
// 节点在共享模式下等待就返回true
final boolean isShared() {
    // nextwaiter只是标记作用, 判断当前节点是否处于共享模式下, 并不存在于sync队列中
    return nextWaiter == SHARED;
}

```

> 其中需要注意的是：
>
> 1. propagate(也就是 tryAcquireShared 的返回值) > 0, 表示接下来其他线程获取同步状态有可能成功
> 2. 相对独占锁释放锁唤醒后继节点, 共享锁在`获取锁和释放锁时`都要唤醒后继节点

- doReleaseShared

在 setHeadAndPropagate()法中, `持有锁的线程`会调用 doReleaseShared()方法. 而在 releaseShared()中, `曾经持有锁和现在持有锁的线程`会调用 doReleaseShared()方法`(因为持有共享锁的线程可以有多个)`, 但`目的都是用于唤醒head头节点的下一个节点`

```java
private void doReleaseShared() {
    for (;;) {
        Node h = head;
        // 如果当前head头节点不为null 且 队列不止一个node节点
        if (h != null && h != tail) {
            int ws = h.waitStatus;
            // 如果head头节点waitStatus为Node.SIGNAL 调用CAS unparkSuccessor符合的后继节点
            if (ws == Node.SIGNAL) {
                // CAS将waitStatus保证只有一个节点能唤醒成功, 并将waitStatus改为0
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                    continue;
                // 唤醒符合条件的后继节点
                unparkSuccessor(h);
            }
            // 只有新的共享NodeSync加入队列的时候, waitStatus才会为0, 其次tail尾节点入队的时候会通过
            //shouldParkAfterFailedAcquire()方法将tail尾节点的前继节点ws修改为SIGNAL
            else if (ws == 0 &&
                        // 只有当tail尾节点ws不是0的时候(新的tail尾节点入队并修改原tail节点ws为Node.SIGNAL)
                        //compareAndSetWaitStatus的值才为false, 在下个循环时唤醒这个准备挂起的新tail尾节点
                        !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))
                continue;
        }
        // h == head 表明当前的head头节点没有易主
        if (h == head)
            break;
    }
}
```

> 需要注意的是:
>
> 1. 假设队列中有 A->B->C 三个节点, 如果 A 获取了共享锁, 调用了 doReleaseShared[A]方法, 并在方法中唤醒了 A 的后继节点 B, B 在执行的时候, doReleaseShared[A]方法还没结束, 它执行到`if (h == head)`的时候发现 head 头节点是 B 了, 所以继续自旋, 直到唤醒最后一个共享节点. 其原因就是`共享锁是可以多个线程获取, unparkSuccessor唤醒的下个节点极有可能获取共享锁并成为了新的head头节点`
> 2. doReleaseShared()方法的目的是当前共享锁是可获取的状态时, 唤醒 head 节点的后继节点, 但是与独占锁不同的是： `在共享锁的唤醒过程中, 头节点发生变化后, 是会回到循环中再立即唤醒新head的后继节点的`
> 3. if (ws == 0 && !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))只有当`新share node入队时ws才会等于0, 以及更新的share node入队通过shouldParkAfterFailedAcquire()修改了新入队的share node的ws时!compareAndSetWaitStatus(h, 0, Node.PROPAGATE)才会为true`
> 4. 只有当前的 head 头节点没有易主的时候, 才会跳出 doReleaseShared()方法的自旋
>    资料来源: https://segmentfault.com/a/1190000016447307

- 共享锁获取流程图

<img src="https://ae01.alicdn.com/kf/He1394e7af6fa4d58b2e58ff3182066a7a.jpg">

#### 共享锁释放

```java
public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) {
        // 调用doReleaseShared()释放共享锁, 唤醒符合的后继等待共享节点
        doReleaseShared();
        return true;
    }
    return false;
}
```

---

### CAS 的简单实现

#### 获取 Unsafe 的实例

- 使用 Unsafe 提供的方法

```java
private final Unsafe unsafe = Unsafe.getUnsafe();

```

- 使用反射
  `Unsafe规定了必须由BootClassLoader加载 否则报错, 所以用反射`

```java
public class UnsafeInstance {
    public static Unsafe reflectGetUnsafe() {
        try {
            Field field = Unsafe.class.getDeclaredField("theUnsafe");
            field.setAccessible(true);
            return (Unsafe) field.get(null);
        } catch (Exception e) {
            throw new Error(e);
        }
    }
}

```

#### 自定义 CAS 方法

```java
public class CustomUnsafe {
    // state 对应的偏移量, 用于CAS的参数
    private static final long OFFSET;
    // Unsafe规定了必须由BootClassLoader加载 否则报错, 所以用反射
    private final Unsafe unsafe = UnsafeInstance.reflectGetUnsafe();

    static {
        try {
            // 初始化的时候加载state字段对应的offset偏移量
            OFFSET = Unsafe.getUnsafe().objectFieldOffset(Node.class.getDeclaredField("state"));
        } catch (Exception e) {
            throw new Error(e);
        }
    }

    // 修改state
    public boolean compareAndSwapState(Node node, int state, int update) {
        return unsafe.compareAndSwapInt(node, OFFSET, state, update);
    }

    // 修改Node对象
    public boolean compareAndSwapObject(Node expect, Node update) {
        return unsafe.compareAndSwapObject(this, OFFSET, expect, update);
    }

    // 构建Node对象
    private class Node {
        // 通过修改state状态来得出是否实现CAS
        private volatile int state;
    }
}

```
