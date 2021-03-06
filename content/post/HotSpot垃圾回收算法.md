---
title: "HotSpot垃圾回收算法"
date: 2020-08-14T16:33:06+08:00
description: "如何判断`对象是否存活`的，对象的`回收流程`及垃圾回收器采用的算法。"
tags: ["JVM ","reference"]
weight: 6
categories: [
  "JVM"
]
hideReadMore: true
---

### 垃圾回收概述

在JVM`运行期间`，会对内存中`不再被使用的对象`进行`分配和管理`。若不及时对内存中的垃圾进行清理，会导致被保留的空间无法被其他对象使用，从而导致`内存溢出`。

> 内存溢出：系统无法分配给程序所`需要的指定大小内存`。
>
> 内存泄漏：当`对象不再使用或无法继续使用时`，因为强引用的存在导致`本该会回收的内存无法被回收`，常见于：`Map用对象作为key不重写hashcode & equals & ThreadLocal内存泄漏`。 

### 对象是否存活

JVM垃圾回收器会对对象中`不再使用(死去)`的对象进行回收，那么垃圾回收器是如何进行判断的呢。

#### 1. 引用计数法

对于一个对象A，只要有一个对象引用了A，那么A的计数器增加1，当引用失效的时候就减1。该算法会产生`对象之间循环引用`问题，会导致`内存泄漏`。

#### 2. 可达性算法

通过一系列称为`"GC Roots"`的根对象作为起点，根据引用关系向下搜索，搜索过程走过的路称为`"引用链"`。如果某个对象到`"GC Roots"`没有任何引用链相连，就说明该对象需要被回收。

![](https://image.leejay.top/image/20200813/PK6PSNTuG2W8.png?imageslim)

> 图中绿色为`可达对象`，灰色为`不可达对象`。
>
> `GC Roots`包括但不限于以下：
>
> 1. 栈帧中引用的对象（局部变量、临时变量等）
> 2. 类中的`引用型静态变量`
> 3. `字符串常量池中的引用`。
> 4. 被`Synchronized`锁持有的对象。

#### 3.并发的可达性

我们知道大部分的收集器都是使用`可达性算法`判断标记对象是否要被回收，其中又被分为`中断用户线程`、`与用户线程并发执行`两种。

`中断用户线程`进行标记时，对象图中的对象或引用不会被修改，但堆中存储的对象越多，带来的`STW`时间也会越长。因此为了减少`STW`时长，`标记与用户线程同时运行`能有效减少`STW`时长，但会带来并发可达性问题：

1. `被标记完毕的对象`又新引用了`未被收集器访问的对象`。
2. `正在被标记的对象`直接或间接删除了`未被收集器访问的对象`的引用。

基于上述两个问题产生了两种解决方案：

1. **增量更新**

基于问题1，当`被标记完毕对象`又引用了`未被收集器访问的对象`时，将这些`被标记完毕对象`记录下来，等并发标记阶段结束后，以这些`被标记完毕对象为根`再次进行扫描。`CMS收集器`采用此策略实现并发标记。

2. **原始快照**

基于问题2，当`正在被标记的对象`直接或间接删除了`未被收集器访问的对象`的引用时，将这些`正在被标记的对象`记录下来，等并发标记结束后，以这些`正在被标记的对象`为根重新扫描。`G1收集器`采用此策略实现并发标记。

---

### Java中的引用

传统的引用概念：若`reference`类型的数据中存储的数值是另一块内存的起始地址，就说明该`reference`数据是某个内存、某个对象的引用。

从`JDK1.2`开始，Java对引用的概念进行补充，将引用分为了：`强引用、软引用、弱引用和虚引用`四种。

```java
public abstract class Reference<T> {
    // 引用本身
	private T referent;  
    // 存储reference本身的链表队列
    volatile ReferenceQueue<? super T> queue;
}
```

> 当垃圾回收器准备回收一个对象时，发现它还有`软、弱、虚引用`，就会在回收对象之前，将该引用加入到与之关联的`引用队列ReferenceQueue`中去，这样就可以实现在引用对象回收前的相关操作。

![](https://image.leejay.top/image/20200813/yIcmomijhoVr.png?imageslim)

- 强引用

即最传统引用的体现，比如`Object obj = new Object()`，只要强引用关系存在，那么垃圾回收器永远不会回收掉被引用的对象。

- 软引用

用于描述`还有用、但非必须的对象`，只被软引用`关联（指向）`的对象，在OOM之前，会将这些对象进行二次回收，如果回收后仍没有足够内存，才会抛出OOM。Java中用`SoftReference`实现。

- 弱引用

相比`软引用`，只被`弱引用关联（指向）`的对象只能生存到下一次垃圾收集，只要垃圾回收器工作，`弱引用`就会被回收。Java中用`WeakReference`实现。`ThreadLocal.ThreadLocalMap<k,v>中key就继承了弱引用`。

```java
public class Weak {
    private static WeakReference<String> weakReference;

    public static void main(String[] args) {
        test();
        System.out.println(weakReference.get());// hello
        System.gc(); // test作用域结束，gc会清理weakReference
        System.out.println(weakReference.get());// null
    }

    static void test() {
        // str 作为test方法的本地变量
        String str = new String("hello");
        weakReference = new WeakReference<>(str);
        System.gc();// 不会被清理
        System.out.println(weakReference.get());// hello
    }
}
```

> 和软引用一样，弱引用也适合保存`可有可无的数据`，当系统内存不足的时候会被回收，内存充足的时候，缓存数据存在相当长的时间，达到让系统加速的作用。

- 虚引用

引用中最弱的一种，一个对象是否有`虚引用`的存在，对其生存时间不会产生影响，并且`无法通过虚引用获取对象实例`。唯一的作用就是为了在`该对象被回收时收到通知`。

```java
public class Phantom {
    // 实现 包含虚引用的对象在回收时接受通知
	public static void main(String[] args) {
        String hello = new String("hello");
        // 创建引用Queue
        ReferenceQueue<String> queue = new ReferenceQueue<>();
        PhantomReference<String> reference = new PhantomReference<>(hello, queue);
        new Thread(() -> {
            while (true) {
                Reference<? extends String> poll = queue.poll();
                if (poll != null) {
                    try {
                        // 此时说明hello对象被回收了
                        Field referent = Reference.class
                            .getDeclaredField("referent");
                        referent.setAccessible(true);
                        String str = (String) referent.get(poll);
                        System.out.println("GC Will Collect " + str);
                        break;
                    } catch (IllegalAccessException | NoSuchFieldException e) {
                        e.printStackTrace();
                    }
                }
            }
        }).start();
        // 去除hello的引用
        hello = null;
        // 调用垃圾回收对象
        System.gc();
    }
}
```

> 对于虚引用，它的get()方法只会返回null，因为`虚引用是不可达的`。
>
> ```java
> public class PhantomReference<T> extends Reference<T> {
>  public T get() { return null; }
> }
> ```

---

### 对象的回收

我们知道`HotSpot`采用的是`可达性算法`判断对象是否存活，那么不再存活的对象垃圾回收器是如何回收的呢？

1. 垃圾回收器对对象进行回收时，先通过`可达性算法`判断该对象是否可达。
2. 如果`对象不可达`并且`复写了finalize方法且该对象的finalize方法之前没被调用过`。
3. 垃圾回收器会将对象放置到`ReferenceQueue<Finalizer>`队列中，稍后由JVM启动一个`低优先级的Finalizer线程`去执行Queue中`对象的finalize方法`。
4. 但JVM不一定会等待`finalize`执行结束，因为如果`finalize`方法卡顿，会导致队列中后续的对象处于等待，甚至导致`整个内存回收系统的崩溃`。
5. 若该对象的finalize方法不能`将对象与引用链建立连接`，该对象会被垃圾回收器清理。

![](https://image.leejay.top/image/20200814/1LKD8vwaOJzB.png?imageslim)

```java
public class ReachabilityAnalysis {
    
    // 创建GC Roots
    private static ReachabilityAnalysis REACHABILITY_ANALYSIS = null;

    private void isAlive() {
        System.out.println("i'm still alive ...");
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        System.out.println("execute finalize method ...");
        // 试图和引用链建立联系
        REACHABILITY_ANALYSIS = this;
    }

    public static void main(String[] args) throws InterruptedException {
        // 创建对象
        REACHABILITY_ANALYSIS = new ReachabilityAnalysis();
        // 去除引用链的联系, 便于测试
        REACHABILITY_ANALYSIS = null;
        // 调用gc时 对象第一次尝试自救
        System.gc();
        // 因为finalizer线程的低优先级, 需要休眠一会。
        // JVM会先判断是否有必要执行finalizer方法, 并执行相应的finalize()方法
        Thread.sleep(1_000);

        if (null != REACHABILITY_ANALYSIS) {
            REACHABILITY_ANALYSIS.isAlive();
        } else {
            System.out.println("i'm dead ...");
        }

        // 第二次自救 用于判断是否会执行finalize方法两次
        REACHABILITY_ANALYSIS = null;
        System.gc();
        Thread.sleep(1_000);
        if (null != REACHABILITY_ANALYSIS) {
            REACHABILITY_ANALYSIS.isAlive();
        } else {
            System.out.println("i'm dead ...");
        }
        // 结论: 任何对象的finalize()方法只会被系统调用一次
    }
}
```

> 对象`finalize`方法只会被JVM调用一次，只要执行`finalize`方法重新与`引用链`建立联系，就不会被清理。不建议使用`finalize进行释放资源`，因为可能发生引用外泄，无意中复活对象。并且finalize调用时间不确定，相比之下更推荐`finally释放资源`。

---

### 垃圾回收算法

#### 标记清除法(Mark-Sweep)

包含`标记阶段`和`清除阶段`。标记阶段通过`可达性算法`标记分析可达对象，清除阶段会清除所有`未被标记的对象`。
此方法会`产生空间碎片`。并且回收后的空间是`不连续`的，会导致工作效率低于连续空间。该算法更关注垃圾回收器的`耗时`操作。

#### 复制算法(Copying)

将`内存空间分为两份`，在进行垃圾回收时，将正在使用的那一份`内存中的活对象`复制到另一份内存中，之后`清除正在使用的内存块中的所有对象`，交换两个内存的角色，完成垃圾回收。
相对于`标记清除算法`，`复制算法`不会产生空间碎片，但会导致使用的`内存只有一半`。

> `新生代串行垃圾回收器`使用了该算法，它将新生代分为`eden、from(s0)、to(s1)`三个区域，GC在回收对象时，会先将`eden & s0`区域的对象复制到`s1(大对象、老年对象、s1区域满时对象会直接进入老年代)`，然后清空`eden & s0`区域，再将`s0 & s1互换`，保证`s1永远为空`。

#### 标记压缩算法(Mark-Compact)

在标记阶段，使用`可达性算法`对所有可达对象进行标记。在清除阶段，将所有的存活对象压缩到内存的一端，然后清除边界外的所有空间。相比之前的算法，避免了`内存碎片`的产生且不需要`内存折半`，但是移动大对象会给系统带来较长时间的`STW`。该算法更关注垃圾回收器的`吞吐量`操作。

> STW：垃圾回收器工作时，Java程序需要暂停工作，等待垃圾回收完成，这种现象叫做`Stop The World`。

#### 分代算法(Generational Collecting)

基于两个分代假说之上：

> 弱分代假说：绝大多数的对象都是朝生夕灭的。
>
> 强分代假说：熬过多次垃圾回收的对象就越难以消亡。

奠定了垃圾收集器的一致设计原则：`收集器应将Java堆分成不同的区域，然后将回收对象依据其年龄(对象熬过垃圾回收的次数)分配到不同的区域中存储`。

但因为对象会存在`跨代引用`，即`新生代对象完全可能被老年代对象引用`，因此除了必要的可达性分析外，还需要`遍历老年代对象`来保证所有对象可达性分析结果的准确性。基于此理论提出了`跨代引用假说：`

> 跨代引用相对于同代引用来说仅占极少部分。

并基于此假说采用了如下设计：在新生代上建立一个全局数据结构`记忆集(Remembered Set)`，该结构将老年代划成若干小块，标识出老年代哪一块内存会存在跨代引用，当发生新生代垃圾回收时，会对记忆集中的记录加入`GC Roots`进行扫描，相比扫描整个老年代来说大大的减少了运行时开销。

#### 分区算法(Region)

`分区算法将整个堆空间分成连续的不同小区间，每个小区间都独立使用，独立回收`。控制一次回收小区间的数量，能够有效减少GC产生的停顿。

![](https://image.leejay.top/image/20200814/jQj1OYkGDUEJ.png?imageslim)

> 分区回收算法带来的跨代引用问题：
>
> 因为对象会存在`新生代、老年代间的跨代引用问题`，垃圾收集器建立了名为`记忆集(Remember Set)`的数据结构，用于`记录非收集区域指向收集区域的指针集合`的抽象数据结构。继而`避免对整个老年代进行扫描`。
>
> `卡表(Card Table)`是最常见的实现`记忆集`结构的方式。可以是`字节数组`或`哈希表`，存储的是`跨代引用的对象的内存地址`，这样只需要筛选出跨代引用的对象，将其加入GC Roots中一起扫描即可。