---
title: "Future"
date: 2020-07-19T17:11:13+08:00
description: "因为原有的线程执行`无法获取到返回结果`，所以为了弥补线程无返回值的问题，才诞生了Future类。"
tags: ["Future ","FutureTask"]
categories: [
  "Concurrent",
  "Future"
]
hideReadMore: true
---

### Future

```java
public interface Future<V> {
    // 获取任务结果
    V get() throws InterruptedException, ExecutionException;
    // 获取任务结果，带超时机制
    V get(long timeout, TimeUnit unit)
        throws InterruptedException, ExecutionException, TimeoutException;
    // 任务是否完成
    boolean isDone();
    // 任务是否取消
    boolean isCancelled();
    // 取消任务
    boolean cancel(boolean mayInterruptIfRunning);
}
```

ThreadPoolExecutor中的submit方法是由他的父类`AbstractExecutorService`实现的

```java
public <T> Future<T> submit(Callable<T> task) {
    if (task == null) throw new NullPointerException();
    // 封装callable对象
    RunnableFuture<T> ftask = newTaskFor(task);
    // 再调用线程池的execute方法
    execute(ftask);
    // 返回FutureTask
    return ftask;
}
// 将callable作为参数传入FutureTask对象
protected <T> RunnableFuture<T> newTaskFor(Callable<T> callable) {
    return new FutureTask<T>(callable);
}
```

---

### FutureTask

#### 类的继承结构

```java
public class FutureTask<V> implements RunnableFuture<V> {
}

public interface RunnableFuture<V> extends Runnable, Future<V> {
    void run();
}
```

> `FutureTask`实现了`RunnableFuture`，而`RunnableFuture`继承了`Runnable`和`Future`。那么`FutureTask`即拥有`Runnable`特性，可以配合线程池执行，又拥有了`Future`特性，可以获取执行结果。

#### 构造函数

```java
public FutureTask(Callable<V> callable) {
    // 判空
    if (callable == null)
        throw new NullPointerException();
    // 成员属性赋值
    this.callable = callable;
    // 状态赋值
    this.state = NEW;
}
// 如果传入的是runnable和result
public FutureTask(Runnable runnable, V result) {
    // 会执行Executors.callable将他们转换成Callable对象
    // 本质是通过实现Callable接口的适配器类进行转换
    this.callable = Executors.callable(runnable, result);
    // state赋值
    this.state = NEW;
}
```

> 构造函数没有特别的，就是将传入的`Callable`对象赋值给成员变量，以及初始化`state`状态。

#### 成员属性

```java
// 用于get()返回的结果或抛出的异常
// 非volatile修饰的原因：读写的时候通过state的来保护
private Object outcome; 
// 运行callable的线程
private volatile Thread runner;
// 等待线程的驱动栈
private volatile WaitNode waiters;
// 待执行的任务，执行后会为null
private Callable<V> callable;
// 用于表示任务的状态
// 可能的状态转换:
// NEW -> COMPLETEING -> NORMAL
// NEW -> COMPLETEING ->EXCEPTIONAL
// NEW -> CANCELLED
// NEW -> INTERRUPTING -> INTERRUPTED
private volatile int state;
private static final int NEW          = 0;
private static final int COMPLETING   = 1;
private static final int NORMAL       = 2;
private static final int EXCEPTIONAL  = 3;
private static final int CANCELLED    = 4;
private static final int INTERRUPTING = 5;
private static final int INTERRUPTED  = 6;

static final class WaitNode {
    // 当前线程
    volatile Thread thread;
    // next节点
    volatile WaitNode next;
    WaitNode() { thread = Thread.currentThread(); }
}
```

> state共有7种状态，那么只会有如下四种状态转换流程：
>
> 1. 任务执行顺利完成：`NEW -> COMPLETEING -> NORMAL`
> 2. 任务执行过程出现异常：`NEW -> COMPLETEING ->EXCEPTIONAL`
> 3. 任务过程被取消：`NEW -> CANCELLED`
> 4. 任务执行过程中被中断：`NEW -> INTERRUPTING -> INTERRUPTED`

---

#### run

因为`FutureTask`间接实现了`Runnable`接口，所以在通过线程池执行时，会从`run`开始执行。

```java
public void run() {
    // 1. 如果状态不是NEW，说明任务执行过或已取消或被中断了，直接返回
    // 如果1不成立，那么此时状态为NEW，尝试将当前线程保存在runner属性中
    if (state != NEW ||
        !UNSAFE.compareAndSwapObject(this, runnerOffset,
                                     null, Thread.currentThread()))
        return;
    try {
        // 获取任务
        Callable<V> c = callable;
        // 再次判断
        if (c != null && state == NEW) {
            V result;
            // 用于标记是否保存结果
            boolean ran;
            try {
                // 调用call方法获取返回值
                // 会阻塞在此直到完成或抛出异常
                result = c.call();
                ran = true;
            } catch (Throwable ex) {
                // 如果发生异常
                result = null;
                ran = false;
                // 设置异常
                setException(ex);
            }
            // 如果没有发生异常，且执行完成
            if (ran)
                // set返回值
                set(result);
        }
    } finally {
        // 清空runner属性
        runner = null;
        // 清空runner必须要重新读取state状态
        // 防止中断被遗漏
        int s = state;
        if (s >= INTERRUPTING)
            handlePossibleCancellationInterrupt(s);
    }
}
// 确保来自可能的cancel（true）的任何中断仅在run或runAndReset时传递给任务。
private void handlePossibleCancellationInterrupt(int s) {
    // 执行至此说明当前线程即将被中断，那么判断state状态并spin自旋，交出cpu执行权
    // 让执行cancel的线程早日执行完中断流程
    if (s == INTERRUPTING)
        while (state == INTERRUPTING)
            Thread.yield(); // wait out pending interrupt
    // 这里补一下：
    //Doug lea的注释中说：我们希望清除所有从cancel方法中获取到的中断，但是，
    // 我们需要允许使用中断作为任务与其调用方通信的独立机制，并且我们没有办法
    //只清除cancel方法的中断
}
// 处理返回值
protected void set(V v) {
    // 尝试将状态NEW -> COMPLETEING
    if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, COMPLETING)) {
        //将返回值赋予outcome
        outcome = v;
        // 和设置异常不同，COMPLETEING -> NORMAL
        UNSAFE.putOrderedInt(this, stateOffset, NORMAL); 
        finishCompletion();
    }
}
// 处理异常
protected void setException(Throwable t) {
    // 尝试将state由NEW -> COMPLETEING
    if (UNSAFE.compareAndSwapInt(this, stateOffset, NEW, COMPLETING)) {
        // 为什么这里不需要同步？
        // 我们假设线程A执行了run方法，当发生异常，那么会执行到此
        // 如果CAS成功了，state状态被修改，那么其他线程想要执行setException方法
        // 只能通过run或runAndReset，但他们无法通过第一步的state校验
        // 也是outcome注释中说的outcome通过state读写状态来保护
        outcome = t;
        // 设置outcome成功后执行CAS修改为EXCEPTIONAL
        UNSAFE.putOrderedInt(this, stateOffset, EXCEPTIONAL);
        // 任务完成后调用
        finishCompletion();
    }
}

// 移除和唤醒所有等待的线程，执行钩子函数done，并将callable设为null
private void finishCompletion() {
    // 此刻需要state > COMPLETEING
    // 如果waiters!=null
    for (WaitNode q; (q = waiters) != null;) {
        //CAS将waiters属性设为null(cancel和removeWaiters也会修改waiters属性)
        if (UNSAFE.compareAndSwapObject(this, waitersOffset, q, null)) {
            // 循环处理waiters及它的next节点
            for (;;) {
                // 获取等待的线程
                Thread t = q.thread;
                // 如果不为null
                if (t != null) {
                    // 将其置为null
                    q.thread = null;
                    // 并unpark该线程
                    LockSupport.unpark(t);
                }
                // 获取下一个waitNode
                WaitNode next = q.next;
                // 如果next = null就退出循环
                if (next == null)
                    break;
                // 将q的next属性设为null方便GC
                q.next = null;
                // 将next赋予q，继续循环
                q = next;
            }
            // 内循环退出后外循环也直接退出
            break;
        }
    }
	// 执行钩子函数
    done();
	// 将callable设为null
    callable = null;        // to reduce footprint
}
```

> `FutureTask`方法的执行时间就是`ThreadPoolExecutor`执行`runWorker`中的`task.run`时被调用。
>
> `FutureTask #run`执行流程：
>
> 1. 若`state!=NEW`或`无法CAS修改runner`直接返回，说明`有其他线程在执行run`或`该任务已被执行过`。
> 2. 调用`Callabel #call`方法，阻塞等待执行完毕，如果成功获取值，调用`set(value)`。如果获取值期间抛出异常，那么调用`setException()`。
> 3. `set()与setException()`方法执行流程类似，`state = COMPLETING`是中间状态，前者最终会设置`state = NORMAL`，后者会设置`state = EXCEPIONAL`，并且两者最终都会调用`finishCompletion`来唤醒`waiters属性下等待的线程、执行done()钩子函数及将callable清空。`
> 4. 最后清空`runner`属性，并在此检查状态，如果此时别的线程执行了`cancel(true)`方法，那么我们需要执行自旋并交出CPU执行权，让执行`cancel`的线程早日执行完中断。

---

### cancel

```java
// mayInterruptIfRunning true/false:
// 执行该任务的线程是否需要中断/正在执行任务允许被完成
public boolean cancel(boolean mayInterruptIfRunning) {
    // 如果state!=NEW,那么会直接返回
    // 如果state=NEW，那么基于mayInterruptIfRunning的值
    // 如果为true将NEW CAS修改为INTERRUPTING,否则CAS修改为CANCELLED
    // 如果修改成功，才会继续执行，否则直接退出
    if (!(state == NEW &&
          UNSAFE.compareAndSwapInt(this, stateOffset, NEW,
                         mayInterruptIfRunning ? INTERRUPTING : CANCELLED)))
        return false;
    try {   
        // 为true才会执行中断操作
        if (mayInterruptIfRunning) {
            try {
                // 将runner线程中断
                Thread t = runner;
                if (t != null)
                    t.interrupt();
            } finally {
                // CAS将state修改为INTERRUPTED
                UNSAFE.putOrderedInt(this, stateOffset, INTERRUPTED);
            }
        }
    } finally {
        finishCompletion();
    }
    return true;
}
```

> `cancel`方法的关键在于参数`mayInterruptIfRunning`：
>
> ​	① true说明执行任务的线程会被中断。
>
> ​	② false说明执行任务的线程不会被中断。
>
> `cancel`会处理两种状态：
>
> ​	① `NEW -> INTERRUPTING(准备打断执行任务线程) -> INTERRUPTED(线程已被打断)`
>
> ​	② `NEW -> CANCELLED`，任务被取消，不允许中断。
>
> `cancel`方法要求只有在`state = NEW`的时候才能够`选择中断或不中断线程`。我们假设线程A执行`run`方法直到`set()`方法处切换到线程B，此时线程B执行`cancel(true)`，会设置`state = INTERRUPTING`，中断线程后设置`state = INTERRUPTED`，此时切换回线程A，线程A执行`set()`失败，此时会执行`finally`中处理中断的逻辑，将执行权交给线程B进行中断的处理。

---

### awaitDone

```java
// 等待完成 或因为中断或超时导致的终止
private int awaitDone(boolean timed, long nanos)
        					throws InterruptedException {
    // 计算deadline
    final long deadline = timed ? System.nanoTime() + nanos : 0L;
    WaitNode q = null;
    // 用于表示是否成功加入waiter队列中
    boolean queued = false;
    // 自旋
    for (;;) {
        // 判断当前线程是否被中断，如果被中断还会顺便清除中断状态
        if (Thread.interrupted()) {
            // 移除waiter
            removeWaiter(q);
            // 抛出中断异常
            throw new InterruptedException();
        }
		// 获取state
        int s = state;
        // 如果state>COMPLETING，说明流程已经走完
        // 要么正常结束，要么cancel了，要么被中断了
        if (s > COMPLETING) {
            // 如果thread不为null就清空它
            if (q != null)
                q.thread = null;
            // 返回state跳出循环
            return s;
        }
        // 如果state=COMPLETING,说明正在设置outcome，那么让出cpu执行权
        else if (s == COMPLETING)
            Thread.yield();
        // 构建新的waitNode节点
        else if (q == null)
            q = new WaitNode();
        else if (!queued)
            // 这里需要注意下，将waiters替换为q的同时设置q.next = waiters
            // 栈结构，先进后出
            // CAS成功，下次就不会执行该处代码
            queued = UNSAFE.compareAndSwapObject(this, waitersOffset,
                                                 q.next = waiters, q);
        // 如果设置了超时时间会执行此处代码
        else if (timed) {
            nanos = deadline - System.nanoTime();
            // 如果等待时候到了，那么从队列移除，并不再等待返回state退出循环
            if (nanos <= 0L) {
                removeWaiter(q);
                return state;
            }
            // 阻塞指定时长
            LockSupport.parkNanos(this, nanos);
        }
        else
            // 如果没设置尝试则挂起当前线程
            LockSupport.park(this);
    }
}
```

> 该方法的目的：让`当前线程等待任务完成`或`因为中断或超时导致的中断`而返回。
>
> 该方法每次执行都会先进行三个判断：
>
> ​	① `先判断当前线程是否被中断`，如果被中断就抛出中断异常。
>
> ​    ② `再判断state状态，若state > COMPLETING`，说明流程已经快走完了(不管是正常还是不正常)。
>
> ​	③  `判断state = COMPLETING`是否成立，成立说明正在设置`outcomt`，那么交出CPU控制权。
>
> 如果三个判断都能通过的话，那么该方法至少会循环三次：
>
> ​	① 因为`q = null`，`q = new WaitNode()`。
>
> ​	② 因为`!queued = true`，将`q设为waiters属性同时，将原waiters挂在q的next属性下`。类似栈结构.
>
> ​	③ 如果设置了超时，会`阻塞指定时长最终退出`，否则会一直阻塞直到被`set()/setException()`唤醒。

---

### get

```java
public V get() throws InterruptedException, ExecutionException {
    int s = state;
    // 如果state 状态 <= COMPLETEING，说明此时准备设置outcome或还没有执行run
    if (s <= COMPLETING)
        // 将当前线程加入阻塞队列，等待任务执行完成唤醒
        s = awaitDone(false, 0L);
    return report(s);
}
// get指定时长
public V get(long timeout, TimeUnit unit)
        throws InterruptedException, ExecutionException, TimeoutException {
    // 判空
    if (unit == null)
        throw new NullPointerException();
    int s = state;
    // 如果任务还未完成或者等待执行时长后唤醒，任务还是没有完成，抛出超时异常
    if (s <= COMPLETING &&
        (s = awaitDone(true, unit.toNanos(timeout))) <= COMPLETING)
        throw new TimeoutException();
    return report(s);
}
// 返回已完成任务的结果或抛出异常
private V report(int s) throws ExecutionException {
    // 获取outcome
    Object x = outcome;
    // 如果状态为NORMAL，说明任务正常结束
    if (s == NORMAL)
        return (V)x;
    // state >= CANCELLED说明任务被cancel了
    if (s >= CANCELLED)
        throw new CancellationException();
    // 其他情况抛出ExecutionException异常
    throw new ExecutionException((Throwable)x);
}

```

> get()方法会先判断`state <= COMPLETING`任务是否完成，如果没有完成，会调用`awaitDone`进行阻塞。直到任务完成会调用`finishCompletion`唤醒阻塞线程。
>
> get(time)在判断`state <= COMPLETING`的同时，也会判断`awaitDome(time)`后任务是否仍未完成，若仍未完成，就抛出`超时异常`。
>
> 两个方法最终都调用`report()`，通过`state`来判断是返回`值还是抛出异常`。