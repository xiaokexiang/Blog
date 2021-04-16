---
title: "SpringMVC使用注意"
date: 2020-11-10T11:04:59+08:00
description: "SpringMVC中的拦截器、事件使用的相关注意事项"
weight: 3
tags: ["SpringMVC ", "SpringBoot "]
categories: [
  "Spring"
]
hideReadMore: true
---

### SpringMVC相关问题

#### 拦截器中@value注解不生效

原因在于：当我们继承`WebMvcConfigurationSupport`中的`addInterceptors`方法，并添加自定义的拦截器时，如果我们使用new的方式创建，那么该拦截器不会被IOC容器管理，所以无法给通过`@value`注解注入配置，推荐`@Bean`注解注入。

```java
public class LoginInterceptor implements HandlerInterceptor {

    private final Logger log = LoggerFactory.getLogger(this.getClass());

    @Override
    public boolean preHandle( HttpServletRequest request, 
        					  HttpServletResponse response, 
        					  Object handler) throws Exception {
        log.info("request is coming in ...");
        return false;
    }
}

public class SpringCloudEurekaServerApplication implements WebMvcConfigurer {

    @Bean
    public LoginInterceptor loginInterceptor() {
        return new LoginInterceptor();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loginInterceptor()).addPathPatterns("/**");
    }
}
```
---

#### WebMvcConfigurer 和 WebMvcConfigurationSupport

- 存在`WebMvcConfigurationSupport`则`WebMvcConfigurer`不生效

```java
@ConditionalOnClass({ Servlet.class, DispatcherServlet.class, WebMvcConfigurer.class })
@ConditionalOnMissingBean(WebMvcConfigurationSupport.class)
public class WebMvcAutoConfiguration {
}
```

- 实现方式不同

```java
// 实现方式
public class SpringCloudEurekaServerApplication implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
    }
}

// 继承方式
public class SpringCloudEurekaServerApplication extends WebMvcConfigurationSupport{
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
    }
}
```
---

#### Spring中的事件

##### 监听事件的三种方式

- 实现ApplicationListener<T> + @Component

```java
@Component
public class MyListener implements ApplicationListener<MyEvent> {
    private final Logger logger = LoggerFactory.getLogger(this.getClass());
    @Override
    public void onApplicationEvent(MyEvent event) {
        logger.info("MyListener get event: {}", event.getSource());
    }
}
```

- @EventListener + @Component

```java
@Component
public class MyListener2 {
    private final Logger logger = LoggerFactory.getLogger(this.getClass());
    
    @EventListener
    public void onApplicationEvent(MyEvent event) {
        logger.info("MyListener2 get event: {}", event.getSource());
    }
}
```

- 实现ApplicationListener<T> + spring.factories注入

```java
public class MyListener3 implements ApplicationListener<MyEvent> {
    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    @Override
    public void onApplicationEvent(MyEvent event) {
        logger.info("MyListener3 get event: {}", event.getSource());
    }
}
```

```factories
org.springframework.context.ApplicationListener=\
io.spring.server.event.MyListener3
```

> 位于resources/META-INF/spring.factories文件中

##### 同步/异步发送事件

默认情况下是同步发送事件，在容器的refresh()中存在`initApplicationEventMulticaster()`方法，用于初始化事件发送器。

```java
protected void initApplicationEventMulticaster() {
    ConfigurableListableBeanFactory beanFactory = getBeanFactory();
    // 如果IOC容器中存在名为applicationEventMulticaster的bean则使用该bean作为事件发送器
    if (beanFactory.containsLocalBean(APPLICATION_EVENT_MULTICASTER_BEAN_NAME)) {
        this.applicationEventMulticaster =
            beanFactory.getBean(APPLICATION_EVENT_MULTICASTER_BEAN_NAME, ApplicationEventMulticaster.class);
        
    } else {
        // 不存在则使用内置的SimpleApplicationEventMulticaster作为事件发送器，并注入到容器中
        this.applicationEventMulticaster = new SimpleApplicationEventMulticaster(beanFactory);
        beanFactory.registerSingleton(
            APPLICATION_EVENT_MULTICASTER_BEAN_NAME, this.applicationEventMulticaster);
    }
}
```

- SimpleApplicationEventMulticaster(同步)

```java
@Override
public void multicastEvent(final ApplicationEvent event, @Nullable ResolvableType eventType) {
    ResolvableType type = (eventType != null ? eventType : resolveDefaultEventType(event));
    Executor executor = getTaskExecutor();
    for (ApplicationListener<?> listener : getApplicationListeners(event, type)) {
        if (executor != null) {
            executor.execute(() -> invokeListener(listener, event));
        }
        else {
            invokeListener(listener, event);
        }
    }
}
```

> 内置的`SimpleApplicationEventMulticaster`中的`multicastEvent`方法会判断是否存在`Executor`，如果存在则用线程池发送。

- 自定义ApplicationEventMulticaster(异步)

```java
@Component(value = "applicationEventMulticaster")
public class AsyncApplicationEventMulticaster extends SimpleApplicationEventMulticaster {

    public AsyncApplicationEventMulticaster() {
        super.setTaskExecutor(Executors.newFixedThreadPool(2));
    }
}
```

> 通过传入线程池实现异步invokeListeners，需要注入注入名必须是`applicationEventMulticaster`。

##### 事件发送两次

在使用`spring.factories`注入`ApplicationListener`时，发现监听器会被调用两次，通过debug发现：因为是web项目，所以上下文中存在父子容器的问题(`AnnotationConfigServletWebServerApplicationContext`和`AnnotationConfigApplicationContext`)，所以在子容器发布事件后，父容器也会发送一次。

```java
@Override
public void onApplicationEvent(MyEvent event) {
    if (applicationContext.getParent() != null) {
        logger.info("MyListener3 get event: {}", event.getSource());
    }
}
```

> 只让子容器发送事件，父容器不需要发送。