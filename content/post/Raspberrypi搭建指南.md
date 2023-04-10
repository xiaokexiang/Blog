---
title: "Raspberrypi搭建指南"
date: 2023-03-17T15:43:00+08:00
tags: ["raspberrypi "]
description: "树莓派是一种于2012年推出单板计算机。"
categories: [
  "raspberrypi"
]
slug: raspberrypi
hideReadMore: true
---

## 前置工作

### 安装系统

使用<a href="https://downloads.raspberrypi.org/imager/imager_latest.exe">Raspberry Pi Imager</a>来烧录系统，这个工具是树莓派官网推荐烧录工具，内置了系统镜像下来，树莓派4B推荐使用64位系统。同时高级设置中支持设置账户密码（账户默认是pi，密码不设置默认为raspberry）和wifi密码，设置完成等待烧录完毕即可。

### 查找树莓派ip

使用<a href="https://www.advanced-ip-scanner.com/cn/download/">Advanced IP Scanner</a>工具来实现局域网ip扫描，通过制造商来筛选出ip地址。

![image-20230316092322969](https://image.leejay.top/typora/image-20230316092322969.png)

### 开启root账户

```bash
# 输入root密码
sudo passwd root
# 解锁root账户
sudo passwd --unlock root
# 如果没安装ssh
sudo apt install ssh
# 如果出现password expiry information changed提示
# 修改sshd_config中的PermitRootLogin without-password为PermitRootLogin yes
sudo vi /etc/ssh/sshd_config
# 重启后使用root登陆
reboot
```

### 修改ubuntu镜像源

```bash
vi /etc/apt/sources.list
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/ jammy main restricted universe multiverse
deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/ jammy main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/ jammy-updates main restricted universe multiverse
deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/ jammy-updates main restricted universe multiverse
deb https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/ jammy-backports main restricted universe multiverse
deb-src https://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/ jammy-backports main restricted universe multiverse
deb http://ports.ubuntu.com/ubuntu-ports/ jammy-security main restricted universe multiverse
deb-src http://ports.ubuntu.com/ubuntu-ports/ jammy-security main restricted universe multiverse
```

### 固定ip

```yaml
-- vim /etc/netplan/01-network-manager-all.yaml
-- Let NetworkManager manage all devices on this system
network:
  version: 2
  renderer: NetworkManager
  ethernets:
    eth0:
      addresses:
        - 192.168.10.100/24
      nameservers:
        addresses: [114.114.114.114, 8.8.8.8]
      routes:
        - to: default
          via: 192.168.10.1
  wifis:
    wlan0:
      dhcp4: true
      optional: true
      addresses:
        - 192.168.10.99/24
      nameservers:
        addresses: [114.114.114.114, 8.8.8.8]
      access-points:
        "wifi名称":
          password: "wifi密码"
```

### 必备包

```bash
# 安装macvlan必备，否则会出现failed to create the macvlan port: operation not supported.
apt install linux-modules-extra-raspi
# 安装raspi-config图形界面
apt install raspi-config
```

## 树莓派软件安装

### oh-my-zsh

```bash
# 安装zsh
apt-get install zsh -y
# 安装oh-my-zsh
sh -c "$(curl -fsSL https://gitee.com/mirrors/oh-my-zsh/raw/master/tools/install.sh)"
# 安装插件 https://github.com/zsh-users
git clone https://ghproxy.com/github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting
git clone https://ghproxy.com/github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
git clone https://ghproxy.com/github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:-${ZSH:-~/.oh-my-zsh}/custom}/plugins/zsh-completions
# 修改配置
vim ~/.zshrc
plugins=(git zsh-syntax-highlighting zsh-autosuggestions zsh-completions)
bindkey ';'    autosuggest-accept    # 修改自动补全快捷键
bindkey '\ej'  backward-char         # ALT+j:向左移动一个单词
bindkey '\el'  forward-char          # ALT+l：向右移动一个单词
bindkey '\ei'  up-line-or-history    # ALT+i：向上移动一个单词
bindkey '\ek'  down-line-or-history  # ALT+k：向下移动一个单词
source ~/.zshrc
```

### frp

基于<a href="https://www.natfrp.com/">SakuraFrp</a>实现内网穿透

```bash
# 下载frpc
wget https://getfrp.sh/d/frpc_linux_arm64 > frpc && chmod +x frpc && cp ./frpc /usr/local/bin/frpc
# 安装systemd服务
mkdir -p /usr/local/etc/natfrp
vi /etc/systemd/system/frpc@.service
# 填写如下配置
[Unit]
Description=SakuraFrp Service
After=network.target

[Service]
Type=idle
User=nobody
Restart=on-failure
RestartSec=60s
ExecStart=/usr/local/bin/frpc -f %i
WorkingDirectory=/usr/local/etc/natfrp

[Install]
WantedBy=multi-user.target
# 重载服务
systemctl daemon-reload
# 启动隧道
systemctl start frpc@{账户密钥}:{隧道id}
# 查看服务
systemctl list-units "frpc@*"
# 设置服务开机启动
systemctl enable {服务名称}
```

### frpc-docker

```bash
docker run \
-d --restart=always \
--name=frpc-web \
--pull=always \
registry.cn-hongkong.aliyuncs.com/natfrp/frpc \
-f 账户密钥:隧道id --remote_control 远程密码
```

### TFOLED

```bash
# 编辑TFOLED服务
vi /etc/systemd/system/tfoled.service
[Unit]
Description=TFOLED Service
After=multi-user.target

[Service]
Type=idle
ExecStart=python /root/tfoled/TFOL.py

[Install]
WantedBy=multi-user.target
# 重载服务
systemctl daemon-reload
# 启动服务
systemctl start tfoled.service
# 开机启动
systemctl enable tfoled.service
```

### TFOLED-docker

```bash
docker run -itd --name tfoled \
   --privileged \
   --restart=always \
   --name tfoled
   --net=host \
   -v ${mount_path}:/data \ # 将需要统计的磁盘挂在到/data目录
   -e upper=40  \ # 风扇启动的温度，不填默认45
   -e lower=38 \ # 风扇停止的温度，不填默认42
   -d xiaokexiang/alpine-tfoled
```

### docker

```bash
# 安装证书
apt install apt-transport-https ca-certificates curl software-properties-common gnupg lsb-release
# 安装密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
# 添加官方库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
# 安装docker
apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin
# 修改镜像源
curl -sSL https://get.daocloud.io/daotools/set_mirror.sh | sh -s http://f1361db2.m.daocloud.io
```

### homeassistant

```bash
# 安装homeassistant
docker run -d \
  --name homeassistant \
  --privileged \
  --restart=unless-stopped \
  -e TZ=Asia/Shanghai \
  -v /root/homeassistant:/config \
  --network=host \
  homeassistant/raspberrypi4-64-homeassistant
# ha容器内部安装hacs
wget -q -O - https://install.hacs.xyz | bash -
```

### jd

```bash
docker run -itd --name jd \
-v /root/jd/scripts:/jd/scripts \
-v /root/jd/log:/jd/log \
-v /root/jd/config:/jd/config \
--network=host \
--restart=always \
docker.io/afeirwu/jd_local
```

### v2raya

```bash
docker run -d \
--restart=always \
--privileged \
--network=host \
--name v2raya \
-e V2RAYA_LOG_FILE=/tmp/v2raya.log \
-v /lib/modules:/lib/modules:ro \
-v /etc/resolv.conf:/etc/resolv.conf \
-v /root/v2raya:/etc/v2raya \
mzz2017/v2raya
```

### samba
```bash
# 挂载本机的/root/mount目录到容器的/mount目录
# 设置访问的账户名密码: username & password 和共享目录:share
# 在window上通过\\ip\share访问并输入用户名密码即可
docker run -it --name samba \
-p 139:139 -p 445:445 \
-v /root/mount:/mount  \
-d dperson/samba \
-w "WORKGROUP" \
-u "username;password" \
-s "share;/mount/;yes;no;no;all;admin"
# [name;path;browse;readonly;guest;users;admins;writelist;comment]
# [name] is how it's called for clients
# [path] path to share
# [browsable] default:'yes' or 'no'
# [readonly] default:'yes' or 'no'
# [guest] allowed default:'yes' or 'no'
# [users] allowed default:'all' or list of allowed users
# [admins] allowed default:'none' or list of admin users
# [writelist] list of users that can write to a RO share
# [comment] description of share
```
