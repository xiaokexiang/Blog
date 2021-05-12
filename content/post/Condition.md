---
title: "Condition源码解析"
date: 2020-06-18T20:01:58+08:00
description: "Condition接口提供了类似Object.wait/notify的监视器方法，与Lock(基于AQS的锁)配合可以实现`等待/通知`模式。"
tags: ["Condition ","AQS"]
categories: [
  "Concurrent"
]
hideReadMore: true
---
Condition是一个接口，其实现在Lock内，需要配合Lock锁使用。其内部构建了一个单向队列，操作时不需要使用CAS来保证同步。

```java
final ConditionObject newCondition() {
    return new ConditionObject();
}
public class ConditionObject implements Condition {
    /** First node of condition queue. */
    private transient Node firstWaiter;
  /** Last node of condition queue. */
    private transient Node lastWaiter;
    public ConditionObject() { }
}
```

##### await

```java
// 执行await时肯定已经获取了锁，所以不需要CAS操作
public final void await() throws InterruptedException {
    // 如果当前线程已中断就抛出中断异常
    if (Thread.interrupted())
        throw new InterruptedException();
    // 将当前线程添加到等待队列
    Node node = addConditionWaiter();
    // 线程阻塞之前必须要先释放锁，否则会死锁，这里是全部释放，包括重入锁
    int savedState = fullyRelease(node);
    int interruptMode = 0;
    // 判断node是否在AQS同步队列里面，初始是在条件队列里面
    while (!isOnSyncQueue(node)) {
        // signal后会在此处唤醒
        LockSupport.park(this);
        // 此处用于检测是被unpark还是被中断唤醒
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            // 被中断直接退出，说明await是可以响应中断的
            break;
    }
    // 如果被唤醒或中断，node尝试加入AQS同步队列，在此过程中被中断修改状态为REINTERRUPT
    if (acquireQueued(node, savedState) && interruptMode != THROW_IE)
        interruptMode = REINTERRUPT;
    // 清除cancel节点
    if (node.nextWaiter != null)
        unlinkCancelledWaiters();
    // 被中断唤醒，抛出被中断异常
    if (interruptMode != 0)
        reportInterruptAfterWait(interruptMode);
}

// 添加线程到条件队列
private Node addConditionWaiter() {
    Node t = lastWaiter;
    // 如果lastWaiter不是条件节点，删除非条件节点
    if (t != null && t.waitStatus != Node.CONDITION) {
        unlinkCancelledWaiters();
        t = lastWaiter;
    }
    // 将当前线程创建node
    Node node = new Node(Thread.currentThread(), Node.CONDITION);
    // 队列中没有其他node，当前node就是first
    if (t == null)
        firstWaiter = node;
    else
        // 否则将当前node加入到last后
        t.nextWaiter = node;
    // 并修改last为当前node
    lastWaiter = node;
    return node;
}

// 移除非条件节点
private void unlinkCancelledWaiters() {
    // 获取头节点，从前往后移除(和Node队列从后往前不同)
    Node t = firstWaiter;
    Node trail = null;
    // 当头节点不为null时
    while (t != null) {
        // 获取头节点的下个节点
        Node next = t.nextWaiter;
        // 如果t节点不是条件节点
        if (t.waitStatus != Node.CONDITION) {
            t.nextWaiter = null;
            if (trail == null)
                firstWaiter = next;
            else
                trail.nextWaiter = next;
            if (next == null)
                lastWaiter = trail;
        }
        else
            trail = t;
        // t指向下个节点继续判断
        t = next;
    }
}

// 判断是否在AQS的同步队列中
final boolean isOnSyncQueue(Node node) {
    // 如果waitStatus还是condition或者前驱节点为null，说明是条件队列队首，肯定不再同步队列
    if (node.waitStatus == Node.CONDITION || node.prev == null)
        return false;
    // 因为同步队列才会维护next指针，所以不为null，肯定已经在了
    if (node.next != null) // If has successor, it must be on queue
        return true;
    // 从队尾开始查找node看是否在同步队列中
    return findNodeFromTail(node);
}
```

> Q：condition的await()、signal()和Object中wait()、notify()的区别？
>
> A：首先是基于不同的锁：Lock和Synchronized，其次condition可以存在不同的条件队列，每个条件队列之间互不影响，而Synchronized只会有一个条件队列(或条件变量，根据Synchronized修饰位置不同，分别为this、class类和代码块中内容)。
>
> await()方法是响应中断的，这与lock()是不相同的，并且await()会将锁释放。

##### signal

```java
public final void signal() {
    // 线程必须持有锁才能够调用该方法
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    // 获取条件队列头节点
    Node first = firstWaiter;
    if (first != null)
        // 唤醒头节点
        doSignal(first);
}

private void doSignal(Node first) {
    do {
        //条件队列往后移动一位，新队头为null，将队尾也设为null
        if ( (firstWaiter = first.nextWaiter) == null)
            lastWaiter = null;
        // 清空队首next引用，此时就不在条件队列了
        first.nextWaiter = null;
        // 如果signal失败，那么就移一位获取新队头，直到signal成功
    } while (!transferForSignal(first) &&
             (first = firstWaiter) != null);
}
// 唤醒节点
final boolean transferForSignal(Node node) {
    // 尝试将node的waitStatus设为0，恢复默认状态，如果不能更新说明节点被中断，执行了cancelAcquire
    if (!compareAndSetWaitStatus(node, Node.CONDITION, 0))
        return false;
	// 将队首的node添加到AQS的同步队列，返回node的前驱节点！！
    Node p = enq(node);
    int ws = p.waitStatus;
    // 如果前驱节点是cancel或不是signal，那么直接唤醒当前node，这里会将node在isSyncQueue()中唤醒
    // 假设退出循环，执行acquireQueue()，该方法里面还是会继续判断能否获取锁，不能就尝试设置前驱节点为siganl
    if (ws > 0 || !compareAndSetWaitStatus(p, ws, Node.SIGNAL))
        // 唤醒node节点，
        LockSupport.unpark(node.thread);
    return true;
}
```

> signal只会将条件队列中第一个符合的节点移到AQS的等待队列

##### signalAll

```java
public final void signalAll() {
    // 必须持有锁才能signalAll
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    // 获取头节点
    Node first = firstWaiter;
    if (first != null)
        doSignalAll(first);
}
// signalAll与signal略微不同
private void doSignalAll(Node first) {
    // 因为要将整个条件队列移到同步队列，所以清空首尾标志，只能通过first查找
    lastWaiter = firstWaiter = null;
    do {
        // 循环查找first的符合条件的nextWaiter节点并将它移入同步队列
        Node next = first.nextWaiter;
        first.nextWaiter = null;
        transferForSignal(first);
        first = next;
    } while (first != null);
}
```

> signal和signalAll执行的流程中都不会释放锁，这点与await不同。

##### await总结

- 将当前节点构建成条件节点加入条件队尾，一个AQS同步队列可以对应着多个条件队列。
- `释放全部的锁`，特别是重入锁，如果不释放锁会导致死锁。
- 判断是否在AQS的同步队列中，如果不在就park当前线程，否则就尝试执行获取锁的流程，进而阻塞线程或者获取锁。

##### signal/signalAll总结

- signal会清空头节点在条件队列的引用，头节点还存在，只是队列中引用不在了。
- signal尝试将`条件队列的头节点添加到AQS同步队列的队尾`，如果头节点在同步队列中的前驱节点状态不符合条件，会唤醒头节点。
- signalAll会清空队列首尾标识，并`通过first节点依次将条件队列中的节点移入同步队列中`，若符合相关条件就唤醒相关节点。
- 线程await中isOnSyncQueue()被唤醒，进而执行await的相关逻辑。
- `signal和signalAll不会释放锁`，这与await不同
