---
title: Elasticsearch环境搭建
date: 2018-05-01 17:06:20
tags: ElasticSearch
toc: true
categories:
  - ElasticSearch
thumbnail: http://image.leejay.top/image/20200107/L6NvPojugsKV.jpg
---

## elasticsearch 环境搭建问题

### 需要先安装 jdk8
#### wget 命令下载 jdk8
  ```java
  wget --no-cookies --no-check-certificate --header "Cookie: gpw_e24=http%3A%2F%2Fwww.oracle.com%2F; oraclelicense=accept-securebackup-cookie" "http://download.oracle.com/otn-pub/java/jdk/8u141-b15/336fa29ff2bb4ef291e347e091f7f4a7/jdk-8u141-linux-x64.tar.gz"
  ```
#### 解压 tar.gz
  ```java
  tar -zxvf jdk-8u141-linux-x64.tar.gz
  ```
  <!-- more -->
#### 修改配置
  ```java
  vi /etc/profile
  输入如下内容：
  export JAVA_HOME=/usr/local/java/jdk
  export JRE_HOME=${JAVA_HOME}/jre
  export CLASSPATH=.:${JAVA_HOME}/lib:${JRE_HOME}/lib
  export PATH=${JAVA_HOME}/bin:$PATH
  最后：
  source /etc/profile
  java -version检测
  ```
#### 安装 elasticsearch

```bash
# 下载tar包
$ wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-6.0.0.tar.gz
# 修改配置
$ vim /path/to/elasticsearch/config/elasticsearch.yml

networhttp.port: 9200
http.host: 127.0.0.1
http.cors.enabled: true
http.cors.allow-origin: "*"
http.host: 0.0.0.0

# 添加用户
$ useradd elastic
$ passwd elastic
$ su elastic
$ ./bin/elasticsearch

```

- es5.0 之前允许使用 root 启动，加配置即可，5.0 以后必须使用非 root 用户启动
  详见：https://blog.csdn.net/lahand/article/details/78954112
- es 后台启动命令： nohup ./bin/elasticsearch&
  文档参考：https://www.cnblogs.com/sloveling/p/elasticsearch.html

## elasticsearch 插件搭建

- elasticsearch-head 插件：
  其实不用自己搭建，google 商店里面有这个插件，下载就好了，很方便
- kibana 插件，拥有 dashboard，图形化汇总等功能，更强大

1. 下载 kibana： https://www.elastic.co/guide/en/kibana/5.6/targz.html
   2.tar -zxvf kibana....tar.gz，需要注意的是要和 elasticsearch 版本对应
2. ./bin/kibana 启动 4.访问地址：http://127.0.0.1:5601
