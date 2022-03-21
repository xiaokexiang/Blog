---
title: "Mirai安装教程"
date: 2022-03-07T10:21:01+08:00
tags: ["mirai"]
categories: [
  "mirai"
]
---

## Mirai

> <a href="https://github.com/mamoe/mirai">mirai</a> 是一个在全平台下运行，提供 QQ Android 协议支持的高效率机器人库。
<!--more-->

### 前言

因为程序需要监听QQ群消息的缘故，在GITHUB上找到这款基于Android协议的机器人库，记录下安装的过程及踩坑的经历。

### mirai安装

官方提供了不同平台的<a   href="https://github.com/mamoe/mirai/blob/dev/docs/UserManual.md">安装教程</a>，并推荐使用纯控制台的版本（mcl-install），我们在window上安装，所以选择`mcl-installer-?-windows-amd64.exe`版本下载，下载后双击打开安装。一路回车安装，都选择默认值即可。进入cmd执行mcl命令，出现下图提示即为安装成功。

![](https://image.leejay.top/FovL62-908zQoLQiPl29Jz6vWWL6)

### 插件安装

#### Http插件

因为程序需要监听QQ群的消息，于是我们选择安装官方推荐的Http插件<a href="https://github.com/project-mirai/mirai-api-http/releases">mirai-http-api</a>与我们程序进行交互。在mirai安装目录下执行如下命令：

```bash
mcl --update-package net.mamoe:mirai-api-http --type plugin --channel stable
```

上述命令执行后，再次启动mriai（mcl命令），程序会自动下载对应的插件包，但是会出现下图的错误：

![](https://image.leejay.top/FjJimXKQD7GarY8aBQSOD9dwDyNP)

原因就是版本太高导致的（可以选择降低版本，降低为<a href="https://github.com/project-mirai/mirai-api-http/releases">1.1.0版本</a>，替换文件下的plugins内的jar包版本和config.yaml中的版本号）

![](https://image.leejay.top/FhB3kqBzB_eaGAMXuONSl4AVFebb)

#### 插件配置

```yaml
## 配置文件中的值，全为默认值

## 启用的 adapter, 内置有 http, ws, reverse-ws, webhook
adapters:
  - http
  - ws

## 是否开启认证流程, 若为 true 则建立连接时需要验证 verifyKey
## 建议公网连接时开启
enableVerify: true
verifyKey: 1234567890

## 开启一些调式信息
debug: false

## 是否开启单 session 模式, 若为 true，则自动创建 session 绑定 console 中登录的 bot
## 开启后，接口中任何 sessionKey 不需要传递参数
## 若 console 中有多个 bot 登录，则行为未定义
## 确保 console 中只有一个 bot 登陆时启用
singleMode: false

## 历史消息的缓存大小
## 同时，也是 http adapter 的消息队列容量
cacheSize: 4096

## adapter 的单独配置，键名与 adapters 项配置相同
adapterSettings:
  ## 详情看 http adapter 使用说明 配置
  http:
    host: localhost
    port: 8080
    cors: ["*"]
  
  ## 详情看 websocket adapter 使用说明 配置
  ws:
    host: localhost
    port: 8080
    reservedSyncId: -1
```

---

### 登录QQ账号

#### 登录验证

我们启动mriai后，在控制台输入`login qq账号 qq密码`，一般会出现滑动验证弹窗，如下图所示：

![](https://image.leejay.top/Fg7qBcaAxh-E8aK4rEZgRCnKlAgu)

这个问题我们需要使用<a href="https://github.com/mzdluo123/TxCaptchaHelper">滑动验证助手</a>来实现滑动验证，在安卓手机上安装软件<a href="https://maupdate.rainchan.win/txcaptcha.apk">滑动验证助手</a>，将上图中的5670输入软件后，会出现滑动弹窗，手动验证后，若出现登录成功的提示即为成功。

---

### 程序读取QQ信息

上面的账户登录成功后，控制台就会打印QQ中收到的信息，如果我们需要实现程序监听，那么还需要读取mirai的程序，这边提供一个基于python和websocket模式的demo。

```python
async def read_message():
    async with websockets.connect(
            'ws://{0}/message?verifyKey={1}&qq={2}'.format(host, verify_key, str(login_qq))) as websocket:
        log.info('mirai websocket 服务连接成功！')
        while True:
            message = await websocket.recv()
            print(message)
asyncio.get_event_loop().run_until_complete(read_message())
```