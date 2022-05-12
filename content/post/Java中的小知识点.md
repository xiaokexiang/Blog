---
title: "Java中的小知识点"
date: 2022-05-12T17:55:10+08:00
description: "Java中一些零散，容易混淆的小知识点。"
tags: ["Java "]
categories: [
  "Java"
]
hideReadMore: true
---

## 1. Java是值传递还是引用传递

结论： Java只有值传递没有引用传递。

值传递与引用传递的区别：`对形参的修改不会影响到实参被称为值传递。引用传递则相反。`

```java 
public static void change(Integer i) {
    i = 3;
}

public static void change(Person person) {
    person.name = "李四";
}

public static void main(String.. args) {
    Integer x = 1;
    change(x);
	System.out.println(x); // x = 1;
    
	Person person = new Person("张三");
    change(person);
    System.out.println(person.getName()); // "李四"
}
```

> 1. 如果是基本数据类型，是将数据复制一份传递给方法，自然不会影响。
> 2. 如果是对象做参数时，将堆中对象的引用复制一份传递给方法，`引用的地址不会被修改（也是被称为值传递的根本原因`)，但是地址的内容会被函数修改。

---

## 2. 包装类Integer中的缓存池

```java
Integer x = 123;
Integer y = 123;
System.out.println(x == y); // true

Integer a = 128;
Integer b = 128;
System.out.println(a == b); // false
System.out.println(a.equals(b)); // true

Integer z = Integer.valueOf(123);
Integer w = new Integer(123);
System.out.println(x == z); // true
System.out.println(z == w); // false
```

> 1. Integer类型的缓存池的范围是`[-128, 127]`，只要是这个范围的值自动装箱就会返回相同的对象。
> 2. Integer类型中的equals()方法是对`包装的值`进行了比较，而不是比较对象。
> 3. valueOf()方法利用了缓存，符合第一条的规则。
> 4. 如果通过new关键字创建对象，是没用利用缓存，并不符合第一条规则。

---

## 3. 多层嵌套循环跳出问题

> c中可以通过goto语句跳出多层嵌套循环，java保留了goto关键字，但没有任何作用。

```java
public static void main(String[] args) {
        int[] a = new int[]{1, 2};
        int[] b = new int[]{4, 5};

        loop_a:
        for (int j : a) {
            for (int k : b) {
                if (k == 5) {
                    break loop_a; // 跳出最外层循环
                }
                System.out.println(j + " -> " + k); // 1 -> 4
            }
        }
    
        System.out.println("------------------------");
    
        loop_b:
        for (int j : a) {
            for (int k : b) {
                if (k == 5) {
                    continue loop_b; // 跳过内层循环值为5的，继续从外层的下一个数开始执行
                }
                System.out.println(j + " -> " + k); // 1 -> 4; 2 -> 4
            }
        }
    }
}
```

---

## 4. String对象的创建

> 字符串常量池（String Common Pool）：因为字符串的大量创建会影响程序的性能，JVM引入了`字符串常量池`来减少字符串性能的开销（也基于字符串的不可变性才能实现）。

```java
String a = "abc";
String b = new String("abc");
String c = "a" + "b" + "c";
String d = a.intern();
String e = b.intern();
System.out.println(a == b); //  false
System.out.println(a == c); //  true
System.out.println(a == d); //  true
System.out.println(d == e); //  true
```

### 字面量创建对象

![String字面量](https://image.leejay.top/img/String字面量.png)

### new关键字创建对象

![image-20220512175258152](https://image.leejay.top/img/image-20220512175258152.png)

### String.intern()

> 当调用 intern 方法时，如果池中已经包含一个等于该String对象的字符串，`由equals(Object)方法确定`，则返回池中的字符串。否则，将此String对象添加到池中并返回对该String对象的引用。

![微信截图_20220512175811](https://image.leejay.top/img/微信截图_20220512175811.png)