---
title: SpringCloud入门
date: 2019-03-20 22:38:08
tags: Java
toc: true
categories:
- SprintCloud
thumbnail: http://ww1.sinaimg.cn/thumbnail/70ef936dly1g4a06egs13j20i008jwep.jpg
---
## Eureka

* 实现微服务的注册与发现，本身是基于REST的服务，包含server和client两部分。

* 集成在Spring Cloud Netflix 中，除此之外还有zookeeper和Consul等发现组件。

* Eureka Server提供服务发现的能力，各个微服务启动时会向Eureka Server注册自己的信息（ip，端口，微服务名称等），Eureka Server会存储相关信息。

* Eureka Client 是一个基于java的客户端，用于简化和Eureka Server的交互

* Eureka Client通过默认30s的频率发送心跳给Eureka Server实现注册，如果在一段时间内（默认90s）没有收到心跳，Eureka Server会注销该Client实例。

* 默认情况下，Eureka Server也是Eureka Client，多个Eureka Server 实例互相之间通过复制的方法实现服务注册表中数据的同步。

* Eureka Client 会缓存服务注册表中的信息，即使server宕机了，也能通过缓存的信息找到服务的提供者并完成调用。

* Eureka Server jar依赖

	需要注意版本兼容问题，当前版本springboot2.0 + springcloud Finchley

``` java
<dependencyManagement>
	<dependencies>
		<dependency>
			<groupId>org.springframework.cloud</groupId>
			<artifactId>spring-cloud-dependencies</artifactId>
			<version>Finchley.RELEASE</version>
			<type>pom</type>
			<scope>import</scope>
		</dependency>
	</dependencies>
</dependencyManagement>

<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
```
<!-- more -->
* Eureka Server 配置及注解

	@EnableEurekaServer

``` Java
server:
  port: 8761
eureka:
  client:
    # 表明自己是eureka server
    register-with-eureka: false
    # 是否从其他 eureka server 获取注册信息,单节点不需要
    fetch-registry: false
    # 与 eureka server交互地址
    service-url:
      defaultZone: http://localhost:8671/eureka/
```

* Eureka Client jar依赖

``` Java
<!-- 实现服务的注册 -->
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

* Eureka Server 配置及注解

	@EnableDiscoveryClient (spring-cloud-commons) 高度抽象更推荐
	@EnableEurekaClient (spring-cloud-netflix) 只有在有Eureka jar包才有的注解，此时与EnableDiscoveryClient无区别

``` Java
spring:
  application:
    # 注册到 eureka server上的应用名称
    name: service-provide-user
	
# eureka 服务注册相关配置
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
  instance:
    # true就把自己的ip注册到server,false就将电脑的hostname注册到server
    prefer-ip-address: true
```

## Ribbon

* ribbon是Netflix发布的负载均衡器，有助于控制HTTP和TCP客户端的行为。

* 除了默认提供的轮询，随机等负载均衡算法，可以自己实现自定义负载均衡算法。

* ribbon jar 依赖

``` Java
<dependencies>
	<dependency>
		<groupId>org.springframework.cloud</groupId>
		<artifactId>spring-cloud-starter-netflix-ribbon</artifactId>
	</dependency>
	<dependency>
		<groupId>org.springframework.cloud</groupId>
		<artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
	</dependency>
</dependencies>
```

* ribbon 配置及注解

@EnableEurekaClient
@LoadBalance

``` Java

@SpringBootApplication
@EnableEurekaClient
public class ServiceRibbonApplication {

	@Bean
	@LoadBalanced
	RestTemplate restTemplate() {
		return new RestTemplate();
	}

	public static void main(String[] args) {
		SpringApplication.run(ServiceRibbonApplication.class, args);
	}

}

@RestController
@Slf4j
public class UserController {

    @Autowired
    private RestTemplate restTemplate;

    @GetMapping("/load")
    public String loadBalance() {
        return restTemplate.getForObject("http://service-provide-user/provide/", String.class);
    }
}
```

## Feign

* Feign是一个声明式的伪Http客户端，它使得写Http客户端变得更简单。

* Feign 采用的是基于接口的注解，整合了ribbon，具有负载均衡的能力。

* Feign jar 依赖

``` Java
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-openfeign</artifactId>
	</dependency>
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```
* Feign 配置及注解

@EnableDiscoveryClient
@EnableFeignClients

``` Java
# 先定义Feign接口
@FeignClient(name = "service-provide-user")
public interface UserFeignClient {
	// value是接口的请求路径，param在feign中定义即可
    @RequestMapping(value = "/provide",method = RequestMethod.GET)
    String feign(@RequestParam Long id);
}
# 注入Feign接口
@RestController
@RequestMapping("/feign")
public class UserController {

    @Autowired
    private UserFeignClient userFeignClient;

    @GetMapping
    public String feign() {
        return userFeignClient.feign();
    }
}

```

## Hystrix

* Hystrix 是一个实现超时机制和断路器模式的工具类库，用于隔离访问远程系统，服务或者第三方库防止级联失败。

* Hystrix特点：
	* 包裹请求：使用HystrixCommand包裹对依赖的调用逻辑
	
	* 跳闸机制：当某服务错误率超过一定阈值时，Hystrix可以自动或者手动跳闸，停止请求该服务一段时间。
	
	* 资源隔离：Hystrix为每个依赖都维护一个小型的线程池（或信号量）。如果线程池已满，发往该依赖的请求就被拒绝，不是排队等待，从而加速失败判定。
	
	* 监控：近乎实时地监控运行指标和配置的变化
	
	* 回退机制： 当请求失败，拒绝，超时就会执行回退逻辑。
	
	* 自我修复：断路器打开一段时间后，会自动进入半开的状态。

* Hystrix jar 依赖

``` Java
<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-hystrix</artifactId>
</dependency>

<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>

<dependency>
	<groupId>org.springframework.cloud</groupId>
	<artifactId>spring-cloud-starter-netflix-ribbon</artifactId>
</dependency>
```

* Hystrix注解和配置

 feign自带熔断器，默认关闭 
``` Java
feign.hystrix.enabled=true
@FeignClient(value = "service-provide-user",fallback = xxxx.class)
```

```Java
@SpringBootApplication
@EnableDiscoveryClient
@EnableHystrix
public class ServiceHystrixApplication {

	@Bean
	@LoadBalanced
	RestTemplate restTemplate() {
		return new RestTemplate();
	}
	public static void main(String[] args) {
		SpringApplication.run(ServiceHystrixApplication.class, args);
	}

}


@RestController
public class UserController {

    @Autowired
    private RestTemplate restTemplate;

    @GetMapping("/user")
    @HystrixCommand(fallbackMethod = "errorMethod")
    public String hystrix() {
        return restTemplate.getForObject("http://service-provid-user", String.class);
    }
    //错误时执行的方法
    String errorMethod() {
        return "hi, it's error";
    }
}
```

## Zuul

* 微服务网关是介于客户端和服务器端之间的中间层，所以的外部请求都会经过微服务网关。

* 特点：
	* 易于监控：可在微服务网关收集监控数据
	* 易于认证：可在微服务网关进行认证，然后再讲请求转发到后端的微服务
	* 减少了客户端和各个微服务之间的交互次数。

* zuul是Netflix开源的微服务网关，核心是一系列的过滤器，可以实现身份认证和安全，审查和监控，动态路由，压力测试，负载分配等等

* zuul默认Http客户端是Apache Http Client.

	如果要使用RestClient：<code>ribbon.restclient.enable=true</code>
	如果要使用OkHttpClien：<code>ribbon.okhttp.enable=true</code>

* zuul默认是集成ribbon和hystrix的功能的，但是使用了url和path的路由配置就无法实现ribbon和hystrix的功能

* 依赖

``` Java
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-zuul</artifactId>
</dependency>
```

* 注解和配置

``` Java
@EnableZuulProxy
@EnableDiscoveryClient
```

``` Java
server:
  port: 8768
spring:
  application:
    name: service-zuul
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
zuul:
  routes:
    # 如果使用的是path&url的配置，ribbon和hystrix不生效
    api-a:
      path: /api-a/**
      serviceId: eureka-client
    api-b:
      path: /api-b/**
      serviceId: eureka-client-two
# 指定ribbon的超时时间，用于解决load balance connect error问题
ribbon:
  ReadTimeout: 60000
  ConnectTimeout: 60000
```

* 配置详解
假设zuul地址是http://localhost:8768
1.默认访问方式
``` Java
在没有配置路由的情况下，默认是可以进行http://localhost:8768/微服务名/接口进行访问。
```
2.自定义访问路径
``` Java
访问http://localhost:8768/user/hi?name=xxx等于访问微服务eureka-client
zuul:
	routes:
    	eureka-client: /user/**
```
3.忽略单个或者多个微服务<font color="red">('*'表示忽略全部微服务)</font>
``` Java
zuul:
	ignored-services: eureka-client
	# 忽略所有包含/admin/的路径
	ignored-patterns: /**/admin/**
	# 只代理/user开头的接口/只路由eureka-client-two的微服务
	routes:
		eureka-client-two: /user/**
```
4.指定服务的serviceId和path(作用和2相同)
``` Java
zuul:
	routes:
		user-route:
    		serviceId: eureka-client
    		path: /user/**
```
5.指定path和url
``` Java
zuul:
	routes:
        # 名称自定义
		user-route:
     		url: http://loalhost:8762/ #指定的url
     		path: /user/** #url对应的路径
```
需要注意的是，该方式配置的路由不会作为HystrixCommand执行，同时也不能使用Ribbon负载均衡多个url
6.指定path和serviceId（不使用zuul自带的hystrix和ribbon）
``` Java
zuul:
   routes:
     # 名称自定义
     user-route:
        path: /user/**
		#此处是ribbon的微服务名
        serviceId: service-ribbon-hystrix
ribbon:
    eureka:
      # ribbon禁用eureka
      enabled: false
#此处是ribbon的微服务名
service-ribbon-hystrix:
    ribbon:
	  #此处对应ribbon的微服务地址
      listOfServers: localhost:8766
```
7.使用正则实现路由匹配
``` Java
@Bean
public PatternServiceRouteMapper patternServiceRouteMapper() {
	//（servicePattern，routePattern）
    return new PatternServiceRouteMapper("(?<name>^.+)-(?<version>v.+$)", "${version}/${name}");
    }
```
8.路由前缀
``` Java
访问zuul的/hi/**路径都会转发到eureka-client的/hi/**下
zuul:
	routes:
   	 eureka-client:
     	path: /hi/**
		 #是否将这个代理前缀去掉
		 strip-prefix: false
```
9.打印日志转发细节
``` Java
logging:
	level:
	  com.netflix: debug
```

* Zuul的Header设置

``` Java
zuul:
	#忽略敏感Header头
	ignored-headers：Cookie
	#添加全局敏感Header头(默认是如下三种)
	sensitive-headers: Cookie,Set-Cookie,Authorizatio
	routes: 
		eureka-client:
        path: /user/**
        url: http://localhost:8762
        #为该微服务添加敏感Header头
        sensitive-headers: Cookie,Set-Cookie,Authorization
```
