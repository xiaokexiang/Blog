---
title: JavaScript入门学习
date: 2019-05-22 12:12:16
tags: Web
toc: true
categories:
  - JavaScript
thumbnail: https://uploads-ssl.webflow.com/5b559436ff2e007783c2c551/5b9110e86e11f7d979b0dc36_javascript.png
---

## javascript

### js 用法

```js
<script>function xxx(){};</script>
```

### 引入外部 js

```js
<script src="xxxx.js" />
```

### js 输出

  + window.alert()
  + document.write(): 会覆盖整个 html 页面
  + innerHTML
  + console.log()

### js 数据类型:
  + number 123
  + string "zhangsan"
  + boolean
  + object {name: "张三"}
  + array: [1,2,3,4]
  + null
  + undefined

### js 作用域
  + 局部变量
  + 全局变量

### js 事件
  + onchange: HTML 元素改变
  + onclick: 用户点击 HTML 元素
  + onmouseover: 用户在一个 HTML 元素上移动鼠标
  + onmouseout: 用户从一个 HTML 元素上移开鼠标
  + onkeydown: 用户按下键盘按键
  + onload: 浏览器完成页面加载

### js 比较
  + `==`: 值是否相等
  + `===`: 值和类型都相等
  + `!=`: 值是否不等
  + `!==`: 值和类型有一个不等或者全不相等
  + `>`: 大于
  + `>=`: 大于等于
  + `<`: 小于
  + `<=`: 小于等于
  + `&&`: 与
  + `||`: 或
  + `!`: 非

### js 条件语句:
  + if else
  + if else if else
  + switch

### js 循环

  + for

  ```js
  for (var i = 0; i < 10; i++) {}
  ```

  + for in

  ```js
  var person = { fname: "John", lname: "Doe", age: 25 };
  for (a in person) {
  }
  ```

  + while

  ```js
  while () {

  }
  ```

  + do while

  ```js
  do {} while (条件);
  ```

### break&continue
  + break: 打断循环
  + continue: 跳过符合条件的数据

### typeof
  + null: typeof(null)返回的是 object
  + undefined: typeof(undefined)返回的是 undefined
  + null === undefined: false
  + null == undefined: true
  + array 的数据类型是 object: typeof(Array)
  + Date 的数据类型是 object: typeof(Date)
  + null 的数据类型是 object: typeof(null)
  + NaN 的数据类型是 number: typeof(NaN)
  + 未定义变量数据类型是 undefined: typeof(undefined)

### js 类型转换
  + 类型.constructor 返回的是该类型的构造方法
  + number -> string: String(n); n.toString()
  + boolean -> string: String(true): "true" String(false): "false"
  + string -> number: Number("1"): 1 Number(true): 1 Number(false): 0

### js 变量提升
  *变量提升：函数声明和变量声明总是会被解释器悄悄地被"提升"到方法体的最顶部*

### js 严格模式
  ```js
  <script>"use strict";</script>
  ```

### let&const
  + let 声明的变量只在 let 命令所在的代码块内有效。
  + const 声明一个只读的常量，一旦声明，常量的值就不能改变。

### js JSON
  + JSON.parse(): 用于将一个 JSON 字符串转换为 JavaScript 对象。
  + JSON.stringify(): 用于将 JavaScript 值转换为 JSON 字符串

### js void
  ```js
  <a href="javascript:void(0)">单击此处什么也不会发生,常用于死链接</a>
  ```

### js 闭包
**闭包是一种保护私有变量的机制，在函数执行时形成私有的作用域，保护里面的私有变量不受外界干扰,直观的说就是形成一个不销毁的栈环境**

----
## js 计时器

### setInterval(): 间隔指定的毫秒数不停的执行指定的代码
```js
  var interval = window.setInterval(function() {
    myTimer();
  }, 1000);
  function myTimer() {
    const time = new Date().toLocaleString();
    document.getElementById("demo6").innerHTML = time;
  }
  function stopInterval() {
    clearInterval(interval);
  }
```

### setTimeout(): 在指定的毫秒数后执行代码
```js
  let to;
  function timeout() {
    to = window.setTimeout(function() {
      alert(new Date());
    }, 3000);
  }
  function stopTimeout() {
    stopTimeout(to);
  }
```

