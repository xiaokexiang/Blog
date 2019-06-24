---
title: SpringBootActuator入门
date: 2019-02-29 15:36:44
tags: Java
toc: true
categories:
- Java
thumbnail: http://ww1.sinaimg.cn/thumbnail/70ef936dly1g4a06egs13j20i008jwep.jpg
---
## 依赖

``` java
<!--actuator配合监控端点实现了解程序的运行情况  -->
<dependency>
	<groupId>org.springframework.boot</groupId>
	<artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

## 访问

* 2.0版本之前 http://{ip}:{port}/{endpoint}

* 2.0版本之后 http://{ip}:{port}/actuator/{endpoint}

<!-- more -->
## 配置

* endpoint参数

| 端点  | 描述  | HTTP方法  |
| :------------ | :------------ | :------------ |
| autoconfig  | 显示自动配置的信息  | GET  |
| beans | 显示应用程序上下文的所有spring bean  |GET   |
| configprops  | 显示所有@ConfigurationProperties的配置属性列表  |GET   |
| dump | 显示线程活动的快照  | GET  |
| env  | 显示应用程序的环境变量  | GET  |
| health  | 显示用用程序的健康指标,值由HealthIndicator实现类提供  |GET   |
| info  | 显示应用的信息,可使用info.*属性自定义info端公开的数据  |GET   |
| mappings  | 显示所有URL路径  |  GET |
| metrics | 显示应用的度量标准信息  | GET  |
| shutdown  | 关闭应用(默认关闭,启动设置endpoints.shutdown.enabled=true)  |  POST |
| trace   |显示跟踪信息 (默认100个HTTP请求)| GET |

* appliction.yml

 <font color="red">默认只开启health & info，开启全部需要配置</font>

``` java
# 默认只开放health和info,一下配置会开放全部endpoint
management:
  endpoints:
    web:
      exposure:
        include: "*"
```