---
title: "Kube Eventer基于mysql的使用"
date: 2022-03-21T15:03:59+08:00
description: "kube-eventer是阿里开源的一款k8s pod告警组件，支持多种告警方式。"
tags: ["kubernetes "]
categories: [
  "kubernetes"
]
---

### 前言

工作上需要持久化Pod的事件信息，我们知道事件默认是由etcd来进行存储的，但是事件的信息存储具有时效性（`默认1h，通过修改kube-apiserver的--event--ttl实现更长时间的存储`），且将etcd这种内存级别的组件作为持久化数据库也是不合理的，所以使用了阿里开源的这款事件告警组件<a href="https://github.com/AliyunContainerService/kube-eventer">kube-eventer</a>。

### 使用方法

- 创建表
```sql
CREATE TABLE IF NOT EXISTS `kube_event` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'event primary key',
  `name` varchar(64) NOT NULL DEFAULT '' COMMENT 'event name',
  `namespace` varchar(64) NOT NULL DEFAULT '' COMMENT 'event namespace',
  `event_id` varchar(64) NOT NULL DEFAULT '' COMMENT 'event_id',
  `type` varchar(64) NOT NULL DEFAULT '' COMMENT 'event type Warning or Normal',
  `reason` varchar(64) NOT NULL DEFAULT '' COMMENT 'event reason',
  `message` text NOT NULL COMMENT 'event message',
  `kind` varchar(64) NOT NULL DEFAULT '' COMMENT 'event kind',
  `first_occurrence_time` varchar(64) NOT NULL DEFAULT '' COMMENT 'event first occurrence time',
  `last_occurrence_time` varchar(64) NOT NULL DEFAULT '' COMMENT 'event last occurrence time',
  `cluster` varchar(64) DEFAULT NULL COMMENT 'cluster',
  `source` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'source',
  PRIMARY KEY (`id`),
  UNIQUE KEY `event_id_index` (`event_id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8 COMMENT='Event info tables';

```

- 执行yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    name: kube-eventer
  name: kube-eventer
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kube-eventer
  template:
    metadata:
      labels:
        app: kube-eventer
      annotations:	
        scheduler.alpha.kubernetes.io/critical-pod: ''
    spec:
      dnsPolicy: ClusterFirstWithHostNet
      serviceAccount: kube-eventer
      containers:
        - image: abcsys.cn:5000/kube-eventer:latest
          name: kube-eventer
          command:
            - "/kube-eventer"
            - "--source=kubernetes:https://kubernetes.default"
            ## 填入你的数据库账户、密码、名称和集群名称
            - --sink=mysql:?username:password@tcp(ip:port)/dbname?charset=utf8&table=tablename&cluster=clustername
          env:
          # If TZ is assigned, set the TZ value as the time zone
          - name: TZ
            value: "Asia/Shanghai" 
          volumeMounts:
            - name: localtime
              mountPath: /etc/localtime
              readOnly: true
            - name: zoneinfo
              mountPath: /usr/share/zoneinfo
              readOnly: true
          resources:
            requests:
              cpu: 100m
              memory: 100Mi
            limits:
              cpu: 500m
              memory: 250Mi
      volumes:
        - name: localtime
          hostPath:
            path: /etc/localtime
        - name: zoneinfo
          hostPath:
            path: /usr/share/zoneinfo
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube-eventer
rules:
  - apiGroups:
      - ""
    resources:
      - configmaps
      - events
    verbs:
      - get
      - list
      - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-eventer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kube-eventer
subjects:
  - kind: ServiceAccount
    name: kube-eventer
    namespace: kube-system
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kube-eventer
  namespace: kube-system
```

### 注意事项

- 注意事项一

  Q：数据库密码携带了@#这种特殊字符，导致数据库密码无法解析报错。<br/>
  A：创建新的账户名和密码并赋予kube-event表的权限。

- 注意事项二

  Q：默认的官方镜像不带clusterName<br/>
  A: 使用<a href="https://github.com/jinriyang/kube-eventer">此版本</a>，将deploy目录下的Dockerfile移到根目录自行打包即可。





