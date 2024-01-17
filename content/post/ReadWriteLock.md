---
title: "ReadWriteLock源码解析"
date: 2020-06-24T09:15:29+08:00
description: "具备`独占锁和共享锁`两者特性的读写锁，适用于读操作多于写操作的场景。"
tags: ["ReentrantReadWriteLock ","AQS"]
categories: [
  "Concurrent"
]
hideReadMore: true
slug: concurrent_read_write_lock
---

### ReadWriteLock

ReadWriteLock是接口，它定义了两个方法：`ReadLock`和`WriteLock`，读写锁的具体实现在`ReentrantReadWriteLock`中。读写锁是之前分析的`独占锁`和`共享锁`两个特性的集合体，具有如下规定：

1. 允许多个线程同时读取变量。
2. 某时刻只允许一个线程写变量。
3. 如果有写线程正在执行写操作，那么禁止其他读线程读取变量。

ReadWriteLock的默认实现类`ReentrantReadWriteLock`

```java
public class ReentrantReadWriteLock  implements ReadWriteLock {
	// 读锁和写锁都是ReentrantReadWriteLock的内部类
    private final ReentrantReadWriteLock.ReadLock readerLock;
    private final ReentrantReadWriteLock.WriteLock writerLock;

    final Sync sync;
    // 读写锁默认是非公平锁
    public ReentrantReadWriteLock() {
        this(false);
    }
    
    // ReadLock和WriteLock都是继承了同一个抽象类Lock，所以他们属于同一个AQS队列
    public ReentrantReadWriteLock(boolean fair) {
        sync = fair ? new FairSync() : new NonfairSync();
        readerLock = new ReadLock(this);
        writerLock = new WriteLock(this);
    }
}
```

> 相比于`Semaphore`，`ReentrantReadWriteLock`采用共享和独占结合的方法。Semaphore就像是一个令牌桶，谁都可以拿取令牌执行任务，谁都可以归还令牌。它不会记录是哪个线程获取了锁，而`ReentrantReadWriteLock`会记录，只有持有相关锁才能来释放锁。

#### state

与独占锁、共享锁的state的使用不同，因为需要表示两种状态，所以对`int型state`做了`高低位切割`，分别表示不同的状态。已知`int=4byte= 32bit`，所以`高16位表示读，低16位表示写`。他们的取值范围在`[0 ~ 2^16 - 1]`，进而我们可以得出，最多有`2^16 -1`个线程可以获取读锁。

![](https://image.leejay.top/image/20200630/iU956J9I2D6U.png?imageslim)

```java
abstract static class Sync extends AbstractQueuedSynchronizer {
      
    static final int SHARED_SHIFT   = 16;
    static final int SHARED_UNIT    = (1 << SHARED_SHIFT);
    // 读锁和写锁的count不能超过MAX_COUNT
    static final int MAX_COUNT      = (1 << SHARED_SHIFT) - 1;
    static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1;

    // 返回读锁的count
    static int sharedCount(int c) { 
        return c >>> SHARED_SHIFT; 
    }
    // 返回写锁的count
    static int exclusiveCount(int c) { 
        return c & EXCLUSIVE_MASK; 
    }
}
```

> 1. 读锁和写锁的count不能超过`MAX_COUNT即2^16-1`。
>
> 2. int 型 state 无符号右移16位，得到的即为高16位的count。
>
> 3. int 型 state 与 `1111 1111 1111 1111`做`与运算`，它的结果也不会超过`1111 1111 1111 1111`，因为`与运算`的规则是`都1为1，否则为0`。
>
>    ```java
>    如int state = 3，那么它的二进制如下
>        
>      0000 0000 0000 0000 0000 0000 0000 0011
>    &                     1111 1111 1111 1111
>    ——————————————————————————————————————————    
>                          0000 0000 0000 0011
>    ```
>
> 4. 如果读count + 1，那么就等于 `c  =  c + 1 << 16`，如果count + 1，那么`c = c + 1`。
>
> 5. `如果c 不为 0，当写count = 0时，读count > 0成立`。即读锁已经获取。

#### ThreadLocalHoldCounter

除了需要记录锁被拿取的总次数，还需要记录每个线程分别拿走多少，所以我们使用`ThreadLocal`，将记录的工作交给线程自己。

```java
abstract static class Sync extends AbstractQueuedSynchronizer {
    // 当前线程持有的读锁数量，当为0的时候置为null
    private transient ThreadLocalHoldCounter readHolds;
    
    // 保存成功获取读锁的线程的count 注意非volatile
    private transient HoldCounter cachedHoldCounter;
    // 用于读锁，表明第一个获取读锁的线程是谁
    private transient Thread firstReader = null;
    // 用于读锁，表明第一个获取读锁的线程重入了几次
    private transient int firstReaderHoldCount;
	Sync() {
        readHolds = new ThreadLocalHoldCounter();
        setState(getState()); // ensures visibility of readHolds
    }
    // 每个线程都拥有HoldCounter类的实例，互不干预
    static final class HoldCounter {
        int count = 0;
        // 这里线程id直接使用id，不使用reference，便于GC
        final long tid = getThreadId(Thread.currentThread());
    }

    static final class ThreadLocalHoldCounter
        extends ThreadLocal<HoldCounter> {
        public HoldCounter initialValue() {
            return new HoldCounter();
        }
    }
}
```

> 1. 这里使用线程ID而不是用线程对象的原因时避免`HoldCounter和ThreadLocal互相绑定导致GC难以释放(可以释放只是需要代价)`，目的就是帮助GC快速回收对象。
> 2. 定义三个成员变量：cachedHoldCounter、firstReader和firstReaderHoldCount原因是为了`快速判断当前线程是否持有读锁`。

---

### WriteLock

我们从写锁开始入手，写锁就是独占锁的体现。

- tryLock

  ```java
  // 写锁入口
  public void lock() {
      sync.acquire(1);
  }
  
  public final void acquire(int arg) {
      if (!tryAcquire(arg) &&
          acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
          selfInterrupt();
  }
  // 与独占锁不同的子类实现
  protected final boolean tryAcquire(int acquires) {
      // 获取当前线程
      Thread current = Thread.currentThread();
      int c = getState();
      // 获取写锁的count
      int w = exclusiveCount(c);
      // c!=0说明有锁，但不知道是什么锁
      if (c != 0) {
          // state != 0 且 w = 0说明此时存在读锁，返回false
          // w != 0 说明存在写锁，必须要求当前线程是持有写锁的线程，否则返回false
          if (w == 0 || current != getExclusiveOwnerThread())
              return false;
          // 判断写锁count是否超过最大count
          if (w + exclusiveCount(acquires) > MAX_COUNT)
              throw new Error("Maximum lock count exceeded");
          // 到此处说明是当前线程，所以无竞争，直接set改变写锁count
          setState(c + acquires);
          return true;
      }
      // c=0说明说明无锁
      // 如果不需要阻塞就尝试CAS修改state
      if (writerShouldBlock() ||
          !compareAndSetState(c, c + acquires))
          return false;
      // 设置当前线程为独占线程
      setExclusiveOwnerThread(current);
      return true;
  }
  // 非公平锁实现
  static final class NonfairSync extends Sync {
      // 非公平直接返回false尝试去获取锁
      final boolean writerShouldBlock() {
          return false;
      }
  }
  
  // 公平锁实习那
  static final class FairSync extends Sync {
      // 如果返回true说明前面有节点等待
      final boolean writerShouldBlock() {
          // 判断队列中是否有前驱节点在等待
          return hasQueuedPredecessors();
      }
  }
  
  ```

> 写锁获取成功的情况：
>
> 1. 写锁的线程持有者重入了写锁。
> 2. 写锁不被任何线程持有，当前线程竞争得到了锁。
>
> 写锁获取失败的情况：
>
> 1. 当前线程不是写锁的持有者。
>
> 2. `当前只有读锁没有写锁`，不能将读锁升级为写锁。
>
> 3. 公平锁判断当前线程排在了队列中其他线程后面。
>
> 4. 尝试CAS修改state失败了。

#### tryWriteLock

```java
final boolean tryWriteLock() {
    Thread current = Thread.currentThread();
    int c = getState();
    if (c != 0) {
        int w = exclusiveCount(c);
        if (w == 0 || current != getExclusiveOwnerThread())
            return false;
        // 如果等于最大值就抛溢出异常
        if (w == MAX_COUNT)
            throw new Error("Maximum lock count exceeded");
    }
    // 即使是写锁的持有线程还是通过CAS设置state
    if (!compareAndSetState(c, c + 1))
        return false;
    setExclusiveOwnerThread(current);
    return true;
}
```

> 与tryAcquire类似，是`非公平、一次性`的获取写锁，写锁计数默认加1。

#### release

  写锁的释放流程与独占锁释放类似，只是tryRelease不同，我们只需要关注AQS的子类实现即可

  ```java
  // ReentrentReadWriteLock
  public void unlock() {
    sync.release(1);
  }
  //AQS.release
  public final boolean release(int arg) {
      if (tryRelease(arg)) {
          Node h = head;
          if (h != null && h.waitStatus != 0)
              unparkSuccessor(h);
          return true;
      }
      return false;
  }
  // boolean/false 释放/不是反
  protected final boolean tryRelease(int releases) {
      // 如果不是写锁持有线程则抛出异常
      if (!isHeldExclusively())
          throw new IllegalMonitorStateException();
      // 计算释放后新值
      int nextc = getState() - releases;
      // 判断写锁count == 0 写锁是否存在重入
      boolean free = exclusiveCount(nextc) == 0;
      // 为true说明已经全部释放
      if (free)
          // 清空当前独占线程
          setExclusiveOwnerThread(null);
      // 设置state
      setState(nextc);
      return free;
  }
  ```

  > 只有`state中低16位值 = 0`的时候才表明写锁释放完毕。

---

### ReadLock

读锁就是共享锁的体现，我们直接查看ReentrantReadWriteLock中AQS的子类的`tryAcquireShared`和`tryReleaseShared`实现即可。

- tryAcquireShared

  ```java
  // 首先我们知道int返回值的不同代表了共享锁获取的不同情况(和semaphore一致)
  protected final int tryAcquireShared(int unused) {
  // 获取当前线程
      Thread current = Thread.currentThread();
      // 获取state
      int c = getState();
      // 1. 写锁count = 0，说明此时没有写锁。继续执行
      // 2. 写锁count != 0 ,此时有写锁，但写锁持有者是当前线程。继续执行
      // 3. 写锁count != 0,此时有写锁，但写锁持有者不是当前线程，获取失败，执行中断。
      if (exclusiveCount(c) != 0 &&
          getExclusiveOwnerThread() != current)
          return -1;
      // 计算读锁count，无符号右移16位
      int r = sharedCount(c);
      // 1. readerShouldBlock 判断是否需要阻塞，false/true 不阻塞/阻塞
      // 2. 读锁count < MAX_COUNT
      // 3. 将读锁加1，即state高16位加1
      if (!readerShouldBlock() &&
          r < MAX_COUNT &&
          compareAndSetState(c, c + SHARED_UNIT)) {
          // 执行到这里说明已经成功将读锁加1
          // 如果 r = 0说明当前线程是第一个获取读锁的线程，此时不存在竞争
          if (r == 0) {
              // 设置firstReader 和 firstReaderHoldCount属性
              firstReader  = current;
              firstReaderHoldCount = 1;
            // 如果r != 0 但 firstReader == current说明
            // 第一个读锁线程又重入了，那么只要修改firstReaderHoldCount即可
          } else if (firstReader == current) {
              // 这里不需要加锁，因为当前线程就是第一个读锁线程，不会有其他线程来操作
              firstReaderHoldCount++;
          } else {
              // 此处说明当前线程不是第一个来获取读锁的线程
              // 定义局部变量rh = 成员变量cachedHoldCounter
              HoldCounter rh = cachedHoldCounter;
              // 该条件能够保证rh持有的是当前线程的HoldCounter
              if (rh == null || rh.tid != getThreadId(current))
                  // a.将rh 和 cachedHoldCounter 指向ThreadLocal中的HoldCounter
                  cachedHoldCounter = rh = readHolds.get();
              // 执行到这里说明是之前设置过cachedHoldCounter的线程来获取读锁
              // 运气很好。这里尝试获取结果发现cachedHoldCounter就是当前线程
              // 如果rh.count = 0就说明当前线程释放了读锁，且没有获取读锁的线程HC=null
              // 所以这里当rh.count=0时需要设置rh到当前线程ThreadLocal中
              else if (rh.count == 0)
                  readHolds.set(rh);
              // 不论如何rh.count都会+1，注意cacheHoldCounter = rh,所cHC.count也+1
              rh.count++;
          }
          // 返回1表明获取成功
          return 1;
      }
      // 如果不能获取读锁执行下面逻辑
      return fullTryAcquireShared(current);
  }
  // 公平锁实现
  static final class FairSync extends Sync {
      // 判断当前线程是否是队列第一个节点
      final boolean readerShouldBlock() {
          return hasQueuedPredecessors();
      }
  }
  // 非公平锁实现
  static final class NonfairSync extends Sync {
      final boolean readerShouldBlock() {
          // 第一个节点是shared就返回false否则返回true
          return apparentlyFirstQueuedIsExclusive();
      }
  }
  ```

  > 1. 当`!readerShouldBlock() && r < MAX_COUNT && compareAndSetState(c, c + SHARED_UNIT)`为true时，此时共享锁已经获取成功，大括号中的代码都是在设置相关参数。
  >
  > 2. `r(share read count) = 0`说明此时暂无共享锁，进入该分支的只能是`第一个`来获取共享锁的线程，所以这个分支设置属性时不需要进行同步操作。
  >
  > 3. 若`r != 0`，进入`else if 分支`，此时`firstReader != null`必成立，若`firstReader = current`，说明当前线程是第一个获取共享锁的线程，它重入了，所以这里只需要将`firstReaderHoldCount`加1即可。
  >
  > 4. 进入最后一个else分支，到这个地方的线程必是`非第一个获取共享锁的线程`，首先我们需要明白此处的代码是没有同步操作的，且`cachedHoldCounter没有用volatile`修饰的，也就是`下个线程可能看不到上个线程对cachedHoldCounter的操作`。
  >
  > 5. ①若`rh = null`，那么跳转③。
  >
  >    ② 若`rh != null 但 HC.tid != currentTid`，说明`上个获取读锁的线程和当前线程不同`，跳转③。
  >
  >    ③ 获取当前线程的`HoldCounter(简称HC)`，跳转⑥。
  >
  >    ④ 若 `rh != null 但 rh.tid = currentTid`，说明`上个获取读锁的线程和当前线程相同`，读锁重入了，跳转⑤。
  >
  >    ⑤ 若 `rh.count = 0`，设置`当前线程的HC = rh`，跳转⑥。
  >
  >    ⑥ 至此`rh = 当前线程的HC`，将`rh++的同时cachedHoldCounter++`，然后` return 1`，tryAcquireShared方法结束。
  >
  > 6. step5 中比较疑惑的是何时`else if(rh.count == 0)`成立？这里需要涉及到读锁释放的代码来帮助理解。
  >
  >    ```java
  >    HoldCounter rh = cachedHoldCounter;
  >    if (rh == null || rh.tid != getThreadId(current))
  >        rh = readHolds.get();
  >    int count = rh.count;
  >    if (count <= 1) {
  >        readHolds.remove();
  >        if (count <= 0)
  >            throw unmatchedUnlockException();
  >    }
  >    --rh.count;
  >    ```
  >
  >    > 首先我们需要明确，在`读锁释放过程中，它只是清空了线程的私有HC，并没有处理cHC`。
  >    >
  >    > 我们假设线程A（非第一个获取读锁的线程）获取了读锁，释放读锁后再一次获取读锁这个流程来分析：
  >    >
  >    > 1. 线程A获取读锁成功进入else分支后，它会设置`threadA.HoldCounter.count = cacheHoldCounter = 1`，进线程A读锁释放，`rh = cacheHoldCounter != null`且此时count = 1，执行`readHolds.remove()`，然后`--rh.count`，这样`cacheHoldCounter.count也要减1，变成了0`。
  >    > 2. 此时线程A继续获取读锁成功，进入读锁else判断流程发现`rh = cacheHoldCounter != null`，且`rh.tid = currentTid`，所以执行`else if (rh.count == 0)`判断，此时该条件成立，并且当前线程的HC = null，所以这里需要设置当前线程的HC。代码的目的就是为了保证`读锁的获取-释放之后再获取读锁时，不会因为之前读锁的释放导致当前线程的HC为null`。
  >
  > 7. 获取共享锁成功后的代码，都是在处理
  >
  >    `firstReader`：第一个获取读锁的线程。
  >
  >    `firstReaderHoldCount`：第一个获取读锁的线程获取读锁次数。
  >
  >    `cachedHoldCounter`：获取最新获取读锁的线程的HoldCounter。
  >
  >    `HoldCounter.count`：将每个线程获取的读锁次数记录在本地线程中。

#### apparentlyFirstQueuedIsExclusive

  ```java
  // 一定概率防止读锁非公平获取锁，让它去排队，让写锁不要无限等待。
  final boolean apparentlyFirstQueuedIsExclusive() {
      Node h, s;
      return (h = head) != null &&
          (s = h.next)  != null &&
          !s.isShared()         &&
          s.thread != null;
  }
  ```

  > 1. 如果head的next节点不存在（队列中第一个等待的节点）直接返回false；
  > 2. 如果队列第一个等待节点是`Shared读`节点，那么返回false，当前线程就可以获取读锁。
  > 3. 如果队列的第一个等待节点是`EXCLUSIVE写锁`，那么返回true，当前线程就不能获取读锁。
  > 4. 方法目的：`一定概率阻止读锁非公平获取动作，如果第一个节点是写锁，让读锁去排队，防止写锁无限等待（注意是一定概率，如果第一个是读锁，第二个是写锁，就不会排队），是非完全不公平读锁。`

#### fullTryAcquireShared

  ```java
  // 第一次尝试获取共享锁失败就会进入此方法
  final int fullTryAcquireShared(Thread current) {
      // 定义局部变量rh
      HoldCounter rh = null;
      // 循环获取共享锁
      for (;;) {
          // 获取state
          int c = getState();
          // 如果存在写锁，当前线程不是写锁的持有线程，直接抛错。
          if (exclusiveCount(c) != 0) {
              if (getExclusiveOwnerThread() != current)
                  return -1;
              else 
                  // do nothing
                  // 如果在这个else分支中return -1，会导致死锁
                  // 因为写锁的持有线程获取共享锁失败，会被阻塞，那就没人唤醒它了
                  
          // 执行到此处说明不存在写锁 
          // 非公平锁需要判断队列第一个节点是否是写锁在等待
          // 公平锁需要查看队列是否有head后继节点在等待
          } else if (readerShouldBlock()) {
              // 执行至此说明暂无写锁，但队列中有head后继节点在等待（公平）
              // 一般有等待的节点直接返回-1，继续执行代码的原因是因为需要判断读锁是否重入
              // 查看第一个获取共享锁是否是当前线程
              if (firstReader == current) {
                  // 执行到此处说明当前线程是持有读锁的，且是第一次获取读锁的线程
              } else {
                  if (rh == null) {
                      rh = cachedHoldCounter;
                      // 判断当前是否获取了读锁，若没有则将当前线程的HC置为null
                      if (rh == null || rh.tid != getThreadId(current)) {
                          rh = readHolds.get();
                          // 执行到这说明当前线程第一次获取读锁
                          if (rh.count == 0)
                              readHolds.remove();
                      }
                  }
                  // 1. rh=cachedHoldCounter=!=null 是当前线程的HC，rh.count!=0
                  // 2. rh=当前线程HC，cachedHoldCounter=null， rh.count=0
                  if (rh.count == 0)
                      return -1;
              }
          }
          // 至此当前线程可以获取读锁
          // 判断读锁count是否超过MAX_COUNT
          if (sharedCount(c) == MAX_COUNT)
              throw new Error("Maximum lock count exceeded");
          // CAS修改state
          if (compareAndSetState(c, c + SHARED_UNIT)) {
              // 这里的逻辑与tryAcquireShared类似
              if (sharedCount(c) == 0) {
                  firstReader = current;
                  firstReaderHoldCount = 1;
              } else if (firstReader == current) {
                  firstReaderHoldCount++;
              } else {
                  // 这部分就是设置每个线程获取读锁的count
                  if (rh == null)
                      rh = cachedHoldCounter;
                  if (rh == null || rh.tid != getThreadId(current))
                      rh = readHolds.get();
                  else if (rh.count == 0)
                      readHolds.set(rh);
                  rh.count++;
                  // 设置cachedHoldCounter = 最新获取读锁成功的线程的HC
                  cachedHoldCounter = rh;
              }
              return 1;
          }
      }
  }
  ```

  > 1. 如果`存在写锁，但当前线程不是写锁的持有线程`，直接返回-1，获取共享锁失败。若当前线程是写锁的持有线程，那么直接尝试获取读锁。
  >
  > 2. 与之前`readerShouldBlock`方法返回true直接共享锁获取失败不同，这里需要继续`判断是否读锁重入`的情况。如果当前线程已获取过读锁，那么直接获取共享锁，否则返回-1去排队。
  >
  > 3. `firstReader = current`说明当前线程是第一个获取共享锁的线程，并且当前线程准备重入锁，所以直接准备获取读锁。
  >
  > 4. `firstReader != current`就无法快速判断了，根据之前tryAcquireShared中类似的代码，执行到第一个`if (rh.count == 0)`代码前，说明`rh = 当前线程的HC = new HoldCounter`，说明当前线程是第一次获取读锁，此时第一个`if (rh.count == 0)`必定成立，需要移除`当前线程的HoldCounter`（为什么？`因为当线程没有读锁的时候，当前线程的HoldCounter = null`），这样继续执行到第二个`rh.count == 0`成立，返回-1并退出。
  >
  > 5. 如果不执行第一个而是执行到`if (rh.count == 0)`前，说明当前线程是重入锁，那么`rh.count != 0`必定成立，所以继续执行准备获取共享锁。step4和step5的作用就是：`先判断当队列第一个节点是写锁时（非公平），再判断如果是重入读锁可以获取，如果是第一次获取读锁则不能获取`
  > 6. 下面获取共享锁的代码逻辑与`tryAcquirShared`作用类似，都是获取读锁成功的善后工作。

---

### tryLock

  ```java
  final boolean tryReadLock() {
      Thread current = Thread.currentThread();
      for (;;) {
          int c = getState();
          if (exclusiveCount(c) != 0 &&
              getExclusiveOwnerThread() != current)
              return false;
          int r = sharedCount(c);
          if (r == MAX_COUNT)
              throw new Error("Maximum lock count exceeded");
          if (compareAndSetState(c, c + SHARED_UNIT)) {
              if (r == 0) {
                  firstReader = current;
                  firstReaderHoldCount = 1;
              } else if (firstReader == current) {
                  firstReaderHoldCount++;
              } else {
                  HoldCounter rh = cachedHoldCounter;
                  if (rh == null || rh.tid != getThreadId(current))
                      cachedHoldCounter = rh = readHolds.get();
                  else if (rh.count == 0)
                      readHolds.set(rh);
                  rh.count++;
              }
              return true;
          }
      }
  }
  ```

  > tryLock和我们分析的tryAcquireShared类似，返回值不同tryLock是boolean值，同时tryLock采用的是`自旋`直到成功获取，或者`写锁被其他线程获取则返回false，获取失败。`

### tryReleaseShared

  ```java
  // AQS.unlock
  public void unlock() {
      sync.releaseShared(1);
  }
  public final boolean releaseShared(int arg) {
      if (tryReleaseShared(arg)) {
          doReleaseShared();
          return true;
      }
      return false;
  }
  // 我们只分析ReentrentReadWriteLock-tryReleaseShared具体实现
  protected final boolean tryReleaseShared(int unused) {
      // 获取当前线程
      Thread current = Thread.currentThread();
      // 如果当前线程是第一个获取读锁的线程
      if (firstReader == current) {
          // 若firstReaderHoldCount = 1成立。说明该线程只获取了一次共享锁
          if (firstReaderHoldCount == 1)
              firstReader = null;
          else
              // 说明第一个获取读锁的线程重入了读锁
              firstReaderHoldCount--;
      } else {
          // 执行到这说明当前线程不是第一个获取读锁的线程
          HoldCounter rh = cachedHoldCounter;
          // 与读锁获取代码类似
          if (rh == null || rh.tid != getThreadId(current))
              rh = readHolds.get();
          // 执行到此rh = 当前线程的HC
          // 如果rh != null 且 rh.tid = getThreadId(current)
          // 说明cachedHoldCounter恰好是当前线程的HC
          int count = rh.count;
          // 如果rh.count > 1说明该线程的读锁重入了
          // 如果rh.count = 1说明该线程的读锁获取了一次
          if (count <= 1) {
              // 清空当前线程的HoldCounter，但是不处理cachedHoldCounter
              readHolds.remove();
              // 如果rh.count = 0说明当前线程没有持有过读锁，抛异常
              if (count <= 0)
                  throw unmatchedUnlockException();
          }
          // 将rh.count减1的同时，如果cachedHoldCounter!= null
          // cachedHoldCounter.count 也要减1
          // 因为他们指向了都是当前线程私有的HoldCounter
          --rh.count;
      }
      //虽然读锁减1了，但是关键变量state还没有修改
      for (;;) {
          int c = getState();
          int nextc = c - SHARED_UNIT;
          if (compareAndSetState(c, nextc))
              // 只有当读写锁全部释放了，才会返回true，否则一直是false
              return nextc == 0;
      }
  }
  ```

   > 1. 读锁的释放容易理解，就是判断当前线程的读锁是否是重入锁，以及将每个线程中的`HoldCounter`中的`count-1`。
   > 2. 需要注意执行到`--rh.count;`，如果`cachedHoldCounter != null（说明cachedHoldCounter 恰好是当前线程的HC）`那么除了`rh.count，cachedHoldCounter.count`也需要减1。
   > 3. `if (count <= 1) `何时`count = 0`？说明当前线程没有持有过读锁，就调用了释放读锁的方法。
   > 4. 只有读写锁完全释放，tryReleaseShared才返回true，继而调用`doReleaseShared`方法。

---

### 锁升级与降级

读锁线程多个线程共享的，而写锁单个线程独占的，所以写锁的并发限制比读锁高。

基于以上定义：

- 同一个线程中，`在释放读锁的前，获取了写锁`，这种情况叫做`锁升级`（读写锁不支持）。

   我们知道获取写锁的前提条件是`读锁释放完毕`，假设此时有两个读锁线程都想获取写锁，这两个线程都想释放除自己以外的读锁，但是他们都在等对方释放，那么会导致`死锁`。究其原因：读锁是多线程共享的，大家都有读锁，凭啥我要让着你去释放我自己的读锁，都不让那就死锁了。

- 同一个线程中，`在释放写锁的前，获取了读锁`，这种情况叫做`锁降级`（读写锁支持）。

   那为什么支持锁降级呢？因为`写锁是独占的`，此刻只有我一个人持有写锁，所以我想获取读锁就获取，不会有其他人和我抢读锁（除非这个读锁本身，但只是读锁重入而已不会产生竞争）。

### 总结：

- 如果有一线程持有读锁，那么此时其他线程（包括已持有读锁线程）无法获取写锁`（获取写锁的前提条件是所有的读锁释放完毕）`。

- 如果有一线程持有读锁，那么其他线程（包括已持有读锁线程）是可以获取读锁的，读写互斥，读读不互斥。

- 如果有一线程持有写锁，（除非是持有写锁线程本身）否则其他线程都不能获取读锁/写锁。写读/写写互斥。

  ```java
  public class CachedDate {
      Object data;
      volatile boolean cacheValid;
      final ReentrantReadWriteLock rwl = new ReentrantReadWriteLock();
  
      void processCachedData() {
          // 先获取读锁
          rwl.readLock().lock();
          // 判断cacheValid即缓存是否可用
          if (!cacheValid) {
              // 到这里说明cache可用准备写值
              // 需要先释放读锁在获取写锁
              rwl.readLock().unlock();
              rwl.writeLock().lock();
              try {
                  // 需要再次简要cacheValid，防止其他线程在此期间改过该值
                  // 在use方法之前获取写锁写入data值及修改cacheValid状态
                  if (!cacheValid) {
                      data = System.currentTimeMillis();
                      cacheValid = true;
                  }
                  // 这里就是锁降级。在写锁释放之前先获取读锁。
                  rwl.readLock().lock();
              } finally {
                  // 释放写锁
                  rwl.writeLock().unlock();
              }
          }
          // 模拟执行use前的耗时操作
  		Thread.sleep(1000L);
          try {
              // 对缓存数据进行打印
              use(data);
          } finally {
              // 最终释放读锁
              rwl.readLock().unlock();
          }
      }
      // 只是打印缓存值
      void use(Object data) {
          System.out.println("use cache data " + data);
      }
  }
  ```

  > Q：为什么要在写锁释放前，获取读锁呢？
  >
  > A：如果线程A修改了值V，在释放写锁前没有获取读锁，那么在调用use()方法前，线程B获取了写锁，并修改了值V，这个修改`对线程A是不可见的`。最终打印的data可能是线程B修改的值。
  >
  > Q：锁降级是否是必要的？
  >
  > A：如果线程A在执行use时传递的`想是自己修改的数据，那么需要锁降级`。如果希望`传递的是最新的数据，那么不需要锁降级`。

##### 读写锁总结

- ReetrentReadWriteLock通过将state变量分为高低16位来解决记录读锁写锁获取的总数。
- 读锁的私有变HoldCounter记录者当前线程获取读锁的次数，底层通过`ThreadLocal`实现。
- 读锁的非公平获获取，通过`apparentlyFirstQueuedIsExclusive`方法一定概率防止了写锁无限等待。
- 当线程A获取写锁时，会因为其他持有`写锁（不包括线程A）`或`读锁（包括线程A）`的线程而阻塞。
- 当线程A获取读锁时，会因为其他持有`写锁（不包括线程A)`而阻塞。
