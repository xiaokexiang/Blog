---
title: 基于CAS协议的SSO入门
date: 2019-01-25 15:15:37
tags: Java
toc: true
categories:
- Sso
thumbnail: http://ww1.sinaimg.cn/mw690/70ef936dly1g49zwmgutoj20q90dvdjd.jpg
---
## CAS简介

* SSO单点登录
单点登录（ Single Sign-On , 简称 SSO ）是目前比较流行的服务于企业业务整合的解决方案之一， SSO 使得在多个应用系统中，用户只需要 登录一次 就可以访问所有相互信任的应用系统。

* CAS从结构上包含两部分：CAS Server&CAS Client

* CAS Server 负责完成对用户的认证工作 , 需要独立部署 , CAS Server 会处理用户名 / 密码等凭证(Credentials) 。

* 负责处理对客户端受保护资源的访问请求，需要对请求方进行身份认证时，重定向到 CAS Server 进行认证。（原则上，客户端应用不再接受任何的用户名密码等 Credentials ）。

<!-- more -->
## 证书的创建（基于jdk keytool实现）

* 需要注意的是CAS默认是https进行访问的，所以需要配置证书

``` java
keytool -genkey -alias lucky(自定义别名) -keyalg RSA -keystore d:/software(存储位置)/jdkkey(存储名称)
```

* 导出证书

``` java
keytool -export -file d:/software/leejaykey.cert(证书导出位置) -alias lucky(之前设置的别名) -keystore d:/software/jdkkey(原来配置的key地址)
```

* 修改hosts(C:\Windows\System32\drivers\etc\hosts)

``127.0.0.1 sso.leejay.top ``
* 导入证书到JVM

``` java
keytool -import -keystore D:\software\jdk\jre\lib\security\cacerts(jdk地址) -file D:/software/leejaykey.cert(证书存放位置) -alias lucky(别名)
```

* 修改Tomcat配置(vi conf/server.xml)

  * Tomcat 8.0之前
  
  ``` java
	<Connector port="8443" 
				protocol="org.apache.coyote.http11.Http11NioProtocol"
                maxThreads="150"
			    SSLEnabled="true"
				scheme="https"
				secure="true"
				clientauth="false"
				sslprotocol="TLS"
				# 将jdkkey拷贝至tomcat/conf下
				keystorefile="conf/jdkkey"
				# 如果报错密码错误，尝试changeit
				keystorepass="832231">
        <SSLHostConfig>
            <Certificate certificateKeystoreFile="conf/localhost-rsa.jks"
                         type="RSA" />
        </SSLHostConfig>
    </Connector>
```
  * Tomcat 8.0之后
  
  ``` java
  	<Connector port="8443"
				protocol="org.apache.coyote.http11.Http11NioProtocol"
				maxThreads="150" 
				SSLEnabled="true">
　　  <SSLHostConfig>
         <Certificate
	       # 指定keystore地址
	       certificateKeystoreFile="D:/software/leejaykey.keystore"
           # 如果报错密码错误，尝试changeit
　　　　　　certificateKeystorePassword="832231"
　　　　　　type="RSA" />
　　   </SSLHostConfig>
	</Connector>
	```

* 启动tomcat访问验证，启动日志不报错，访问https://sso.leejay.top:8443/ 提示证书不安全但是能访问即为成功！(如果报错密码错误，尝试changeit)

## CAS Server搭建与登录

* 首先下载<a href="https://github.com/apereo/cas-overlay-template"> cas5.3版本</a>，相对之前的4.x版本，xml文件换成了properties文件的形式，推荐5.x版本。

* 解压文件后，进入cmd命令行，运行 build.cmd run

* 解压文件，将modules文件夹下的cas-server-webapp-4.0.0.war放置在tomcat/webapp目录下。

* 启动tomcat，浏览器输入https://sso.leejay.top:8443/cas/login 访问 CAS Server,如果没有https，访问http://sso.leejay.top:8080/cas/login

* 输入账号与密码，默认账号：casuser，密码：Mellon;系统显示登录成功：

## CAS Server服务配置

* 打开pom.xml,加入如下配置

``` java
    <!--数据库认证相关 start-->
    <dependency>
        <groupId>org.apereo.cas</groupId>
        <artifactId>cas-server-support-jdbc</artifactId>
        <version>${cas.version}</version>
    </dependency>
    <dependency>
        <groupId>org.apereo.cas</groupId>
        <artifactId>cas-server-support-jdbc-drivers</artifactId>
        <version>${cas.version}</version>
    </dependency>
    <dependency>
        <groupId>mysql</groupId>
        <artifactId>mysql-connector-java</artifactId>
        <version>${mysql.driver.version}</version>
    </dependency>
    <!--数据库认证相关 end-->

```
* 在properties中添加配置：

`` <mysql.driver.version>5.1.46</mysql.driver.version>``

* 重新打包 mvn install

* 数据库新建sso库，cas-server表，添加username和password字段，新增两条数据

* 编辑配置文件

``` java
vi /usr/local/apache-tomcat-8.5.31/webapps/cas/WEB-INF/classes/application.properties
## 最后一行注释并添加如下配置
cas.authn.jdbc.query[0].url=jdbc:mysql://hostname:3306/sso?useUnicode=true&characterEncoding=UTF-8&autoReconnect=true&useSSL=false 
//此处填mysql数据库用户名
cas.authn.jdbc.query[0].user=root
//此处填mysql数据库密码
cas.authn.jdbc.query[0].password=数据库密码
//表名和用户名标签
cas.authn.jdbc.query[0].sql=select * from cas where username=?
 //密码标签
cas.authn.jdbc.query[0].fieldPassword=password
cas.authn.jdbc.query[0].driverClass=com.mysql.jdbc.Driver

```
* 重启cas项目，并重新访问，能用新增用户访问即为成功。
