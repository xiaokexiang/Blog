---
title: "CountDownLatch源码解析"
date: 2020-06-27T18:44:37+08:00
description: "CountDownLatch适用于一个或一组线程任务需要等到条件满足之后才能继续执行的场景。"
tags: ["CountDownLatch ","AQS"]
categories: [
  "Concurrent"
]
hideReadMore: true
slug: concurrent_count_down_latch
---

### CountDownLatch

描述`一个或一组线程任务需要等到条件满足之后才能继续执行`的场景。

常见于主线程开启多个子线程执行任务，主线程需等待所有子线程执行完毕才能继续执行的情况。

又比如车间组装产品，你必须要等到其他同事把配件组装好全交给你，你才可以最终组装。

```java
public class CountDownLatchTest {
	// 显示传入计数器值
    private static final CountDownLatch LATCH = new CountDownLatch(2);
    public static void main(String[] args) {
        new Thread(() -> {
            try {
                Thread.sleep(2000L);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            // 子线程执行完毕就需要显式调用该方法
            LATCH.countDown();
        }).start();
        new Thread(() -> {
            try {
                Thread.sleep(2000L);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            LATCH.countDown();
        }).start();
        System.out.println("等待子线程结束任务 ...");
        try {
            // 主线程阻塞直到计数器=0
            LATCH.await();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("主线程被唤醒继续执行 ...");
    }
}
```

> 1. CountDownLatch维护一个计数器值，由使用者传入`一个大于0的数值N`来指定。
> 2. 执行await()方法的线程A会阻塞，直到`N = 0`，线程A继续执行。
> 3. 执行子任务的线程B，执行完毕需要显示的`调用countDown()方法`。


```java
public CountDownLatch(int count) {
    // 需要传入一个大于0的值
    if (count < 0) throw new IllegalArgumentException("count < 0");
    // 本质就是定义state的值
    this.sync = new Sync(count);
}

Sync(int count) {
    setState(count);
}
```

> CountDownLatch的构造函数，需要传入一个`大于0的值N`表明执行`countDown`线程数量。
>
> 如果`N = 0`表明条件符合，表明子线程已经全部执行完毕，主线程可以继续执行。

---

### await

```java
public final void acquireSharedInterruptibly(int arg) throws InterruptedException {
    // 响应线程中断，抛出终端异常
    if (Thread.interrupted())
        throw new InterruptedException();
    // 根据tryAcquireShared返回值决定是否将当前线程加入队列。
    if (tryAcquireShared(arg) < 0)
        // 共享锁逻辑
        doAcquireSharedInterruptibly(arg);
}
// 判断是否需要将线程加入队列
protected int tryAcquireShared(int acquires) {
    return (getState() == 0) ? 1 : -1;
}
```

> 1. await方法是响应中断的。
> 2. 判断`共享变量state 是否等于 0`，等于说明子线程执行完毕，否则加入同步队列。
> 3. 如果主线程加入了同步队列，进入`共享锁的自旋（获取锁 -> 阻塞）的流程`，因为只有`state = 0`时`tryAcquireShared > 0`，所以只要子线程没有全部执行完毕，那么主线程就无法获取锁，那么主线程就会阻塞在`parkAndCheckInterrupt`中（共享锁逻辑，将来也会在此处被唤醒）。

---

### countDown

```java
// countDown方法不支持传参，每次只能减1
public void countDown() {
    sync.releaseShared(1);
}
public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) {
        // 共享锁逻辑，唤醒后继等待的线程（唤醒主线程）
        doReleaseShared();
        return true;
    }
    return false;
}
// 只有当前方法返回true的时候才会执行doReleaseShared()
protected boolean tryReleaseShared(int releases) {
   // 自旋CAS修改state
    for (;;) {
        int c = getState();
        // 如果state已经是0直接返回，不然state为负数了
        if (c == 0)
            return false;
        int nextc = c-1;
        if (compareAndSetState(c, nextc))
            // 只有CAS修改stsate成功且state=0时才会返回true
            return nextc == 0;
    }
}
```

> countDown方法的本质就是将state变量减1，直到`state = 0`才会执行`doReleaseShared`唤醒阻塞在`await`处的线程。

---

### await(time)

```java
// 传入时间及时间单位
public boolean await(long timeout, TimeUnit unit)
    throws InterruptedException {
    return sync.tryAcquireSharedNanos(1, unit.toNanos(timeout));
}
// 响应中断
public final boolean tryAcquireSharedNanos(int arg, long nanosTimeout)
            	throws InterruptedException {
    // 线程被中断抛出中断异常
    if (Thread.interrupted())
        throw new InterruptedException();
    return tryAcquireShared(arg) >= 0 ||
        doAcquireSharedNanos(arg, nanosTimeout);
}
protected int tryAcquireShared(int acquires) {
    return (getState() == 0) ? 1 : -1;
}
```

>  await(long timeout, TimeUnit unit)：`方法返回boolean值，主线程阻塞指定时常后被唤醒，查看state = 0是否成立，成立返回true主线程继续执行，否则执行失败。`

### 总结

- 使用场景：当`某个量化为数字的条件被满足后`，调用await的线程才可以继续开始执行

- CountDownLatch的构造函数需要`显式的传入计数器的值`。
- 调用`await`的线程能继续执行的条件就是`state = 0（也是获取共享锁的条件）`，否则继续阻塞。
- 调用`countDown`方法才能修改state的值，且每次调用只能将`state - 1`。

---