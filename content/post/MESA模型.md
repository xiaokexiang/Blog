---
title: "MESA模型"
date: 2020-06-06T22:45:30+08:00
description: "Java中`管理临界区资源`的管理策略。"
tags: ["MESA ","线程通信"]
categories: [
  "Concurrent"
]
hideReadMore: true
---

在解释MESA模型之前，我们需要了解什么是`管程：又称为监视器，它是描述并实现对共享变量的管理与操作，使其在多线程下能正确执行的一个管理策略。可以理解成临界区资源的管理策略。`MESA模型是管程的一种实现策略，Java使用的就是该策略。

#### 相关术语

- **enterQueue**：`管程的入口队列`，当线程在申请进入管程中发现管程已被占用，那么就会进入该队列并阻塞。
- **varQueue**：`条件变量等待队列`，在线程执行过程中(已进入管程)，条件变量不符合要求，线程被阻塞时会进入该队列。
- **condition variables**：条件变量，存在于管程中，一般由程序赋予意义，程序通过判断条件变量执行阻塞或唤醒操作。
- **阻塞和唤醒**：wait()和await()就是阻塞操作。notify()和notifyAll()就是唤醒操作。

#### 模型概念图

![](https://image.leejay.top/image/20200623/7fsvqebTy60R.png?imageslim)

>  Synchronized和Lock在MSEA监视器模型中的区别在于`前者只有一个条件变量，后者可以有多个`。

#### 执行流程

1. 多个线程进入`入口等待队列enterQueue`，JVM会保证只有一个线程能进入管程内部，Synchronized中进入管程的线程随机。
2. 进入管程后通过条件变量判断当前线程是否能执行操作，如果不能跳到step3，否则跳到step4。
3. 条件变量调用`阻塞`方法，将当前线程放入varQueue，等待其他线程唤醒，跳回step1。
4. 执行相应操作，执行完毕后调用notify/notifyAll等唤醒操作，唤醒对应varQueue中的一个或多个等待线程。
5. 被唤醒的线程会从varQueue放入enterQueue中，再次执行step1。
6. `被唤醒的线程不会立即执行，会被放入enterQueue，等待JVM下一次选择运行，而正在运行的线程会继续执行，直到程序执行完毕。`