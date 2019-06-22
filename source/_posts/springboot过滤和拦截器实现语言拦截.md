---
title: springboot过滤和拦截器的简单实现
date: 2018-09-11 17:12:15
tags: Java
toc: true
categories:
- SprintBoot
thumbnail: http://ww1.sinaimg.cn/thumbnail/70ef936dly1g4a06egs13j20i008jwep.jpg
---

## Springboot拦截器

* 执行顺序

``` bash
 执行顺序:过滤器-->拦截器:preHandle-->controller -->拦截器:视图渲染前-->postHandler-->拦截器:视图渲染-->afterCompletion
 ```
* 过滤器实现

``` java
@Component
public class LangFilter implements Filter {
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {

    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        Locale locale = request.getLocale();
        System.out.println("过滤器: " + locale);
        chain.doFilter(request,response);
    }

    @Override
    public void destroy() {

    }
}
```
* 拦截器实现

```java
@Component
public class LangInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        Locale locale = request.getLocale();
        System.out.println("拦截器: " + locale);
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {

    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {

    }
}
```
## 注册拦截器
👉🏼 SpringBoot2.0之后需要实现WebMvcConfigure接口
👉🏼 实现拦截器最重要的步骤:需要和启动类处于同一目录下
``` java
@Configuration
public class WebMvcConfig extends WebMvcConfigurerAdapter {
    // 这里使用autowired无法实现拦截器
    @Bean
    LangInterceptor langInterceptor() {
        return new LangInterceptor();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(langInterceptor()).addPathPatterns("/**");
    }
}
```
