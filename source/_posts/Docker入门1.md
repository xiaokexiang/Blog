---
title: Docker入门1
date: 2019-02-29 11:20:37
tags: Docker
toc: true
categories:
- Docker
thumbnail: http://ww1.sinaimg.cn/mw690/70ef936dly1g49zzckepqj20gl08t0t2.jpg 
---
## Docker

* Docker通过对应用的封装，分发，部署，运行的生命周期进行管理，达到应用组件"一次封装，到处运行"的目的。

* 这里的应用组件可以是一个web应用，一个编译环境，一套数据库平台服务，甚至是一个操作系统或者集群。

* Docker最大的优势就是一次创建或配置，之后可以在任何地方，任意时间让应用正常运行。

* Docker的优势：
	* 更快的交付和部署
	* 更高效的资源利用
	* 更轻松的迁移和管理
	* 使用dockerfile实现更简单的更新管理

* Docker相对虚拟机的优势：
	* Docker容器的启动和停止可以在秒级实现
	* Docker容器对资源的需求很少
	* Docker通过类似Git的设计理念来方用户操作镜像

* 虚拟化
	* 虚拟化是一种资源管理技术，将计算机各种资源转换之后呈现出来，打破实体结构间的障碍，使用户用更好的方式来应用这些资源。
	* 目标是为了在同一个主机上运行多个系统或应用，提高系统资源利用率。
	* 传统虚拟化（在硬件方面实现虚拟化）和Docker（操作系统层面实现虚拟化）的结构区别：

<!-- more -->
## Docker的核心概念

* Docker镜像（Image）
Docker镜像类似于虚拟机镜像，可以理解为一个只读模板（<font color="red">镜像自身是只读的，但是容器从镜像启动的时候，会在镜像的最上层创建一个可写层</font>），镜像是创建Docker容器的基础。

* Docker容器（Container）
Docker容器类似于一个轻量级的沙箱，Docker利用容器来运行和隔离容器，<font color="red">容器是从镜像创建的应用运行实例。:point_left:</font>

* Docker仓库(Repository)
  他是Docker集中存放镜像文件的场所。
  注册服务器 >> Docker仓库 >> 公有/私有仓库

## Docker的安装

* <a href="http://www.runoob.com/docker/centos-docker-install.html">Centos下安装Docker</a>
* 环境要求： 64位操作系统，内核版本至少为3.1.0（uname -r）,Centos6.5之后的版本，推荐Centos7。

* 操作命令
``` java
启动docker： systemctl start docker
停止docker： systemctl stop docker
查看docker状态： systemctl status docker
查看docker版本： docker version
```
* 配置docker镜像拉取加速器
``` java
vi /etc/docker/daemon.json （没有就创建,添加如下）
{
  "registry-mirrors": ["http://hub-mirror.c.163.com"]
}
```

## Docker镜像

* 获取镜像
如果不指定tag，默认是latest，如果不指定网址，默认是Docker Hub Registery
``` json
docker [:url] pull NAME[:TAG]
```

* 查看所有镜像
``` json
展示全部： docker images -a
只展示ID： docker images -p
```
展示信息包括： 来源仓库，镜像标签，镜像ID，创建时间（最后更新时间）和镜像大小。
可以通过镜像ID前若干个可区分字符来代替完整ID

* 给镜像自定义tag使用
``` json
docker tag hello-world:latest lucky:latest
```

* 查看详细的镜像信息
``` json
查看详细信息： docker inspect [NAME|ID]
查看某一项信息： docker inspect [NAME|ID] -f {{".一级目录.二级目录"}}
```

* 查看镜像历史
``` json
不截断完全输出： docker history [NAME|ID] --no-trunc
```

* 搜寻镜像
``` json
docker search --automated --no-trunc -s 3 nginx
```
--automated: 仅显示自动创建的镜像，默认false
--no-trunc： 不截断显示，默认是false
-s： 仅显示指定星级以上的镜像，默认是0

* 删除镜像
``` json
1.查看正在运行的容器： docker ps -a
2.删除依赖要删除镜像的全部容器： docker rm [containerID]
3.删除镜像： docker rmi [IMAGE|TAG|ID]
4.强行删除： docker -f [IMAGE|TAG|ID]
```

## 创建镜像

* 基于已有镜像的容器创建
``` java
docker commit -m "提交消息" -a "作者" 编辑的镜像新ID 镜像名：标签
docker commit -m "new file" -a "Lucky" a356b8ac1ec8 test:0.1
```
* 基于本地模板导入
模板下载地址： http://openvz.org/Download/templates/precreated
``` java
cat template.tar.gz | docker import - ubuntu:14.04
```

* 基于Dockerfile创建
 //TODO

## 存出和载入镜像

* 存出镜像，导出镜像到本地文件
``` java
docker save -o ubuntu_14.04.tar ubuntu:14.04
```
* 载入镜像，将导出的tar文件再倒入到本地镜像库
``` java
docker load --input ubuntu_14.04.tar
docker load < ubuntu_14.04.tar
```

## 上传镜像
``` java
user用户上传test：latest镜像到Docker Hub
1.先打标准格式的标签： docker tag test:0.1 lucky/test:01
2.docker hub登陆： docker login
3.推送： docker push [repo_url] [NAME:TAG] docker push user/test：latest
```