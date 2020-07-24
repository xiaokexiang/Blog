---
title: "volatile"
date: 2020-06-08T11:13:38+08:00
description: "Java中volatile关键字的原理与作用。"
tags: ["volatile ","内存可见性"]
categories: [
  "Concurrent"
]
hideReadMore: true
---

### 作用

volatile保证了内存的可见性，对于共享变量操作会直接从共享内存中读取，修改时会直接将结果刷入共享内存，其次`禁止了volatile修饰的变量和非volatile变量之间的重排序`。

### 原理

  为了禁止编译器重排序和CPU重排序，底层原理是通过`内存屏障`指令来实现的。

##### 编译器内存屏障

只是为了告诉编译器不要对指令进行重排序，但编译完成后，这种内存屏障就消失了，CPU不会感知到编译器中内存屏障的存在。

##### CPU内存屏障

由CPU提供的指令(不同的CPU架构，提供的指令不同)，可以由开发者显示调用，volatile就是通过CPU内存屏障指令来实现的。

实现流程：

- 在volatile写操作的前面插入一个`StoreStore屏障`。保证volatile写操作不会和之前的写操作重排序。
- 在volatile写操作的后面插入一个`StoreLoad屏障`。保证`volatile写操作不会和之后读操作`重排序。
- 在volatile读操作后面插入一个`LoadLoad`屏障 + `LoadStore`屏障。保证`volatile读操作不会和之前的读操作、写操作`重排序。

### 与synchronized关键字的异同

  多线程会产生三大问题：原子性、有序性和可见性。

  synchronized和volatile在共享变量的操作上具有相同的内存语义(`从主内存读取，立即写入主内存`)，保证了变量的可见性。但是synchronized相比volatile还具有`原子性(阻塞和排他性，同一时刻只能有一个线程执行，而volatile是非阻塞的)`，所以`volatile是弱化版的synchronized`。

  ```java
  class Test {
      // 这里的flag就可以不用锁同步
      private static volatile boolean flag = true;
      // 模拟AtomicInteger
      private static CasUnsafe UNSAFE = new CasUnsafe(0);
      
      // 按照顺序打印1-100的奇偶数
      public static void main(String[] args) {
          THREAD_POOL.execute(() -> {
              while (UNSAFE.getValue() < 100) {
                  if (flag) {
                      System.out.println(UNSAFE.incrementAndGet());
                      flag = false;
                  }
              }
          });
          THREAD_POOL.execute(() -> {
              while (UNSAFE.getValue() < 100) {
                  if (!flag) {
                      System.out.println(UNSAFE.incrementAndGet());
                      flag = true;
                  }
              }
          });
          THREAD_POOL.shutdown();
      }
  }
  ```

  > Q：什么时候用volatile而可以不用synchronized？
  >
  > A：如果`写入变量值不依赖变量当前值(count++就是依赖当前值，先去内存读取值，然后将当前值+1，将计算后的值赋给count。比如)`，那么就可以用volatile。

### DCL(Double Check Lock)

  `双重检查加锁问题简称DCL`，用于懒汉式单例的一种写法，问题如下所示：

  ```java
  public class DoubleCheckSingleton {
  
      /**
       * 为什么这个地方要使用volatile修饰?
       *
       * 首先我们需要了解JVM是存在`编译器优化重排`功能的(编译器在不改变单线程语义情况下，重新安      * 排代码的执行顺序。但是不保证多线程情况)
       * 执行如下代码
       * singleton = new DoubleCheckSingleton();
       * 在JVM是分成三步的：
       * 1. 开辟空间分配内存
       * 2. 初始化对象
       * 3. 将singleton引用指向分配的内存地址
       *
       * 在不使用volatile时，可能被JVM优化成
       * 1. 开辟空间分配内存
       * 3. 将singleton引用指向分配的内存地址
       * 2. 初始化对象
       *
       * 那么当线程A执行1&3步的时候，线程B获取了CPU执行权，去验证`null == singleton`，
       * 发现不为null，直接返回一个未初始化完成的singleton，导致程序出错。
       *
       * volatile禁止被修饰变量的 编译器重排序 和 处理器重排序(内存屏障) （JDK1.5后）
       *
       */
      private static volatile DoubleCheckSingleton singleton;
  
      private DoubleCheckSingleton() {
      }
  
      public static DoubleCheckSingleton getInstance() {
          // 不是任何线程进来都尝试去获取锁，而是先判断singleton是否为null，优化性能
          if (null == singleton) {
              // 尝试去获取锁，保证线程安全
              synchronized (DoubleCheckSingleton.class) {
                  // 获取锁后判断singleton是否为null
                  if (null == singleton) {
                      singleton = new DoubleCheckSingleton();
                  }
              }
          }
          return singleton;
      }
  }
  
  ```