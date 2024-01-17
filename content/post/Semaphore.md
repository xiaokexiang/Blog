---
title: "Semaphore共享锁源码解析"
date: 2020-06-20T16:09:38+08:00
description: "Semaphore是基于AQS的`可重入共享锁`，具有公平和非公平模式。"
tags: ["Semaphore ","AQS"]
categories: [
  "Concurrent"
]
hideReadMore: true
slug: concurrent_semaphore
---
### acquire

```java
// 共享锁可以立即响应中断异常
public void acquire() throws InterruptedException {
    sync.acquireSharedInterruptibly(1);
}
public final void acquireSharedInterruptibly(int arg)
    throws InterruptedException {
    // 如果线程被中断立即抛出异常
    if (Thread.interrupted())
        throw new InterruptedException();
    if (tryAcquireShared(arg) < 0)
        doAcquireSharedInterruptibly(arg);
}
```

共享锁tryAcquireShared()与独占锁tryAcquire()的不同在于。前者的返回值存在三种情况，后者只有两种情况(true/false)。

| tryAcquireShared 值 |             是否获取锁             |
| :-----------------: | :--------------------------------: |
|          0          | 获取共享锁成功，后续获取可能不成功 |
|         < 0         |           获取共享锁失败           |
|         > 0         |  获取共享锁成功，后续获取可能成功  |

#### tryAcquireShared

```java
protected int tryAcquireShared(int acquires) {
    return nonfairTryAcquireShared(acquires);
}
// 默认是采用了非公平获取锁的方式
final int nonfairTryAcquireShared(int acquires) {
    for (;;) {
        int available = getState();
        int remaining = available - acquires;
        // 如果remaining>=0时就一直自旋CAS修改state状态
        if (remaining < 0 ||
            compareAndSetState(available, remaining))
            return remaining;
    }
}
```

> 为什么remaining=0的时候也要尝试去修改状态，因为这个时候可能有其他线程释放了共享锁，所以有概率能获取到锁。
>
> 如果tryAcquireShared的返回值小于0，说明此时没有锁可以获取，执行入队等相关操作。

#### doAcquireSharedInterruptibly

```java
private void doAcquireSharedInterruptibly(int arg)
          throws InterruptedException {
      // 封装共享节点添加到同步队列队尾
    final Node node = addWaiter(Node.SHARED);
    boolean failed = true;
    try {
        for (;;) {
            // 获取前驱节点
            final Node p = node.predecessor();
            // 如果前驱节点是head节点
            if (p == head) {
                // 尝试获取共享锁
                int r = tryAcquireShared(arg);
                // 注意这里是r>=0
                if (r >= 0) {
                    // 与独占锁不同之处，独占锁是setHead()
                    // 除了当前线程获取锁，后面的线程也有可能获取共享锁
                    setHeadAndPropagate(node, r);
                    p.next = null; // help GC
                    failed = false;
                    return;
                }
            }
            // 判断是否需要中断及中断步骤 与独占锁相同
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                // 共享锁及时响应中断
                throw new InterruptedException();
        }
    } finally {
        // 如果抛出中断异常，此处就会执行该逻辑
        if (failed)
            cancelAcquire(node);
    }
}
```

#### setHeadAndPropagate

```java
private void setHeadAndPropagate(Node node, int propagate) {
    // 记录老的head用于下面的对比校验
    Node h = head; 
    // 和独占锁一致，将获取锁的node设为新head，清空thread属性
    // 此时node=new head，h=old head
    setHead(node);
    // 此时h = old head
    if (propagate > 0 || h == null || h.waitStatus < 0 ||
        // 此时h = new node
        (h = head) == null || h.waitStatus < 0) {
        Node s = node.next;
        if (s == null || s.isShared())
            doReleaseShared();
    }
}
```

> doReleaseShared()可以理解成unparkSuccessor的升级方法，不止获取锁的过程中被调用，释放锁的过程中也会被调用。
>
> 1. h == null 和 ((h = head) == null) 不会成立，因为之前代码执行过addWaiter，所以队列肯定已初始化，已经初始化那么肯定不为null(head节点中只是thread = null)。
> 2. 条件判断只剩 `propagate > 0 || h.waitStatus < 0 || h.waitStatus < 0 `，需要注意此处的h不是同一个，前面的h是旧head，后面的h是新head。
> 3. 根据外层方法要求 propagate >= 0，那么`propagate > 0`时，获取node的next节点，如果node是tail尾节点，那么 `s == null`成立，执行`doReleaseShared`方法，如果`s == null`不成立，则判断 `s.nextWaiter == SHARED`，添加共享节点时会设置此参数，用于判断是否是共享节点。
> 4. 那么如果`propagate  = 0`时，继续判断`h.waitStatus < 0`，从之前独占锁的唤醒我们知道在`unparkSuccessor`会将`head头节点的waitStatus设为0`，那么此处的条件何时会发生呢？我们需要先查看`doReleaseShared`中的代码，它在`compareAndSetWaitStatus(h, 0, Node.PROPAGATE)`处将head头节点设置为`PROPAGATE`，那么我们也知道`release`方法中也会调用`doReleaseShared`去释放共享锁，所以此处很有可能是其他线程释放了锁，进入下一层判断，所以此时也可能去执行`doReleaseShared`去尝试获取锁。当然此情况比较凑巧，但确实会发生。
> 5. 接上段，如果`旧h.waitStatus  < 0`不成立，那么`新h.waitStatus < 0`条件何时成立呢？在`shouldParkAfterFailedAcquire`中会将前驱节点设置为`SIGNAL`状态后去park当前节点，所以只要先执行过`shouldParkAfterFailedAcquire`方法，后获取锁，那么`新h.waitStatus < 0`肯定成立，进入下一层判断，所以这里也可能会执行`doReleaseShared`方法尝试唤醒后继节点。
> 6. `setHeadAndPropagate`的注释中说明了此方法确实会导致`不必要的唤醒操作`。

#### doReleaseShared

```java
// 唤醒后继节点并确认传播
private void doReleaseShared() {
    // 循环执行
    for (;;) {
        // 获取头节点，接上文，此时的头节点是node，不是老的head节点了
        Node h = head;
        // h != null ，只要队列初始化过，就一直成立
        // h != tail 如果队列中添加过节点，就一直成立
        // 这两个条件保证了队列至少有两个node，其中一个哨兵节点
        if (h != null && h != tail) {
            int ws = h.waitStatus;
            // 如果head是SIGNAL，就执行unparkSuccessor()
            if (ws == Node.SIGNAL) {
                if (!compareAndSetWaitStatus(h, Node.SIGNAL, 0))
                    continue;
                // 修改成功就唤醒头节点的有效后继节点
                unparkSuccessor(h);
            }
            // 如果ws == 0说明h的后继节点已经或即将被唤醒
            // CAS设置为PROPAGATE
            else if (ws == 0 &&
                     !compareAndSetWaitStatus(h, 0, Node.PROPAGATE))
                continue;                // loop on failed CAS
        }
        // 如果waitStatus是PROPAGATE直接判断
        // 跳出循环的关键: 只要新老head相等就跳出循环
        if (h == head)
            break;
    }
}
```

> 只要有线程获取锁设置了`新head`，`h == head`就会不成立导致再次循环，其目的是为了执行`unparkSuccessor(head)来唤醒有效后继节点`。

### release

```java
public final boolean releaseShared(int arg) {
    // 调用semaphore的内部实现去释放锁
    if (tryReleaseShared(arg)) {
        // 如果成功就尝试唤醒后继节点且传播
        doReleaseShared();
        return true;
    }
    return false;
}
// 释放共享锁
protected final boolean tryReleaseShared(int releases) {
    for (;;) {
        // 获取当前state
        int current = getState();
        // 将 state + 1
        int next = current + releases;
        if (next < current) // overflow
            throw new Error("Maximum permit count exceeded");
        // CAS修改state成功返回true
        if (compareAndSetState(current, next))
            return true;
    }
}
```

> 1. `doReleaseShared`方法在此不再赘述，它保证了`多线程情况下的后继节点能够正常被唤醒`。
>
> 2. `tryReleaseShared`目的就是为了恢复`共享变量state`。便于后面的新线程获取锁。
>
> 3. Sempahore释放锁的时候，`不校验你是否持有共享锁的，所以可以理解成任意线程都可以释放锁。`那么就会出现你的`permit设置为2，当你调用了三次release，你的state为3的情况。`

>    即使调用多次release方法也不会产生影响，因为在`unparkSuccessor`方法中，会去获取next节点，如果没有就`从后往前查找有效节点`再唤醒，没有有效节点就不会唤醒。

### 共享锁总结

- 共享锁相比独占锁最大的不同在于`setHeadAndPropagate` 和 `doReleaseShared`。
- `setHeadAndPropagate` 用于设置新head，及一定条件下调用`doReleaseShared`，且调用`doReleaseShared`会导致线程不必要的唤醒。
- `doReleaseShared`在获取锁和释放锁的时候都可能被调用，因为是共享锁，即便你获取了锁，后继节点也有可能获取锁。
- `PROPAGATE`与`SIGNAL`的意义相同，都为了让唤醒线程能检测到状态变化，区别在于前者`只作用于共享锁`。
- 共享锁操作共享变量肯定会出现`原子性和有序性`的情况(`permit = 1除外,此时是特殊的独占锁`)。
