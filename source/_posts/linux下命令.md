---
title: linux命令合集
date: 2018-11-22 13:25:10
tags: Linux
toc: true
categories:
- Linux
thumbnail: https://www.logicsupply.com/company/io-hub/wp-content/uploads/2009/01/Read-only-Linux.jpg
---

## 查找文件名
将当前目录下（包括子目录）的文件名中含有LV的文件过滤出来
``` bash
$ find | grep LV
```

## 查找文件内容
将当前目录下（包括子目录）的文件内容中含有LV的行过滤出来
``` bash
find | xargs grep LV
```

## 查看端口号及解决占用问题
``` bash
$ netstat -tunlp | grep 端口号
$ 使用lsof，如果没有yum install lsof，然后lsof -i：端口号
$ 使用kill -9 PID清理进程
```

## docker 安装ftp
``` bash
$ docker run -it --name vsftpd \
-p 20:20 -p 21:21 -p 21100-21110:21100-21110 \
-v /opt/ftp:/home/vsftpd \
-e FTP_USER=ftpuser -e FTP_PASS=ftpuser \
-d fauria/vsftpd
```

## docker 安装mysql
``` bash
docker run -it -p 3306:3306 --name mysql \
-v /opt/mysql/conf:/etc/mysql/conf.d \
-v /opt/mysql/logs:/logs \
-v /opt/mysql/data:/var/lib/mysql \
-e MYSQL_ROOT_PASSWORD=******* \
-d mysql
```