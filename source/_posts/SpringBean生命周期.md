---
title: Spring Bean 生命周期
date: 2019-11-17 10:55:08
toc: true
tags: Java
categories:
  - Spring
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4cchi3jp9j30lo096mxc.jpg
---

### 前言

  最近在看Spring5源码解析, 想着之前去面试的时候有面试官问到Spring Bean生命周期的问题, 当时我是答得七七八八, 那么写这篇文章纯粹是自己有了新的体会, 希望通过辅以源码的方法加深自己的理解, 以便自己之后回顾Spring的时候能够快速上手.

### 代码

``` java
public class BeanInitAndDestroy {
    public static void main(String[] args) {
        /* singleton 初始化流程: Bean constructor -> Bean init method -> application context complete -> Bean destroy*/
        AnnotationConfigApplicationContext applicationContext = new AnnotationConfigApplicationContext(AnnotationConfig.class);
        System.out.println("application context 创建完成");
        /* prototype 初始化流程: application context complete -> getBean(Bean constructor -> Bean init)*/
        applicationContext.getBean(Lemon.class);
        applicationContext.close();
    }

}

```
<!-- more -->
``` java
/**
 * 这注解就像: Service层(AnnotationConfig)中注入Dao层(lemon)
 */
@Configuration
class AnnotationConfig {

    /**
     * 指定初始化&销毁方法 放到IOC中的key是方法名: (lemon)
     * 需要注意的是如果作用域为prototype, 则只会在获取该Bean的时候才会创建、初始化Bean, 且IOC容器不会销毁Bean
     */
    @Bean(initMethod = "initMethod", destroyMethod = "destroyMethod")
    public Lemon lemon() {
        return new Lemon();
    }

    @Bean
    public BeanPostProcessorClass beanPostProcessorClass() {
        return new BeanPostProcessorClass();
    }

}
```

``` java
class Lemon implements InitializingBean, DisposableBean {

    Lemon() {
        System.out.println("Bean: Lemon 创建 ...");
    }

    void initMethod() {
        System.out.println("Bean: Lemon initMethod() ...");
    }

    void destroyMethod() {
        System.out.println("Bean: Lemon destroyMethod() ...");
    }

    @Override
    public void afterPropertiesSet() throws Exception {
         System.out.println("Bean: Lemon afterPropertiesSet ...");
    }

    @Override
    public void destroy() throws Exception {
        System.out.println("Bean: Lemon destroy ...");
    }

    @PostConstruct
    void postConstruct() {
        System.out.println("Bean: Lemon @PostConstruct ... ");
    }

    @PreDestroy
    void preDestroy() {
        System.out.println("Bean: Lemon @PreDestroy");
    }
}
```
> 1. 上述代码主要是在AnnotationConfig 配置类中注入Bean: Lemo
> 2. 通过AnnotationConfigApplicationContext(Spring注解源码入口)加载配置类, 从而实现Spring Bean生命周期的分析

### 流程分析

- 方法入口
  
``` java
public AnnotationConfigApplicationContext(Class<?>... componentClasses) {
    this();
    // 注册Bean信息
    register(componentClasses);
    // 实例化Bean & 初始化Bean的方法入口 
    refresh();
}
```

- invokeBeanFactoryPostProcessors()

    `在refresh()方法中调用 AbstractApplicationContext中invokeBeanFactoryPostProcessors()方法`

``` java
protected void invokeBeanFactoryPostProcessors(ConfigurableListableBeanFactory beanFactory) {
    PostProcessorRegistrationDelegate.invokeBeanFactoryPostProcessors(beanFactory, getBeanFactoryPostProcessors());
    ....
}
```

- invokeBeanFactoryPostProcessors()

    `在方法中调用AbstractBeanFactory.getBean(String name, Class<T> requiredType)方法, getBean()方法内调用doGetBean()`

``` java
protected <T> T doGetBean(final String name, @Nullable final Class<T> requiredType, @Nullable final Object[] args, boolean typeCheckOnly) throws BeansException {

    final String beanName = transformedBeanName(name);
    Object bean;

    ...

    // Create bean instance.
    if (mbd.isSingleton()) {
        sharedInstance = getSingleton(beanName, () -> {
            try {
                // 关键在于createBean()方法
                return createBean(beanName, mbd, args);
            }
            catch (BeansException ex) {
                destroySingleton(beanName);
                throw ex;
            }
        });
        bean = getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
    }

    ...

    return (T) bean;
}

```

- createBean() 
    
    `关键在于AbstractAutowireCapableBeanFactory中的createBean()方法, 里面的
resolveBeforeInstantiation()方法就是调用实现InstantationAwarePostProcessor的类`

``` java
@Override
protected Object createBean(String beanName, RootBeanDefinition mbd, @Nullable Object[] args)  throws BeanCreationException {

...

    try {
        // 给后置处理器一个可以用代理bean替换目标bean的机会
        Object bean = resolveBeforeInstantiation(beanName, mbdToUse);
        if (bean != null) {
            return bean;
        }
    }
    catch (Throwable ex) {
        throw new BeanCreationException(mbdToUse.getResourceDescription(), beanName,
                "BeanPostProcessor before instantiation of bean failed", ex);
    }
}
```

- resolveBeforeInstantiation()

    `处理InstantationAwarePostProcessor中beforeInstantiation和afterInstantiation的相关逻辑`

``` java
@Nullable
protected Object resolveBeforeInstantiation(String beanName, RootBeanDefinition mbd) {
    Object bean = null;
    if (!Boolean.FALSE.equals(mbd.beforeInstantiationResolved)) {
        // Make sure bean class is actually resolved at this point.
        if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
            Class<?> targetType = determineTargetType(beanName, mbd);
            if (targetType != null) {
                // 处理BeforeInstantiation方法(获取全部的BeanPostProcessor看是否有InstantationAwarePostProcessor的实现类,有执行并返回结果)
                bean = applyBeanPostProcessorsBeforeInstantiation(targetType, beanName);
                // 如果BeforeInstantiation结果不为空,调用AfterInitialization(同上)
                if (bean != null) {
                    // 
                    bean = applyBeanPostProcessorsAfterInitialization(bean, beanName);
                }
            }
        }
        mbd.beforeInstantiationResolved = (bean != null);
    }
    return bean;
}
```

``` java
protected Object doCreateBean(final String beanName, final RootBeanDefinition mbd, final @Nullable Object[] args) throws BeanCreationException {

...

    try {
        // 执行InstantationAwarePostProcessor中的postProcessProperties()方法
        populateBean(beanName, mbd, instanceWrapper);
        // 关于初始化Bean的部分都在这个方法里面
        exposedObject = initializeBean(beanName, exposedObject, mbd);
    }
    catch (Throwable ex) {
        if (ex instanceof BeanCreationException && beanName.equals(((BeanCreationException) ex).getBeanName())) {
            throw (BeanCreationException) ex;
        }
        else {
            throw new BeanCreationException(
                    mbd.getResourceDescription(), beanName, "Initialization of bean failed", ex);
        }
    }
...

```

- initializeBean()

    `关于Bean的初始化等相关方法都在initializeBean()方法里面调用, InitializingBean接口的实现和Bean注解中init-Method方法都在invokeInitMethods()方法中调用`

``` java
protected Object initializeBean(final String beanName, final Object bean, @Nullable RootBeanDefinition mbd) {
    
    ...

    Object wrappedBean = bean;
    if (mbd == null || !mbd.isSynthetic()) {
        // 执行BeanPostProcessor中的BeforeInitialization()方法
        wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);
    }

    try {
        invokeInitMethods(beanName, wrappedBean, mbd);
    }
    catch (Throwable ex) {
        throw new BeanCreationException(
                (mbd != null ? mbd.getResourceDescription() : null),
                beanName, "Invocation of init method failed", ex);
    }
    if (mbd == null || !mbd.isSynthetic()) {
        // 执行BeanPostProcessor中的AfterInitialization()方法
        wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);
    }

    return wrappedBean;
}
```

``` java
protected void invokeInitMethods(String beanName, final Object bean, @Nullable RootBeanDefinition mbd)
			throws Throwable {

    // 判断当前bean是不是InitializingBean接口的实现类
    boolean isInitializingBean = (bean instanceof InitializingBean);
    if (isInitializingBean && (mbd == null || !mbd.isExternallyManagedInitMethod("afterPropertiesSet"))) {
        if (logger.isTraceEnabled()) {
            logger.trace("Invoking afterPropertiesSet() on bean with name '" + beanName + "'");
        }
        if (System.getSecurityManager() != null) {
            ...
        }
        else {
            // 条件符合调用InitializingBean实现类中afterPropertiesSet()方法
            ((InitializingBean) bean).afterPropertiesSet();
        }
    }

    if (mbd != null && bean.getClass() != NullBean.class) {
       ...
            // 这一步调用Bean注解中的init-method, 通过反射调用
            invokeCustomInitMethod(beanName, bean, mbd);
       ...
    }
}
```

### PostConstruct

  - @PostConstruct和@PreDestroy注解要单独拿出来讲一下, 因为他们是自java5推出的影响Servlet生命周期的注解.

  - @PostConstruct的执行顺序是在`构造函数完成之后,初始化之前`, @PreDestroy是在`destroy()方法之前执行.`

  - `constructor > @Autowire > @PostConstruct(会在Autowire注解后自动被调用)`

  ``` java
    public class A {

        @Autowired
        private B b;

        public A() {
            System.out.println("Bean A constructor ...");
        }

        @PostConstruct
        public void init() {
            System.out.println("Bean A init ...");
            b.doSomething();
        }
    }

    @Service
    public class B {

        public B() {
            System.out.println("Bean B constructor ...");
        }

        @PostConstruct
        private void init() {
            System.out.println("Bean B init ...");
        }

        void doSomething(){
            System.out.println("Bean B do something ...");
        }
    }
  ```
  > 执行结果:
  > Bean A constructor ...
  > Bean B constructor ...
  > Bean B init ...
  > Bean A init ...
  > Bean B do something ...
  > `A 构造 -> autowire B -> B 构造 -> B postConstruct -> A postConstruct -> A.doSomething`

### 总结

<img src="https://image.leejay.top/image/20200324/ENGNrBhvCUMk.png"/>