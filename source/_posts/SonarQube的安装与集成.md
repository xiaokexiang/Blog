---
title: SonarQube的安装与集成
date: 2018-07-02 10:08:22
tags: SonarQube
categories:
- SonarQube
---

## 需要安装的软件:
* <a href="http://www.sonarqube.org/downloads/" target="_blank">sonarqube(6.7.3)</a><br>
* <a href="https://sonarsource.bintray.com/Distribution/sonar-scanner-cli/sonar-scanner-2.5.zip" target="_blank">sonar-runner(2.5)</a><br>
* Mysql(5.6及以上)
* JDK(1.8用于集成idea)

## 启动及配置:

* 单独启动SonarQube路径: sonarqube-6.7.3\bin\windows-x86-64\StartSonar.bat 
    TIP:我出现过远程连接强行被关闭的问题,后版本改为6.7.3解决
* 访问地址:http://localhost:9000
* 创建数据库:sonar(每次检查的结果都会自动存入数据库)
* 配置SonarQube\conf\sonar.properties文件
    ``` bash
    sonar.jdbc.url= jdbc:mysql://localhost:3306/sonar
    sonar.jdbc.username=用户名
    sonar.jdbc.password=密码
    sonar.sorceEncoding=UTF-8
    sonar.login=admin
    sonar.password=admin
    ```
* 重启服务再次访问9000端口(如果出现被占用的情况,右键任务栏-文件管理器-清除所有JavaSE的进程,一般是三个)
* 安装中文插件:配置--&gt;应用市场--&gt;搜索chinese pack --&gt;install 重启生效
    TIP:建议安装 SonarJS SonarJava SonarTS

## idea集成SonarQube:
* setting --&gt; plugins:安装插件SonarLint 重启生效
* setting --&gt; SonarLint General Settings
* 创建令牌
* update binding（出现TypeScript版本过低问题，应用市场升级SonarTs升级即可）
* 运行SonarQube进行codeView&nbsp;
    * 单个文件检查:点击文件,代码界面右键Analyze With SonarLint
    * 多个文件检查:SonarLint tool --&gt; Report --&gt;文件夹图标
* maven命令启动，检查结果会显示在服务器中
* maven-setting.xml添加:
    ``` java
   <profile>
      <id>sonar</id>
      <activation>
        <activeByDefault>true</activeByDefault>
      </activation>
      <properties>
        <sonar.jdbc.url>jdbc:mysql://localhost:3306/sonar</sonar.jdbc.url>
        <sonar.jdbc.driver>com.mysql.jdbc.Driver</sonar.jdbc.driver>
        <sonar.jdbc.username>root</sonar.jdbc.username>
        <sonar.jdbc.password>832231</sonar.jdbc.password>
        <sonar.host.url>http://localhost:9000</sonar.host.url>
      </properties>
    </profile>
    pom.xml添加:
    <build>
        <plugins>
            <plugin>
                    <groupId>org.sonarsource.scanner.maven</groupId>
                    <artifactId>sonar-maven-plugin</artifactId>
                    <version>3.2</version>
            </plugin>
        </plugins>
    </build>
    ```
* 运行命令:先clean install 后 sonar:sonar 服务端会显示相关代码问题

## linux下安装:
* 建议使用sonarQube 6.5版本，因为sonarQube自带es, 版本大于6.5的不支持root启动es,大于6.5可以通过创建其他用户启动es来解决这个问题
* 其次启动linux-x86-x64下面的sonar.sh,启动命令为./sonar.sh start(stop,console,restart)
* 如果发现提示sonarqube已启动,但是访问没有效果,查看sonar/logs下面的日志, 主要是es.log sonar.log和web.log,其中必有出错原因
* 如果出现更新中心不能访问的问题,建议自己下载中文插件包(需要对应版本号,否则无法启动),我的是6.5对应1.17版本
* 将sonarqube设备开机自启,因为不是服务,所以选择加入启动命令, vim/etc/rc.local 添加 /usr/java/sonar/bin/linux-x86-64/sonar.sh start`