---
title: SpringBoot过滤器和拦截器实现
date: 2018-09-11 17:12:15
tags: Java
toc: true
categories:
  - SpringBoot
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4cchi3jp9j30lo096mxc.jpg
---

### 基本原理

- Filter 是 javax.servlet 包下的接口, 是属于 JavaEE 的标准, 所以又称 `Servlet 的 Filter`。
- Inteceptor 是属于 Spring 的框架的内容,`可以获取 IOC 容器中的 各个 bean`, 所以又称为 `Spring 的 Inteceptor`。
- 两者都可以实现拦截登陆、权限校验等操作。Filter 只能对 reques 和 response 进行操作, 而 Inteceptor 还可以对 handler、modelAndView、Exception 进行操作。
- Filter 基于 `Java 函数回调实现, 依赖于 Servlet 容器, 而 Inteceptor 基于 Java 反射实现, 不依赖于 Servlet 容器`。
<!-- more -->
### Filter 代码实现

```java

@Slf4j
@Component
public class LoginFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // 只在容器初始化的时候调用
        log.info("filter init ...");
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        // 每次请求都会调用一次
        log.info("filter doFilter before ...");
        // 调用Servlet.doService()方法, 理解成Servlet容器调用具体的Servlet(Inteceptor在其中)
        filterChain.doFilter(servletRequest, servletResponse);
        log.info("filter doFilter after ...");
    }

    @Override
    public void destroy() {
        // 容器销毁的时候调用
        log.info("filter destroy ...");
    }
}
```

### Inteceptor 代码实现

```java

@Slf4j
@Component
public class LoginInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
       log.info("interceptor pre ...");
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {
        log.info("interceptor post ...");
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        log.info("interceptor after ...");
    }
}

```

#### 注册拦截器

| Spring 版本 | 实现方式 | 类/接口名               |
| ----------- | -------- | ----------------------- |
| > 5.0       | implment | WebMvcConfigurer        |
| < 5.0       | extends  | WebMvcConfigurerAdapter |

👉🏼 SpringBoot2.0 之后需要实现 `WebMvcConfigurer` 接口

```java
@Configuration
public class WebMvcConfig extends WebMvcConfigurerAdapter {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 拦截/**路径的请求
        registry.addInterceptor(new LoginInterceptor()).addPathPatterns("/**");
    }
}
```

### 执行顺序

- 执行顺序(抽象)

 <img border="1" src="https://ae01.alicdn.com/kf/H796addf0992d465b80f4408405bcbf63n.jpg">

- 执行顺序(SpringMVC)

  结合上文的代码, 每次请求打印的日志顺序:

  ```bash
  1. filter doFilter before...
  2. interceptor pre ...
  3. request coming ...
  4. interceptor post ...
  5. interceptor after ...
  6. filter doFilter after ...
  ```

  <img src="https://ae01.alicdn.com/kf/H4e583638e0934a68b4816c1f335616fec.jpg" border="1">
