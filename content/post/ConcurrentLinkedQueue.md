---
title: "ConcurrentLinkedQueue源码浅析"
date: 2020-07-11T14:53:34+08:00
description: "`ConcurrentLinkedQueue`是使用`自旋和CAS`来实现的非阻塞的有序队列，是LinkedList的线程安全变体。"
tags: ["ConcurrentLinkedQueue "]
categories: [
  "Concurrent",
  "Collection"
]
hideReadMore: true
slug: concurrent_linked_queue
---
### ConcurrentLinkedQueue

#### 特性

- 基于链表的无界线程安全队列。
- 队列顺序是`FIFO`先进先出的顺序。队首是插入最久的元素，队尾是最新的元素。
- 使用场景：`许多线程将共享对一个公共集合的访问，不支持null`。
- 内部的并发操作通过`自旋 + CAS`实现。与`LinkedBlockingQueue`独占锁不同。

#### 构造

```java
public class ConcurrentLinkedQueue<E> extends AbstractQueue<E>
        implements Queue<E>, java.io.Serializable {
    // head头节点
    private transient volatile Node<E> head;
	// tail尾节点
    private transient volatile Node<E> tail;
	// 不用传递初始容量
    public ConcurrentLinkedQueue() {
        // 初始化head和tail，哨兵节点
        head = tail = new Node<E>(null);
    }
    // 私有静态内部类，用于构成链表的节点（单向链表）
    // 核心是通过CAS来实现并发操作
    private static class Node<E> {
        volatile E item;
        // 标记next节点 volatile修饰的
        volatile Node<E> next;
		// 构造
        Node(E item) {
            // CAS添加item
            UNSAFE.putObject(this, itemOffset, item);
        }
		// CAS修改item（把cmp设置成val）
        boolean casItem(E cmp, E val) {
            return UNSAFE.
                compareAndSwapObject(this, itemOffset, cmp, val);
        }
		// CAS设置next指针
        void lazySetNext(Node<E> val) {
            UNSAFE.putOrderedObject(this, nextOffset, val);
        }
		// CAS修改next节点
        boolean casNext(Node<E> cmp, Node<E> val) {
            return UNSAFE
                .compareAndSwapObject(this, nextOffset, cmp, val);
        }
        private static final sun.misc.Unsafe UNSAFE;
        // Node节点中item偏移量
        private static final long itemOffset;
        // Node节点中next的偏移量
        private static final long nextOffset;

        static {
            try {
                UNSAFE = sun.misc.Unsafe.getUnsafe();
                Class<?> k = Node.class;
                itemOffset = UNSAFE.objectFieldOffset
                    (k.getDeclaredField("item"));
                nextOffset = UNSAFE.objectFieldOffset
                    (k.getDeclaredField("next"));
            } catch (Exception e) {
                throw new Error(e);
            }
        }
    }
}
```

> 1. Node是私有静态内部类，其中定义了`item和next的CAS方法`。
> 2. 因为不是阻塞队列，所以`不存在容量字段`，也`不需要指定大小`。

---

### 提示

> 如果使用的是idea，会出现`head莫名奇妙被修改，节点引用指向自己的问题`。
>
> 解决方案：https://blog.csdn.net/AUBREY_CR7/article/details/106331490

---

### offer

```java
// 添加节点到队列中
public boolean offer(E e) {
    // 老一套，判断是否为空，为空抛出NPE
    checkNotNull(e);
    // 初始化节点
    final Node<E> newNode = new Node<E>(e);
	// 自旋从队尾开始,这里只有初始化条件，没有循环结束条件
    for (Node<E> t = tail, p = t;;) {
        // p被认为是真正的尾节点,获取p.next节点
        // 因为此时有可能有其他线程成为tail
        Node<E> q = p.next;
        // q = null 说明此刻p就是tail尾节点
        if (q == null) {
            // CAS将newNode设为p的next节点，失败就继续自旋
            if (p.casNext(null, newNode)) {
                // p = t = tail = Node(next = newNode)
                if (p != t)
                    // CAS设置tail尾节点，即使失败了，
                    casTail(t, newNode);
                return true;
            }
        }
        else if (p == q)
            // 如果tail此时被其他线程改变了，那么p = t成立
            // 没改变 t = head
            p = (t != (t = tail)) ? t : head;
        else
            // 此行代码用于找到真正的尾节点，赋予p，
            // 因为tail更新不及时，每添加两个才会更新tail
            p = (p != t && t != (t = tail)) ? t : q;
    }
}
// 测试代码
class Test {
    private static ConcurrentLinkedQueue<Integer> QUEUE = 
        						new ConcurrentLinkedQueue<>();
    public static void main(String[] args) {
        QUEUE.offer(11);
        QUEUE.offer(22);
        QUEUE.offer(33);
    }
}
```

>推论：`每插入两个节点，tail指针才会移动，指向第二个插入的节点`。
>
>1. `t表示刚进入代码时的尾节点，p用来表示队列真正的尾节点`，当`p.next = null`成立时说明p此时指向真正的尾节点，如果不成立说明p此时不是真正的尾节点，需要查找真正的尾节点并将它赋予p，保证每次新增的节点都在队尾。
>2. `p = (p != t && t != (t = tail)) ? t : q;`，针对这个代码，我们假设一个场景，队列中已经有第一个节点了（此时tail指针还没修改），此时线程A和线程B同时进入该段自旋代码准备执行：
>  3. 线程A判断`p.next != null`，执行else中代码，此时`p != t`不成立，所以`p = q`后继续循环执行，线程A继续判断`p.next = q = null`成立，所以执行`p.casNext`，此时线程A的值加入了队列，此时`p != t`成立，准备执行casTail。
>  4. 此时`切换为线程B`，线程B判断`p.next != null`，执行else中`p != t`不成立，所以`p = q`后继续循环，因为线程A的值加入了队列，所以`q = p.next != null`，执行else中代码，此时`p != t`成立，准备执行`t != (t = tail)`。
>  5. 切换回线程A，`线程A执行casTai，tail指针被修改`，线程A返回true退出循环，切换到线程B，判断`t != (t = tail)`成立，此时`p = t = 更改后的tail`，继续循环执行`p.next = q = null`成立，执行casNext，将线程A的值也加入队列中。
>6. `p == q`需要结合`poll`方法去解析(一些线程offer，一些poll)，当它成立的时候说明`p.next = p = q`，说明这种节点是哨兵节点，表示为需要删除或者过滤的节点。

### offer执行流程

![](https://image.leejay.top/image/20200710/XWBJx3hhhzX3.jpg?imageslim)

---

### poll

```java
// 删除链表的头节点并返回该节点的item
public E poll() {
    restartFromHead:
    // 自旋
    for (;;) {
        // head = h = p
        for (Node<E> h = head, p = h, q;;) {
            E item = p.item;
			// 如果item不为null，那么CAS修改为null
            if (item != null && p.casItem(item, null)) {
                // CAS成功后会执行到这里
                // head也是每两个节点更新一次
                if (p != h) 
                    // p != h 说明此时需要更新head标识
                    updateHead(h, ((q = p.next) != null) ? q : p);
                // 直接返回item
                return item;
            }
            // 如果p.item = null 且 p.next= null
            else if ((q = p.next) == null) {
                // 更新head节点
                updateHead(h, p);
                return null;
            }
            else if (p == q)
                continue restartFromHead;
            else
                p = q;
        }
    }
}

final void updateHead(Node<E> h, Node<E> p) {
    // 如果要更新的节点和当前节点不同，那么尝试更新head头节点，注意h节点不会变
    if (h != p && casHead(h, p))
        // 将原head的节点next指针指向自己，便于GC
        h.lazySetNext(h);
}
```

> 推论：`每移除两个节点，head指针会移动一次`。
>
> 1. 和offer方法一样，`h为刚进入代码的头节点，p节点用来表示为真正要删除的头节点`。
>
> 2. 只有当当前head节点的`item!=null`时才会尝试去CAS修改，若`item = null`的节点会通过`q = p.next`去查找。找到后执行`updateHead`，移除h节点并设置新的head节点。
>
> 3. `p == q`何时成立：线程A和线程B同时获取队列中的元素，假设线程B移除了节点并将其设为`哨兵节点（h.next = h）`，此时线程A判断`item != null`不成立，继续判断`p == q`成立。
>
> 4. 再结合offer方法中何时`p == q`：
>
>    1. `此时队列中head=tail(item=null, next=node1)，node1=(item!=null,next=null)`，此时线程A尝试offer数据，线程B尝试poll数据，线程A先进入循环，切换为线程B，此时`h = head = p`，继续执行`p.item = null`，判断`q = p.next != null`且`p != q`，所以执行else：`p = q`，继续循环，`p.item != null`，尝试CAS修改，且`p != h`，所以执行`updateHead将h改为哨兵节点`。
>    2. 此时线程切换回A，线程执行`q = p.next（此时p已经是哨兵节点了）`判断`q != null`，继续判断`p = q`成立，执行`p = (t != (t = tail)) ? t : head;`，此时的`p = head`，继续从头节点开始循环插入尾节点。至此两个线程都执行完毕。
>
>    ![](https://image.leejay.top/image/20200710/qsxlf6aucyH7.png?imageslim)

### poll执行流程

![](https://image.leejay.top/image/20200710/8Pn7oKJw2R07.jpg?imageslim)

---

### 总结

- `ConcurrentlinkedQueue`是`非阻塞队列`，底层使用`自旋和CAS`来实现，`FIFO`且不允许`null`值。
- `ConcurrentlinkedQueue`元素入队和出队操作都是线程安全的，但`遍历不是的线程安全的`，并且在判断元素是否为空的时候建议使用`isEmpty`而不是`sze == 0（遍历队列）`
- `ConcurrentlinkedQueue`中的`head和tail`节点都是延迟更新，采用的是`HOPS`策略，如果每次节点入队都更新头尾节点，确实代码更好理解，当时执行大量CAS操作对性能也是损耗，`采用大量读的操作来替代每次节点入队都写的操作，以此提升性能。`
- 相比`LinkedBlockingQueue`阻塞队列，`ConcurrentlinkedQueue`非阻塞队列的并发性能更好些。当时具体使用场景具体分析。