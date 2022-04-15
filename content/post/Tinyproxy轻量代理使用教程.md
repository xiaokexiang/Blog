---
title: "Tinyproxy轻量代理使用教程"
date: 2022-04-15T10:40:36+08:00
description: "Http/Https轻量代理Tinyproxy的安装与使用"
tags: ["tinyproxy "]
categories: [
  "tinyproxy"
]
hideReadMore: true
---

> <a href="http://tinyproxy.github.io/">Tinyproxy</a>是一个轻量级的HTTP / HTTPS代理守护进程，快速且小巧。

## Tinyproxy的安装



### 基于Docker安装

使用<a href="https://hub.docker.com/r/monokal/tinyproxy">monokal/tinyproxy</a>的镜像,dockerhub上的使用已经很清楚了，按照描述:

```shell
docker run -d --name='tinyproxy' -p <Host_Port>:8888 --env BASIC_AUTH_USER=<username> --env BASIC_AUTH_PASSWORD=<password> --env TIMEOUT=<timeout> monokal/tinyproxy:latest <ACL>
```

> - Set <Host_Port> to the port you wish the proxy to be accessible from.
>
> - Set <ACL> to 'ANY' to allow unrestricted proxy access, or one or more space seperated IP/CIDR addresses for tighter security.
> - Basic auth is optional.
> - Timeout is optional.



---

### curl测试

```shell
curl -x http://<your_username>:<your_password>@<tinyproxy_ip>:<tinyproxy_port> http://httpbin.org/ip
```

> - 如果代理需要用户名密码验证，但是没有传递，那么会出现`407 Proxy Authentication Required`提示。
> - 如果代理的用户名密码错误，会出现`Unauthorized`提示。
> - 如果访问代理的ip地址不在tinyproxy的access名单中，会出现`Access denied`提示。



---

### RestTemplate中使用代理

```xml
<dependency>
    <groupId>org.apache.httpcomponents</groupId>
    <artifactId>httpclient</artifactId>
    <version>4.5.13</version>
</dependency>
```



```java
@Slf4j
@Configuration
public class RestTemplateConfiguration {

    @Value("${proxy.switch:off}")
    private Boolean proxySwitch; // // 是否开启代理

    @Value("${proxy.url}")
    private String proxyUrl; // tinyproxy代理所在ip

    @Value("${proxy.port}")
    private Integer proxyPort; // tinyproxy代理端口
    
     @Value("${proxy.username}")
    private String username; // tinyproxy代理auth username

    @Value("${proxy.password}")
    private Integer password; // tinyproxy代理auth password

    @Bean
    @SneakyThrows
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        HttpClientBuilder builder = HttpClientBuilder.create();

        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory();
        if (proxySwitch) {
            if (new InetSocketAddress(proxyUrl, proxyPort).getAddress().isReachable(1000 * 3)) {
                log.info("设置RestTemplate的代理地址为: {}", proxyUrl + ':' + proxyPort);
                CredentialsProvider provider = new BasicCredentialsProvider();
                provider.setCredentials(
                        new AuthScope(proxyUrl, proxyPort),
                        new UsernamePasswordCredentials(username, password)
                );
                builder.setProxy(new HttpHost(proxyUrl, proxyPort)).setDefaultCredentialsProvider(provider);
            }
        }
        factory.setHttpClient(builder.build());
        factory.setConnectTimeout(25 * 1000);
        factory.setReadTimeout(25 * 1000);
        restTemplate.setRequestFactory(factory);
        restTemplate.getMessageConverters().add(getMappingJackson2HttpMessageConverter());
        return restTemplate;
    }

    private MappingJackson2HttpMessageConverter getMappingJackson2HttpMessageConverter() {
        MappingJackson2HttpMessageConverter converter = new MappingJackson2HttpMessageConverter();
        List<MediaType> mediaTypes = new ArrayList<>();
        mediaTypes.add(MediaType.APPLICATION_OCTET_STREAM);
        mediaTypes.add(MediaType.TEXT_HTML);
        mediaTypes.add(MediaType.APPLICATION_JSON);
        converter.setSupportedMediaTypes(mediaTypes);
        return converter;
    }
}
```

---