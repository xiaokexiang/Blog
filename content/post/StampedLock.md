---
title: "StampedLock"
date: 2020-07-01T10:32:01+08:00
description: "为了实现更快的读写锁模式而诞生的框架，基于`乐观锁`、`自旋+CAS`、`类似AQS`的逻辑实现"
tags: ["StampedLock "]
categories: [
  "Concurrent"
]
hideReadMore: true
---

`JDK1.8`新增的并发工具，回顾之前的`ReentrentReadWriteLock`，它是悲观锁的实现：`只要有线程获取了读锁，获取写锁的线程就需要等待，但有可能导致写锁无限等待（其中使用了apparentlyFirstQueuedIsExclusive方法一定概率降低了写锁无限等待的问题）`。

而`StampedLock`是`乐观锁`的实现，`乐观读`的时候不加锁，读取后`发现数据改变了再升级为悲观读，此时与写互斥`。

```java
@Slf4j
public class StampedLockTest {
    private static final StampedLock LOCK = new StampedLock();
    private static int x, y;

    static void add() {
        long stamp = LOCK.writeLock();
        try {
            x += 1;
            y += 1;
        } finally {
            LOCK.unlockWrite(stamp);
        }
    }

    static void print() {
        // 尝试乐观读
        long stamp = LOCK.tryOptimisticRead();
        int currentX = x， currentY = y;
        // 如果stamp修改了，这时再加悲观读锁
        if (!LOCK.validate(stamp)) {
            log.info("value has changed ...");
            stamp = LOCK.readLock();
            try {
                currentX = x;
                currentY = y;
            } finally {
                LOCK.unlockRead(stamp);
            }
        }
        log.info("x: {}, y: {}", currentX, currentY);
    }

    public static void main(String[] args) throws InterruptedException {

        for (int i = 0; i < 10; i++) {
            new Thread(StampedLockTest::add).start();
            Thread.sleep(new Random().nextInt(2) * 1000);
            new Thread(StampedLockTest::print).start();
        }
    }
}
```

> 如上述代码所示：
>
> 1. 相比读写锁，`StampedLock`引入了乐观锁概念，只有变量发生改变才去加读锁。
> 2. 除此之外`StampedLock`的方法都会返回一个`版本号：stamp（state），用来代表此时此刻的版本`。

### StampedLock

```java
// 移位基数
private static final int LG_READERS = 7;
// 读锁个数每次增加的单位
private static final long RUNIT = 1L;
// 第8位表示写锁
private static final long WBIT  = 1L << LG_READERS;
// 低7位表示读锁
private static final long RBITS = WBIT - 1L;
// 最大读线程个数
private static final long RFULL = RBITS - 1L;
// 写锁和读锁个数的二进制码
private static final long ABITS = RBITS | WBIT;
// 对读线程个数取反
private static final long SBITS = ~RBITS;
// 将写线程左移一位
private static final long ORIGIN = WBIT << 1;
public StampedLock() {
    state = ORIGIN;
}
```

> 初始状态`state = ORIGIN = 1L << 8`，state类型是`long`。
>
> 我们可以看出`第8位表示写锁的状态`，只有0/1两种情况，这样`写锁就不支持重入`了。`低7位表示读锁被获取的次数`。剩下的其他位是用来表示版本号的，他们共同构成了state。
>
> ![](https://image.leejay.top/image/20200714/LseXmJNKqjCv.png?imageslim)

| 变量（long）               | 二进制(64bit，省略为0)  | 十进制 |
| :------------------------- | :---------------------- | :----- |
| RUNIT = 1L                 | 0000 ... 0000 0001      | 1      |
| **WBIT =  1L << 7**        | 0000 ... 1000 0000      | 128    |
| **RBITS = WBIT - 1L**      | 0000 ... 0111 1111      | 127    |
| RFULL = RBITS - 1L         | 0000 ... 0111 1110      | 126    |
| **ABIT =  RBITS \|  WBIT** | 0000 ... 1111 1111      | 255    |
| SBITS = ~RBITS             | 1111 ... 1000 0000      | -128   |
| **ORIGIN =  WBIT << 1**    | 0000 ... 0001 0000 0000 | 256    |

### Wait Node

```java
static final class WNode {
    // 前驱节点
    volatile WNode prev;
    // 后继节点
    volatile WNode next;
    // 读线程使用，类似栈结构的链表连接读线程
    volatile WNode cowait;
    // 节点持有的线程
    volatile Thread thread;
    // 节点的状态： 0、WAITING、CANCELED
    volatile int status;
    // RMODE WMODE
    final int mode;
    // 构造函数 需要传入mode和当前节点前驱节点
    WNode(int m, WNode p) { mode = m; prev = p; }
}
```

> StampedLock内部维护了和`AQS的Node类似`的节点，但有几点不同：
>
> 1. WNode中的`cowait属性用于将读节点通过链表的形式`进行连接。
> 2. WNode中的status只有三种状态：`0、WAITING、CANCELED`。
> 3. WNode中的mode属性用于表示当前的节点是：`RMODE(读) or WMODE(写)`。

![](https://image.leejay.top/image/20200707/oyfmhKphdfR2.png?imageslim)

### writeLock

```java
public long writeLock() {
    long s, next;
    return ((((s = state) & ABITS) == 0L &&
             U.compareAndSwapLong(this, STATE, s, next = s + WBIT)) ?
            next : acquireWrite(false, 0L));
}
```

> 我们将return拆分成三个部分来看：
>
> ```java
> ① ((s = state) & ABITS) == 0L
> ② U.compareAndSwapLong(this, STATE, s, next = s + WBIT)
> ③ ? next : acquireWrite(false, 0L)
> ```
>
> 1. ① 与 ② 同时成立时，返回`next`。若有一个不成立，返回`acquireWrite(false, 0L)`。
> 2. 默认情况下`state第9位是1，其余位都是0`，而``ABIT低8位都是1(final)`。所以进行`&`运算，可以推导出`只要&运算的结果不为0，说明此时有写锁或者读锁。`若结果不为0，执行`acquireWrite`。
>
> ```java
>   1 0000 0000
> & 0 1111 1111
> ——————————————  == 0 成立，state的低8位中有一位不为0，那么这个公式的结果肯定不为0
>   0 0000 0000     
> ```
>
> 3. 假设state是初始状态，`((s = state) & ABITS) == 0L`成立，那么执行CAS方法，尝试将`state`的值由`初始状态s改为s + WBIT(1000 0000)`，即`1 1000 0000`，表明获取写锁成功。那么返回`next`作为版本号。
> 4. 若CAS修改失败，那么说明有另外一个线程获取了写锁，那么执行`acquireWrite`方法。

#### acquireWrite

```java
// 获取CPU核心数
private static final int NCPU = Runtime.getRuntime().availableProcessors();
// 加入队列前的最大自旋次数 64次
private static final int SPINS = (NCPU > 1) ? 1 << 6 : 0;
// 前驱节点是head时的自旋次数，大于加入队列的自旋，说明要到我获取锁了，激动的自旋次数也多了
private static final int HEAD_SPINS = (NCPU > 1) ? 1 << 10 : 0;
private long acquireWrite(boolean interruptible, long deadline) {
    // 定义此次线程的wnode节点和前驱节点p
    WNode node = null, p;
    // 第一次自旋，spins = -1，通过自旋加入队列尾部
    for (int spins = -1;;) {
        long m, s, ns;
        // 如果(s = state) & ABITS) == 0L说明恰巧写锁被释放了，那么直接去CAS获取锁
        if ((m = (s = state) & ABITS) == 0L) {
            // 若获取成功直接返回ns = 新的版本号
            if (U.compareAndSwapLong(this, STATE, s, ns = s + WBIT))
                return ns;
        }
        // 如果自旋次数小于0，重新计算自旋次数
        else if (spins < 0)
            // 1. 何时m == WBIT，只有写锁没有读锁的才会成立
            // 2. wtail = whead的情况和AQS的一致，就是
            // 队列未初始化（wtail = whead = null）或
            // 只有一个哨兵节点还没有其他节点的情况(wtail = whead = new WNode())
            // 1和2同时成立说明队列没有等待节点，且写锁会被释放（时间不确定），继续自旋
            spins = (m == WBIT && wtail == whead) ? SPINS : 0;
        else if (spins > 0) {
            // 获取当前线程的随机数（基于ThreadLocalRandom）>= 0时自旋次数减1
            if (LockSupport.nextSecondarySeed() >= 0)
                --spins;
        }
        // 如果wtail = null说明队列还未初始化
        // 无论p是否为null，它都代表了队列的尾节点
        else if ((p = wtail) == null) {
            // 创建写模式节点
            WNode hd = new WNode(WMODE, null);
            // 通过CAS将hd设置为头节点
            if (U.compareAndSwapObject(this, WHEAD, null, hd))
                // 设置成功将hd也设置为wtail（非原子性，此时可能线程切换）
                wtail = hd;
        }
        // 如果当前线程的WNode = null，那么创建当前线程的WNode，此时 p = whead
        else if (node == null)
            node = new WNode(WMODE, p);
        // 如果node前驱不是p，那么设置为p，因为p代表了队列的tail节点
        // 因为存在另一个线程比当前线程早加入了队列
        else if (node.prev != p)
            node.prev = p;
        // 通过CAS修改tail尾节点，和AQS一样，prev是务必要保证的
        else if (U.compareAndSwapObject(this, WTAIL, p, node)) {
            // CAS成功，设置next指针，非原子性，所以next非可靠，此时线程切换会有影响
            p.next = node;
            // 只有成功将当前线程加入队列尾部，那么才会退出第一次的自旋
            break;
        }
    }

    // 第二次自旋
    for (int spins = -1;;) {
        WNode h, np, pp; int ps;
        // p代表了当前节点的前驱节点，也代表了此刻的尾节点wtail
        // 如果p = head说明当前线程的前驱结点是head节点，快要到自己
        if ((h = whead) == p) {
            // 如果自旋次数小于0赋予新的自旋次数
            if (spins < 0)
                spins = HEAD_SPINS;
            // 如果自旋次数小于最大自旋次数那么将当前自旋次数翻倍
            else if (spins < MAX_HEAD_SPINS)
                spins <<= 1;
            // 第三个自旋，自旋中又套了一个自旋
            for (int k = spins;;) {
                long s, ns;
                // 先判断写锁是否释放并CAS修改state
                if (((s = state) & ABITS) == 0L) {
                    if (U.compareAndSwapLong(this, STATE, s,
                                             ns = s + WBIT)) {
                        // 获取成功，设置node为头节点
                        whead = node;
                        // 清空prev指针
                        node.prev = null;
                        // 返回state
                        return ns;
                    }
                }
                // 说明此时写锁还没释放或者CAS失败（此时其他线程获取了锁）
                // 随机将自旋次数k减1，直到k <= 0时退出第三次自旋
                // 这里的退出说明head自旋次数已经用完了
                else if (LockSupport.nextSecondarySeed() >= 0 &&
                         --k <= 0)
                    break;
            }
        }
        // 执行到此：
        // 1. 当前线程的前驱节点不是头节点，
        // 2.第三次自旋获取写锁一直没成功（有个线程持有的写锁未释放）
        else if (h != null) {
            // 协助唤醒head头节点下面的cowait下的读节点
            WNode c; Thread w;
            // 循环执行，只要节点的cowait属性不为null
            while ((c = h.cowait) != null) {
                // 只有CAS设置当前读节点的下一个读节点成功才能唤醒当前读节点的线程
                if (U.compareAndSwapObject(h, WCOWAIT, c, c.cowait) &&
                    (w = c.thread) != null)
                    // 唤醒读线程
                    U.unpark(w);
            }
        }
        // 若whead = h，说明此间头节点没有发生变化
        if (whead == h) {
            // 若当前线程的前驱节点不是尾节点p，说明尾节点改变了
            if ((np = node.prev) != p) {
                // 更新尾节点p并设置尾节点p的next指针为当前线程的node
                if (np != null)
                    (p = np).next = node;   // stale
            }
            // 如果p节点的状态为0，CAS修改为WAITING
            else if ((ps = p.status) == 0)
                U.compareAndSwapInt(p, WSTATUS, 0, WAITING);
            // 如果p节点是CANCELLED，将p的前驱额和node相连
            else if (ps == CANCELLED) {
                if ((pp = p.prev) != null) {
                    node.prev = pp;
                    pp.next = node;
                }
            }
            else {
                // 处理超时问题
                long time; 
                // 如果deadline = 0L就设置time = 0L
                if (deadline == 0L)
                    time = 0L;
                // 判断deadline -currenttime 是否小于 0，小于0需要将节点cancel
                else if ((time = deadline - System.nanoTime()) <= 0L)
                    return cancelWaiter(node, node, false);
                // 获取当前线程
                Thread wt = Thread.currentThread();
                // 添加当前线程到parkBlocker属性
                U.putObject(wt, PARKBLOCKER, this);
                // 修改node的thread属性
                node.thread = wt;
                // 如果前驱节点状态小于0 且 队列已初始化 且 无法获取写锁
                // 且 头节点没有发生变化 且 node的前驱节点没有变化
                if (p.status < 0 && (p != h || (state & ABITS) != 0L) &&
                    whead == h && node.prev == p)
                    // 就去阻塞当前线程
                    U.park(false, time);
                node.thread = null;
                U.putObject(wt, PARKBLOCKER, null);
                // 如果被中断了那么就取消当前节点
                if (interruptible && Thread.interrupted())
                    return cancelWaiter(node, node, true);
            }
        }
    }
}
```

> 与AQS的写锁获取区别：`StampedLock的锁获取的自旋是有次数限制的，并且不同情况自旋次数不同`。
>
> 写锁的获取总体分为三个部分，分别对应着`三次自旋`：
>
> 1. 第一次自旋：尝试获取写锁，若成功则返回state，失败就继续判断`spins是否需要重新赋值（若队列刚初始化且写锁还没被释放，spins = 0）`，若`spins = 0`则将`当前线程构造成node添加到队尾（此过程可能包括队列初始化）`，否则自旋加入队尾，最终只有加入成功才会跳出自旋。
> 2. 第二次自旋上：先判断`当前线程前驱节点是否是head节点`，如果是那么加大自旋次数，并开启第三次自旋去获取写锁，若成功则设置node为新head且清空prev属性。
> 3. 第二次自旋下：若当前节点不是head的后继节点，那么`尝试唤醒头节点中cowait连接的读线程`。最后处理节点的状态并处理超时问题（包括清理无效节点），若最终还是无法获取写锁，那么就会阻塞当前线程。
>
> 获取写锁的标志：将变量`state`的第8位设为1。反之为0表示没有获取写锁。

#### unlockWrite

```java
public void unlockWrite(long stamp) {
    WNode h;
    // 若state != stamp 说明当前传入的版本号不对
    // 若stamp & WBIT = 0L说明写锁没被获取，那就无需释放
    // 上述条件成立一个抛出异常
    if (state != stamp || (stamp & WBIT) == 0L)
        throw new IllegalMonitorStateException();
    // 将stamp加1同时判断版本号是否为0，为0就设为初始值否则设为当前值
    state = (stamp += WBIT) == 0L ? ORIGIN : stamp;
    // 如果头节点不为null，且头节点不为0
    if ((h = whead) != null && h.status != 0)
        release(h);
}
// 释放头节点的后继节点
private void release(WNode h) {
    if (h != null) {
        WNode q; Thread w;
        // 将头节点status改为WAITING
        U.compareAndSwapInt(h, WSTATUS, WAITING, 0);
        // 如果head的后继无效，那么从后往前查找（和AQS一致），直到找到
        if ((q = h.next) == null || q.status == CANCELLED) {
            for (WNode t = wtail; t != null && t != h; t = t.prev)
                if (t.status <= 0)
                    q = t;
        }
        // 唤醒符合条件的后继节点
        if (q != null && (w = q.thread) != null)
            U.unpark(w);
    }
}
```

> 1. `state = (stamp += WBIT) == 0L ? ORIGIN : stamp`：
>
>    ```java
>    已知代码执行到此，当前线程必有写锁，那么当前stamp必符合如下个规则：
>    xxxx ... xxxx 1xxx xxxx 第8位是1
>    那么加上WBIT： 1000 0000 变为
>    xxxx ... xxx1 0000 0000，即会向高位进1，也就是将版本号 + 1
>    ```
>
>    > 何时`stamp += WBIT = 0L`呢？
>    >
>    > 当`stamp = 0b1111...1000 0000（64bit）`即除了低7位是0，其他位全是1位，加上`WBIT = 1000 0000`就会为0，说明此时stamp版本号已全部用完，需要重置。
>
> 2. 写锁的释放与AQS的类似，除了`判断是否已有写锁的`不同，剩下的比如`唤醒头节点的有效后继节点、从队尾往前查找`都是相同的。

---

### readLock

```java
public long readLock() {
    long s = state, next;  // bypass acquireRead on common uncontended case
    return ((whead == wtail && (s & ABITS) < RFULL &&
        U.compareAndSwapLong(this, STATE, s, next = s + RUNIT)) ?
            next : acquireRead(false, 0L));
}
```

> 又称为`悲观读`，和写锁互斥，流程分成三个部分：
>
> ```java
> ① whead == wtail
> ② (s & ABITS) < RFULL 
> ③ U.compareAndSwapLong(this, STATE, s, next = s + RUNIT)
> ```
>
> 1. `whead = wtail `说明队列中还没有过节点（非哨兵节点）。
> 2. `(s & ABITS) < RFULL `判断当前读锁数量是否超过最大数量。
> 3. 若①、②成立则尝试CAS修改`STATE`状态，将读线程数量 + 1。
> 4. 若①、②、③全成立返回新的state，否则返回`acquireRead`的返回值

#### acquireRead

```java
private long acquireRead(boolean interruptible, long deadline) {
    WNode node = null, p;
    // 第一个自旋
    for (int spins = -1;;) {
        WNode h;
        // 判断队列是否初始化且有无除当前线程外的其他节点
        if ((h = whead) == (p = wtail)) {
            // 第二个自旋 尝试获取读锁
            for (long m, s, ns;;) {
                // 若相同则继续判断读线程是否超过最大数量
                if ((m = (s = state) & ABITS) < RFULL ?
                    // true执行CAS修改并返回state
                    U.compareAndSwapLong(this, STATE, s, ns = s + RUNIT) :			  				// false 此时读线程溢出，重置RBITS并返回0L
                    (m < WBIT && (ns = tryIncReaderOverflow(s)) != 0L))
                    return ns;
                
                else if (m >= WBIT) {
                    if (spins > 0) {
                        // 和写锁类似，有概率将spins-1
                        if (LockSupport.nextSecondarySeed() >= 0)
                            --spins;
                    }
                    else {
                        // 自旋为0需要判断是否跳出循环
                        if (spins == 0) {
                            WNode nh = whead, np = wtail;
                            if ((nh == h && np == p) || (h = nh) != (p = np))
                                break;
                        }
                        // 重置spins
                        spins = SPINS;
                    }
                }
            }
        }
        
       // 无尾节点那么初始化队列
        if (p == null) { 
            WNode hd = new WNode(WMODE, null);
            // 和写锁相同设置head节点
            if (U.compareAndSwapObject(this, WHEAD, null, hd))
                wtail = hd;
        }
        // 和写锁类似，只是mode变为RMODE
        else if (node == null)
            node = new WNode(RMODE, p);
        // 如果头尾相同或尾节点不是读模式节点
        else if (h == p || p.mode != RMODE) {
            // 将当前节点入队尾
            if (node.prev != p)
                node.prev = p;
            // 直到添加成功退出自旋
            else if (U.compareAndSwapObject(this, WTAIL, p, node)) {
                p.next = node;
                // 这里的break会跳到第五个自旋处
                break;
            }
        }
        // 这里说明尾节点是读模式节点 CAS 将当前节点挂到cowait属性下
        else if (!U.compareAndSwapObject(p, WCOWAIT,
                                         node.cowait = p.cowait, node))
            // CAS失败就设为null
            node.cowait = null;
        else {
            // 第三段自旋 用于阻塞当前线程
            for (;;) {
                WNode pp, c; Thread w;
                // 若头节点不为空且cowait不为空，那么唤醒其中等待的读线程
                if ((h = whead) != null && (c = h.cowait) != null &&
                    U.compareAndSwapObject(h, WCOWAIT, c, c.cowait) &&
                    (w = c.thread) != null) 
                    U.unpark(w);
                // 若头节点等于tail的前驱节点，说明快到自己获取锁了
                if (h == (pp = p.prev) || h == p || pp == null) {
                    long m, s, ns;
                    // 第四段自旋 尝试获取锁
                    do {
                        // 代码和第一段自旋中的获取锁相同，判断读锁数量同时获取读锁
                        if ((m = (s = state) & ABITS) < RFULL ?
                            U.compareAndSwapLong(this, STATE, s,
                                                 ns = s + RUNIT) :
                            (m < WBIT &&
                             (ns = tryIncReaderOverflow(s)) != 0L))
                            return ns;
                    } while (m < WBIT);
                }
                // 如果头节点没有变过且前驱节点没有改变，那么需要阻塞当前线程了
                if (whead == h && p.prev == pp) {
                    long time;
                    // 如果前置节点的前节点为null或头节点等于前继节点或前置节点状态是cancel
                    if (pp == null || h == p || p.status > 0) {
                        // 置为null
                        node = null;
                        // 退出自旋从第一个自旋重试
                        break;
                    }
                    // 以下是执行超时机制的代码，和写锁相同
                    if (deadline == 0L)
                        time = 0L;
                    else if ((time = deadline - System.nanoTime()) <= 0L)
                        return cancelWaiter(node, p, false);
                    Thread wt = Thread.currentThread();
                    U.putObject(wt, PARKBLOCKER, this);
                    // 设置当前线程到节点中
                    node.thread = wt;
                    // 若前驱节点不是头节点 且 头节点和前驱节点没变过
                    if ((h != pp || (state & ABITS) == WBIT) &&
                        whead == h && p.prev == pp)
                        // 当条件符合的时候阻塞当前线程
                        U.park(false, time);
                    node.thread = null;
                    U.putObject(wt, PARKBLOCKER, null);
                    if (interruptible && Thread.interrupted())
                        return cancelWaiter(node, p, true);
                }
            }
        }
    }
	//第五段自旋，处理第一个加入队尾的读线程
    for (int spins = -1;;) {
        WNode h, np, pp; int ps;
        // 这其中的逻辑和之前的代码类似，都是判断是否前继节点是头节点，然后尝试获取读锁
        if ((h = whead) == p) {
            if (spins < 0)
                spins = HEAD_SPINS;
            else if (spins < MAX_HEAD_SPINS)
                spins <<= 1;
            // 第六段自旋
            for (int k = spins;;) { // spin at head
                long m, s, ns;
                // 获取读锁且判断是否超过最大读锁限制
                if ((m = (s = state) & ABITS) < RFULL ?
                    U.compareAndSwapLong(this, STATE, s, ns = s + RUNIT) :
                    (m < WBIT && (ns = tryIncReaderOverflow(s)) != 0L)) {
                    WNode c; Thread w;
                    whead = node;
                    node.prev = null;
                    // 协助唤醒当前节点中的挂在cowait属性上的读节点
                    while ((c = node.cowait) != null) {
                        if (U.compareAndSwapObject(node, WCOWAIT,
                                                   c, c.cowait) &&
                            (w = c.thread) != null)
                            U.unpark(w);
                    }
                    return ns;
                }
                // 若其他线程占有写锁，随机将spins-1且若没有自旋次数就break
                else if (m >= WBIT &&
                         LockSupport.nextSecondarySeed() >= 0 && --k <= 0)
                    break;
            }
        }
        else if (h != null) {
            WNode c; Thread w;
            while ((c = h.cowait) != null) {
                if (U.compareAndSwapObject(h, WCOWAIT, c, c.cowait) &&
                    (w = c.thread) != null)
                    U.unpark(w);
            }
        }
        // 如果头节点没变化
        if (whead == h) {
            // 更新前置节点状态
            if ((np = node.prev) != p) {
                if (np != null)
                    (p = np).next = node;   // stale
            }
            // 将等待的节点状态设为WAITING
            else if ((ps = p.status) == 0)
                U.compareAndSwapInt(p, WSTATUS, 0, WAITING);
            // 如果节点已取消，那么移除队列
            else if (ps == CANCELLED) {
                if ((pp = p.prev) != null) {
                    node.prev = pp;
                    pp.next = node;
                }
            }
            else {
                // 和之前逻辑相同，处理超时问题
                long time;
                if (deadline == 0L)
                    time = 0L;
                else if ((time = deadline - System.nanoTime()) <= 0L)
                    return cancelWaiter(node, node, false);
                Thread wt = Thread.currentThread();
                U.putObject(wt, PARKBLOCKER, this);
                node.thread = wt;
                if (p.status < 0 &&
                    (p != h || (state & ABITS) == WBIT) &&
                    whead == h && node.prev == p)
                    U.park(false, time);
                node.thread = null;
                U.putObject(wt, PARKBLOCKER, null);
                if (interruptible && Thread.interrupted())
                    return cancelWaiter(node, node, true);
            }
        }
    }
}
```

> 1. 一进来如果无写锁、当前队列没有其他节点或队列未初始化，那么尝试获取读锁，成功就返回。
> 2. 若无法获取读锁，那么和写锁一样，会尝试把当前线程加入队列，但这里分为两种：
>    1. 如果当前线程是`连续几个读线程中第一个加入的读线程`，那么直接`加入队尾`。
>    2. 若不是连续几个读线程第一个加入的读线程，会`进入到首个读节点的cowait属性中，形成链表结构`。
> 3. 和写锁相同，如果长时间无法获取读锁，那么会阻塞当前线程，直到被唤醒继续自旋获取锁。

#### unlockRead

```java
public void unlockRead(long stamp) {
    long s, m; WNode h;
    // 循环执行
    for (;;) {
        // 若版本号不同 或 不存在写锁 或 只有写锁无读锁
        // 上述条件符合一条就抛异常
        if (((s = state) & SBITS) != (stamp & SBITS) ||
            (stamp & ABITS) == 0L || (m = s & ABITS) == 0L || m == WBIT)
            throw new IllegalMonitorStateException();
        // 只有当前读锁次数小于最大读锁次数尝试释放锁
        if (m < RFULL) {
            // CAS修改state
            if (U.compareAndSwapLong(this, STATE, s, s - RUNIT)) {
                // 直到读锁全部释放且头节点不为null且头节点状态不为0
                if (m == RUNIT && (h = whead) != null && h.status != 0)
                    // 唤醒头节点的后继节点并break
                    release(h);
                break;
            }
        }
        // 读线程数量溢出如果
        else if (tryDecReaderOverflow(s) != 0L)
            break;
    }
}
```

> 循环释放读锁节点直到为0，然后唤醒头节点的下一个有效后继节点。

---

### tryOptimisticRead

```java
// 锁的乐观读
public long tryOptimisticRead() {
    long s;
    // 判断是否存在写锁，存在就返回0L，不存在就返回 state的高56位
    return (((s = state) & WBIT) == 0L) ? (s & SBITS) : 0L;
}
```

> 又称为`乐观读`，此处的代码是没有加锁的，所以需要配合`validate`方法使用。

---

### validate

```java
// 校验版本号
public boolean validate(long stamp) {
    // Unsafe的内存屏障api 
    // 为什么使用内存屏障，因为tamp变量没有被volatile修饰
    U.loadFence();
    // 返回state和stamp是否相同
    return (stamp & SBITS) == (state & SBITS);
}

void print() {
	long stamp = LOCK.tryOptimisticRead();
    // 如果stamp修改了，这时再加悲观读锁
    int currentX = x, currentY = y;
    if (!LOCK.validate(stamp)) {
        ...
    }   
}
```

> 我们需要保障`tryOptimisticRead`和`validate`设计的三行代码`不能被重排序`，因为state已经被volatile修饰，但stamp不是volatile，所以在validate中加入`内存屏障`。

---

### 总结

- `StampedLock`不是基于AQS来实现的，但是其内部实现和AQS类似。
- `StampedLock`不支持锁的重入、不支持条件变量且只有非公平实现。
- `StampedLock`的`允许一个线程在存在多个读线程的时候获取写锁`。
- `StampedLock`的悲观读和`ReentrentReadWriteLock`相同，都会因为写锁存在而阻塞。
- `StampedLock`的乐观读，是线程不安全的，但读写不互斥。
- `StampedLock`支持`锁的升级和降级`，而`ReentrentReadWriteLock`只支持`锁降级`。
- `StampedLock`唤醒线程是一次性唤醒连续的读锁，并且其他线程还会协助唤醒。
