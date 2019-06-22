---
title: linux下安装es和es插件head
date: 2018-05-04 10:19:15
tags: Linux
toc: true
categories:
- Linux
thumbnail: https://www.logicsupply.com/company/io-hub/wp-content/uploads/2009/01/Read-only-Linux.jpg
---

📌 原文链接:https://www.cnblogs.com/Onlywjy/p/Elasticsearch.html

我在网上找了很多的教程,出现过很多的报错,上面的教程算是比较全的,转载下并附上自己遇到的坑:

* ES在启动的时候不能使用root用户启动,需要切换用户,并确认该用户拥有相关权限

* 如果在启动时出现错误问题:📌https://www.cnblogs.com/sloveling/p/elasticsearch.html

* ES后台启动使用nohup ./bin/elasticsearch& 命令,切记使用非root用户启动,否则没有反应

* 修改ES配置的时候需要修改

```java
    network.host: 0.0.0.0  方便外网访问,否则只能本地
    http.cors.enabled: true  
    http.cors.allow-origin: "*" 实现ES跨域功能
```