---
title: "ReentrantLock源码解析"
date: 2020-06-15T15:53:46+08:00
description: "AbstractQueueSynchronizer是一种同步框架，而ReentrantLock是基于它实现的`可重入独占锁`，具有公平/非公平两种实现。"
tags: ["ReentrantLock ","AQS"]
categories: [
  "Concurrent"
]
hideReadMore: true
---
Lock与Synchronized都是`可重入锁`，否则会发生死锁。Lock锁核心在于`AbstractQueueSynchronizer`，又名`队列同步器(简称AQS)`。如果需要实现自定义锁，除了需要实现Lock接口外，还需要内部类继承Sync类。

### AbstractQueueSynchronizer

![](https://image.leejay.top/image/20200608/GVtL7ztzwtCl.png?imageslim)

#### 记录当前锁的持有线程

由AQS的父类`AbstractOwnableSynchronizer`实现记录当前锁的持有线程功能（独占锁）。

#### state变量

内部维护了volatile修饰的state变量，state = 0时表明没有线程获取锁，state = 1时表明有一个线程获取锁，当state > 1时，说明该线程重入了该锁。

#### 线程阻塞和唤醒

由`LockSupport`类实现，其底层是调用了Unsafe的park 和 unpark。`如果当前线程是非中断状态，调用park()阻塞，返回中断状态是false，如果当前线程是中断状态，调用park()会不起作用立即返回。也是为什么AQS要清空中断状态的原因`。

#### FIFO队列

AQS内部维护了一个基于`CLH(Craig, Landin, and Hagersten(CLH)locks。基于链表的公平的自旋锁)`变种的FIFO双向链表阻塞队列，在等待机制上由自旋改成阻塞唤醒(park/unpark)。

![](https://image.leejay.top/image/20200609/CHJldTlsLVp2.png?imageslim)

> 还未初始化的时候，head = tail = null，之后初始化队列，往其中假如阻塞的线程时，会新建一个空的node，让head和tail都指向这个空node。之后加入被阻塞的线程对象。当head=tai时候说明队列为空。

#### Node的waitStatus

| Node状态     | 描述                                                         |
| :----------- | :----------------------------------------------------------- |
| INIT=0       | Node初始创建时默认为0                                        |
| CANCELLED=1  | 由于超时或者中断，线程获取锁的请求取消了，节点一旦变成此状态就不会再变化。 |
| SIGNAL=-1    | 表示线程已经准备好了，等待资源释放去获取锁。                 |
| CONDITION=-2 | 表示节点处于等待队列中，等待被唤醒。                         |
| PROPAGATE=-3 | 只有当前线程处于SHARED情况下，该字段才会使用，用于共享锁的获取。 |

---

###  ReentrentLock

我们选择`ReentrentLock`作为入口进行源码解读，自定义的获取释放锁的方法，由其内部抽象类Sync的子类FairSync和NonfairSync中的tryAcquire、tryRelease实现。

```java
class Test {
    private static final ReentrantLock LOCK = new ReentrantLock();
    
    public void run() {
        LOCK.lock();
        try {
            //dosomething
        }finally {
            LOCK.unlock();
        }  
    }
}
```

> 判断是否成功获取锁的标志，就是CAS修改volatile修饰的state变量是否成功。

### 公平锁和非公平锁

```java
// 非公平锁实现
static final class NonfairSync extends Sync {
	final void lock() {
        // 先尝试CAS获取锁
        if (compareAndSetState(0, 1))
            setExclusiveOwnerThread(Thread.currentThread());
        else
            // 再排队
            acquire(1);
    }
    ...
}
// 公平锁实现
static final class FairSync extends Sync {
    private static final long serialVersionUID = -3000897897090466540L;
	// 去排队
    final void lock() {
        acquire(1);
    }
    ...
}
```

> 公平锁和非公平锁如何选择？
>
> 非公平锁一进来就尝试去获取锁，有效的减少了线程的上下文切换，所以为了追求`高吞吐量`建议选择非公平锁，但是会导致某些线程长时间在排队，没有机会获取锁。否则建议选择公平锁。

### acquire

```java
// 如果第一次获取锁失败，说明此时有其他线程持有锁，所以执行acquire
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

#### tryAcquire

```java
// 调用非公平锁的tryAcquire，再一次尝试去获取锁
protected final boolean tryAcquire(int acquires) {
    return nonfairTryAcquire(acquires);
}
// 返回false表明没有获取到锁，true表明成功获取锁/重入锁
final boolean nonfairTryAcquire(int acquires) {
    // 获取当前线程
    final Thread current = Thread.currentThread();
    // 获取state状态
    int c = getState();
    // 如果state是0，表明当前没有线程获取锁
    if (c == 0) {
        // 尝试去获取锁，获取成功就设置独占线程为当前线程
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    // 如果当前线程已经是独占线程，此时说明锁重入了
    else if (current == getExclusiveOwnerThread()) {
        // 修改state的值
        int nextc = c + acquires;
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        // 设置state值，因为此时的获取锁的线程就是当前线程
        setState(nextc);
        return true;
    }
    return false;
}
// 公平锁的tryAcquire实现
protected final boolean tryAcquire(int acquires) {
    ...
        if (c == 0) {
            // hasQueuedPredecessors是公平锁的主要体现
            if (!hasQueuedPredecessors() &&
                compareAndSetState(0, acquires)) {
                setExclusiveOwnerThread(current);
                return true;
            }
        }
    ...
}
```

> Q:  为什么有的地方使用setState()，有的地方使用CAS？
>
> A:  因为使用setState()方法的前提是已经获取了锁，使用了CAS的是因为此时还没有获取锁。

#### hasQueuedPredecessors

```java
// true/false 有节点在等待/无节点等待
public final boolean hasQueuedPredecessors() {
    // 这里为什么tail获取在head之前？
    // 假设第一个节点入队，根据enq()设置head和tail可知
    // 如果此处tail = null，head = null | head != null都有可能
    // 如果此处tail != null ，那么(head = tail) != null
    Node t = tail;
    Node h = head;
    Node s;
    return h != t &&
        // (s = h.next) == null 成立说明有其他线程正在初始化队列
        ((s = h.next) == null || s.thread != Thread.currentThread());
}
```

> 返回情况分析：
>
> 1. 若`h == t`说明此时队列还没有初始化或只有哨兵节点，返回false表明无等待节点。
>
> 2. 若`h != t`成立，说明此时队列有节点啊，那`((s = h.next) == null)`应该也成立啊？
>    其实不然，我们假设线程A获取锁失败，尝试加入队列，此时队列还未初始化，A执行到enq方法：
>
>    ```java
>    private Node enq(final Node node) {
>        for (;;) {
>            Node t = tail;
>            if (t == null) {
>                // 线程A准备初始化队列，它setHead(new Node())成功了
>                // 此时线程切换，线程B执行了hasQueuedPredecessors()
>                // 此时 head != null; tail = null; head.next = null
>                // 此时h != t 且 (s = h.next) = null
>                if (compareAndSetHead(new Node()))
>                    tail = head;
>            } else {
>                node.prev = t;
>                if (compareAndSetTail(t, node)) {
>                    t.next = node;
>                    return t;
>                }
>            }
>        }
>    }
>    ```
>
>    
>
> 3. 若`((s = h.next) == null)`成立，说明此时存在另一个线程执行到`compareAndSetHead(new Node())`和`tail = head`的中间状态。所以也需要返回true，表明有节点在等待。
>
> 4. 若`((s = h.next) == null)`不成立，我们继续判断队列中第一个等待线程（`s.thread != Thread.currentThread()`）是否是当前线程，是就返回true，否则返回false。
>
> 5. 方法中为什么`Node t = tail`获取在`Node h = head`之前？
>    根据上面的分析，我们知道第一个节点入队的时候会出现`head != null 但 tail = null`的情况，因为是`先设置head再设置tail`，操作非原子性。
>    我们假设`队列未初始化`，hasQueuedPredecessors方法中`tail和head代码位置互换`，线程A先执行`Node h = head;`此时`head = null`，线程切换，线程B执行enq方法初始化队列导致`（head = tail）!= null`，又切回线程A，执行`Node t = tail`，`tail != null`，判断代码`h != t`成立，继续判断`(s = h.next) == null`出问题了，`h =null,h.next会抛空指针!!!`，这就是问题所在。(再次膜拜Doug lea！！！)

#### addWaiter

```java
// 获取不到锁，将当前线程构建成node对象加入队列
private Node addWaiter(Node mode) {
    // 创建node对象(currentThread, Node.EXCLUSIVE)
    Node node = new Node(Thread.currentThread(), mode);
    Node pred = tail;
    // 如果尾节点不等于null，说明队列不为空
    if (pred != null) {
        // 设置node的prev为尾节点
        node.prev = pred;
        // 如果此时有两个线程尝试用将node设置为tail尾节点
        // 所以需要CAS保证只有一个设置成功，另一个执行下面的enq()加入队列
        if (compareAndSetTail(pred, node)) {
            // 设置成功后，添加next指针指向node
            pred.next = node;
            return node;
        }
    }
    // 尾节点为null 或 插入尾节点失败
    enq(node);
    return node;
}
// 循环执行插入操作，直到插入队尾成功
private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        // 如果尾节点是null，说明队列还没有初始化
        if (t == null) {
            // 将head设置成空node，并且tail=head(说明此时队列初始化了但还没有节点)
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            // t!=null，设置node.prev=t
            node.prev = t;
            // CAS设置node到队尾，如果不成功继续循环获取tail直到设置成功
            if (compareAndSetTail(t, node)) {
                // CAS成功，设置t的next属性
                t.next = node;
                // 跳出循环返回node的前驱节点
                return t;
            }
        }
    }
}
```

#### acquireQueued

```java
// 至此node已经插入队列成功，并返回
final boolean acquireQueued(final Node node, int arg) {
    boolean failed = true;
    try {
        boolean interrupted = false;
        for (;;) {
            // 获取node的前继节点
            final Node p = node.predecessor();
            // 如果node的前继节点是头节点，则node尝试去获取锁
            // tryAcquire(arg)会抛出异常
            if (p == head && tryAcquire(arg)) {
                // 获取锁成功，设置头节点为node，并清空thread和prev属性
                setHead(node);
                // 方便回收前继节点p
                p.next = null;
                // 修改failed参数
                failed = false;
                // 跳出循环并返回
                return interrupted;
            }
            // 如果前继节点不是head节点 或 前继节点是head节点但获取不到锁
            // 判断是否需要挂起,如果阻塞节点被唤醒，还会继续循环获取，直到获取锁才return
            if (shouldParkAfterFailedAcquire(p, node) &&
                parkAndCheckInterrupt())
                interrupted = true;
        }
    } finally {
        // 如果跳出循环，failed=false，不跳出循环也不会执行到这里
        // 也就是只有tryAcquire(arg)发生异常了才会执行cancelAcquire()
        if (failed)
            cancelAcquire();
    }
}

final Node predecessor() throws NullPointerException {
    // 获取node的prev节点p
    Node p = prev;
    // 如果p为null则抛出异常，这里的空指针一般不会生效，只是为了帮助虚拟机
    if (p == null)
        throw new NullPointerException();
    else
    // 否则返回前继节点p
        return p;
}
// 将node节点设置为head头节点，获取锁之后都会将头节点相关信息清除
private void setHead(Node node) {
    head = node;
    node.thread = null;
    node.prev = null;
}

// 判断获取锁失败之后是否需要park
private static boolean shouldParkAfterFailedAcquire(Node pred, Node node) {
    // 获取node前继节点的waitStatus，默认情况下值为0
    int ws = pred.waitStatus;
    // 如果是signal，说明前继节点已经准备就绪，等待被占用的资源释放
    if (ws == Node.SIGNAL)
        return true;
    // 如果前继节点waitStatus>0，说明是Cancel
    if (ws > 0) {
        do {
            // 获取前继节点的前继节点，直到它的状态>0(直到前继节点不是cancel节点)
            node.prev = pred = pred.prev;
        } while (pred.waitStatus > 0);
        // 将不是cancel的节点与node相连
        pred.next = node;
    } else {
        // 尝试将前继节点pred设置成signal状态，设置signal的作用是什么？
        // 在解锁的时候只有head!=null且为signal状态才会唤醒head的下个节点
        // 如果pred状态设置成功，第二次就会进入ws == Node.SIGNAL，返回true
        compareAndSetWaitStatus(pred, ws, Node.SIGNAL);
    }
    return false;
}

// 将线程挂起并检查是否被中断
private final boolean parkAndCheckInterrupt() {
    // 挂机当前线程，不会往下执行了
    LockSupport.park(this);
    // 往下执行的条件: unpark(t)或被中断
    // 返回中断状态(并清空中断状态)
  return Thread.interrupted();
}
```

> LockSupport.park()除了`能够被unpark()唤醒，还会响应interrupt()打断`，但是Lock锁不能响应中断，如果是unpark，会返回false，如果是interrupt则返回true。

#### cancelAcquire

```java
// 节点取消获取锁
  private void cancelAcquire(Node node) {
      // 忽略不存在的node
      if (node == null)
          return;
  	// 清空node的thread属性
      node.thread = null;
  
      // 获取node的不是cancel的前继节点
      Node pred = node.prev;
      while (pred.waitStatus > 0)
          node.prev = pred = pred.prev;
  
      // 获取有效前继节点的后继节点
      Node predNext = pred.next;
  
      // 设置node节点为cancel状态
      node.waitStatus = Node.CANCELLED;
  
      // 如果node是tail尾节点，将pred(非cancel节点)设置为尾节点
      if (node == tail && compareAndSetTail(node, pred)) {
          // 设置尾节点pred的next指针为null
          compareAndSetNext(pred, predNext, null);
      } else {
          int ws;
          // 如果node不是tail尾节点
          // 1.pred不是头节点
          if (pred != head &&
              // 2.如果不是则判断前继节点状态是否是signal
              ((ws = pred.waitStatus) == Node.SIGNAL ||
               // 3.如果不是signal则尝试将pred前继节点设置为signal
               (ws <= 0 && compareAndSetWaitStatus(pred, ws, Node.SIGNAL))) &&
              // 4.判断前继节点线程信息是否为null
              pred.thread != null) {
              // 1，2/3，4条件满足，获取node的后继节点
              Node next = node.next;
              // 如果后继节点不为null且waitStatus<=0
              if (next != null && next.waitStatus <= 0)
                  // 将node的前继节点的后继节点改成node的后继节点
                  compareAndSetNext(pred, predNext, next);
          } else {
              // 如果node前继不是head & 也不是tail
              unparkSuccessor(node);
          }
  		// 将node的后继节点设置为自身，方便回收
          node.next = node;
      }
  }
  // 唤醒head节点后不为cancel的非null节点
  private void unparkSuccessor(Node node) {
      int ws = node.waitStatus;
      // 如果node.waitStatus < 0 ，将其设置为0(初始状态)
      if (ws < 0)
          compareAndSetWaitStatus(node, ws, 0);
  	// 获取node的后继节点
      Node s = node.next;
      // 如果后继节点为null或是cancel，循环查找直到不符合该条件的node
      if (s == null || s.waitStatus > 0) {
          s = null;
          // 重点：从队尾往前找！！！！
          for (Node t = tail; t != null && t != node; t = t.prev)
              if (t.waitStatus <= 0)
                  s = t;
      }
      // 找到不为cancel的非null节点
      if (s != null)
          // 唤醒对应的线程
          LockSupport.unpark(s.thread);
}
```

> Q：为什么AQS的队列查找中，是从队列尾从后向前查找的？
>
> A：节点入队时，都是遵循如下范式设置tail节点：
>
> `① node.prev = tail; `
>
> `② if(compareAndSetTail(tail, node)) { `
>
> `			③ tail.next = node; }` 
>
> ②和③两行代码不是原子性的，所以就存在：线程A将nodeA成功设置为tail尾节点，如果此时线程切换，线程B执行unparkSuccessor方法唤醒尾节点，如果从前往后查询，会发现`tail.next = null`，会认为tail是尾节点，其实此时的尾节点已经被线程A改成了nodeA，doug lea在AQS的文档中也说明了`prev是务必要保证的可靠引用，而next只是一种优化。`
>
> 又比如cancelAcquire方法中，都是断开了next指针，prev指针没有断开，也是上诉理论的一种体现。

#### selfInterrupt

```java
// 当获取锁或插入node到队列的过程中发生了interrupt，那么这里需要补上打断
static void selfInterrupt() {
    Thread.currentThread().interrupt();
}
```

### 独占锁获取执行流程

![](https://image.leejay.top/image/20200628/9RLQ683DruWq.png?imageslim)

### unlock

```java
public final boolean release(int arg) {
    // 尝试释放锁
    if (tryRelease(arg)) {
        Node h = head;
        // 如果头节点不为null且不是初始状态
        if (h != null && h.waitStatus != 0)
            // 唤醒头节点的后继节点
            unparkSuccessor(h);
        // 唤醒的线程会重新从parkAndCheckInterrupt()方法中被unpark
        // 然后继续新一轮的获取锁或者获取不到锁park的流程
        return true;
    }
    return false;
}

protected final boolean tryRelease(int releases) {
    // 此时处于已获取锁状态，所以不需要cas获取state，这里也会处理多次重入的情况
    int c = getState() - releases;
    // 如果当前线程不是独占线程抛异常
    if (Thread.currentThread() != getExclusiveOwnerThread())
        throw new IllegalMonitorStateException();
    boolean free = false;
    // 如果state=0说明独占锁或锁重入释放准备完毕
    if (c == 0) {
        free = true;
        setExclusiveOwnerThread(null);
    }
    // 设置状态为0
    setState(c);
    // 释放锁成功
    return free;
}
```

### lockInterruptibly

可及时响应线程中断的获取锁的API

```java
// 方法入口
public void lockInterruptibly() throws InterruptedException {
  sync.acquireInterruptibly(1);
}
// 可响应中断
public final void acquireInterruptibly(int arg)
  throws InterruptedException {
    // 如果线程被打断直接抛出异常
    if (Thread.interrupted())
        throw new InterruptedException();
    // 尝试去获取锁，获取失败将node加入队列，被中断抛出异常
    if (!tryAcquire(arg))
        doAcquireInterruptibly(arg);
}
// 与acquireQueue几乎相同
private void doAcquireInterruptibly(int arg)
    ...
    	if (shouldParkAfterFailedAcquire(p, node) &&
        	parkAndCheckInterrupt())
            // 与acquireQueue唯一的区别
        	throw new InterruptedException();
    ...
}
```

### tryLock(time)

响应中断且非阻塞，指定时间内获取不到锁就返回。

```java
public boolean tryLock(long timeout, TimeUnit unit)
    throws InterruptedException {
    return sync.tryAcquireNanos(1, unit.toNanos(timeout));
}
// 与lockInterruptibly相同抛出中断异常切换尝试获取锁，获取锁过程中响应中断
public final boolean tryAcquireNanos(int arg, long nanosTimeout)
    throws InterruptedException {
    if (Thread.interrupted())
        throw new InterruptedException();
    // 如果获取锁失败就去执行doAcquireNanos，直到超时返回false
    return tryAcquire(arg) ||
        doAcquireNanos(arg, nanosTimeout);
}
// 获取锁的超时方法
private boolean doAcquireNanos(int arg, long nanosTimeout)
    throws InterruptedException {
    if (nanosTimeout <= 0L)
        return false;
    // 计算deadline
    final long deadline = System.nanoTime() + nanosTimeout;
    // 将node添加到队列中
    final Node node = addWaiter(Node.EXCLUSIVE);
    boolean failed = true;
    try {
        for (;;) {
            final Node p = node.predecessor();
            if (p == head && tryAcquire(arg)) {
                setHead(node);
                p.next = null; // help GC
                failed = false;
                return true;
            }
            // 计算剩余时间
            nanosTimeout = deadline - System.nanoTime();
            // 如果小于0说明计时结束，获取失败
            if (nanosTimeout <= 0L)
                return false;
            // 判断是否需要阻塞，区别在于该方法阻塞了指定了时长
            // 为什么剩余时间要大于spinForTimeoutThreshold(1000)才会阻塞
            // 说明此时剩余时间非常短，没必要再执行挂起操作了，不如直接执行下一次循环
            if (shouldParkAfterFailedAcquire(p, node) &&
                nanosTimeout > spinForTimeoutThreshold)
                // 调用lockSupport park指定时长
                LockSupport.parkNanos(this, nanosTimeout);
            // park过程中被中断直接抛出异常
            if (Thread.interrupted())
                throw new InterruptedException();
        }
    } finally {
        if (failed)
            cancelAcquire(node);
    }
}
```

> 相比lockInterruptibly方法，tryLock(time)除了响应中断外，还拥有超时控制，由LockSupport.parkNanos()实现。
