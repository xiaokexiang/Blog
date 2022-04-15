---
title: "Docker命令汇总"
date: 2021-04-16T11:02:51+08:00
tags: ["Docker", "Linux", "Mysql", "Nginx"]
categories: [
  "Docker",
  "Linux"
]
---

## Docker cp

```shell
# 将容器内的conf.d文件夹下的所有文件复制到宿主机上/opt/nginx/conf.d文件夹下
docker cp nginx:/etc/nginx/conf.d/. /opt/nginx/conf.d

# 将容器内的conf.d文件夹（包含文件夹内的文件）复制到宿主及上/opt/nginx目录下
docker cp nginx:/etc/nginx/conf.d  /opt/nginx/
```
<!--more-->

## Docker mysql

### 不挂载启动

```shell
# 不使用挂载创建mysql
docker run -itd -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123456 --name mysql5.7 mysql:5.7
```

### 挂载宿主机目录启动

```shell
# 创建宿主机目录
mkdir -p /opt/mysql/{logs,conf.d,data}

# 拷贝默认配置文件到宿主机（借助上文的不挂在启动的mysql容器）
docker cp mysql:/etc/mysql/conf.d/. /opt/mysql/conf.d
docker cp mysql:/var/log/mysql/. /opt/mysql/logs

# 可以不拷贝自己创建配置文件
touch /opt/mysql/conf.d/my.cnf

# 执行挂载命令并启动
docker run -p 3306:3306 --name mysql \
-v /opt/mysql/conf.d:/etc/mysql/conf.d \
-v /opt/mysql/logs:/var/log/mysql \
-v /opt/mysql/data:/var/lib/mysql \
-e MYSQL_ROOT_PASSWORD=123456 \
-d mysql:5.7
```

> `mysql5.7或8.0版本`都可以使用该命令。

### Mysql相关命令

```shell
# 进入mysql控制台 root/123456，指定端口3316和host 127.0.0.1
mysql -uroot -P 3316 -h 127.0.0.1 -p123456

# 创建远程用户 test/abcdefg
CREATE USER 'test'@'%' IDENTIFIED WITH mysql_native_password BY 'abcdefg';
GRANT ALL PRIVILEGES ON *.* TO 'test'@'%';

# 查看数据库，表，使用数据库
show databases;
use mysql;
show tables;

# 控制台内执行本地的sql文件
source /root/select.sq

# 控制台外备份数据库
mysqldump -u root -P 3316 -p dbname > /root/backup.sql
```

## Docker nginx

### 不挂载启动

```shell
docker run -itd --name nginx -p 80:80 -p 443:443 nginx
```

### 挂载宿主机目录启动

```shell
# 创建宿主机目录
mkdir -p /opt/nginx/{logs,conf.d,html}

# 拷贝默认配置文件到宿主机（借助上文的不挂在启动的nginx容器）
docker cp nginx:/etc/nginx/conf.d/. /opt/nginx/conf.d
docker cp nginx:/usr/share/nginx/html/. /opt/nginx/html

#  执行挂载命令并启动
docker run -it --name nginx \
-v /opt/nginx/html:/usr/share/nginx/html \
-v /opt/nginx/logs:/var/log/nginx \
-v /opt/nginx/conf.d:/etc/nginx/conf.d \
-p 80:80 -p 443:443 \
-d nginx
```

> nginx的配置文件可以通过`nginx -t`来进行校验。



## Dockerfile的指令对比

### ADD & COPY

`两者都可以将宿主机的文件到容器内，ADD具备自动解压的功能，而COPY只是复制功能。`

```dockerfile
FROM busybox
ADD hello.tar /
COPY hello.tar /
```

> - 使用ADD命令，镜像build后，在/目录下就会存在解压后的文件（`不会存在压缩包！`）
> - 使用COPY命令，镜像build后，在/目录下会存在压缩包。

### CMD & ENTRYPOINT

`两者都用于指定容器启动程序及参数，当存在ENTRYPOINT时，CMD的内容会作为参数传递给ENTRYPOINT。`需要注意的是：我们执行`docker run busybox echo hello`指令中的`echo hello`就是CMD命令（默认覆盖Dockerfile中的CMD命令），只是它没有写在了Dockerfile中，而是显示的传入。

```dockerfile
FROM busybox
CMD ["ls", "-l"]
# ENTRYPOINT ["ls", "-l"]
```

> - 镜像build后，若执行docker run image -h,那么会提示错误信息。而将CMD换成ENTRYPOINT则不会。

### ENV & ARG

`两者都用于设置环境变量，区别在于ENV无论是镜像构建时还是容器运行时，都可以使用。ARG只是用于构建镜像时使用，容器运行时不会出现。`

```dockerfile
FROM busybox
ENV NAME="helloworld"
WORKDIR /
RUN touch $NAME # 构建镜像时使用变量
CMD ["sh", "-c", "echo $NAME && ls"]
```

> - 如果此处不使用`sh -c`执行命令，那么并不会正确显示ENV变量。