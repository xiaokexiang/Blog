---
title: "BlockingDeque双端阻塞队列源码浅析"
date: 2020-07-06T19:20:56+08:00
description: "基于ReentrantLock、Condition实现的`双端阻塞队列`，支持在队首和队尾获取/添加数据。"
tags: ["BlockingDeque "]
categories: [
  "Concurrent",
  "Queue"
]
hideReadMore: true
slug: concurrent_blocking_deque
---

### BlockingDeque
`双端队列，支持在队列的头尾出增加或获取数据`，`Deque`接口中定义了相关的方法

```java
public interface Deque<E> extends Queue<E> {
    // 添加到队首
    void addFirst(E e);
    // 添加到队尾
    void addLast(E e);
    // 获取队首
    boolean offerFirst(E e);
    // 获取队尾
    boolean offerLast(E e);
	...
}	
```

> 相比`BlockingQueue的父接口Queue`，`Deque`中定义了头尾操作数据的方法。


```java
public interface BlockingDeque<E> extends BlockingQueue<E>, Deque<E> {
    void putFirst(E e) throws InterruptedException;
    void putLast(E e) throws InterruptedException;
    E takeFirst() throws InterruptedException;
    E takeLast() throws InterruptedException;
   ...
}
```

> `BlockingQueue`继承了`BlockingQueue`和`Deque`接口。添加了一些抛出中断的方法。

---

### LinkedBlockingDeque

我们以`LinkedBlockingDeque`为切入点了解`双端队列`的实现。

#### 构造

```java
public class LinkedBlockingDeque<E>
    extends AbstractQueue<E>
    implements BlockingDeque<E>, java.io.Serializable {
    // 内部维护的静态内部类是双向节点
	static final class Node<E> {
        E item;
        Node<E> prev;// 区别
        Node<E> next;
        Node(E x) {
            item = x;
        }
    }
    // (first == null && last == null) || 
    // (first.prev == null && first.item != null) 规则不变
	transient Node<E> first;
    // (first == null && last == null) ||
    // (last.next == null && last.item != null) 规则不变
    transient Node<E> last;
    private transient int count;
    private final int capacity;
    // 内部仍是一把锁 两个条件队列
    final ReentrantLock lock = new ReentrantLock();
    // 等待获取 条件队列
    private final Condition notEmpty = lock.newCondition();
    // 等待添加  条件队列
    private final Condition notFull = lock.newCondition();
    public LinkedBlockingDeque() {
        this(Integer.MAX_VALUE);
    }
    public LinkedBlockingDeque(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException();
        this.capacity = capacity;
    }
}
```

> 与`LinkedBlockingQueue`构造区别：
>
> 1. `内部维护是双链表节点，拥有prev和next指针`。
> 2. 队列初始化后，first和last节点的item != null，

---

### 添加

#### putFirst

```java
// 添加元素到队首，队列满就阻塞等待
public void putFirst(E e) throws InterruptedException {
    // 判断是否为null
    if (e == null) throw new NullPointerException();
    // 封装节点
    Node<E> node = new Node<E>(e);
    final ReentrantLock lock = this.lock;
    // 这里是lock不是lockInterruptibly
    lock.lock();
    try {
        // 如果队列满返回false
        while (!linkFirst(node))
            // 将线程加入 等待添加条件队列
            notFull.await();
    } finally {
        lock.unlock();
    }
}
// 将元素添加到队首，队列满返回false
private boolean linkFirst(Node<E> node) {
    // 队列满返回false
    if (count >= capacity)
        return false;
    // 获取first节点
    Node<E> f = first;
    // 将当前节点的next指向first
    node.next = f;
    // 将node设为first
    first = node;
    // 如果last=null，说明当前是第一个加入队列的节点
    if (last == null)
        // first = last = Node(prev=null, next=null, item != null)
        last = node;
    else
        // last != null 维护 node和first的prev和next，不处理last
        f.prev = node;
    // 队列大小+1
    ++count;
    // 唤醒等待获取条件队列中的线程
    notEmpty.signal();
    // 返回true
    return true;
}
```

> 1. 将元素添加到队首，如果队列满，`阻塞`等待直到将元素添加到队列中。
> 2. 当添加节点是队列中的第一个节点时，`first = last = Node(prev = next = null, item != null)`，之后`linkFirst`就只会维护node和fist之间的关系，不会维护last节点。

#### putLast

```java
// 将元素添加到队尾
public void putLast(E e) throws InterruptedException {
    // 判断NPE
    if (e == null) throw new NullPointerException();
    // 创建节点
    Node<E> node = new Node<E>(e);
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 将元素加入队尾，如果队列满返回false
        while (!linkLast(node))
            // 将线程加入 等待添加条件队列
            notFull.await();
    } finally {
        lock.unlock();
    }
}
// 将元素添加到队尾，队列满返回false
private boolean linkLast(Node<E> node) {
    // 如果队列满返回false
    if (count >= capacity)
        return false;
    // 获取last节点
    Node<E> l = last;
    // 将node的前驱设为last
    node.prev = l;
    // 将node设为last
    last = node;
    // 同理，说明当前节点第一个加入队列的节点
    if (first == null)
        // first = last = node(prev=null, last=null, item!=null)
        first = node;
    else
        // 不是第一个加入队列的节点，维护last和node之间的关系
        l.next = node;
    // 将队列数量加1
    ++count;
    // 唤醒 等待获取条件队列线程
    notEmpty.signal();
    return true;
}
```

> 1. 将元素添加到队尾，如果队列满，`阻塞`等待直到将元素添加到队列中。
> 2. 和`putFirst`同理，第一个加入队列的节点需要特殊处理下，`linkLast`只会维护node和last之间的关系，不会维护first节点。

### 获取

#### takeFirst

```java
// 获取队首元素
public E takeFirst() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    // 获取独占锁
    lock.lock();
    try {
        E x;
        // 队列为空返回false，就阻塞等待拿到头元素
        while ( (x = unlinkFirst()) == null)
            // 将线程加入 等待获取条件队列
            notEmpty.await();
        // 否则返回元素
        return x;
    } finally {
        lock.unlock();
    }
}
// 队列为空返回null，否则返回头节点并处理链表
private E unlinkFirst() {
    /// 若first = null，说明队列没有初始化，直接返回null
    Node<E> f = first;
    if (f == null)
        return null;
    // 获取first的next节点
    Node<E> n = f.next;
    // 获取next节点的item
    E item = f.item;
    // 将first.item = null
    f.item = null;
    // 去掉f的引用，便于GC
    f.next = f;
    // 将next节点设为first节点
    first = n;
    // 成立条件：1. 队列刚初始化还没有节点进入 2. 节点被清空了。
    // 两个条件都需要处理下last节点
    if (n == null)
        // first = last = null
        last = null;
    else
        // 如果队列中还有其他元素，不处理last，将first.prev=null
        n.prev = null;
    // 将队列大小-1
    --count;
    // 唤醒等待添加队列中线程
    notFull.signal();
    return item;
}
```

> 1. takeFirst会获取队首元素，当队列为空时，`阻塞`等待直到队列不为空获取到元素。
> 2. 获取队首元素的同时，会删除原来的first的节点。如果`删除后队列没有其他节点或队列刚初始化`，都需要处理last节点。否则只需要维护first节点，不用处理last节点。

#### takeLast

```java
public E takeLast() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        E x;
        // 队列为空返回null，会加入等待获取条件队列
        while ( (x = unlinkLast()) == null)
            notEmpty.await();
        return x;
    } finally {
        lock.unlock();
    }
}
// 队列为空返回null，否则返回last节点
private E unlinkLast() {
    // 如果last = null那么说明队列为空（或被清空了），返回null
    Node<E> l = last;
    if (l == null)
        return null;
    // 获取last的前驱节点
    Node<E> p = l.prev;
    // 获取前驱节点的item，并设为null
    E item = l.item;
    l.item = null;
    // 去除last节点引用，便于回收
    l.prev = l;
    // 前驱节点设为last
    last = p;
    // 和takeFirst一致，处理队列被清空或刚初始化时first节点
    if (p == null)
        first = null;
    else
        // 不需要处理first节点，维护node和last关系
        p.next = null;
    // 队列大小-1
    --count;
    // 唤醒 等待添加条件队列线程
    notFull.signal();
    return item;
}
```

> 1. takeLast会获取队尾元素，当队列为空时，`阻塞`等待直到队列不为空获取到元素。
> 2. 获取队尾元素的同时，会删除原来的last的节点。如果`删除后队列没有其他节点或队列刚初始化`，都需要处理first节点。否则只需要维护last节点，不用处理first节点。

### 总结

- 除了内部维护的是`双向链表队列、一把独占锁和两个条件队列`外，其实现原理和`LinkedBlockingQueue`相同。
- `LinkedBlockingDeque`无论操作队首还是队尾，都要考虑`队列内无节点`的情况。
- `LinkedBlockingDeque`中非空队列是不存在哨兵节点的，是`直接返回头或尾`，而`LinkedBlockingQueue`返回的是`头节点的next节点`。
- 因为`一把锁的设计，存在头尾操作都需要竞争锁`的问题，所以`LinkedBlockingDeque`效率要低于`LinkedBlockingQueue`。
