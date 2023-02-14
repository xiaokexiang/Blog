---
title: "ThreadPool线程池源码解析"
date: 2020-07-17T17:01:26+08:00
description: "`ThreadPool`可以避免单个线程创建带来的系统资源的消耗，并且能够实现线程的复用，有效节省系统资源。"
tags: ["ThreadPool "]
categories: [
  "Concurrent",
  "ThreadPool"
]
hideReadMore: true
slug: concurrent_thread_pool
---

### ThreadPool

#### 为什么使用线程池

我们知道频繁的`单独创建线程`是很消耗系统资源的，而线程池中线程是可以`线程复用`的，不需要每次执行都重新创建，并且线程池可以提供`控制线程个数`等资源限制和管理的手段。

#### 实现原理

所谓线程池实现原理：`调用方不断向线程池中添加任务，线程池中有一组线程，不断的从队列中取任务`。典型的`生产者和消费者模型`。基于这样的原理，我们实现线程池需要使用到`阻塞队列`，避免无任务时轮询带来的资源消耗。

#### 线程池类继承体系

![](https://image.leejay.top/image/20200714/4QO7osHQeOu6.png?imageslim)

> `ThreadPoolExecutor`和`ScheduledExecutorService`是需要关注的两个核心类，前者是`线程池的具体实现`，后者除了能实现线程池的基本功能，还可以提供`周期性执行任务`功能。
>
> 任何需要线程池执行的任务，都必须`直接或间接的实现Runnable接口`。

---

### ThreadPoolExecutor

#### 构造

```java
// 阻塞队列，具体实现由构造函数决定
private final BlockingQueue<Runnable> workQueue;
private volatile int corePoolSize;
private volatile int maximumPoolSize;
private volatile long keepAliveTime;
// 线程工厂，用于定义创建线程的方式，主要是定义线程name等相关参数
private volatile ThreadFactory threadFactory;
// 拒绝策略有4种内置的策略
private volatile RejectedExecutionHandler handler;
// 参数最多的构造函数
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler) {
    if (corePoolSize < 0 ||
        maximumPoolSize <= 0 ||
        maximumPoolSize < corePoolSize ||
        keepAliveTime < 0)
        throw new IllegalArgumentException();
    if (workQueue == null || threadFactory == null || handler == null)
        throw new NullPointerException();
    this.acc = System.getSecurityManager() == null ?
        null :
    AccessController.getContext();
    this.corePoolSize = corePoolSize;
    this.maximumPoolSize = maximumPoolSize;
    this.workQueue = workQueue;
    this.keepAliveTime = unit.toNanos(keepAliveTime);
    this.threadFactory = threadFactory;
    this.handler = handler;
}
```
> `corePoolSize`：线程池中始终维护的线程个数，不受超时影响的核心线程。
>
> `maxPoolSize`：`在corePoolSize已满，且队列已满会扩充线程至此值`，在此之前只有核心线程执行任务。
>
> `workQueue`：阻塞队列，任务会被添加到队列中，具体实现由使用者决定。
>
> `keepAliveTime`：`maxPoolSize`中的空闲线程销毁需要的时间，销毁后线程数降至`corePoolSize`。
>
> `threadFactory`：线程工厂，用于生产线程，主要用来定义线程名字等相关参数。
>
> `handler`：当`corePoolSize`、`maxPoolSize`和`workQueue`都满时的执行的拒绝策略。

#### Worker

```java
//Worker组成的HashSet
private final HashSet<Worker> workers = new HashSet<Worker>();
private final class Worker extends AbstractQueuedSynchronizer 
    						implements Runnable {
    
    // Worker维护的线程就是用来执行任务的线程，每个Worker对应一个
    final Thread thread;
	// Worker对象的初始任务，因为线程复用就会存在一个woker执行多个任务的情况
    Runnable firstTask;
	// 记录当前worker完成的任务次数，volatile修饰
    volatile long completedTasks;

    // 构造函数，需要传入初始任务
    Worker(Runnable firstTask) {
        // 初始状态设为-1，启动时会被清除，这里很重要！目的是防止被中断
        setState(-1);
        this.firstTask = firstTask;
        // 调用工厂类创建线程，任务是当前的woker对象
        this.thread = getThreadFactory().newThread(this);
    }
    // worker被调用时会执行run方法
    public void run() 
        // 运行当前worker
        runWorker(this);
    }
}
```

> Worker类主要用于维护`执行任务线程的中断控制状态`。
>
> 1. Worker`实现了Runnable接口中的run方法`，初始化时将`worker作为Runnable任务`传入创建了线程。
> 2. Worker继承`AbstractQueueSynchronizer`抽象类，用于`简化获取和释放围绕每个Worker执行的锁`，为了通过中断唤醒`空闲中的线程`而`非正在运行中的任务`(后面的代码会解释)，同时实现了自己的获取锁和释放锁的逻辑，是为了`避免锁的重入`。
> 3. Worker初始化`设置state为-1`，直到真正启动时才会清除，是为了`防止该worker还没执行就被打断`。

#### ctl变量

```java
// 状态变量由 线程池运行状态(高3位)和线程池内有效线程数量(低29位)组成
// 初始值：1110 0000 0000 0000 0000 0000 0000 0000
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
// COUNT_BITS = 29 用于移位
private static final int COUNT_BITS = Integer.SIZE - 3;
// 线程数量最多 CAPACITY = 2^29-1 (0001 1111 1111 1111 1111 1111 1111 1111 )
private static final int CAPACITY   = (1 << COUNT_BITS) - 1;
// 1111 1111 1111 1111 1111 1111 1111 1111 ->
// 1110 0000 0000 0000 0000 0000 0000 0000
private static final int RUNNING    = -1 << COUNT_BITS;
// 0000 0000 0000 0000 0000 0000 0000 0000 ->
// 0000 0000 0000 0000 0000 0000 0000 0000
private static final int SHUTDOWN   =  0 << COUNT_BITS;
// 0000 0000 0000 0000 0000 0000 0000 0001 ->
// 0010 0000 0000 0000 0000 0000 0000 0000
private static final int STOP       =  1 << COUNT_BITS;
// 0000 0000 0000 0000 0000 0000 0000 0010 ->
// 0100 0000 0000 0000 0000 0000 0000 0000
private static final int TIDYING    =  2 << COUNT_BITS;
// 0000 0000 0000 0000 0000 0000 0000 0011 -> 
// 0110 0000 0000 0000 0000 0000 0000 0000
private static final int TERMINATED =  3 << COUNT_BITS;
// ~CAPACITY = 1110 0000 0000 0000 0000 0000 0000 0000
// c & !CAPACITY 只会得到高3位的bit值
private static int runStateOf(int c)     { return c & ~CAPACITY; }
// 获取低29位的bit值
private static int workerCountOf(int c)  { return c & CAPACITY; }
// 将高3位和低29位组装成ctl值
private static int ctlOf(int rs, int wc) { return rs | wc; }

private static boolean runStateLessThan(int c, int s) {
    return c < s;
}
private static boolean runStateAtLeast(int c, int s) {
    return c >= s;
}
private static boolean isRunning(int c) {
    return c < SHUTDOWN;
}
// CAS减ctl值加1
private boolean compareAndIncrementWorkerCount(int expect) {
    return ctl.compareAndSet(expect, expect + 1);
}
// CAS将ctl的值减1
private boolean compareAndDecrementWorkerCount(int expect) {
    return ctl.compareAndSet(expect, expect - 1);
}

// 循环执行CAS直到减ctl减1成功
private void decrementWorkerCount() {
    do {} while (! compareAndDecrementWorkerCount(ctl.get()));
}
```

> ctl状态变量由`线程池运行状态(高3位)`和`线程池内有效线程数量(低29位)`构成。
>
> 线程池的状态只会`从小到大迁移(-1->0->1->2->3)`，不会逆向迁移。
>
> `RUNNING`：`能够接收新的任务`，及`执行在队列中的任务`。
>
> `SHUTDOWN`：不能接收新任务，但还是会`执行在队列中的任务`。
>
> `STOP`：不能接收新任务，也不会执行在队列中的任务，最后中断正在执行的任务。
>
> `TIDYING`：所有任务都终止，worker数量变为0，转换为此状态会执行`terminated()`钩子函数。
>
> `TERMINATED`：`terminated()`执行完毕，至此线程池才真正关闭。
>
> ![线程迁移状态](https://image.leejay.top/image/20200714/C5qLgqKHxr5W.png?imageslim)
---

### 线程池的关闭

我们先从`shutDown`和`shutDownNow`两个方法入手，先了解线程池如何关闭的。

#### shutDown

```java
public void shutdown() {
    final ReentrantLock mainLock = this.mainLock;
    // 获取独占锁
    mainLock.lock();
    try {
        // 校验是否由关闭线程池的权限
        checkShutdownAccess();
        // 将ctl修改为SHUTDOWN态
        advanceRunState(SHUTDOWN);
        interruptIdleWorkers();
        // 钩子函数
        // ScheduledThreadPoolExecutor用于清除delay任务
        onShutdown();
    } finally {
        mainLock.unlock();
    }
    // 修改线程池状态(TIDYING TERMINATED状态的处理)
    tryTerminate();
}
// 将ctl状态转换为目标状态或已经变成目标状态时保持不变
// targetState 可以是 SHUTDOWN或STOP
private void advanceRunState(int targetState) {
    for (;;) {
        // 获取ctl状态
        int c = ctl.get();
        // 1. 如果runStateAtLeast成立，说明 c >= targetState
        // 说明状态已经比target还大，那么不需要再修改了，保持不变
        // 2. step1不成立则CAS修改ctl状态直到将状态修改为targetState
        if (runStateAtLeast(c, targetState) ||
            ctl.compareAndSet(c, ctlOf(targetState, workerCountOf(c))))
            break;
    }
}
private void interruptIdleWorkers() {
    interruptIdleWorkers(false);
}
// 中断可能正在等待任务的线程(某些线程可能不会被中断)
// onlyOne = true 至少中断一个worker线程
private void interruptIdleWorkers(boolean onlyOne) {
    final ReentrantLock mainLock = this.mainLock;
    // 获取独占锁(独占锁重入了)
    mainLock.lock();
    try {
        // 遍历每个worker
        for (Worker w : workers) {
            // 获取worker的属性thread
            Thread t = w.thread;
            // 1. 如果当前线程没有被中断，那么执行step2
            // 2. 尝试获取当前worker线程的独占锁(worker本身就是锁，且只会有一个线程
            // 竞争该锁) 如果获取失败说明当前线程正在执行任务，它不是空闲的
            // 只有1和2都成立才会中断当前线程。
            if (!t.isInterrupted() && w.tryLock()) {
                try {
                    // 中断当前线程
                    t.interrupt();
                } catch (SecurityException ignore) {
                } finally {
                    // 释放worker锁
                    w.unlock();
                }
            }
            // 如果为true说明只需要中断一个，break
            if (onlyOne)
                break;
        }
    } finally {
        mainLock.unlock();
    }
}
```

> `shutDown`不会接受新的任务，但会执行先前提交的任务。如果已shutDown，再次执行不会有影响。
>
> 执行流程：
>
> 1. 获取独占锁，保证关闭操作和其他操作互斥。
> 2. 校验是否有关闭线程池权限。
> 3. 自旋修改ctl为`SHUTDOWN`态，如果此时`ctl > SHUTDOWN`，则不做修改。
> 4. 中断`所有未被中断且空闲的worker`线程。
> 5. 释放独占锁，并执行`tryTerminate`方法，处理线程池状态转换、执行`terminate`和唤醒等操作。

#### tryTerminate

```java
final void tryTerminate() {
    // 自旋执行
    for (;;) {
        // 获取ctl
        int c = ctl.get();
        // ①正在RUNNING ② 线程池状态大于等于TIDYING 
        // ③ 当前状态为shutDown且队列不为空
        // 三者一个成立就返回，不继续执行
        if (isRunning(c) ||
            runStateAtLeast(c, TIDYING) ||
            (runStateOf(c) == SHUTDOWN && ! workQueue.isEmpty()))
            return;
        // 如果当前worker线程数量不为0
        if (workerCountOf(c) != 0) {
            // 中断一个空闲worker线程并返回
            interruptIdleWorkers(ONLY_ONE);
            return;
        }
		// 获取独占锁
        final ReentrantLock mainLock = this.mainLock;
        mainLock.lock();
        try {
            // 只有此处才会修改状态为TIDYING!!!
            // CAS将ctl修改为TIDYING|0
            if (ctl.compareAndSet(c, ctlOf(TIDYING, 0))) {
                try {
                    // 至此说明状态为TIDYING,workerCount = 0
                    // 调用terminated钩子函数
                    terminated();
                } finally {
                    // 只有此处才会修改状态为TERMINATED!!!
                    // 将状态设为TERMINATED|0
                    ctl.set(ctlOf(TERMINATED, 0));
                    // 唤醒awaitTermination方法中等待的线程
                    termination.signalAll();
                }
                return;
            }
        } finally {
            mainLock.unlock();
        }
    }
}
```

> 1. 如果`为SHUTDOWN态、线程池和队列为空`或`为STOP态且线程池为空`则转换为`TIDYING、TERMINATED`。
> 2. 如果是`SHUTDOWN或STOP态`但`workCount!=0`，那么会中断空闲的线程，保证关机的信号传播。
> 3. `tryTerminate`方法并不会强制关机，它只是在正确的时间将线程池状态改为`TIDYING`后执行`terminated`钩子函数，最后再唤醒执行了`awaitTermination`的线程。
> 4. 只有`tryTerminate`方法才会将`ctl`修改为`TIDYING`或`TERMINATED`，且`自旋+CAS`直到成功。
> 5. 我们需在`任何可能终止的操作之后`，调用`tryTerminate`方法。比如`减少worker线程数量`或`在shutdown期间从队列中删除任务`。

#### await

```java
// 阻塞直到三个条件满足其一：1. 所有任务在shutdown后完成 2. 超时 3.当前线程被中断
public boolean awaitTermination(long timeout, TimeUnit unit)
    								throws InterruptedException {
    long nanos = unit.toNanos(timeout);
    // 获取独占锁
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        // 循环执行
        for (;;) {
            // 如果成立说明线程池状态时TERMINATED
            if (runStateAtLeast(ctl.get(), TERMINATED))
                return true;
            // 超时了那么退出
            if (nanos <= 0)
                return false;
            // 否则调用condition.awaitNanos等待指定时长
            nanos = termination.awaitNanos(nanos);
        }
    } finally {
        mainLock.unlock();
    }
}
```

> `awaitTermination`会阻塞直到以下三个条件满足其一：
>
> 1. 在调用`shutDown或shutDownNow`后，所有任务都已完成。
> 2. 指定时间超时了。
> 3. 当前线程被中断了。
>
> 在`tryTerminate`方法中确实存在`唤醒因执行awaitTermination方法等待的线程`的代码。

#### shutDownNow

```java
// 该方法会尝试中断所有正在执行的任务，返回正在等待执行的任务列表
public List<Runnable> shutdownNow() {
    List<Runnable> tasks;
    final ReentrantLock mainLock = this.mainLock;
    // 获取独占锁
    mainLock.lock();
    try {
        // 校验是否有关闭线程池的权限
        checkShutdownAccess();
        // 自旋执行CAS修改ctl为STOP
        // 如果shutDown方法释放锁后，执行tryTerminate前，线程执行了shutDownNow
        // 那么会发生SHUTDOWN -> STOP状态的转换
        advanceRunState(STOP);
        // 中断正在执行的线程和正在等待的线程
        interruptWorkers();
        // 返回正在等待的worker线程
        tasks = drainQueue();
    } finally {
        mainLock.unlock();
    }
    tryTerminate();
    return tasks;
}
// 中断全部worker
private void interruptWorkers() {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        // 这里并没有使用tryLock进行线程空闲判断
        for (Worker w : workers)
            w.interruptIfStarted();
    } finally {
        mainLock.unlock();
    }
}
// 注意方法名，已经开始的才能中断
void interruptIfStarted() {
    Thread t;
    // 我们初始化worker对象的时候把state设为了-1，这里的getState>=0是保证刚创建的
    // worker对象不能被打断
    // thread != null只是正常的判空校验
    // 如果线程没被中断那么中断当前线程
    if (getState() >= 0 && (t = thread) != null && !t.isInterrupted()) {
        try {
            t.interrupt();
        } catch (SecurityException ignore) {
        }
    }
}
// 将阻塞队列中的任务转成list返回，如果是延时队列或其他导致不能通过drainTo转移的任务，
// 循环删除并添加到list中
private List<Runnable> drainQueue() {
    // 获取构造函数指定的阻塞队列
    BlockingQueue<Runnable> q = workQueue;
    // 创建用于返回的list
    ArrayList<Runnable> taskList = new ArrayList<Runnable>();
    // 将阻塞队列中的Runnable转移到list，并删除旧的元素
    q.drainTo(taskList);
    if (!q.isEmpty()) {
        // 这里设置了数组大小为1(数组大小确定不会变化)
        // 通过循环每次都获取q中的一个任务，直到成功移除它，添加到队list，再执行下一任务
        for (Runnable r : q.toArray(new Runnable[0])) {
            if (q.remove(r))
                taskList.add(r);
        }
    }
    return taskList;
}
```

> `shutDownNow`会`中断正在执行及正在等待的worker线程`。并会`返回阻塞队列中的全部任务并删除`。
>
> `shutDownNow`执行流程：
>
> 1. 获取独占锁，保证关闭操作和其他操作互斥。
> 2. 校验是否有关闭线程池权限。
> 3. 自旋修改ctl为`STOP`态，如果此时`ctl > STOP`，则不做修改。如果此时`ctl = SHUTDOWN`，那么会将`SHUTDOWN`改为`STOP`，也就是10-12行代码注释所释。
> 4. 中断`所有正在执行的线程及正在等待的线程(刚创建的state=-1worker线程不会被中断)`，并`在返回阻塞队列中的全部任务并清空队列`。
> 5. 释放独占锁，并执行`tryTerminate`方法，处理线程池状态转换、执行`terminate`和唤醒等操作。

#### 正确的关闭线程池

```java
@Slf4j
public class ThreadPoolExecutorTest {
    private static final ExecutorService POOL = ThreadPoolSingleton.getInstance();

    public static void main(String[] args) {
        POOL.execute(() -> {
            log.info("prepare to sleep ...");
            try {
                Thread.sleep(5000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        });
        POOL.shutdown();// 也可以使用shutDownNow()
        log.info("调用shutDown方法 ... ");
        
        try {
            boolean loop;
            do {
                loop = !POOL.awaitTermination(3, TimeUnit.SECONDS);
            } while (loop);
            log.info("Thread Pool 真正关闭拉 ...");
        } catch (InterruptedException e) {
            log.error(e.getMessage());
        }
    }
}
// 线程池的单例类
public class ThreadPoolSingleton implements Serializable {

    private ThreadPoolSingleton() {
        throw new RuntimeException("Can not exec constructor");
    }

    public static ThreadPoolExecutor getInstance() {
        return Holder.THREAD_POOL_EXECUTOR;
    }

    private static class Holder {
        private static final ThreadPoolExecutor THREAD_POOL_EXECUTOR =
            new ThreadPoolExecutor(
                2,
                32,
                60,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(10),
                new CustomizableThreadFactory("Thread-Pool-"),
                new ThreadPoolExecutor.CallerRunsPolicy());
    }

    public Object readResolve() {
        return getInstance();
    }
}
```

#### 总结

- `shutDown`和`shutDownNow`都会去`修改ctl状态`，并`中断线程`，最后调用`tryTerminate`方法。

- shutDown和shutDownNow区别

  |             | 中断线程类型               | 阻塞队列                             |
  | ----------- | -------------------------- | ------------------------------------ |
  | shutDown    | 中断空闲线程               | 不清空阻塞队列，等待任务全部执行完成 |
  | shutDownNow | 中断空闲线程和正在执行线程 | 清空阻塞队列，并返回阻塞队列中的任务 |

- `tryTerminate`只是处理`TIDYING`和`TERMINATED`状态、执行钩子函数及唤醒等待线程，`不会强制关机`。

- 线程池关闭的流程状态图

  ![](https://image.leejay.top/image/20200714/C5qLgqKHxr5W.png?imageslim)

---

### 线程池添加任务

#### execute

```java
// 提交任务给线程池，没有获取独占锁的操作
public void execute(Runnable command) {
    // command不能为空
    if (command == null)
        throw new NullPointerException();
    // 获取ctl变量，默认是 RUNNING|0 即 1110 0000 0000 0000 0000 0000 0000 0000
    int c = ctl.get();
    // 判断worker数量是否小于corePoolSize
    if (workerCountOf(c) < corePoolSize) {
        // 添加worker线程并把任务交给worker，true表示往核心池中添加
        if (addWorker(command, true))
            // 添加成功返回
            return;
        // 添加失败获取ctl变量
        // 此处失败原因：corePoolSize已经满了或线程池终止了
        c = ctl.get();
    }
    // 所以判断是否还在RUNNING状态，如果是就往阻塞队列添加任务，如果队列满会返回false
    if (isRunning(c) && workQueue.offer(command)) {
        // 任务添加到队列成功，继续判断状态
        int recheck = ctl.get();
        // 因为execute不是获取锁执行，所以如果刚添加完线程成功，另一个线程调用shutDown
        // 方法修改为SHUTDOWN态， 所以需要继续判断，如果此时不是RUNNING，
        // 那么调用remove移除当前任务，如果移除成功，那么调用拒绝策略。
        // 如果调用失败，有可能这个任务刚被执行了，就会删除失败
        if (! isRunning(recheck) && remove(command))
            reject(command);
        // 执行到此存在两种情况: 1. 此时还是RUNNING态 2. 不是RUNNING态，移除任务失败
        // 针对1此时存在任务，但workercount = 0，所以需要创建线程来执行这个任务
        // 针对2，如果任务刚被拿走，那么worker线程数不会为0。
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    // 至此说明corePoolSize满了，队列也满了，那么添加线程直到maxPoolSize
    else if (!addWorker(command, false))
        // 如果还添加失败，说明已经达到maxPoolSize了。调用拒绝策略
        reject(command);
}
// 移除任务，如果任务已被执行那么就返回false
public boolean remove(Runnable task) {
    // 从队列中移除任务
    boolean removed = workQueue.remove(task);
    // 之前分析tryTerminate时说过：任何可能终止操作后调用tryTerminate
    tryTerminate();
    return removed;
}

// 调用拒绝策略具体的实现类
final void reject(Runnable command) {
    handler.rejectedExecution(command, this);
}
```

> 执行流程：
>
> 1. 判断`workerCount < corePoolSize`是否成立，成立调用`addWorker`并返回，不成立执行step2。
> 2. 如果处于`RUNNING态 && 任务加入阻塞队列`，不成功调用step3。若成功，因为execute方法没有加锁执行，所以需要`double-check`状态，如果`不处于RUNNING态则尝试移除刚添加的任务`，若`处于RUNNING态或移除失败`，判断当前`workerCount == 0`，成立则调用`addWorker`添加线程执行刚加入的任务。
> 3. 执行至此，说明：要么`线程池不处于RUNNING态`，调用`addWorker`添加线程也会返回false，执行`reject`拒绝策略。要么`corePoolSize和阻塞队列已满`，那么调用`addWorker`当线程数达到`maxPoolSize`时也会返回false，执行`reject`拒绝策略。

#### addWorker

```java
// 核心方法
private boolean addWorker(Runnable firstTask, boolean core) {
    retry:
    // ① 第一个自旋: 根据状态的不同，判断是否需要增加workerCount
    for (;;) {
        // 获取ctl变量
        int c = ctl.get();
        // 获取运行状态
        int rs = runStateOf(c);
		// 如果 rs != SHUTDOWN 就不需要再处理了
        // rs = SHUTDOWN时，不接受新的任务(task != null)，处理队列中的任务
        // rs = SHUTDOWN时，无任务时，队列不为空就帮助执行队列中任务
        if (rs >= SHUTDOWN &&
            ! (rs == SHUTDOWN &&
               firstTask == null &&
               ! workQueue.isEmpty()))
            return false;
		// ② 第二个自旋：主要处理workerCount是否超过阈值及自增
        for (;;) {
            // 获取worker线程数量
            int wc = workerCountOf(c);
            // 如果wc超过阈值，直接返回false
            // core: true就和corePoolSzie比，false就和maxPoolSize比
            if (wc >= CAPACITY ||
                wc >= (core ? corePoolSize : maximumPoolSize))
                return false;
            // 尝试CAS将ctl + 1	
            if (compareAndIncrementWorkerCount(c))
                // 成功才能跳出循环
                break retry;
            // 再次获取ctl判断rs状态是否被修改
            c = ctl.get();
            // 在执行addWorker的期间，另一个线程尝试修改了运行状态
            if (runStateOf(c) != rs)
                // 被修改就继续外层循环
                continue retry;
        }
    }
    // 第三部分 ③
	// 表示任务是否开启
    boolean workerStarted = false;
    // 表示任务是否添加
    boolean workerAdded = false;
    Worker w = null;
    try {
        // 创建worker对象，赋予任务，并通过线程工厂创建处理该任务的线程
        // 注意此处的task 可能等于 null
        w = new Worker(firstTask);
        // 获取执行任务的线程，如果因为线程工厂创建线程返回null或线程启动导致的OOM
        // 都会导致此处的t=null，那么在finally中会回滚
        final Thread t = w.thread;
        if (t != null) {
            final ReentrantLock mainLock = this.mainLock;
            // 获取独占锁
            mainLock.lock();
            try {
                // 获取锁后还要判断状态，因为可能在获取锁等待的时候状态被修改
                int rs = runStateOf(ctl.get());
				// rs = RUNNING 或 （rs = SHUTDOWN 且 task = null）
                // 状态为SHUTDOWN，但任务为null也添加到池中，因为此时的阻塞队列
                // 肯定不为空，用于协助处理任务，让线程池早点关机
                if (rs < SHUTDOWN ||
                    (rs == SHUTDOWN && firstTask == null)) {
                    // 判断线程是否start或还没有dead
                    if (t.isAlive())
                        throw new IllegalThreadStateException();
                    // 添加到HashSet<Worker>中
                    workers.add(w);
                    // 获取队列大小
                    int s = workers.size();
                    // 只有这个地方会修改largePoolSize
                    // 这里的判断说明存在另一处会移除worker，所以要保证
                    // 只有队列大小大于当前largePoolSize再更新该成员变量
                    if (s > largestPoolSize)
                        largestPoolSize = s;
                    // 修改变量
                    workerAdded = true;
                }
            } finally {
                // 释放独占锁
                mainLock.unlock();
            }
            // 只有添加到worker队列中才会启动任务
            if (workerAdded) {
                // 执行Worker类中的run方法，下一章分析
                t.start();
                // 修改变量
                workerStarted = true;
            }
        }
    } finally {
        // 第四部分④
        // workerStarted = false，那么workerAdded肯定是false
        // 说明 t=null | t!=null但(rs > shutdown or(rs=shutdown但task!=null)）
        if (! workerStarted)
            // 任务回滚
            addWorkerFailed(w);
    }
    return workerStarted;
}
// 没有成功添加任务，那么需要回滚
private void addWorkerFailed(Worker w) {
    final ReentrantLock mainLock = this.mainLock;
    // 获取独占锁
    mainLock.lock();
    try {
        // 移除worker
        if (w != null)
            workers.remove(w);
        // 将workerCount-1
        decrementWorkerCount();
        // 调用tryTerminate，因为可能线程池被shutdown了
        tryTerminate();
    } finally {
        mainLock.unlock();
    }
}
```

> 执行流程分为四个部分进行分析：
>
> 1. 第一部分对线程池的状态进行判断，`继续执行第二部分`需要符合以下两个条件中一个即可：
>
>    ① 线程池状态为`RUNNING`。
>
>    ② 线程池状态为`SHUTDOWN`时，`firstTask == null`且`阻塞队列不为空`。(辅助理解：当线程池状态为`SHUTDOWN`时`不接受新的任务`，但是`已存在阻塞队列中的任务当前线程可以协助执行`。)
>
> 2. 第二部分判断`workerCount是否超过阈值`，如果没有则`CAS修改workerCount`，如果`workerCount CAS`修改期间状态变化，则回到第一部分继续执行。
>
> 3. 第三部分创建`worker对象`，并`加入线程池中`，之后`开启线程执行任务`。如下情况执行第四部分：
>
>    ① 当前worker对象`通过线程工厂创建的线程返回null`。
>
>    ② 获取独占锁过程中状态变化了：`rs != RUNNING` 且 `rs = SHUTDOWN 时 firstTask != null`。
>
> 4. 第四部分执行回滚操作：`移除worker`、`CAS将workerCount减1`和`调用tryTerminate`。
>
> addWorker方法主要是`添加worker线程到线程池中，并启动线程执行任务`，worker线程分为两类：
>
> 1. `有firstTask任务`的线程。
>
> 2. `没有firstTask任务`的协助线程：
>
>       ① 线程池`处于SHUTDOWN期间，协助快速处理阻塞队列任务`的线程。
>
>       ② 线程池中`没有固定线程(即corePoolSize=0)`，但此时有任务需要执行的情况。
---

### 线程池执行任务

#### runWorker

```java
// 因为worker对象本身就是实现了Runnable接口，所以线程启动时调用run方法
public void run() {
    runWorker(this);
}
// Worker unlock的核心方法
protected boolean tryRelease(int unused) {
    // 不会判断是你是否是持有独占锁的线程
    setExclusiveOwnerThread(null);
    setState(0);
    return true;
}

final void runWorker(Worker w) {
    // 获取当前线程，即执行该任务的线程
    Thread wt = Thread.currentThread();
    // 获取任务
    Runnable task = w.firstTask;
    // 将firstTask属性设为null
    w.firstTask = null;
    // unlock会将state设为0，为什么这里这样？
    // 因为初始化worker对象的时候会将state设为-1，防止线程池的中断方法中断刚创建的worker
    // 除此之外还为了下面的w.lock，能够正常的获取独占锁，也方便了shutDown方法中
    // 判断线程是否空闲的tryLock的正确执行
    w.unlock();
    boolean completedAbruptly = true;
    try {
        // 如果task != null说明当前线程有任务的
        // 如果task = null说明是协助线程，需要去阻塞队列拿任务
        while (task != null || (task = getTask()) != null) {
            // 至此肯定拿到了任务
            // 为什么此处要获取锁，worker独占锁只会被当前一个线程持有啊？
            // 1. shutDown方法中调用的中断方法会通过tryLock判断线程是否空闲
            // 2. 避免worker线程被中断，worker实现了独占锁大部分功能，不及时响应中断
            w.lock();
            // 如果线程池正在终止，那么中断当前线程，如果不是，那么不让线程被中断
            if ((runStateAtLeast(ctl.get(), STOP) ||
                 (Thread.interrupted() &&
                  runStateAtLeast(ctl.get(), STOP))) &&
                !wt.isInterrupted())
                wt.interrupt();
            try {
                // 钩子函数，用于自定义任务执行前调用
                beforeExecute(wt, task);
                Throwable thrown = null;
                try {
                    // 这里用户传入的任务才真正被执行
                    task.run();
                } catch (RuntimeException x) {
                    thrown = x; throw x;
                } catch (Error x) {
                    thrown = x; throw x;
                } catch (Throwable x) {
                    thrown = x; throw new Error(x);
                } finally {
                    // 钩子函数，任务执行后调用
                    afterExecute(task, thrown);
                }
            } finally {
                // 清空task
                task = null;
                // 将completeTask + 1
                w.completedTasks++;
                w.unlock();
            }
        }
        // 修改completedAbruptly参数。如果为true说明是异常结束的
        completedAbruptly = false;
    } finally {
        // 处理worker的退出
        processWorkerExit(w, completedAbruptly);
    }
}
```

> 1. `runWorker`方法会判断`firstTask != null`是否成立，如果不成立再去`阻塞队列中获取任务`。
> 2. `w.lock()`后的第一处判断，主要目的：`如果线程池正在中断，那么中断当前线程。如果不是，那么不让当前线程被中断`（`w.lock`后`state=1`，所以是能被`shutDownNow`中的中断方法中断的）。
> 3. 调用`beforeExecute`钩子函数，此时才真正的执行用户传入的任务。
> 4. 执行`afterExecute`钩子函数，清空task，将`workrer.completedTasks+1`
> 5. 如果`getTask返回null`或`执行任务发生异常`，最终调用`processWorkerExit`方法。

#### getTask

```java
// 从阻塞队列中获取任务
private Runnable getTask() {
    // 用于判断上次poll是否超时
    boolean timedOut = false;
	// 自旋执行
    for (;;) {
        // 获取ctl状态
        int c = ctl.get();
        // 获取运行状态
        int rs = runStateOf(c);
        // 如果线程池正在shutdown 或 队列已空，那么将workerCount-1并返回null
        if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
            decrementWorkerCount();
            return null;
        }
		// 获取workerCount
        int wc = workerCountOf(c);
        // allowCoreThreadTimeOut表示核心数量的线程不允许超时，默认false
        // wc > corePoolSize时返回true
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;
		// 因为setMaximumPoolSize，所以wc > max会出现
        // 1. 如果wc超过max 或 (wc大于corePoolSize且上次poll超时了)
        if ((wc > maximumPoolSize || (timed && timedOut))
            // 如果wc>1或队列为空，一直减少wc直到1
            && (wc > 1 || workQueue.isEmpty())) {
            if (compareAndDecrementWorkerCount(c))
                return null;
            continue;
        }

        try {
            // 如果是true调用poll阻塞，否则调用take阻塞获取
            Runnable r = timed ?
                workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
            workQueue.take();
            // 不为null返回
            if (r != null)
                return r;
            // 为null设置timeOut继续循环，也就是worker一直在获取任务
            timedOut = true;
        } catch (InterruptedException retry) {
            // 如果getTask过程中被中断了，继续循环
            timedOut = false;
        }
    }
}
```

> 1. 第一个判断：如果线程池状态变成`SHUTDOWN或队列已空`，那么将`workerCount减1并返回null`。
> 2. `allowCoreThreadTimeOut`参数表明`corePoolSize指定数量的核心线程能否超时，默认为false`。
> 3. 第二个判断：如果 ①`wc超过maxPoolSize`或`(wc > corePoolSize 且 上次poll超时)`，那么继续判断。 ②`wc > 1或 阻塞队列为空`，若两者都成立，那么会将wc减1，多次循环后可能`wc=1`。
> 4. 根据`wc > corePoolSize`返回`true/false`来决定调用的是`poll(time)/take()`，前者阻塞`keepAliveTime`，后者`一直阻塞直到获取了任务`。最终一定会有`小于等于corePoolSize数量的线程`一直在take处阻塞等待任务。
> 5. 如果`获取的任务!=null`则返回，否则设置`timeOut=true`。发生异常则设置`timeOut=false`。

#### processWorkerExit

```java
// completedAbruptly =true表明runWorker是异常退出的
private void processWorkerExit(Worker w, boolean completedAbruptly) {
    // 如果异常退出，那么将workerCount减1
    if (completedAbruptly)
        decrementWorkerCount();
    final ReentrantLock mainLock = this.mainLock;
    // 获取独占锁
    mainLock.lock();
    try {
        // 将成员变量completedTaskCount加上worker处理的线程数量
        completedTaskCount += w.completedTasks;
        // 从线程池中移除该worker
        workers.remove(w);
    } finally {
        mainLock.unlock();
    }
	// 移除worker后必须调用的方法
    tryTerminate();
	// 获取ctl
    int c = ctl.get();
    // 判断状态是否小于STOP，即使是SHUTDOWN状态，也需要将队列中任务全部执行完成才行
    // 所以需要保持>=corePoolSize数量的worker
    if (runStateLessThan(c, STOP)) {
        // worker非异常退出
        if (!completedAbruptly) {
            // 判断保留corePoolSize数量的线程是否超时
            int min = allowCoreThreadTimeOut ? 0 : corePoolSize;
            // 如果min=0,但阻塞队列不为空，至少保留一个worker
            if (min == 0 && ! workQueue.isEmpty())
                min = 1;
            // 如果min!=0,且workerCount >= min直接退出
            if (workerCountOf(c) >= min)
                return; // replacement not needed
        }
        // 如果是异常退出，直接addWorker
        // 如果workerCount< min，增加一个null task的worker
        addWorker(null, false);
    }
}
```

> 何时调用此方法处理worker的退出？
>
> ① 执行`runWorker`方法时发生了异常。
>
> ② `getTask方法返回null`时会调用。
>
> 1. 如果`completedAbruptly=true`说明`runWorker`异常退出，将`workerCount-1`.
>
> 2. 获取独占锁，将worker执行的任务数传递给线程池`completedTaskCount`并移除该worker。
>
> 3. 如果`rs < STOP`时：
>
>    ① 当前worker正常退出的，如果`allowCoreThreadTimeOut=true`且`队列不为空`，那么至少保留一个worker。如果`allowCoreThreadTimeOut=false`，那么仅在`workerCount < corePoolSize`时增加一个worker。
>
>    ② 如果当前worker非正常退出的，直接添加一个worker。

---

### 线程池拒绝策略

| 策略                | 作用                                                         |
| ------------------- | ------------------------------------------------------------ |
| AbortPolicy         | 直接抛出一个RejectedExecutionException异常                   |
| CallerRunsPolicy    | 直接由调用者执行该任务，如果线程池关闭，该任务会被丢弃       |
| DiscardPolicy       | 不做处理，将该任务直接丢弃                                   |
| DiscardOldestPolicy | 丢弃队列中最老的任务并重试该任务，如果线程池关闭，该任务会被丢弃 |

---

### 线程池执行示意图

![](https://image.leejay.top/image/20200716/sMWBHgaW5lsx.png?imageslim)

---

### 线程池问题汇总

- 为什么Worker类选择继承了AQS而不是直接使用ThreadPoolExecutor的ReentrentLock？

> 源码注释：Doug lea希望实现的是`非可重入的互斥锁`，不希望worker在调用类似`setCorePoolSize`之类的线程池控制方法时能够重新获取该锁。
>
> 因为`需要符合一定的条件才能中断worker线程`，这个条件是通过设置`state=-1`来实现。而ThreadPoolExecutor中的`ReentrantLock`不能实现这个需求，所以需要额外继承AQS。
>
> `setCorePoolSize-> interruptIdleWorkers()-> interruptIdleWorkers(false)-> tryLock()`

- 为什么初始化Worker对象时会将state设为-1？

> Worker对象在初始化的时候会将`state = -1`，`防止worker在刚初始化后还没有执行任务就被中断`。因为`shutDown和shutDownNow`方法中都有中断线程的方法，只是逻辑不同而已，前者是通过`tryLock`来中断空闲线程(`只有state=0时才会成功`)，后者是通过`state >= 0将已初始化还未执行`的worker排除在外。

- 为什么runWorker方法中会先调用unlock再调用lock方法？

> `worker.unlock`方法的核心在于`tryRelease`方法，该方法设置`state = 0`后，lock方法才有可能执行成功，`否则永远无法获取锁`。除此之外还有控制中断的作用：
>
> 1. `当前worker可以被后续shutDownNow中断操作所中断`。
> 2. `让后续调用shutDown操作的线程通过tryLock判断worker是否空闲`。
>
> ```java
> protected boolean tryAcquire(int unused) {
>     // 如果是state=-1，CAS永远不会成功
>     if (compareAndSetState(0, 1)) {
>         setExclusiveOwnerThread(Thread.currentThread());
>         return true;
>     }
>     return false;
> }
> ```

- 线程池为何能够持有线程不释放，在有任务的时候立即执行？

> 核心在于`getTask`方法中，`核心线程`会执行`take()`方法阻塞直到任务到来，`非核心线程`会执行`poll()阻塞keepAliveTime后超时`，`getTask`返回null，最终调用`processWorkerExit`让当前worker推出。

- 线程池corePoolSize该如何设置？

> corePoolSize用于设置`指定数量的核心线程`，这些线程是即使`闲置和超时也不会被回收的`。
>
> corePoolSize的设置基于以下公式：
>
> ```java
> NThreads = NCPUS * UCPU * (1 + W/C)
> NThreads：线程数量
> NCpus：cpu核数(Runtime.getRuntime().availableProcessors()可计算)
> UCpus: cpu使用率(0~1)
> W/C： wait time/compute time  Cpu运行类型分为I/O密集型(W)和计算密集型(C)    
> ```
>
> 假设：CPU使用率是100%，那么公式可以变成：`NThreads = NCpus * (1 + W/C)`
>
> 1. 如果是`I/O密集型(数据库交互、文件上传下载、网络数据传输等)`，W越大，那么 W/C > 1， NThreads >= 2 * NCpus。
> 2. 如果是`计算密集型(复杂算法之类的)`，W 接近于0，NThreads >= NCpus，推荐NCpus+1，这样即使`当计算密集型线程偶尔由于缺失故障或者其他原因线程暂停，这个额外的线程也能确保CPU时钟周期不被浪费`， 至于多一个cpu上下文切换是否值得，具体项目具体测试。
>
> 推荐：` I/O密集型： NThread = 2NCpu。 计算密集型 NThread = NCpus + 1`。

- Scheduled线程池中`scheduleAtFixedRate`和`scheduleWithFixedDelay`的区别

```java
public static void execRate() {
    ScheduledExecutorService executorService = new ScheduledThreadPoolExecutor(1);
    executorService.scheduleAtFixedRate(() -> {
        try {
            System.out.println(Thread.currentThread().getName() + " Start: scheduleAtFixedRate:  " + new Date());
            Thread.sleep(1_000); // 任务执行需要1s
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println(Thread.currentThread().getName() + " End  : scheduleAtFixedRate:    " + new Date());
    }, 2L, 3L, TimeUnit.SECONDS); // 间隔3s
}
// pool-1-thread-1 Start: scheduleAtFixedRate:    Thu Apr 08 14:06:32 CST 2021
// pool-1-thread-1 End  : scheduleAtFixedRate:    Thu Apr 08 14:06:33 CST 2021
// pool-1-thread-1 Start: scheduleAtFixedRate:    Thu Apr 08 14:06:35 CST 2021 35-32=3
// pool-1-thread-1 End  : scheduleAtFixedRate:    Thu Apr 08 14:06:36 CST 2021
// pool-1-thread-1 Start: scheduleAtFixedRate:    Thu Apr 08 14:06:38 CST 2021 38-35=3
// pool-1-thread-1 End  : scheduleAtFixedRate:    Thu Apr 08 14:06:39 CST 2021

```
> 1. 如果线程执行任务的时间小于period设置的时间，那么即使上个线程任务执行完毕，下个线程也会等到`与上个线程相差period时间`后才会执行下个任务。
> 2. 如果线程执行任务的时间大于period设置的时间，那么线程任务执行完毕就会立即开始执行下个任务，因为时差已经达到了period。


```java
public static void execDelay() {
    ScheduledExecutorService executorService = new ScheduledThreadPoolExecutor(2);
    executorService.scheduleWithFixedDelay(() -> {
        try {
            System.out.println("Start: scheduleWithFixedDelay: " + new Date());
            Thread.sleep(1_000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("End  : scheduleWithFixedDelay: " + new Date());
    }, 2L, 2L, TimeUnit.SECONDS);
}

// pool-1-thread-1 Start: scheduleWithFixedDelay: Thu Apr 08 14:12:29 CST 2021
// pool-1-thread-1 End  : scheduleWithFixedDelay: Thu Apr 08 14:12:30 CST 2021
// pool-1-thread-1 Start: scheduleWithFixedDelay: Thu Apr 08 14:12:32 CST 2021
// pool-1-thread-1 End  : scheduleWithFixedDelay: Thu Apr 08 14:12:33 CST 2021
// pool-1-thread-1 Start: scheduleWithFixedDelay: Thu Apr 08 14:12:35 CST 2021
// pool-1-thread-1 End  : scheduleWithFixedDelay: Thu Apr 08 14:12:36 CST 2021
```
> 下个线程必须与上个线程相差`线程执行时长 + Delay时长`，才会开始执行下个任务。