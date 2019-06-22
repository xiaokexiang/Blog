---
title: Html的DOM与BOM
date: 2019-05-28 18:31:43
tags: Web
toc: true
categories:
  - HTML
thumbnail: https://media.geeksforgeeks.org/wp-content/cdn-uploads/html-1024x341.png
---
## HTML DOM(文档对象模型: Document Object Model)
  <img src="https://www.runoob.com/images/pic_htmltree.gif">
  
#### 通过 id 查找 HTML 元素:
  ```js
  document.getElementById("id");
  ```
#### 通过标签名查找 HTML 元素:
  ```js
  var x = document.getElementById("a");
  // 查询id为a的元素内的`<p>`元素
  var y = x.getElementsByTagName("p");
  ```
#### 通过类名找到 HTML 元素
  ```js
  var x = document.getElementsByClassName("intro");
  ```
#### 修改 html 标签属性
  ```js
  document.getElementById("btn").onclick = showAlert();
  ```
#### 修改 css 样式
  ```js
  document.getElementById("btn2").style.color = "#0366D6";
  ```
----
### DOM 事件
  + onclick()
  + onload() & onunload()
  + onchange()
  + onmouseover()&onmouseout()
  + onmousedown()&onmouseup()
  + onfocus(): 输入字段获取焦点时
----
### DOM EventListener
  + 添加监听事件
  ```js
  document.getElementById("el").addEventListener("click", function() {
    window.alert("监听到了事件...");
  });
  ```
  + 事件传递方式: 冒泡(先内后外)&捕获(先外后内)
  ```js
  // useCapture 默认值为 false, 即冒泡传递，当值为 true 时, 事件使用捕获传递。
  addEventListener(event, function, useCapture);
  ```
  + 移除事件监听
  ```js
  element.removeEventListener("mousemove", myFunction);
  ```
----
### DOM 节点
  + 创建新的节点在某节点之后
  ```js
  var newp = document.createElement("p");
  var node = document.createTextNode("这是一个新的段落");
  newp.appendChild(node);
  document.getElementById("div1").appendChild(newp);
  ```
  + 创建新的节点在某节点之前
  ```js
  document.getElementById("div1").insertBefore(newp);
  ```
  + removeChild(): 移除元素
  + replaceChild(): 替换元素
----
### DOM 集合
  + 获取所有 html 的元素
  ```js
  // 获取所有的p元素
  var myCollection = document.getElementsByTagName("p");
  // 改变p元素背景色为红色
  for (i = 0; i < myCollection.length; i++) {
    myCollection[i].style.backgroundColor = "red";
  }
  ```
  + 获取所有节点元素
  ```js
  document.querySelectorAll("p");
  ```
----
## 浏览器对象模型(BOM)

### window 对象
```js
    window.document.getElementById("header");
    等同于;
    document.getElementById("header");
```
### window方法

``` js
 window.open(): 打开新的窗口
 window.close(): 关闭当前窗口
 window.moveTo(): 移动当前窗口
 window.resizeTo(): 调整当前窗口的尺寸
 screen.availWidth: 可用屏幕宽度
 screen.availHeight: 可用屏幕高度
 location.hostname: 返回 web 主机的域名
 location.pathname: 返回当前页面的路径和文件名
 location.port: 返回 web 主机端口
 location.protocol: 返回使用的 web 协议
 history.back() - 与在浏览器点击后退按钮相同
 history.forward() - 与在浏览器中点击向前按钮相同
 window.alert(): window 警告框
 window.confirm(): window 确认框
 window.prompt(): window 确认提示输入框
```