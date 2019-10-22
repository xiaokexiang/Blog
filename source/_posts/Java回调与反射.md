---
title: Java回调与反射
toc: true
date: 2019-10-18 14:14:11
tags: Java
categories:
  - Java
thumbnail: https://img.vim-cn.com/f1/baa8d4b25d955cac1a4066c02761e0dd47097d.png
---

## 前言

最近在学习和工作中都有遇到`回调函数和反射`的概念, 想就这个机会深入了解下两者的概念和用途, 一方面起到温故知新的作用, 另一方面希望在工作中能够写出优美的代码

---

## Java 回调

### Java 回调的概念

- 回调从字面意思上来讲, 就是类 A(调用方) 中的 C 方法调用类 B(被调用方或回调方) 中的 D 方法, 在 D 方法执行完毕后再反过来主动调用类 A 中的 E 方法, 方法 E 就是回调函数.

- 回调函数可以分为`同步和异步回调两种。`
  同步调用就是`C 方法会等待 D 方法执行完毕才会继续执行`, 适用于 D 方法执行时间不长的情况.
  而异步调用则是类 A 中的`C 方法通过新启动线程的方式调用 D 方法`, 这样 C 方法执行不会受到 D 方法执行时间的影响, 但是 `C 方法需要对 D 方法的结果进行监听。`

- 如果不能理解, 那么举个例子:
  <font color="green">李老师向学生小明提一个问题, 并告诉小明说有答案了就告诉李老师, 小明思考了一会后将得出的答案告诉李老师</font>
  <img src="https://img.vim-cn.com/25/5e044a8e8ab78ef25ecd506e71a6106449f0df.png">

> 在这个过程中李老师就是 Class A, 小明就是 Class B, 提问题就是方法 C, 思考并解决问题是方法 D, 将答案告诉老师就是回调函数 E
> 而区分同步和异步调用的关键在于李老师是否在等待小明的回答, 如果小明思考的时候李老师在等待, 那么此时就是同步回调. 如果小明思考的时候李老师去做其他事情了, 等到小明有答案了再告诉李老师, 那么此时就是异步回调.

<!--more-->

### 同步回调代码示例

`回调的核心在于调用方在调用被调用方的方法时将自身作为参数传递给被调用方`

- 定义回调接口

```java
public interface Teacher {
  // 回调抽象方法
  void tellAnswer(int answer);
}
```

- 定义调用方类 A

```java
public class TeacherJack implements Teacher {

  private Student student;

  // 定义调用方与被调用方的关系
  public TeacherJack(Student student) {
      this.student = student;
  }

  // 调用方类A的调用方法C
  public void askQuestion(Student student) {
      // studentTom 解决问题
      System.out.println("Teacher ask student question");
      // 核心在于调用方 调用 被调用方的方法时 需要将 调用方自身作为参数传递给 被调用方的方法
      // 调用类B的方法D
      student.resolveQuestion(this);
  }

  // 老师去做其他事情
  public void drinkTea() {
    try {
        Thread.sleep(2_000);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
    System.out.println("do other things finished ...");
  }

  // 定义回调函数E
  @Override
  public void tellAnswer(int answer) {
      System.out.println("teacher tell student you answer: " + answer);
  }
}
```

- 定义被调用方接口

```java
public interface Student {
  // 被调用方的方法D, 参数时Teacher便于Student解决完向谁报告
  void resolveQuestion(Teacher teacher);
}
```

- 定义被调用方类 B

```java
public class StudentTom implements Student {

  // 被调用方类B的方法D
  @Override
  public void resolveQuestion(Teacher teacher) {
    // 模拟解决问题...
    System.out.println("student resolve question...");
    try {
        Thread.sleep(3_000);
    } catch (InterruptedException e) {
        e.printStackTrace();
    }
    // 调用 调用方的回调方法
    System.out.println("student resolve question, ask teacher answer");
    teacher.tellAnswer(3);
  }
}

```

- 测试

```java
public class CallbackTest {

  public static void main(String[] args) {
    StudentTom tom = new StudentTom();
    TeacherJack teacher = new TeacherJack(tom);
    // teacherJack ask StudentTom 问题
    teacher.askQuestion(tom);
    // teacherJack 去做其他事情
    teacher.drinkTea();
  }
}
执行结果:
Teacher ask student question
student resolve question...
student resolve question, ask teacher answer
teacher tell student you answer: 3
drink tea finished ...
只有当学生想出答案并报告给老师之后, 老师才会去喝茶
```

### 异步回调代码示例

`异步回调的关键在于新启动一个线程去执行包含回调的方法`

```java
public static void main(String[] args) {
  StudentTom tom = new StudentTom();
  TeacherJack teacher = new TeacherJack(tom);
  // teacherJack ask StudentTom 问题后去 drinkTea()
  new Thread(() -> teacher.askQuestion(tom)).start();
  teacher.drinkTea();
}

执行结果:
Teacher ask student question
student resolve question...
drink tea finished ...
student resolve question, ask teacher answer
teacher tell student you answer: 3
老师在喝完茶后, 学生想出答案并报告给老师
```

### 代码图解

<img src="https://img.vim-cn.com/31/5d7aa9e69fe100fb61efdc4f1b05cd010ab892.png">

---

## Java 反射

### 反射的基本概念

在 oracle 的<a href="https://docs.oracle.com/javase/8/docs/technotes/guides/reflection/index.html">官网</a>中关于 `Java Reflection`的概念解释是:

> Reflection enables Java code to discover information about the fields, methods and constructors of loaded classes, and to use reflected fields, methods, and constructors to operate on their underlying counterparts, within security restrictions. The API accommodates applications that need access to either the public members of a target object (based on its runtime class) or the members declared by a given class. It also allows programs to suppress default reflective access control.

简单理解: 反射机制可以在程序`运行时`通过 Class 类动态的、安全的获取类或对象的所有属性和方法的相关信息。`java.lang.Class 类是反射的基础, 它用于封装被装入到JVM中的类(包括类和接口)的信息。类在被JVM装载的时候会创建该类的Class对象(包含该类的信息)并保存在同名的.class文件中。`

### 反射代码示例

#### 获取 Class 对象

`因为反射本质上是通过类的Class对象获取相关信息, 所以我们需要先明白如何创建类的Class对象`

- 我们先定义一个普通的 pojo 类

```java
@Data
public class ReflectionDemo {
  private static final String VALUE = "123";
  private String name;
  private String sex;
  public int age;

  public String getValue() {
    return VALUE;
  }
}
```

- 创建 ReflectionDemo 类(简称 R)的 Class 对象

```java
public void test1() throws ClassNotFoundException {

    // 1.通过Object.getClass()获取, 因为Object是所有类的父类, getClass()需要实例化对象才能调用
    ReflectionDemo reflection = new ReflectionDemo();
    Class<? extends ReflectionDemo> aClass = reflection.getClass();

    // 2.直接通过类名.class获取该类的Class对象
    Class<? extends ReflectionDemo> bClass = ReflectionDemo.class;

    // 3.通过java.lang.Class类的forName方法, 传入类的全路径(包名+类名)
    Class<?> cClass = Class.forName("leejay.top.chapter21.ReflectionDemo");

    // 结果都是class leejay.top.chapter21.ReflectionDemo
    System.out.println(aClass);
    System.out.println(bClass);
    System.out.println(cClass);
}

```

> 需要注意的是只有 getClass() 方法需要实例化对象才能够调用

#### 获取类的成员变量名

- 添加子类继承 ReflectionDemo

```java
@Data
public class ReflectionSonDemo extends ReflectionDemo {

  private static final String SON_VALUE = "456";

  private String sonName;
  private String sonSex;
  public int sonAge;

  @Override
  public String getValue() {
      return SON_VALUE;
  }
}
```

- getDeclaredFields()

  `获取Class对象自身的全部字段, 不包括父类的字段`

```java
@Test
public void test2() {
  Class<ReflectionDemo> clazz = ReflectionDemo.class
  Field[] declaredFields = clazz.getDeclaredFields();
  for (Field declaredField : declaredFields) {
      System.out.println("DeclaredField Name: " + declaredField.getName());
  }
}

DeclaredField Name: VALUE
DeclaredField Name: name
DeclaredField Name: sex
DeclaredField Name: age

```

- getFields()

  `获取Class对象自身包括父类的全部被public修饰的字段`

```java
public void test3() {
  Class<ReflectionSonDemo> sonClazz = ReflectionSonDemo.class;
  Field[] fields = sonClazz.getFields();
  for (Field field : fields) {
    System.out.println("Field Name: " + field.getName());
  }
}

Field Name: sonAge
Field Name: age
```

#### 获取成员变量类型

- 定义 pojo 类

```java
@Data
public class ReflectionFieldDemo<T> {
  public static final boolean FLAG = true;
  private String name;
  public String sex;
  private T data;
  private Integer count;
  private int age;
}
```

- getType()&getGenericType()

  `getType()返回字段的类型, getGenericType()如果当前字段没有签名属性类型就调用getType()`

```java
Class<ReflectionFieldDemo> bClass = ReflectionFieldDemo.class;
try {
    Field age = bClass.getDeclaredField("sex");
    // java.lang.String
    System.out.println(age.getType().getName());
    // java.lang.String
    System.out.println(age.getGenericType().getTypeName());

    Field data = clazz.getDeclaredField("data");
    // java.lang.Object
    System.out.println(data.getType().getName());
    // T
    System.out.println(data.getGenericType().getTypeName());
} catch (NoSuchFieldException e) {
    e.printStackTrace();
}
```

#### 获取成员变量修饰符

```java
@Test
public void test3() throws NoSuchFieldException {
  Class<ReflectionFieldDemo> clazz = ReflectionFieldDemo.class;
  Field flag = clazz.getDeclaredField("FLAG");
  int modifiers = flag.getModifiers();
  System.out.println(Modifier.toString(modifiers));
}

private static final
```

#### 修改成员变量的值

```java
public void test4() throws NoSuchFieldException, IllegalAccessException {

  ReflectionFieldDemo<Object> fieldDemo = new ReflectionFieldDemo<>();
  Class<? extends ReflectionFieldDemo> clazz = fieldDemo.getClass();

  // 获取public字段进行修改
  Field flag = clazz.getDeclaredField("FLAG");
  System.out.println("flag before: " + flag.getBoolean(fieldDemo)); // true
  flag.setBoolean(ReflectionFieldDemo.class, Boolean.FALSE);
  System.out.println("flag after: " + ReflectionFieldDemo.FLAG); // false

  // 获取private int age 字段进行修改
  Field age = clazz.getDeclaredField("age");
  // 需要设置access为true才能修改
  age.setAccessible(true);
  System.out.println("age before: " + age.getInt(fieldDemo)); // 0
  age.setInt(fieldDemo, 1);
  System.out.println("age after: " + fieldDemo.getAge());// 1

  // 获取private Integer count 字段进行修改
  Field count = clazz.getDeclaredField("count");
  // private修饰需要设置Access
  count.setAccessible(true);
  System.out.println("count before: " + count.getInt(reflectionDemo));
  count.setInt(reflectionDemo, 1);
  System.out.println("count after: " + reflectionDemo.getCount());

}
```

> 需要注意的是：
>
> 1. 如果是 final 修饰的变量是无法修改的, 会抛出 IllegalAccessException
> 2. 如果字段被 Integer 修饰, 那么 getInt()&setInt()都会报 IllegalAccessException, 分别用 get()&set()替代。其他包装类也是类似

#### 获取类中的方法

- 定义包含成员方法的类

```java
public class ReflectionMethodDemo {

  public String getValue(String string) throws NumberFormatException, IllegalStateException {
    return string;
  }
}
```

- 获取类中的方法信息

```java
@Test
public void test6() throws NoSuchMethodException {
  ReflectionMethodDemo methodDemo = new ReflectionMethodDemo();
  Class<? extends ReflectionMethodDemo> clazz = methodDemo.getClass();

  Method method = clazz.getMethod("getValue", String.class);
  // 获取方法的修饰符
  System.out.println("Method modifiers: " + Modifier.toString(method.getModifiers()));// public

  // 获取方法的返回值类型
  Class<?> returnType = method.getReturnType();
  System.out.println("Method modifiers: " + returnType.getName()); // java.lang.String

  // 获取方法的参数
  Parameter[] parameters = method.getParameters();
  for (Parameter parameter : parameters) {
      // string java.lang.String
      System.out.println("Method modifiers: " + parameter.getName() + " type: " + parameter.getType());
  }

  // 获取方法的异常类型
  Class<?>[] exceptionTypes = method.getExceptionTypes();
  for (Class<?> exceptionType : exceptionTypes) {
      // java.lang.NumberFormatException  java.lang.IllegalStateException
      System.out.println("Method modifiers: " + exceptionType.getName());
  }
}

```

#### Method invoke()

`Method的invoke()方法适用于正常情况下无法调用的方法, 比如private修饰的方法或无法创建的对象中的方法`

```java
@Test
public void test7() {
  ReflectionMethodDemo methodDemo = new ReflectionMethodDemo();
  Class<? extends ReflectionMethodDemo> clazz = methodDemo.getClass();
  Method method = clazz.getMethod("getValue", String.class);
  // 输出返回值
  Object invoke = method.invoke(methodDemo, "123");
  System.out.println("invoke result: " + invoke.toString()); // 123
}
```
