---
title: git出现文件名过长的解决办法
date: 2018-11-21 21:13:11
tags: Git
toc: true
categories:
- Git
thumbnail: https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS9rAl3n9C2r518tbUjJvQ9hjCc-pQsh09Ki7bpABDJmo7z08DJ5w
---

## 在上传文件的文件夹下打开:
``` bash
$ git bush here
```

## 操作命令:
``` bash
$ git config --system core.longpaths true
```


## 查看修改结果: 
``` bash
git config core.longpaths
```