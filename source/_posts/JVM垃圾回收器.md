---
title: JVM垃圾回收器
toc: true
date: 2020-01-06 13:30:37
tags: Java
categories:
  - Jvm
thumbnail: http://image.leejay.top/image/20200106/RjsYCSRlxKf7.jpg
---

## 垃圾回收器种类
---
### 串行回收器
- 概念
&emsp;`指使用单线程进行垃圾回收的回收器，每次回收时只有一个工作线程(-client模式下的默认回收器)。包括新生代串行回收器和老年代串行回收器。`

- 特点
1. 使用单线程进行回收。
2. 独占式的垃圾回收方式(会导致STW)

>STW: 垃圾回收器工作时，Java程序需要暂停工作，等待垃圾回收完成，这种现象叫做stop the world。
<!--more-->
- 参数

``` java
-XX:+UseSerialGC 新生代&老年代使用串行垃圾回收器
-XX:+UseParNewGC* 新生代使用parNew回收器 老年代使用串行回收器
-XX:+UseParallelGC 新生代使用parallel回收器 老年代使用串行回收器
```
> *修饰的参数表示JDK9,10已经删除的参数

---

### 并行回收器
- 概念
&emsp;`使用多个线程同时进行垃圾回收，对于采用多核cpu的计算器，可以有效减少GC所需时间。包括新生代ParNew回收器、新生代Parallel回收器、老年代Parallel回收器。`

- 特点
1. 使用多线程进行回收(简单的将串行回收器多线程化)。
2. 独占式垃圾回收方式。

- 参数
```java
新生代ParNew回收器:
-XX:+UseParNewGC* 新生代使用ParNew回收器 老年代使用串行回收器
-XX:+UseConcMarkSweepGC* 新生代使用ParNew回收器 老年代使用CMS
-XX:ParallelGCThreads 指定并行回收器的线程数量。默认情况小于8时: 参数值等于cpu cores; 大于8时 3+((5 * cpu_cors))/8)

新生代Parallel回收器(相比ParNew 更注重系统的吞吐量):
-XX:+UseParallelGC 新生代使用Parallel回收器 老年代使用串行回收器
-XX:+UseParallelOldGC 新生代使用Parallel回收器 老年代使用ParallelOldGC回收器
-XX:MaxGCPauseMillis 最大垃圾回收停顿时间 值是一个大于0的整数 ParallelGC在工作时会调整Java堆大小或者其他参数将值控制在该参数范围内。如果该值设置的比较小，那么虚拟机会使用较小的堆(小堆回收快于大堆)，导致回收的很频繁，从而增加回收总时间，降低吞吐量。
-XX:GCTimeRatio 设置吞吐量大小  100 > 值: n > 0 系统将花费不超过 1/(1+n)的时间进行回收 假设n=99，那么不超过1%时间进行回收。
-XX:UseAdaptiveSizePolicy 自适应GC策略。自动调整新生代大小、eden和survivor比例 晋升老年代的对象年龄等

老年代ParallelOldGC回收器(特点与新生代ParallelGC相同，只是作用于老年代):
-XX:+UseParallelOldGC 新生代使用Parallel回收器 老年代使用ParallelOldGC回收器
-XX:ParallelGCThreads 和上文一致 用于设置垃圾回收时线程数量
```
---

### CMS回收器
- 概念
&emsp;`比并行回收器，CMS(Concurrent Mark Sweep，并发标记清除)主要关注系统停顿时间，也是多线程并发回收器。JDK8及以前版本，针对老年代区域。`

- 回收流程

<img src="http://image.leejay.top/image/20200106/U54AFrOkVbBp.png">
> 1. CMS严格来说不是独占式的，只是在`初始标记和重新标记`的时候STW，其他时候是和程序一起执行的。
> 2. 新生成的垃圾在CMS回收过程中是无法清除的(非STW)，所以CMS不会等内存饱和才会进行垃圾回收，而是但内存达到某一阈值便开始回收。`-XX:CMSInitiatingOccupancyFraction`指定阈值(默认是68)。意为老年代空间使用率到达68%就执行一次CMS回收。如果CMS回收过程中出现内存不足，那么CMS就会失败，`改为采用老年代串行回收器`进行垃圾回收(程序完全中断)，这种情况会导致程序停顿时间较长
> 3. 因为`标记清除导致的内存碎片`，CMS提供两个内存压缩的参数，用于减少内存碎片的问题。

- 参数

``` java
-XX:+UseConcMarkSweep 启动CMS回收器 默认启动并发线程数(ParallelGCThreads + 3)/4 向下取整 (4+3)/4 => 1
-XX:ConcGCThreads 设置CMS并发线程数量
-XX:ParallelCMSThreads 设置CMS并发线程数量
-XX:CMSInitiatingOccupancyFraction 默认68 老年代空间使用率到达68%就执行一次CMS回收
-XX:+UseCMSCompactAtFullCollection CMS在垃圾回收完成后进行一次内存碎片整理(STW)
-XX:CMSFullGCBeforeCompaction 设置进行多少次CMS回收后进行一次内存压缩
```

---

### G1回收器
- 概念
&emsp;`属于分代垃圾回收器(不同代使用不同算法)，采用分区算法(内存区域分成许多一小块)。作用于新生代和老年代。JDK9及以后的默认垃圾回收器。`

- 特点
 1. 并行性: G1回收期间，可以由多个GC线程同时工作，有效提升多核计算能力。
 2. 并发性: 部分工作可以与程序交替执行，不会完全阻塞程序。
 3. 分代GC: G1工作同时兼顾新生代和老年代，之前的回收器要么在新生代，要么在老年代。
 4. 空间整理: G1在回收过程中会进行适当的对象移动，每次回收都会有效复制对象，减少碎片空间。
 5. 可预见性: 由于`分区`的原因，G1可以只选取部分区域进行内存回收，缩小回收范围，有效控制全局停顿。

- 回收流程

<img src="http://image.leejay.top/image/20200106/zvMyin5vwbvo.png">

- 参数

``` java
-XX:+UseG1GC 使用G1垃圾回收器
-XX:MaxGCPauseMillis 执行程序最大停顿时间 值越小越回收越频繁。G1会尝试修改相关参数满足此设置
-XX:ParallelGCThreads: 并行回收线程数量
-XX:InitiatingHeapOccupancyPercent 指定整个堆使用率达到多少触发并发周期标识的执行。默认是45，一旦确定不会被G1修改
```

---
### 细节问题
#### System.gc()
&emsp;默认情况会触发Full GC，可以通过`-XX:+DisableExplicitGC`来关闭该函数，在CMS或G1垃圾回收器下调用System.gc()还是会使用传统的Full GC来回收，需要使用`-XX:ExplicitGCInvokesConcurrent`来关闭。

#### 并行GC前的新生代GC
&emsp;并行回收器的默认情况下我们调用System.gc()，控制台会打印两行回收记录，一行是新生代GC，一行是Full GC。这样的好处是`减少Full gc回收的停顿时间，使用参数-XX:ScavengeBeforeFullGC去除新生代GC。`

#### 对象何时进入老年代
&emsp;一般来说初创对象默认分配在eden区，当对象年龄达到一定大小就会`晋升`到老年代，新生代中的对象没经历一次GC，如果它没被回收年龄就+1。虚拟机提供参数`-XX:MaxTenuringThreshold=15`: 新生代`最多`经历15次GC，就会晋升到老年代。但并非到了15次，对象才会晋升，有可能没到就会晋升，取决于另一个参数: `-XX:TargetSurvivorRatio` survivor区的目标使用率，默认50，即如果survivor区的在gc后的使用率超过50% 即有可能选择较小的age作为晋升年龄。

#### 大对象进入老年代
&emsp;如果对象的体积过大，那么也是有可能直接进入老年代，通过参数`-XX:PretenureSizeThreshold=0` 0表示不限制 单位是byte。超过这个大小的对象直接进入老年代 但是`只对串行和ParNew有效,对Parallel无效。`

#### TLAB
&emsp;TLAB的全称是Thread Local Allocation Buffer(本地线程缓冲)。为什么需要TLAB，目的是为了加速对象分配，由于对象一般分配在堆中，而堆是一块线程共享的区域，在同一时间可能有多个线程在堆上申请空间，所以每次分配都需要同步(`默认虚拟机是采用CAS加超时重试机制`)，所以虚拟机使用TLAB这种线程专属的区域来避免多线程冲突。默认TLAB是启动的: `-XX:-UseTLAB 关闭TLAB`。

> 1. TLAB区域不会太大，所以大对象无法在TLAB区域分配
> 2. 假设TLAB空间有100kb，如果第一次分配了80kb，还剩20kb，第二次分配30kb的对象，那么此时虚拟机有两种选择: 要么废弃这20kb的空间，废弃这块TLAB区域。要么将30kb的对象分配在堆上，保留当前TLAB区域，等下次有小于20kb的对象分配时使用这块空间。
使用`-XX:TLABRefillWasteFraction=64(默认)`设置一个refill_waste的值，当请求对象大小大于此值时，会在堆中分配。小于此值就废弃当前TLAB区域，新建一个TLAB区域存放。
默认情况下，refill_waste和TLAB的大小是动态调整的，使用`-XX:-ResizeTLAB`禁用ResizeTLAB大小，使用`-XX:TLABSize=102400 `指定默认TLAB大小(单位byte)。`-XX:+PrintTLAB`打印TLAB的日志
> 3. 在对象分配流程中，需要经历 尝试栈上分配 -> 尝试TLAB分配 -> 是否直接进入老年代 -> 堆中分配。

#### finalize对垃圾回收的影响
&emsp;finalize函数是由JVM启动的低优先级的Finalizer线程处理的。实现finalize函数的对象加入到`ReferenceQueue<Finalizer>引用队列`中等待处理。原本等待处理的对象因为队列中Finalizer的引用变成`强引用的可达对象`，不会被垃圾回收器正常回收(需要等执行完finalize方法)，一旦Finalizer线程因为性能原因发生阻塞堆积在内存中，容易导致OOM。

---