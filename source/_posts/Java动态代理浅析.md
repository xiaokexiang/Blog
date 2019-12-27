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
除了动态代理, 还有静态代理和 Cglib 代理的简单使用, 在这里贴出大神们文章的地址, 尤其是第一篇：<a href="https://juejin.im/post/5a99048a6fb9a028d5668e62">10 分钟看懂动态代理设计模式</a>, 让我对动态代理的流程有了更深的理解. 而第二篇：<a href="https://segmentfault.com/a/1190000011291179">Java 三种代理模式：静态代理、动态代理和 cglib 代理</a>, 让我明白了不同代理的使用方法和区别。在此感谢上述两篇文章的作者以及文章开头的图片 itzhai.com(侵权删)
<!--more-->
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

那么第一个问题来了, 如果我们想知道小鸟在天空飞了多久(或是 Thread.sleep 的随机数是多少), 一般我们在简单测试耗时的时候, 会在执行代码前后添加计时代码, 如下所示

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
> 除了无限扩展, 如果我想先打印时间, 再打印日志这种顺序交换的需求, 那么我们就需要去修改 Bird2 类, 这样灵活性就非常差。

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

> 这里有个疑问: 为什么静态代理要求代理类和被代理类实现同一个接口?
> 说一点自己的理解, 如果是单个代理类和被代理类, 即使代理类不实现相同的接口, 也是能够实现需求。但是如果是多个代理类和单个被代理类, 且不确定执行顺序的需求, 利用 Java 多态的特征, 面向接口编程能够保证代码的灵活性, 这或许是代理模式设计的初衷吧

静态代理的缺点是：

1. `如果要代理多个类或被代理类中有多个方法, 仍然会产生冗余的代码`

那么我们能否使用同一个代理类代理任意对象呢？比如动态的生成代理类、编译、加载到 jvm 中执行, 并且可以自定义代理逻辑, 这就需要用到我们下章的动态代理。

### 模仿动态代理

<img src="http://ww1.sinaimg.cn/large/70ef936dly1g88gqqxh1xj20yg05bq3o.jpg"/>
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

- 编译 TimeProxy.java

```java
public class JavaCompiler {

    public static void compiler(File javaFile) throws IOException {
        javax.tools.JavaCompiler javaCompiler = ToolProvider.getSystemJavaCompiler();
        StandardJavaFileManager fileManager = javaCompiler.getStandardFileManager(null, null, null);
        Iterable<? extends JavaFileObject> fileObjects = fileManager.getJavaFileObjects(javaFile);
        javax.tools.JavaCompiler.CompilationTask task = javaCompiler.getTask(null, fileManager, null, null, null, fileObjects);
        task.call();
        fileManager.close();
    }
    public static void main(String[] args) throws IOException {
        JavaCompiler.compiler(new File("C:\\Users\\administer\\Desktop" + "xxx\\yyy\zzz\\TimeProxy.java"));
    }

}
```

将编译好的 class 文件拖到 IDEA 中如下图所示
<img src="http://ww1.sinaimg.cn/large/70ef936dly1g88gbfy1gxj20mt0dtq3m.jpg"/>

- 加载到内存中并创建对象

```java
public static void loadFile() throws Exception {
    URL[] urls = new URL[]{
            new URL("file:/" + "c:/")
    };
    URLClassLoader classLoader = new URLClassLoader(urls);
    Class clazz = classLoader.loadClass("leejay.top.concurrency.chapter22.TimeProxy");
    Constructor constructor = clazz.getConstructor(Flyable.class);
    Flyable flyable = (Flyable) constructor.newInstance(new Bird());
    flyable.fly();
}
```

> 代码无需过多关注, 我们需要关注的是动态代理的流程, 动态的生成源码, 进行编译, 加载到内存中并通过反射执行方法.

- 抽象 InvocationHandler 接口

回顾上面的 TimeProxy 代码, 我们可以进一步的优化代码, 首先 newProxyInstance 生成的代理类的实现接口是写死的, 我们可以将实现接口作为参数传入, 如下图所示
<img title="图片来源: 10分钟看懂动态代理设计模式" src="http://ww1.sinaimg.cn/large/70ef936dly1g88hr0p2vfj20yg0fewfl.jpg"/>
其次, 我们的 newProxyInstance 方法中, 写死了代理类的增强逻辑(打印执行时间), 如果不进行修改, 每次都需要重建一个代理类用来实现具体的逻辑, 显然这样是不对的, 这里我们抽象出`InvocationHandler接口`, 用于处理自定义的增强逻辑

```java
public interface InvocationHandler {
    void invoke(Object proxy, Method method, Object[] args);
}
```

这样 newProxyInstance 的代码逻辑转换成:

```java
    MyInvocationHandler handler = new MyInvocationHandler();
    Flyable proxy = Proxy.newProxyInstance(Flyable.class, handler);
    proxy.fly();
    // proxy.fly() -> handler.invoke()
```

同时修改 newProxyInstance 代码逻辑:

- 将 InvocationHandler 作为 newProxyInstance 的入参
- 在生成的代理类中增加成员变量 handler
- 在生成的代理类方法中, 调用 invoke 方法

修改后的 TimeProxy 类源码如下

```java
public class TimeProxy implements Flyable {

    private InvocationHandler handler;

    public TimeProxy(InvocationHandler handler) {
        this.handler = handler;
    }

    @Override
    public void fly() {
        Method method = null;
        try {
            method = Flyable.class.getMethod("fly");
        } catch (NoSuchMethodException e) {
            e.printStackTrace();
        }
        handler.invoke(this, method, null);
    }
}
```

```java
public class MyInvocationHandler implements InvocationHandler {

    private Bird bird;

    public MyInvocationHandler(Bird bird) {
        this.bird = bird;
    }

    @Override
    public void invoke(Object proxy, Method method, Object[] args) {
        long beginTime = System.currentTimeMillis();
        try {
            method.invoke(bird);
        } catch (IllegalAccessException | InvocationTargetException e) {
            e.printStackTrace();
        }
        System.out.println("fly time: " + (System.currentTimeMillis() - beginTime));
    }
}
```

```java
public static void main(Strings[] args) {
    Bird bird = new Bird();
    InvocationHandler handler = new MyInvocationHandler(bird);
    TimeProxy proxy = new TimeProxy(Flyable.class, handler);
    proxy.fly();
}

```

> 有没有觉得代码很熟悉, 像不像上面的 BirdLogProxy -> BirdTimeProxy -> Bird 链式调用。
> 这里的调用是 TimePorxy(代理类) -> MyInvocationHandler(代理执行方法的类) -> Bird
> 如果不理解, 我们可以看下面的流程图:

<img src="https://img.vim-cn.com/b4/edd1657c6022ab37344b63f1eabc1f0ffb2229.png">

这样我们就不需要修改 newProxyInstance()方法了, 和业务相关的需求都可以通过实现 InvocationHandler 接口来完成

### 动态代理(JDK)

上一章我们模仿了 JDK 的动态代理逻辑, 这一章我们看下 Java 中关于动态代理的<a href="https://docs.oracle.com/javase/8/docs/api/java/lang/reflect/Proxy.html">文档</a>说明及使用, 动态代理中利用了部分反射的方法, 所以方法入口在`java.lang.reflect.proxy类中的newPrxoyInstance()`

<img src="https://img.vim-cn.com/fd/de416b93236eee7c516b8a1727e80cd64988a3.png">

与我们模仿的 newProxyInstance()不同的是:

- ClassLoader loader
  允许自定义类加载器, 一般我们就选择 代理类的 classloader
- Class<?>[] interfaces
  在我们模仿的例子中代理类只实现了一个接口, 其实我们应该允许实现多个接口
- InvocationHandler
  与我们模仿的例子中的 InvocationHandler 作用相同

至此我们已经了解了 JDK 中动态代理的使用方法, 我们尝试将使用官方的方法改进我们一开始打印日志的需求, 代码如下:

```java
public class ProxyFactory {

    private Object target;

    public ProxyFactory(Object target) {
        this.target = target;
    }

    public Object getProxyInstance() {
        return Proxy.newProxyInstance(target.getClass().getClassLoader(), target.getClass().getInterfaces(), new InvocationHandler() {
            @Override
            public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                long beginTime = System.currentTimeMillis();
                // 这里理解成调用Bird.fly();
                method.invoke(target);
                System.out.println("Fly time: " + (System.currentTimeMillis() - beginTime));
                return null;
            }
        });
    }

    public static void main(String[] args) {
        Bird bird = new Bird();
        ProxyFactory proxyFactory = new ProxyFactory(bird);
        Flyable flyable = (Flyable) proxyFactory.getProxyInstance();
        flyable.fly();
    }
}

```

至此关于动态代理的改动已经完成, 也能够实现我们的业务需求, 在日常的工作中, 动态代理常用于 AOP 切面编程相关的代码中, 从而实现不改动源代码的前提下加强业务逻辑。那么除了动态代理, 还有另外一种代理也能够实现类似的需求, 它就是 Cglib 代理

### Cglib 代理

`cglib (Code Generation Library )是一个第三方代码生成类库，运行时在内存中动态生成一个子类对象从而实现对目标对象功能的扩展。`Cglib 包的底层是通过使用一个小而快的字节码处理框架 ASM，来转换字节码并生成新的类。
与动态代理类似, 他们都是动态的生成代理类, 加载到内存中从而实现对目标功能的扩展。而它们之间最大的不同点在于

> 动态代理的代理类必须要实现一个或者多个接口, 而 Cglib 代理是通过生成子类来实现的

下面我们通过代码来实现和上面动态代理一样的需求

```java
public class CglibProxy implements MethodInterceptor {

    private Object target;

    public CglibProxy(Object target) {
        this.target = target;
    }

    public Object getProxyInstance() {
        Enhancer enhancer = new Enhancer();
        //生成target的子类, 也就是设置代理类的父类
        enhancer.setSuperclass(target.getClass());
        // 设置回调函数
        enhancer.setCallback(this);
        //创建子类代理
        return enhancer.create();
    }

    // intercept用于实现具体的切入逻辑
    @Override
    public Object intercept(Object o, Method method, Object[] objects, MethodProxy methodProxy) throws Throwable {
        long beginTime = System.currentTimeMillis();
        /*
         * 父类就是目标对象
         * invokeSuper方法的作用就是获取代理类对应的FastClass
         * FastClass: 在第一次执行MethodProxy.invoke() or invokeSuper() 方法时生成, 包括代理类和被代理类的FastClass并放在缓存中
         * 这个类会为代理类或被代理类的方法生成一个index; 这个index作为入参, FastClass就可以直接定位要调用的方法进行* 直接调用, 免去反射调用的烦恼
         * 所以FastClass也是Cglib比JDK更快的原因
         */
        Object obj = methodProxy.invokeSuper(target, objects);
        System.out.println("fly time: " + (System.currentTimeMillis() - beginTime));
        return obj;
    }
}

```

>

至于方法的调用则与动态代理相同

```java
public static void main(String[] args) {
    Bird bird = new Bird();
    CglibProxy cglibProxy = new CglibProxy(bird);
    Flyable flyable = (Flyable) cglibProxy.getProxyInstance();
    flyable.fly();
}
```

### 总结

#### 静态代理 & 动态代理

> - 静态代理只能通过手动完成代理操作, 而动态代理在运行期间动态生成代码, 比静态代理更灵活

#### JDK & Cglib

> - JDK 动态代理实现了`被代理对象的接口`, Cglib 代理`继承了被代理对象`
> - 两者都在`运行期生成字节码`, JDK 动态代理直接写 Class 字节码, 而 Cglib 动态代理使用`ASM`框架写 Class 字节码, 所以`Cglib生成代理类的效率低于JDK动态代理`
> - JDK 动态代理调用代理方法是通过`反射调用`, Cglib 代理是通过`FastClass机制`直接调用方法, Cglib 调用方法效率更高

#### 代理模式优缺点

> - 代理模式能将代理对象与真是被调用的目标对象分离, 在一定程度上降低了耦合性
> - 代理模式能够起到保护对象或增强对象的作用
> - 代理模式会导致系统中设计类增加, 同时处于客户端和目标对象之间, 容易导致请求处理速度变慢

至此三种代理模式都写完了, 三种模式分别适用于不同的场景: 静态代理更简洁, 动态代理比静态代理更全面, 而 Cglib 代理能做到比动态代理无侵入, 各中的代码原理还需要以后继续细细了解, 最后再次感谢欧阳锋大佬的文章: <a href="https://juejin.im/post/5a99048a6fb9a028d5668e62">10 分钟看懂动态代理设计模式</a>以及 Soarkey 大佬的<a href="https://segmentfault.com/a/1190000011291179">Java 三种代理模式：静态代理、动态代理和 cglib 代理</a>, 完结撒花~~~
