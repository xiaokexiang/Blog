---
title: "CAS乐观锁浅析"
date: 2020-06-12T22:49:05+08:00
description: "Java并发中`乐观锁的实现`，大部分并发框架都基于CAS实现。"
tags: ["CAS ","原子性"]
categories: [
  "Concurrent"
]
hideReadMore: true
---

判断数据是否被修改，同时写回新值，这两个操作要合成一个原子操作，这就是CAS(compare and swap)。

之前多线程环境下，我们对变量进行计算都是对其加锁来实现，但是现在我们可以用过Atomic相关的类来实现相同的效果且性能更好。而`AtomicInteger`就是其中的一员，其底层就是通过CAS来实现的。

```java
// 伪代码
class AtomicInteger {
	// 保证内存可见性
	private volatile int value;
	
	public final int getAndIncrement() {
		for(;;) {
            int current = get();
            int next = current + 1;
            // cas替换
            if (compareAndSwap(current, next)) {
            	return current;
            }
		}
	}
	
	public int get() {
		return value;
	}
}
```

> 乐观锁：读操作不上锁，等到写操作的时候，判断数据在此期间是否被修改，如果已被修改，则重复该流程，直到把值写回去。CAS就是乐观锁的体现。

CAS的相关方法都被封装在`Unsafe类`中，我们以`AtomicInteger中操作compareAndSwapInt()`为例。

```java
/**
 * var1: 这里就是AtomicInteger对象
 * var2: AotmicInteger 中的成员变量，long型整数，变量在类中的内存偏移量
 *       可以通过unsafe.objectFieldOffset(Field var1)来获得
 * var4：变量的旧值
 * var5: 变量的新值
 */
public final native boolean compareAndSwapInt(Object var1, long var2, int var4, int var5)
```

> Unsafe类提供了三种类型的CAS操作：int、long、Object，分别对应compareAndSwapInt()、compareAndSwapLong()、compareAndSwapObject()。
---
#### ABA问题

因为CAS是基于值来做比较的，如果线程A将变量从X改成Y，又改回X，尽管改过两次，但是线程B去修改的时候会认为这个变量没有被修改过。

#### AtomicStampedReference

`AtomicStampedReference通过引入值和版本号的概念`用于解决CAS中ABA的问题。

```java
public class AtomicStampedReference<V> {
	// 通过静态内部类构建Pair对象实现compareAndSwapObject()
    private static class Pair<T> {
        final T reference;
        final int stamp;
        private Pair(T reference, int stamp) {
            this.reference = reference;
            this.stamp = stamp;
        }
        static <T> Pair<T> of(T reference, int stamp) {
            return new Pair<T>(reference, stamp);
        }
    }

    private volatile Pair<V> pair;
    // 先判断expect、new与current是否相等，再决定是否的调用cas判断
    public boolean compareAndSet(V   expectedReference,
                                 V   newReference,
                                 int expectedStamp,
                                 int newStamp) {
        Pair<V> current = pair;
        return
            expectedReference == current.reference &&
            expectedStamp == current.stamp &&
            ((newReference == current.reference &&
              newStamp == current.stamp) ||
             casPair(current, Pair.of(newReference, newStamp)));
    }
    
    // compareAndSwapObject()
    private boolean casPair(Pair<V> cmp, Pair<V> val) {
        return UNSAFE.compareAndSwapObject(this, pairOffset, cmp, val);
    }
}
```

> 通过判断新旧引用与版本号是否相等来判断修改是否成功。

---

#### AtomicMarkableReference

与`AtomicStampedReference`类似，但是其内部类传入的是`引用 + boolean值`。

```java
public class AtomicMarkableReference<V> {

    private static class Pair<T> {
        final T reference;
        // 与AtomicMarkableReference相比不同点
        final boolean mark;
        private Pair(T reference, boolean mark) {
            this.reference = reference;
            this.mark = mark;
        }
        static <T> Pair<T> of(T reference, boolean mark) {
            return new Pair<T>(reference, mark);
        }
    }

    private volatile Pair<V> pair;
    ... 
}
```

> 因为Pair<T>只接受boolean值作为版本号，所以不能完全避免ABA问题，只能是降低发生的概率。

---

#### AtomicIntegerFieldUpdater

用于实现对`某个不能修改源代码类的、被volatile修饰的成员变量`的原子操作。

```java
public abstract class AtomicIntegerFieldUpdater<T> {
    
    // 传入需要修改的类的class对象以及对应成员变量的名字
    public static <U> AtomicIntegerFieldUpdater<U> newUpdater(Class<U> tclass,
                                                          String fieldName) {
        // 调用实现类构造参数，会判断volatile修饰的成员变量类型是否是int
        return new AtomicIntegerFieldUpdaterImpl<U>
            (tclass, fieldName, Reflection.getCallerClass());
    } 
    
    // 由AtomicIntegerFieldUpdater实现类实现
    public final boolean compareAndSet(T obj, int expect, int update) {
        // 判断obj是不是上面tclass类型
        accessCheck(obj);
        // 最终还是调用compareAndSwapInt去更新值
        return U.compareAndSwapInt(obj, offset, expect, update);
    }
}
```

> 除了AtomicIntegerFieldUpdater，同样有AtomicLongFieldUpdater和AtomicReferenceFieldUpdater。

---

#### AtomicIntegerArray

实现对数组元素的原子操作，并不是对整个数组，而是针对数组中的一个元素的原子操作。

```java
// 获取数组的首地址的位置
private static final int base = unsafe.arrayBaseOffset(int[].class);
// shift标识scale中1的位置(因为scale=2^*，所以scale中只会有一位是1，这个位置即shift)
private static final int shift;
static {
    // 确保scale是2的整数次方: 2^*
    int scale = unsafe.arrayIndexScale(int[].class);
    if ((scale & (scale - 1)) != 0)
        throw new Error("data type scale not a power of two");
    // 返回scale中最高位之前的0
    shift = 31 - Integer.numberOfLeadingZeros(scale);
}
/**
 * i：即为脚标，会被转换成内存偏移量
 * expect：期待的int值
 * update：更新的int值
 */
public final boolean compareAndSet(int i, int expect, int update) {
	return compareAndSetRaw(checkedByteOffset(i), expect, update);
}

private long checkedByteOffset(int i) {
    if (i < 0 || i >= array.length)
        throw new IndexOutOfBoundsException("index " + i);
    return byteOffset(i);
}
// 最终在这里转换成内存偏移量
// 数组的首地址 + 脚标(第几个) * 数组元素大小sacle
private static long byteOffset(int i) {
    // 也就是 i * scale + base
    return ((long) i << shift) + base;
}
// array即为int[]对象 offset即为内存偏移量
private boolean compareAndSetRaw(long offset, int expect, int update) {
    return unsafe.compareAndSwapInt(array, offset, expect, update);
}
```

> 除了AtomicIntegerArray还包括AtomicLongArray和AtomicReferenceArray。

---

#### Striped64及相关子类

JDK8之后又提供了`Striped、LongAddr、DoubleAddr、LongAccumulator和DoubleAccumulator`用于实现对`long和double`的原子性操作。

LongAddr类，其原理是`将一个Long型拆分成多份，拆成一个base变量外加多个cell，每一个cell都包装了一个Long型变量，高并发下平摊到Cell上，最后取值再将base和cell累加求sum运算`。Cell就存在于LongAddr抽象父类Striped64中。

```java
abstract class Striped64 extends Number {
    // 一个base+多个cell
	@sun.misc.Contended static final class Cell {
        // volatile修饰的long型变量
        volatile long value;
        Cell(long x) { value = x; }
        final boolean cas(long cmp, long val) {
            // CAS
            return UNSAFE.compareAndSwapLong(this, valueOffset, cmp, val);
        }

        // Unsafe mechanics
        private static final sun.misc.Unsafe UNSAFE;
        // Cell中value在内存中的偏移量
        private static final long valueOffset;
        static {
            try {
                UNSAFE = sun.misc.Unsafe.getUnsafe();
                Class<?> ak = Cell.class;
                // 获取偏移量
                valueOffset = UNSAFE.objectFieldOffset
                    (ak.getDeclaredField("value"));
            } catch (Exception e) {
                throw new Error(e);
            }
        }
    }
}
// LongAdder base 初始值是0 只能进行累加操作
public class LongAdder extends Striped64 implements Serializable {
    // 求总值
	public long sum() {
        Cell[] as = cells; Cell a;
        long sum = base;
        if (as != null) {
            // 循环读取累加，非同步
            for (int i = 0; i < as.length; ++i) {
                if ((a = as[i]) != null)
                    sum += a.value;
            }
        }
        return sum;
    }
}
// LongAccumulator与LongAdder不同点在于构造函数，LongAccumulator可以自定义操作符和初始值
public class LongAccumulator extends Striped64 implements Serializable {
	public LongAccumulator(LongBinaryOperator accumulatorFunction,
                           long identity) {
        this.function = accumulatorFunction;
        base = this.identity = identity;
    }
}
    
```

> 相比于AtomicLong，LongAddr更适合于高并发的统计场景，而不是对某个Long型变量进行严格同步的场景。

---

#### 伪共享与缓存行填充

JDK8中通过`@sun.misc.Contented`注解实现缓存行填充的作用。

在CPU架构中，每个CPU都有自己的缓存。`缓存与主内存进行数据交换的基本单位叫Cache Line缓存行`。在64位的X86架构中，缓存行大小是64byte(8个long型)，意味着当缓存行失效，需要刷新到主内存的时候，最少需要刷新64字节。

![](https://image.leejay.top/image/20200605/Q1vhuTbvuFNq.png?imageslim)

我们假设主内存中有x，y，z三个Long型变量，被Core1和Core2读到自己的缓存，放在同一个缓存行，当Core1对变量x进行修改，那么它需要`失效一整行Cache Line`，并通过CPU总线发消息通知Core2对应的Cache Line失效。`所以即使y和z没有被修改，因为和x处于同一个缓存行，所以x、y、z都需要失效，这就叫做伪共享问题`。

我们通过将x，y，z三个变量分布到不同的缓存行并且填充7个无用的Long型来填充缓存行，用于避免`伪共享问题`，JDK8之前都是通过下面的类似代码来实现，JDK8之后则是通过`@sun.misc.Contented`实现此功能。

```java
class Test {
    volatile long value;
    long a ,b ,c ,d ,e ,f ,g;
}

@sun.misc.Contended class demo{
    volatile long value;
}
```

---