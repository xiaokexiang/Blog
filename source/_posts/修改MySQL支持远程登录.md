---
title: 修改MySQL支持远程登录
date: 2019-01-28 10:18:50
tags: Mysql
toc: true
categories:
- Mysql
thumbnail: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSoQ-_zNjDgtRvAk2ohQjfzql9wNl5uGpkz5mTwkQJ5kmJkoFUsWw
---
## MySQL不能远程登录
* 1130 is not allowed to connect 问题

``` java
  $ mysql -uroot -p 密码
  $ use mysql;
  $ update user set host = '%' where user ='root';
  $ select u.host,u.user from user u;
  $ GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION//赋予任何主机访问数据的权限
  $ FLUSH PRIVILEGES
  $ exit
```
 