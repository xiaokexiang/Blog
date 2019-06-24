---
title: Docker实战
date: 2019-03-10 15:33:29
tags: Docker
toc: true
categories:
- Docker
thumbnail: http://ww1.sinaimg.cn/mw690/70ef936dly1g49zzckepqj20gl08t0t2.jpg 
---
## 操作系统

* busybox
是一个集成100多个最常用Linux命令和工具的精简工具箱
offical表示这个官方推荐包，automated表示这是自动创建镜像

``` Shell
docker search -s(系统推荐--filter=stars=3) 3 busybox
```

``` java
docker pull busybox
```

* centos

``` java
docker search -filter=stars=5 centos
docker run -it centos bash
> cat /etc/redhat-release
```

<!-- more -->
## 为镜像添加SSH服务

为了安全考虑，几乎所有的官方镜像都没有安装SSH服务
进入容器内部可以使用<code><a>docker attach/docker exec</a></code>，但是远程登陆到容器内部时就还是需要SSH的支持。

* 基于commit命令创建

``` JAVA
docker run -it ubuntu:14.04 /bin/bash
> apt-get update
> apt-get install openssh-server -y (安装openssh服务)
> mkdir -p /var/run/sshd (如果需要正常启动ssh，目录/var/run/sshd必须存在)
> /usr/sbin/sshd -D & (启动ssh服务)
> netstat -tunlp (查看22端口是否被监听)
> sed -ri 's/session   required  pam_loginuid.so/#session  required  pam_loginuid.so/g' /etc/pam.d/sshd (修改SSH服务的安全登录配置，取消pam登陆限制)
> mkdir root/.ssh (创建.ssh目录，并复制需要登陆的公钥信息，通过ssh-keygen -t rsa生成)
> ssh-keygen -t rsa
> cat !/.ssh/id_rsa.pub > /root/.ssh/authorized_keys
（密钥放置该文件）
> vi /run.sh (创建自启动的ssh可执行文件run.sh并添加权限)
#!/bin/bash
/usr/sbin/sshd -D
> chmod +x run.sh (赋予权限)
> exit (退出容器)
> docker commit [Container ID] sshd:ubuntu (将刚才的容器保存为一个新的sshd:ubuntu镜像)
> docker run -p 10022:22 -d sshd:ubuntu /run.sh
> ssh 172.20.10.11 -p 10022 (ssh登录)
```

* 使用Dockerfile创建

``` JAVA
> mkdir /sshd_ubuntu
> cd /sshd_ubuntu
> touch Dockerfile run.sh
> vi run.sh
#!/bin/bash
/usr/sbin/sshd -D
> ssh-keygen -t rsa
...
> cat ~/.ssh/id_rsa.pub > authorized_keys
> vi Dockerfile

	#设置继承镜像
	FROM ubuntu:14.04

	#设置一些作者信息
	MAINTAINER lucky(18261773119@163.com)

	#下面开始运行更新命令
	RUN apt-get update

	#安装ssh服务
	RUN apt-get install -y openssh-server
	RUN mkdir -p /var/run/sshd
	RUN mkdir -p /root/.ssh

	#取消pam限制
	RUN sed -ri ‘s/session   required   pam_loginuid.so/#session   required    pam_loginuid.so/g’ /etc/pam.d/sshd

	#复制配置文件到相应位置，并赋予脚本可执行曲线
	ADD authorized_keys /root/.ssh/authorized_keys
	ADD run.sh /run.sh
	RUN chmod 755 /run.sh

	#开放端口
	EXPOSE 22

	#设置自启动命令
	CMD ["/run.sh"]

> docker build -t sshd:dockerfile .
> Successfully built 8ef5b50996db
> Successfully tagged sshd:dockerfile
> ssh 172.20.10.11 -p 10022 进行测试
如果出现下图的错误信息:
vi /root/.ssh/known_hosts 清除相关host信息即可
```

## Web服务与应用

* Apache httpd

``` java
mkdir httpd_lucky && cd httpd_lucky && touch Dockerfile
mkdir public-html && cd public-html/

vi index.html
> <!DOCTYPE html>
  <html>
    <body>
	   <p>Hello Docker</P
	</body>
  </html>
  
vi ../Dockerfile
> From httpd:2.4
  COPY ./public-html /usr/local/apache2/htdocs

docker build -t httpd_lucky .
docker run -it httpd_lucky -p 80:80
虚拟机内部访问当前ip端口即可看到Hello Docker
```
* 基于ubuntu的Apache httpd

``` java
mkdir httpd_ubuntu && cd httpd_ubuntu && touch Dockerfile run.sh && mkdir sample
cd sample && vi index.html
> <!DOCTYPE html>
   <html>
    <body>
      <p>Hello! my name is docker </p>
    </body>
   </html>

cd .. && vi Dockerfile
> FROM sshd:dockerfile

  MAINTAINER lucky(18261773119@163.com)

  #设置环境变量，所有操作都是非交互式的
  ENV DEBIAN_FRONTEND noninteractive

  #安装
  RUN apt-get -yq install apache2 &&\
      rm -rf /var/lib/apt/lists/*

  #注意更改系统的时区设置
  RUN echo "Asia/Shanghai" > /etc/timezone &&\
      dpkg-reconfigure -f noninteractive tzdata

  #添加用户的脚本或设置权限
  ADD run.sh /run.sh
  RUN chmod 755 /*.sh

  #添加一个示例的web站点
  RUN mkdir -p /var/lock/apache2 &&mkdir -p /app && rm -rf /var/www/html && ln - s /app /var/www/html
  COPY sample/ /app

  #设置apache相关的变量，也可以容器启动时用-e参数代替
  ENV APACHE_RUN_UER www-data
  ENV APACHE_RUN_GROUP www-data
  ENV APACHE_LOG_DIR /var/log/apache2
  ENV APACHE_PID_FILE /var/run/apache2
  ENV APACHE_SERVERADMIN admin@localhost
  ENV APACHE_SERVERNAME localhost
  ENV APACHE_SERVERALIAS docker.localhost
  ENV APACHE_DOCUMENTROOT /var/www

  EXPOSE 80
  WORKDIR /app
  CMD ["/run.sh"]

vi run.sh (启动ssh并启动httpd)
> #!/bin/bash
  /usr/sbin/sshd && exec apache2 -D FOREGROUND

docker build -t apache:ubuntu .
docker run -it -P apache:ubuntu /bin/bash
```
如果容器出现<font color="red">IPv4 forwarding is disabled. Networking will not work.</font>的问题，解决办法如下：
``` java
vim  /usr/lib/sysctl.d/00-system.conf
net.ipv4.ip_forward=1
systemctl restart network
```


* Nginx

 * 常用方法
 
 ``` java
docker run -d -p 80:80 --name webserver nginx
docker ps -a
```

 * 自定义index页面

 ``` java
> vi index.html
  <!DOCTYPE html>
   <html>
    <body>
     <p>Hello Nginx</p>
    </body>
  </html>
## 让宿主机的index.html和nginx默认的index.html挂载
docker run -d -p 80:80 -v /nginx_lucky/index.html:/usr/share/nginx/html/index.html nginx
```
 * 使用Dockerfile构建
 
 ``` java
> cd nginx_lucky && vi Dockerfile
  FROM nginx
  COPY ./index.html /usr/share/nginx/html/index.html
docker build -t nginx:lucky .
docker run -d -p 80:80 nginx:lucky
```

* Tomcat
 * 常用方法
 
 ``` java
docker run -p 8080：8080 -d tomcat
```

 * 基于ubuntu搭建tomcat镜像
 
 ``` java
 ## 创建文件夹和Dockerfile
 mkdir tomcat_lucky && cd tomcat_lucky && touch Dockerfile run.sh
 
 ## 下载jdk1.8并解压
 wget --no-cookies --no-check-certificate --header "Cookie: gpw_e24=http%3A%2F%2Fwww.oracle.com%2F; oraclelicense=accept-securebackup-cookie" "http://download.oracle.com/otn-pub/java/jdk/8u141-b15/336fa29ff2bb4ef291e347e091f7f4a7/jdk-8u141-linux-x64.tar.gz"
 tar -zxvf jdk-8u141-linux-x64.tar.gz
 mv jdk1.8.0_141/ jdk8
 
 ## 下载tomcat文件
 wget http://mirror.bit.edu.cn/apache/tomcat/tomcat-8/v8.5.35/bin/apache-tomcat-8.3.35.tar.gz
 
 ## 编辑Dockerfile
 
 FROM ubuntu:14.04
 MAINTAINER lucky
 # 设置环境变量，所有操作都是非交互式的
 ENV DEBIAN_FRONTEND noninteractive
 # 设置tomcat的环境变量
 ENV CATALINA_HOME /tomcat
 ENV JAVA_HOME /jdk
 # 复制tomcat和jdk文件到镜像中
 ADD tomcat /tomcat
 ADD jdk8 /jdk
 # 复制启动脚本至镜像，并赋予脚本可执行权限
 ADD run.sh /run.sh
 RUN chmod +x /*.sh
 RUN chmod +x /tomcat/bin/*.sh
 EXPOSE 8080
 CMD ["/run.sh"]
 
 ## 编辑run.sh
 > #!/bin/bash
    # 启动tomcat
   exec ${CATALINA_HOME}/bin/catalina.sh run
 ## build & run
 docker build -t tomcat:lucky .
 docker run -d -p 8080:8080 tomcat:lucky
 ```
 
* Jetty
``` java
docker run -d -p 80:8080 -p 443:8443 jetty
```

* LAMP
 * linode/lamp
 
 ``` java
 docker run -it -p 80:80 linode/lamp /bin/bash
 > service apache2 start
 > service mysql start
 ```
 * tutum/lamp
 
 ``` java
 docker run -p 80:80 -p 3306:3306 tutum/lamp
 ```
* CMS(内容管理系统)

  * Wordpress
    * 使用官方镜像

    ``` java
  docker run -p 3306:3306 -d --name lucky-mysql mysql
  docker run --name lucky-wordpress --link lucky-mysql:mysql -p 8080:80 -d wordpress
  ```
  
   * 使用Compose搭建
   ``` java
   vi docker-compose.yml
   > wordpress:
         image: wordpress
		 links:
		     - db:mysql
		 ports:
		     - 8080:80
	 db:
	     image:mariadb
		 environment:
		    MYSQL_ROOTPASSWORD: example
   #执行
   docker-compose up
   如果提示command not found，执行pip install docker-compose
   ```
  * Ghost
  
  ``` java
  docker run -d -p 8080：2368 ghost
  ```
  
* jenkins
jenkins是一个得到广泛应用的持续集成（CI）和持续交付（CD）的工具
``` java
mkdir jenkins_lucky && cd jenkins_lucky
docker run -p 8080:8080 -p 50000:50000 -v /jenkins_lucky/data:/var/jenkins_home jenkins
```

* gitlab
gitlab是一款非常强大的开源代码管理系统
``` java
docker run --detach \
> --hostname gitlab.example.com \
> --publish 443:443 --publish 80:80 --publish 23:23 \
> --name gitlab \
> --restart always\
> --volume /srv/gitlab/config:/etc/gitlab \
> --volume /srv/gitlab/logs:/var/log/gitlab \
> --volume /srv/gitlab/data:/var/opt/gitlab \
> gitlab/gitlab-ce:latest
```

## 数据库应用

* MySQL
  
  ``` java
  docker run --name lucky-mysql -e MYSQL_ROOT_PASSWORD=123 -d mysql:latest
  docker exec -it lucky-mysql bash
  
  # mysql调用bash shell
  docker exec -it lucky-mysql bash
  
  # 查看mysql logs
  docker logs lucky-mysql
  
  # 配置文件挂载路径
  docker run --name lucky-mysql -v /mysql/custom:/etc/mysql/conf.d -e MYSQL_ROOT_PASSWORD=123 -d mysql:latest
  ```
* Redis
  ``` java
  ## 启动一个redis容器
  docker run --name lucky-redis -d redis
  
  ## 进入redis容器
  docker exec -it [container id] /bin/bash
  > uptime (查看容器运行时间)
  > free (查看内存状态)
  > env (查看环境变量的配置)
  > ps -ef (查看进程信息)
  
  # 连接redis容器
  docker run -it --link lucky-redis：db alpine sh
  > ls
  > ping db
  > nc db 6379 (检测redis服务可用性)
  
  ## 使用官方redis客户端
  docker run -it --link lucky-redis：db --entrypoint redis-cli redis -h db
  
  ## 自定义配置
  docker run -v $(pwd):/usr/local/etc/redis/redis.conf --name lucky-redis redis redis-server /usr/local/etc/redis/redis.conf
  ```

## 大数据相关

* elasticsearch

 ``` java
docker run -v $(pwd)/config:/usr/share/elasticsearch/config \  ##默认配置文件
-v $(pwd)/esdata:/usr/share/elasticsearch/data \   ## 数据持久化目录
-Des.node.name="TestNode" \
-d elasticsearch
```

#### Java

``` java
> mkdir java_lucky && cd java_lucky
> touch Dockerfile && vi Dockerfile
> FROM centos：latesst
  COPY  jdk.rpm  /opt
  RUN rpm -rpm -ivh /opt/jdk.rpm
  ENV JAVA_HOME=/opt/jdk
  ENV PATH=$JAVA_HOME/bin:$PATH
  ENV CLASSPATH=.:$JAVA_HOME/lib/dt.jar:$JAVA_HOME/lib/tools.jar

```