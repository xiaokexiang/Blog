---
title: Hexo部署到云主机
date: 2019-05-05 15:12:09
tags: Linux
top: true
categories:
- Linux
---
# 环境准备
* 安装git
``` bash
$ yum install -y git
```

* 基于docker安装nginx
<a href="https://www.leejay.top/2019/05/05/Docker%E4%B8%8B%E5%AE%89%E8%A3%85nginx/">查看博客</a>
* 安装nodejs
``` bash
# 下载nodejs包
$ wget https://nodejs.org/dist/v10.9.0/node-v10.9.0-linux-x64.tar.xz
# 解压并查看version
$ tar xf  node-v10.9.0-linux-x64.tar.xz
$ cd node-v10.9.0-linux-x64/
$ ./bin/node -v
# 设置软连接(前面是宿主机nodejs地址)
$ ln -s /opt/nodejs/bin/npm   /usr/bin/npm
$ ln -s /opt/nodejs/bin/node   /usr/bin/node
```
# 创建用户git

``` bash
# 创建用户
$ useradd git
# 给用户设置密码
$ passwd git
# 编辑sudoers
$ vim /etc/sudoers
> root    ALL=(ALL)       ALL下添加 git    ALL=(ALL)     ALL
```

# 创建公钥并免密连接linux
``` bash
# 在windows cmd窗口运行,找到id_rsa.pub文件
$ ssh-keygen -t rsa
```

# 实现windows免密访问linux
``` bash
# 切换至git用户
$ su git
# 创建ssh&authorized_keys
$ mkdir ~/.ssh
# 将id_rsa.pub的值传入linux下的authorized_keys
$ vim ~/.ssh/authorized_keys
```

# windows->linux免密测试
``` bash
# 打开cmd 并输入密码
$ ssh -v git@${linux ip地址}
```

# 进行git配置
``` bash
# 创建用于存放hexo的文件夹
$ mkdir -p /opt/nginx/html/hexo
# 创建empty的git仓库
$ cd /opt/nginx/html/ && git init --bare blog.git
# 创建hooks钩子函数
$ vim ./blog.git/hooks/post-receive
> #!/bin/bash
> git --work-tree=/opt/nginx/html/hexo(存放hexo文件的地址) --git-dir=/opt/nginx/html/blog.git(blog.git文件地址) checkout -f
# 修改权限
$ chmod +x ./blog.git/hooks/post-receive
$ chown -R git:git /opt/nginx/html/hexo(👉如果没有这步可能会出现permission问题!)
$ chown -R git:git /opt/nginx/html/blog.git
```

# 修改docker nginx配置
``` bash
# 修改nginx default.conf
$ vim /opt/nginx/conf.d/default.conf
> 改为 server_name  ${你的域名};
> root   ${你的宿主机hexo存放地址}
# 重启nginx
$ docker restart ${nginx容器号}
```

# 修改hexo配置文件(windows下)
``` bash
# 修改_config.yml
$ repo: git@${你的域名}:/opt/nginx/html/blog.git
$ hexo clean
$ hexo g
$ hexo d
```