---
title: "Java虚拟机概述"
date: 2023-02-14T14:58:25+08:00
slug: "jvm_in_action"
description: "Java虚拟机概述，包括类加载机制、运行时数据区与垃圾回收器。"
tags: ["Jvm "]
categories: [
  "Jvm"
]
weight: 10
---

## 1. 类加载流程
> Java虚拟机把`描述类的数据从Class文件加载到内存`，并对数据进行`校验、转换解析和初始化`，最终形成可以被虚拟机`直接使用`的Java类型。

### 1.1 类加载时机

#### 类加载的生命周期

![](https://image.leejay.top/Fp0TSKAc1i8rSPKcAe1t36qz4a7e)

> 类型被加载到虚拟机内存中开始，到卸载出内存为止，整个生命周期经历如上七个阶段。
>
> 其中`验证、准备、解析`统称为`连接`。
>
> 需要注意的是：`解析阶段顺序是不确定的`，它可以在`初始化阶段之后再开始`。

#### 类初始化的六种情况

《Java虚拟机规范》中规定了`六种`要立即`对类进行”初始化“(加载、验证、准备自然需要在此之前执行)`的情况：

- 遇到`new`、`getstatic`、`putstatic`、`invokestatic`这四条字节码指令时，类型没有过初始化，生成这四条字节码指令的场景有：

  - 使用`new`关键字实例化对象。

  ```java
  // 会初始化A
  A a = new A();
  ```

  - 读取或设置一个类型的`静态字段(final修饰、编译器进入常量池的静态字段除外)`。

  ```java
  class B {
      // 会导致A类被初始化  
      static A a = new A();
      public static void main(String[] args) {
          // 不会导致A类被初始化
          System.out.print(A.HELLO_WORLD);
      }
  }
  class A {
      static final String HELLO_WORLD = "hello_world";
  }
  ```

  > 引用`静态字符串常量`不会导致持有该常量的类初始化。

  - 调用一个类型的静态方法

  ```java
  class A {
      static void print() {
          System.out.print("hello");
      }
      public static void main(String[] args) {
          A.print();
      }
  }
  ```

  > 我们可以用过`-XX:+TraceClassLoading`来查看类是否被加载。

- 通过`java.lang.Reflect`对方法进行反射调用时

- 初始化类时发现其`父类`还没有初始化。

```java
public class SuperClass {
    static {
        System.out.println("Super class init");
    }

    public static int value = 123;
}

class SubClass extends SuperClass {
    static {
        System.out.println("Sub class init");
    }
}

class Test {
    public static void main(String[] args) {
        //  只会初始化父类，不会初始化子类
        System.out.println(SubClass.value);
    }
}
```

- 接口中定义的`default`方法，若该接口的实现类发生初始化，`default`方法在此之前要被初始化。

```java
public interface Father {
    default void print() {
        System.out.print("hello");
    }
}

public class Son implements Father {

}

class Test {
    public static void main(String[] args) {
        // 会初始化Father接口中的default方法
		Father f = new Son();
    }
}
```

> 如果是接口初始化，那么不会要求父接口也全部初始化，`真正使用到的父接口`才会初始化。

- `java.lang.invoke.MethodHandle`实例的解析结果为`REF_getstatic`、`REF_putstatic`、`REF_invokestatic`、`REF_newInvokeSpecial`四种类型的方法句柄还没有初始化时。

---

### 1.2 类加载流程

#### 加载

`加载`阶段是整个类加载生命周期的**第一个阶段**，Java虚拟机需要完成以下三件事情：

- 通过一个类的全限定名获取定义此类的二进制字节流。

> 《Java虚拟机规范》没有规定`二进制字节流`的具体获取方式，目前已知获取方式包括：`从zip包读取、运行时生成、加密文件获取等`。既可以通过`Java虚拟机内置的类加载器`，也可以通过`用户自定义的类加载器`来实现类的加载动作（类来源的多样性需要自定义类加载器）。
>
> 数组本身不通过类加载器创建，但`数组的类型`需要通过类加载器来完成加载。

- 将字节流代表的静态存储结构（ex: `常量池 -> 运行时常量池`）转换为`方法区运行时数据结构`。

- 堆中生成`java.lang.Class`对象，并作为这个类方法区各各种数据的访问入口。

#### 验证

- 文件格式验证

验证字节流是否符号`Class文件格式`的规范，并能够被当前版本的虚拟机处理。包括：`常量池中的常量是否有不被支持的常量类型`、`是否以魔数0XCAFEBABE开头`等验证点。

- 元数据验证

对字节码描述的信息进行予以分析，确保符合规范，包括：`此类是否有父类`、`是否继承了不被允许继承的类`、`是否缺少字段、方法`等验证点。

- 字节码验证

通过`数据流和控制流分析`，确保程序语义是合法、符合逻辑的。包括：`保证任意时刻操作数栈的数据类型与指令代码序列都能配合工作`、`保证方法中类型转换都是有效的`等验证点。

- 符号引用验证

目的是确保将`符号引用转为直接引用`的`解析`阶段能够顺利执行，对类自身以外的类信息进行匹配性校验。包括：`符号引用中通过字符串描述的权限定名能够找到对应的类`、`符号引用中的类、字段、方法的可访问性`等验证点。

```bash
# 关闭大部分的类验证以缩短虚拟机加载类时间
-Xverify:none
```

#### 准备

为类中定义的`静态变量`分配内存并设置`类变量初始值`的阶段。这些变量所使用的内存都会在`方法区`进行分配。

```java
class Test {
    // 类变量(静态变量)，初始值为0
    public static int value1 = 123;
    // 类变量，初始值为123
    public static final int value2 = 123;
    // 实例变量
    public Object obj;
}
```

> 类变量value1在`准备`阶段过后的`初始值为0`，赋值为123的操作要等到`初始化`阶段才会执行。
>
> 类变量value2在编译时会生成`ConstantValue`属性，在`准备`阶段虚拟机就会将value2设置为123。
>
> 实例变量会随着`对象Test的实例化`而一起分配在`堆中`。

#### 解析

Java虚拟机将`常量池内的符号引用替换为直接引用`的过程。《Java虚拟机规范》没有规定`解析`阶段发生的具体时间，只要求了执行`ldc、getfield、getstatic等17个指令前`，先对它们所使用的`符号引用`进行解析。所以虚拟机可以自行决定解析的触发时机是**类被加载器加载时**或**符号引用将被使用前**。

> 符号引用：以`一组符号`来描述所引用的目标。可以引用没有加载到内存中的内容。
>
> 直接引用：可以直接指向目标的指针、相对偏移量或者能够定位到目标的句柄池。

- 类或接口解析

基于以下代码，将从未解析过的`符号引用x`解析为类或接口的`直接引用`。包括三个步骤：

```java
class Test {
    A x = new A();
}
```

> 1. 若A不是数组类型，虚拟机将`x作为权限定名`交给`Test类的加载器`去加载`类A`，`类A`按照`类加载流程`执行类加载，若发生错误，那么解析失败。
>
> 2. 若A是数组类型(如Integer[])，那么虚拟机会将`x即[Ljava/lang/Integer`中的`Integer`类型交给`Test类加载器`去加载，再由虚拟机生成对应的`数组对象`。
>
> 3. 若前两步没有问题，在解析完成前还要进行`符号引用`验证，确保`Test对A`的访问权限。

- 字段解析

通过类的常量池表查找`字段所属的`类或接口的符号引用`(用A表示)`，并执行`类或接口的解析`。按照如下步骤执行：

1. 若A本身包含了`简单名称`和`字段描述`都与目标匹配的字段，返回该字段的直接引用。
2. 否则，若A实现了接口，会按照继承关系从下往上查找，重复步骤1。
3. 否则，若A不是`java.lang.Object`，会按照继承关系从下往上查找，重复步骤1。
4. 否则，查找失败，抛出`NoSuchFieldError`异常。
5. 最后对该字段进行`权限验证`，若不具备权限，抛出`java.lang.illegalAccessError`异常。

- 方法解析

与`字段解析`类似，都是要找到`方法所属的`类或接口的符号引用`(用A表示)`。按照如下步骤执行：

1. 如果A是个接口，那么直接抛出`java.lang.IncompatibleClasssChangeError`异常。
2. 否则，查找类A中是否存在`简单名称`和`字段描述`都与目标匹配的方法，返回该方法的直接引用。
3. 否则，查找类A`实现的接口及它们的父接口`中递归查找是否存在`简单名称`和`字段描述`都与目标匹配的方法，若存在匹配的方法，说明类A是个`抽象类`，抛出`java.lang.AbstractMethodError`异常。
4. 否则宣告查找失败，抛出`java.lang.NoSuchMethodError`异常。
5. 若返回了方法的直接引用，则需要进行`权限验证`，若不具备抛出`java.lang.illegalAccessError`异常。

- 接口方法解析

1. 如果A是个类，那么直接抛出`java.lang.IncompatibleClasssChangeError`异常。
2. 否则，查找接口A中是否存在`简单名称`和`字段描述`都与目标匹配的方法，返回该方法的直接引用。
3. 否则，在接口A的父接口中递归查找，直到`java.lang.Object类`为止，若存在`简单名称`和`字段描述`都与目标匹配的方法，返回该方法的直接引用。
4. 否则宣告查找失败，抛出`java.lang.NoSuchMethodError`异常。

#### 初始化

直接来说：`初始化`阶段就是执行类构造器`<clinit>`方法的过程。

> `<clinit>`方法是由编译器自动收集类中的所有`类变量的赋值动作`与`静态语句块(static {})`中的语句合并产生的。编译器的收集顺序由语句在`源文件`中出现的顺序决定的。
> `<clinit>`不包含`静态方法`，`静态方法`在被调用的时候才会加载。

```java
class Test {
    static {
        // i=1执行先于i=0，但并不能修改成功
        i = 1;
        // 输出i，提示Illegal forward reference编译错误
        // System.out.println(i);
    }
    static int i = 0;

    public static void main(String[] args) {
        System.out.println(i); // 0
    }
}
```

> `static静态代码块`只能访问到定义在其之前的变量，定义在其之后的变量`能赋值但不能访问`。

##### clinit

- 与`类的构造函数<init>方法`不同，`<clinit>`不需要显示的调用父类构造器，Java虚拟机会保证子类的`<clinit>`方法执行前，父类的`<clinit>`已执行完毕，因此`java.lang.Object`类是Java虚拟机中第一个被执行的`<clinit>`方法的类型。

- 由于父类的`<clinit>`先执行，所以父类中的而静态语句块要先于子类的变量赋值操作。
- `<clinit>`方法对于接口或类来说不是必须的，如果没有静态语句块、也没有变量赋值操作，那么编译器不会为该类生成`<clinit>`方法。
- 接口中不能使用`静态语句块`，但能有静态变量赋值操作，所以接口也能生成`<clinit>`方法。但与类不同的是，执行接口的`<clinit>`方法不需要执行父接口的`<clinit>`方法，只有当父接口中定义的变量被使用时，父接口才会初始化。此外接口的实现类在初始化时也不会执行接口的`<clinit>`方法。
- Java虚拟机必须要保证一个类的`<clinit>`方法在多线程环境中，如果多个线程同时初始化一个类，那么只会有一个线程去执行`<clinit>`方法，其他线程都要阻塞等待，直到活动线程执行完`<clinit>`。若一个类的`<clinit>`方法存在耗时很长的操作，那么可能造成多线程阻塞（活动线程执行完，其他线程不会再进入`<clinit>`方法）。

```java
class Parent {
    static int A = 0;
    static {
        A = 2;
    }
}

class Son extends Parent {
    public static int B = A;
}

public class Test1 {
    public static void main(String[] args) {
        System.out.println(Son.B);// 2
    }
}
```

> 根据规则：父类的`<clinit>`先执行，所以父类的静态语句块先于子类而执行。`Son.B = 2`。

---

### 1.3 类加载器

类加载阶段的`通过一个类的全限定名来获取描述该类的二进制字节流`这个动作交给Java虚拟机外部去实现，让应用程序决定如何去获取所需的类，实现这个动作的代码被称为`类加载器(Class Loader)`。类加载器用于实现`类的加载动作`。

> 判断两个类是否相等，前提是由`同一个类加载器`加载。不同类加载器加载同一个.class文件也是不相等的。

```java
public class ClassLoaderTest {
    public static void main(String[] args) throws Exception {
        // 自定义类加载器,匿名内部类
        ClassLoader classLoader = new ClassLoader() {
            @Override
            public Class<?> loadClass(String name) throws ClassNotFoundException {
                try {
                    String fileName = 
                        name.substring(name.lastIndexOf(".") + 1) + ".class";
                    // 使用当前自定义类加载来加载fileName的类为二进制字节流
                    InputStream inputStream = 
                        getClass().getResourceAsStream(fileName);
                    // 如果找不到就让父类加载器去执行加载
                    if (null == inputStream) {
                        return super.loadClass(name);
                    }
                    byte[] bytes = new byte[inputStream.available()];
                    inputStream.read(bytes);
                    // 创建name的Class对象
                    return defineClass(name, bytes, 0, bytes.length);
                } catch (IOException e) {
                    throw new ClassNotFoundException(name);
                }
            }
        };
        // 通过自定义类加载器实现类的加载，并实例化该对象
        Object obj = 
            classLoader.loadClass("top.leejay.jvm.load.ClassLoaderTest")
            .newInstance();
        // 查看加载的Class对象
        System.out.println(obj.getClass());
        // 验证不同的类加载器加载同一个.class文件是否相同
        System.out.println(obj instanceof ClassLoaderTest);// false
    }
}
```

> 此时在Java虚拟机中共存在两个`ClassLoaderTest`类，一个是`应用程序类加载器`加载的，一个是`自定义类加载`加载的。

#### 双亲委派模型

![](https://image.leejay.top/image/20200909/tcECLtcm1kv0.png?imageslim)

> 上图各种类加载器之间的层次关系被称为`类加载器的双亲委派模型`。双亲委派模型要求：除了顶层的启动类加载器外，其余的类加载器都应有自己的父类加载器(继承自`java.lang.ClassLoader`类)。
>
> 如果一个类加载器收到了类加载的请求，它首先不会自己去尝试加载该类，而是把这个请求委派给父加载器去执行，每个层次都是如此，最终所有的请求都传递到`最顶层的启动类加载器`中。只有当`父加载器无法完成这个加载请求`时，子加载才会尝试自己去完成加载。

- 启动类加载器

负责加载`JAVA_HOME/lib`目录下，能被Java虚拟机识别的类库。由`C++`实现。Java中用`null`来表示。

- 扩展类加载器

负责加载`JAVA_HOME/lib/ext`目录下的类库。由`Java`实现。

- 应用程序加载器

因为是`ClassLoader.getSystemClassLoader`的返回值，又被称为系统类加载器。负责加载用户类路径(ClassPath)上所有的类库。

##### 不同加载器加载同一文件

```java
protected Class<?> loadClass(String name, boolean resolve)
        						throws ClassNotFoundException {
    synchronized (getClassLoadingLock(name)) {
        // 判断类是否被加载
        Class<?> c = findLoadedClass(name);
        // 如果没有被加载
        if (c == null) {
            long t0 = System.nanoTime();
            try {
                // 如果当前类加载器的父类不为null，说明存在父加载器
                // 如果为null，说明加载到顶层的启动类加载器了(Java中为null)
                if (parent != null) {
                    // 调用父类的类加载器加载类，往上查找
                    c = parent.loadClass(name, false);
                } else {
                    // 如果为null，那么调用顶层的启动类加载器来加载
                    c = findBootstrapClassOrNull(name);
                }
            } catch (ClassNotFoundException e) {
                // 如果父加载器没找到，那么会抛出该异常，默认不处理
            }
			// 如果c=null，说明启动类加载器也没找到这个类
            // 那么会直接调用本身的findClass方法
            if (c == null) {
                long t1 = System.nanoTime();
                // 调用findClass，从上往下查找
                c = findClass(name);
            }
        }
        if (resolve) {
            resolveClass(c);
        }
        return c;
    }
}
```

> 判断请求加载的类型是否被加载过，如果没有则调用父加载器的`loadClass()`，若父加载器为`null`则默认使用`启动类加载器`作为自己的父加载器。若父加载器加载失败，抛出`ClassNotFound`异常后，就会调用自身的`findClass`方法尝试进行加载。

##### 双亲委派的优点

- 避免`类重复加载`。加载类都会先判断这个是否被加载过。
- 避免`核心类`被篡改。如果用户自定义了`java.lang.Object`类，就无法保证最基本的行为。

##### 破坏双亲委派

- 历史遗留原因

<u>类加载器和ClassLoader抽象类</u>在`JDK1`中就存在，而<u>双亲委派模型</u>在`JDK1.2`才出现，为了面对已经存在的用户自定义类加载器的代码而做出妥协，加入了`protected Class<?> findClass()`方法，结合`ClassLoader`的源码，当`loadClass`加载失败，就会调用自身的`findClass`方法。

- JNDI

我们知道`JNDI`的代码由启动类加载器加载，但`JNDI`需要对调用部署在应用程序的`ClassPath`下的`JNDI`服务提供者接口，简单来说就是`顶层启动类加载器需要加载应用程序类加载器`，此问题会破坏双亲委派模型。

解决办法：引入线程上下文类加载器，如果创建线程时还未设置，它会从父线程中继承一个，如果在应用程序的全局范围内都没有设置的话，那么这个类加载器默认是`应用程序类加载器`。

#### 正确编写自定义类加载器

在前面我们编写了`"糟糕"`的自定义类加载器代码来验证`不同的类加载器加载同一个.class文件是不相等的`。那么这节我们按照`JDK1.2`后建议我们使用的`findClass`来编写自定义类加载器。

```java
public class MyClassLoader extends ClassLoader {

    @Override
    protected Class<?> findClass(String name) {
        // 先判断类是否已被加载
        Class<?> c = findLoadedClass(name);
        if (null == c) {
            try {
                // 加载本地磁盘上指定name的class文件(只要不在ClassPath下即可)
                FileInputStream inputStream = 
                    new FileInputStream(new File("D://" + name + ".class"));
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
                byte[] bytes = new byte[inputStream.available()];
                int index;
                while ((index = inputStream.read(bytes)) != -1) {
                    outputStream.write(bytes, 0, index);
                }
                // 获取字节流
                byte[] byteArray = outputStream.toByteArray();
                // 创建name的Class对象
                c = defineClass(name, byteArray, 0, byteArray.length);
            } catch (IOException e) {
                throw new ClassNotFoundException(name);
            }
        }
        return c;
    }
}

public class ClassLoaderTest {
    public static void main(String[] args) throws ClassNotFoundException {
        MyClassLoader loader = new MyClassLoader();
        Class<?> hello = loader.loadClass("Hello");
        // top.leejay.jvm.load.MyClassLoader@4fccd51b
        System.out.println(hello.getClassLoader());
    }
}
```

> 1. D盘下创建一个名为`Hello`的java文件，`javac -encoding utf-8 Hello.java`生成class文件。
> 2. 切记`Hello.class`文件不能在`ClassPath`下，否则会导致`AppClassLoader`加载该类。
> 3. 自定义类加载器的`loadClass`方法为入口，在三个默认类加载器都找不到时会调用`findClass`。

#### 小知识点

`Class.forName()`与`ClassLoader.loadClass()`的区别？

先说结论：

1. `forName`除了`加载.class文件`外，还会执行该类的`初始化`，即执行类的`<clinit>`方法，所以`类的静态代码块`和`静态变量赋值操作`都会执行。
2. `loadClass`只会将`.class文件`加载到虚拟机中，不会执行初始化操作。

```java
@CallerSensitive
public static Class<?> forName(String className)
    	throws ClassNotFoundException {
    Class<?> caller = Reflection.getCallerClass();
    /**
      * @param 要加载的类名
      * @param 是否需要初始化 true/false 初始化/不初始化
      * @param 调用者类加载器
      * @param 调用者Class对象
      */ 
    return forName0(className, true, ClassLoader.getClassLoader(caller), caller);
}
```

```java
public class ClassDemo {
    static int value = 0;
    static {
        System.out.println("static ...");
        value = 1;
        System.out.println(value);
    }
}

class Test {
    public static void main(String[] args) throws ClassNotFoundException {
        // 初始化
        Class<?> aClass1 = 
            Class.forName("top.leejay.jvm.load.ClassDemo");
        // 不会初始化
        Class<?> aClass2 = ClassLoader.getSystemClassLoader()
            .loadClass("top.leejay.jvm.load.ClassDemo");
    }
}

```

---

## 2. 运行数据区概述
### 2.1 虚拟机栈

虚拟机栈描述的是Java方法运行时的`线程内存模型`：每个方法被执行时，JVM会同步创建一个`栈帧`，用于存储`局部变量表、操作数栈、动态链接、方法返回地址`等信息，虚拟机栈区域是`线程私有`的，它的生命周期与线程相同。栈顶存放的是当前方法。

> 1. 局部变量表：存放编译期可知的数据类型：`8种基本数据类型、对象引用类型、返回类型`。这些数据类型在栈中用`slot`来表示，除了`long & double`占用`2个slot`，其余的都为1个。
>
> 2. 虚拟机栈包含用于`执行native方法`的本地方法栈。它们都会抛出`OOM和StackOverFlow`异常。
>
> 3. 虚拟机中的线程与操作系统的本地线程直接映射，操作系统负责将所有的线程调度到可用的CPU上，一旦本地线程初始化成功，就会调用Java虚拟机线程中的run方法。
> 4. 动态链接：类加载时将`常量池中的符号引用`转换为`运行时常量池中方法的直接引用`，这个引用被称为动态链接。

### 2.2 虚拟机堆

这是一块`线程共享`的内存区域，几乎全部的`对象实例、数组`都在堆上分配（小对象可以在`栈上分配`）。

> 从内存回收角度看，堆被逻辑的分为：`年轻代（包括eden、from、to三个区域）、老年代`。
>
> 从内存分配角度看，堆被分为`多个线程私有的内存分配缓冲区（TLAB）`。

#### TLAB

Thread Local Allocation Buffer（本地线程缓冲区），原有的虚拟机给对象分配内存时，采用是`CAS + 失败重试`的方式。而`TLAB`是：

1. 通预先给每个线程在堆中分配一小块区域。
2. 哪个线程创建对象，就在哪个线程的TLAB中分配内存。
3. 如果这个线程的`TLAB`空间不够分配时，就通过`同步锁定`给这个线程分配新的`TLAB`。
4. `-XX:+/-UseTLAB`来开启和关闭TLAB。

### 2.3 元数据区

`JDK1.8`起，方法区改名为`元数据区（MetaSpace）`，是`线程共享`的区域，是堆的一个`逻辑部分`，用于存储`JVM加载的类型信息、常量、静态变量及即时编译后的方法代码`等数据。会抛出`OOM`异常。

#### 常量池分类

- Class文件中的常量池

主要存放`字面量 & 符号引用`。前者主要是`文本字符串、八种基本数据类型、final修饰的常量`等，后者包含：`类和接口的全限定名、字段的名称和描述符、方法的名称和描述符`。在类被加载后会存放到`运行时常量池`中。

- 运行时常量池

属于`元数据区`中的一部分，类在被JVM加载后，类的版本、字段、方法和常量池等都会进入该区域。JVM会为`每个加载的class维护一个运行时常量池`，同时其中存储的是`引用`，实际对象还在`堆中`。日常我们所称的常量池就是运行时常量池。

- 全局字符串常量池

`JDK7后位于堆中`，运行时存在的用于记录`interned string`的全局表`StringTabel`。其中存放的是`String实例的引用`，实际的`String对象`仍存在于堆。

> `String.intern()`：如果`字符串常量池`已存在该字符串引用，那么就返回已存在的字符串的引用。若没有就将引用保存到`字符串常量池`并返回引用。

#### 字符常量的执行流程

- 首先`编译期`会将字面量、符号引用等放入Class文件的常量池中。

- 在JVM`类加载`的过程中，除了字面量，类的字段、方法等信息都会加载到当前类`运行时常量池`。此时运行时常量池中存放的是`CONSTANT-UnresolvedString`，表明尚未`resolve`，只有在解析后存放的是`CONSTANT_String`，内容是实际的`String对象的引用`，和`字符串常量池的引用`一致。

- 因为JVM类加载过程中的`解析(resolve)阶段`是可以懒执行的，只有当执行`ldc指令`时，通过存放在`运行时常量池`的索引去`字符串常量池`查找是否存在对应的String实例，如果存在就直接返回该引用，不存在就先在`堆中创建对应的String对象`，并将引用记录在`字符串常量池`中，再返回该引用。

  > `ldc指令`：将`int、float或String类型的常量值从常量池推送至栈顶`。
  >
  > 资料来源：https://www.zhihu.com/question/55994121/answer/408891707

---

### 2.4 程序计数器

程序计数器（Program Counter Register），`当前线程`所执行的字节码的行号指示器。分支、循环、异常处理都是依赖计数器实现，该区域是`线程私有`的。

### 2.5 直接内存

直接内存并不是JVM运行时数据区的一部分。常见于`NIO`类使用：通过`Native方法分配堆外内存`，在Java堆中持有该`内存区域的引用`实现操作，相比之前`在Java堆和Native堆之间来回复制`的方式，提升了效率。 

---

### 2.6 JVM中的对象

#### 对象的创建

![](https://image.leejay.top/image/20200806/5Yyjn8VqQBwt.png?imageslim)

> 1. 在`Class类的常量池`中寻找该类的`符号引用`，并通过该符号引用判断类是否被加载。
> 2. 如果类没有被加载，那么JVM就会执行相应的类加载过程。
> 3. 给对象分配内存空间共有两种方式：`指针碰撞 & 空闲列表`。
> 4. 在对象分配内存的线程安全问题，默认是通过`CAS + 失败重试`实现，也可以选择`TLAB`。
> 5. 初始化内存空间为零值，并对`Mark Word`进行必要设置（根据是否启动偏向锁设置信息）。
> 6. 最终调用对象的构造函数进行初始化。

#### 对象的构成

对象在堆中的布局分为三个部分：`对象头、实例数据和对齐填充`。而对象头中又包含：`对象自身的运行时数据(Mark Word)、对象指向它类型元数据的指针以及数组长度(如果对象是数组)`。

##### 对象头

- Mark Word

  用于记录存储对象自身运行时的数据。比如`HashCode、锁状态标识`等。

![](https://image.leejay.top/image/20200806/bf8MF7GVoqRP.png?imageslim)

- 类型指针

  `对象头中指向该对象类型元数据(元数据区)的指针`，通过类型指针，JVM可以判断当前对象是`哪个类的实例`。

  > 并不是所有的虚拟机都会在对象头中保留类型指针。此问题查看[对象的引用](#对象的引用)

- 数组长度

  如果当前对象是数组，那么在对象头中还有一部分用于`存储数组长度的数据`。

##### 实例数据

即保存代码中定义的`各种类型的字段内容（包括父类继承）`，其存储顺序除了受到代码中定义的影响，还由JVM参数`-XX:FiedlsAllocationStyle`决定。

##### 对齐填充

对齐填充并不是`必然存在`的，因为`HotSpot`要求`对象的大小必须是8的整数倍`，对象头已经是8的整数倍，如果实例数据不是8的整数倍，那么就需要使用对齐填充来补全。

#### 对象的引用

对象的创建是为了能够使用该对象，我们通过`栈上的reference数据`来操作堆上的具体对象。但对象的访问方式由虚拟机自行决定，目前主流的有两种：`句柄 & 指针`。

![](https://image.leejay.top/image/20200811/doWGxxuV17Ne.png?imageslim)

> 1. 句柄：就是在堆中额外划分一块内存作为句柄池，栈中的`reference`存放的就是句柄池地址。句柄池中包含`对象实例数据 & 类型数据的内存地址`。
> 2. 直接指针：栈中`reference`存放的是堆中的对象地址，对象头中又包含`对象类型数据指针`。
> 3. 句柄的优点在于GC回收移动对象时，只需要修改`句柄池中的实例数据指针`。而指针的优点在于`访问更快`，减少一次查找。

---

### 2.7 模拟各区域OOM

#### 堆

```java
/**
  * -Xmx10m 模拟堆OOM
  */
public static void main(String[] args) {
    List<Object> list = new ArrayList<>();
    while (true) {
        list.add(new Object());
    }
}
```

#### 栈

- stackOverFlow

```java
/**
  * -Xss1m
  */
public static void main(String[] args) {
    Stack stack = new Stack();
    // stackOverFlow
    stack.stackOverFlow();
}

void stackOverFlow() {
    stackOverFlow();
}
```

- OOM

```java
/**
  * -Xss1m
  */
public static void main(String[] args) {
    Stack stack = new Stack();
    // oom
    stack.oom();
}
void oom() {
    while (true) {
        new Thread(() -> {
            while (true) {

            }
        }).start();
    }
}
```

> 相比OOM，stackOverFlow更容易发生。

#### 元数据区

- 字符串常量池OOM

```java
/**
  * 1.7前 -XX:MaxPermSize=10m
  * 1.7后 -Xmx10m
  */
public static void main(String[] args) {
    List<String> list = new ArrayList<>();
    int i = 0;
    while (true) {
        list.add(("hello" + i++).intern());
    }
}
```

> 需要注意在JDK7及以上版本中不会抛出之前的`PemGen space`异常，因为字符串常量池被移到了`堆中`，如果我们限制堆的大小，会抛出`Java heap space`异常。

- 元数据OOM

```java
/**
  * -XX:MaxMetaspaceSize=10m
  */
public static void main(String[] args) {
    while (true) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(Object.class);
        enhancer.setUseCache(false);
        enhancer.setCallback((MethodInterceptor) (o, method, objects, methodProxy) 
                             -> methodProxy.invoke(o, objects));
        enhancer.create();
    }
}
```

> 因为元数据区存放类型的相关信息：类名、方法描述等，通过大量创建cglib代理类实现`Metaspace OOM`。

#### 直接内存

```java
/**
  * -XX：MaxDirectMemorySize=10m
  */
public static void main(String[] args) throws IllegalAccessException {
    // 反射获取unsafe类
    Field unsafeField = Unsafe.class.getDeclaredFields()[0];
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe)unsafeField.get(null);
    while (true) {
        // 分配直接内存
        unsafe.allocateMemory(1024 * 1024);
    }
}
```

> 直接内存由：`-XX：MaxDirectMemorySize`指定，如果不指定则和`-Xmx`一致。

---

### 常量池实战

查看汇编指令

```bash
javac -encoding utf-8 StringTest.java
javap -v StringTest.class
```

- 字符串拼接（编译器优化）

```java
public class StringTest {
    public static void main(String[] args) {
        String s1 = "hello";
        String s2 = "he" + "llo"; // 编译器会自动转成 ldc "hello"指令
        // s1 == s2?
    }
}
```

> 因为编译器的优化，`s2会被编译成"ldc hello"(汇编指令可见)`，s1 和 s2 都指向`字符串常量池`中`"hello"`的引用，所以`s1 == s2`成立。
>
> ![](https://image.leejay.top/image/20200813/OB0vpDkBzHoV.png?imageslim)

- 字符串拼接（编译器不优化）

```java
public class StringTest {
    public static void main(String[] args) {
		String s1 = new String("he") + new String("llo"); // 编译器不会优化
        s1.intern();
        String s2 = "hello"
        // s1 == s2?
    }
}
```

> 1. 编译器不会优化`s1`，堆中会创建`"he"、"llo"`对象，并将两个对象的引用放入`字符串常量池`。继而通过`+ (底层StringBuilder)`创建`"hello"`对象，但不会放入`字符串常量池`。
> 2. 此时`字符串常量池`无`"hello"`的引用，`s1.intern()`会将堆中`"hello"`对象的引用放入`字符串常量池`并返回引用。
> 3. `s2 = "hello"`，执行`ldc`指令，发现`字符串常量池`已存在`"hello"`的引用，返回引用（`即s1引用`）给s2，所以`s1 == s2`成立。
> 4. 下图汇编指令中，需要注意观察，在`s1.intern()`之前，并没有`ldc "hello"`，进一步说明在此之前`字符串常量池`只存在`"he"、"llo"`两个对象的引用。
>
> ![](https://image.leejay.top/image/20200813/n30lMesr7Kjx.png?imageslim)

- new String("")问题

```java
public class StringTest {
    public static void main(String[] args) {
		String s1 = new String("hello");
        String s2 = "hello";
        // s1 == s2?
    }
}
```

> 基于`ldc`指令，若`字符串常量池不存在该字符串就会在堆中创建字符串实例，并将引用保存在字符串常量池中`。
>
> 此时`s1 = new String("hello")`共创建两个对象：一个由`显示的new`创建，一个由`JVM`创建。s1指向堆中的`"hello"`对象，而s2指向的是`字符串常量池`中持有的实例。所以`s1 == s2`不成立。
>
> ![](https://image.leejay.top/image/20200813/f6u1Mzjxfpm7.png?imageslim)

- intern()

```java
public class StringTest {
    public static void main(String[] args) {
		String s1 = new String("hello");
        s1 = s1.intern();
        String s2 = "hello";
        // s1 == s2?
    }
}
```

> `String.intern()`方法会返回`该字符串在字符串常量池中的引用`，`s2 = "hello"`也会先去`字符串常量池`查看是否存在该字符串的引用，有就返回引用。最终`s1 & s2`都指向`字符串常量池中的hello引用`。所以`s1 == s2`成立。
>
> ![](https://image.leejay.top/image/20200813/HQTMAz6X4cCl.png?imageslim)

---

## 3. 垃圾回收算法
### 垃圾回收概述

在JVM`运行期间`，会对内存中`不再被使用的对象`进行`分配和管理`。若不及时对内存中的垃圾进行清理，会导致被保留的空间无法被其他对象使用，从而导致`内存溢出`。

> 内存溢出：系统无法分配给程序所`需要的指定大小内存`。
>
> 内存泄漏：当`对象不再使用或无法继续使用时`，因为强引用的存在导致`本该会回收的内存无法被回收`，常见于：`Map用对象作为key不重写hashcode & equals & ThreadLocal内存泄漏`。 

### 对象是否存活

JVM垃圾回收器会对对象中`不再使用(死去)`的对象进行回收，那么垃圾回收器是如何进行判断的呢。

#### 1. 引用计数法

对于一个对象A，只要有一个对象引用了A，那么A的计数器增加1，当引用失效的时候就减1。该算法会产生`对象之间循环引用`问题，会导致`内存泄漏`。

#### 2. 可达性算法

通过一系列称为`"GC Roots"`的根对象作为起点，根据引用关系向下搜索，搜索过程走过的路称为`"引用链"`。如果某个对象到`"GC Roots"`没有任何引用链相连，就说明该对象需要被回收。

![](https://image.leejay.top/image/20200813/PK6PSNTuG2W8.png?imageslim)

> 图中绿色为`可达对象`，灰色为`不可达对象`。
>
> `GC Roots`包括但不限于以下：
>
> 1. 栈帧中引用的对象（局部变量、临时变量等）
> 2. 类中的`引用型静态变量`
> 3. `字符串常量池中的引用`。
> 4. 被`Synchronized`锁持有的对象。

#### 3.并发的可达性

我们知道大部分的收集器都是使用`可达性算法`判断标记对象是否要被回收，其中又被分为`中断用户线程`、`与用户线程并发执行`两种。

`中断用户线程`进行标记时，对象图中的对象或引用不会被修改，但堆中存储的对象越多，带来的`STW`时间也会越长。因此为了减少`STW`时长，`标记与用户线程同时运行`能有效减少`STW`时长，但会带来并发可达性问题：

1. `被标记完毕的对象`又新引用了`未被收集器访问的对象`。
2. `正在被标记的对象`直接或间接删除了`未被收集器访问的对象`的引用。

基于上述两个问题产生了两种解决方案：

1. **增量更新**

基于问题1，当`被标记完毕对象`又引用了`未被收集器访问的对象`时，将这些`被标记完毕对象`记录下来，等并发标记阶段结束后，以这些`被标记完毕对象为根`再次进行扫描。`CMS收集器`采用此策略实现并发标记。

2. **原始快照**

基于问题2，当`正在被标记的对象`直接或间接删除了`未被收集器访问的对象`的引用时，将这些`正在被标记的对象`记录下来，等并发标记结束后，以这些`正在被标记的对象`为根重新扫描。`G1收集器`采用此策略实现并发标记。

---

### Java中的引用

传统的引用概念：若`reference`类型的数据中存储的数值是另一块内存的起始地址，就说明该`reference`数据是某个内存、某个对象的引用。

从`JDK1.2`开始，Java对引用的概念进行补充，将引用分为了：`强引用、软引用、弱引用和虚引用`四种。

```java
public abstract class Reference<T> {
    // 引用本身
	private T referent;  
    // 存储reference本身的链表队列
    volatile ReferenceQueue<? super T> queue;
}
```

> 当垃圾回收器准备回收一个对象时，发现它还有`软、弱、虚引用`，就会在回收对象之前，将该引用加入到与之关联的`引用队列ReferenceQueue`中去，这样就可以实现在引用对象回收前的相关操作。

![](https://image.leejay.top/image/20200813/yIcmomijhoVr.png?imageslim)

- 强引用

即最传统引用的体现，比如`Object obj = new Object()`，只要强引用关系存在，那么垃圾回收器永远不会回收掉被引用的对象。

- 软引用

用于描述`还有用、但非必须的对象`，只被软引用`关联（指向）`的对象，在OOM之前，会将这些对象进行二次回收，如果回收后仍没有足够内存，才会抛出OOM。Java中用`SoftReference`实现。

- 弱引用

相比`软引用`，只被`弱引用关联（指向）`的对象只能生存到下一次垃圾收集，只要垃圾回收器工作，`弱引用`就会被回收。Java中用`WeakReference`实现。`ThreadLocal.ThreadLocalMap<k,v>中key就继承了弱引用`。

```java
public class Weak {
    private static WeakReference<String> weakReference;

    public static void main(String[] args) {
        test();
        System.out.println(weakReference.get());// hello
        System.gc(); // test作用域结束，gc会清理weakReference
        System.out.println(weakReference.get());// null
    }

    static void test() {
        // str 作为test方法的本地变量
        String str = new String("hello");
        weakReference = new WeakReference<>(str);
        System.gc();// 不会被清理
        System.out.println(weakReference.get());// hello
    }
}
```

> 和软引用一样，弱引用也适合保存`可有可无的数据`，当系统内存不足的时候会被回收，内存充足的时候，缓存数据存在相当长的时间，达到让系统加速的作用。

- 虚引用

引用中最弱的一种，一个对象是否有`虚引用`的存在，对其生存时间不会产生影响，并且`无法通过虚引用获取对象实例`。唯一的作用就是为了在`该对象被回收时收到通知`。

```java
public class Phantom {
    // 实现 包含虚引用的对象在回收时接受通知
	public static void main(String[] args) {
        String hello = new String("hello");
        // 创建引用Queue
        ReferenceQueue<String> queue = new ReferenceQueue<>();
        PhantomReference<String> reference = new PhantomReference<>(hello, queue);
        new Thread(() -> {
            while (true) {
                Reference<? extends String> poll = queue.poll();
                if (poll != null) {
                    try {
                        // 此时说明hello对象被回收了
                        Field referent = Reference.class
                            .getDeclaredField("referent");
                        referent.setAccessible(true);
                        String str = (String) referent.get(poll);
                        System.out.println("GC Will Collect " + str);
                        break;
                    } catch (IllegalAccessException | NoSuchFieldException e) {
                        e.printStackTrace();
                    }
                }
            }
        }).start();
        // 去除hello的引用
        hello = null;
        // 调用垃圾回收对象
        System.gc();
    }
}
```

> 对于虚引用，它的get()方法只会返回null，因为`虚引用是不可达的`。
>
> ```java
> public class PhantomReference<T> extends Reference<T> {
>  public T get() { return null; }
> }
> ```

---

### 对象的回收

我们知道`HotSpot`采用的是`可达性算法`判断对象是否存活，那么不再存活的对象垃圾回收器是如何回收的呢？

1. 垃圾回收器对对象进行回收时，先通过`可达性算法`判断该对象是否可达。
2. 如果`对象不可达`并且`复写了finalize方法且该对象的finalize方法之前没被调用过`。
3. 垃圾回收器会将对象放置到`ReferenceQueue<Finalizer>`队列中，稍后由JVM启动一个`低优先级的Finalizer线程`去执行Queue中`对象的finalize方法`。
4. 但JVM不一定会等待`finalize`执行结束，因为如果`finalize`方法卡顿，会导致队列中后续的对象处于等待，甚至导致`整个内存回收系统的崩溃`。
5. 若该对象的finalize方法不能`将对象与引用链建立连接`，该对象会被垃圾回收器清理。

![](https://image.leejay.top/image/20200814/1LKD8vwaOJzB.png?imageslim)

```java
public class ReachabilityAnalysis {
    
    // 创建GC Roots
    private static ReachabilityAnalysis REACHABILITY_ANALYSIS = null;

    private void isAlive() {
        System.out.println("i'm still alive ...");
    }

    @Override
    protected void finalize() throws Throwable {
        super.finalize();
        System.out.println("execute finalize method ...");
        // 试图和引用链建立联系
        REACHABILITY_ANALYSIS = this;
    }

    public static void main(String[] args) throws InterruptedException {
        // 创建对象
        REACHABILITY_ANALYSIS = new ReachabilityAnalysis();
        // 去除引用链的联系, 便于测试
        REACHABILITY_ANALYSIS = null;
        // 调用gc时 对象第一次尝试自救
        System.gc();
        // 因为finalizer线程的低优先级, 需要休眠一会。
        // JVM会先判断是否有必要执行finalizer方法, 并执行相应的finalize()方法
        Thread.sleep(1_000);

        if (null != REACHABILITY_ANALYSIS) {
            REACHABILITY_ANALYSIS.isAlive();
        } else {
            System.out.println("i'm dead ...");
        }

        // 第二次自救 用于判断是否会执行finalize方法两次
        REACHABILITY_ANALYSIS = null;
        System.gc();
        Thread.sleep(1_000);
        if (null != REACHABILITY_ANALYSIS) {
            REACHABILITY_ANALYSIS.isAlive();
        } else {
            System.out.println("i'm dead ...");
        }
        // 结论: 任何对象的finalize()方法只会被系统调用一次
    }
}
```

> 对象`finalize`方法只会被JVM调用一次，只要执行`finalize`方法重新与`引用链`建立联系，就不会被清理。不建议使用`finalize进行释放资源`，因为可能发生引用外泄，无意中复活对象。并且finalize调用时间不确定，相比之下更推荐`finally释放资源`。

---

### 垃圾回收算法

#### 标记清除法(Mark-Sweep)

包含`标记阶段`和`清除阶段`。标记阶段通过`可达性算法`标记分析可达对象，清除阶段会清除所有`未被标记的对象`。
此方法会`产生空间碎片`。并且回收后的空间是`不连续`的，会导致工作效率低于连续空间。该算法更关注垃圾回收器的`耗时`操作。

#### 复制算法(Copying)

将`内存空间分为两份`，在进行垃圾回收时，将正在使用的那一份`内存中的活对象`复制到另一份内存中，之后`清除正在使用的内存块中的所有对象`，交换两个内存的角色，完成垃圾回收。
相对于`标记清除算法`，`复制算法`不会产生空间碎片，但会导致使用的`内存只有一半`。

> `新生代串行垃圾回收器`使用了该算法，它将新生代分为`eden、from(s0)、to(s1)`三个区域，GC在回收对象时，会先将`eden & s0`区域的对象复制到`s1(大对象、老年对象、s1区域满时对象会直接进入老年代)`，然后清空`eden & s0`区域，再将`s0 & s1互换`，保证`s1永远为空`。

#### 标记压缩算法(Mark-Compact)

在标记阶段，使用`可达性算法`对所有可达对象进行标记。在清除阶段，将所有的存活对象压缩到内存的一端，然后清除边界外的所有空间。相比之前的算法，避免了`内存碎片`的产生且不需要`内存折半`，但是移动大对象会给系统带来较长时间的`STW`。该算法更关注垃圾回收器的`吞吐量`操作。

> STW：垃圾回收器工作时，Java程序需要暂停工作，等待垃圾回收完成，这种现象叫做`Stop The World`。

#### 分代算法(Generational Collecting)

基于两个分代假说之上：

> 弱分代假说：绝大多数的对象都是朝生夕灭的。
>
> 强分代假说：熬过多次垃圾回收的对象就越难以消亡。

奠定了垃圾收集器的一致设计原则：`收集器应将Java堆分成不同的区域，然后将回收对象依据其年龄(对象熬过垃圾回收的次数)分配到不同的区域中存储`。

但因为对象会存在`跨代引用`，即`新生代对象完全可能被老年代对象引用`，因此除了必要的可达性分析外，还需要`遍历老年代对象`来保证所有对象可达性分析结果的准确性。基于此理论提出了`跨代引用假说：`

> 跨代引用相对于同代引用来说仅占极少部分。

并基于此假说采用了如下设计：在新生代上建立一个全局数据结构`记忆集(Remembered Set)`，该结构将老年代划成若干小块，标识出老年代哪一块内存会存在跨代引用，当发生新生代垃圾回收时，会对记忆集中的记录加入`GC Roots`进行扫描，相比扫描整个老年代来说大大的减少了运行时开销。

#### 分区算法(Region)

`分区算法将整个堆空间分成连续的不同小区间，每个小区间都独立使用，独立回收`。控制一次回收小区间的数量，能够有效减少GC产生的停顿。

![](https://image.leejay.top/image/20200814/jQj1OYkGDUEJ.png?imageslim)

> 分区回收算法带来的跨代引用问题：
>
> 因为对象会存在`新生代、老年代间的跨代引用问题`，垃圾收集器建立了名为`记忆集(Remember Set)`的数据结构，用于`记录非收集区域指向收集区域的指针集合`的抽象数据结构。继而`避免对整个老年代进行扫描`。
>
> `卡表(Card Table)`是最常见的实现`记忆集`结构的方式。可以是`字节数组`或`哈希表`，存储的是`跨代引用的对象的内存地址`，这样只需要筛选出跨代引用的对象，将其加入GC Roots中一起扫描即可。

---

## 4. 垃圾回收期器
### JVM中经典的垃圾回收器

下图是来自<a href="https://blogs.oracle.com/jonthecollector/our-collectors">oracle官方博客</a>中介绍垃圾回收器之间的关系图。

![](https://image.leejay.top/image/20200817/GDG377Ck8xwv.jpg?imageslim)

> 黄色代表`新生代`，灰色代表`老年代`，两个垃圾回收器之间相连表示`这两个垃圾回收器组合使用`。
>
> `Serial & CMS` 与 `ParNew & Serial Old`两组 在`JDK8`中已过期，`JDK9`中已移除。
>
> 我们用`并行`、`并发`来形容不同的收集器：
>
> 并行：描述的是多条垃圾回收器线程之间的关系，默认此时的`用户线程处于等待`状态。
>
> 并发：描述垃圾回收器线程与用户线程间的关系，说明同一时间`垃圾回收器线程与用户线程都在运行`。

---

### 新生代收集器

以下三种收集器都采用的是`标记-复制算法`来实现收集器的回收逻辑。

#### Serial收集器

使用`单线程`工作的收集器，除了只会用`一个处理器或一个收集线程`去完成垃圾收集工作，更重要的是它在进行垃圾收集时，必须`暂停其他所有的工作线程(STW)`，直到收集结束。是`客户端模式`下默认新生代收集器。

> 客户端/服务端区别：client比server模式`启动速度更快`，当server比client模式`运行速度更快`。

相比其他垃圾收集器，`Serial收集器`时所有垃圾回收器里面`额外内存消耗最小的`，但`STW耗时是最长的`；对于`单核处理器或处理器核心较少`环境来说，由于没有线程交互的开销，`Serial收集器`可以获得`最高的单线程收集效率`。

```bash
-XX:+UseSerialGC 新生代 & 老年代都使用串行收集器
```

#### ParNew收集器

`ParNew收集器`本质上是`Serial收集器`的`多线程并行`版本。除了`同时使用多条线程`进行垃圾收集外，其余的和`Serial收集器`一致。

> 这里的并行指的是：`同一个时间有多个`这样的收集线程在协调工作，用户线程此时处于等待状态。

除了`Serial收集器`外，只有`ParNew收集器`能与`CMS收集器`配合工作。

```bash
# 新生代ParNew & 老年代CMS 是开启CMS下新生代默认收集器
-XX:+UseConcMarkSweepGC
# 新生代ParNew & 老年代SerialOld（JDK8后已过期）
-XX:+UseParNewGC  
```

因为线程交互的开销，在`单核处理器`下性能低于`Serial`，但是`多核心`下`ParNew`收集器还是很高效的。

```bash
# 垃圾收集的线程数为8
-XX:ParallelGCThreads=8
```

> 不设置此参数时，当`Cpu Cores < 8`时，`Threads=Cpu Cores`，否则 `Threads=3+(5*cores)/8）`。

#### Parallel Scavenge收集器

相比`ParNew收集器`目标是`减少用户线程的停顿时间`，`Paraller收集器`关注则是`可控制的吞吐量`。
$$
吞吐量 = 运行用户代码时间 / (运行用户代码时间 + 运行垃圾收集时间）
$$

> 假设JVM执行完成某个请求共需要100分钟，其中垃圾收集花费1分钟，那么吞吐量就是`99%`。
>
> `低停顿时间`适合`用户交互或保证服务响应`的程序。`高吞吐量`适合`最高效率`利用处理器资源，`尽快`完成程序的`运算任务`。
>
> `停顿时间`缩短是以牺牲`吞吐量和新生代空间`为代价的。如果我们将新生代设置的较小，虽然会减少每次回收的时间，但是会导致垃圾回收更加频繁，虽然停顿时间在减少，但是吞吐量在下降。

```bash
# 允许设置一个大于0的毫秒数，收集器尽量保证内存回收时间不超过该值
-XX:MaxGCPauseMillis
# 允许设置一个大于0小于100的整数n
# 系统将花费不超过 1/(1+n)的时间进行回收 假设n=99，那么不超过1%时间进行回收。
-XX:GCTimeRatio
# 自适应GC策略，自动调整新生代大小，老年代晋年龄等 区别于ParNew是Paraller独有
-XX:+UseAdaptiveSizePolicy
```

---

### 老年代收集器

#### Serial Old收集器

是`Serial`收集器的老年代版本，基于`标记-整理`的`单线程`收集器，用于`客户端`模式下的HotSpot虚拟机使用。

在`服务端`模式下，有两个用途：JDK5及之前版本中与`Parallel Scavenge`配合使用；作为`CMS`收集器发生失败时的备用收集器。

#### Parallel Old收集器

JDK6推出，是`Parallel Scavenge`收集器的老年代版本，支持`多线程并发`收集，基于`标记-整理`算法实现。

`Parallel Old`配合`Parallel Scavenge`的组合，用于`注重吞吐量和处理器资源较为稀缺的`情况。

```bash
# Parallel Scavenge + Parallel Old,JDK8默认组合
-XX:+UseParallelGC
```

#### CMS收集器

CMS(`Concurrent Mark Sweep`)收集器是一种以获取`最短回收停顿时间`为目标的收集器。基于`标记-清除`算法。

##### 收集流程

- 初始标记

此阶段仅`标记GC Roots能直接关联到的对象`。需要停顿用户线程(STW)。

- 并发标记(并发)

基于`初始标记`阶段标记的`从GC Roots可直接关联的对象开始`遍历整个对象图的过程。不需要停顿用户线程，与垃圾回收线程一起工作。

- 重新标记(并行)

该阶段是为了修正并发标记期间，因用户程序继续运作而导致标记产生变动的那部分对象的标记记录。CMS是使用`增量更新`来解决并发标记产生的问题。

- 并发清除(并发)

清理删除掉标记阶段的已死亡对象，此阶段不需要移动存活对象。

##### CMS收集器缺点

- 对处理器资源敏感

因为CMS的并发阶段会`占用一部分线程`会导致应用程序变慢，降低吞吐量。默认回收线程数是`(Cpu Cores + 3 ) / 4`，若Cpu Cores越小，那么对程序运行的影响较大。

- 无法处理浮动垃圾

在CMS`并发标记和并发清理`阶段，用户线程还在继续执行，就会有`新的垃圾对象`不断产生，但这些对象出现在初始标记阶段后，只能在下次垃圾回收中再处理这部分垃圾。

因为`CMS收集器`并发标记和并发清理的特性，必须`预留一些空间`提供给用户线程使用，不能等老年代满再工作。

```bash
# 当老年代使用了68%后CMS开始工作
# JDK5默认68%，JDK6默认92%
-XX:CMSInitiatingOccupancyFraction=68
```

>如果预留的内存不够用户线程分配新对象，会启用`Serial Old`进行`Major GC`。会带来较长的停顿时间。

- 产生大量空间碎片

因为CMS基于`比较-清除`算法，易产生大量的空间碎片，在无法给大对象分配内存时导致一次`Full Gc`。

```bash
# 默认开启，当CMS进行Full GC时开启内存碎片合并整理的过程 JDK9废弃
-XX:+UseCMSCompactAtFullCollection
# CMS在执行若干次不整理空间的Full GC后，下一次进行碎片整理 JDK9废弃
-XX:CMSFullGCBeforeCompaction
```

> Full GC：对整个Java堆进行回收，包含新生代和老年代
>
> Minor GC：对新生代进行回收。
>
> Major GC：对老年代进行回收。

#### G1收集器

#### 概念

`G1(Garbage First)收集器`开创了面向`局部收集的设计思路`和`基于Region的内存布局形式`。目的是为了实现支持`停顿时间模型`的收集器。基于`标记-整理`算法。

> 停顿时间模型：支持指定在一个长度为M毫秒的时间片段内，消耗在垃圾收集上的时间不超过N毫秒。

相比于其他收集器要么面向新生代，要么面向老年代，而G1面向堆内存任何部分来组成`回收集(Collection Set)`进行回收。衡量标准由属于哪个分代变为哪块内存垃圾最多，回收收益最大。

相比于之前的固定大小和数量的区域划分的收集器，G1将堆内存分为`多个大小相等的独立区域(Region，默认分成2048份)`，每个`Region`可以根据需要扮演`Eden、Survivor或老年代空间`。

`Region`中还存在一类特殊的`Humongous`区域，用于存储大对象，G1认为只要大小超过一个`Region`容量一半的对象即为大对象，对于超过`Region`大小的对象，将会被存放在N个连续的`Humongous`区域中。

```bash
# 设置Region的大小(单位： B)，在[1MB,32MB]必须为2的幂次方
# 设置Region的大小=2097152B=2MB，不设置默认是1MB
-XX:G1HeapRegionSize=2097152
```

G1仍然保留新生代、老年代的概念，当它们不再是固定的区域了，改为`一系列区域(不需要连续)的动态集合`。G1在后台维护一个`优先级列表`，每次根据用户通过`-XX:MaxGCPauseMillis`指定的停顿时长`(默认200ms)`，优先回收价值收益最大的`Region`，以达到最大的收集效率。

#### 收集流程

- 初始标记

和CMS类似，标记`GC Roots`直接关联的对象，此阶段会产生`STW`。

- 并发标记(并发)

基于`初始标记`，从`GC Roots`开始对堆中对象进行可达性分析，并`递归扫描整个对象图`，找出可回收对象，此过程可与用户程序并发执行。

- 最终标记(并行)

对用户线程做另一个短暂的暂停，通过`原始快照SATB`处理并发标记导致的并发可达性问题（上章分析过）。

- 筛选回收(并行)

负责更新`Region`的统计数据，并按照回收价值和成本进行排序，根据用户期望的`停顿时间`来指定回收计划。可见多个`Region`合并成`回收集(Collection Set)`，将回收的`Region`中的对象移到空的`Region`，再清理旧的`Region`，设计到对象的移动(体现`标记-整理`算法)，此阶段`用户线程暂停`，`多条收集器线程并行`完成。

#### G1vsCMS

- 优势
  - 指定最大停顿时间
  - 不会产生内存空间碎片
- 劣势
  - 并发执行带来的较高的内存占用和负载
  - 每个`Region`都持有一份`卡表`导致堆内存的消耗。

---

### 对象在堆中的分配

前面我们了解到，`大部分`的对象都是在`堆中`进行内存分配，但堆中又存在多个逻辑区域(新生代、老年代)，所以这章我们就要讨论下，对象在堆中的进行内存分配的基本原则。

#### TLAB

在讨论对象分配前，我们需要对之前引入的`TLAB`的概念进一步解析。`TLAB(本地线程缓冲)`，其存在的目的是为了加速对象的分配，即每个线程都拥有自己的专属区域进行对象分配，来避免多线程冲突，默认是启动的。

```bash
# 开/关TLAB
-XX:+/-UseTLAB
# 设置TLAB大小
-XX:TLABSize
# 查看TLAB信息
-XX:+PrintTLAB
# 对象占TLAB空间的比例，大于此比例堆中分配，小于就废弃当前
## TLAB区域，并新建一个TLAB存放，默认64
-XX:TLABRefillWasteFraction=64
# 默认情况TLAB和refill_waste是动态的，关闭TLAB动态调整
-XX:-ResizeTLAB
```

> 我们假设TLAB大小为100KB，第一次分配给对象80KB，此时还剩20KB，如果第二次有30KB大小的对象需要分配，此时有两种选择：
>
> 1. 废弃所剩的20KB区域，新建一个TLAB存放30KB的对象。
> 2. 将30KB对象分配在堆上，保留所剩的20KB区域，等到下次有小于20KB对象分配时再使用该区域。
>
> `-XX:TLABRefillWasteFraction=64`，即允许TLAB空间浪费的比例，当`对象/TLAB的比例`大于64，对象在堆中分配，小于64则会开辟新TLAB存放。

#### 一般在eden中分配

大部分情况下，`对象在Eden区中进行分配`，如果`Eden区`空间不够，JVM会发起一次`Minor GC`。

#### 大对象进入老年代

`大对象：需要大量连续内存空间的Java对象`或新生代已无足够空间分配的对象直接进入老年代。

```bash
# 将大于此大小的对象直接分配到老年代
-XX:PretenureSizeThreshold=5242880(5mb)
```

> 只适用于`Serial、Serial Old、ParNew`三种收集器。

#### 长期存活对象进入老年代

长期存活的对象将进入老年代。对象通常在eden区诞生，如果经历了一次`Minor Gc`后仍然存活，并能够被`s0`容纳，该对象会被移动到`s0`区并将其`对象头中的对象年龄 + 1`。当年龄达到阈值，就会进入老年代。

```bash
# 对象晋升到老年代的年龄阈值
-XX:MaxTenuringThreshold=15
```

> `动态对象年龄判断`：
>
> JVM不是永远要求对象年龄达到`-XX:MaxTenuringThreshold`指定的值才能晋升老年代：
>
> 如果`s0中相同年龄的对象大小总`和大于s0区域的一半`(-XX:TargetSurvivorRatio决定，默认50)`，那么`大于等于该年龄的对象`就会进入老年代。

#### 总结

对象的内存分配流程需要经历`栈上分配 -> TLAB分配 -> 是否进入老年代 -> 最终eden分配`。

---

## 5. 虚拟机参数概述

### 基本参数

| 参数                               | 作用                                             |
| :--------------------------------- | ------------------------------------------------ |
| `-XX:+PrintGCDetails`              | 打印详细的GC日志                                 |
| -XX:+PrintGCTimeStamps             | GC开头的时间为虚拟机启动时间的偏移量             |
| -XX:+PrintGCApplicationStoppedTime | 打印引用程序由于GC而产生停顿的时间               |
| `-Xloggc:D://log.txt`              | 输出GC日志到D盘下log.txt文件中                   |
| -XX:+PrintVMOptions                | 打印显示传递的参数                               |
| `-XX:+PrintCommandLineFlags`       | 打印传递给虚拟机的`显式和隐式`参数               |
| -XX:+PrintFlagsFinal               | 打印全部参数`(包括虚拟机自身的参数)`             |
| -Xss1m                             | 指定栈大小为1m                                   |
| -Xms10m                            | 初始堆空间大小                                   |
| -Xmx20m                            | 最大堆空间大小                                   |
| `-Xmn2m`                           | 新生代大小                                       |
| `-XX:SurvivorRatio`                | 新生代中eden/s0/s1比例，默认`8:1:1`              |
| `-XX:NewRatio`                     | 老年代/新生代的比例，默认2:1                     |
| -XX:NewSize                        | 新生代初始大小                                   |
| -XX:MaxNewSize                     | 新生代大小最大值                                 |
| `-XX:+HeapDumpOnOutOfMemoryError`  | 堆OOM时导出堆的信息                              |
| `-XX:HeapDumpPath=D://log.dump`    | 将OOM信息导入到D盘下log.dump文件中               |
| -XX:MetaspaceSize=1m               | 设置元数据区初始大小为1m                         |
| `-XX:MaxMetaspaceSize=2m`          | 设置元数据区大小最大为2m                         |
| `-XX:MaxDirectMemorySize=2m`       | 本机直接内存(堆外内存)最大2m，默认等于-Xmx       |
| -XX:+UseTLAB                       | 开启TLAB，默认开启                               |
| `-XX:+PrintTLAB`                   | 打印TLAB信息                                     |
| -XX:TLABSize=1024                  | 设置TLAB大小为1kb                                |
| `-XX:TLABRefillWasteFraction=64`   | 允许TLAB空间浪费的比例                           |
| -XX:-ResizeTLAB                    | 禁止TLAB自动调整大小和浪费比例                   |
| -XX:PretenureSizeThreshold=5242880 | 大于5m对象直接进入老年代，只对Serial、ParNew有用 |
| -XX:MaxTenuringThreshold=15        | 晋升到老年代的年龄大小                           |
| -XX:TargetSurvivorRatio=50        | 用于`动态对象年龄`判断的s0的使用率参数，默认50   |

---

### 收集器选择参数

| 参数                                | 新生代            | 老年代       |
| ----------------------------------- | ----------------- | ------------ |
| -XX:+UseSerialGC                    | Serial            | Serial Old   |
| `-XX:+UseParallelGC`      | Parallel Scavenge | Parallel Old |
| -XX:+UseParNewGC          | ParNew            | Serial Old   |
| `-XX:+UseConcMarkSweepGC` | ParNew            | CMS          |
| `-XX:UseG1GC`                       | G1                | G1           |

---

### 收集相关参数

| 收集器                                          | 相关参数                                                     | 注释                                                         |
| :---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| ParNew<br>Parallel<br>CMS<br>G1<br>Parallel Old | -XX:ParallelGCThreads=n                                      | 指定并行回收线程数<br>`n=cores<8?cores:3+((5*cores))/8)`     |
| Parallel                                        | -XX:MaxGCPauseMillis=n<br>-XX:GCTimeRatio=n<br>-XX:+UseAdaptiveSizePolicy | 最大回收停顿时长<br>不超过`1/1+n`时间进行回收<br>自适应GC策略 |
| CMS                                             | -XX:CMSInitiatingOccupancyFraction=n<br>-XX:CMSFullGCBeforeCompaction=n<br>-XX:+UseCMSCompactAtFullCollection | 老年代容量到n时CMS开始工作，默认92<br>CMSn次FullGC后开启碎片整理，默认0<br>CMS进行FullGC时开启碎片整理 |
| G1                                              | -XX:G1HeapRegionSize<br>-XX:MaxGCPauseMillis<br>-XX:InitiatingHeapOccupancyPercent | 指定Region大小，默认1MB，最大32MB<br>垃圾收集时停顿时长，默认200ms<br>堆使用率达到n后开启并发标记，默认45 |

---