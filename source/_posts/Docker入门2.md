---
title: Docker入门2
date: 2019-03-01 15:29:49
tags: Docker
toc: true
categories:
- Docker
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccjm6pp3j30gl08tjrz.jpg

 
---
## Docker容器

* 概念
容器是镜像的一个运行实例，<font color="red">镜像是静态的只读文件，而容器带有运行时需要的文件可写层</font>。Docker容器就是独立运行的一个或一组应用以及他们必须的运行环境。

## 容器相关的操作命令

* 先创建再启动

 ``` java
1.创建容器： docker create -i -t hello-world:latest
2.运行容器： docker start [ID]
```
新建的容器处于created状态，使用docker start启动容器

<!-- more -->
* 创建并启动(推荐)
``` java
docker run ubuntu:14.04 /bin/echo 'my name is lucky' 打印msg
docker run -it ubuntu:14.04 /bin/bash 启动终端进行交互
docker logs [ID] 查看日志
docker run -d [image] 后台运行容器
docker start [image ID] exit命令之后启动[image]
```
-i:让容器的标准输入保持打开
-t:Docker分配一个伪终端并绑定到容器的标准输入上
-d:容器在后台以守护状态运行

 执行流程:
1.检查本地是否存在指定镜像，没有就下载
2.利用镜像创建容器，并启动
3.分配一个文件系统给容器，并在只读的镜像层外面挂载一层可读写层
4.从宿主主机配置的网桥中桥接一个虚拟接口到容器中
5.从网桥的地址池中分配一个ip地址给容器
6.执行用户指定的应用程序
7.执行完毕后容器被自动终止


* 终止容器

 ``` java
docker stop [-t] [container]
docker stop -t 10 ubuntu:14.04 10s后关闭ubuntu容器
docker kill
exit： 退出容器，容器处于exited状态。
退出容器而不停止容器: ctrl + P + Q
```
SIGTERM信号是等待，SIGKILL信号是停止

* 进入容器

 ``` java
 1.docker run -dit [image] /bin/bash
 2.docker ps -a
 3.docker exec -itd [Container ID] /bin/bash
 或
 1.docker attach [Container ID]
 ```

* 删除容器
``` java
docker rm [ID] 删除处于终止和退出状态的容器
-f： 是否强行终止并删除一个运行中的容器
-l：删除容器的连接，但保留容器
-v：删除容器挂载的数据卷
```

* 导入导出容器

 ``` java
 导出
 docker export -o [导出文件名] [container]
 docker export [container] > [导出文件名]

 导入
 docker import [导入文件名]
 ```

## Docker仓库

* 镜像市场
官方： https://hub.docker.com/
时速云： https://hub.tenxcloud.com/

## Docker数据管理

* 数据卷：
 <font color="red">数据卷是一个可供容器使用的特殊目录，它将主机操作系统目录直接映射进容器</font>
 特性：
 1.数据卷可以容器之间共享和重用
 2.对数据卷内数据的修改会立马生效，无论是容器内操作还是本地操作
 3.对数据卷的更新不会影响到镜像，解耦了应用和数据、
 4.卷会一直存在，直到没有容器使用，可以安全的卸载
 5.容器停止或删除，数据卷仍存在，新的映射会将该数据卷映射至新的容器内（<font color="red">升级迁移完美</font>）
 
 ``` java
 docker run -it -v [宿主目录]:[容器目录] [镜像] [操作] 宿主目录不存在会创建
 docker run -it -v /test:/soft centos /bin/bash
 docker run -it -v /test2 centos /bin/bash
 如果不指定宿主目录，通过docker inspect 查看宿主的挂载目录，在其目录下查找test2目录
 ```
 
* 数据卷容器
如果需要在多个容器之间共享一些持续更新的数据，可以使用数据卷容器，<font color="red">它的目的是专门用来提供数据卷供其他容器挂载</font>
``` java
# 创建名为dbdata数据卷容器映射到本机/dbdata
docker run -it -v /dbdata --name dbdata ubuntu
# 在其他容器(新标签页)挂载dbdata容器中的数据卷
docker run -it --volumes-from dbdata(数据卷容器alias) --name db1 ubuntu
docker run -it --volumes-from dbdata(数据卷容器alias) --name db2 ubuntu
```
通过<code>docker inspect</code>查看子容器挂载了父容器的挂载路径

<font color="red">1.挂载其他容器数据卷的容器不需要保持在运行状态
2.删除挂载的容器，数据卷不会被自动删除
3.使用docker rm -v 删除数据卷和关联的容器</font>

* 使用数据卷容器来迁移数据

 ``` java
 备份dbdata数据卷容器内的数据卷（新建容器用于备份）：
docker run --volumes-from [数据卷容器] -v $(pwd):[容器目录] --name [镜像名] [镜像] tar cvf [新容器下文件夹] [备份源文件夹]
docker run --volumes-from dbdata -v $(pwd):/backup --name worker ubuntu tar cvf /backup/backup.tar /dbdata

 将数据恢复到一个容器：
docker run -v /dbdata --name dbdata2 ubuntu /bin/bash
docker run --volumes-from dbdata2 -v $(pwd):/backup busybox tar xvf /backup/backup.tar
```

## 端口映射和容器互联

* 映射容器内服务器端口到本地宿主主机

  使用<font color="red">-P(大写)</font>标记时，Docker会随机映射一个49000~49900端口到内部容器端口
  使用<font color="red">-p(小写)</font>可以指定要映射的端口，在一个指定的端口上只能绑定一个容器
  本地端口在前，容器端口在后
  * 从外部访问容器应用
  ```java
  docker run -d -P ubuntu:14.04
  docker run -d -p 5000:5000 -p 3000:80 ubuntu:14.04 指定多个端口
  ```
  
  * 映射指定地址的指定端口(ip:Host : ContainerPort)
  ``` java
  docker run -d -p 127.0.0.1:5000 : 5000 ubuntu:14.04
  ```
  
  * 映射到指定地址的任意端口
  ``` java
  docker run -d -p 127.0.0.1::5000 ubuntu:14.04
  docker run -d -p 127.0.0.1::5000/udp ubuntu:14.04 指定udp端口
  ```
  
  * 查看容器端口映射本地端口配置
  ``` java
  docker port nostalgic_morse 5000 -> 127.0.0.1:49155
  ```
 也可以通过`` docker inspect + [ContainerID]``查询容器具体信息
 
* 互联机制实现多个容器间通过容器名实现快速访问（不用暴露端口号）

 ``` java
 --name：可以为容器自定义命名
 docker run -d --name ub ubuntu:14.04
 
 --rm：容器在终止后立刻删除，-rm和-d不能同时使用
 docker run --rm ubuntu:14.04
 
 --link name:alias name是要连接的容器名称，alias是这个连接的别名
 docker run -d --name db training/postgres
 # 新建web容器(子容器)连接到db容器(父容器)
 docker run -d -p --name web --link db:db training/webapp
 ```
 * 查看容器公开连接信息：
   * env命令
 ``` java
 docker run -rm --name web2 --link db:db training/webapp env
 ```
   * /etc/hosts文件
   ``` java
   docker run -it --rm --link db:db training/webapp /bin/bash
   > /opt/webapp
   > cat /ect/hosts
   172.17.0.7 aed84ee21bde  # web用id作为主机名
   ...
   172.17.0.5 db
   ```  
   用户可以连接多个子容器到父容器


## Dockerfile创建镜像

Dockerfile是一个文本格式的配置文件，可用于创建自定义镜像。
Dockerfile包含基础镜像信息，维护者信息，镜像操作指令和容器启动指令
指令说明：
* FROM

``` java
FROM<image>:<tag>
指定创建镜像的基础镜像，本地不存在就回去DockerHub下载,可以使用多个FROM，但是每个镜像只能有一个
```

* MAINTAINER

``` java
MAINTAINER<name>
该信息会写入生成镜像的Author属性域中
```

* RUN

``` java
RUN<command>或RUN<"executable","param1","param2">
前者是在shell终端中使用，后者使用的是exec，命令较长使用\换行
```

* CMD

指定启动容器时默认执行的命令，多个CMD命令只有最后一条会执行
``` java
CMD ["executable","param1","param2"] 推荐使用
/bin/bash 中执行 CMD command param1 param2
CMD ["param1","param2"]  与ENTRYPOINT配合使用 
```

* LABEL

LABEL指令用来指定生成镜像的元数据标签信息

``` java
LABEL <key>=<value>...
LABEL version="1.0"
```
* EXPOSE

声明镜像内服务所监听的端口，不会完成端口映射

``` java
EXPOSE 22 80 8443 ....
```

* ENV

指定环境变量，在镜像生成过程中会被后续的RUN指令使用，环境变量在运行时可以被覆盖

``` java
ENV<key><value>或ENV<key>=<value>
可以被
docker run -env <key>=<value> 覆盖
```

* ADD

将复制指定的<src>路径下的内容到容器中的<dest>路径下

``` java
ADD<src> <dest>
src可以是Dockerfile所在目录的相对路径，也可以时一个url还可以是个tar
dest是镜像内的绝对路径或者相对于工作目录的相对路径
还支持正则
ADD *.c /code/
```

* COPY

将复制指定的<src>路径下的内容到容器中的<dest>路径下，路径不存在会创建
支持正则，当使用本地目录为源目录时，推荐使用COPY

``` java
COPY<src> <dest>
```

* ENTRYPOINT

指定镜像的默认入口命令
该入口命令会在启动容器时作为根命令执行，所有传入指作为该命令的参数
每个Dockerfile只能有一个ENTRYPOINT，指定多个只有最后一个有用
``` java
ENTRYPOINT ["executable","param1","param2"]
ENTRYPOINT command param1 param2 与CMD ["param1","param2"]配合使用
会被覆盖：
docker run -entrypoint
```

* VOLUME

创建一个数据卷挂载点，可以从本地主机或者其他容器挂载数据卷，一般存放数据库和需要保存的数据
``` java
VOLUME ["/data"]
```

* USER

指定运行时容器的用户名或UID，后续的run指令也会使用指定的用户身份
``` java
RUN groupadd -r postgres && useradd -r -g postgres postgres
```

* WORKDIR

为后续的RUN,CMD,ENTRYPOINT指令配置工作目录
如果使用多个WORKDIR指令，后续的参数如果是相对路径，则会依次叠加构成一个新的路径

``` java
WORKDIR /path/to/workdir
WORKDIR /a
WORKDIR b
WORKDIR c
最终构成 /a/b/c
```

* ARG

指定镜像内的参数，这些参数只有在docker build时才会传入

``` java
docker build --build-arg<name>=<value>
```

* ONBUILD

配置当所创建的镜像作为其他的镜像基础时，所执行的创建操作命令
``` java
创建镜像image-A：
ONBUILD ADD . /app/src
ONBUILD RUN /usr/local/bin/python-build --dir /app/src

当新的Dockerfile基于image-A创建新镜像
From image-A 等同于上面ONBUILD两行

```


* STOPSIGNAL

指定所创建的镜像的容器接受推出的信号值

``` java
STOPSIGNAL singal
```
* HEALTHCHECK

配置所启动的容器如何进行健康检查（Docker 1.12之后）

``` java
1. HEALTHCHECK [OPTION] CMD command: 根据执行命令的返回值是否是0来判断
2. HEALTHCHECK NONE: 静止基础镜像中的健康检查
OPTION:
--interval=DURATION（默认30s）：过多久检查一次
--timeout=DURATION（默认30s）：每次检查等待结果的超时时间
--retries=N（默认为3）：如果失败了，重试几次最终确认失败

```

* SHELL

指定其他命令使用shell的默认shell类型

``` java
默认是["/bin/sh","-C"]
```
* 创建镜像

``` java
docker build -t build_repo/first_image（标签名） /tmp/docker_builder（Dockerfile存在目录）
```

