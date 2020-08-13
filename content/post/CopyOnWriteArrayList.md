---
title: "CopyOnWriteArrayList源码解析"
date: 2020-07-08T11:50:04+08:00
description: "`CopyOnWriteArrayList`是ArrayList的线程安全变体，是通过`生成新的副本`来实现线程安全。"
tags: ["CopyOnWriteArrayList "]
categories: [
  "Concurrent",
  "Collection"
]
hideReadMore: true
---

### CopyOnWriteArrayList

> `CopyOnWrite`思想是计算机程序设计领域的一种优化策略。若有多个调用者同时要求相同的资源，他们会获得`共同的指针`指向相同的资源，直到某个调用者试图修改资源的时候，才会`复制一份副本`给该调用者，但`其他调用者见到的最初资源不改变`，此过程`对其他调用者透明`。
>
> `CopyOnWriteArrayList`是ArrayList的线程安全变体，通过`生成新的副本`来实现。

#### 构造

```java
public class CopyOnWriteArrayList<E>
    implements List<E>, RandomAccess, Cloneable, java.io.Serializable {
    
  	// 内部独占锁
    final transient ReentrantLock lock = new ReentrantLock();
	// volatile 修饰的数组，只能getArray和setArray操作
    private transient volatile Object[] array;
	// 返回当前数组
    final Object[] getArray() {
        return array;
    }
	// 设置数组
    final void setArray(Object[] a) {
        array = a;
    }
	// 构造函数 创建一个空数组
    public CopyOnWriteArrayList() {
        setArray(new Object[0]);
    }
}
```

> 底层是通过数组实现，数组使用`volatile`修饰保证了多线程之间的可见性。

---

### add

```java
public boolean add(E e) {
    // 获取独占锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取当前的数组，此时不会存在其他线程修改了数组
        // 只是add期间若有其他线程查询，那么查到的是旧的数据
        Object[] elements = getArray();
        // 获取数组长度
        int len = elements.length;
        // copy数组并将数组扩大1
        Object[] newElements = Arrays.copyOf(elements, len + 1);
        // 将元素插入数组的最后
        newElements[len] = e;
        // 设置数组到成员变量array中
        setArray(newElements);
        return true;
    } finally {
        lock.unlock();
    }
}
```

> add操作需要获取独占锁，在执行add操作期间，若有其他线程执行查询操作，那么它获得将会是旧的数据。在add操作之后查询，获得会是最新的数据。
>
> 底层调用的时`System.arraycopy`实现数组的拷贝，需要注意：
>
> 1. 此方法属于`浅拷贝（复制的是对象的引用）`，如果是数组类型是对象，那么`拷贝后的数组持有的是原数组的引用`。所以`拷贝后的数组修改会影响原数组`。
> 2. 如果数组类型是基本数据类型（值位于常量池），那么`拷贝只是修改数组中元素的指向`，并不是在常量池中又复制了一份。
>
> ![](https://image.leejay.top/image/20200709/BlpbAEFkBDBa.png?imageslim)

---

### remove

```java
// 移除指定index元素
public E remove(int index) {
    final ReentrantLock lock = this.lock;
    // 获取独占锁
    lock.lock();
    try {
        // 获取数组
        Object[] elements = getArray();
        // 获取数组length
        int len = elements.length;
        // 获取old数组[index]数据
        E oldValue = get(elements, index);
        // index + 1 = length 
        int numMoved = len - index - 1;
		// numMoved = 0说明移除的是数组的最后一个元素
        if (numMoved == 0)
            // 直接将长度减1直接copy即可。
            setArray(Arrays.copyOf(elements, len - 1));
        else {
            // 否则说明移除的是中间的元素
            // 创建小1的数组
            Object[] newElements = new Object[len - 1];
            System.arraycopy(elements, 0, newElements, 0, index);
            System.arraycopy(elements, index + 1, newElements, index, numMoved);
            // 设置拷贝后的新数组
            setArray(newElements);
        }
        // 返回被删除的旧值
        return oldValue;
    } finally {
        lock.unlock();
    }
}
```

> remove方法的难度在于`如何移除oldValue并将原有的数据平移到新的数组中`。
>
> 我们假设`Object[] objs = [2, 3, 5, 7, 9];length = 5,index<=length-1`：
>
> 1. 如果我们移除的是`index = 4`的元素（即最后一个元素），那么直接创建`length = 4`的数组，将数据直接拷贝过去就行，变成`[2,3,5,7]`。
> 2. 如果我们移除是第三个元素(index = 2)，那么按照源码中的方法：第一次拷贝后，`newElements = [2,3]`，此时`numMoved = 2`，那么执行第二个拷贝之后，`newElements = [2,3,7,9]`。 

---

### set

```java
// 将数组的指定index改成指定值
public E set(int index, E element) {
    final ReentrantLock lock = this.lock;
    // 获取独占锁
    lock.lock();
    try {
        // 获取数组
        Object[] elements = getArray();
        // 获取指定index的值
        E oldValue = get(elements, index);
		// 判断新旧值是否相同，相同就不需要更改
        if (oldValue != element) {
            // 计算数组长度
            int len = elements.length;
            // 创建新数组
            Object[] newElements = Arrays.copyOf(elements, len);
            // 将数组的指定indexiu该
            newElements[index] = element;
            // 设置新数组
            setArray(newElements);
        } else {
            // 并非完全禁止操作；确保可变的写语义
            setArray(elements);
        }
        return oldValue;
    } finally {
        lock.unlock();
    }
}
```

> 基于`CopyOnWrite`原理，set方法也需要重新copy一份数组。

---

### get

```java
// 获取某个index元素
public E get(int index) {
    // get的数据有可能不是最新的，因为读写不互斥
    // 此时一个线程已经复制了数据，还没有setArray，get到的就不是最新的
    return get(getArray(), index);
}
// 就是返回数组的index的数据
private E get(Object[] a, int index) {
    return (E) a[index];
}
```

> get方法能够保证每次获取到的数据都是`当时最新`的数据（基于volatile）。

---

### 总结

- `CopyOnWriteArrayList`适用于`读多写少`的并发场景，它允许`null且可以重复`。
- `CopyOnWriteArrayList`添加元素时建议使用`批量添加`，因为每次添加都要复制。
- `CopyOnWriteArrayList`的是通过`写时数组copy`来实现，在写操作的时候，内存中会同时具有两个对象的内存，如果这个数组对象过大，会导致`内存占用`问题。

- `CopyOnWriteArrayList`只能保证`数据的最终一致性`，不保证数据实时一致性（读写不互斥，有线程修改数据已经复制了副本，还未执行setArray时，你读到的就是旧数据）。

> 如果需要使用不重复的`CopyOnWrite`框架，推荐`CopyOnWriteArraySet`。它能够实现不重复，核心原理就是添加的时候通过`addIfAbsent`判断元素是否已存在。