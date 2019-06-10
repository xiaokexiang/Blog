---
title: web入门学习
date: 2019-05-16 15:23:56
tags: Css&Javascript
categories:
- Web
---
# css-插入样式表
* 外部样式
``` html
<head>
    <link rel="stylesheet" type="text/css" href="mystyle.css">
</head>
```
* 内部样式
``` html
<style>
    .aclass {
        color: red;
    }
</style>
```
* 内联样式
``` html
<p style="color: red;"></p>
```
* 存在多个优先级:
(内联样式)Inline style > (内部样式)Internal style sheet >(外部样式)External style sheet > 浏览器默认样式

# css-参数详解
* 背景
    * background-color: 用于定义背景颜色
* 文本
    * color: 定义文本颜色
    * text-align: 文本水平对齐方式
        * center: 居中
        * left&right: 左&右
        * justify: 整个div左右外边距对齐
    * text-decoration: 设置或删除文本的装饰
        * overline: 上划线
        * line-through: 中划线
        * underline: 下划线
        * none: 出去装饰可用于去除a标签的下划线
    * text-transform: 文本转换
        * uppercase: 大写
        * lowercase: 小写
        * ext-transform: 首字母大写
* 字体
    * font-style: 字体样式
        * normal: 正常
        * italic: 斜体
        * oblique: 倾斜的文字
    * font-size: 字体大小
        * 默认是16px
        * 16px = 1em
* 链接
    * link: 未访问链接
    * visited: 已访问过
    * hover: 鼠标移动到链接上
    * active: 鼠标点击时
* 表格
    <!-- 边框样式 -->
    * border: 1px solid black
    <!-- 只会有一个边框 -->
    * border-collapse: collapse
* 盒子模型:
    <img src="https://www.runoob.com/images/box-model.gif"/>
    * Margin(外边距) - 清除边框外的区域，外边距是透明的。
    * Border(边框) - 围绕在内边距和内容外的边框。
    * Padding(内边距) - 清除内容周围的区域，内边距是透明的。
    * Content(内容) - 盒子的内容，显示文本和图像。<br/>
    <b>如果margin&padding不指定某一边,默认是四边</b>
* 边框
    * border-style: 定义边框样式 上右底左 -> dotted solid double dashed 
    * border-width: 定义边框样式的宽细
    * border-style: 边框颜色
* 轮廓
    <img src="https://www.runoob.com/images/box_outline.gif">
    * outline: 边框外的样式
* 外边距&填充
    <img src="https://www.runoob.com/wp-content/uploads/2013/08/VlwVi.png">
    * margin: 25px 50px 75px 100px; 上右下左
    * margin: 25px 50px 75px; 上 左右 下
    * margin: 25px 50px; 上下 左右
    * margin: 25px; 上下左右
* 分组和嵌套
    * 分组选择器
    ``` js
        h1,h2,p
        {
            color:green;
        }
    ```
    * 嵌套选择器
    ``` js
        p
        {
            color:blue;
            text-align:center;
        }
        .marked
        {
            background-color:red;
        }
        .marked p
        {
            color:white;
        }
        p.marked{
            text-decoration:underline;
        }
    ```
* 尺寸
    * width&height: 宽&高
    * line-height: 行高,可以实现上下居中
* 显示
    * display: none 隐藏元素切不会占用布局
    * visibility: hidden 隐藏元素但是会占用布局
    * `<h1>`&`<p>`&`<div>`: <b>块元素,占用全部宽度,前后都是换行符</b>
    * `<span>`&`<a>`: <b>内联元素只需要必要宽度,不强制换行</b>
    * 块 -> 内联: display: inline
    * 内联 -> 块: display: block
* 定位(Position)
    * static: 遵循正常的文档流程不受top,bottom,left,right影响
    * fixed: 固定位置,不受滚动条影响
    * relative: 移动相对定位元素,但所占空间不会改变
    * absolute: 绝对定位的元素的位置相对于最近的已定位父元素，如果元素没有已定位的父元素，那么它的位置相对于`<html>`,不占据空间且与其他元素重叠
    * sticky: 粘性定位,它的行为就像 position:relative; 而当页面滚动超出目标区域时，它的表现就像 position:fixed;，它会固定在目标位置。滚动条特效
    * z-index: 值是正数或者负数,具有更高堆叠顺序的元素总是在较低的堆叠顺序元素的前面
* overflow 控制溢出
    * visible: 默认,展示全部,内容会溢出元素框
    * auto: 如果内容被修剪,就会展示竖滚动条
    * scroll: 不管内容有没有修剪,都会展示横竖滚动条
    * hidden: 只展示部分
    * inherit: 规定应该从父元素继承 overflow 属性的值
* 浮动(Float)
    * float: left&right 靠左&右
    * clear: 清除浮动,为了避免周围的元素会重新排列
* 对齐
    * 元素居中: margin: auto
    * 文本居中: text-align: center
    * 左右对齐-定位方式: position: absolute
    * 左右对齐-float方式: float: right
    * 文字上下对齐: line-height
    * 元素上下对齐: padding: 设置左右为0
* 组合选择符
    * 后代选择器(所有的层级): 空格分隔
``` js
    div p
    {
        background-color:yellow;
    }
    ```
    * 子元素选择器(只有一层): >
    ``` js
    div > p
    {
        background-color:yellow;
    }
    ```
    * 相邻兄弟选择器(相邻的一个兄弟): +
    ``` js
    div + p
    {
        background-color:yellow;
    }
    ```
    * 后续兄弟选择器(相邻的多个兄弟): ~
    ``` js
    div ~ p
    {
        background-color:yellow;
    }
```

* <a href="https://www.runoob.com/css/css-pseudo-classes.html">伪类</a>
* <a href="https://www.runoob.com/css/css-pseudo-elements.html">伪元素</a>
* <a href="https://www.runoob.com/css/css-navbar.html">导航栏</a>
* <a href="https://www.runoob.com/css/css-dropdowns.html">下拉菜单</a>
* <a href="https://www.runoob.com/css/css-website-layout.html">css布局</a>

# javascript
* js用法
``` js
<script>
    function xxx(){};
</script>
```

* 引入外部js
``` js
<script src="xxxx.js"></script>
```

* js输出
    * window.alert()
    * document.write(): 会覆盖整个html页面
    * innerHTML
    * console.log()

* js数据类型:
    * number 123
    * string "zhangsan"
    * boolean
    * object {name: "张三"}
    * array: [1,2,3,4]
    * null
    * undefined
    
* js作用域
    * 局部变量
    * 全局变量
* js事件
    * onchange: HTML 元素改变
    * onclick: 用户点击 HTML 元素
    * onmouseover: 用户在一个HTML元素上移动鼠标
    * onmouseout: 用户从一个HTML元素上移开鼠标
    * onkeydown: 用户按下键盘按键
    * onload: 浏览器完成页面加载
* js比较
    * `==`: 值是否相等
    * `===`: 值和类型都相等
    * `!=`: 值是否不等
    * `!==`: 值和类型有一个不等或者全不相等
    * `>`: 大于
    * `>=`: 大于等于
    * `<`: 小于
    * `<=`: 小于等于
    * `&&`: 与
    * `||`: 或
    * `!`: 非
* js条件语句:
    * if else
    * if else if else
    * switch
* js循环
    * for
    ``` js
    for (var i=0;i<10;i++){

    }
    ```
    * for in
    ``` js
    var person={fname:"John",lname:"Doe",age:25}; 
    for (a in person){

    }
    ```
    * while
    ``` js
    while () {

    }
    ```
    * do while
    ``` js
    do {

    }
    while (条件);
    ```
* break&continue
    * break: 打断循环
    * continue: 跳过符合条件的数据
* typeof
    * null: typeof(null)返回的是object
    * undefined: typeof(undefined)返回的是undefined
    * null === undefined: false
    * null == undefined: true
    * array的数据类型是object: typeof(Array)
    * Date的数据类型是object: typeof(Date)
    * null的数据类型是object: typeof(null)
    * NaN的数据类型是number: typeof(NaN)
    * 未定义变量数据类型是undefined: typeof(undefined)
* js类型转换
    * 类型.constructor返回的是该类型的构造方法
    * number -> string: String(n); n.toString()
    * boolean -> string: String(true): "true"  String(false): "false"
    * string -> number: Number("1"): 1 Number(true): 1 Number(false): 0
* js变量提升
    <b>变量提升：函数声明和变量声明总是会被解释器悄悄地被"提升"到方法体的最顶部。</b>
* js严格模式
    ``` js
    <script>
    "use strict";
    </script>
    ```
* let&const
    * let 声明的变量只在 let 命令所在的代码块内有效。
    * const 声明一个只读的常量，一旦声明，常量的值就不能改变。
* js JSON
    * JSON.parse(): 用于将一个 JSON 字符串转换为 JavaScript 对象。
    * JSON.stringify(): 用于将 JavaScript 值转换为 JSON 字符串
* js void
    ``` js
    <a href="javascript:void(0)">单击此处什么也不会发生</a>常用于死链接
    ```
* js闭包
    * 闭包是一种保护私有变量的机制，在函数执行时形成私有的作用域，保护里面的私有变量不受外界干扰。
直观的说就是形成一个不销毁的栈环境。

* HTML DOM(文档对象模型: Document Object Model)
    <img src="https://www.runoob.com/images/pic_htmltree.gif">
    * 通过id查找HTML元素: 
    ``` js
    document.getElementById('id');
    ```
    * 通过标签名查找HTML元素: 
    ``` js
    var x = document.getElementById('a');
    // 查询id为a的元素内的`<p>`元素
    var y = x.getElementsByTagName('p');
    ```
    * 通过类名找到HTML元素
    ``` js
    var x=document.getElementsByClassName("intro");
    ```
    * 修改html标签属性
    ``` js
     document.getElementById('btn').onclick = showAlert();
    ```
    * 修改css样式
    ``` js
    document.getElementById('btn2').style.color = '#0366D6';
    ```
* DOM 事件
    * onclick()
    * onload() & onunload()
    * onchange()
    * onmouseover()&onmouseout()
    * onmousedown()&onmouseup()
    * onfocus(): 输入字段获取焦点时
* DOM EventListener
    * 添加监听事件
    ``` js
    document.getElementById('el').addEventListener('click', function () {
        window.alert('监听到了事件...');
    });
    ```
    * 事件传递方式: 冒泡(先内后外)&捕获(先外后内)
    ``` js
    // useCapture 默认值为 false, 即冒泡传递，当值为 true 时, 事件使用捕获传递。
    addEventListener(event, function, useCapture);
    ```
    * 移除事件监听
    ``` js
    element.removeEventListener("mousemove", myFunction);
    ```
* DOM节点
    * 创建新的节点在某节点之后
    ``` js
    var newp = document.createElement('p');
    var node = document.createTextNode('这是一个新的段落');
    newp.appendChild(node);
    document.getElementById('div1').appendChild(newp);
    ```
    * 创建新的节点在某节点之前
    ``` js
    document.getElementById('div1').insertBefore(newp);
    ```
    * removeChild(): 移除元素
    * replaceChild(): 替换元素
* DOM集合
    * 获取所有html的元素
    ``` js
    // 获取所有的p元素
    var myCollection = document.getElementsByTagName("p");
    // 改变p元素背景色为红色
    for (i = 0; i < myCollection.length; i++) {
        myCollection[i].style.backgroundColor = "red";
    }
    ```
    * 获取所有节点元素
    ``` js
    document.querySelectorAll("p");
    ```
* 浏览器对象模型(Browser Object Model (BOM))
    * window对象
    ``` js
    window.document.getElementById("header");
    等同于
    document.getElementById("header");
    ```
    * window.open(): 打开新的窗口
    * window.close(): 关闭当前窗口
    * window.moveTo(): 移动当前窗口
    * window.resizeTo(): 调整当前窗口的尺寸
    * screen.availWidth: 可用屏幕宽度
    * screen.availHeight: 可用屏幕高度
    * location.hostname: 返回web主机的域名
    * location.pathname: 返回当前页面的路径和文件名
    * location.port: 返回web主机端口
    * location.protocol: 返回使用的web协议
    * history.back() - 与在浏览器点击后退按钮相同
    * history.forward() - 与在浏览器中点击向前按钮相同
    * window.alert(): window警告框
    * window.confirm(): window确认框
    * window.prompt(): window确认提示输入框
* js计时器
    * setInterval(): 间隔指定的毫秒数不停的执行指定的代码
    ``` js
    var interval = window.setInterval(function () { myTimer() }, 1000);
    function myTimer() {
        const time = new Date().toLocaleString();
        document.getElementById('demo6').innerHTML = time;
    }
    function stopInterval() {
        clearInterval(interval);
    }
    ```
    * setTimeout(): 在指定的毫秒数后执行代码
    ``` js
    let to;
    function timeout() {
        to = window.setTimeout(function () {
            alert(new Date());
        }, 3000);
    }
    function stopTimeout() {
        stopTimeout(to);
    }
    ```