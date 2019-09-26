---
title: 由final引出的String问题浅析
date: 2019-09-26 11:09:18
tags: Java
toc: true
categories:
  - Java
thumbnail: https://www.hrwlawyers.com/assets/stock-footage-stamp-final.jpg
---

### final 的基本用法

`final 可用于修饰类、方法、变量(包括成员变量和局部变量)`

#### final 修饰类

`final 修饰类表明这个class类是不能被继承的, 同时这个class类的成员方法全部隐式的被指定为final方法`

```java
public final class A {
    // echo 方法隐式的被指定为final方法
    public (final) void echo() {
        System.out.println("i'm A!");
    }
}

// final类是无法被继承的
public class B extends A {

}

```

<!--more-->

#### final 修饰方法

`final 修饰方法一方面能够防止任何继承类修改它的语义, 需要注意的是private修饰的方法会被隐式的指定为final方法`

```java
public class C {
    public final void echo() {
        System.out.println("i'm C")
    }
    // private 方法隐式的被指定为final方法
    private void hello() {
        System.out.println("i'm C")
    }
}

public class D extends C {
    // 无法被重写
    // @Override
    // public final void check() {
    //     super.check();
    // }
}
```

#### final 修饰变量

`final 修饰基本数据类型的变量, 那么数值在初始化之后不能被修改。引用类型的变量在初始化之后不能让其指向另一个对象`

```java
class D {
    public static final int i = 0;
    public static final String str = "str";

    public static void main(String[] args) {
        // i & str 不能够被重新赋值或指向
        i = 2;
        str = "string";
    }
}

```

---

### final 深入理解

#### final 变量与普通变量的区别

`当final变量是基本数据类型和String类型的时候, 如果在编译期的时候就能够知道它的值, 那么编译器会把它当作常量来使用, 如果不知道具体的值就不会这么做。`

```java
public static void main(String[] args) {
    String a = "Hello2";
    final String b = "Hello";
    String c = "Hello";
    // 相当于两个常量相加
    String d = b + 2;
    String e = c + 2;
    System.out.println(a == d); // true
    System.out.println(a == e); // false
}
```

> 这里涉及到一个概念:
> 常量池指的是`在编译期被确定, 并被保存在已编译的.class 文件中的一些数据。它包括了关于类、方法、接口等中的常量, 也包括字符串常量。`
> 其次`当final修饰的变量是基本数据类型或String类型的数据, 且在编译器就知道它的值, 那么编译器会把它当作常量来使用`, 这样创建 d 字符串对象的时候发现常量池中已存在 hello2, 所以返回的是引用 a 给到 d, 所以 a == d 返回 true。
> c 是字符串 hello 在常量池中的引用, `它会将 2 转成 String 类型, 利用 Stringbuffer 进行 append 并将新的字符串结果引用赋予 e`, 所以 a == e 返回的是 false

#### final 修饰引用变量

`final 修饰的引用变量它指向对象的成员变量可以被修改`

```java
public class A {
    public static void main(String[] args) {
        B b = new B();
        System.out.println(++ b.state); // 1
    }
}


class B {
 public int state = 0;
}
```

> 资料来源：https://www.cnblogs.com/dolphin0520/p/3736238.html

---

### 拓展

#### == & equals 的区别

- 针对基本数据类型, == 是用于比较它们的值。
- 针对引用数据类型, == 是用于比较它们内存中的的地址, 在没有覆写 equals 方法的前提下, equals 也是比较内存中的地址(例如 Object)。

```java
// jdk1.8
public boolean equals(Object obj) {
    return (this == obj);
}
```

#### String.equals 源码解析

`String不是java中的基本数据类型, 它是一个final修饰的类, 是一个引用类型。对于基本类型, java虚拟机会为其分配数据类型实际占用的内存空间, 而对于引用类型变量, 它仅仅是一个指向堆区中某个实例的指针`

```java
public boolean equals(Object anObject) {
    // 1. 比较引用, 相同则返回true
    if (this == anObject) {
        return true;
    }
    // 2. 比较类型, 看是不是String
    if (anObject instanceof String) {
        String anotherString = (String)anObject;
        int n = value.length;
        // 3. 比较字符长度是否相同, 不同返回false
        if (n == anotherString.value.length) {
            char v1[] = value;
            char v2[] = anotherString.value;
            int i = 0;
            while (n-- != 0) {
                // 4. 依次比较字符是否相同, 不同返回false
                if (v1[i] != v2[i])
                    return false;
                i++;
            }
            return true;
        }
    }
    // 5. 校验都通过返回true
    return false;
}
```

#### String == & equals

```java
public static void main(String[] args) {
    String a = "string";
    String b = "string";
    String c = new String("string");
    System.out.println(a == b); // true
    System.out.println(a == c);// false
    System.out.println(a == c.intern()); // true
    System.out.println(a.equals(b)); // true
}
```

> 第一个: == 进行的是内存地址的比较, 为什么相同呢? 是因为`b 在创建对象的时候会去常量池查看是否已存在相同Unicode的字符串常量, 如果存在就将该对象指向 b ,不存在就创建新的对象指向 b`
> 第二个: a 创建的 string 存在于常量池, 而 `new String("string")会在堆内存开辟一块区域, 栈内存存在该对象的引用`, 而==是进行内存地址比较, 所以为 false
> 第三个: 需要理解 intern()方法的含义：`存在于.class文件中的常量池, 在运行期间被JVM装载并可以被扩充。String.intern()会去常量池查看是否存在和string的Unicode相同的字符常量,存在就返回其引用, 不存在就增加一个字符常量并返回它的引用`。因为 a 先被创建, 所以 c.intern()返回的是 a 的字符串的引用, 所以结果为 true。
> 第四个: String 对 equals 进行了复写, 语义是进行字符值的对比, 因为 a 和 b 都是"string",所以返回 true

### 写在最后

主要是复习 final 关键字从而引出关于 String 类型以及==&equals 的问题, 这些问题虽小, 但是面试中经常能遇到, 今天总结下也是希望自己能够在面试或者工作中不要犯类似的错误, hahahaha~~~
