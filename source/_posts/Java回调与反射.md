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
> 而区分同步和异步调用的关键在于李老师是否在等待小明的回答, 如果小明思考的时候李老师在等待, 那么此时就是同步回调. 如果小明思考的时候李老师去做其他事情了, 那么此时就是异步回调.

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

<img src="https://img.vim-cn.com/cc/8bb93ddc5f7be00a064d84b822d4a6f694329b.png">

---

## Java 反射
