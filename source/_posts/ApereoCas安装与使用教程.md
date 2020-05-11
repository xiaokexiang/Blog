---
title: Apereo Cas安装与使用教程
date: 2020-02-21 18:45:16
tags: Java
categories:
  - Cas
thumbnail: https://image.leejay.top/image/20200511/dqGtqbaifKt8.jpg?imageslim
---

## 前言
`正值疫情期间，一直在家办公，年前年后一直在忙基于Apereo Cas的单点登陆相关的需求，目前已经完成了大半的工作，特此记录下Apereo Cas的安装与使用教程。`

---

## 概念
### SSO
  Q: 在学习Cas之前需要了解什么是单点登陆? 
  A: `SS0: Single Sign-On，是目前比较流行的服务于企业业务整合的解决方案之一。SSO 使得在多个应用系统中，用户只需要登录一次就可以访问所有相互信任的应用系统。`
<!--more-->
### CAS
  CAS从结构上包含两部分：CAS Server 和 CAS Client
  `Server端负责完成对用户的认证工作、处理用户名和密码等凭证，需要独立部署。`
  `Client端负责处理对客户端受保护资源的访问请求，需要对请求方进行身份认证时，重定向到Server端进行认证(原则上，客户端应用不再接受任何的用户名密码等)。`

---

## 安装
因为我是Client端提供者，Server端由客户提供，所以搭建Server端的时候只保留主要功能。至于JDK加密和配置数据库之类的文章，网上一搜一大把，在此不做记录。

### CAS Server端部署

#### 下载cas-overlay-template

``` bash
# 客户方是5.3分支
git clone -b 5.3 https://github.com/apereo/cas-overlay-template
```

#### 解压与打包

解压cas-overlay-template文件夹(下称作根目录/)，并进入打开cmd窗口，执行`mvn clean package命令(需要提前配置好全局maven命令，并且设置好阿里云仓库代理)。建议将根目录下的pom.xml文件中的<repository>相关的注释即可。`

#### 新建目录
- 新建src/main/java & src/main/resources文件夹。
- 复制cas-overlay-template/target/cas/WEB-INF/classes目录下的`services`文件夹和`application.properties`文件到src/main/resources文件夹中。

#### 文件修改

- 修改src/main/resources/services/HTTPSandIMAPS-10000001.json文件

``` bash
"serviceId" : "^(https|imaps)://.*"
变成
"serviceId" : "^(https|imaps|http)://.*"
```

- 修改src/main/resources/application.properties文件

``` bash
# 注释
server.ssl.key-store=file:/etc/cas/thekeystore
server.ssl.key-store-password=changeit
server.ssl.key-password=changeit

# 添加
cas.tgc.secure=false
cas.serviceRegistry.initFromJson=true
# 用于登出后重定向到指定地址
cas.logout.followServiceRedirects=true

# 修改
# 登陆的用户名密码
cas.authn.accept.users=admin123456::admin123456
```

#### 执行命令

``` bash
# 根目录下执行
build.cmd debug
```
### CAS Client端部署
`我用的是注解+SpringBoot的方式搭建Cas Client客户端。需要先引入jar包并添加相应注解。`

``` java
<dependency>
    <groupId>net.unicon.cas</groupId>
    <artifactId>cas-client-autoconfig-support</artifactId>
    <version>2.3.0-GA</version>
</dependency>
```

在启动类上添加注解
``` java
@EnableCasClient
```
@EnableCasClient是Cas Client的入口，核心在于`@Import(CasClientConfigurations.class)`，在CasClientConfigurations中注册Filter用于执行校验，登陆等逻辑操作。

``` java
@Configuration
@EnableConfigurationProperties(CasClientConfigurationProperties.class)
public class CasClientConfigurations {
    @Bean
    public FilterRegistrationBean casAuthenticationFilter() {
        final FilterRegistrationBean authnFilter = new FilterRegistrationBean();
        final Filter targetCasAuthnFilter =
                (this.configProps.getValidationType() == CAS || configProps.getValidationType() == CAS3) ? new AuthenticationFilter()
                        : new Saml11AuthenticationFilter();

        initFilter(authnFilter,
                targetCasAuthnFilter,
                2,
                constructInitParams("casServerLoginUrl", this.configProps.getServerLoginUrl(), this.configProps.getClientHostUrl()),
                this.configProps.getAuthenticationUrlPatterns());

        if (this.configProps.getGateway() != null) {
            authnFilter.getInitParameters().put("gateway", String.valueOf(this.configProps.getGateway()));
        }

        if (this.casClientConfigurer != null) {
            this.casClientConfigurer.configureAuthenticationFilter(authnFilter);
        }
        return authnFilter;
    }
}
```
> 上述代码是CasClientConfigurations代码中的一部分，是用于校验用户请求是否携带session，不携带则重定向到Cas Server进行验证。

---

## 分析

### 登陆
`其实官网的一张图就解释的非常清楚了，很形象。在此贴出该图: `

<img src="https://image.leejay.top/image/20200221/KyGhVgyNo5nG.png"/>

### 超时分析
`目前存在三种控制超时时间的参数，分别是Client Session timeout，TGT timeout和ST timeout。`

- Client Session
控制Web浏览器访问Cas Client的关键参数，如果session未过期，不管TGT是否过期，此时Web都可以访问Cas Client的资源。默认session的timeout是60s

- TGT
当Cas登录成功后，Cas Server会生成一个TGT，后面所有的登录判断都基于TGT。当Cas Client访问Cas Server会首先判断cookie中是否存在TGT且有效，TGT的timeout默认2h，也就是2小时内不会再要求登录，每一次携带TGT请求Cas Server都会刷新该时长(和session类似)，当总时长不能超过8h。

``` yaml
# TGT timeout默认2h，每请求一次自动刷新时长
cas.ticket.tgt.timeToKillInSeconds=7200
# TGT最多存在8h，超过必须重新登录
cas.ticket.tgt.maxTimeToLiveInSeconds=28800
```

- ST
Cas Server为子系统(也就是Cas Client)生成的ticket，当请求地址为`http://cas.server.com/cas/login?service=http://cas.clienta.com:8081/cas/client/index`时，Cas Server会判断TGT是否存在且有效，如果存在且有效，那么Cas Server会生成一个ST，携带ST并重定向请求Cas Client，用于Cas Client和Server通讯验证，如果验证通过，则会返回用户信息给Cas Client，通过session返回给Web端，ST是有存活时间的，默认10s并且只能验证一次。过期无效需要重新生成并重复验证流程。

``` yaml
# ST长度
cas.ticket.st.maxLength=20
# ST使用1次后过期
cas.ticket.st.numberOfUses=1
# ST票据30s过期
cas.ticket.st.timeToKillInSeconds=30
```

#### 不同情况超时登出流程图

<img src="https://image.leejay.top/image/20200220/sdQaLO2GIUqi.png">
> 推荐Cas Client的session timeout <= TGT timeout

### 登出

1. 登出首先需要清除Cas Client的session，这样在校验的时候因为不存在session，需要重定向校验。
2. 其次需要调用Cas Server logout接口，用于清除保存在Cas Server中Client 凭证，这样在Client请求时，Server不会重新生成TGT导致不会重新校验。