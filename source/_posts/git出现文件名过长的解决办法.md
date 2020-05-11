---
title: git出现文件名过长的解决办法
date: 2018-11-21 21:13:11
tags: Git
toc: true
categories:
- Git
thumbnail: https://image.leejay.top/image/20200107/uI2RG7Cz3Bj3.jpg
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