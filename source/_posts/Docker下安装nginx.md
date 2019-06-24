---
title: Docker下安装nginx
date: 2019-05-05 15:08:57
tags: Docker
toc: true
categories:
  - Docker
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccjm6pp3j30gl08tjrz.jpg


---

# docker 环境下安装 nginx

```bash
# 拉取最新版的nginx
$ docker pull nginx
# 创建文件夹用于nginx目录挂载
$ mkdir -p /opt/nginx/{log,html,conf,conf.d}
# 先运行nginx
$ docker run -it --name nginx -d nginx
# 查看当前运行容器
$ docker ps -a
# 移动index.html到宿主机
$ docker cp {容器号}:/usr/share/nginx/html/index.html /opt/nginx/html/index.html
# 移动nginx.conf到宿主机
$ docker cp {容器号}:/etc/nginx/nginx.conf /opt/nginx/conf/nginx.conf
# 移动default.conf到宿主机
$ docker cp {容器号}:/etc/nginx/conf.d/default.conf /opt/nginx/conf.d/default.conf
# 查看当前运行容器并停止nginx容器
$ docker ps -a
$ docker stop {容器号}
$ docker rm {容器号}
# 启动nginx
$ docker run -it -p 80:80 --name nginx \
$ -v /opt/nginx/html:/usr/share/nginx/html \
$ -v /opt/nginx/log:/var/log/nginx \
$ -v /opt/nginx/conf:/etc/nginx/conf \
$ -v /opt/nginx/conf.d:/etc/nginx/conf.d \
$ -d nginx

<!-- more -->
# nginx实现https
$ docker run -it -p 443:443 --name nginx \
$ -v /opt/nginx/html:/usr/share/nginx/html \
$ -v /opt/nginx/log:/var/log/nginx \
$ -v /opt/nginx/conf:/etc/nginx/conf \
$ -v /opt/nginx/conf.d:/etc/nginx/conf.d \
$ -v /opt/nginx/cert:/etc/nginx/cert \
$ -d nginx

# 放行端口号
$ firewall-cmd --zone=public --add-port=443/tcp --permanent
$ firewall-cmd --reload
$ systemctl restart firewalld.service
```
