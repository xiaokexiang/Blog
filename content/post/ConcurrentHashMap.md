---
title: "ConcurrentHashMap源码浅析"
date: 2020-07-14T16:58:36+08:00
description: "`ConcurrentHashMap`是基于`CAS + Synchronized`的线程安全的HashMap。"
tags: ["ConcurrentHashMap "]
categories: [
  "Concurrent",
  "Collection"
]
hideReadMore: true
---

### ConcurrentHashMap

`JDK1.8`之后采用的是`数组 + 链表 + 红黑树`的结构，通过`Synchronized + CAS`实现线程安全，而`JDK1.7`采用的是`将一个HashMap分成多个Segment`的方式，通过`继承ReentrentLock的Segment分段锁`实现线程安全。

#### Node

```java
// Node数组，组成ConcurrentHashMap的主要结构
transient volatile Node<K,V>[] table;
// 扩容期间不为null，因为存在协助扩容的机制，所以需要设置volatile保证线程间可见性
private transient volatile Node<K,V>[] nextTable;
static class Node<K,V> implements Map.Entry<K,V> {
    final int hash;
    final K key;
    volatile V val;
    volatile Node<K,V> next;

    Node(int hash, K key, V val, Node<K,V> next) {
        this.hash = hash;
        this.key = key;
        this.val = val;
        this.next = next;
    }
}
// 如果一个index下所有的节点全部转移完后会放置ForwardingNode节点，防止put插入错误位置
// 如果正在扩容但是put插入的位置不是ForwardingNode还是可以继续put的，支持两者并发
// 如果是get的方法，那么就需要获取nextTable属性(新的chm的引用)，用于返回新的值
static final class ForwardingNode<K,V> extends Node<K,V> {
    final Node<K,V>[] nextTable;
    ForwardingNode(Node<K,V>[] tab) {
        super(MOVED, null, null, null);
        this.nextTable = tab;
    }
}
// 红黑树的根节点使用的TreeNode，不存储key-value
static final class TreeBin<K,V> extends Node<K,V> {
    TreeNode<K,V> root;
    volatile TreeNode<K,V> first;
    volatile Thread waiter;
    volatile int lockState;
    // values for lockState
    static final int WRITER = 1; // set while holding write lock 
    static final int WAITER = 2; // set when waiting for write lock
    static final int READER = 4; // increment value for setting read lock
}
// 构建成红黑树树的节点结构
static final class TreeNode<K,V> extends Node<K,V> {
    TreeNode<K,V> parent;  // red-black tree links
    TreeNode<K,V> left;
    TreeNode<K,V> right;
    TreeNode<K,V> prev;    // needed to unlink next upon deletion
    boolean red;

    TreeNode(int hash, K key, V val, Node<K,V> next,
             TreeNode<K,V> parent) {
        super(hash, key, val, next);
        this.parent = parent;
    }
}
```

> 1. `Node`的定义与HashMap类似，只是用`volatile修饰value和next`，用于`保证线程间的可见性`。
>
> 2. `ForwardingNode`节点用于表示扩容期间，指定数组位置下的`所有节点`全部转移后，会`使用该节点占据指定位置`，防止put插入错误的位置。
> 3. `TreeBin`用于表示红黑树结构根节点的TreeNode，`不存储key-value数据`。
> 4. `TreeNode`表示组成红黑树节点的结构，`存储key-value数据`。
> 5. 成员变量`nextTable`在`扩容期间不为null`，表示扩容中下个需要使用的table。因为线程协助扩容的机制的存在，所以用`volatile`修饰，保证线程间的可见性。

#### 构造

```java
// 负数时表示为正在初始化或扩容：-1表示初始化或-(1+活动resize线程数量)
// 当table为null时，持有初始table size直到table创建(默认为0)
// 初始化后持有下个大小直到扩容table
private transient volatile int sizeCtl;
public ConcurrentHashMap(int initialCapacity,
                             float loadFactor, int concurrencyLevel) {
    if (!(loadFactor > 0.0f) || initialCapacity < 0 || concurrencyLevel <= 0)
        throw new IllegalArgumentException();
    if (initialCapacity < concurrencyLevel)
        initialCapacity = concurrencyLevel;
    long size = (long)(1.0 + (long)initialCapacity / loadFactor);
    // tableSizeFor方法用于保证容量必须是2次幂
    int cap = (size >= (long)MAXIMUM_CAPACITY) ?
        MAXIMUM_CAPACITY : tableSizeFor((int)size);
    // sizeCtl的初始值就是cap
    this.sizeCtl = cap;
}
```

> `构造方法只是定义了属性，并没有真正的开辟空间创建对象`。
>
> initialCapacity：初始容量，默认是`16`。
>
> loadFactor： 扩容因子，默认是`0.75f`。
>
> concurrencyLevel：并发级别，并发更新线程的数量。
>
> sizeCtl：用于控制在初始化或者并发扩容时的线程数，默认为0，否则为初始容量大小cap。在`initTable`初始化后`sizeCtl = 0.75 * 数组大小`。当`sizeCtl < 0`时存在：`-1表示正在初始化，-(1 + 活动resize线程）表示正在resize`两种情况的值。

---

### put

```java
public V put(K key, V value) {
    return putVal(key, value, false);
}

static final int HASH_BITS = 0x7fffffff;
// 计算hash值，通过高低16交互避免hash冲突，并通过&运算保证最高位是0
static final int spread(int h) {
    return (h ^ (h >>> 16)) & HASH_BITS;
}


// onlyIfAbsent：  false/true 允许覆盖/不允许覆盖
final V putVal(K key, V value, boolean onlyIfAbsent) {
    // key和value都不允许为null，hashmap允许
    if (key == null || value == null) throw new NullPointerException();
    // 计算key的hash值
    int hash = spread(key.hashCode());
    int binCount = 0;
    // 定义局部变量 tab = Node[]
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        // 如果table = null 或 table.length = 0，说明table没有初始化
        if (tab == null || (n = tab.length) == 0)
            // 初始化table
            tab = initTable();
        // 如果table不为null说明已经初始化过
        // 计算当前key在table[]对应位置是否为null
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            // cas设置Node到指定index，成功就退出
            // 失败说明有同样index的key刚操作成功
            if (casTabAt(tab, i, null,
                         new Node<K,V>(hash, key, value, null)))
                break;
        }
        // 如果不为null判断当前节点的hash == MOVED(-1)，表示当前正在对数组进行扩容
        else if ((fh = f.hash) == MOVED)
            // 协助进行扩容，扩容下面再分析
            tab = helpTransfer(tab, f);
        // 已经初始化，且不在扩容，那么调用synchronized进行元素的添加
        else {
            V oldVal = null;
            // 加锁
            synchronized (f) {
                // 判断有没有线程对table[i]进行修改
                if (tabAt(tab, i) == f) {
                    // fh >= 0说明是链表结构
                    if (fh >= 0) {
                        binCount = 1;
                        for (Node<K,V> e = f;; ++binCount) {
                            K ek;
                            // 如果hash key都相同，替换旧值
                            if (e.hash == hash &&
                                ((ek = e.key) == key ||
                                 (ek != null && key.equals(ek)))) {
                                oldVal = e.val;
                                // onlyIfAbsent = false 才能替换
                                if (!onlyIfAbsent)
                                    e.val = value;
                                break;
                            }
                            // 否则找到链表最后的节点，将当前节点加入链接
                            Node<K,V> pred = e;
                            if ((e = e.next) == null) {
                                pred.next = new Node<K,V>(hash, key,
                                                          value, null);
                                break;
                            }
                        }
                    }
                    // 如果不是链表判断是不是红黑树
                    else if (f instanceof TreeBin) {
                        Node<K,V> p;
                        binCount = 2;
                        // 调用红黑树的put方法，返回不是null说明之前有过这个key
                        if ((p = ((TreeBin<K,V>)f)
                          .putTreeVal(hash, key,value)) != null) {
                            oldVal = p.val;
                            if (!onlyIfAbsent)
                                p.val = value;
                        }
                    }
                }
            }
            // 判断binCount >= 8
            if (binCount != 0) {
                if (binCount >= TREEIFY_THRESHOLD)
                    // 成立就转换成红黑树或扩容
                    treeifyBin(tab, i);
                if (oldVal != null)
                    return oldVal;
                break;
            }
        }
    }
    // 进行数量统计或扩容
    addCount(1L, binCount);
    return null;
}

private final Node<K,V>[] initTable() {
    Node<K,V>[] tab; int sc;
    // CAS + 自旋,老搭档，table不为空就退出自旋
    while ((tab = table) == null || tab.length == 0) {
        // 如果sizeCtl < 0说明有其他线程正在初始化或扩容
        if ((sc = sizeCtl) < 0)
            // 交出线程执行权，只是自旋
            Thread.yield(); // lost initialization race; just spin
        // 不是，则CAS修改sizeCtl为-1，表示正在初始化
        else if (U.compareAndSwapInt(this, SIZECTL, sc, -1)) {
            try {
                // 继续判断一次table==null
                // 确实会出现：执行到此处线程切换，别的线程执行了初始化
                if ((tab = table) == null || tab.length == 0) {
                    // 如果sizeCtl > 0说明构造函数设置了sizeCtl，否则默认cap=16
                    int n = (sc > 0) ? sc : DEFAULT_CAPACITY;
                    @SuppressWarnings("unchecked")
                    // 定义数组的大小
                    Node<K,V>[] nt = (Node<K,V>[])new Node<?,?>[n];
                    // table成员变量指向nt刚创建的数组
                    table = tab = nt;
                    // 计算新的sizeCtl，表示下一次扩容的阈值0.75n
                    sc = n - (n >>> 2);
                }
            } finally {
                sizeCtl = sc;
            }
            break;
        }
    }
    return tab;
}

static final int MIN_TREEIFY_CAPACITY = 64;
// 判断转成红黑树还是扩容
private final void treeifyBin(Node<K,V>[] tab, int index) {
    Node<K,V> b; int n, sc;
    // table不能为null
    if (tab != null) {
        // 判断数组长度是否小于64
        if ((n = tab.length) < MIN_TREEIFY_CAPACITY)
            // 扩容的核心方法，下面再分析，扩大一倍
            tryPresize(n << 1);
        // 转成红黑树
        else if ((b = tabAt(tab, index)) != null && b.hash >= 0) {
            synchronized (b) {
                if (tabAt(tab, index) == b) {
                    TreeNode<K,V> hd = null, tl = null;
                    // 将链表转换成红黑树
                    for (Node<K,V> e = b; e != null; e = e.next) {
                        // 遍历每个节点，创建对应的TreeNode
                        TreeNode<K,V> p =
                            new TreeNode<K,V>(e.hash, e.key, e.val,
                                              null, null);
                        // 建立树之间的关系
                        if ((p.prev = tl) == null)
                            hd = p;
                        else
                            tl.next = p;
                        tl = p;
                    }
                    // 将第一个树节点放到TreeBin容器中
                    setTabAt(tab, index, new TreeBin<K,V>(hd));
                }
            }
        }
    }
}
```

> 1. `ConcurrentHashMap`的 put方法中不允许`key和value的值为null`，这与HashMap不同。
>
> 2. `ConcurrentHashMap`的`table(Node[])在put方法中才会初始化`，构造函数中并不会初始化。
>
> 3. `initTable`方法中通过`自旋+CAS`实现线程安全的table初始化。
>
> 4. `sizeCtl`成员变量在`初始化后就不再等于数组长度`，而是用于表示`扩容阈值(0.75n)`。
>
> 5. `treeifyBin`若`当前table.length < 64时会变成原来的2倍，否则会转换成红黑树`。
>
> 6. `addCount`方法用于添加计数，如果table太小且还未调整大小，则调用transfer扩容。 如果已经调整了大小，那么需要帮助扩容。
>
> 7. 执行流程：
>
>    ①判断队列是否为空，为空就先初始化队列。
>
>    ②不为空就查看数组当前位置是否为null，如果为null直接创建Node放在此位置。
>
>    ③判断当前数组是否在`扩容(f.hash == MOVED)`，如果是正在扩容，那么当前线程协助扩容。
>
>    ④如果①②③都不成立，那么使用`synchronized`加锁准备执行⑤⑥。
>
>    ⑤如果当前节点存放的是链表，那么将链表中的节点依次比较，如果相同就替换，如果没有相同的那就添加到`链表尾部`。
>
>    ⑥如果当前节点存放的是红黑树，调用putTreeVal添加到树上，如果同一个位置下`节点超过8个`，且`数组大小超过64`，那么会将链表转成红黑树，否则会`扩容成原来数组两倍`。
>
>    ⑦最后执行`addCount`计数并判断是否需要扩容。

---

### resize

```java
private static final int MIN_TRANSFER_STRIDE = 16;
// 扩容期间表示下一个数组的index
private transient volatile int transferIndex;
// 扩容的核心方法，参数原有的table和扩容后的table
private final void transfer(Node<K,V>[] tab, Node<K,V>[] nextTab) {
    // 定义数组长度和步长
    int n = tab.length, stride;
    // 如果CPU核数大于1，计算 n/(8*NCPU) < 16成立 步长stride = 16
    // 单核情况下，默认一个线程执行扩容
    if ((stride = (NCPU > 1) ? (n >>> 3) / NCPU : n) < MIN_TRANSFER_STRIDE)
        stride = MIN_TRANSFER_STRIDE;
    // 如果nextTable为null，那么创建扩容后的table[]，默认是2倍
    if (nextTab == null) {
        try {
            @SuppressWarnings("unchecked")
            // 初始化创建大小为2倍原有数组长度的数组
            Node<K,V>[] nt = (Node<K,V>[])new Node<?,?>[n << 1];
            nextTab = nt;
        } catch (Throwable ex) {
            sizeCtl = Integer.MAX_VALUE;
            return;
        }
        // 将创建的数组赋予nextTable成员变量，在此处被赋值，只有扩容期间此参数不为null
        // 说明是第一个扩容的线程,此后如果有其他线程调用put，那么也会进来帮忙
        nextTable = nextTab;
        // 默认是旧table的大小，用于表示数组扩容进度
        // [0, transferIndex-1]表示还未分配到线程扩容的部分
        // [transferIndex， n-1]表示已经分配给某个线程正在扩容或已经扩容完成的部分
        transferIndex = n;
    }
    int nextn = nextTab.length;
    // 创建ForwardingNode，并赋值nextTab
    ForwardingNode<K,V> fwd = new ForwardingNode<K,V>(nextTab);
    // 结合下文：advance表示从i(transferIndex - 1)到bound位置过程中是否一直继续
    boolean advance = true;
    // 表示扩容是否结束
    boolean finishing = false;
    // i 表示为 遍历的下标，bound为遍历的边界
    // i = nextIndex - 1;bound = nextIndex - stride，拿不到任务两者都为0
    for (int i = 0, bound = 0;;) {
        Node<K,V> f; int fh;
        while (advance) {
            // 以下三个分支，一个成功就会退出while循环
            int nextIndex, nextBound;
            if (--i >= bound || finishing)
                advance = false;
            else if ((nextIndex = transferIndex) <= 0) {
                i = -1;
                advance = false;
            }
            // 因为扩容分配给多个线程需要同步，使用CAS操作transferIndex
            // 尝试为当前线程分配步长，CAS操作成功就表示拿到步长了。
            else if (U.compareAndSwapInt
                     (this, TRANSFERINDEX, nextIndex,
                      nextBound = (nextIndex > stride ?
                                   nextIndex - stride : 0))) {
                // 分配成功就修改bound和i，advance退出循环
                bound = nextBound;
                i = nextIndex - 1;
                advance = false;
            }
        }
        // 至此i为负数，整个hashmap已经遍历完成了，准备扩容
        // 如果 i<0 或i >= 旧数组大小n 或 i + n >= 新数组大小
        if (i < 0 || i >= n || i + n >= nextn) {
            int sc;
            // 如果finishing = true说明扩容完成
            if (finishing) {
                // 将nextTable置为null，将
                nextTable = null;
                table = nextTab;
                sizeCtl = (n << 1) - (n >>> 1);
                return;
            }
            if (U.compareAndSwapInt(this, SIZECTL, sc = sizeCtl, sc - 1)) {
                if ((sc - 2) != resizeStamp(n) << RESIZE_STAMP_SHIFT)
                    return;
                finishing = advance = true;
                i = n; // recheck before commit
            }
        }
        // table[i]迁移完毕，此位置放个ForwardingNode
        else if ((f = tabAt(tab, i)) == null)
            advance = casTabAt(tab, i, null, fwd);
        // 说明这个位置已经在迁移中了 fh = f.hash
        else if ((fh = f.hash) == MOVED)
            advance = true;
        else {
            // 对table[i]开始迁移
            synchronized (f) {
                // 先判断此位置有没有被其他线程修改
                if (tabAt(tab, i) == f) {
                    Node<K,V> ln, hn;
                    // 如果fh > 0说明是链表
                    if (fh >= 0) {
                        int runBit = fh & n;
                        Node<K,V> lastRun = f;
                        for (Node<K,V> p = f.next; p != null; p = p.next) {
                            int b = p.hash & n;
                            // 当b!=runBit时表明节点p后的全部节点的hashcode都相同
                            if (b != runBit) {
                                runBit = b;
                                lastRun = p;
                            }
                        }
                        // 和hashmap一致 hashcode & n = 0就不平移，不等于就平移
                        if (runBit == 0) {
                            ln = lastRun;
                            hn = null;
                        }
                        else {
                            hn = lastRun;
                            ln = null;
                        }
                        for (Node<K,V> p = f; p != lastRun; p = p.next) {
                            int ph = p.hash; K pk = p.key; V pv = p.val;
                            // 下面是将链表中的节点平移到新的数组中
                            // 这点hashmap是一致的，通过hashcode & 数组长度来判断
                            // 如果需要平移，那么平移后的index = oldIndex + n
                            if ((ph & n) == 0)
                                ln = new Node<K,V>(ph, pk, pv, ln);
                            else
                                hn = new Node<K,V>(ph, pk, pv, hn);
                        }
                        setTabAt(nextTab, i, ln);
                        setTabAt(nextTab, i + n, hn);
                        setTabAt(tab, i, fwd);
                        advance = true;
                    }
                    // 下面是处理红黑树的迁移
                    else if (f instanceof TreeBin) {
                        TreeBin<K,V> t = (TreeBin<K,V>)f;
                        TreeNode<K,V> lo = null, loTail = null;
                        TreeNode<K,V> hi = null, hiTail = null;
                        int lc = 0, hc = 0;
                        for (Node<K,V> e = t.first; e != null; e = e.next) {
                            int h = e.hash;
                            TreeNode<K,V> p = new TreeNode<K,V>
                                (h, e.key, e.val, null, null);
                            if ((h & n) == 0) {
                                if ((p.prev = loTail) == null)
                                    lo = p;
                                else
                                    loTail.next = p;
                                loTail = p;
                                ++lc;
                            }
                            else {
                                if ((p.prev = hiTail) == null)
                                    hi = p;
                                else
                                    hiTail.next = p;
                                hiTail = p;
                                ++hc;
                            }
                        }
                        ln = (lc <= UNTREEIFY_THRESHOLD) ? untreeify(lo) :
                        (hc != 0) ? new TreeBin<K,V>(lo) : t;
                        hn = (hc <= UNTREEIFY_THRESHOLD) ? untreeify(hi) :
                        (lc != 0) ? new TreeBin<K,V>(hi) : t;
                        setTabAt(nextTab, i, ln);
                        setTabAt(nextTab, i + n, hn);
                        setTabAt(tab, i, fwd);
                        advance = true;
                    }
                }
            }
        }
    }
}
// tryPersize可以扩容指定大小
private final void tryPresize(int size) {
    // 判断size是否超过MAXIMUM_CAPACITY >>> 1，是size就是MAXIMUM_CAPACITY
    // 否就调用tableSizeFor生成大于size的最小2此幂
    int c = (size >= (MAXIMUM_CAPACITY >>> 1)) ? MAXIMUM_CAPACITY :
    tableSizeFor(size + (size >>> 1) + 1);
    int sc;
    // sizeCtl < 0表示正在初始化或扩容
    while ((sc = sizeCtl) >= 0) {
        Node<K,V>[] tab = table; int n;
        // 如果table = null，sizeCtl表示初始容量
        if (tab == null || (n = tab.length) == 0) {
            // 选择sizeCtl和cap较大的作为数组大小
            n = (sc > c) ? sc : c;
            // 尝试将sizeCtl设为-1表示正在初始化
            if (U.compareAndSwapInt(this, SIZECTL, sc, -1)) {
                try {
                    if (table == tab) {
                        @SuppressWarnings("unchecked")
                        Node<K,V>[] nt = (Node<K,V>[])new Node<?,?>[n];
                        table = nt;
                        //sizeCtl = 0.75n，即扩容阈值
                        sc = n - (n >>> 2);
                    }
                } finally {
                    sizeCtl = sc;
                }
            }
        }
        // 如果c小于等于sc或数组大小超过max，则break
        else if (c <= sc || n >= MAXIMUM_CAPACITY)
            break;
        else if (tab == table) {
            int rs = resizeStamp(n);
            // sc < 0说明正在扩容，那么帮助扩容
            if (sc < 0) {
                Node<K,V>[] nt;
                if ((sc >>> RESIZE_STAMP_SHIFT) != rs || sc == rs + 1 ||
                    sc == rs + MAX_RESIZERS || (nt = nextTable) == null ||
                    transferIndex <= 0)
                    break;
                // 将sc加1，sc表示正在进行扩容帮忙的线程数量
                if (U.compareAndSwapInt(this, SIZECTL, sc, sc + 1))
                    transfer(tab, nt);
            }
            // 如果没有初始化或者正在扩容，那么开启第一次扩容
            else if (U.compareAndSwapInt(this, SIZECTL, sc,
                                         (rs << RESIZE_STAMP_SHIFT) + 2))
                transfer(tab, null);
        }
    }
}
```

> 1. transfer方法需要传入`扩容前数组table和扩容后数组nextTable`，如果nextTable=null，会读nextTable进行初始化，大小时table的2倍。
>
> 2. `stride`表示为`步长`，代表每个线程处理扩容的长度，通过公式：`(stride = (NCPU > 1) ? (n >>> 3) / NCPU : n)`计算得出，一般是16。
>
> 3. transferIndex用于表示整个数组扩容的进度，其扩容的范围不同分别表示为：`[0，transfer - 1] 表示还未分配线程扩容的部分，[transfer， n(原数组长度)]表示为已分配线程进行扩容，有可能正在扩容或扩容已完成`，如果当前线程CAS修改transferIndex成功，说明它可以在`指定步长范围内进行扩容操作`。
>
>    ![](https://image.leejay.top/image/20200713/Jns0xdIrB1m6.png?imageslim)
>
> 4. 假设扩容还未完成之前，有的table[i]已经转移到新的table中了，有的还在旧的table中，此时有get()线程访问旧table[]，我们会新建一个`ForwardingNode`用于存放新的table的引用，保证get到的是新的table中的数据。那如果是put线程呢？会调用`helpTransfer`来帮助最早扩容的线程来进行扩容。
>
> 5. 与Hashmap中关于链表的扩容一致，会通过`hashcode & length == 0`判断是否需要移位，如果需要移位，那么移位后的`index = oldIndex + oldCap`。
>
> 6. 总体流程：
>
>    ① 计算`stride步长`，一般值为16，如果扩容后数组`nextTable = null`，则初始化nextTable，且大小是扩容前table的2倍。
>
>    ② 当前线程`基于stride步长和transferIndex(即old table大小)`开始获取扩容任务，直到CAS修改`transferIndex`成功即视为获取任务成功，准备执行扩容。
>
>    ③ 如果finishing = true表明扩容任务完成，如果当前`table[i] = null，说明table[i]`迁移完成，那么会放置`FowardingNode`用于将get线程`请求转发(nextTable记录新table引用)`去查询新的table。
>
>    ④ 最终进行扩容，根据链表或红黑树分开扩容，链表使用了链表平移的优化方法(`扩容后链表顺序非绝对倒序`)，直到所有线程分别扩容结束，扩容流程才结束。

---

### get

```java
public V get(Object key) {
    Node<K,V>[] tab; Node<K,V> e, p; int n, eh; K ek;
    // 计算key的hashcode
    int h = spread(key.hashCode());
    // 如果table不为空且table[i]的值不为null
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (e = tabAt(tab, (n - 1) & h)) != null) {
        // 如果hashcode相同
        if ((eh = e.hash) == h) {
            // 并且key相同
            if ((ek = e.key) == key || (ek != null && key.equals(ek)))
                // 返回该位置的value
                return e.val;
        }
        // eh=-1说明当前节点时ForwardingNode节点
        // eh=-2说明是TreeBin
     	// 不同类型调用各自的find方法
        else if (eh < 0)
            return (p = e.find(h, key)) != null ? p.val : null;
        // eh>=0,说明该节点下挂的是链表，直接遍历链表
        while ((e = e.next) != null) {
            if (e.hash == h &&
                ((ek = e.key) == key || (ek != null && key.equals(ek))))
                return e.val;
        }
    }
    // 如果查不到就返回null
    return null;
}
```

> 为什么get()方法不需要加锁？
>
> 因为Node类的`属性value被volatile修饰`，保证线程间的可见性。因为是无锁的，所以性能能够大幅提升。
>
> 但是`ConcurrentHashMap`和`CopyOnWriteArrayList`一样，都是保证了`数据最终一致性，不能保证实时一致性`。因为`读写不互斥`，所以线程获取某个key的时候是看不到另一个线程正在添加或修改该key的值。

---

### 扩容时机

- 执行put()方法中如果`同一位置下节点数超过8个且数组长度小于64时`，会调用treeifyBin()方法进行扩容。
- 执行put()方法中如果检测到节点的`hash值 = MOVED`，那么会调用`helpTransfer`进行协助扩容。
- 执行put()方法中的`addCount`方法，如果数组元素发生改变有可能调用扩容。
- 执行putAll()时如果`当前数组大小超过了扩容阈值`，会进行扩容。

### 扩容时的读写操作

- 当数组正在扩容时，某线程调用了`get`方法，那么如果对应的table[i]已经全部迁移，那么只需要通过table[i]位置中的`FowardingNode.nextTable`属性获取新的table的引用。
- 当数组正在扩容时，某线程调用了`put`方法，那么当前线程会调用`helpTransfer`方法协助进行扩容。