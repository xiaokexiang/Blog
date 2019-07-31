---
title: Java并发编程基础
date: 2019-07-29 13:19:41
top: true
tags: Java Concurrent
toc: true
categories:
  - Java Concurrent
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4mghnm1y2j30sg0lcaan.jpg
---

## 线程简介

### 为什么使用多线程

❓ 为什么使用多线程?<br/>
🙋 利用多核心处理器减少程序(`一个程序作为一个进程运行`)响应时间(`一个线程在一个时刻只能运行在一个处理器核心上`)

---

### 线程优先级

> 现代操作系统基本采用`时分`的形式调度运行的线程: 操作系统会分出一个个时间片, 线程会分配到若干时间, 当线程的时间片用完就会发生`线程调度`, 并等待下次分配, 线程分配到的时间片也决定了`线程使用处理器资源的多少.`
> 线程优先级: <font color="green">就是决定线程需要多或者少分配一些处理器资源的线程属性.</font>

```java
public class JavaPriority {
    public static void main(String[] args) {
        /*
         * 线程优先级: 1~10 默认是 5
         */
        Thread thread1 = new Thread(() -> System.out.println("线程1, 优先级10"));
        thread1.setPriority(10);
        thread1.start();

        Thread thread3 = new Thread(() -> System.out.println("线程2, 默认优先级5"));
        thread3.start();

        Thread thread2 = new Thread(() -> System.out.println("线程3, 优先级1"));
        thread2.setPriority(1);
        thread2.start();
    }
}
```

> 需要注意的是: <font color="red">线程优先级不能作为程序正确性的依赖, 因为操作系统可以不用理会 Java 线程对于优先级的设定</font>

<!--more-->

---

### 线程的状态

<img border="1" title="线程的状态" src="https://i.loli.net/2019/07/29/5d3e92337257148207.png">

<img border="1" title="线程状态变迁" src="https://i.loli.net/2019/07/29/5d3ea3ecd478f24426.png">

> 线程创建之后, 调用 `start()`方法开始运行. 当线程执行 `wait()`方法之后, 线程进入等待状态. 进入等待状态的线程需要依靠其他线程的通知才能够返回到运行状态, 而<font color="green">超时等待状态相当于在等待状态的基础上增加了超时限制, 也就是超时时间到达时将会返回到运行状态. </font>当线程调用同步方法时, 在没有获取到锁的情况下, 线程将会进入到阻塞状态. 线程在执行 Runnable 的 run()方法之后将会进入到终止状态.

---

### Daemon 线程

_Daemon 线程时一种支持型线程, 因为它主要被用作程序中后台调度及支持型工作, 当 JVM 中不存在`非Daemon线程的时候`, JVM 将退出_

```java
public class DaemonThread {
    public static void main(String[] args) {
        Thread thread = new Thread(() -> {
            System.out.println("I'm Daemon Thread");
            try {
                TimeUnit.SECONDS.sleep(100);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }, "DaemonThread");
        thread.setDaemon(true);
        thread.start();

        new Thread(() -> {
            try {
                Thread.sleep(100000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }, "Thread-xx").start();
    }
}
```

---

### 线程中断

_中断可以理解为线程的一个标识位属性, 它标识一个运行中的线程是否被其他线程进行了中断操作. `线程通过检查自身是否被中断来进行响应`_

```java
public class ThreadInterrupted {
    public static void main(String[] args) {
        Thread thread1 = new Thread(() -> {
            try {
                TimeUnit.SECONDS.sleep(1000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        });
        Thread thread2 = new Thread(() -> {
            for (; ; ) {

            }
        });

        thread1.start();
        thread2.start();

        // 充分运行
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        thread1.interrupt();
        thread2.interrupt();
        /*
         * Thread1 interrupted is false
         * Thread2 interrupted is true
         */
        System.out.println("Thread1 interrupted is " + thread1.isInterrupted());
        System.out.println("Thread2 interrupted is " + thread2.isInterrupted());

        // 防止立即退出
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

> 需要注意的是:
>
> 1. 对于阻塞线程(`使用了 Object.wait(), Thread.join()和Thread.sleep()三种方法之一阻塞时`)调用它自己的 interrupted()方法时, 没有占用 CPU 运行的线程是不可能给自己的中断状态置位的。这就会产生一个 `InterruptedException` 异常(`在此之前会将标识位清除, Thread.isInterrupted()将返回 false`)
> 2. 而对于非阻塞线程(`只是改变了中断状态, 即Thread.isInterrupted()将返回 true`), interrupted 标识位为 true, 并不代表线程一定就会停止运行
> 3. 如果该线程已经处于`终结状态`, 即使该线程被中断过, 那么调用 isInterrupted() 方法返回仍然是 false, 表示没有被中断.

---

## 线程间通讯

### Volatile

Volatile 可以用来修饰字段(成员变量), 就是告知程序任何对该变量的访问均需要从共享内存中获取, 而对它的改变必须同步刷新回共享内存, 它能保证所有线程对变量访问的可见性.

### Synchronized

Synchronized 可以修饰方法或者以同步块的形式来进行使用, 它主要确保多个线程在同一个时刻, 只能有一个线程处于方法或者同步块中, 它保证了线程对变量访问的可见性和排他性.

<img border="1" src="https://i.loli.net/2019/07/30/5d400226788d258150.png">

> 任意线程对 Object(Object 由 synchronized 保护)的访问, 首先要获 Object 的监视器. `如果获取失败, 线程进入同步队列, 线程状态变BLOCKED`.
> 当访问 Object 的前驱(已获得了锁的线程)释放了锁, 则该释放操作`唤醒阻塞在同步队列中的线程`, 使其重新尝试对监视器的获取.

---

### 等待/通知机制

- 两个线程交替打印救赎

```java
public class WaitAndNotify2 {

    private volatile static Boolean FLAG = Boolean.TRUE;
    private static AtomicInteger i = new AtomicInteger(0);
    private static final Object LOCK = new Object();

    public static void main(String[] args) {
        // 打印偶数
        new Thread(() -> {
            while (i.get() <= 100) {
                synchronized (LOCK) {
                    if (FLAG) {
                        System.out.println("偶数: " + i.getAndIncrement());
                        FLAG = Boolean.FALSE;
                        LOCK.notify();
                    } else {
                        try {
                            LOCK.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }).start();

        // 打印奇数
        new Thread(() -> {
            while (i.get() <= 100) {
                synchronized (LOCK) {
                    if (!FLAG) {
                        System.out.println("奇数: " + i.getAndIncrement());
                        FLAG = Boolean.TRUE;
                        LOCK.notify();
                    } else {
                        try {
                            LOCK.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }).start();
    }
}
```

- 图解

<img border="1" src="https://i.loli.net/2019/07/31/5d41403b0784297447.png">

> 需要注意的是:
>
> 1. 使用 wait(), notify()&notifyAll()方法`需要先调用对象加锁`
> 2. 调用 wait()方法, 线程状态由 RUNNING 变为 WAITING ,并`将当前线程放置对象的等待队列`
> 3. notify()或 notifyAll()方法调用后, 等待的线程依旧不会从 wait()返回, `需要调用 notify 或 nitofyAll()的线程释放锁之后`, 等待线程才`有机会`从 wait()返回.
> 4. notify()将`等待队列`中的`一个线程`移到`同步队列`去竞争该对象的锁, notidyAll()将`等待队列`里面的`全部线程`移到`同步队列`去竞争该对象的锁, 线程的状态<font color="red">由 WAITING 变成 BLOCKED</font>
> 5. 从 wait()方法返回的`前提是获得了调用对象的锁`.

- 疑问

❓ 为什么 wait(), notify() & notifyAll()定义在 Object 类中?

🙋 因为三种方法都是需要获取锁才能够执行, Java 提供的锁是`对象级`而不是线程级, 所以`Synchorized`这把锁可以是任意对象, 任意对象都可以调用这三种方法.

---

### Thread.join()

_如果 `ThreadA` 执行了 `ThreadB.join()`, 那么 ThreadA 会等到 ThreadB 执行完毕之后才返回_

```java
public class ThreadJoin {
    public static void main(String[] args) {
        Thread thread1 = new Thread(() -> System.out.println("Thread1"));
        Thread thread2 = new Thread(() ->{
            try {
                thread1.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("Thread2");
        });
        Thread thread3 = new Thread(() -> {
            try {
                thread2.join();
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("Thread3");
        });
        /*
        Thread1
        Thread2
        Thread3
         */
        thread1.start();
        thread2.start();
        thread3.start();
    }
}
```

---

### ThreadLocal

_ThreadLocal 提供了`线程的局部变量`, 每个线程都可以通过 set()和 get()对这个局部变量进行操作, 但不会和其他线程的局部变量冲突, 进而实现了`线程隔离`_

```java
class ThreadLocalTest {
    /**
     * 指定ThreadLocal的初始值,当没有先set,直接get的时候会返回默认值
     * ThreadLocal内部维护了一个ThreadLocalMap,当前线程的ThreadLocal实例为key,要保存的对象为value
     */
    private static ThreadLocal<String> threadLocal = ThreadLocal.withInitial(() -> "我是ThreadLocal的初始值");

    String getValue() {
        return threadLocal.get();
    }
}

class Test {
    public static void main(String[] args) {
        ThreadLocalTest threadLocalTest = new ThreadLocalTest();
        //如果没有set值，默认就返回初始值
        System.out.println(threadLocalTest.getValue());
    }
}
```

> 需要注意的是:
>
> 1. ThreadLocal 底层维护的是一个 ThreadLocalMap<k,v>, `k 是当前 ThreadLocal 实例本身, v 是需要保存的对象`
> 2. 如果 get()之前没有 set(), 那么 ThreadLocal 返回的是默认值
> 3. 发生散列冲突时, ThreadLocalMap 使用`开放定址法`实现数据存储, 而 HashMap 采用的是`分离链表法`,其原因在于: `在 ThreadLocalMap 中的散列值分散的十分均匀，很少会出现冲突。并且 ThreadLocalMap 经常需要清除无用的对象，使用纯数组更加方便`
>
> 参考: <a href="https://www.cnblogs.com/zhangjk1993/archive/2017/03/29/6641745.html#_label2">详解 ThreadLocal</a>

---

## 线程应用实例
