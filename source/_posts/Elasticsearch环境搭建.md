---
title: Elasticsearch环境搭建
date: 2018-05-01 17:06:20
tags: ElasticSearch
categories:
- ElasticSearch
---
## elasticsearch环境搭建问题
* 需要先安装jdk8
  * wget命令下载jdk8
  ``` java
  wget --no-cookies --no-check-certificate --header "Cookie: gpw_e24=http%3A%2F%2Fwww.oracle.com%2F; oraclelicense=accept-securebackup-cookie" "http://download.oracle.com/otn-pub/java/jdk/8u141-b15/336fa29ff2bb4ef291e347e091f7f4a7/jdk-8u141-linux-x64.tar.gz"
  ```
  * 解压tar.gz
  ``` java
  tar -zxvf jdk-8u141-linux-x64.tar.gz 
  ```
  * 修改配置
  ``` java
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
* es5.0之前允许使用root启动，加配置即可，5.0以后必须使用非root用户启动
详见：https://blog.csdn.net/lahand/article/details/78954112
* es后台启动命令： nohup ./bin/elasticsearch&
文档参考：https://www.cnblogs.com/sloveling/p/elasticsearch.html

## elasticsearch插件搭建
* elasticsearch-head插件：
其实不用自己搭建，google商店里面有这个插件，下载就好了，很方便
* kibana插件，拥有dashboard，图形化汇总等功能，更强大
1. 下载kibana： https://www.elastic.co/guide/en/kibana/5.6/targz.html
2.tar -zxvf kibana....tar.gz，需要注意的是要和elasticsearch版本对应
3. ./bin/kibana 启动
4.访问地址：http://127.0.0.1:5601