---
title: "HashMap的几点注意事项"
date: 2021-04-07T11:03:14+08:00
description: "阅读HashMap源码中需要注意的几点细节。"
tags: ["HashMap "]
categories: [
  "HashMap"
]
slug: hashmap
---
## HashMap的几点注意事项

### 数组的创建时机

```java
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
        Node<K,V>[] tab; Node<K,V> p; int n, i;
        if ((tab = table) == null || (n = tab.length) == 0)
            n = (tab = resize()).length;
     // 省略代码
}
static final int DEFAULT_INITIAL_CAPACITY = 1 << 4
final Node<K,V>[] resize() {
    // 省略代码
	else {
        // 初始容量16
        newCap = DEFAULT_INITIAL_CAPACITY;
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);
    }
    Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    // 省略代码
    return newTab;
}

static final float DEFAULT_LOAD_FACTOR = 0.75f;
public HashMap() {
    this.loadFactor = DEFAULT_LOAD_FACTOR; // 扩容因子赋值
}
```

> 当我们通过`new HashMap<>()`创建HashMap对象时，它只是对扩容因子进行赋值，并没有创建`Node<K,V>[]`，只有在第一次执行`putVal()`才会创建。

### 节点转换为红黑树的时机

```java
@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest
public class BaseTest {
    @Test
	public void tree() {
		HashMap<Key, Integer> map = new HashMap<>();
		map.put(new Key(), 1);
		map.put(new Key(), 2);
		map.put(new Key(), 3);
		map.put(new Key(), 4);
		map.put(new Key(), 5);
		map.put(new Key(), 6);
		map.put(new Key(), 7);
		map.put(new Key(), 8); // ①
		map.put(new Key(), 9); // ②
		System.out.println("map 转换为红黑树了吗？");
	}

	static class Key {
		@Override
		public int hashCode() {
			return 1;
		}
	}
}
```

根据以上代码问：第几步时会执行方法`treeifyBin`将Node节点转换为红黑树？

先说答案：执行`第二步`的时候会转换为红黑树。

```java
static final int TREEIFY_THRESHOLD = 8; 
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
    // 代码省略
    		// 执行到此说明：tab已经初始化，对应的tab位置不为null
            // 且新增的key和原有的key，hash相同，equals不同
            for (int binCount = 0; ; ++binCount) { // 遍历该tab[i]下的所有node依次进行比较
                // 如果遍历到最后一个节点且不和之前的节点value相同。
                if ((e = p.next) == null) { 
                    p.next = newNode(hash, key, value, null); 
                    // binCount初始为0，只要binCount=7时就触发转换为红黑树
                    if (binCount >= TREEIFY_THRESHOLD - 1)
                        treeifyBin(tab, hash);
                    break;
                }
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    // 如果hash，equals都相同需要替换
                    break;
                // 否则继续下一个节点
                p = e;
            }
        }
    }
    // 代码省略
    return null;
}

static final int MIN_TREEIFY_CAPACITY = 64;
// 转换为红黑树
final void treeifyBin(Node<K,V>[] tab, int hash) {
    int n, index; Node<K,V> e;
    // 核心：只有当当前容量大于64时才会转换为红黑树，否则只是扩容
    if (tab == null || (n = tab.length) < MIN_TREEIFY_CAPACITY)
        resize(); // 扩容
    else if ((e = tab[index = (n - 1) & hash]) != null) {
        // 省略转换为红黑树代码
    }
}
```

> 核心在于`binCount初始值为0`，与`TREEIFY_THRESHOLD - 1`进行比较，并且只有当指定位置的tab[i]已经有值之后才会进入上述方法，所以当插入`第九个值`的时候且就会触发红黑树转换方法。
>
> 但是！！！它只有在`HashMap的容量大于MIN_TREEIFY_CAPACITY(64)`的时候才会转换为红黑树，否则只是扩容！

### 数组的扩容时机

```java
@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest
public class BaseTest {
    
	static class Key2 {
	}

	@Test
	public void map() {
		HashMap<Key2, Integer> map = new HashMap<>();
		map.put(new Key2(), 1);
		map.put(new Key2(), 2);
		map.put(new Key2(), 3);
		map.put(new Key2(), 4);
		map.put(new Key2(), 5);
		map.put(new Key2(), 6);
		map.put(new Key2(), 7);
		map.put(new Key2(), 8);
		map.put(new Key2(), 9);
		map.put(new Key2(), 10);
		map.put(new Key2(), 11);
		map.put(new Key2(), 12); // ①
		System.out.println("map 扩容了吗？");
		map.put(new Key2(), 13); // ②
	}
}
```

根据上述代码问：第几步进行了HashMap扩容？

先说答案：`第二步`。

我们知道扩容因子是`0.75`，即当HashMap当前的容量为16，它的扩容阈值是`16 * 0.75 = 12`。

```java
transient int size;
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
                   boolean evict) {
    // 默认情况下是capcity * 0.75
    // size初始值为0
  	if (++size > threshold)
       resize(); // 扩容操作
}
```

> size的初始值是0，但是进行比较的时候是`++size`先加1再比较。所以当容量是16时，扩容阈值是12，那么插入`第13个值`就会触发`resize()`进行扩容。

