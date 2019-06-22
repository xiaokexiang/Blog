---
title: CSS入门学习
date: 2019-05-16 15:23:56
tags: Web
toc: true
categories:
  - CSS
thumbnail:  http://file.w3cbest.com/file/images/watercss.png
---

## CSS插入样式表
### 外部样式
```html
<head>
  <link rel="stylesheet" type="text/css" href="mystyle.css" />
</head>
```
### 内部样式
```html
<style>
  .aclass {
    color: red;
  }
</style>
```
### 内联样式
```html
<p style="color: red;"></p>
```
TIPS: **(内联样式)Inline style > (内部样式)Internal style sheet >(外部样式)External style sheet > 浏览器默认样式**

## CSS 参数详解

### 背景

 * background-color: 用于定义背景颜色

### 文本

 * color: 定义文本颜色
 + text-align: 文本水平对齐方式
  + center: 居中
  + left&right: 左&右
  + justify: 整个 div 左右外边距对齐

### text-decoration: 设置或删除文本的装饰

+ overline: 上划线
+ line-through: 中划线
+ underline: 下划线
+ none: 出去装饰可用于去除 a 标签的下划线

### text-transform: 文本转换

- uppercase: 大写
- lowercase: 小写
- ext-transform: 首字母大写

### 字体

#### font-style: 字体样式

+ normal: 正常
+ italic: 斜体
+ oblique: 倾斜的文字

#### font-size: 字体大小

+ 默认是 16px
+ 16px = 1em

### 链接

+ link: 未访问链接
+ visited: 已访问过
+ hover: 鼠标移动到链接上
+ active: 鼠标点击时

### 表格

<!-- 边框样式 -->
+ border: 1px solid black
<!-- 只会有一个边框 -->
+ border-collapse: collapse

### 盒子模型

  <img src="https://www.runoob.com/images/box-model.gif"/>

  + Margin(外边距) - 清除边框外的区域，外边距是透明的。
  + Border(边框) - 围绕在内边距和内容外的边框。
  + Padding(内边距) - 清除内容周围的区域，内边距是透明的。
  + Content(内容) - 盒子的内容，显示文本和图像
  Tips:  如果 margin&padding 不指定某一边,默认是四边

### 边框

+ border-style: 定义边框样式 上右底左 -> dotted solid double dashed
+ border-width: 定义边框样式的宽细
+ border-style: 边框颜色

### 轮廓

  <img src="https://www.runoob.com/images/box_outline.gif">
  + outline: 边框外的样式

### 外边距&填充

  <img src="https://www.runoob.com/wp-content/uploads/2013/08/VlwVi.png">
  + margin: 25px 50px 75px 100px; 上右下左
  + margin: 25px 50px 75px; 上 左右 下
  + margin: 25px 50px; 上下 左右
  + margin: 25px; 上下左右

### 分组和嵌套
  + 分组选择器
  ```js
  h1, h2, p;
  {
    color: green;
  }
  ```
  + 嵌套选择器
  ```js
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
  
## 尺寸
  + width&height: 宽&高
  + line-height: 行高,可以实现上下居中
### 显示
  + display: none 隐藏元素切不会占用布局
  + visibility: hidden 隐藏元素但是会占用布局
  + `<h1>`&`<p>`&`<div>`: <b>块元素,占用全部宽度,前后都是换行符</b>
  + `<span>`&`<a>`: <b>内联元素只需要必要宽度,不强制换行</b>
  + 块 -> 内联: display: inline
  + 内联 -> 块: display: block
  
### 定位(Position)
  + static: 遵循正常的文档流程不受 top,bottom,left,right 影响
  + fixed: 固定位置,不受滚动条影响
  + relative: 移动相对定位元素,但所占空间不会改变
  + absolute: 绝对定位的元素的位置相对于最近的已定位父元素，如果元素没有已定位的父元素，那么它的位置相对于`<html>`,不占据空间且与其他元素重叠
  + sticky: 粘性定位,它的行为就像 position:relative; 而当页面滚动超出目标区域时，它的表现就像 position:fixed;，它会固定在目标位置。滚动条特效
  + z-index: 值是正数或者负数,具有更高堆叠顺序的元素总是在较低的堆叠顺序元素的前面
  
### overflow 控制溢出
  + visible: 默认,展示全部,内容会溢出元素框
  + auto: 如果内容被修剪,就会展示竖滚动条
  + scroll: 不管内容有没有修剪,都会展示横竖滚动条
  + hidden: 只展示部分
  + inherit: 规定应该从父元素继承 overflow 属性的值
  
### 浮动(Float)
  + float: left&right 靠左&右
  + clear: 清除浮动,为了避免周围的元素会重新排列
  
### 对齐
  + 元素居中: margin: auto
  + 文本居中: text-align: center
  + 左右对齐-定位方式: position: absolute
  + 左右对齐-float 方式: float: right
  + 文字上下对齐: line-height
  + 元素上下对齐: padding: 设置左右为 0
  
### 组合选择符
  + 后代选择器(所有的层级): 空格分隔
  ``` js
    div p
    {
        background-color:yellow;
    }
  ```
  + 子元素选择器(只有一层): >
  ``` js
    div > p
    {
        background-color:yellow;
    }
  ```
  + 相邻兄弟选择器(相邻的一个兄弟): +
  ``` js
  div + p
  {
  background-color:yellow;
  }
  ```
  + 后续兄弟选择器(相邻的多个兄弟): ~
  ``` js
	div ~ p
	{
	background-color:yellow;
	}
 ```

- <a href="https://www.runoob.com/css/css-pseudo-classes.html">伪类</a>
- <a href="https://www.runoob.com/css/css-pseudo-elements.html">伪元素</a>
- <a href="https://www.runoob.com/css/css-navbar.html">导航栏</a>
- <a href="https://www.runoob.com/css/css-dropdowns.html">下拉菜单</a>
- <a href="https://www.runoob.com/css/css-website-layout.html">css 布局</a>
