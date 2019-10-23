---
title: Java动态代理浅析
top: 0
toc: true
date: 2019-10-23 14:28:05
tags: Java
categories:
  - Java
thumbnail: https://img.vim-cn.com/73/5eb71e4e4ec291b9ebc9c5bf82426cc8c747ed.png
---

### 前言

写这篇文章, 纯粹是将自己从网络上看来的动态代理相关的知识点进行消化和整合, 文章更多是自己对大神文章的理解和消化(较少自主观点), 便于自己以后使用动态代理相关的知识点的时候能够迅速回忆起来。
除了动态代理, 还有静态代理和 Cglib 代理的简单使用, 在这里贴出大神们文章的地址, 尤其是第一篇：<a href="https://juejin.im/post/5a99048a6fb9a028d5668e62">10 分钟看懂动态代理设计模式</a>, 让我对动态代理的流程有了更深的理解. 而第二篇：<a href="https://segmentfault.com/a/1190000011291179">Java 三种代理模式：静态代理、动态代理和 cglib 代理</a>, 让我明白了不同代理的使用方法和区别。在此感谢上述两篇文章的作者, 顺便提一下文章开头的图片来自 itzhai.com(侵权删)

### 代理模式

凡是解析动态代理的文章, 都不可避免的提到静态代理。那么在理解静态代理之前, 我们需要了解什么是代理？ `汉语意思, 代理就是代为处理的意思, 代理人处理被代理人的事情。`那 Java 的代理模式是什么呢？`代理模式是Java的一种设计模式, 通过代理对象访问目标对象(被代理对象), 在不修改目标对象的前提下达到对目标对象功能的增强。`

### 静态代理

那么在了解完代理概念之后, 我们直接上代码, 先抽象一个 Flyable 接口, 定义了 fly()方法

```java
public interface Flyable {
    void fly();
}
```

其次我们编写一个 Bird 类, 模拟小鸟在空中飞的场景

```java
public class Bird implements Flyable {

    @Override
    public void fly(){
        System.out.println("Bird Flying ...");
        try {
            // 模拟小鸟在空中飞翔的时间
            Thread.sleep(new Random().nextInt(1000));
        } catch(InterruptedException e) {
            e.printStackTrace();
        }
    }
}
```

那么第一个问题来了, 如果我们想知道小鸟在天空飞了多久(或是 Thread.sleep 的随机数是多少), 一般我们在简单测试耗时的时候一般会在执行代码前后添加计时代码, 如下所示

```java
public class Bird2 implements Flyable {

    @Override
    public void fly(){
        System.out.println("Bird Flying ...");
        long beginTime = System.currentTimeMillis();
        try {
            // 模拟小鸟在空中飞翔的时间
            Thread.sleep(new Random().nextInt(1000));
        } catch(InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("Bird Fly time: " + (System.currentTimeMillis() - beginTime));
    }
}
```

上文的代码肯定是 ok 的, 那么如果 Flyable 是无法修改的, 是 jar 包里面的类呢？那么我们可以使用继承来实现

```java
public class Bird2 extends Bird {

    @Override
    public void fly() {
        long beginTime = System.currentTimeMillis();
        super.fly();
        long endTime = System.currentTimeMillis();
        System.out.println("Fly Time: " + (endTime - beginTime));
    }
}
```

我们也可以使用`聚合(原文作者所写)`的方法, 将 Bird 实例作为参数传入, Bird3.fly() -> Bird.fly()

```java
public class Bird3 implements Flyable {

    private Bird bird;

    public Bird3(Bird bird) {
        this.bird = bird;
    }

    @Override
    public void fly() {
        long beginTime = System.currentTimeMillis();
        bird.fly();
        long endTime = System.currentTimeMillis();
        System.out.println("Fly Time: " + (endTime - beginTime));
    }
}

```

第二个问题来了, 如果我们不仅需要计算小鸟的飞行时间, 还要计算在小鸟的起飞前和着陆后打印 log, 我们该如何实现？
如果我们采用继承的方式, 继续编写 Bird4 类继承 Bird2 类, 代码如下所示

```java
public class Bird4 extends Bird2 {

    @Override
    public void fly() {
        System.out.println("Bird Fly ...");
        super.fly();
        System.out.println("Bird landed ...");
    }

    //    Bird Fly ...
    //    Bird Flying ...
    //    Fly Time: 52
    //    Bird landed ...
}

```

> 这样写没肯定是能实现需求, 但是如果还要继续添加日志, 那我们还需要继续继承, 这样会导致类无限扩展。
> 除了无限扩张, 如果我想先打印时间, 再打印日志这种顺序交换的需求, 那么我们就需要去修改 Bird2 类, 这样灵活性就非常差。

我们采用`聚合`的方式, 稍微修改 Bird3 的代码, 生成 BirdTimeProxy & BirdLogProxy 类

BirdTimeProxy

```java
public class BirdTimeProxy implements Flyable {

    private Flyable flyable;

    public BirdTimeProxy(Flyable flyable) {
        this.flyable = flyable;
    }

    @Override
    public void fly() {
        long beginTime = System.currentTimeMillis();
        flyable.fly();
        long endTime = System.currentTimeMillis();
        System.out.println("Fly Time: " + (endTime - beginTime));
    }
}

```

BirdLogProxy

```java
public class BirdLogProxy implements Flyable {

    private Flyable flyable;

    public BirdLogProxy(Flyable flyable) {
        this.flyable = flyable;
    }

    @Override
    public void fly() {
        System.out.println("Bird Fly start ...");
        flyable.fly();
        System.out.println("Bird fly end ...");
    }
}

```

```java
public static void main(String[] args) {
    Bird bird1 = new Bird();
    BirdTimeProxy birdTimeProxy = new BirdTimeProxy(bird1);
    BirdLogProxy birdLogProxy = new BirdLogProxy(birdTimeProxy);
    birdLogProxy.fly();
    // birdLogProxy.fly() -> birdTimeProxy.fly() -> bird.fly()
}

```

> 1. 我们将 Flyable 接口作为参数传入, 这样在调用的时候会调用具体接口实现类的方法, 这里利用的是`多态(父类引用指向具体的子类实现)`的思想。
> 2. 如果需要修改顺序, 只需要将 main()中的方法调换顺序即可, 保证了灵活性
> 3. 那为什么继承不可以, 而聚合可以呢？类之间的继承更像是包裹的感觉, 子类更像是父类的扩充, 如果要实现调换顺序, 那么就需要新的类模板。
> 4. 聚合是因为代理对象(BirdTimeProxy、BirdLogProxy)和聚合对象(Bird)实现了相同的接口,所以每次传入不同的 Flyable 实现类来修改执行顺序。(不明白可以看下图)。

<img src="https://img.vim-cn.com/21/b167c24906a840f9a800341bcfcac31f114861.png">

至此我们总结下, 什么是静态代理？结合上文, BirdTimeproxy 就是一个静态代理类, 它代理了传入的 Flyable 对象(BirdLogProxy), 而 BirdLogProxy 代理了传入的 Flyable 对象(Bird)。
那么静态代理的特点是

1. `代理类在程序运行前已经存在`,
2. `代理类和被代理类都实现了同一个接口`

静态代理的缺点是：

1. `如果要代理多个类或被代理类中有多个方法, 仍然会产生冗余的代码`

那么我们能否使用同一个代理类代理任意对象呢？比如动态的生成代理类、编译、加载到 jvm 中执行, 并且可以自定义代理逻辑, 这就需要用到我们下章的动态代理。

### 动态代理

<img src="https://user-gold-cdn.xitu.io/2018/3/2/161e5ba2923a81ba?imageslim">
按照上图所示, 如果我们先实现动态代理, 我们先需要实现动态的生成代理类, 其次编译成class类, 加载到JVM中并通过反射运行。

- 利用<a href="https://github.com/square/javapoet">JavaPoe</a> 生成代理类源码

```java
<dependency>
    <groupId>com.squareup</groupId>
    <artifactId>javapoet</artifactId>
    <version>1.11.1</version>
</dependency>
```

```java
public class BirdProxy {

    public static Object newProxyInstance() throws IOException {

        /*
         * public class TimeProxy implements Flyable
         */
        TypeSpec.Builder builder = TypeSpec.classBuilder("TimeProxy").addSuperinterface(Flyable.class);

        /*
         * private Flyable flyable
         */
        FieldSpec flyable = FieldSpec.builder(Flyable.class, "flyable", Modifier.PRIVATE).build();
        builder.addField(flyable);

        /*
         * public TimeProxy(Flyable flyable){this.flyable = flyable}
         */
        MethodSpec constructorMethodSpec = MethodSpec.constructorBuilder()
                .addModifiers(Modifier.PUBLIC)
                .addParameter(Flyable.class, "flyable")
                .addStatement("this.flyable = flyable")
                .build();
        builder.addMethod(constructorMethodSpec);


        // public void fly(){}
        Method[] declaredMethods = Flyable.class.getDeclaredMethods();
        for (Method method : declaredMethods) {
            MethodSpec methodSpec = MethodSpec.methodBuilder(method.getName())
                    .addModifiers(Modifier.PUBLIC)
                    .addAnnotation(Override.class)
                    .returns(method.getReturnType())
                    .addStatement("long start = $T.currentTimeMillis()", System.class)
                    .addCode("\n")
                    .addStatement("this.flyable." + method.getName() + "()")
                    .addCode("\n")
                    .addStatement("long end = $T.currentTimeMillis()", System.class)
                    .addStatement("$T.out.println(\"Fly Time =\" + (end - start))", System.class)
                    .build();
            builder.addMethod(methodSpec);
        }
        // 指定包名
        JavaFile javaFile = JavaFile.builder("leejay.top.concurrency.chapter22", builder.build()).build();
        // 导出到桌面
        javaFile.writeTo(new File("C:\\Users\\administer\\Desktop"));
        return null;
    }

    public static void main(String[] args) throws IOException {
        newProxyInstance();
    }
}

```
