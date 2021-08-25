---
title: "Git Command"
date: 2021-08-25T16:39:56+08:00
description: "基于https://learngitbranching.js.org的Git学习笔记"
weight: 1
tags: ["git"]
categories: [
  "git"
]
---

## Git Command

### 本地仓库提交

```shell
# 本地提交
git commit -m "message"
```

### 分支

分支的创建基于``基于某个提交及它的父提交`，当前所在的分支会用`*`标识

```shell
# 创建分支（分支的创建基于某个提交）
git branch ${branch_name}
# 切换到这个分支
git checkout ${branch_name}
# 创建并切换到这个分支
git checkout -b ${branch_name}
```

### 合并

#### merge

将某个分支A上`不被当前分支B包含的提交记录`合并到当前分支B上。会在当前分支B下创建一个新的合并记录，此时分支B会包含分支A的所有提交记录。

```shell
# 将${branch_name}分支提交记录覆盖到当前分支
git merge ${branch_name}
```

#### rebase

相比于`merge`，`rebase`会从当前分支和目标分支的共同父节点P开始，将当前分支P点后的提交记录都复制到目标分支的最新节点后，最终看起来就像只有一条分支（rebase后的commit id和原来不一致了）。

```shell
# 将当前分支合并到${branch_name}上
# git rebase a 会将当前分支的提交记录复制到分支a后面
git rebase [-i] ${branch_name}
```

### HEAD

HEAD 是一个对当前检出记录的符号引用，指向你`正在其基础上进行工作的提交记录`。HEAD 总是指向当前分支上最近一次提交记录。

#### 分离HEAD

一般HEAD和分支是一起前进的，通过checkout命令修改HEAD的指针，此时HEAD的状态是`detached`。又称为`detached head`，即分离HEAD。

```shell
# 会将HEAD指针指向这个commitid或branch
git checkout ${commit_id}/${branch_name}
HEAD -> branch -> commid_a => HEAD -> commit_id & branch -> commit_id
```

#### 相对引用

```shell
# 将HEAD切换到main的父提交记录
git checkout main^
# 将HEAD切换到main的爷提交记录
git checkout main^^
# 向上移动num次
git checkout ~<num>
# 将分支main移动到当前HEAD的相对位置上的第3个提交记录 
git branch -f main ~3
```

### 撤销变更

#### git restore（适合回滚本地未提交的改动）

撤销未提交到本地仓库的改动。

```shell
# 回滚所有的改动
git restore .
# 使用checkout也可以实现
git checkout .
```

#### git commit --amend（适合提交的改动中错误部分）

如果上次提交的改动，有部分改错了，但是不想再多一次提交记录，那么可以使用`git commit -m "msg" --amend`命令提交当前改动，那么改动会被提交到本地仓库的同时，且只保留提交信息为"msg"的提交记录

#### git reset（适用本地已提交撤销）

通过把分支记录回退几个提交记录来实现撤销改动。你可以将这想象成“改写历史”。原先的修改内容仍然存在，处于`未加入暂存区状态`。

```shell
# 将本地分支记录回退一个版本实现撤销
git reset HEAD~1
```

#### git revert（使用远端撤销）

使用`git revert`命令，在当前提交记录A后多个一个新的提交记录 B，这个`新的提交记录B引入了更改`（这更改是用来撤销A的更改内容），也就是恢复到提交记录B的父记录状态。

```shell
# 撤销更改
git revert HEAD
A -> B => A -> B -> B' (A = B')
```

### cherry-pick

将一些提交记录复制到当前所在位置（HEAD）后。

```shell
# 将多个提交复制到HEAD后
git cherry-pick <commit_id ...>
```

> 相比rebase，更加灵活，可以`指定某个分支上的特定几个提交记录`，而不是类似`git rebase  -i`的图形化操作界面。

#### 交互的rebase

相比`cherry-pick`基于提交记录的hash值进行工作，通过`--interactive（简写为-i）`操作图形化界面。

```shell
# 通过图形化界面将当前分支的记录移到${branch_name}后
git rebase -i ${branch_name}
```

