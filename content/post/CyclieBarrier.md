---
title: "CyclieBarrier源码解析"
date: 2020-06-29T13:27:36+08:00
description: "基于`CountDownLatch`的特性：`计数器为0时，即使调用await，该线程也不会等待其他线程执行完毕而被阻塞。CyclicBarrier`的出现是为了解决复杂场景`CountDownLatch`使用的劣势。"
tags: ["CyclicBarrier ","AQS"]
categories: [
  "Concurrent"
]
hideReadMore: true
---

### CyclicBarrier

基于`CountDownLatch`的特性：`计数器为0时，即使调用await，该线程也不会等待其他线程执行完毕而被阻塞`。

`CyclicBarrier`的出现是为了解决复杂场景`CountDownLatch`使用的劣势。

> CountDownLatch中存在两种类型的线程：分别是`调用await方法和调用countDown方法的线程`。
>
> 而CyclicBarrier中只存在一种线程：`调用await的线程扮演了上述两种角色，即先countDown后await`。

`CyclicBarrier`拆分成两部分来理解：

- Cyclic（回环）：当所有等待线程执行完毕后，会重置状态，使其能够重用。
- Barrier（屏障）：线程调用await方法就会阻塞，这个阻塞点就是`屏障点`，等到`所有线程调用await方法`后，线程就会穿过屏障继续往下执行。

> 相比`CountDownLatch`只使用一次，`CyclicBarrier`更强调循环使用。

```java
@Slf4j
public class CyclicBarrierTest {

    // 传入每次屏障之前需要等待的线程数量
    private static final CyclicBarrier BARRIER = new CyclicBarrier(2, () -> {
        // 不能保证每代执行该语句的都是同一个线程
        log.info("doSomenthing before the last thread signal other threads")
    });
    private static final ExecutorService EXECUTOR = Executors.newFixedThreadPool(2);

    public static void main(String[] args) {
        EXECUTOR.execute(() -> {
            try {
                //CyclicBarrier 保证await
                log.info("doSomething ... ");
                BARRIER.await();
                log.info("continue exec ...");
                BARRIER.await();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
        EXECUTOR.execute(() -> {
            try {
                log.info("doSomething ... ");
                BARRIER.await();
                log.info("continue exec ...");
                // 如果中断线程，那么会抛出异常
                // Thread.currentThread().interrupt();
                BARRIER.await();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
        EXECUTOR.shutdown();
    }
}
// doSomething
// doSomething
// continue exec
// continue exec
```

> 为什么结果不是随机打印日志，而是先打印完`doSomething`，再打印`continue exec`?

```java
// 使用ReentrantLock和Condition
private final ReentrantLock lock = new ReentrantLock();
private final Condition trip = lock.newCondition();

// 注意这里是final修饰，代表线程总数，当count=0时重置使用
private final int parties;
// 表明还需要多少个线程到达屏障
private int count;

// 表明每一代线程通过屏障之前需要完成的事情（并不是通过新起线程来实现）
private final Runnable barrierCommand;
// 每一组一起通过屏障的线程叫做一代Generation，不同代之间通过==比较
private Generation generation = new Generation();

public CyclicBarrier(int parties, Runnable barrierAction) {
    // paries的值必须大于0
    if (parties <= 0) throw new IllegalArgumentException();
    this.parties = parties;
    this.count = parties;
    this.barrierCommand = barrierAction;
}

// Generation只有一个属性：broken
private static class Generation {
    // false 表明线程是全部到达后一起穿过屏障
    // true表明线程没有全部到达前，就有线程穿过屏障了
    // 线程监测到会抛出BrokenBarrierException
    boolean broken = false;
}
```

> 1. `CyclicBarrier`的需要借助`Condition`来实现，执行`await的线程`需要加入条件队列等待唤醒。
> 2. `parties`是final修饰的变量，作用于count = 0时的`重新复位计数器`。
> 3. `Generation`表示一组一起通过屏障的线程，不同代之间通过`==`来比较。
> 4. `barrierCommand`用于每代线程通过屏障之前需要完成的事情（不会另起线程执行）。
> 5. 每代都包含一定`parties`的线程，通过属性`broken = true`来表明当代线程全部作废。

### nextGeneration

```java
private void nextGeneration() {
    // 唤醒上一代的线程（表明此时是有锁的）
    trip.signalAll();
    // 将count重置为parties
    count = parties;
    // new 生成新一代
    generation = new Generation();
}
```

> 该方法的目的是为了`唤醒上一代的线程，并重置count及通过创建对象开启下一代`。

### breakBarrier

```java
private void breakBarrier() {
    // 修改Generation对象参数
    generation.broken = true;
    // 重置计数器
    count = parties;
    // 唤醒上一代等地的线程
    trip.signalAll();
}
```

> 与`nextGeneration`不同点在于：修改`Generation对象`参数，以及`没有创建下一代Generation`。

### reset

```java
public void reset() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        breakBarrier();   // break the current generation
        nextGeneration(); // start a new generation
    } finally {
        lock.unlock();
    }
}
```

> reset方法在获取锁的前提下调用了`breakBarrier 和 nextGeneration`方法，除了`修改这一代Generation的broken、重置计数器外，还创建了下一代Generation`（虽然代码有些重复）。

---

### await

```java
// 同一个线程可能多次调用await方法
// 返回值表明还需要多少个线程到达屏障处
public int await() throws InterruptedException, BrokenBarrierException {
    try {
        // false表明不需要判断超时
        return dowait(false, 0L);
    } catch (TimeoutException toe) {
        // await()中的dowait按道理不会抛出该异常
        throw new Error(toe);
    }
}

private int dowait(boolean timed, long nanos) throws InterruptedException, 										BrokenBarrierException, TimeoutException {
    final ReentrantLock lock = this.lock;
    // 获取独占锁
    lock.lock();
    try {
        // 获取这一代的Generation
        final Generation g = generation;
		// 之前breakBarrier方法会修改broken参数为true，如果线程监测到会抛出异常
        if (g.broken)
            throw new BrokenBarrierException();
        // 该方法响应中断，抛出中断异常前会调用breakBarrier
        if (Thread.interrupted()) {
            breakBarrier();
            throw new InterruptedException();
        }
		// 此中代码不需要考虑竞争
        // 将count-1类似countDownLatch中的countDown
        int index = --count;
        if (index == 0) { 
            // index = 0说明除当前线程外的其他线程都执行了await方法
            // 当前需要准备带领其他线程一起冲破屏障了
            boolean ranAction = false;
            try {
                // 执行冲破屏障前的任务
                final Runnable command = barrierCommand;
                // 这里可以看出，没有另起线程去执行，就是当前线程处理的
                if (command != null)
                    command.run();
                // 修改ranAction参数
                ranAction = true;
                // 调用nextGeneration唤醒所有等待线程、重置count并创建下一代
                nextGeneration();
                return 0;
            } finally {
                // 如果当前线程执行command任务失败
                if (!ranAction)
                    // 调用breakBarrier
                    breakBarrier();
            }
        }

        // 执行到此说明当前线程不是当代最后一个线程
        // 自旋直到被中断、await超时、broken=true或count=0
        for (;;) {
            try {
                // 进行await(time)方法的处理
                if (!timed)
                    // 当前count!=0，所以将当前线程放入条件队列等待唤醒
                    // 唤醒后从此处继续执行
                    trip.await();
                else if (nanos > 0L)
                    // Condition.await(指定时长)
                    // 返回的是deadline - currentTime的差值
                    nanos = trip.awaitNanos(nanos);
            } catch (InterruptedException ie) {
                // 如果当前线程被中断执行此处逻辑
                // 判断当前线程的generation是否改变，如果没有改变且g.broken的值是false
                // 执行breakBarrier方法并抛出中断异常
                if (g == generation && ! g.broken) {
                    breakBarrier();
                    throw ie;
                } else {
                    // 执行到此处
                    // 要么是Generation已经更新了，那么不能执行breakBarrier影响这一代
                    // 要么是g.broken = true，说明已经执行过breakBarrier，那就不再执行
                    // 最终修改当前线程中断位位true
                    Thread.currentThread().interrupt();
                }
            }
			// 此时还在循环中，继续判断broken
            if (g.broken)
                throw new BrokenBarrierException();
			// 执行到此如果不是同一代，那么此时只有两种可能
            // 1. 当前线程await后被唤醒，发现代已经更新，即最后一个线程已执行过。直接返回即可
            // 2. reset方法被调用，它其中的nextGeneration创建了新一代。
            if (g != generation)
                return index;
			
            // 执行到此说明broken = false 且 代没有更新，最后一个线程还没来
            // 继续判断是否超时，如果超时调用breakBarrier并抛出异常
            if (timed && nanos <= 0L) {
                breakBarrier();
                throw new TimeoutException();
            }
        }
    } finally {
        // 最终释放锁
        lock.unlock();
    }
}
```

> 1. await方法是响应中断的，并且如果`Generation.broken = true`则会抛出指定异常。
> 2. 若当前线程恰好是执行`当前代执行await方法的最后一个线程`，那么它会执行`barrierCommand`。
> 3. 若不是当前代的最后一个线程，那么会进入`自旋`，加入条件队列阻塞`直到被最后一个线程唤醒`。
> 4. CyclicBarrier暴露了`reset`方法，只有通过这个方法才能`显式中断这一代、重置count和开启下一代`。

---

### await(time)

```java
public int await(long timeout, TimeUnit unit)
throws InterruptedException, BrokenBarrierException,TimeoutException {
    return dowait(true, unit.toNanos(timeout));
}

// 下面是与await方法唯二不同的地方
private int dowait(boolean timed, long nanos){
    ...
    for(;;) {
        if (!timed)
            trip.await();
        else if (nanos > 0L)
            // 执行的是Condition.await(time)方法
            nanos = trip.awaitNanos(nanos);
        ...
    }
    ...
    if (timed && nanos <= 0L) {
       breakBarrier();
        // await并不会抛出此异常
       throw new TimeoutException();
    }
}
```

> await(time)方法与await大部分是相同的，区别在于：
>
> 1. await(time)执行的是Condition.await(time)方法，到时`自动唤醒（底层LockSupprt.parkNanos）`来实现的。
> 2. await(time)会`抛出TimeoutException`异常。

---

### 总结

- CyclicBarrier和CountDownLatch类似，都要传入`int值来设置计数器（区别：前者>0，后者>=0）`。
- CyclicBarrier的countDown和await都`由同一个线程实现`，而CountDownLatch由两种线程分别实现。
- CyclicBarrier实现了循环利用，每有`parties`个线程到达屏障，就`生成新一代并唤醒老一代线程从await处退出`继续执行各自线程中的代码，直到代码执行完毕或下一个await。
