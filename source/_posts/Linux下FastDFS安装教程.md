---
title: Linux下FastDFS安装教程
date: 2019-04-22 17:06:35
tags: Fastdfs
toc: true
categories:
- Fastdfs
thumbnail: https://www.logicsupply.com/company/io-hub/wp-content/uploads/2009/01/Read-only-Linux.jpg
---
## 软件准备和环境安装
1. libfastcommon-master.zip
2. fastdfs-master.zip

``` shell
$ yum install make cmake gcc gcc-c++
```

## 安装libfastcommon

``` shell
上传或下载libfastcommon-master.zip到/usr/local/src目录

unzip libfastcommon-master.zip
cd libfastcommon-master
./make.sh
./make.sh install

建立软连接
ln -s /usr/lib64/libfastcommon.so /usr/local/lib/libfastcommon.so
ln -s /usr/lib64/libfastcommon.so /usr/lib/libfastcommon.so
ln -s /usr/lib64/libfdfsclient.so /usr/local/lib/libfdfsclient.so
ln -s /usr/lib64/libfdfsclient.so /usr/lib/libfdfsclient.so
```

## 安装fastdfs5.05

``` shell

tar -zxvf fastdfs-5.05.tar.gz
mv fastdfs-5.05.tar.gz fastdfs
cd fastdfs
./make.sh
./make.sh install
cd /usr/bin

如果出现: ./make.sh: line 184: perl: command not found 问题:
yum -y install perl
```

## 修改tracker配置文件

``` shell
cp client.conf.sample client.conf
cp storage.conf.sample storage.conf
cp tracker.conf.sample tracker.conf

vi /etc/fdfs/tracker.conf

修改配置如下:
disabled=false
port=22122
base_path=/fastdfs/tracker
mkdir -p /fastdfs/tracker

启动tracker:
/etc/init.d/fdfs_trackerd start

停止:
/etc/init.d/fdfs_trackerd stop

查看是否启动及监听22122端口号
ps -ef|grep fdfs
netstat -tunlp uid
```

## 修改storage配置文件

``` shell
vi /etc/fdfs/storage.conf

修改内容如下:
a. disabled=false
b. port=23000
c. base_path=/fastdfs/storage
d. store_path0=/fastdfs/storage
e. tracker_server=10.193.9.28:22122
f. http.server_port=8888

启动:
/etc/init.d/fdfs_storaged start
停止:
/etc/init.d/fdfs_storaged stop
```

## 文件上传测试

``` shell
vim client.conf

修改内容如下:
base_path=/fastdfs/tracker
tracker_server=10.193.9.28:22122

测试命令:
/usr/bin/fdfs_upload_file /etc/fdfs/client.conf /usr/local/src/fastdfs-5.05_\(1\).tar.gz

返回如下即为成功:
group1/M00/00/00/CsEJHFykYVWAFLU8AAUggYb6UHk.tar.gz
```

## 安装fastdfs-nginx-module插件

``` shell
tar -zxvf fastdfs-nginx-module_v1.16.tar.gz

cd fastdfs-nginx-module/src/

vim config

CORE_INCS="$CORE_INCS /usr/local/include/fastdfs /usr/local/include/fastcommon/"
修改为：
CORE_INCS="$CORE_INCS /usr/include/fastdfs /usr/include/fastcommon/"

```

## 安装nginx

``` shell
安装环境
yum install gcc gcc-c++ make automake autoconf libtool pcre* zlib openssl openssl-devel

tar -zxvf nginx-1.6.2.tar.gz
cd nginx-1.6.2
./configure --add-module=/usr/local/src/fastdfs-nginx-module/src
make
make install

复制fastdfs-nginx-module源码中的配置文件到/etc/fdfs目录，并修改:
cp /usr/local/src/fastdfs-nginx-module/src/mod_fastdfs.conf /etc/fdfs
vim /etc/fdfs/mod_fastdfs.conf

修改内容如下:
connect_timeout=10
base_path=/tmp
tracker_server=10.193.9.28:22122
storage_server_port=23000
group_name=group1
url_have_group_name=true
store_path0=/fastdfs/storage

复制FastDFS的部分配置文件到/etc/fdfs目录
cd /usr/local/src/fastdfs-master/conf/
cp http.conf mime.types /etc/fdfs

在/fastdfs/storage文件存储目录下创建软连接,将其链接到实际存放数据的目录
ln -s /fastdfs/storage/data/ /fastdfs/storage/data/M00
```

## nginx 配置
``` bash
vim /usr/local/nginx/conf/nginx.conf
```
``` shell
user  root;
worker_processes  1;

#error_log  logs/error.log;
#error_log  logs/error.log  notice;
#error_log  logs/error.log  info;

#pid        logs/nginx.pid;


events {
    worker_connections  1024;
}


http {
    include       mime.types;
    default_type  application/octet-stream;

    #log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
    #                  '$status $body_bytes_sent "$http_referer" '
    #                  '"$http_user_agent" "$http_x_forwarded_for"';

    #access_log  logs/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    #keepalive_timeout  0;
    keepalive_timeout  65;

    #gzip  on;

    server {
        listen       8888;
        server_name  localhost;

        #charset koi8-r;

        #access_log  logs/host.access.log  main;

        location ~/group([0-9])/M00 {
            root /fastdfs/storage/data;
            ngx_fastdfs_module;
        }

        #error_page  404              /404.html;

        # redirect server error pages to the static page /50x.html
        #
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }
    }
}

tips:
1.这里如果监听其他端口,也需要同步修改 /etc/fdfs/storage.conf 中的http.server_port参数
2.nginx启动: /usr/local/nginx/sbin/nginx

```