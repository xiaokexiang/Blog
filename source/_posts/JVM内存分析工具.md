---
title: JVM内存分析工具
date: 2019-11-19 20:51:55
tags: Java
categories:
  - Jvm
thumbnail: http://image.leejay.top/image/20191227/emKPmWFCLrVD.png
---

## 前言

最近今天, 业务上的某个模块内存占用率一直很高, 让我到测试环境看下原因, 于是就记录下常用分析命令，也包括一些 k8s 的基本命令, 虽然在使用, 但是老是忘-.-. 至于内存分析, 选择的是`jmap`配合`jvisualVM`或者`MAT`, 前两个工具都是 JDK 自带的, 如果 linux 下 有装过 Java 环境的, 可以直接使用, 没有的可以自己去装个 Java, 内存分析工具这里就不介绍了~，大家可以自己 google 下

## 命令

### k8s

因为测试环境是通过 k8s 管理 docker 容器的, 所以先记录下 k8s 的基本命令

- 获取所有的 pods

```bash
# 如果有namespace,记得要指定,默认是default namespace
$ kubectl get pods -n=${namespace}
```
<!--more-->
- 获取指定 pods 信息

```bash
# pod name 通过上一条命令获取
$ kubectl -n=${namespace} describe pod ${podname}
```

- 查看 pods 日志

```bash
# 类似tail -f 命令
$ kubectl logs -f -n=${namespace} ${podname}
```

- 进入 pods 容器

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

- top

  ```bash
  # 会打印当前所有的进程及相关信息
  $ top
  ```

  <img src="https://ftp.bmp.ovh/imgs/2019/11/788e8928671051de.png">

  > VIRT: virtual memory usage,进程需要的虚拟内存大小, 包括进程适用的库、代码、数据等
  > RES: resident memory usage 常驻内存, 进程当前适用的内存大小,包括其他进程的共享
  > SHR: shared memory 共享内存, 除了自身进程的共享内存，也包括其他进程的共享内存,计算某个进程所占的物理内存大小公式: RES – SHR
  > %CPU: 表明当前进程 CPU 占用, P 键: 以 CPU 占用率大小的顺序排列进程列表
  > %MEM: 表明当前进程内存占用率, M 键: 以内存占用率大小的顺序排列进程列表
  > PID: 进程号, N 键: 以 PID 的大小的顺序排列表示进程列表

- jps

  ```bash
  # 打印全部的java程序进程id, 需要JDK支持
  $ jps
  ```

- ps aux

  ```bash
  # -a 显示现行终端机下的所有程序,包括其他用户的程序
  # -u: 用户为主的格式来显示程序状.
  # -x 显示所有程序, 不以终端机来区分.
  $ ps aux
  ```

### jmap

`jmap是个JVM内存分析工具(Windows环境下有些命令无效), 主要功能有: 导出heap dump文件, 查看heap内的对象统计信息以及classLoader信息. 因为目标模块是k8s pod,所以需要先进入pod, 如果没有JDK, 还需要拷贝JDK到容器内(命令见上节)`

- jmap 配置

```bash
# linux环境下输入jmap, 如果配置过java环境, 不会提示command not found
# 没有配置过的, 可以下载jdk1.8.0_162版本,然后解压,执行jmap命令时指定jmap文件路径 ex: /opt/jdk1.8/bin/jmap
$ jmap -h
```

- no option

```bash
# 打印目标虚拟机中加载的每个共享对象的起始地址、映射大小以及共享对象文件的路径全称 类似pmap命令
$ jmap <PID>
```

- 查看 heap 内存信息

```bash
# 获取java进程的堆内存信息
$ jmap -heap <PID>
```

> 如果出现`sun.jvm.hotspot.runtime.VMVersionMismatchException: Supported versions are 25.141-b15. Target VM is 25.66-b17`类似的问题. 只需要使用指定版本的 JDK 即可. ex: 当前 JVM 版本是 25.141-b15, 而 Java 程序使用的是 25.66-b17 版本的 JVM

- 获取堆内存对象统计信息

```bash
# 获取堆内存全部的对象信息
$ jmap -histo <PID>

# 获取堆内存存活的对象信息
$ jmap -histo:live <PID>

# 将堆内存存活的对象信息写入到a.txt文件
$ jmap -histo:live <PID> > a.txt
```

- 转储堆快照 dump 文件

```bash
# 将heap的dump信息写入到a.phrof格式的文件, 此文件较大,会暂停应用,线上环境慎重使用
$ jmap -dump:format=b,file=a.hprof <PID>
```

### psmap

```bash
Usage:
 pmap [options] PID [PID ...]

Options:
 -x, --extended              show details 显示详细信息
 -X                          show even more details 显示更详细的信息
 -d, --device                show the device format 显示设备格式
 -q, --quiet                 do not display header and footer 不显示头尾行
 -p, --show-path             show path in the mapping 在mapping中显示path路径
```

<img src="https://ftp.bmp.ovh/imgs/2019/11/1bcc0a25f819f7ec.png">
> 1.Address: start address ofmap  映像起始地址
> 2.Kbytes: size of map in kilobytes  映像大小
> 3.RSS: resident set size inkilobytes  驻留集大小
> 4.Dirty:  dirty pages (both sharedand private) in kilobytes  脏页大小
> 5.Mode:  permissions on map 映像权限: r=read,w=write, x=execute, s=shared, p=private
> 6.Mapping: 映像支持文件, [anon]为已分配内存[stack]为程序堆栈
> 7.Offset: offset into the file  文件偏移
> 8.Device:  device name(major:minor)  设备名

<img src="https://ftp.bmp.ovh/imgs/2019/11/4a77290667ded5b0.png">
> total: RSS的total是与top命令中RES的大小相对应的
