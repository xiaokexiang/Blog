---
title: JVM垃圾回收概念与算法
toc: true
date: 2020-01-05 10:40:01
tags: Java
categories:
  - Jvm
thumbnail: http://image.leejay.top/image/20200108/Eq5nGrMthDun.jpg
---
## JVM 垃圾回收

### 垃圾回收概念
  1. 什么是垃圾? 特指在内存中、不会再被使用的对象。
  2. 什么是垃圾回收? "回收"相当于把垃圾"倒掉"，这样内存中就会有区域被腾出来。
  3. 为什么要回收? 如果不及时对内存中的垃圾进行清理，这些垃圾对象所占的空间一直保留到应用程序结束，会导致被保留的空间无法被其他对象使用，从而导致OOM。
---
<!-- more -->

### 垃圾回收算法

- 引用计数法(Reference Counting)
  `对于一个对象A，只要有一个对象引用了A，那么A的计数器增加1，当引用失效的时候就减1`

  缺点: a. 无法解决循环引用，A引用B，B引用A，没有其他对象引用他们，那么会导致内存泄漏。 b. 在每次引用产生和消除的时候，伴随加法和减法的操作，对系统性能有影响。

- 标记清除法(Mark-Sweep)
  `分为`标记阶段`和`清除阶段`。在标记阶段，首先通过根节点标记所有从根节点开始的可达对象，未被标记的对象就是未被引用的垃圾对象。在清除阶段，清除所有未被标记的对象。`
  缺点:产生空间碎片。因为回收后的空间是不连续的，工作效率低于连续空间

- 复制算法(Copying)
  `将原有的内存空间分为两块，每次只使用其中一块，在进行垃圾回收时，将正在使用的内存中的活对象复制到未使用的内存块中，之后清除正在使用的内存块中的所有对象，交换两个内存的角色，完成垃圾回收。`
  优点: a. 通常新生代垃圾对象多余存活对象，所以使用复制算法效率高 b. 回收后的内存空间是没有碎片的
  缺点: 内存折半
  &emsp;`新生代串行垃圾回收器使用了该算法`: 分为eden、from(s0)和to(s1)，其流程: eden区和s0区的存活对象会被复制到s1区(如果是大对象或老年对象会直接进入老年代，如果s1区满了，对象也会进入老年代)，然后清空eden和s0区，然后将s0和s1区互相调换，保证s1永远是空的。

- 标记压缩算法(Mark-Compact)
  `从根节点开始，对所有可达对象做一次标记。在清除阶段，将所有的存活对象压缩到内存的一端，然后清除边界外的所有空间`
  优点: 避免了内存碎片的产生，不需要两块空间，效率高，是老年代的回收算法

- 分代算法(Generational Collecting)
  `它将内存区间根据对象的特点分成几块，根据每块内存区间的特点使用不同的回收算法，以提高回收的效率`
  &emsp;为了支持高频率的新生代回收，虚拟机可能使用一种叫做`卡表(Card table)`的数据结构。卡表为一个比特位集合，每一个比特位可以表示老年代的某个区域的所有对象是否持有新生代对象的引用，<font style="color: red">卡表位为0表示老年代区域没有任何对象指向新生代，为1表示老年代对象有指向新生代的应用。</font>在新生代GC的时候只需要扫描卡表位为1的老年代空间，有效提高回收效率。

- 分区算法(Region)
  `分区算法将整个堆空间分成连续的不同小区间，每个小区间都独立使用，独立回收`。优点: 控制一次回收小区间的数量，能够有效减少GC产生的停顿

- 主要垃圾回收算法图解

<img src="http://image.leejay.top/image/20191227/BXWEjuMyee3Q.png">

---

### 判断可触及性
`JVM通过不同的算法回收垃圾对象，那么JVM是如何判断对象是需要回收的呢？这里使用到的就是`***可达性分析算法***`，用于判断对象的可触性。`

> 可达性算法：通过一系列称为`GC Roots`的对象作为起点，从这个起点开始往下搜索，搜索走过的路径成为引用链`Reference Chain`，当一个对象到GC Roots没有任何引用链时，则证明此对象不可用。<br/>
> 可作为GC Roots的对象包括: `虚拟机栈中引用的对象、方法区中类静态属性引用的对象、方法区中常量引用的对象和本地方法栈中的native引用的对象。`

#### 对象回收流程

  &emsp;在GC对对象A进行回收的时候，会先判断是否有`引用链`从GC Root指向对象A，如果有那么不需要进行回收。如果没有那么继续进行判断：如果<font color="red">对象A复写了finalize()方法且JVM之前没有调用过对象A的finalize()方法</font>，那么JVM就会将对象A放置到一个名叫`F-Queue`的队列中，稍后由JVM启动一个低优先级的Finalizer线程去执行对象A的finalize()方法，而此时对象A的finalize()是最后一次能够拯救对象A的途径，只需要在finalize()方法中`对象A重新与引用链建立联系即可`，否则对象A将被GC清理。
  <div style="text-align: center;" ><img border=1 src="http://image.leejay.top/image/20191227/6r25VFXqrL2q.png"/></div>
  > 可触性包含三种状态：
  > 1. 可触及的：从根节点开始，可以到达的这个对象。
  > 2. 可复活的：对象无引用链可达，但是对象可能在finalize()中复活。
  > 3. 不可触及的：对象的finalize()被调用后，对象没有复活，此时对象处于不可触及状态。此对象肯定不会复活，因为<font color="red">finazlie()只会被JVM调用一次。</font>

  下面通过代码来演示对象的复活与清理

  ``` java
  public class ReachabilityAnalysis {
      /**
       * 创建GC Root
       */
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
          REACHABILITY_ANALYSIS = new ReachabilityAnalysis();

          // 去除引用链的联系, 便于测试
          REACHABILITY_ANALYSIS = null;
          // 调用gc时 对象第一次尝试自救
          System.gc();
          // 因为finalizer线程的低优先级, 需要休眠一会。JVM会先判断是否有必要执行finalizer方法, 并执行相应的finalize()方法
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
  > 1. 不建议使用finalize()进行释放资源，因为可能发生引用外泄，无意中复活对象。
  > 2. finalize()调用时间不确定，相比之下更推荐finally释放资源。

#### 引用和可触及性强度
  
  `Java中提供了四个级别的引用：强引用(Strong Reference)、软引用(Soft Reference)、弱引用(Weak Reference)和虚引用(Phantom Reference)。除了强引用不会被回收，其他的引用在一定条件下都会被回收。`
  
  - 强引用
  
  ``` java
  private void strong() {
    StringBuffer str = new StringBuffer("Hello World");
    StringBuffer str2 = str;
  }
  ```
  上面代码中局部变量str被分配在栈上，StringBuffer实例被分配在堆上，`str是StringBuffer实例的强引用`。
  str所指向的对象也被str2所指向，所以栈上也会分配空间存放str2变量，所以`StringBuffer实例就有两个强引用`

  > 强引用特点:
  > 1. 强引用可以直接访问目标对象。
  > 2. 强引用所指向的对象在任何时候都不会被系统回收。
  > 3. 强引用可能导致内存泄漏。

  - 软引用
  `比强引用弱一点的引用类型。如果一个对象只持有软引用，那么当堆空间不足的时候就会被回收。`

  ``` java
  class SoftRef {

    @Data
    @AllArgsConstructor
    private static class User {
        private int id;
        private String name;
    }

    public static void main(String[] args) {
        // 创建User实例
        User user = new User(1, "lucy");
        // 构建引用队列，当对象不可达后就会加入到该队列
        ReferenceQueue<User> referenceQueue = new ReferenceQueue<>();
        // 通过强引用user对象创建软引用
        SoftReference<User> softReference = new SoftReference<>(user, referenceQueue);
        // 将软引用对象置为null
        user = null;
        // 获取软引用对象user
        System.out.println(softReference.get()); // SoftRef.User(id=1, name=lucy)
        System.gc();
        System.out.println("After gc ...");
        // 查看对象user还在不在
        System.out.println(softReference.get()); // SoftRef.User(id=1, name=lucy)

        byte[] bytes = new byte[1024 * 925 * 5];
        // 可有可无 因为在分配大数据的时候系统自动GC
        System.gc();
        // 查看软引用中的user对象还在不在
        System.out.println(softReference.get()); // null
        // 获取队列的第一个元素
        System.out.println(referenceQueue.poll()); // java.lang.ref.SoftReference@01219861
    }
  }
  ```
  > 1. 软引用常用于内存不足的情况：当JVM内存不足的时候会将软引用中的对象置为null，然后通知JVM回收。
  > 2. SoftReference更像是个缓存，当内存足够的时候就从软引用中获取数据，内存不够的时候(JVM已回收软引用的对象)就再次构建软引用，有效减少没必要的对象创建。

  - 弱引用(Weak Reference)
  `弱引用是比软引用弱的引用类型。在系统GC的时候，只要发现弱引用，不管堆情况如何，都会对对象进行回收。`但是GC回收器线程通常优先级较低，不一定很快能发现持有弱引用的对象

  ```java
  class WeakRef {
    public static void main(String[] args) {
        User lee = new User(2, "lee");
        ReferenceQueue<User> referenceQueue = new ReferenceQueue<>();
        WeakReference<User> userWeakReference = new WeakReference<>(lee, referenceQueue);
        lee = null;
        System.out.println(userWeakReference.get());// User(id=2, name=lee)
        System.gc();
        System.out.println(userWeakReference.get());// null
        System.out.println(referenceQueue.poll()); // java.lang.ref.WeakReference@51016012
    }
  }
  ```
  > 和软引用一样，弱引用也适合保存可有可无的缓存数据，当系统内存不足的时候会被回收，内存充足的时候，缓存数据存在相当长的时间，达到让系统加速的作用。

  - 虚引用(Phantom Reference)
  `虚引用是所有引用类型中最弱的一个。一个持有虚引用的对象和没有引用是一样的，随时都可能被垃圾回收器回收。虚引用存在的目的就是所引用的对象在被回收之前得到通知。`
  
  ``` java
  class PhantomRef {
    public static void main(String[] args) {
        User none = new User(3, "none");
        // 与其他引用不同的一点是 虚引用必须传入一个引用队列
        ReferenceQueue<User> referenceQueue = new ReferenceQueue<>();
        PhantomReference<User> userPhantomReference = new PhantomReference<>(none, referenceQueue);
        none = null;
        // 无时无刻都是null
        System.out.println(userPhantomReference.get());
        System.gc();
        System.out.println(referenceQueue.poll());
    }
  }
  ```
  > 当GC准备回收一个对象时发现它还有虚引用，就会在回收对象之前，将这个虚引用加入到与之关联的引用队列中去，这样就可以在引用对象回收之前得到通知(判断队列是否为空)