---
title: Hexo部署到Github及开启Https
toc: true
date: 2020-05-11 13:07:37
tags: Hexo
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccki7zvuj30u80caaaf.jpg
---
### 

### 前言

`因为阿里云主机将于一个星期后到期，就琢磨着Blog该怎么处理，无意间想起Github Page可以提供支持，还是免费的(哎呀妈，真香!)。下面从三个方面记录下将Blog从阿里云迁移到Github Page的流程以及遇到的一些坑。`


### 迁移Blog到Github Page

#### 新建Github Page

怎么注册Github就不详细说明了，进入个人github首页，选择New新建Repository，仓库名为你的账号名 ＋ github.io。比如我的账号名是xiaokexiang，那我的仓库名就是xiaokexiang.github.io。
<!--more-->
![](https://image.leejay.top/image/20200511/4nugBc7rX5V3.png?imageslim)

最后点击Create repository，在新的页面上复制上传地址(.git结尾的上传地址)，至此此步完成。

#### 修改Hexo配置

因为Blog是基于Hexo，Hexo本身提供了部署到Github Pgae的配置，只需要修改根目录下的config.yml文件中的Repo配置为上步复制的地址。

![](https://image.leejay.top/image/20200511/JuzJdL4l82cq.png?imageslim)

保存配置，执行如下命令：

```bash
hexo clean
hexo g
hexo d
```

至此此步完成，blog已被上传到Github Page。

---

### 添加域名转发

#### Github Page配置修改

在Github repository页面点击`setting`按钮，跳转到新的页面中的Github Page选项卡，在`Custom domain`中填入自己的域名，`勾选Enforce HTTPS`，点击保存即可。

![](https://image.leejay.top/image/20200511/n9OSqsVG9xSR.png?imageslim)

![](https://image.leejay.top/image/20200511/ChG4FKRMNHst.png?imageslim)

> 此处需要注意，上步新增自定义域名，其实是在repository根目录下新建名为CNAME的文件，文件内容为你自己的域名，如果下一次执行`hexo d`命令，这个CNAME不会自动生成，所以我们需要在你Blog根目录下的`source`文件夹新建`CNAME`文件，内容为`你自己的域名`，保证`CNAME`文件不会受`hexo d`命令丢失。

#### 修改域名解析

因为我的域名是在`阿里云`购买的，所以我以阿里云域名解析为例，演示如何修改域名解析

- 查询Github Page IP地址

  使用dig命令查询你的Github Page对应的IP地址群并记录下来

  ```bash
  yum install -y bind-utils
  dig xiaokexiang.github.io +answer
  ```

  ![](https://image.leejay.top/image/20200511/x9EbGVgmyAB9.png?imageslim)

  

- 改为自定义域名

  进入`阿里云控制台`，找到`域名`，找到你购买的域名，点击域名行的`解析`

  ![](https://image.leejay.top/image/20200511/E4yV74BNCw9T.png?imageslim)

  进入域名解析界面，添加如下域名解析，IP地址为刚才`dig命令`查询的IP

  ![](https://image.leejay.top/image/20200511/Umx4YrVgwx3U.png?imageslim)

  注意主机记录是`www`和`@`，记录类型为`CNAME`和`A`，保存即可。

- 测试

  在浏览器输入http://{your_domain}，看看是否成功。

---

### 修改为https访问

这里的https访问，我们需要采用第三方证书服务，但是又和阿里云的证书使用方式不同(无法部署到服务器)，所以我们使用`Cloudflare`的帮助。

#### 注册

先到`Cloudflare`上注册账号，地址：<a href="https://dash.cloudflare.com/sign-up">注册地址</a>

#### 添加站点

注册成功后，进入个人主页，右上角添加站点，点击确认，下一步选择`0美元/月`，`Cloudflare`会自动扫描域名的dns解析。

![](https://image.leejay.top/image/20200511/uaRIu4epnTL5.png?imageslim)

一直选择下一步，最终`cloudflare`会提供两个`域名服务器`

![](https://image.leejay.top/image/20200511/HfjNOou3jeyq.png?imageslim)

需要到域名提供商那里把原有的域名服务器改成`cloudflare`提供的域名服务器

![](https://image.leejay.top/image/20200511/gnqWCtLj4Em2.png?imageslim)

![](https://image.leejay.top/image/20200511/6YbmtAIYsLEF.png?imageslim)

修改成功后，查看`cloudflare`个人站点主页，是否出现下图所示提示

![](https://image.leejay.top/image/20200511/pnflKUPeWhUw.png?imageslim)

#### 站点配置

按照下图所示，个人站点主页选择`页面规则`，添加两条规则。

![](https://image.leejay.top/image/20200511/1rO6Mvg3kYLG.png?imageslim)

DNS服务器生效一般是24小时，`Cloudflare`生效一般是半小时，一天之后再打开`https://your_domian`，看看有没有出现锁的标志，如果没有，控制台查看自己的Blog是否存在`http`请求，我的就因为七牛云图床是http请求导致锁图标不出现，改为`https`后就成功显示了。