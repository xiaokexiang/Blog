---
title: Synchronized锁详解
date: 2019-07-18 15:22:08
tags: Java Concurrent
toc: true
categories:
  - Java Concurrent
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4mghnm1y2j30sg0lcaan.jpg
---

## synchronized 锁具体表现三种形式:

- 对于普通同步方法: 锁是当前的实例对象
- 对于静态同步方法: 锁是当前类 class 对象
- 对于同步代码块: 锁是括号中配置的对象

## 基于同步代码块的锁实现

- 通过 monitorenter 和 monitorexit 来实现
- 在代码块开始处添加 monitorenter,代码块结束和异常处添加 monitorexit
- 任何对象都有一个 monitor 与之关联,当一个 monitor 被持有之后,对象就会变成锁定状态
- 线程执行到 monitorenter 处,会尝试去获取该对象对应 monitor 的所有权(即对象的锁)
<!-- more -->
## java 对象头

- synchronized 所用的锁时存储在 java 对象头中
- java 对象头包括 Mark Word(存储对象的 hashCode 或锁信息), Class MetaData Address(存储到对象类型数据的指针)和 Array Length(数组长度如若当前对象是数组)
- Mark Word(分 32bit 和 64bit)在不同状态锁下的变化

  <img border="1" src="https://i.loli.net/2019/07/17/5d2edc4133a1d93211.png">

## 锁的升级与对比

### 锁的级别

_无锁状态 -> 偏向锁状态 -> 轻量锁状态 -> 重量锁状态_

### 偏向锁的获取和撤销流程:

- 线程 A 在获取锁时, `会查看对象头的 Mark Word 中的 ThreadID 是否与当前线程 ThreadID 一致`, 一致当前线程就会获取锁执行同步代码块. 如果不一致则会查看 Mark Word 中偏向锁的标识是否是 <font color="green">1(表明当前是偏向锁)</font>,是则会尝试使用`CAS`将对象头中的 ThreadID 替换为当前线程的 ThreadID, 如果`CAS`获取失败, 开始撤销偏向锁, 会在全局安全点时, 挂起持有偏向锁的线程, 如果还没退出同步代码块则`将偏向锁升级为轻量锁`, 若已退出同步代码块, 则会撤销偏向锁,然后唤醒原持有偏向锁的线程继续往下执行.

- <font color="green">偏向锁使用了一种等到竞争才会释放的锁的机制</font>,只有当其他线程尝试竞争偏向锁时,持有偏向锁的线程才会释放锁. 偏向锁的撤销,需要等待<font color="green">全局安全点(在这个时间点上没有正在执行的字节码)</font>, 会暂停拥有偏向锁的线程,其次检查持有偏向锁的线程是否还存活. 如果线程仍活着,拥有偏向锁的栈会被执行，遍历偏向对象的锁记录,栈中的锁记录和对象头的 Mark Word 要么`重新偏向于其他线程`,`要么恢复到无锁或者标记对象不适合作为偏向锁,然后唤醒暂停的线程.如果不处于活动状态,就会将对象头设置为无锁状态`.

    <div style="text-align: center;"><img border="1" style="width: 600px;" title="偏向锁的获取和撤销流程,來源: Java并发编程艺术" src="https://i.loli.net/2019/07/17/5d2ed459683b482153.png"></div>

  > 偏向锁`JDK1.6`之后默认延迟打开, 可以通过`-XX: BiasedLockingStartupDelay=0`来关闭延迟启动, 或使用 `-XX: -UseBiasedLocking=false`来关闭偏向锁,程序默认会进入轻量锁状态.

### 轻量锁获取与撤销流程:

- 在执行同步代码块之前,如果同步对象的状态是无锁状态, 那么 JVM 会在当前线程的栈帧中建立一个名为`锁记录(Lock Record)`的空间, 用于存储对象头中的 Mark Word 拷贝(官方称为 Displaced Mark Word)

- Mark Word 复制到锁记录中成功后, JVM 使用`CAS`尝试将对象头中的 Mark Word 更新为指向`Lock Record`的指针, 并将 Lock Record 中 owner 指针指向 Mark Word

    <div style="text-align: center;"><img border="1" style="width: 500px;" title="图片来源: https://www.cnblogs.com/paddix/p/5405678.html" src="https://i.loli.net/2019/07/17/5d2ee7449fe3281316.png"></div>

- 如果更新成功, 那么线程就拥有对象的锁, 并将对象头中的 Mark Word 锁标识位设置成 00, 如果更新操作失败, 当前线程尝试使用<font color="red">自旋</font>来获取锁

- 轻量锁解锁时, 会使用`CAS`操作将 Displaced Mark Word 替换回到对象头, 如果成功表示没有竞争发生, 如果失败,表示当前锁存在竞争, `轻量锁膨胀为重量锁, 锁标识位变成'10', Mark Word中存储的就是指向重量级锁的指针, 后面等待锁的线程也要进入阻塞状态`.

  > 自旋(spinlock): 是指当一个线程在获取锁的时候，如果锁已经被其它线程获取，那么该线程将循环等待，然后不断的判断锁是否能够被成功获取，直到获取到锁才会退出循环。

### 锁膨胀流程

- 一个对象刚开始实例化的时候,没有任何线程来访问它的时候, 它是可偏向的, 意味着它现在认为只可能有一个线程来访问它, 所以当第一个线程来访问它的时候，它会偏向这个线程, 此时对象持有偏向锁, 偏向第一个线程, <font color="green">这个线程在修改对象头成为偏向锁的时候使用 CAS 操作, 并将对象头中的 ThreadID 改成自己的 ThreadID, 之后再次访问这个对象时, 只需要对比 ThreadID, 不需要再使用 CAS 再进行操作.</font>

- 一旦有第二个线程访问这个对象, 因为偏向锁不会主动释放, 所以第二个线程可以看到对象时偏向状态, `这时表明在这个对象上已经存在竞争了`, 检查原来持有该对象锁的线程是否依然存活, 如果挂了则可以将对象变为无锁状态, 然后重新偏向新的线程, 如果原来的线程依然存活, 则马上执行那个线程的操作栈, 检查该对象的使用情况, `如果仍然需要持有偏向锁，则偏向锁升级为轻量级锁`. 如果不存在使用了, 则可以将对象回复成无锁状态, 然后重新偏向.

- 轻量级锁认为竞争存在, 但是竞争的程度很轻, 一般两个线程对于同一个锁的操作都会错开, 或者说稍微等待一下（自旋）, 另一个线程就会释放锁. 但是当自旋超过一定的次数, 或者一个线程在持有锁, 一个在自旋, 此时又有第三个来访时, `轻量级锁膨胀为重量级锁, 重量级锁使除了拥有锁的线程以外的线程都阻塞，防止 CPU 空转`.

> 来源：<a href="https://blog.csdn.net/choukekai/article/details/63688332">偏向锁，轻量级锁与重量级锁的区别与膨胀 - choukekai 的博客 - CSDN 博客</a>

  <img border="1" title="图片来源于网络" src="https://i.loli.net/2019/07/19/5d313105193a935506.jpg">

### 锁三种状态对比

  <img border="1" src="https://i.loli.net/2019/07/18/5d2fcf0a8cf5c57466.png">

> 来源: <a href="https://www.zhihu.com/question/53826114">java 偏向锁，轻量级锁与重量级锁为什么会相互膨胀?</a>
> 来源: <a href="https://www.processon.com/special/template/5c25db87e4b016324f447c95">偏向锁&轻量级锁获取流程</a>
