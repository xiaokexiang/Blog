---
title: Spring注解解析
date: 2018-12-07 18:49:53
tags: Java
toc: true
categories:
- Sprint
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4cchi3jp9j30lo096mxc.jpg

---
## Spring 框架的构成
``` Java
core：Core包是框架的最基础部分，并提供依赖注入（Dependency Injection）管理Bean容器功能。
context: 继承core包，实现了bean管理、加载和生命周期等功能，并额外提供了国际化、获取资源、加入servlet和监听器，事件传递等功能。
```

## Spring 注解分析
### 组件相关

* @Configuration 表明当前是一个配置类
* @Bean 表明这是一个bean，id默认是方法名，也可以指定name为id进行调用，bean容器启动时会将该bean注册到bean容器中

``` Java
@Configuration
public class SpringConfig {

    @Bean(name = "personBean")
    public Person person() {
        return new Person("张三", 20);
    }
}
```
<!-- more -->
* SpringBoot需要实现ApplicationContextAware接口获容器中的bean，Spring则通过AnnotationConfigApplicationContext获取注解的bean

``` Java
@Component
public class ApplicationContextImpl implements ApplicationContextAware {

    private ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
    }

    public Object getBean(String name) {
        return applicationContext.getBean(name);
    }

    public <T> T getBean(Class<T> clazz) {
        return applicationContext.getBean(clazz);
    }

    public <T> T getBean(String name, Class<T> clazz) {
        return applicationContext.getBean(name, clazz);
    }
}
```
* @ComponentScan Spring自动扫描(@Controller、@Service @Repository、@Component)并加入容器中，可以指定扫描的包名。

``` Java
excludeFilters -> 排除某些bean
@ComponentScan(value = "top.leejay", excludeFilters = {
        @ComponentScan.Filter(type = FilterType.ANNOTATION, classes = {Controller.class, Service.class, Repository.class})
})

--------------------------------------------------------------------------------------
includeFilters -> 只包含该bean，同时必须禁用默认过滤，否则不生效
@ComponentScan(value = "top.leejay", includeFilters = {
        @ComponentScan.Filter(type = FilterType.ANNOTATION, classes = {Controller.class})
}, useDefaultFilters = false)

```
* 基于@ComponentScan的@Filter规则（多个规则按顺序取交集）

``` Java
@ComponentScan(value = "top.leejay", excludeFilters = {
		// 基于注解
        @ComponentScan.Filter(type = FilterType.ANNOTATION, classes = {Controller.class}),
		// 基于给定的类型，包括任何实现类，子类等
        @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = {BookService.class}),
		// 基于自定义filter规则
        @ComponentScan.Filter(type = FilterType.CUSTOM, classes = {CustomFilter.class})
})
```
* @Scope（调整作用域，默认单实例）

``` Java
@Bean
@Scope(scopeName = "prototype/singleton")
public Person person() {
     return new Person("张三", 20);
}
 
singleton: 在IOC容器启动的时候就会创建此bean放入容器中，此后多次调用直接到容器中获取(map.get())
prototype: 在IOC容器启动时并不会创建，只有在调用getBean时才会去创建bean，每次请求都会创建一次
```
* @Lazy（懒加载，基于单实例,IOC启动不会创建，第一次调用bean才会创建）

``` Java
@Bean
@Lazy
public Person person() {
    log.info("我被调用啦....");
    return new Person("张三", 20);
}
```
* @Conditional（类/方法上，按照条件注册bean，自定义校验需要实现Condition）

``` Java
public class VerifyConditional implements Condition {

    /**
     * @param context  上下文环境
     * @param metadata 注释信息
     * @return
     */
    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        String os = "os.name";
        String win = "Win";
        // 获取bean工厂
        ConfigurableListableBeanFactory beanFactory = context.getBeanFactory();

        // 获取类加载器
        ClassLoader classLoader = context.getClassLoader();

        // 获取bean的注册信息,可以添加和移除bean
        BeanDefinitionRegistry registry = context.getRegistry();

        // 获取环境
        Environment environment = context.getEnvironment();

        return environment.getProperty(os).contains(win);
    }
}
```
* @Import（除了@Bean&@Component添加组件到容器中外的第三个方法）

``` Java
@Import(ImportConfig.class)
-------------------------------------------------------------------------------------------
@ImportSelector(实现ImportSelector接口，springboot用的最多)
public class MyImportSelector implements ImportSelector {

    /**
     *
     * @param importingClassMetadata 使用ImportSelector注解的类的全部注解信息
     * @return
     */
    @Override
    public String[] selectImports(AnnotationMetadata importingClassMetadata) {
        return new String[]{"top.leejay.spring.common.importSelector.ImportConfig"};
    }
}

-------------------------------------------------------------------------------------------
@ImportBeanDefinitionRegistrar(手动将bean注册到容器中)
public class MyImportBeanDefinitionRegistrar implements ImportBeanDefinitionRegistrar {

    String singleton = "singleton";
    @Override
    public void registerBeanDefinitions(AnnotationMetadata importingClassMetadata, BeanDefinitionRegistry registry) {
        // 创建bean
        RootBeanDefinition beanDefinition = new RootBeanDefinition(SpringConfig1.class);
        // 给bean的scope赋值
        beanDefinition.setScope(singleton);
        // 注册bean到容器中
        registry.registerBeanDefinition("SpringConfig1",beanDefinition);
    }
}
```
* 使用FactoryBean注册bean到容器(注册bean到容器中第四种方法)

``` Java
 @Bean
 public MyFactoryBean myFactoryBean() {
     return new MyFactoryBean();
 }
 
 public class MyFactoryBean implements FactoryBean<SpringConfig2> {

    /**
     * 创建bean
     * @return
     */
    @Override
    public SpringConfig2 getObject() {
        log.info("getObject...");
        return new SpringConfig2();
    }

    /**
     * 获取bean类型
     * @return
     */
    @Override
    public Class<SpringConfig2> getObjectType() {
        log.info("getObjectType...");
        return SpringConfig2.class;
    }

    /**
     * 是否单例
     * @return
     */
    @Override
    public boolean isSingleton() {
        return true;
    }
}
applicationContext.getBean("myFactoryBean") -> 返回实现类的T
applicationContext.getBean("&myFactoryBean") -> 返回工厂的实现类

```
* BeanFactory和FactoryBean的区别

``` Java
1.BeanFactory是一个工厂类，是IOC容器的核心接口，它的职责包括:实例化、定位、配置应用程序中的对象及建立这些对象间的依赖
2.FactoryBean是一个Bean，实现了FactoryBean<T>的bean，根据该Bean的ID从BeanFactory中获取的实际上是
FactoryBean的getObject()返回的对象，而不是FactoryBean本身，要获取需要加&。

```
* @Component和@Bean的对比

``` Java
1. @Component 告知Spring这是一个组件类，让SPring创建该类的bean，通过ComponentScan(包括@Controller..)自动扫描以及自动注册到容器中。
2. @Bean 告知Spring这个方法的返回值要注册到Spring的上下文中，比@Component更灵活，针对第三方类库只能使用@Bean。
```

### 生命周期

* Bean的init和destroy方法

	* @Bean
	
	``` Java
 @Bean(initMethod = "init", destroyMethod = "destroy")
 init和destroy分别对应bean中的自定义方法，init方法在constructor方法后调用，destroy在容器关闭时调用。
 需要注意的是，当bean是多例的时候，容器不会管理bean，bean由用户手动初始化和关闭。
```
	*  实现InitializingBean, DisposableBean接口
	``` Java
 public class Car implements InitializingBean, DisposableBean {

    	public Car() {
        	System.out.println("car...constructor...");
    	}

    	@Override
    	public void afterPropertiesSet() {
        	System.out.println("after properties ... car init ...");
    	}

    	@Override
    	public void destroy() {
        	System.out.println("destroy ... car ...");
    	}
}
```
	* @PostConstruct 和 @PreDestroy
	``` Java
	public class Dog {

    	public Dog() {
    	}

    	/**
     	* bean创建完成和赋值后调用
    	 */
    	@PostConstruct
    	public void init() {
        	System.out.println("init...PostConstruct...");
    	}
		/**
     	* bean销毁前调用
    	 */
    	@PreDestroy
    	public void destroy() {
        	System.out.println("destroy...PreDestroy...");
    	}
}
	```

* Bean的后置处理器（BeanPostProcessor接口）
``` Java
@Component
public class MyBeanPostProcessor  implements BeanPostProcessor {
    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        System.out.println("BeforeInitialization...postProcessBeforeInitialization...");
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        System.out.println("AfterInitialization...postProcessAfterInitialization");
        return bean;
    }
}
```

* Bean的执行顺序
``` Java
创建对象 -> 属性赋值 -> postBeforeInitialization -> 初始化(afterProperties/PostConstruct) -> postAfterInitialization -> PreDestroy -> destroy
```

* 属性赋值
	* @Value

	``` Java
public class Person {
    @Value("value") //值写死在注解中
    @Value("${value}") //配置文件中的值
    private String name;
    @Value("#{1 + 2}") //SpEL表达式计算值
    private Integer age;
}
```
	* @PropertySource (properties配置文件推荐)
	``` Java
	@Configuration
@PropertySource(value = {"classpath:application.properties"})
public class BeanLifeCycle {

    	@Bean
    	public Dog dog() {
        	return new Dog();
    	}
	}

	```
	* @configurationProperties(yml配置文件推荐)
	
	``` Java
	@Data
@Component
@ConfigurationProperties(prefix = "car")
public class YmlConfig {
    	private String name;
    	private Integer age;
	}
	前缀和名称需要和配置文件中对应
	```

* DI依赖注入注解
	* @Autowired和@Qualifier

	``` Java
@Autowired默认按照类型去容器查询,如果有相同的类型就根据属性名称去查询,可以通过@Qualifier配合使用指定bean
同时@Autowired允许设置required=false属性,且可以放在方法,构造器,参数和属性位置

	```
	* @Primary
	``` Java
	有多个bean的时候会默认使用@Primary注解的bean,在有@Qualifier时优先按照@Qualifier指定
	```
	* @Resource(JSR250 java规范 基于组件名称进行装配,不支持@Primary和@Qualifier)
	
	``` Java
	@Resource(name = "ymlConfig")
    private YmlConfig ymlConfig;
	```
	* @Inject(JSR330 java规范)
	
	``` Java
	<!-- https://mvnrepository.com/artifact/javax.inject/javax.inject -->
	<dependency>
    	<groupId>javax.inject</groupId>
    	<artifactId>javax.inject</artifactId>
    	<version>1.0.0</version>
	</dependency>
	功能和@AutoWired相同,不同点在于required=fasle
	```

* 注入spring底层的组件到自定义bean中

	``` Java
/**
 * @author: Lucky
 * @time: 2019/1/5
 * @description: 将spring底层的组件注入到自定义bean：MyApplicationContext当中
 * 容器启动将自定义bean注入容器,而容器中需要的参数通过回调的方式传给自定义bean
 * 对应的XXXAware接口的处理器就是XXXAwareProcessors
 * ex：ApplicationContextAwareProcessor处理ApplicationContextAware接口,
 * 会回调ApplicationContextAware实现类的setApplicationContext方法,传入applicationContext对象
 */
@Component
public class MyApplicationContext implements ApplicationContextAware, BeanNameAware, EmbeddedValueResolverAware {

    private ApplicationContext applicationContext;

    @Override
    public void setApplicationContext(ApplicationContext applicationContext) throws BeansException {
        this.applicationContext = applicationContext;
        System.out.println("当前的IOC容器是： " + applicationContext);
    }

    @Override
    public void setBeanName(String s) {
        System.out.println("当前bean是： " + s);
    }

    public String[] getAllBean() {
        return applicationContext.getBeanDefinitionNames();
    }

    /**
     * string 解析
     *
     * @param stringValueResolver string解析器
     */
    @Override
    public void setEmbeddedValueResolver(StringValueResolver stringValueResolver) {
        System.out.println(stringValueResolver.resolveStringValue("您好,我是 ${os.name}, #{20*18}"));
    }
}
	```

* @Profile根据环境使用

	``` Java
@Configuration
public class ConfigOfProfile {

    @Profile("test")
    @Bean("testDataSource")
    public DataSource dataSource1() {
        return getDataSource();
    }

    @Profile("dev")
    @Bean("prodDataSource")
    public DataSource dataSource2() {
        return getDataSource();
    }

    private DataSource getDataSource() {
        DruidDataSource dataSource = new DruidDataSource();
        dataSource.setUsername("root");
        dataSource.setPassword("832231");
        dataSource.setDriverClassName("com.mysql.jdbc.driver");
        dataSource.setUrl("jdbc:mysql//39.108.208.163:3306/test");
        return dataSource;
    }
}

	```
测试代码：
``` Java
	@Test
    public void springProfiles() {
        /**
         * 有参构造会自动创建并注册到IOC容器中，无参需要自己注册
         */
        AnnotationConfigApplicationContext applicationContext = new AnnotationConfigApplicationContext();
        /**
         * 手动设置profile：test/dev/prod
         */
        applicationContext.getEnvironment().setActiveProfiles("dev");
        /**
         * 注册到IOC容器中
         */
        applicationContext.register(ConfigOfProfile.class);
        /**
         * 启动并刷新
         */
        applicationContext.refresh();
        String[] names = applicationContext.getBeanNamesForType(DataSource.class);
        for (String name : names) {
            System.out.println(name);
        }
    }
```


## Aop相关

* Aop实现原理及流程

``` Java
1. @EnableAspectJAutoProxy 开启AOP功能
```

``` Java
2. @EnableAspectJAutoProxy会给容器中注册后置处理器组件: AnnotationAwareAspectJAutoProxyCreator

```

``` Java
3. 后置处理器的创建和工作:
	a. 容器创建时通过refresh()中的registerBeanPostProcessors创建后置处理器对象(AnnotationAwareAspectJAutoProxyCreator)
	b.refresh()中finishBeanFactoryInitialization创建剩下的单实例bean
		1).创建业务逻辑组件和切面组件 !!
		2).AnnotationAwareAspectJAutoProxyCreator会拦截组件创建过程
		3).组件创建完成后,通过AbstractAutoProxyCreator接口中postProcessAfterInitialization.wrapIfNecessary()判断是否需要增强
			1.是,会将切面的通知方法包装成增强器(Advisor),调用ProxyFactory给业务逻辑组件创建一个代理对象(包含所有的增强器)
```
``` Java
4. 代理对象执行目标方法
	a. CglibAopProxy.intercept()
		1).得到目标方法的拦截器链(MethodIntercept),由原有增强器包装成
		2).利用拦截器的链式机制,依次进入每个拦截器执行,保证了执行顺序
		3).执行顺序: 
			1.正常: 前置通知->目标方法->后置通知->返回通知
			2.异常: 前置通知->目标方法->后置通知->异常通知
```

``` Java
5.Bean的生命周期流程和aop执行流程
```
<iframe id="embed_dom" name="embed_dom" frameborder="0" style="display:block;width:700px; height:551px;" src="https://www.processon.com/embed/5c46bf9be4b056ae29f89e6a"></iframe>

## 事务相关
----
* 事务开启操作

``` Java
1.@EnableTransactionManagement 开始事务管理功能
2.目标方法添加@Transactional注解
3.注册事务管理器到容器中:
    @Bean
    public PlatformTransactionManager transactionManager() {
        return new DataSourceTransactionManager(getDataSource());
    }
```