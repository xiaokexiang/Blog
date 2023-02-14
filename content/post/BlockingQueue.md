---
title: "BlockingQueue单向阻塞队列源码解析"
date: 2020-07-04T20:38:54+08:00
description: "基于ReentrantLock、Condition实现的阻塞队列，是线程池实现的重要组成部分。"
tags: ["BlockingQueue "]
categories: [
  "Concurrent",
  "Queue"
]
hideReadMore: true
slug: concurrent_blocking_queue
---

### BlockingQueue

#### 概念

`BlockingQueue`带`阻塞`功能的`线程安全`队列，但队列已满时会阻塞添加者，当队列为空时会阻塞获取者。它本身是一个接口，具体的功能由它的实现类来完成。

![](https://image.leejay.top/image/20200707/w6jIy7hJTtxv.png?imageslim)

#### 接口方法

```java
public interface BlockingQueue<E> extends Queue<E> {
    // 添加元素到队列中返回boolean，队列满抛出异常
    boolean add(E e);
    // 添加元素到队列中，无返回值，抛出中断异常，队列满就阻塞
    void put(E e) throws InterruptedException;
    // 添加元素返回boolea 队列满就返回false，非阻塞
    boolean offer(E e);
    // 添加元素返回boolean，等待指定时间直到队列有空间可插入
    boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException;
	// 从队首获取元素并删除，阻塞，支持等待时中断异常
    E take() throws InterruptedException;
	// 获取队首元素并删除，若无元素等待执行时长，时间到还没有就返回null
    E poll(long timeout, TimeUnit unit) 
        					throws InterruptedException;
    // 返回理想状态下队列不阻塞可加入的元素数量，如果队列没有最大限制就返回
    // Integer.max_value
    int remainingCapacity();
	// 移除指定元素（1个或多个）若它存在(equals比较)
    // 若元素存在（或队列改变）返回true
    boolean remove(Object o);
	// 判断队列是否至少包含一个某元素
    public boolean contains(Object o);
	// 移除队列中全部可用元素，添加到指定集合中，若元素添加失败可能导致元素不在
    // 移除前和添加后的集合中
    int drainTo(Collection<? super E> c);
	// 移除指定数量元素并添加到集合中
    int drainTo(Collection<? super E> c, int maxElements);
}

```

#### 方法对比

| 方法        | 作用                     | 返回值  | 队列已满                      |
| ----------- | ------------------------ | ------- | ----------------------------- |
| add(E e)    | 添加元素到队列           | boolean | 抛出异常，不阻塞              |
| offer(E e)  | 添加元素到队列           | boolean | 返回false，不阻塞             |
| put(E e)    | 添加元素到队列           | void    | 会阻塞直到队列空，支持中断    |
| offer(time) | 指定时长内添加元素到队列 | boolean | 阻塞，超时返回false，支持中断 |

| 方法       | 作用                     | 返回值  | 队列为空                     |
| ---------- | ------------------------ | ------- | ---------------------------- |
| take()     | 获取并删除队首元素       | E       | 阻塞等待直到有元素可以获取   |
| poll()     | 获取并删除队首元素       | E/null  | 不阻塞等待，返回null         |
| remove()   | 移除指定的一个或多个元素 | boolean | 不阻塞等待                   |
| peek()     | 获取队首元素但不删除     | E/null  | 不阻塞等待，返回null         |
| poll(time) | 指定时长内获取并删除元素 | E/null  | 阻塞等待，超时返回null，中断 |

---

### ArrayBlockingQueue

#### 构造

`有界阻塞队列`，我们将从类变量、构造函数、添加与获取角度来解析`ArrayBlockingQueue`的实现。

```java
public class ArrayBlockingQueue<E> extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {
    // 底层使用数组实现
    final Object[] items;
    // 元素获取的所以
    int takeIndex;
	// 元素添加的索引
    int putIndex;
	// 队列中元素个数
    int count;
	// 采用独占锁
    final ReentrantLock lock;
	// 等待获取的条件队列(不为空就可以获取)
    private final Condition notEmpty;
	// 等待添加的队列(不满就可以添加)
    private final Condition notFull;
    // 默认实现 需要指定队列大小，默认非公平锁
    public ArrayBlockingQueue(int capacity) {
        this(capacity, false);
    }

    public ArrayBlockingQueue(int capacity, boolean fair) {
        // 容量小于0抛异常
        if (capacity <= 0)
            throw new IllegalArgumentException();
        // 初始化数组（堆中）
        this.items = new Object[capacity];
        // 初始化独占锁和它的两个条件队列
        lock = new ReentrantLock(fair);
        notEmpty = lock.newCondition();
        notFull =  lock.newCondition();
    }
}  
```

> 1. ArrayBlockingQueue创建时需要指定`容量大小（因为是int，最大2^31-1）`。
> 2. 使用`一个独占锁和它的两个Condition队列`实现同步，默认`非公平锁`实现。
> 3. ArrayBlockingQueue是`"有序的(非逻辑有序)"`，遵循`FIFO先进先出`的执行顺序。

---

### 添加

#### put

```java
public void put(E e) throws InterruptedException {
    // 元素不能为null否则报NPE
    checkNotNull(e);
    // 获取独占锁
    final ReentrantLock lock = this.lock;
    // 可中断的获取锁
    lock.lockInterruptibly();
    try {
        // 判断队列是否满了
        while (count == items.length)
            // 若已满 将当前线程加入 等待添加的条件队列
            // 等待被下次唤醒
            notFull.await();
        // 将元素加入队列
        enqueue(e);
    } finally {
        lock.unlock();
    }
}

private void enqueue(E x) {
    // 获取数组
    final Object[] items = this.items;
    // 将元素添加到指定index
    items[putIndex] = x;
    // putIndex + 1的同时判断队列是否满了
    if (++putIndex == items.length)
        // 如果满了就将put的index置为0，防止指针溢出
        putIndex = 0;
    // 将队列的大小+1
    count++;
    // 唤醒获取条件队列的节点
    notEmpty.signal();
}
```

> 1. put方法`获取独占锁的时候可以响应中断`。
> 2. 获取独占锁后，如果队列已满，会将当前线程加入`notFull等待添加条件队列`。
> 3. 若队列没有满，那么会调用`enqueue`将元素加入数组并修改相关变量。

#### offer

```java
public boolean offer(E e) {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 区别在此，队列满返回false
        if (count == items.length)
            return false;
        else {
            enqueue(e);
            return true;
        }
    } finally {
        lock.unlock();
    }
}
```

> offer()方法在队列满的时候直接返回`false`，而put则是调用`await阻塞等待`。
>
> offer(time)方法区别在于`awaitNanos阻塞一定时间，超时了队列仍满再返回false`。

#### add

```java
public boolean add(E e) {
    return super.add(e);
}
// 抽象类AbstractQueue
public boolean add(E e) {
    // 本质还是调用offer方法，只是如果队列满就返回异常
    if (offer(e))
        return true;
    else
        throw new IllegalStateException("Queue full");
}
```

> add()底层是调用的offer()，只是处理队列满的手段不同，`add在队列满时会抛出异常`。

---

### 获取

#### take

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        // 与take方法类似
        // 当队列为空的时候
        while (count == 0)
            // 将当前线程加入 等待获取条件队列
            notEmpty.await();
        // 不为空时调用dequeue获取数据
        return dequeue();
    } finally {
        lock.unlock();
    }
}

private E dequeue() {
    final Object[] items = this.items;
    @SuppressWarnings("unchecked")
    // 获取数组中指定index数据并清除该数据
    E x = (E) items[takeIndex];
    items[takeIndex] = null;
    // 如果takeIndex+1超过数组长度
    if (++takeIndex == items.length)
        // 将takeIndex重置
        takeIndex = 0;
    // 将数组数量减1
    count--;
    // 若迭代器不为null
    if (itrs != null)
        // 需要处理迭代器
        // 若队列为空就清空所有迭代器，不为空就清空takeIndex的迭代器
        itrs.elementDequeued();
    // 唤醒等待添加的条件队列
    notFull.signal();
    return x;
}
```

> 1. take()整体流程与put类似，当队列没有元素时，会添加到`notEmpty`条件队列。
> 2. 如果队列有元素就调用`dequeue`获取元素、唤醒`等待添加条件队列`的节点。

#### poll

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return (count == 0) ? null : dequeue();
    } finally {
        lock.unlock();
    }
}
```

> poll()与take()区别在于队列为空时，`前者返回null`，后者阻塞等待。
>
> poll(time)与take()区别在于`awaitNanos`阻塞等待指定时长，`若队列仍为空返回null`。

#### peek

```java
public E peek() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 直接返回指定索引的数据，队列为空时返回null
        return itemAt(takeIndex); // null when queue is empty
    } finally {
        lock.unlock();
    }
}

final E itemAt(int i) {
    return (E) items[i];
}
```

> peek()与take()区别在于`返回数据时并不删除数据`，peek()`在队列为空时返回null`。

---

### 总结

- `ArrayBlockingQueue`是有界（需要指定初始队列大小）的阻塞队列，最大容量不超过`Integer.MAX_VALUE`。
- `ArrayBlockingQueue`遵循`FIFO先进先出的顺序规则`。
- `ArrayBlockingQueue`中的方法是线程安全的，是通过`独占锁`实现的。
- `ArrayBlockingQueue`因为只有一把锁，所以并不是真正的`同时添加和获取`。

---

### LinkedBlockingQueue

#### 构造

```java
public class LinkedBlockingQueue<E> extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {
    // 内部维护了Node对象，加入队列的元素被封装成node对象通过链表的形式链接
    static class Node<E> {
        // 节点的data
        E item;
        // 节点的next指针
        Node<E> next;
        Node(E x) { item = x; }
    }
    // 队列容量
    private final int capacity;
	// 因为是两把锁，所以共享count需要同步，使用atmoicInteger
    private final AtomicInteger count = new AtomicInteger();
    // 链表的队首，它的item = null(不变)
    transient Node<E> head;
	// 链表的队尾，它的next = null(不变)
    private transient Node<E> last;
	// take、poll之类获取元素的锁（注意是非公平锁）
    private final ReentrantLock takeLock = new ReentrantLock();
	// takeLock的等待获取的条件队列
    private final Condition notEmpty = takeLock.newCondition();
	// put offer之类的获取元素的锁（注意是非公平锁）
    private final ReentrantLock putLock = new ReentrantLock();
	// putLock的等待添加的条件队列
    private final Condition notFull = putLock.newCondition();
    // 默认构造函数，默认队列大小是2^31-1
	public LinkedBlockingQueue() {
        this(Integer.MAX_VALUE);
    }
    // 指定队列的大小
    public LinkedBlockingQueue(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException();
        this.capacity = capacity;
         // 初始化链表队首和队尾 = 空的node节点
        last = head = new Node<E>(null);
    }  
}
```

> 和ArrayBlockingQueue相比，`LinkedBlockingQueue`有三处不同：
>
> 1. 底层实现：前者是数组，后者是通过`静态内部类构建的节点组成的链表`。
> 2. 锁实现：前者支持公平/非公平锁，后者只`支持非公平锁`。
> 3. 锁数量：前者是`一把锁和它的两个Condition`，后者是`两个(一把锁和他的一个Condition)`，因为有两把锁，所以采用了`AtomicInteger来表示count变量`。

---

### 添加

#### put

```java
public void put(E e) throws InterruptedException {
    // 判断是否为null
    if (e == null) throw new NullPointerException();
    // 这里为什么创建局部变量c=-1？如果是0，那么每次都会
    int c = -1;
    // 将当前元素构建成node对象
    Node<E> node = new Node<E>(e);
    final ReentrantLock putLock = this.putLock;
    final AtomicInteger count = this.count;
    // 可中断的获取put锁
    putLock.lockInterruptibly();
    try {
        // 判断队列是否已满
        while (count.get() == capacity) {
            // 如果已满，添加到等待添加条件队列
            notFull.await();
        }
        // 将node入队
        enqueue(node);
        // 将队列容量count+1的同时将count赋值给c
        // 第一次put时: c = 0,count = 1
        c = count.getAndIncrement();
        // 判断是否超过最大容量
        if (c + 1 < capacity)
            // 没有超过就唤醒添加元素队列继续添加
            notFull.signal();
    } finally {
        // 释放put锁
        putLock.unlock();
    }
    // 如果c = 0那么唤醒等待获取的条件队列中的节点
    // 当队列中只有一个node节点时c=0成立
    if (c == 0)
        signalNotEmpty();
}

private void enqueue(Node<E> node) {
    // 将node加入队列，并成为新队尾，老队尾的next指针指向node
    last = last.next = node;
}
// 只能由put/offer调用
private void signalNotEmpty() {
    // 获取take锁
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        // 唤醒等待获取的条件队列的节点
        notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
}
```

> `LinkedBlockingQueue`put的流程与`ArrayBlockingQueue`有些不同：
>
> 1. 当前线程获取`put锁`后，如果队列已满，那么会加入`等待添加的条件队列`，如果队列未满，那么会封装node加入队尾。
> 2. 加入成功后会将`count + 1`，如果`count < capacity`，那么就唤醒`等待添加的条件队列中的节点`，最后释放put锁。
> 3. 因为是两把锁，理论上`添加和获取的操作是可以同时进行的`，所以代码最后还需要判断下`count == 0`，如果成立说明此时恰好有一个数据，唤醒`等待获取队列中线程`来获取。

#### offer

```java
public boolean offer(E e) {
    // 判断是否为null
    if (e == null) throw new NullPointerException();
    final AtomicInteger count = this.count;
    // 如果队列已满，那么直接返回false
    if (count.get() == capacity)
        return false;
    int c = -1;
    // 构建新node
    Node<E> node = new Node<E>(e);
    final ReentrantLock putLock = this.putLock;
    // 获取put锁
    putLock.lock();
    try {
        // 如果count小于队列容量
        if (count.get() < capacity) {
            // 加入队列
            enqueue(node);
            // c = count, count = count+1
            c = count.getAndIncrement();
            // 继续判断是否超过队列容量
            if (c + 1 < capacity)
                // 没超过就唤醒等待添加元素条件队列中的线程
                notFull.signal();
        }
    } finally {
        putLock.unlock();
    }
    // c = 0说明此时队列中恰好一个节点
    if (c == 0)
        // 唤醒 等待获取元素条件队列中的线程
        signalNotEmpty();
    // 如果c<0说明队列已满无法添加了
    return c >= 0;
}
```

> 与put()不同点在于返回值，offer()返回boolean值，当`队列满的时候返回false`。
>
> offer(time)在队列满的时候`等待指定时长`，如果`唤醒后队列还没有空间就返回false`。

#### 获取

- take

```java
public E take() throws InterruptedException {
    E x;
    int c = -1;
    final AtomicInteger count = this.count;
    // 获取take锁
    final ReentrantLock takeLock = this.takeLock;
    // 可中断获取take锁
    takeLock.lockInterruptibly();
    try {
        // 判断队列是否为空
        while (count.get() == 0) {
            // 为空就加入 等待获取元素条件队列
            notEmpty.await();
        }
        // 队列不为空获取链表中的头节点中元素
        x = dequeue();
        // c = count, count = count - 1
        c = count.getAndDecrement();
        // 如果c > 1说明此时数据堆积
        if (c > 1)
            // 唤醒 等待获取元素条件队列中的线程
            notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
    // 如果 c = capacity时，count 肯定是小于capacity的
    if (c == capacity)
        // 唤醒 等待添加元素条件队列
        signalNotFull();
    return x;
}

// 获取链表中node节点中元素并返回
private E dequeue() {
    // 获取头节点
    Node<E> h = head;
    // 获取头节点的next节点
    Node<E> first = h.next;
    // 将头节点的next设为自己方便gc
    h.next = h;
    // 设置first为head节点
    head = first;
    // 返回first中的元素并将其置为null
    E x = first.item;
    first.item = null;
    return x;
}
```

> 1. 如果队列为空，那么就将当前线程加入`等待获取元素条件队列`。
> 2. `dequeue()`会将head的next节点设为新的head，`返回并清空新head的item属性`。
> 3. `c == capacity`时为何要唤醒`等待添加元素条件队列中的线程`？因为此时的`c = count + 1`，所以还缺一个节点队列才满，所以唤醒添加节点的条件队列。
> 4. take()当`队列为空的时候会阻塞`，直到不为空获取元素。

#### poll

```java
public E poll() {
    final AtomicInteger count = this.count;
    if (count.get() == 0)
        return null;
    // 赋值null 与take不同
    E x = null;
    int c = -1;
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        // 与take的区别之处
        if (count.get() > 0) {
            x = dequeue();
            c = count.getAndDecrement();
            // 如果 c > 1说明队列存在很多数据需要take
            if (c > 1)
                // 继续唤醒线程获取
                notEmpty.signal();
        }
    } finally {
        takeLock.unlock();
    }
    if (c == capacity)
        signalNotFull();
    return x;
}
```

> 和take()明显的区别在于：`poll()在队列满的时候返回null，并且不会阻塞`。
>
> poll(time)：`阻塞指定时长，唤醒后如果队列仍为空，那么返回null`。

#### peek

```java
public E peek() {
    // 如果队列为空返回null
    if (count.get() == 0)
        return null;
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        // 返回head的next节点，并不会删除next节点
        Node<E> first = head.next;
        // 如果队列刚初始化那么head = last = new Node(null)
        // head.next = null
        // 此时也返回null
        if (first == null)
            return null;
        else
            // 不为null就返回item
            return first.item;
    } finally {
        takeLock.unlock();
    }
}
```

> peek()相比take()：除了队列为空时返回null外，还不会阻塞等待。

---

### 总结

- `LinkedBlockingQueue`是无界（可以不传递初始队列大小）队列，不指定容量时默认`Integer.MAX_VALUE`。
- `LinkedBlockingQueue`的底层是由`链表组成的`，它`head.item = null, last.next  = null`是永远成立的。并且它也符合`FIFO`规则。
- `LinkedBlockingQueue`拥有两把锁，分别对应着put和take，所以count变量需要同步。
- `LinkedBlockingQueue`可以实现`逻辑上真正的同时take和put`，所以性能更强。

---

### PriorityBlockingQueue

- `PriorityBlockingQueue`是不符合`FIFO`规则的队列，它是按照`元素的优先级从小到大出队列的`，是由元素实现`Comparator`接口来实现的。

- 队列`默认容量11，最大容量Integer.MAX_VALUE - 8`，底层通过`独占锁和Condition条件队列`实现，但只有`notEmpty`条件队列。

- 当队列大小不够时会扩容（不超过MAX_SIZE），扩容规则如下

  ```java
  int newCap=oldCap+((oldCap < 64)?(oldCap + 2):(oldCap >> 1));
  ```

- 底层是数组，但是用`数组实现了二叉堆`，排在`堆顶`的就是要出队的元素。

### DelayQueue

- `延迟队列`，一个按照`延迟时间从小到大出队的PriorityBlockingQueue`。
- DelayQueue中的元素必须要实现`Delayed`接口，复写`getDelay和compareTo`方法。
- `未来时间 - 当前时间 `，值越小就越先出队，但前提是`时间差 <= 0`。

### SynchronousQueue

- `SynchronousQueue`队列本身并没有容量的概念，`先调用put的线程会阻塞，直到另一个线程调用了take`。如果调用多次put，那么也需要调用同样次数的take，才能全部解锁。
- `SynchronousQueue`支持公平和非公平实现，假设调用三次put，公平锁的情况下，`第一个take的线程对应着第一个put的线程`，非公平锁情况下，`第一个take的线程对应着第三个put的线程`。