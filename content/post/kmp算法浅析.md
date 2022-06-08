---
title: "Kmp算法浅析"
date: 2022-06-08T15:52:15+08:00
tags: ["kmp "]
description: "KMP算法是第一个用于字符串匹配的`线性`时间算法"
categories: [
  "algorithm"
]
weight: 10
mermaid: true 
hideReadMore: true
---


> <a href="https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm">KMP算法</a>：一种字符串搜索算法。是第一个用于字符串匹配的`线性`时间算法。


## 暴力匹配

在字符串匹配中，若我们使用暴力破解对`主串`和`子串`进行匹配，当匹配失败就回退到主串的下一个字符重新开始匹配。在最坏的情况下，此种方式的时间复杂度为`O(m*n)`。匹配流程下图所示。

![字符串匹配](https://image.leejay.top/img/字符串匹配.gif)

## KMP算法

### 基本概念

> KMP算法（由`K`nuth、`M`orris、`P`ratt三人共同发表），其特点就是在一次字符串的遍历过程中就可以匹配出子串。其时间复杂度是`O(m+n)`。
>
> KMP算法中的核心概念就是基于`最大公共前后缀`生成`next`数组，在匹配失败的时候避免了暴力算法中的`回退`所带来的高时间复杂度问题。

![kmp演示流程](https://image.leejay.top/img/kmp1.gif)

在理解KMP算法的核心概念`最大公共前后缀`之前，我们需要先明白`前缀`和`后缀`的含义。

- 前缀：在字符串中除了最后一个字符外，所有以`第一个字符开始`的连续子串。

- 后缀：在字符串中除了第一个字符外，所有以`最后一个字符结尾`的连续子串。

由此可以得出最大公共前后缀：在字符串里`所有前缀和后缀相等的子串中最长的那个(不能超过字符串长度)`。

{{<mermaid>}}
graph LR
    A("ABAA")
    A --> B("最大前缀: ABA")
    A --> C("最大后缀: BAA")
    A --> D("最大公共前后缀: A")
{{</mermaid>}}

基于最大公共前后缀生成的`next数组`就是用于记录`子串`中不同位置的最大公共前后缀长度。也就是当匹配失败的时候，子串需要`回退`的位置。那么next数组是如何计算的呢？参考下图手算next数组流程。

![手算next数组](https://image.leejay.top/img/next11.gif)

> 1. next数组的第一位默认是-1，即当匹配失败的时候，`子串往后移动一位继续匹配`。
> 2. next数组的作用：若子串的第n个位置的与主串不匹配，那么需要将子串回退到next[n]的位置再次进行匹配。
> 3. 计算next[n]最大公共前后缀的子串范围是$P_0P_1...P_{n-1}$。

### 代码推导

#### next数组推导

![next数组推导](https://image.leejay.top/img/next2.gif)

> 1. 若计算next[i+1]的值时，必然已经知道next[i]的值（类似动态规划）。
> 2. 假设next[i]=k，根据最大公共前后缀定义，那么此时必有：$C_0C_1...C_{k-1}=C_{i-k}...C_{i-1}$。
> 3. 若$C_k=C_i$，则 $next[i+1] = k + 1$。
> 4. 若$C_k != C_i$, 若 $next[k] = z$，根据最大公共前后缀定义，此时必有：$C0...C_{z-1} = C_{k-z}...C_{k-1} = C_{i-k}...C_{i-k+z-1} = C_{i-z}...C_{i-1}$，结合第二步的结果可得：$C0...C_{z-1} = C_{i-z}...C_{i-1}$。
> 5. 若$ C_{k-z} = C_{i} $，那么 $ next[i+1] = z + 1$。如果不相等则重复上述流程，直到最长公共前后缀的值为0就停止循环查找。

```java
private static int[] getNext(char[] array) {
    final int length = array.length;
    int[] next = new int[length];
    int i = 0, j = -1;
    // -1表示从子串的下一位开始匹配
    next[i] = j;
    while (i < length - 1) {
        if (j == -1 || array[i] == array[j]) {
            next[++i] = ++j; // 相等就是在next[i]的基础上加一
        } else {
            j = next[j]; // 不相等就继续往前查找
        }
    }
}
```

#### 字符串匹配

```java
/**
 * 根据next数组进行匹配，返回匹配成功的第一个index，不匹配则返回-1
 */
public static int indexOf(char[] parent, char[] child) {
    int[] next = getNext(child);
    int p = parent.length;
    int c = child.length;
    int i = 0, j = 0;
    for (; i < p; i++) {
        // 子串循环完毕就退出
        if (j == c) {
            break;
        }
        // 因为next数组第一位必定是-1.额外处理下
        if (j == -1 || parent[i] == child[j]) {
            j++;
        } else {
           // 不相等就根据next数组回退指定位置
            j = next[j];
        }
    }
    return i == p - 1 ? -1 : i - j;
}
```

> kmp是典型的`空间换时间`算法，其核心就是基于最大公共前后缀生成的next数组，从而避免了指针回溯问题。