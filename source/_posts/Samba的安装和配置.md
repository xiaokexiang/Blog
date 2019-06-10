---
title: Samba的安装和配置
date: 2019-04-01 15:54:00
tags: Linux
categories:
- Samba
---

## 安装

``` Shell
# yum命令安装samba
$ yum -y install samba samba-common samba-client

# samba的相关命令
$ service smb status
$ service smb start
$ service smb restart

# 设置samba自启动(如需要)
$ chkconfig --level 35 smb on
$ chkconfig --list smb
```

## 配置

```shell
# samba的配置文件
$ vi /etc/samba/smb.conf

# 共享文件夹名
[lijie] 
# 文件夹注释
    comment = This is share software
    # 共享文件夹指定目录
    path = /home/lijie
    public = yes
    writeable = yes
    browseable = yes
    
# 配置用户
$ useradd lijie
$ passwd lj123##
$ smbpasswd -a lijie

# 关闭防火墙(centos7)
$ systemctl status firewalld
$ systemctl stop firewalld

# 查看本机ip地址
$ ifconfig eth0 / ip addr show

#切到windows ping linux地址
ping 10.193.9.33

#windows 资源管理器访问
\\10.193.9.33

```

## 疑难解答
* 如果出现能访问linux但是无权限访问共享文件夹
```shell
# 查看selinux状态
$ getenforce

# 修改selinux状态
$ vi /etc/sysconfig/selinux   enforcing 改为 disabled (需要机器重启,永久)
$ setenforce 0(临时关闭)
```
* 不关闭防火墙,开放samba指定端口号
``` shell
# 开放端口号
$ firewall-cmd --zone=public --add-port=139/tcp --permanent
$ firewall-cmd --zone=public --add-port=445/tcp --permanent
$ firewall-cmd --zone=public --add-port=137/udp --permanent
$ firewall-cmd --zone=public --add-port=138/udp --permanent

$ firewall-cmd --reload
$ systemctl restart firewalld.service
```


