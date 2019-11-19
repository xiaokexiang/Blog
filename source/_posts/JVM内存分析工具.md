---
title: JVM内存分析工具
date: 2019-11-19 20:51:55
tags: JVM
categories:
- Linux
thumbnail: https://www.logicsupply.com/company/io-hub/wp-content/uploads/2009/01/Read-only-Linux.jpg
---

## 前言
  最近今天, 业务上的某个模块内存占用率一直很高, 让我到测试环境看下原因, 看就看吧~. 顺便记录下k8s的基本命令, 虽然在使用, 但是老是忘-.-, 可能因为不是经常使用吧. 至于内存分析, 选择的是`jmap`配合`jvisualVM`或者`MAT`, 前两个工具都是JDK自带的, 如果linux下 有装过Java环境的, 可以直接使用, 没有的可以自己去装个Java, 这里就不介绍了~

## 命令

### k8s 
  
  因为测试环境是通过k8s管理docker容器的, 所以先记录下k8s的基本命令

- 获取所有的pods
 
``` bash
# 如果有namespace,记得要指定,默认是default namespace
$ kubectl get pods -n=${namespace}
```

- 获取指定pods信息

```bash
# pod name 通过上一条命令获取
$ kubectl -n=${namespace} describe pod ${podname} 
```
<!--more-->
- 查看pods日志

```bash
# 类似tail -f 命令
$ kubectl logs -f -n=${namespace} ${podname}
```

- 进入pods容器

```bash
# 类似docker的exec命令
$ kubectl exec -it -n=${namespace} ${podname} /bin/bash
```

- 宿主机和容器互相拷贝文件

```bash
# 从宿主机拷贝到容器或容器到宿主机, 调换顺序即可
# kubetl -n app cp /opt/a.txt podname:/opt/
$ kubectl -n ${namespace} cp {source} {podname}:{targetpath}
```

### java pid

``` bash
# 会打印当前所有的进程及相关信息
$ top

# 打印全部的java程序进程id, 需要JDK支持
$ jps

# -a 显示现行终端机下的所有程序,包括其他用户的程序
# -u: 用户为主的格式来显示程序状.
# -x 显示所有程序, 不以终端机来区分.
$ ps aux
```

### jmap

  `jmap是个JVM内存分析工具(Windows环境下有些命令无效), 主要功能有: 导出heap dump文件, 查看heap内的对象统计信息以及classLoader信息. 因为目标模块是k8s pod,所以需要先进入pod, 如果没有JDK, 还需要拷贝JDK到容器内(命令见上节)`

- jmap配置

```bash
# linux环境下输入jmap, 如果配置过java环境, 不会提示command not found
# 没有配置过的, 可以下载jdk1.8.0_162版本,然后解压,执行jmap命令时指定jmap文件路径 ex: /opt/jdk1.8/bin/jmap
$ jmap -h
```

- no option

``` bash
# 打印目标虚拟机中加载的每个共享对象的起始地址、映射大小以及共享对象文件的路径全称 类似pmap命令
$ jmap <PID>
```
- 查看heap内存信息

``` bash
# 获取java进程的堆内存信息
$ jmap -heap <PID>
```

> 如果出现`sun.jvm.hotspot.runtime.VMVersionMismatchException: Supported versions are 25.141-b15. Target VM is 25.66-b17`类似的问题. 只需要使用指定版本的JDK即可. ex: 当前JVM版本是25.141-b15, 而Java程序使用的是25.66-b17版本的JVM


- 获取堆内存对象统计信息

``` bash
# 获取堆内存全部的对象信息
$ jmap -histo <PID>

# 获取堆内存存活的对象信息
$ jmap -histo:live <PID>

# 将堆内存存活的对象信息写入到a.txt文件
$ jmap -histo:live <PID> > a.txt
```

- 转储堆快照dump文件

```bash
# 将heap的dump信息写入到a.phrof格式的文件, 此文件较大,会暂停应用,线上环境慎重使用
$ jmap -dump:format=b,file=a.hprof <PID>
```

### MAT

### jvisualVM

### psmap