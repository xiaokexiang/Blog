---
title: "ThreadLocal内存泄漏"
date: 2020-06-04T14:49:04+08:00
description: "ThreadLocal的内存泄露问题。"
tags: ["ThreadLocal ", "内存泄漏"]
categories: [
  "Concurrent"
]
hideReadMore: true
---

ThreadLocal类，底层由`ThreadLocalMap`实现，是Thread类的成员变量，因为`类的每个实例的成员变量都是这个实例独有的`，所以在不同的Thread中有不同的副本，每个线程的副本`只能由当前线程使用，线程间互不影响`。因为一个线程可以拥有多个ThreadLocal对象，所以其内部使用`ThreadLocalMap<ThreadLocal<?>, Object>`来实现。


```java
public class Thread implements Runnable {
    ThreadLocal.ThreadLocalMap threadLocals = null;
}
public class ThreadLocal<T> {

	static class ThreadLocalMap {
        
        // 需要注意的是这里的Entry key是ThreadLocal的弱引用
        // 弱引用的特点是在下次GC的时候会被清理
        static class Entry extends WeakReference<ThreadLocal<?>> {
            // value 与 ThreadLocal关联
            Object value;

            Entry(ThreadLocal<?> k, Object v) {
                super(k);
                value = v;
            }
        }
    }
}

```

![](https://image.leejay.top/image/20200701/Y6kWCwYi46IF.png?imageslim)

> 1. 当前线程执行时(`currentThread已初始化`)，会初始化ThreadLocal对象，存储在`Heap堆`中，ThreadLocal的引用，即`ThreadLocalRef`会存储在当前线程`Stack栈`中。
> 2. 当执行ThreadLocal的get()/set()方法时，会通过`当前线程的引用找到当前线程在堆中的实例`，判断这个实例的成员变量：`ThreadLocalMap`是否已经创建(即初始化)，如果没有则初始化。
> 3. 若一个Threa中存在多个ThreadLocal，那么ThreadLocalMap会存在多个Entry，`Entry的key是弱引用的ThreadLocal`。

根据ThreadLocal堆栈示意图，我们可以推断处只要符合以下条件，ThreadLocal就会出现内存泄漏：

1. `ThreadLocal没有被外部强引用`，这样在GC的时候ThreadLocal会被回收，导致key = null。
2. `key = null`后没有调用过ThreadLocalMap中的get、set或remove方法中的任意一个。`(因为这些方法会将key = null的value也置为null，便于GC回收)`
3. `Thread对象没有被回收`，Thread强引用着ThreadLocalMap，这样ThreadLocalMap也不会被回收。
4. ThreadLocalMap没有被回收，但是`它的Entry中的key已被回收，key关联的value也不能被外部访问`，所以导致了内存泄漏。

总结如下：

> `Thread生命周期还没有结束，ThreadLocal对象被回收后且没有调用过get、set或remove方法就会导致内存泄漏。`

我们可以看出内存泄漏的触发条件比较苛刻的，但确实会发生，其实`只要线程Thread的生命周期结束，那么Thread的ThreadLocalMap也不会存在强引用，那么ThreadLocalMap中的value最终也会被回收。`，所以在使用ThreadLocal时，除了需要密切关注`Thread和ThreadLocal的生命周期`，还需要在每次使用完之后调用`remove`方法，这样做还有一个问题就是：

> 如果你使用的是线程池，那么会出现`线程复用`的情况，如果`不及时清理remove()会导致下次使用的值不符合预期`。