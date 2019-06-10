---
title: git出现文件名过长的解决办法
date: 2018-11-21 21:13:11
tags: Git
categories:
- Git
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