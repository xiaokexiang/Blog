---
title: "Spring Security基础入门"
date: 2021-03-19T17:47:21+08:00
description: "Spring Security作为Java Web的安全框架，用于实现安全控制。"
tags: ["Spring Security"]
categories: [
  "Java"
]
slug: spring_security_in_action
---

## Spring Security入门

### 依赖与配置

#### maven依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

#### Spring Security配置

```java
@Configuration
public class WebSecurityConfig extends WebSecurityConfigurerAdapter {
    
    /**
     * 自定义用户管理系统
     */
    @Bean
    public UserDetailsManager userDetailsManager() {
        UserManager userManager = new UserManager();
        userManager.createUser(innerUser());
        return userManager;
    }

    private UserDetails innerUser() {
        // load user by username 模拟从数据库获取用户权限等信息
        List<GrantedAuthority> authorities = new ArrayList<>();
        // 添加 ADMIN & USER 权限
        authorities.add(new SimpleGrantedAuthority("USER"));
        authorities.add(new SimpleGrantedAuthority("ADMIN"));
        // 一般数据库用户密码存入时会先加密，此处只是模拟加密后的用户信息
        // 使用UserDetails.User$UserBuilder构建user
        return User.withUsername("jack")
                .passwordEncoder(new BCryptPasswordEncoder()::encode)
                .password("jack") // 如果不开启加密，那么需要去除passwordEncoder，密码变成"{noop}jack"
                // AuthorityUtils.NO_AUTHORITIES
                .authorities(authorities)
                .build();
    }
    
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        // login页面登录成功后重定向地址（如果是successfulForwardUrl则是转发）
        http.formLogin().defaultSuccessUrl("http://www.baidu.com") 
            .and().authorizeRequests()
            .antMatchers("/hello", "/json").access("hasAuthority('USER')") // SPEL表达式
            .antMatchers("/admin/**").access("hasAuthority('ADMIN') and hasAuthority('USER')")
            .antMatchers("/super/**").access("hasAuthority('SUPER_ADMIN')")
            // 使用自定义类实现校验,false就需要登录
            .antMatchers("/test").access("@rbacService.checkPermission()") 
            .antMatchers("/**").authenticated() // 只要是登录用户都可以访问（不需要查验权限之类）
            .and().csrf() // 添加csrf的支持
            // 返回json信息
            .and().exceptionHandling().accessDeniedHandler(new JsonAccessDeniedHandler()); 
        	// hasRole 和 hasAuthority的区别，前者会拼接'ROLE_'前缀，后者不会
    }
    
     @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
         auth.userDetailsService(userDetailsManager()).passwordEncoder(passwordEncoder());
    }
}

public class UserManager implements UserDetailsManager {

    private static Map<String, UserDetails> users = new HashMap<>();

    @Override
    public void createUser(UserDetails user) {
        users.putIfAbsent(user.getUsername(), user);
    }

    @Override
    public void updateUser(UserDetails user) {
        users.put(user.getUsername(), user);
    }

    @Override
    public void deleteUser(String username) {
        users.remove(username);
    }

    @Override
    public void changePassword(String oldPassword, String newPassword) {
        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        if (null == current) {
            throw new AccessDeniedException("Can't not change password! because no authentication found in context for current user");
        }
        String username = current.getName();
        UserDetails userDetails = users.get(username);
        if (null == userDetails) {
            throw new RuntimeException("Current user not exist in database!");
        }
        // change password
    }

    @Override
    public boolean userExists(String username) {
        return users.containsKey(username);
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return users.get(username);
    }
}
```

---

## 用户接口与编码器

### 获取用户信息

Spring Security（简称SS）的用户信息由使用者通过实现框架提供的`UserDetailsService$loadUserByUsername()`接口方法提供。SS还提供了`UserDetails接口`，作为提供用户信息的核心接口。内嵌了`User类`作为`UserDetails`的默认实现。`UserDetailsManager`作为管理用户信息（增删改查）的默认内嵌管理器接口。而`InMemoryUserDetailsManager`则是默认的用户管理器实现。![](https://image.leejay.top/FkHsFi8_iqAaYOZ9nXECDTbk8L0d)

> User类内嵌了`UserBuilder`，用于建造设计模式的使用。
>
> `InMemoryUserDetailsManager`默认是由`UserDetailsServiceAutoConfiguration`类构造并注入IOC容器。

### PasswordEncoder编码器

```java
public interface PasswordEncoder {
    
    String encode(CharSequence rawPassword);
    
    boolean matches(CharSequence rawPassword, String encodedPassword);
    
    default boolean upgradeEncoding(String encodedPassword) {
		return false;
	}
}

public class DelegatingPasswordEncoder implements PasswordEncoder {
    public DelegatingPasswordEncoder(String idForEncode,
		Map<String, PasswordEncoder> idToPasswordEncoder) {
    }
}

public class PasswordEncoderFactories {
    public static PasswordEncoder createDelegatingPasswordEncoder() {
    	String encodingId = "bcrypt";
		Map<String, PasswordEncoder> encoders = new HashMap<>();
		encoders.put(encodingId, new BCryptPasswordEncoder());
        // 此处省略
        return new DelegatingPasswordEncoder(encodingId, encoders);
    }
}

public abstract class WebSecurityConfigurerAdapter implements
		WebSecurityConfigurer<WebSecurity> {
    static class LazyPasswordEncoder implements PasswordEncoder {
        private PasswordEncoder getPasswordEncoder() {
			// 此处省略
			if (passwordEncoder == null) {
				passwordEncoder = PasswordEncoderFactories.createDelegatingPasswordEncoder();
			}
		}
    }
}
```

> 1. 所有的编码器都要实现该接口，当IOC容器中无编码器时，SS默认的编码器就是`BCrypt`。
> 2. 此处采用了`适配器`模式，交由`DelegatingPasswordEncoder`来处理默认的编码器工作。
> 3. 默认由`PasswordEncoderFactories`静态工厂生产`DelegatingPasswordEncoder`。
> 4. 静态工厂由SS默认配置接口`WebSecurityConfigurer`的适配器类实现`WebSecurityConfigurerAdapter`调用。

---

## 自动配置

### SecurityAutoConfiguration

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(DefaultAuthenticationEventPublisher.class)
@EnableConfigurationProperties(SecurityProperties.class)
@Import({ SpringBootWebSecurityConfiguration.class, WebSecurityEnablerConfiguration.class,
		SecurityDataConfiguration.class })
public class SecurityAutoConfiguration {

	@Bean
	@ConditionalOnMissingBean(AuthenticationEventPublisher.class)
	public DefaultAuthenticationEventPublisher authenticationEventPublisher(ApplicationEventPublisher publisher) {
		return new DefaultAuthenticationEventPublisher(publisher);
	}

}
```

> 1. 默认注入`DefaultAuthenticationEventPublisher`用于时间的发布。
> 2. 注入配置类`SecurityProperties`
> 3. 注入`SpringBootWebSecurityConfiguration`、`WebSecurityEnablerConfiguration`、`SecurityDataConfiguration`

#### SpringBootWebSecurityConfiguration

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(WebSecurityConfigurerAdapter.class)
@ConditionalOnMissingBean(WebSecurityConfigurerAdapter.class)
@ConditionalOnWebApplication(type = Type.SERVLET)
public class SpringBootWebSecurityConfiguration {

	@Configuration(proxyBeanMethods = false)
	@Order(SecurityProperties.BASIC_AUTH_ORDER)
	static class DefaultConfigurerAdapter extends WebSecurityConfigurerAdapter {
	}
}
```

> 1. 当前环境是`Servlet`，当存在`WebSecurityConfigurerAdapter`时，不注入`SpringBootWebSecurityConfiguration`，不存在时则注入默认的`DefaultConfigurerAdapter`。
> 2. 注入默认的`DefaultConfigurerAdapter`，同时指定`Order(Integer.MAX_VALUE - 5)`。

#### WebSecurityEnablerConfiguration

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnBean(WebSecurityConfigurerAdapter.class)
@ConditionalOnMissingBean(name = BeanIds.SPRING_SECURITY_FILTER_CHAIN)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableWebSecurity
public class WebSecurityEnablerConfiguration {
}
```

> 1. 当存在`WebSecurityConfigurerAdapter`、不存在`springSecurityFilterChain`且是`Servlet`环境时，激活`@EnableWebSecurity`注解。

##### @EnableWebSecurity

 ```java
@Retention(value = java.lang.annotation.RetentionPolicy.RUNTIME)
@Target(value = { java.lang.annotation.ElementType.TYPE })
@Documented
@Import({ WebSecurityConfiguration.class,
		SpringWebMvcImportSelector.class,
		OAuth2ImportSelector.class })
@EnableGlobalAuthentication
@Configuration
public @interface EnableWebSecurity {
	boolean debug() default false;
}
 ```

> `@EnableWebSecurity`注解的核心在于引入`WebSecurityConfiguration`、`SpringWebMvcImportSelector`、`OAuth2ImportSelector`三个类。

- WebSecurityConfiguration

创建`Spring Security`相关的安全过滤器（beanId = `springSecurityFilterChain`）来对用户的请求进行过滤。

- SpringWebMvcImportSelector

当classpath下存在`DispatcherServlet`时注入`WebMvcSecurityConfiguration`类，主要是用于配置`SpringMVC`相关。

- OAuth2ImportSelector

当存在`ClientRegistration`时注入`OAuth2ClientConfiguration`，当存在`ExchangeFilterFunction`时注入`SecurityReactorContextConfiguration`，当存在`BearerTokenError`时注入`SecurityReactorContextConfiguration`。

- @EnableGlobalAuthentication

核心在于构建认证管理器`AuthenticationManager`。

##### SecurityDataConfiguration

自动添加Spring Security与Spring Data的集成。

### SecurityFilterAutoConfiguration

用于自动注入Spring Security的Filter过滤器类。

```java
@Configuration(proxyBeanMethods = false)
@ConditionalOnWebApplication(type = Type.SERVLET)
@EnableConfigurationProperties(SecurityProperties.class)
@ConditionalOnClass({ AbstractSecurityWebApplicationInitializer.class, SessionCreationPolicy.class })
@AutoConfigureAfter(SecurityAutoConfiguration.class)
public class SecurityFilterAutoConfiguration {
    // springSecurityFilterChain
    private static final 
        String DEFAULT_FILTER_NAME = AbstractSecurityWebApplicationInitializer.DEFAULT_FILTER_NAME;

    /**
     * 当IOC容器中存在beanName为springSecurityFilterChain时注入DelegatingFilterProxyRegistrationBean
     */
	@Bean
	@ConditionalOnBean(name = DEFAULT_FILTER_NAME)
	public DelegatingFilterProxyRegistrationBean securityFilterChainRegistration(
			SecurityProperties securityProperties) {
		DelegatingFilterProxyRegistrationBean registration = new DelegatingFilterProxyRegistrationBean(
				DEFAULT_FILTER_NAME);
		registration.setOrder(securityProperties.getFilter().getOrder());
		registration.setDispatcherTypes(getDispatcherTypes(securityProperties));
		return registration;
	}
    // 省略
}
```

> 1. 与上文中的`SecurityAutoConfiguration`分开配置，是为了当存在用户指定的`WebSecurityConfiguration`时仍能指定Order顺序。
> 2. 在`SecurityFilterAutoConfiguration`完成后调用`SecurityAutoConfiguration`配置类。
> 3. IOC容器中存在BeanName为`springSecurityFilterChain`时注入`DelegatingFilterProxyRegistrationBean`，在上文的`@EnableWebSecurity`中的`WebSecurityConfiguration`引入。

#### DelegatingFilterProxyRegistrationBean

```java
public class DelegatingFilterProxyRegistrationBean extends AbstractFilterRegistrationBean<DelegatingFilterProxy>
		implements ApplicationContextAware {
    @Override
	public DelegatingFilterProxy getFilter() {
		return new DelegatingFilterProxy(this.targetBeanName, getWebApplicationContext()) {

			@Override
			protected void initFilterBean() throws ServletException {
				// Don't initialize filter bean on init()
			}

		};
	}
    // 省略
}
```

> 1. 通过`委派模式`将创建`ServletRegistrationBean`的委派类`DelegatingFilterProxyRegistrationBean`用于处理url和servlet的映射关系。
> 2. 将任务委派给名为`springSecurityFilterChain`的servlet代理类`DelegatingFilterProxy`来处理sevlet请求。
> 3. 实际处理servlet的是代理类`DelegatingFilterProxy`的实现类`FilterChainProxy`。

---

## 自定义配置

主要通过继承`WebSecurityConfigurerAdapter`抽象类来实现的。

```java
public class WebSecurityConfig extends WebSecurityConfigurerAdapter {

	@Override
    protected void configure(HttpSecurity http) throws Exception {
        // 用于构建安全过滤器链
    }
	
    @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
        // 处理用户认证相关（UserDetails）
    }

    @Override
    public void configure(WebSecurity web) throws Exception {
        // 配置webSecurity（基于DelegatingFilterProxy管理的springSecurityFilterChain实现）
    }
}
```

### HttpSecurity入门

```java
@Configuration
public class CommonSecurityConfig extends WebSecurityConfigurerAdapter {

    @Resource
    private UserManager userManager;

    @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
        auth.userDetailsService(userManager).passwordEncoder(new BCryptPasswordEncoder());
    }

    @Override
    public void configure(WebSecurity web) throws Exception {
        super.configure(web);
    }

    private static final String LOGIN_PROCESS_URL = "/process";

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.csrf().disable()
                .cors()
                .and()
                .authorizeRequests().anyRequest().authenticated()
                .and()
                .addFilterBefore(new PreLoginFilter(LOGIN_PROCESS_URL, null), UsernamePasswordAuthenticationFilter.class) // 注入filter，进行登录提前校验
                .formLogin()
                .loginProcessingUrl(LOGIN_PROCESS_URL) // 实际向后台提交请求的路径，此后会执行UsernamePasswordAuthenticationFilter类
                // .defaultSuccessUrl("http://www.baidu.com", false) // login页面登录成功后重定向地址（如果是successfulForwardUrl则是转发）
                .successForwardUrl("/login/success")  // 登录成功后转发的路径（可以是接口）
                .failureForwardUrl("/login/failure");  // 登录失败的时候会转发到此路径

    }
}
```

> 1. 一般通过配置HttpSecurity来实现自定义登录或鉴权的配置。
> 2. 注入自定义Filter的核心原理在于登录鉴权相关的逻辑由`UsernamePasswordAuthenticationFilter`处理。

----

## AuthenticationManager源码解析

### UsernamePasswordAuthenticationFilter

结合前文所示，用户的账户和密码认证是由`UsernamePasswordAuthenticationFilter`处理，所以我们以此切入。

```java
public class UsernamePasswordAuthenticationFilter extends
		AbstractAuthenticationProcessingFilter {

	public UsernamePasswordAuthenticationFilter() {
        // 处理/login的POST请求
		super(new AntPathRequestMatcher("/login", "POST"));
	}

    // 执行实际的认证流程
    public Authentication attemptAuthentication(HttpServletRequest request,
			HttpServletResponse response) throws AuthenticationException {
        // 只支持POST请求，对其进行校验
		if (postOnly && !request.getMethod().equals("POST")) {
			throw new AuthenticationServiceException(
					"Authentication method not supported: " + request.getMethod());
		}
        // 通过request.getParameter("username");获取用户名
		String username = obtainUsername(request);
        // 通过request.getParameter("password");获取用户密码
		String password = obtainPassword(request);
        // 判空及去重
		if (username == null) {
			username = "";
		}
		if (password == null) {
			password = "";
		}
		username = username.trim();
        // 将用户密码封装到UsernamePasswordAuthenticationToken中
		UsernamePasswordAuthenticationToken authRequest = new 		
            	UsernamePasswordAuthenticationToken(username, password);
		// 允许子类设置其他参数到认证请求中去
		setDetails(request, authRequest);
        // 调用AuthenticationManager去处理认证请求
		return this.getAuthenticationManager().authenticate(authRequest);
	}
}
```

> 该类的主要作用就是拦截request请求并获取账号和密码，再将其封装到`UsernamePasswordAuthenticationToken`中。再交给`AuthenticationManager`去认证。

### AbstractAuthenticationProcessingFilter

```java
public abstract class AbstractAuthenticationProcessingFilter extends GenericFilterBean
		implements ApplicationEventPublisherAware, MessageSourceAware {
    private AuthenticationSuccessHandler 
        successHandler = new SavedRequestAwareAuthenticationSuccessHandler(); // success处理器
	private AuthenticationFailureHandler 
        failureHandler = new SimpleUrlAuthenticationFailureHandler(); // failure处理器

    // 过滤器的核心方法
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
			throws IOException, ServletException {
		HttpServletRequest request = (HttpServletRequest) req;
		HttpServletResponse response = (HttpServletResponse) res;
		// 判断是否需要鉴权（本质就是判断路径是否匹配），由子类构造中实现的（POST /login请求）
		if (!requiresAuthentication(request, response)) {
			chain.doFilter(request, response);
			return;
		}
		if (logger.isDebugEnabled()) {
			logger.debug("Request is to process authentication");
		}
		// 鉴权校验，实际上调用了子类的attemptAuthentication实现
		Authentication authResult;
		try {
            // 如果返回为空说明子类验证没有完成，立即返回
			authResult = attemptAuthentication(request, response);
			if (authResult == null) {
				return;
			}
            // 处理session策略，此处默认是空实现
			sessionStrategy.onAuthentication(authResult, request, response);
		}
		catch (InternalAuthenticationServiceException failed) {
			logger.error(
					"An internal error occurred while trying to authenticate the user.",
					failed);
            // 失败处理器处理
			unsuccessfulAuthentication(request, response, failed);
			return;
		}
		catch (AuthenticationException failed) {
			// 与上同理
			unsuccessfulAuthentication(request, response, failed);
			return;
		}
		// 是否跳过其他过滤器，默认是跳过的
		if (continueChainBeforeSuccessfulAuthentication) {
			chain.doFilter(request, response);
		}
        // 成功后的处理器处理
		successfulAuthentication(request, response, chain, authResult);
	}
    
}
```

> 1. 是`UsernamePasswordAuthenticationFilter`的父类，默认实现了`Filter`过滤器的核心方法`doFilter`。
> 2. 首先是对请求路径的判断，必须是`POST /login`请求才会拦截。否则直接交由下个过滤器处理。
> 3. 调用子类的`attemptAuthentication`进行认证操作，并设置session相关的策略（默认空实现）。
> 4. 如果发生了异常或校验失败，调用失败处理器。继而判断是否需要跳过后面的过滤器，最终执行成功处理器。

### AuthenticationManager初始化流程🔒

```java
public interface AuthenticationManager {
    Authentication authenticate(Authentication authentication)
			throws AuthenticationException;
}
```

> 认证管理器顶级接口，上文中封装的`UsernamePasswordAuthenticationToken`就会交予`AuthenticationManager`的实现类来处理。如果验证成功就返回`Authentication`对象，否则就抛出异常。

#### 1. SecurityAutoConfiguration

>  请注意：下述的流程展示省略了大部分与`AuthenticationManager`初始化无关的代码！！

```java
// // 通过自动装配注入了`SecurityAutoConfiguration`类，继而注入了`WebSecurityEnablerConfiguration`
@Import({WebSecurityEnablerConfiguration.class})
public class SecurityAutoConfiguration {
}

@EnableWebSecurity
public class WebSecurityEnablerConfiguration {
}

@Import({ WebSecurityConfiguration.class})
@EnableGlobalAuthentication
public @interface EnableWebSecurity {
}
```

> 1. 因为容器中存在`WebSecurityConfigurerAdapter`，所以启用了`@EnableWebSecurity`注解。
> 2. `@EnableWebSecurity`注解的核心在于`@EnableGlobalAuthentication`和`WebSecurityConfiguration`类。

#### 2. WebSecurityConfiguration

```java
@Configuration(proxyBeanMethods = false)
public class WebSecurityConfiguration implements ImportAware, BeanClassLoaderAware {
    
    private WebSecurity webSecurity;
    private List<SecurityConfigurer<Filter, WebSecurity>> webSecurityConfigurers;
    // 此处已经注入了AutowireBeanFactoryObjectPostProcessor
    @Autowired(required = false)
    private ObjectPostProcessor<Object> objectObjectPostProcessor; 
    
    
    @Autowired(required = false)
	public void setFilterChainProxySecurityConfigurer(
        ObjectPostProcessor<Object> objectPostProcessor,
		@Value("#{@autowiredWebSecurityConfigurersIgnoreParents.getWebSecurityConfigurers()}") 			List<SecurityConfigurer<Filter, WebSecurity>> webSecurityConfigurers){ 
        
        webSecurity = objectPostProcessor
				.postProcess(new WebSecurity(objectPostProcessor));
                   for (SecurityConfigurer<Filter, WebSecurity> webSecurityConfigurer : webSecurityConfigurers) {
			webSecurity.apply(webSecurityConfigurer);
		}
		this.webSecurityConfigurers = webSecurityConfigurers;
    }
    
    // 创建beanName为'springSecurityFilterChain'的过滤器链并得到整合后的Filter
    @Bean(name = AbstractSecurityWebApplicationInitializer.DEFAULT_FILTER_NAME)
	public Filter springSecurityFilterChain() throws Exception {
        // webSecurityConfigurers 是用于创建web配置的对象集合
		boolean hasConfigurers = webSecurityConfigurers != null
				&& !webSecurityConfigurers.isEmpty();
		if (!hasConfigurers) {
            // 若没有SecurityConfigurer的实现类（只要继承了WebSecurityConfigurerAdapter就不会为空)
            // 则创建默认的WebSecurityConfigurerAdapter类
			WebSecurityConfigurerAdapter adapter = objectObjectPostProcessor
					.postProcess(new WebSecurityConfigurerAdapter() {
					});
			webSecurity.apply(adapter);
		}
        // 将WebSecurity对象转换为Filter（查看下文）
		return webSecurity.build();
	}
}

// 通过SPEL调用，目的是为了查找容器中所有类型为WebSecurityConfigurer的bean整合成集合                   
final class AutowiredWebSecurityConfigurersIgnoreParents {
    public List<SecurityConfigurer<Filter, WebSecurity>> getWebSecurityConfigurers() {
		List<SecurityConfigurer<Filter, WebSecurity>> webSecurityConfigurers 
            												= new ArrayList<>();
		Map<String, WebSecurityConfigurer> beansOfType = beanFactory
				.getBeansOfType(WebSecurityConfigurer.class);
		for (Entry<String, WebSecurityConfigurer> entry : beansOfType.entrySet()) {
			webSecurityConfigurers.add(entry.getValue());
		}
		return webSecurityConfigurers;
	}
}
```

> 1. 基于`WebSecurityConfiguration`来创建`WebSecurity`对象。并调用`build()`初始化相关类。
> 2. `setFilterChainProxySecurityConfigurer`会将容器内的所有`WebSecurityConfigurer`类型的bean添加到集合中作为参数注入。
> 3. `WebSecurity`处理`Filter过滤器链`相关，`HttpSecurity`处理http请求相关，都实现自`SecurityBuilder`。
> 4. 如果容器中`SecurityConfigurer<Filter, WebSecurity>`的子类、实现类集合为空，那么就会创建默认的`WebSecurityConfigurerAdapter`对象并加入到容器中。

##### 2.1 AbstractSecurityBuilder.build()🔒

```java
public abstract class AbstractSecurityBuilder<O> implements SecurityBuilder<O> {
    
    private AtomicBoolean building = new AtomicBoolean();
	private O object;
    
    public final O build() throws Exception {
        // CAS保证多线程下只能创建一次
		if (this.building.compareAndSet(false, true)) {
			this.object = doBuild();
			return this.object;
		}
		throw new AlreadyBuiltException("This object has already been built");
	}
    // 模板方法,由子类具体实现
    protected abstract O doBuild() throws Exception;
}

public abstract class AbstractConfiguredSecurityBuilder<O, B extends SecurityBuilder<O>>
		extends AbstractSecurityBuilder<O> {
    @Override
	protected final O doBuild() throws Exception {
        // 加锁初始化,BuildState由五种状态
		synchronized (configurers) {
			buildState = BuildState.INITIALIZING;
			beforeInit(); // 钩子函数,初始化前调用,默认空实现
			init();
			buildState = BuildState.CONFIGURING;
			beforeConfigure(); // 钩子函数,配置前调用,默认空实现
			configure();
			buildState = BuildState.BUILDING;
			O result = performBuild();
			buildState = BuildState.BUILT;
			return result;
		}
	}
    private void init() throws Exception {
        // 获取所有security的配置类
		Collection<SecurityConfigurer<O, B>> configurers = getConfigurers();
		// 依次初始化他们
		for (SecurityConfigurer<O, B> configurer : configurers) {
			configurer.init((B) this); // 此处会调用`WebSecurityConfigurerAdapter.init()方法`
		}
		// 所有调用apply的security的配置类在BuildState为INITIALIZING都会加入其中，后续补上初始化
		for (SecurityConfigurer<O, B> configurer : configurersAddedInInitializing) {
			configurer.init((B) this);
		}
	}
    // 模板方法，默认由三个实现：AuthenticationManagerBuilder、HttpSecurity、WebSecurity
    // 分别对应内置鉴权管理器，DefaultSecurityFilterChain、FilterChainProxy相关配置
    protected abstract O performBuild() throws Exception;
}
```

> 1. 核心在于找出所有需要初始化的`SecurityConfigurer`的子类对`SecurityBuilder`的子类进行初始化操作。
> 2. 此处也会调用`WebSecurityConfigurerAdapter.init()`方法。

#### 3.  @EnableGlobalAuthentication🎈

```java
/**
 * 此注解可用于配置`AuthenticationManagerBuilder`实例，而`AuthenticationManagerBuilder`则
 * 用于创建`AuthenticationManager`实例
 */
@Import(AuthenticationConfiguration.class) // 注入AuthenticationConfiguration类
public @interface EnableGlobalAuthentication {
}

@Import(ObjectPostProcessorConfiguration.class) // 注入了ObjectPostProcessorConfiguration类
public class AuthenticationConfiguration {
    
    // 初始化UserDetailsService实现类，若存在多个则不会继续初始化
    // 如果存在一个，那么会创建DaoAuthenticationProvider作为属性注入到AuthenticationManagerBuilder中
    @Bean
	public static InitializeUserDetailsBeanManagerConfigurer 		
        	initializeUserDetailsBeanManagerConfigurer(ApplicationContext context) {
		return new InitializeUserDetailsBeanManagerConfigurer(context);
	}

    // 尝试从IOC容器中获取AuthenticationProvider对象并设置到AuthenticationManagerBuilder中，
    // 如果存在就不设置。
	@Bean
	public static InitializeAuthenticationProviderBeanManagerConfigurer 
        	initializeAuthenticationProviderBeanManagerConfigurer(ApplicationContext context) {
		return new InitializeAuthenticationProviderBeanManagerConfigurer(context);
	}
}
```

> 1. `@EnableGlobalAuthentication`的核心就是对`AuthenticationConfiguration`和`ObjectPostProcessorConfiguration`的注入。
> 2. `AuthenticationConfiguration`中的两个Bean的注入只有没有子类复写`configure(AuthenticationManagerBuilder auth)`方法时才会初始化(init()方法)。

##### 3.1 ObjectPostProcessorConfiguration

```java
@Configuration(proxyBeanMethods = false)
@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
public class ObjectPostProcessorConfiguration {

	@Bean
	@Role(BeanDefinition.ROLE_INFRASTRUCTURE)
	public ObjectPostProcessor<Object> objectPostProcessor(
			AutowireCapableBeanFactory beanFactory) {
        // 创建默认的ObjectPostProcessor实现类注入到容器中
		return new AutowireBeanFactoryObjectPostProcessor(beanFactory);
	}
}

// 顶级接口
public interface ObjectPostProcessor<T> {
	<O extends T> O postProcess(O object);
}

final class AutowireBeanFactoryObjectPostProcessor
		implements ObjectPostProcessor<Object>, DisposableBean, SmartInitializingSingleton {
    
    // 将bean注入到容器的核心方法
    public <T> T postProcess(T object) {
		if (object == null) {
			return null;
		}
		T result = null;
		try {
            // 初始化bean
			result = (T) this.autowireBeanFactory
                			.initializeBean(object,object.toString());
		} catch (RuntimeException e) {
			// 省略
		}
        // 自动注入
		this.autowireBeanFactory.autowireBean(object);
		// 省略
		return result;
	}
}
```

> 1.  此类是通过`AuthenticationConfiguration`注入的，此处涉及一个概念：`ObjectPostProcessor`。
> 2.  `ObjectPostProcessor`可以通过`new`创建的对象交由`IOC容器`进行管理。
> 3.  `ObjectPostProcessorConfiguration`默认注入了`ObjectPostProcessor`的实现类`AutowireBeanFactoryObjectPostProcessor`到容器中。核心就是`初始化Bean`并自动注入。
> 4.  使用`ObjectPostProcessor`的目的是为了解决`因为便于管理大量对象，没有暴露这些对象的属性，但是需要手动注册bean到容器中`的问题，注入到容器中的bean我们可以对其进行管理、修改或增强。

##### 3.2 AuthenticationConfiguration🔒

```java
@Configuration(proxyBeanMethods = false)
@Import(ObjectPostProcessorConfiguration.class) // 上文已解析
public class AuthenticationConfiguration {
    // IOC容器上下文，BeanFactory的实现
    private ApplicationContext applicationContext;
    // 此处涉及authenticationManager注入
	private AuthenticationManager authenticationManager;
    // 默认false，用于判断authenticationManager是否已经初始化
	private boolean authenticationManagerInitialized;
    // 用于注入bean到容器中
    private ObjectPostProcessor<Object> objectPostProcessor; 
    
    @Bean
	public AuthenticationManagerBuilder authenticationManagerBuilder(
			ObjectPostProcessor<Object> objectPostProcessor, ApplicationContext context) {
        // 创建默认的解码器（上文有解析过，此处使用了静态工厂创建解码器）
		LazyPasswordEncoder defaultPasswordEncoder = new LazyPasswordEncoder(context);
		AuthenticationEventPublisher authenticationEventPublisher = 
            				getBeanOrNull(context, AuthenticationEventPublisher.class);
		// 创建默认的AuthenticationManagerBuilder，用于构建AuthenticationManager
        // 此处传入了上文的默认解码器，以及AutowireBeanFactoryObjectPostProcessor
		DefaultPasswordEncoderAuthenticationManagerBuilder result = 
            new DefaultPasswordEncoderAuthenticationManagerBuilder(
            								objectPostProcessor, defaultPasswordEncoder);
		if (authenticationEventPublisher != null) {
			result.authenticationEventPublisher(authenticationEventPublisher);
		}
		return result;
	}
    
    // WebSecurityConfigurerAdapter中通过AuthenticationConfiguration调用
    public AuthenticationManager getAuthenticationManager() throws Exception {
        // 如果已经初始化那么直接返回authenticationManager
		if (this.authenticationManagerInitialized) {
			return this.authenticationManager;
		}
        // 判断容器中是否存在AuthenticationManagerBuilder（AuthenticationManager的构造器）
		AuthenticationManagerBuilder authBuilder =
            this.applicationContext.getBean(AuthenticationManagerBuilder.class);
        // CAS保证线程安全，调用委派模式通过AuthenticationManagerBuilder创建AuthenticationManager
		if (this.buildingAuthenticationManager.getAndSet(true)) {
			return new AuthenticationManagerDelegator(authBuilder);
		}
		// 判断是否存在全局配置类（即继承GlobalAuthenticationConfigurerAdapter的类）
		for (GlobalAuthenticationConfigurerAdapter config : globalAuthConfigurers) {
			authBuilder.apply(config);
		}
		// 委派模式分配的类用于构建AuthenticationManager
		authenticationManager = authBuilder.build();
		// 若没有符合条件的委托类进行鉴权操作，那么就创建
		if (authenticationManager == null) {
            // 此处的authenticationManager还是可以为null的
			authenticationManager = getAuthenticationManagerBean();
		}
		// 标记为已创建AuthenticationManager并返回
		this.authenticationManagerInitialized = true;
		return authenticationManager;
	}
    
    static final class AuthenticationManagerDelegator implements AuthenticationManager {
		private AuthenticationManagerBuilder delegateBuilder;
		private AuthenticationManager delegate;
		private final Object delegateMonitor = new Object();

		AuthenticationManagerDelegator(AuthenticationManagerBuilder delegateBuilder) {
			Assert.notNull(delegateBuilder, "delegateBuilder cannot be null");
			this.delegateBuilder = delegateBuilder;
		}

		@Override
		public Authentication authenticate(Authentication authentication)
				throws AuthenticationException {
            // 如果AuthenticationManager不为null直接调用
			if (this.delegate != null) {
				return this.delegate.authenticate(authentication);
			}
			// 否则加锁并创建AuthenticationManager
			synchronized (this.delegateMonitor) {
				if (this.delegate == null) {
					this.delegate = this.delegateBuilder.getObject();
					this.delegateBuilder = null;
				}
			}
			// 最终调用AuthenticationManager.authenticate()
			return this.delegate.authenticate(authentication);
		}
    
    private AuthenticationManager getAuthenticationManagerBean() {
		return lazyBean(AuthenticationManager.class);
	}
    // 此步是用于创建AuthenticationManager并加入到容器中进行管理
    private <T> T lazyBean(Class<T> interfaceName) {
        // 获取BeanFactory的单例Bean
		LazyInitTargetSource lazyTargetSource = new LazyInitTargetSource();
        // 从容器中通过类型获取bean对象集合
		String[] beanNamesForType = BeanFactoryUtils.beanNamesForTypeIncludingAncestors(
				applicationContext, interfaceName);
		if (beanNamesForType.length == 0) {
			return null;
		}
		String beanName;
		if (beanNamesForType.length > 1) {
            // 存在相同类型的多个bean，判断是否有@Primary注解修饰的bean，若有则返回，否则报错
			List<String> primaryBeanNames = getPrimaryBeanNames(beanNamesForType);
			// 如果不存在或数量不等于1，就抛出异常
			Assert.isTrue(primaryBeanNames.size() != 0, () -> "Found " + beanNamesForType.length
					+ " beans for type " + interfaceName + ", but none marked as primary");
			Assert.isTrue(primaryBeanNames.size() == 1, () -> "Found " + primaryBeanNames.size()
					+ " beans for type " + interfaceName + " marked as primary");
			beanName = primaryBeanNames.get(0);
		} else {
            // 否则直接返回第一个
			beanName = beanNamesForType[0];
		}
		// 设置beanFactory相关参数
		lazyTargetSource.setTargetBeanName(beanName);
		lazyTargetSource.setBeanFactory(applicationContext);
        // 创建代理工厂并调用postProcess将new的对象加入容器中
		ProxyFactoryBean proxyFactory = new ProxyFactoryBean();
		proxyFactory = objectPostProcessor.postProcess(proxyFactory);
		proxyFactory.setTargetSource(lazyTargetSource);
        // 返回容器中的符合条件的对象(即AuthenticationManager对象)
		return (T) proxyFactory.getObject();
	}
}
```

> 1. `AuthenticationConfiguration`提供了默认解码器和基于默认解码器的鉴权管理构造器。
> 2. 提供了`getAuthenticationManager()`用于返回容器中的`AuthenticationManager`对象。
> 3. 尝试通过获取容器中的`AuthenticationManagerBuilder`并调用委派模式、建造者模式来创建`AuthenticationManager`。
> 4. 如果仍没有，么会基于类型在容器中进行查找（找不到或多个会抛出异常），然后进行鉴权，如果成功返回`Authentication`，否则抛出异常。

#### 4. WebSecurityConfigurerAdapter

```java
public abstract class WebSecurityConfigurerAdapter implements
		WebSecurityConfigurer<WebSecurity> {
    private boolean disableLocalConfigureAuthenticationBldr;
    private boolean disableDefaults; // 初始化是否需要默认配置
    private AuthenticationManager authenticationManager;
    private HttpSecurity http;
    private AuthenticationManagerBuilder localConfigureAuthenticationBldr;
    
    // 自动注入容器中的AuthenticationConfiguration，上文已经解析过
    @Autowired
	public void setAuthenticationConfiguration(
			AuthenticationConfiguration authenticationConfiguration) {
		this.authenticationConfiguration = authenticationConfiguration;
	}
    // 配置鉴权管理器构造器
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
        // 当有子类复写该方法时（不调用super.configure）就不会将参数改为true
		this.disableLocalConfigureAuthenticationBldr = true;
	}
    
    // 初始化WebSecurity相关属性
    public void init(final WebSecurity web) throws Exception {
        // 首先获取HttpSecurity属性
		final HttpSecurity http = getHttp();
        // 省略
	}
    
    protected final HttpSecurity getHttp() throws Exception {
		if (http != null) {
			return http;
		}
		// 省略
        // 核心！！！！！ 获取容器中的authenticationManager或子类创建的
		AuthenticationManager authenticationManager = authenticationManager();
        // 设置为parent属性，在AuthenticationManagerBuilder中作为参数来创建ProviderManager
        // 因为用户可以指定多个自己的AuthenticationProvider
        // 在自定义AuthenticationProvider不存在时会继续往上查找parent的AuthenticationManager对象。
        authenticationBuilder.parentAuthenticationManager(authenticationManager);
        // 设置HttpSecurity创建的必要共享参数（上下文之类的）
		Map<Class<?>, Object> sharedObjects = createSharedObjects();
        // 创建HttpSecurity对象并加入容器中
		http = new HttpSecurity(objectPostProcessor, authenticationBuilder,
				sharedObjects);
        // 默认disableDefaults为false，除非显示的在构造中指定为true
		if (!disableDefaults) {
			// 设置默认的参数给httpSecurity
			http
				.csrf().and()
				.addFilter(new WebAsyncManagerIntegrationFilter())
				.exceptionHandling().and()
				.headers().and()
				.sessionManagement().and()
				.securityContext().and()
				.requestCache().and()
				.anonymous().and()
				.servletApi().and()
				.apply(new DefaultLoginPageConfigurer<>()).and()
				.logout();
			// 通过SPI获取AbstractHttpConfigurer对象的集合
			ClassLoader classLoader = this.context.getClassLoader();
			List<AbstractHttpConfigurer> defaultHttpConfigurers =
					SpringFactoriesLoader.loadFactories(AbstractHttpConfigurer.class, classLoader);
			// 将其他的security配置类的子类都进行初始化操作
			for (AbstractHttpConfigurer configurer : defaultHttpConfigurers) {
				http.apply(configurer);
			}
		}
        // 如果子类实现了该方法就使用子类的，否则就是父类默认的httpSecurity相关配置
		configure(http);
		return http;
	}
    
    // 核心：获取AuthenticationManager来使用
    protected AuthenticationManager authenticationManager() throws Exception {
        // AuthenticationManager是否已经初始化，第一次都是没有初始化
		if (!authenticationManagerInitialized) {
            // 查看子类是否复写configure()来配置鉴权管理构造器
			configure(localConfigureAuthenticationBldr);
            // true则获取之前AuthenticationConfiguration中创建的AuthenticationManager
			if (disableLocalConfigureAuthenticationBldr) {
				authenticationManager = authenticationConfiguration
						.getAuthenticationManager();
			}
			else {
                // 否则基于子类的实现构建新的security配置类
				authenticationManager = localConfigureAuthenticationBldr.build();
			}
            // 设置初始化标识
			authenticationManagerInitialized = true;
		}
		return authenticationManager;
	}
    
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
		this.disableLocalConfigureAuthenticationBldr = true;
	}
}
```

> 1. 由`WebSecurityConfiguration`中注入的bean`springSecurityFilterChain`触发了`WebSecurityConfigurerAdapter`中的`init`初始化操作。
>
> 2. `init()`会获取容器中的`AuthenticationManager`，触发`HttpSecurity`的初始化工作，并设置默认的`HttpSecurity`参数。
>
> 3. 最终`AuthenticationManager`对象作为``parentAuthenticationManager`属性被用于`ProviderManager`创建，并注入到容器中。
>
> 4. 和`ProviderManager`流程类似，`WebSecurity`和`HttpSecurity`也是被设置属性参数后通过`FilterChainProxy`构建成Filter过滤器注入到容器中。

#### 5. ProvideManager

此处主要解释`ProvideManager`、`AuthenticationManager`、`AuthenticationProvider`三者之间的联系。

```java
public interface AuthenticationManager {
    Authentication authenticate(Authentication authentication) throws AuthenticationException;
}

public interface AuthenticationProvider {
    Authentication authenticate(Authentication authentication) throws AuthenticationException;
    // 根据不同角度进行判断（适配器模式）
    boolean supports(Class<?> authentication);
}

public class ProviderManager implements AuthenticationManager, MessageSourceAware,
		InitializingBean {
    // 持有AuthenticationProvider实现类集合的引用
	private List<AuthenticationProvider> providers = Collections.emptyList();
    // 会被
    public Authentication authenticate(Authentication authentication)
												throws AuthenticationException {
		// 注意此处是两个result，分别对应AuthenticationProvider实现类和AuthenticationManager实现类
		Authentication result = null;
		Authentication parentResult = null;
		// 依次调用AuthenticationProvider实现类
		for (AuthenticationProvider provider : getProviders()) {
            // 如果support为false那么就跳过此次验证
			if (!provider.supports(toTest)) {
				continue;
			}
			try {
                // 进行验证，如果验证成功（返回Authentication不为null），则不需要继续鉴权
				result = provider.authenticate(authentication);
				if (result != null) {
                    // 结果不为空（成功）则保存detail(ip地址，证书之类的)
					copyDetails(authentication, result);
					break;
				}
			}
			// 省略
		}
		// 如果结果为null（即没有鉴权成功）
		if (result == null && parent != null) {
			// 尝试调用AuthenticationManager的实现类进行鉴权，并将结果赋予result
			try {
				result = parentResult = parent.authenticate(authentication);
			}
			// 省略
		}
		// 省略
	}
}

```

![](https://image.leejay.top/FvU2DWc-HPFITz_0jZCnzyqerxFO)

> 1. `ProviderManager`是`AuthenticationManager`的实现类，持有`AuthenticationProvider`集合的引用。
>
> 2. 容器中可以存在多个`AuthenticationProvider`的实现类和一个`AuthenticationManager`实现类。
>
>    ```java
>    @Override
>    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
>        // 可以配置多个AuthenticationProvider的实现类
>        // 但是建议一个UserDetailService对应一个AuthenticationProvider
>        auth.authenticationProvider()
>            .authenticationProvider()
>            .userDetailsService(userManager)
>            .passwordEncoder(new BCryptPasswordEncoder());
>    }
>    ```
>
> 3. `ProviderManager`在鉴权是会先尝试调用用户指定的单个或多个`AuthenticationProvider（没有就跳过）`，然后尝试执行`AuthenticationManager`的实现类进行鉴权。

#### 6. 流程图总结

<iframe id="embed_dom" name="embed_dom" frameborder="0" style="height:400px;" src="https://www.processon.com/embed/60498ba67d9c08214c661ec2"></iframe>

> 直接点击链接在线访问<a href="https://www.processon.com/view/link/6049dcdbe401fd39d60176e1">Spring Security源码解析</a>

## Filter

### Spring Security内置过滤器

SpringSecurity中内置了一些Filter过滤器，可以通过`HttpSecurity`进行内置和自定义过滤器配置。

#### Filter执行顺序

##### FilterComparator

```java
final class FilterComparator implements Comparator<Filter>, Serializable {
    FilterComparator() {
        // 从100开始，依次叠加100，数组越小越靠前
		Step order = new Step(INITIAL_ORDER, ORDER_STEP);
		put(ChannelProcessingFilter.class, order.next()); // 100
		put(ConcurrentSessionFilter.class, order.next()); // 200
		put(WebAsyncManagerIntegrationFilter.class, order.next()); // 300
		put(SecurityContextPersistenceFilter.class, order.next());
		put(HeaderWriterFilter.class, order.next());
		put(CorsFilter.class, order.next());
		put(CsrfFilter.class, order.next());
		put(LogoutFilter.class, order.next());
		filterToOrder.put(
"org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestRedirectFilter",
				order.next());
		filterToOrder.put(		"org.springframework.security.saml2.provider.service.servlet.filter.Saml2WebSsoAuthenticationRequestFilter",
				order.next());
		put(X509AuthenticationFilter.class, order.next());
		put(AbstractPreAuthenticatedProcessingFilter.class, order.next());
		filterToOrder.put("org.springframework.security.cas.web.CasAuthenticationFilter",
				order.next());
		filterToOrder.put(
			"org.springframework.security.oauth2.client.web.OAuth2LoginAuthenticationFilter",
				order.next());
		filterToOrder.put(		"org.springframework.security.saml2.provider.service.servlet.filter.Saml2WebSsoAuthenticationFilter",
				order.next());
		put(UsernamePasswordAuthenticationFilter.class, order.next());
		put(ConcurrentSessionFilter.class, order.next());
		filterToOrder.put(
				"org.springframework.security.openid.OpenIDAuthenticationFilter", order.next());
		put(DefaultLoginPageGeneratingFilter.class, order.next());
		put(DefaultLogoutPageGeneratingFilter.class, order.next());
		put(ConcurrentSessionFilter.class, order.next());
		put(DigestAuthenticationFilter.class, order.next());
		filterToOrder.put(			"org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationFilter", order.next());
		put(BasicAuthenticationFilter.class, order.next());
		put(RequestCacheAwareFilter.class, order.next());
		put(SecurityContextHolderAwareRequestFilter.class, order.next());
		put(JaasApiIntegrationFilter.class, order.next());
		put(RememberMeAuthenticationFilter.class, order.next());
		put(AnonymousAuthenticationFilter.class, order.next());
		filterToOrder.put(
			"org.springframework.security.oauth2.client.web.OAuth2AuthorizationCodeGrantFilter",
				order.next());
		put(SessionManagementFilter.class, order.next());
		put(ExceptionTranslationFilter.class, order.next());
		put(FilterSecurityInterceptor.class, order.next());
		put(SwitchUserFilter.class, order.next());
	}
    // 通过class名称去map中查找，找不到就去找父类的，还是找不到就返回null
    private Integer getOrder(Class<?> clazz) {
		while (clazz != null) {
			Integer result = filterToOrder.get(clazz.getName());
			if (result != null) {
				return result;
			}
			clazz = clazz.getSuperclass();
		}
		return null;
	}
    // 判断map中是否已存在该名字的过滤器。
    public boolean isRegistered(Class<? extends Filter> filter) {
		return getOrder(filter) != null;
	}
}
```

> 1. 将一些过滤器按照指定顺序排列，从100开始依次叠加100，数值越小越靠前。
> 2. 通过类名在map中查找并进行找到，判断和比较。

##### HttpSecurity

```java
public final class HttpSecurity extends
		AbstractConfiguredSecurityBuilder<DefaultSecurityFilterChain, HttpSecurity>
		implements SecurityBuilder<DefaultSecurityFilterChain>,
		HttpSecurityBuilder<HttpSecurity> {
	private FilterComparator comparator = new FilterComparator();
    
	// 添加过滤器到map中
	public HttpSecurity addFilter(Filter filter) {
		Class<? extends Filter> filterClass = filter.getClass();
		if (!comparator.isRegistered(filterClass)) {
			throw new IllegalArgumentException(
					"The Filter class "
							+ filterClass.getName()
							+ " does not have a registered order and cannot be added without a specified order. Consider using addFilterBefore or addFilterAfter instead.");
		}
		this.filters.add(filter);
		return this;
	}
	// 将新增过滤器放到指定过滤器之前执行
	public HttpSecurity addFilterBefore(Filter filter,
			Class<? extends Filter> beforeFilter) {
		comparator.registerBefore(filter.getClass(), beforeFilter);
		return addFilter(filter);
	}

    // 将新增的过滤器放到指定的过滤器位置（即order值相同）
	public HttpSecurity addFilterAt(Filter filter, Class<? extends Filter> atFilter) {
		this.comparator.registerAt(filter.getClass(), atFilter);
		return addFilter(filter);
	}
	
    // 将新增的过滤器放到指定过滤器后面
	public HttpSecurity addFilterAfter(Filter filter, Class<? extends Filter> afterFilter) {
		comparator.registerAfter(filter.getClass(), afterFilter);
		return addFilter(filter);
	}
}
```

#### 内置过滤器

| 过滤器                                        | 作用                                                         |
| --------------------------------------------- | ------------------------------------------------------------ |
| ChannelProcessingFilter                       | 过滤哪些请求需要使用https还是http协议                        |
| ConcurrentSessionFilter                       | 判断session是否过期及更新最新的访问时间                      |
| WebAsyncManagerIntegrationFilter              | 用于集成SecurityContext到Spring异步执行机制中的 WebAsyncManager。 |
| SecurityContextPersistenceFilter              | 控制SecurityContext生命周期，请求来时创建，结束时清空        |
| HeaderWriterFilter                            | 给http请求添加header                                         |
| CorsFilter                                    | 针对cors跨域进行的设置                                       |
| CsrfFilter                                    | 用于防止csrf跨站攻击                                         |
| LogoutFilter                                  | 处理注销的过滤器                                             |
| X509AuthenticationFilte                       | X509认证过滤器                                               |
| AbstractPreAuthenticatedProcessingFilter      | 主要用于身份的提取而不是验证                                 |
| CasAuthenticationFilter                       | CAS单点登录模块，依赖于Spring Security CAS模块               |
| <b>`UsernamePasswordAuthenticationFilter`</b> | 处理用户及密码认证的核心过滤器                               |
| DefaultLoginPageGeneratingFilter              | 生成默认的登陆页面/login                                     |
| DefaultLogoutPageGeneratingFilter             | 生成默认的登出页/logout                                      |
| BasicAuthenticationFilter                     | 负责http头中显示的基本身份验证凭据，默认启用                 |
| RequestCacheAwareFilter                       | 用于处理因登录打断原有请求，继而登陆后自动跳转的功能。       |
| RememberMeAuthenticationFilter                | 处理记住我功能的过滤器                                       |
| AnonymousAuthenticationFilter                 | 对于无需登录直接访问的资源会授予其匿名用户身份               |
| SessionManagementFilter                       | session管理器                                                |
| FilterSecurityInterceptor                     | 决定了访问特定路径应该具备的权限（动态权限控制必备）         |

### Spring Security过滤器链

在Spring Security Filter中是通过`FilterChainProxy`来管理多个代理不同路径的`SecurityFilterChain`过滤器链，同时`FilterChainProxy`是通过`DelegatingFilterProxy`加入到过滤器链中的一部分。如下图所示：

![](https://image.leejay.top/Fn262VRuzsxESP1x-K4XBoie2rsC)

```java
public interface SecurityFilterChain {
	boolean matches(HttpServletRequest request);
    // 路径对应的过滤器链
	List<Filter> getFilters();
}

// 默认实现
public final class DefaultSecurityFilterChain implements SecurityFilterChain {
}

// WebSecurity.performBuild()会将SecurityFilterChain的实现类作为参数构建为FilterChainProxy
// FilterChainProxy是一个过滤器链，也是一个过滤器
public class FilterChainProxy extends GenericFilterBean {
    private List<SecurityFilterChain> filterChains;
    public FilterChainProxy(SecurityFilterChain chain) {
		this(Arrays.asList(chain));
	}
}
// 用于代理一个标准的Servlet Filter 用于集成到IOC的管理
public class DelegatingFilterProxy extends GenericFilterBean {
}

// 为了在Sevlet Filter中注入Spring Bean的特性而出现的
public abstract class GenericFilterBean implements Filter, BeanNameAware, EnvironmentAware,
		EnvironmentCapable, ServletContextAware, InitializingBean, DisposableBean {
}
```

> 1. `SecurityFilterChain`作为构建`FilterChainProxy`的参数来构建过滤器链。
> 2. `FilterChainProxy`默认实现`DefaultSecurityFilterChain`一般由`HttpSecurity`创建。
> 3. `FilterChainProxy`既是过滤器链也是过滤器。
> 4. `DelegatingFilterProxy`可以代理一个`Servlet Filter`，将其继承到Spring Bean中去。

---

## JWT(Json Web Token)

`JOSE`是一种旨在提供在各方之间安全传递声明（claims）的方法的规范集。包含如下规范：

- `JWS（RFC 7515） -JSON Web签名`，描述生成和处理签名消息。
- `JWE（RFC 7516） -JSON Web加密`，描述了保护和处理加密 消息。
- JWK（RFC 7517） -JSON Web密钥，描述 Javascript 对象签名和加密中加密密钥的 格式和处理。
- JWA（RFC 7518） -JSON Web算法，描述了 Javascript 对象签名和加密中使用的 加密 算法。
- `JWT（RFC 7519） -JSON Web令牌`，描述以 JSON 编码并由 JWS 或 JWE 保护的声明的表示形式。

> `JWT`又包含`JWS`和`JWE`，一般使用的都是基于`JWS`方式，`JWE`方法更加安全，但是也更复杂。

---

## RBAC

主要包含三个概念，分别是`用户`、`角色`和`权限`。

- 用户

不局限于单个用户，可以是一个用户组，也可以是一个部门，只要有访问资源需求的都可以作为用户。

- 角色

角色是特定权限的集合。角色是可以`继承与分组`的，一个角色可以属于多个用户，一个用户可以拥有多个角色。

- 权限

粒度最小的权限单位。一般体现在接口的控制上，同一个权限可以属于不同的角色。

### 基于配置的权限

```java
http.authorizeRequests()
    // 要求/admin/**路径的请求必须有ADMIN和USER权限
    .antMatchers("/admin/**").access("hasAuthority('ADMIN') and hasAuthority('USER')") 
    // 只要用户有ADMIN，USER其中一个权限即可
    .antMatchers("/admin/**").access("hasAnyAuthority('ADMIN'，'USER')")
    // 要求/super/**路径必须有SUPER_ADMIN权限
	.antMatchers("/super/**").access("hasAuthority('SUPER_ADMIN')")
    // /hello路径需要由ROLE_USER的角色
    .antMatchers("/hello").access("hasRole('USER')")
    // /test是否放行由RbacService.checkPermission()返回值决定
    .antMatchers("/test").access("@rbacService.checkPermission()")
    .antMatchers("/api/**").anonymous() // 可以匿名用户登录
    .antMatchers("/**").authenticated() // 所有用户都可以访问不需要鉴权
    .antMatchers("/a/**").permitAll() // 开放请求

    
@Service
public class RbacService {
    public boolean checkPermission() {
        return System.currentTimeMillis() % 2 == 0;
    }
}

```

> 1. `hasRole`和`hasAuthority`的区别：前者会给角色添加`ROLE_`前缀，后者不会。
> 2. `hasAnyRole`和`hasAnyAuthority`表明只要用户有其中一种权限就可以登录。
> 3. `anonymous()`表明用户不需要登录也可以访问，此用户默认拥有`ROLE_ANONYMOUS`权限。
> 4. `PermitAll()`表明任何用户（匿名和非匿名）都能登录，`anonymous()`表明只有匿名用户（已登录用户不能登录）才能登录。

### 基于注解的权限

#### 启动全局权限注解

```java
@Retention(value = java.lang.annotation.RetentionPolicy.RUNTIME)
@Target(value = { java.lang.annotation.ElementType.TYPE })
@Documented
@Import({ GlobalMethodSecuritySelector.class })
@EnableGlobalAuthentication
@Configuration
public @interface EnableGlobalMethodSecurity {
    // 基于表达式进行方法访问控制
	boolean prePostEnabled() default false;
    // 开启@Secured注解
	boolean securedEnabled() default false;
	// 开启JSR-250注解
	boolean jsr250Enabled() default false;
	boolean proxyTargetClass() default false;
	AdviceMode mode() default AdviceMode.PROXY;
	int order() default Ordered.LOWEST_PRECEDENCE;
}
```

> 1. 注解的三种方式要选择一种开启。
> 2. `EnableGlobalMethodSecurity`核心配置类是`GlobalMethodSecurityConfiguration`

#### @PreAuthorize

```java
@PreAuthorize("hasAuthority('QUERY')")
```

> 此方法要求用户具有`QUERY`权限才能访问，即使配置文件中没有对此路径的访问有权限要求。

#### @PostAuthorize

```java
@PostAuthorize("returnObject.name == 'test'")
```

> 判断当前返回的用户名是否为test，只有条件满足才会返回，否则抛出异常。

#### @PreFilter

```java
@PreFilter(filterTarget = "ids", value = "filterObject%2==0")
public void delete(List<Integer> ids) {
    // 只保留偶数的id
    Stream.of(ids).forEach(System.out::println);
}
```

> 将传入的参数按照条件进行过滤

#### @PostFilter

```java
@PostFilter("filterObject.name == authentication.name")
public List<Person> findOne() {
    List<Person> persons = new ArrayList<>();
    persons.add(new Person("zhangsan"));
    persons.add(new Person("admin"));
    return persons;
}
```

> 只能返回name与当前登录用户名一致的数据。

---

## SecurityContext安全上下文

与`当前线程`绑定的安全上下文。可以获取用户的相关信息。我们通过

```java
User user = (User)SecurityContextHolder.getContext().getAuthentication().getPrincipal();
```

来获取当前登录用户（匿名用户就是`anonymousUser`字符串）的相关信息。

```java
public interface SecurityContext extends Serializable {
    // 获取当前的认证信息，有可能为null
    Authentication getAuthentication();
    // 用于修改或删除当前的认证信息
	void setAuthentication(Authentication authentication);
}
// 安全上下文holder持有安全上下文的引用
public interface SecurityContextHolderStrategy {
	void clearContext();
	SecurityContext getContext();
	void setContext(SecurityContext context);
	SecurityContext createEmptyContext();
}
```

### SecurityContextHolder源码解析

```java
public class SecurityContextHolder {
    // 上下文策略类
    private static SecurityContextHolderStrategy strategy;
    public static final String SYSTEM_PROPERTY = "spring.security.strategy";
    // 获取系统变量
	private static String strategyName = System.getProperty(SYSTEM_PROPERTY);
    // 类加载时被初始化
    static {
		initialize();
	}
    
    private static void initialize() {
        // 判断当前的安全上下文的实现类
		if (!StringUtils.hasText(strategyName)) {
			strategyName = MODE_THREADLOCAL; // 没设置就采用此默认的
		}
		if (strategyName.equals(MODE_THREADLOCAL)) {
			strategy = new ThreadLocalSecurityContextHolderStrategy();
		}
		// 省略
		else {
			// 加载自定义的安全上下文实现类
			try {
				Class<?> clazz = Class.forName(strategyName);
				Constructor<?> customStrategy = clazz.getConstructor();
				strategy = (SecurityContextHolderStrategy) customStrategy.newInstance();
			}
			catch (Exception ex) {
				ReflectionUtils.handleReflectionException(ex);
			}
		}
		// 打印日志用
		initializeCount++;
	}
}
```

### ThreadLocalSecurityContextHolderStrategy

```java
// 默认的实现类，基于ThreadLocal实现线程隔离，不清楚可以查看ThreadLocal源码
// 详见：https://leejay.top/post/threadlocal%E5%86%85%E5%AD%98%E6%B3%84%E6%BC%8F/
final class ThreadLocalSecurityContextHolderStrategy implements SecurityContextHolderStrategy {
	private static final ThreadLocal<SecurityContext> contextHolder = new ThreadLocal<>();
    
	public void clearContext() {
		contextHolder.remove();
	}

	public SecurityContext getContext() {
		SecurityContext ctx = contextHolder.get();
         
		if (ctx == null) {
			ctx = createEmptyContext();
			contextHolder.set(ctx);
		}

		return ctx;
	}

	public void setContext(SecurityContext context) {
		Assert.notNull(context, "Only non-null SecurityContext instances are permitted");
		contextHolder.set(context);
	}

	public SecurityContext createEmptyContext() {
		return new SecurityContextImpl(); // 调用SecurityContext默认实现类设置权限相关
	}
}
```

### SecurityContextImpl

```java
public class SecurityContextImpl implements SecurityContext {
    private Authentication authentication;

	public SecurityContextImpl() {}

	public SecurityContextImpl(Authentication authentication) {
		this.authentication = authentication;
	}
    @Override
	public void setAuthentication(Authentication authentication) {
		this.authentication = authentication;
	}
}
```

> 在Filter过滤器处理中会设置`Authentication`到`SecurityContextImpl`中。

---

## 动态权限

`FilterSecurityInterceptor `负责Spring Security中的权限控制。

```java
public class FilterSecurityInterceptor extends AbstractSecurityInterceptor implements
		Filter {
    private FilterInvocationSecurityMetadataSource securityMetadataSource;

    public void doFilter(ServletRequest request, ServletResponse response,
			FilterChain chain) throws IOException, ServletException {
        // 将当前的请求响应及过滤器链构建成FilterInvocation（即与Http相关连的对象）
		FilterInvocation fi = new FilterInvocation(request, response, chain);
		invoke(fi);
	}
    
    public void invoke(FilterInvocation fi) throws IOException, ServletException {
        // 判断是否有标记
		if ((fi.getRequest() != null)
				&& (fi.getRequest().getAttribute(FILTER_APPLIED) != null)
				&& observeOncePerRequest) {
			fi.getChain().doFilter(fi.getRequest(), fi.getResponse());
		}
		else {
			// 给请求加标记
			if (fi.getRequest() != null && observeOncePerRequest) {
				fi.getRequest().setAttribute(FILTER_APPLIED, Boolean.TRUE);
			}
            // 核心代码
			InterceptorStatusToken token = super.beforeInvocation(fi);

			try {
				fi.getChain().doFilter(fi.getRequest(), fi.getResponse());
			}
			finally {
				super.finallyInvocation(token);
			}

			super.afterInvocation(token, null);
		}
	}
}
public abstract class AbstractSecurityInterceptor implements InitializingBean,
		ApplicationEventPublisherAware, MessageSourceAware {
}
protected InterceptorStatusToken beforeInvocation(Object object) {
		// 获取当前url对应的权限
		Collection<ConfigAttribute> attributes = this.obtainSecurityMetadataSource()
				.getAttributes(object);
		// 省略
		// 重要！
		try {
            // 对当前用户的权限和需要的权限进行投票
			this.accessDecisionManager.decide(authenticated, object, attributes);
		}
		catch (AccessDeniedException accessDeniedException) {
			throw accessDeniedException;
		}
		// 省略
	}
```

> 1. 通过创建`FilterInvocationSecurityMetadataSource`实现类指定当前url的权限是什么。
> 2. 通过创建`AccessDecisionManager`的实现类指定决策管理器策略。

### 安全权限数据源

#### 自定义权限数据源

```java
public class UrlFilterInvocationSecurityMetadataSource implements FilterInvocationSecurityMetadataSource {

    @Override
    public Collection<ConfigAttribute> getAttributes(Object object) 
        								throws IllegalArgumentException {
        // FilterInvocation是与http对象相关联
        FilterInvocation f = (FilterInvocation) object;
        String url = f.getRequestUrl();
        if (url.contains("/login") || url.contains("/logout")) {
            return null;
        }
        // 此处处理动态权限
        return SecurityConfig.createList("ADMIN", "QUERY");
    }

    @Override
    public Collection<ConfigAttribute> getAllConfigAttributes() {
        return null;
    }

    @Override
    public boolean supports(Class<?> clazz) {
        return false;
    }
}
```

> 此处只是模拟赋予url的权限操作，实际业务可能从数据库或其他第三方获取。

### 投票模型

#### 自定义AccessDecisionManager

```java
public interface AccessDecisionManager {
    // 决策的核心方法
    void decide(Authentication authentication, Object object,
			Collection<ConfigAttribute> configAttributes) throws AccessDeniedException,
			InsufficientAuthenticationException;
    boolean supports(ConfigAttribute attribute);
    boolean supports(Class<?> clazz);
}
// 自定义决策管理器
public class UrlAccessDecisionManager implements AccessDecisionManager {

    @Override
    public void decide(Authentication authentication, Object object, Collection<ConfigAttribute> configAttributes) throws AccessDeniedException, InsufficientAuthenticationException {
        for (ConfigAttribute configAttribute : configAttributes) {
            // 未登录ROLE_ANONYMOUS角色
            if (authentication instanceof AnonymousAuthenticationToken) {
                throw new BadCredentialsException("未登录!");
            }
            // ① 当前url请求需要的权限
            String role = configAttribute.getAttribute();
            // ② 当前用户所具有的角色
            Collection<? extends GrantedAuthority> authorities 
                						= authentication.getAuthorities();
            for (GrantedAuthority authority : authorities) {
                // 只要包含其中一个角色即可访问
                if (authority.getAuthority().equals(role)) {
                    return;
                }
            }
        }
        throw new AccessDeniedException("请联系管理员分配权限！");
    }
}
```

> 1. `AffirmativeBased `基于肯定的决策器。 用户持有一个同意访问的角色就能通过。
> 2. `ConsensusBased`基于共识的决策器。 用户持有同意的角色数量多于禁止的角色数。
> 3. `UnanimousBased` 基于一致的决策器。 用户持有的所有角色都同意访问才能放行。

#### 自定义AccessDecisionVoter

`AccessDecisionManager`的实现类中支持`List<AccessDecisionVoter<?>> decisionVoters`作为参数传入，所以我们也可以通过创建`AccessDecisionVoter`的实现类创建自定义投票器。

```java
public interface AccessDecisionVoter<S> {
	int ACCESS_GRANTED = 1;
	int ACCESS_ABSTAIN = 0;
	int ACCESS_DENIED = -1;
    // 用于判断是否授予访问权限
    int vote(Authentication authentication, S object,
			Collection<ConfigAttribute> attributes);
    boolean supports(ConfigAttribute attribute);
    boolean supports(Class<?> clazz);
}
```

### 异常控制器

#### 未登录异常控制器

```java
public class AdminAuthenticationEntryPoint implements AuthenticationEntryPoint {
    @Override
    public void commence(HttpServletRequest request, 
                         HttpServletResponse response, 
                         AuthenticationException authException) 
        									throws IOException, ServletException {
        response.setHeader("Content-type", "text/html;charset=UTF-8");
        response.getWriter().append(ResponseBody.error("您需要登录！").toString());
        response.flushBuffer();
    }
}
```

> 处理未登录情况下所有访问的接口（放行除外）

#### 无权限异常控制器

```java
public class UrlAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request, 
                       HttpServletResponse response, 
                       AccessDeniedException accessDeniedException) 
        								throws IOException, ServletException {
        response.setHeader("Content-type", "text/html;charset=UTF-8");
        response.getWriter().append(ResponseBody.error("您无此权限！").toString());
        response.flushBuffer();
    }
}
```

> 处理登录后没有权限访问的路径

### Spring Security config

```java
@Configuration
public class PermissionSecurityConfig extends WebSecurityConfigurerAdapter {
    
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        ExpressionUrlAuthorizationConfigurer<HttpSecurity>.ExpressionInterceptUrlRegistry 									registry = http.antMatcher("/**").authorizeRequests();

        http.csrf().disable().cors();

        // 未登录认证异常
        http.exceptionHandling().authenticationEntryPoint(new AdminAuthenticationEntryPoint());
        // 登录过后访问无权限的接口时自定义403响应内容
        http.exceptionHandling().accessDeniedHandler(new UrlAccessDeniedHandler());
        registry.withObjectPostProcessor(new ObjectPostProcessor<FilterSecurityInterceptor>() {
            @Override
            public <O extends FilterSecurityInterceptor> O postProcess(O object) {
                object.setSecurityMetadataSource(
                    new UrlFilterInvocationSecurityMetadataSource());
                object.setAccessDecisionManager(
                    new UrlAccessDecisionManager());
                return object;
            }
        });
        registry
                .antMatchers("/hello").hasAuthority("ADMIN")
                .antMatchers("/test").anonymous();  // hello还需要权限，其他的不需要了
        super.configure(http);
}
```

> 这里是通过`ObjectPostProcessor`设置`FilterSecurityInterceptor`的参数注入到容器中的。之前有提到过，`ObjectPostProcessor`可以将new出来的对象加入容器中。