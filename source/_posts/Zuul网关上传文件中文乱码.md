---
title: Zuul网关上传文件中文乱码
top: true
date: 2019-08-06 09:19:05
tags: Java
toc: true
categories:
  - SprintCloud
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4cchi3jp9j30lo096mxc.jpg
---

### 问题缘由

搭建邮件服务器, 发送邮件带附件, 如果附件名是中文, foxmail 查看接收邮件的时候附件名是 `Java????.png`, 本地调试没问题, 部署到服务器有问题, debug 发现在 `multipartFile.getOriginalFilename()`的时候就已经出现乱码了, 这时候才发现, 我本地是直接请求服务端口号, 而线上是直接请求 zuul 网关, 于是怀疑是 zuul 网关导致的编码问题, 通过多次验证确定 zuul 网关时罪魁祸首.

### 解决办法

<a href="https://github.com/spring-cloud/spring-cloud-netflix/issues/1385">Google Issue</a><br/>
<a href="https://cloud.spring.io/spring-cloud-netflix/reference/html/#_router_and_filter_zuul">文档地址</a>

<img src="https://ae01.alicdn.com/kf/H3509672ff2044c02bff3df38644a70717.jpg">

<!--more-->

- 修改请求路径

原有`localhost:8008/xx/yy/zz` 修改成 `localhost:8008/zuul/xx/yy/zz`, 前提是已有`@EnableZuulProxy`注解, 表明此次请求的编码不进行处理.

- 修改 zuul 的 application.yml

添加配置 `zuul.servlet-path = /`, 这样默认所有的请求都走 Zuul Servlet, 不走 Springmvc DispatcherServlet.
