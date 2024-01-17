---
title: "Kubernetes概念入门"
date: 2021-04-09T11:07:57+08:00
description: "Kubernetes是用于自动部署，扩展和管理容器化应用程序的开源系统。"
tags: ["Kubernetes "]
categories: [
  "Kubernetes "
]
slug: kubernetes
---

## 容器与虚拟机的区别

虚拟机（VM）是虚拟化底层计算机，每个VM不仅需要运行`操作系统的完整副本`，还需要运行操作系统需要运行的所有`硬件的虚拟副本`。这就意味着需要大量的硬件资源。

相比VM，容器只需要虚拟化`操作系统`。每个容器共享主机操作系统内核。相比VM功能类似，但是开销少很多。但是VM提供了完全隔离的环境。

容器内的进程是运行在宿主机的操作系统上的，而虚拟机内的进程是运行在不同的操作系统上的，但容器内的进程是与其他进程隔离的。、

![](https://image.leejay.top/FouxGZ-cOAR4ONol65GI0j4-JrnE)

> 1. VM内的指令执行流程：`VM程序指令 -> VM操作系统内核 -> 宿主机管理程序 -> 宿主机内核。 `
> 2. 容器会完全指定运行在宿主机上的同一个内核的系统调用，容器间是共享操作系统内核。

## 容器的隔离机制实现

### Linux命名空间

每个进程只能看到自己的系统视图（文件、进程、网络接口、主机名等）。进程不单单只属于一个命名空间，而是属于`每个类型`的一个命名空间。类型包括`Mount(mnt)`、`Process ID(pid)`、`NetWork(net)`、`Inter-process communication(ipd)`、`UTS`、`User ID(user)`。

### Linux控制组

基于`cgroups`实现，它是Linux内核功能，限制一个进程或一组进程的资源使用不超过被分配的量。

## Kubernetes基本概念

### Kubernetes Master & Node

![](https://image.leejay.top/Fj-qU9AfR_V8wil_7ax3NgelK7dN)

### Kubernetes运行流程

![](https://image.leejay.top/Fq7Rgjt1Z_vaKn9ZnmaNAxcfiq5l)

> 1. 在应用程序运行时，可以增加或减少副本数量。也可以交由kubernetes进行判断。
> 2. kubernetes可能需要在集群中迁移你的容器，比如运行的节点失败时、为其他容器腾空间从节点移除时。

## Docker

### Command

```shell
# 运行容器并输出hello world
docker run busybox echo hello world
```

### Dockerfile

```js
const http  = require('http'); 
const os  = require('os');

console .log ("Kub i a server starting ... "); 
var handler = function(request, response){
    console.log ("Rece i ved request from ” + request connection. remoteAddress"); 
    response.writeHead(200); 
    response.end("You've hit " + os.hostname() + " \n "); 
}
var www = http.createServer(handler) ; 
www.listen(8080);
// 构建nodejs项目用于容器部署
```

- 编写Dockerfile

```dockerfile
FROM node:7 # 基于什么镜像制作
ADD app.js /app.js # 将当前目录下的app.js移到容器根目录
ENTRYPOINT ["node", "app.js"] # 启动容器时的执行命令
```

- 镜像打包

```dockerfile
docker build -t ${name} .
```

- 进入容器内部

```shell
docker exec -it ${docker name} bash
```

> 1. `-i`表明标准输入流保持开放
> 2. `-t`用于分配一个伪终端

### Docker镜像推送

```shell
docker ${local_image} ${your account name}/${remote_image}
docker busybox xiaokexiang/busy # 将本地镜像加自己账户名前缀的tag
docker login # docker 账户登录
docker push xiaokexiang/busybox # 推送到远端
```

## Kubernetes

### 部署

#### 基于minikube部署

- kubectl

```shell
export REGISTRY_MIRROR=https://registry.cn-hangzhou.aliyuncs.com
curl -sSL https://kuboard.cn/install-script/v1.19.x/install_kubelet.sh | sh -s 1.19.2
```

- MiniKube

```shell
# 拉取二进制包（基于阿里云镜像）
# https://developer.aliyun.com/article/221687
curl -Lo minikube https://kubernetes.oss-cn-hangzhou.aliyuncs.com/minikube/releases/v1.17.1/minikube-linux-amd64 && chmod +x minikube && sudo mv minikube /usr/local/bin/

# 创建用户（不能使用root启动）
adduser k8s
passwd k8s
sudo groupadd docker
# 添加到用户组
sudo usermod -aG docker k8s
// 激活用户组
newgrp docker

# 启动
minikube start
```

#### 基于kubeadm部署

<a href="./kubeadm部署.md">kubeadm部署</a>

```shell
# 查看node状态
kubectl get nodes
# 赋予node 角色信息
kubectl label nodes k8s-node1 node-role.kubernetes.io/node=
# 清除node 角色信息
kubectl label nodes k8s-node1 node-role.kubernetes.io/node-
```

### 基本概念与命令

#### Pod

一个Pod是一组紧密相关的容器（kubernetes中的基本部署单元），它们总是`一起运行在同一个工作节点上（或同一个Linux命名空间中）`。`每个Pod就相当于一个独立的逻辑机器`，拥有自己的IP、主机名、进程等，运行一个应用程序，可以是单个进程的运行在单个容器中，也可以是`每个进程都运行在自己的容器中`。

![](https://image.leejay.top/FozNgUDN5hlTyAnD_nittm3RosUs)

> 1. 同一个Pod内的多个容器共享相同的Linux命名空间，拥有相同的IP、主机名、网络接口等。
> 2. 同一个Pod内的容器不能出现相同的端口号，可以通过`localhost`地址进行互相访问。
> 3. 默认情况下容器间的目录互相隔离，但是可以通过`Volume`实现文件目录共享。

```shell
# 创建名为kubia的pod
kubectl run kubia --image=xiaokexiang/kubia --port 8080
# 获取default的pods列表（显示更详细信息）
kubectl get pods -o wide 
```

- ##### Pod内容器数量的选择

![](https://image.leejay.top/FuccR-aTqHyY9gll868rRIGzUaXg)

> 1. 一个容器中不应该包含多个进程，Pod也不需要包含多个容器，多个Pod也不需要部署在同一台工作节点上。
> 2. Pod内是否包含多个容器取决于这些容器代表的是一个整体还是相互独立的组件。

##### 基于Yaml构建Pod

```shell
# 查看已有pod的yaml
kubectl get pod kubia -o yaml
# 查看yaml中字段含义
kubectl explain pods
kubectl explain pod.spec
...
```

```yaml
apiVersion: v1 # 描述遵循V1版本的Api
kind: Pod # 描述一个pod
metadata: # 用于描述名称、命令空间、标签等其他容器信息
   name: kubia  # pod的名称
spec: # pod内容的实际说明，pod的容器、卷和其他数据
  containers:
  - image: xiaokexiang/kubia # 创建容器需要的镜像
    name: kubia # 容器的名称
    ports:
    - containerPort: 8080 # 应用监听的端口号
      protocol: TCP # 应用监听的协议
```

##### Pod基本命令

```shell
# 基于yaml创建pod，无法更新
kubectl create -f kubia.yaml
# 当yaml修改时，apply可以更新
kubectl apply -f kubia.yaml
# 获取pod的yaml或json格式的配置
kubectl get pod kubia -o yaml/json
# 查看pod日志，默认pod删除日志也会被清空
kubectl logs -f kubia
# 查看多容器pod的日志,查看多容器pod中名为abc容器的日志
kubectl logs -f kubia -c abc
# 不通过service实现本地8888端口访问pod8080端口
kubectl port-forward kubia 8888:8080
# 删除pod
kubectl delete pod kubia
# 删除多个pod
kubectl delete pod kubia,kubia-gpu
```

##### Pod的健康检查

- liveness存活探针

可以为`pod内的每个容器都单独指定存活探针`，如果探测失败，那么k8s会定期执行探针并重新启动容器。

可以通过`HTTP（状态码）`、`TCP（建立连接）`、`EXEC探针（容器内执行命令）`进行容器探测。

```yaml
apiVersion: v1
kind: Pod
metadata:
	name: kubia-liveness
spec:
	containers:
	- image: luksa/kubia-unhealthy
	  name: kubia
      livenessProbe: #http存活探针
          httpGet: 
              path: /   # 请求路径
              port: 8080   #请求端口
          initialDelaySeconds: 15 # 探针在启动后等待15s再探测
```

> 此镜像在五次GET请求后会返回500的错误状态码，k8s检测到后`会自动创建新的容器（而不是重启原来的容器）`。
>
> 通过`kubectl desribe pod kubia-liveness`查看容器运行的情况。
>
> ![](https://image.leejay.top/FlAUIsxMRVNa0aFd-5mhLjNs24GO)

- Readnesses就绪探针

就绪探针定期调用，用来确定特定的Pod是否能接收客户端请求。与存活探针类似，具有`Exec探针`、`HTTP GET探针`、`TCP Socket探针`三种方式。如果就绪探针检查的Pod没有准备就绪，那么是不会被加入到`svc`服务中的。

> Q：存活探针与就绪探针的区别？
>
> A：就绪探针下，如果容器未通过准备检查，那么`不会被终止或重新启动`。存活探针会杀死异常的容器并启动新的正常容器来保证Pod正常工作。就绪探针确保只有准备好处理请求的Pod才可以接受请求。如果就绪探测失败，就会`从服务中移除该Pod`。

![](https://image.leejay.top/FpNh6aOeUA7J0hwUml8gEwWPcbP2)

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
	name: kubia-replication
spec:
	replicas: 3
	selector:
		app: kubia
	template:
		metadata:
			labels:
				app: kubia
		spec:
			containers:
			- name: kubia
			  image: xiaokexiang/kubia
			  readinessProbe: #默认10s检查一次
			  	exec:
			  		command:
			  		- ls
			  		- /var/ready # 基于EXEC的容器的就绪探针
			  ports:
			  - containerPort: 8080
```

> 使用就绪探针，可以使Pod异常时，从所有的SVC中移除。

- Headless

将服务spec中的clusterIP字段设置为None的服务被称为headless服务。

```yaml
apiVersion: v1
kind: Service
metadata:
	annotation:
	    # 开启：无论pod是否准备完毕都添加到服务中
		service.alpha.kubernetes.io/tolerate-unready-endpoints: "true"
    name: kubia-headless
spec:
    clusterIP: None # headless 核心
    ports:
    - port: 80
      targetPort: 8080
    selector:
      app: kubia
```

> `kubectl  run dnsutils --image=tutum/dnsutils --generator=run-pod/v1 --command -- sleep infinity`创建DNS Pod来查看DNS解析。
>
> `kubectl exec dnsutils nslookup kubia-headless`查看Pod是否能够访问。

##### ReplicationController

ReplicationController可以确保它监控的pod始终保持运行状态。ReplicationController通过标签选择器（label）管理一个Pod的多个副本，这样当节点故障时，被ReplicationController管理的Pod会被`重新创建`。

- ReplicationController的作用

![](https://image.leejay.top/FhmTtTqgDwYLSRW9xkCEr9sDC1ci)

- ReplicationController协调流程

![](https://image.leejay.top/FmQRcwEG8kmqaYnP9oiy6XJtneh0)

> 核心在于`标签选择器`、`replica副本数量`、`Pod模板`。其中`replica副本数量`的修改会影响现有的Pod。
>
> ReplicationController能够确保`一个Pod的持续运行`，当集群节点发生故障时，为故障的节点上它管理的所有Pod创建替代副本，能够实现`Pod的水平伸缩`。

- ReplicationController的创建

```yaml
apiVersion: v1
kind: ReplicationController # 指定类型
metadata:
	name: kubia-replication
spec:
	replicas: 3 # 指定副本数量
	selector: # 标签选择器（也可以不写，k8s会从template中提取）
		app: kubia
	template: # 设置模板
		metadata:
			labels:
				app: kubia # 这里的标签要与标签选择器的相同，否则无限创建容器
		spec:
			containers:
			- name: kubia
			  image: xiaokexiang/kubia
			  ports:
			  - containerPort: 8080
```

```shell
# 创建replicationController
kubectl apply -f kubia-replication.yaml
# 获取replicationController信息
kubectl get rc
# 查看rc信息
kubectl describe rc kubia-replication
# 将某个pod移除rc管理（即修改该pod的label）
kubectl label pod kubia app=no --overwrite
kubectl delete pod kubia
# 编辑replicationController的配置文件
# 修改label
kubectl edit rc kubia-replication
# rc水平扩容,副本数为4
kubectl scale rc kubia-replication 1--replicas=4
# 删除rc的同时不删除rc管理的pod
kubectl delete rc kubia-replication --cascade=false
```

> 当我们手动delete pod时，通过`kubectl get pods`查看
>
> ![](https://image.leejay.top/Fp-q07H4tbqRq_WRe-4fdcQreSlm)
>
> 当我们手动修改ReplicationController中的label标签后
>
> ![](https://image.leejay.top/FvBnV2-NQ893shmPO-Avu3cTixAE)

##### ReplicaSet

它是新一代的 ReplicationController ，并且将其完全替换掉（ ReplicationController 最终将被弃用）。相比ReplicationController具有如下优势：

- 可以匹配多个标签（env=dev，app=kubia），可以使用通配符进行匹配（env=*）

```yaml
apiVersion: apps/v1 # 属于的版本号
kind: ReplicaSet
metadata:
  name: kubia-replicaset
spec:
  replicas: 3
  selector:
    matchLabels: # 基于matchLabels选择器
      app: kubia
  template:
    metadata:
      labels:
        app: kubia
    spec:
      containers:
      - name: kubia
        image: xiaokexiang/kubia
        ports:
	      - containerPort: 8080
```

> 如果节点上已经存在三个`app=kubia`的Pod，那么创建ReplicaSet后会将这个三个Pod纳入管理。

```  shell
# 创建replicaSet
kubectl apply -f kubia-replicaset.yaml
# 默认情况下如果存在label标签相同的pod会被加入rs的管理
kubectl get pods
# 查看rs
kubectl get rs
# 查看指定rs详情
kubectl describe rs kubia-replicaset
# 删除rs但不删除pod
kubectl delete rs kubia-replicaset --cascade=false
```

- 标签选择器

```yaml
apiVersion: apps/v1 # 属于的版本号
kind: ReplicaSet
metadata:
  name: kubia-replicaset
spec:
  replicas: 3
  selector:
    matchExpressions: # 基于matchLabels选择器
      - key: app
        operator: In # 除了In，还有NotIn、Exists、DoesNotExist
        values:
          - kubia
```

##### DaemonSet

相比ReplicationController（ReplicaSet）将`副本随机分配在各个节点上`，DaemonSet可以`在每个节点上只运行一个Pod副本`。它没有期望副本（replicas）的概念，因为它的工作是确保一个Pod匹配它的选择器并在每个节点上运行。

如果节点下线，那么DaemonSet不会在其他地方重新创建Pod，但是当一个新的节点加入集群时，它会立刻部署一个新的Pod的实例。若有人无意中删除一个节点上的Pod，那么DaemonSet会从Pod模板创建并部署一个新的Pod。

> DaemonSet一般用于`管理系统服务`，即使节点配置了不可调度，DaemonSet也会部署Pod到此节点。需要注意的是：`DaemonSet不会将Pod部署在master节点上`。

```yaml
apiVersion: apps/v1
kind: DaemonSet # 设置DaemonSet类型
metadata:
	name: ssd-monitor
spec:
	selector: # 指定标签选择器
		matchLabels:
			app: ssd-monitor
	template:
		metadata:
			labels:
				app: ssd-monitor
		spec:
			nodeSelector: # 这些Pod只能部署到disk=ssd的node节点上
				disk: ssd
			containers:
			- name: main
			  image: luksa/ssd-monitor
```

![](https://image.leejay.top/FkbSlaZKNoTvabGr9GyCuGNAwi0Z)

```shell
# 先将节点设置label： disk=ssd
kubectl label node k8s-node1 disk=ssd
# 创建daemonset
kubectl apply -f ssd-monitor-daemonset.yaml
# 我们修改node的标签为disk=hdd，ds管理的pod会被删除
kubectl label nodes k8s-node1 disk=hdd --overwrite
```

![](https://image.leejay.top/FvaUT7VzitLYrU55lEbuWJNAyFrv)![](https://image.leejay.top/FrNtnq91RiC-7jf0h33lVbICYBtz)

##### Job

相比之前的ReplicationController、ReplicaSet、DaemonSet持续运行任务，永远达不到完成态。`Job`提供了Pod在内部进程成功结束时，不重启容器。在发生节点故障时，由Job管理的Pod按照ReplicaSet的Pod方式重新安排到其他节点或`进程本身异常退出则重新启动容器`。

```yaml
apiVersion: batch/v1
kind: Job # 类型为Job
metadata:
	name: batch-job
spec:
	backoffLimit: 6 # job被标记为失败之前的重试次数，默认为6
    completions: 5  # 使得job顺序运行5个pod（如果其中失败一个，会重启一次，那么最终会超过5个）
    parallelism: 2 # pod并行运行的数量，job运行时最多有2个pod在运行
	template:
		metadata:
			labels:
				app: batch-job # 指定模板的label
		spec:
			activeDeadlineSeconds: 10 # 限制pod的运行时间，超过此时间会终止pod并标记为失败
			restartPolicy: OnFailure #重启策略不能时Always
			containers:
			- name: main
			  image: luksa/batch-job
```

```shell
# 创建job
kubectl apply -f job.yaml
# 查看job
kubectl get job
# 删除job，管理的pod也会被删除
kubectl delete job batch-job
# 修改job中pod的并行数量
kubectl edit job
```

> job管理的Pod任务完成后会显示`Completed`状态。

##### CronJob

相比Job，CronJob是基于Cron表达式的定时Job任务。

```yaml
apiVersion: batch/v1beta1
kind: CronJob # 类型为CronJob
metadata:
	name: batch-cron-job
spec:
	schedule: "*/1 * * * *"
	staringDeadlineSeconds: 15 # pod必须在指定时间后15s内开始运行
	jobTemplate:
		spec:
            template:
                metadata:
                    labels:
                        app: batch-job # 指定模板的label
                spec:
                    activeDeadlineSeconds: 10 # 限制pod的运行时间
                    restartPolicy: OnFailure #重启策略不能时Always
                    containers:
                    - name: main
                      image: luksa/batch-job
```

> Cron表达式不清楚的查看这篇文章<a href="https://leejay.top/post/linux%E4%B8%8Bcron%E5%AE%9A%E6%97%B6%E5%99%A8/">Cron表达式</a>。

#### 标签（label）

```yaml
apiVersion: v1 # 描述遵循V1版本的Api
kind: Pod # 描述一个pod
metadata: # 用于描述名称、命令空间、标签等其他容器信息
   name: kubia  # pod的名称
   labels: # 创建多个label
   	 creation_mode: manual
   	 env: prod
spec: # pod内容的实际说明，pod的容器、卷和其他数据
  containers:
  - image: xiaokexiang/kubia # 创建容器需要的镜像
    name: kubia # 容器的名称
    ports:
    - containerPort: 8080 # 应用监听的端口号
      protocol: TCP # 应用监听的协议
```

```shell
# 查看label标签
kubectl get pods --show-labels
# 查看creation_mode,env两个标签页
kubectl get pods -L creation_mode,env
# 给pod添加label标签 -> version: v1
kubectl label pod kubia version=v1
# 给已有的pod修改标签
kubectl label pod kubia env=dev --overwrite
# 列出env标签有值的pod
kubectl get pods -L env -l env
# 列出env标签值为dev的pod
kubectl get pods -L env -l env=dev
# 列出符合多个label标签条件的pod
kubectl get pods -L env -l env=dev,creation_mode=manual
# 列出不包含env标签的pod
kubectl get pods -L env -l '!env'
# 列出env标签值不为dev的pod(包含不存在env标签的值)
kubectl get pods -L env -l 'env!=dev'
# 列出env值 in (prod,env)的数据
kubectl get pods -L env -l 'env in (prod,dev)'
# 列出env值 not in (prod,env)的数据
kubectl get pods -L env -l 'env not in (prod,dev)'
# 删除指定标签的pod
kubectl delete pod -l env=dev
```

- 基于label的Pod调度

  ```shell
  # 给node添加label -> gpu=true
  kubectl label node k8s-node1 gpu=true
  # 查看gpu=true的node
  kubectl get node -L gpu -l gpu=true
  ```

  ```yaml
  apiVersion: v1 # 描述遵循V1版本的Api
  kind: Pod # 描述一个pod
  metadata: # 用于描述名称、命令空间、标签等其他容器信息
     name: kubia-gpu  # pod的名称
     labels:
        creation_mode: manual
        env: prod
  spec: # pod内容的实际说明，pod的容器、卷和其他数据
    nodeSelector:
      gpu: "true"  # 只将pod部署到gpu=true的pod上
    containers:
    - image: xiaokexiang/kubia # 创建容器需要的镜像
      name: kubia # 容器的名称
      ports:
      - containerPort: 8080 # 应用监听的端口号
        protocol: TCP # 应用监听的协议
  ```

#### 注解（annotation）

相比label而言，annotation不是为了保存标识信息而存在的，不能像label一样进行分组。主要是为了给api或者pod添加说明，且可以容纳更多的信息。

```shell
# 给pod添加注解
kubectl annotate pod kubia test/annotation="hello world"
# 查看pod的注解
kubectl describe pod kubia
```

#### 命名空间（namespace）

相比于label为pod指定一个或多个标签的作用，namespace提供了`一个命名空间内的资源名称唯一，两个不同的命名空间允许有相同的资源名称`的特性，提供了类似`作用域`的概念，每个命名空间内的相同资源互不影响。

> 命名空间提供了`隔离`的概念，但网络隔离取决于k8s集群的网络方案。如果网络不隔离的话，通过ip不同命名空间的资源是可以互相访问的。

```shell
# 获取所有的命名空间
kubectl get ns
# 查询指定命名空间下的pod
kubectl get pods -n kube-system
# 创建namespace:custom
kubectl create ns custom
# 创建指定namespace的pod
kubectl apply -f kubia-custom.yaml -n custom
# 删除指定的命名空间（pod也会被删除）
kubectl delete ns custom
# 删除当前命名空间下的所有pod
kubectl delete pods --all
# 删除当前命名空间的几乎所有资源
kubectl delete all --all
```

##### 切换命名空间

- 查看当前的namespace

```shell
kubectl config view
```

- 添加alias用于快速切换namespace

```shell
# 基于alias的命名空间切换,写入别名到.bashrc配置
cat << EOF >> ~/.bashrc
alias kcd='kubectl config set-context $(kubectl config current-context) --namespace'
EOF
source ~/.bashrc
# 切换到custom namespace
kcd custom
```

- 不使用alias切换

```shell
# 将当前context的namespace修改为default
kubectl config set-context --n defaultkubectl config set-context --current --namespace=default
```



#### Service

Kubernetes服务是为一组功能相同的Pod`提供单一不变的接入点的资源`。到达服务IP和端口的请求将被转发到属于该服务内的的容器的IP和端口。

Pod的存在是短暂的，一个Pod可能在任何时候消失，新生成的Pod和原有的Pod具有不同的IP地址，当服务被创建时，会得到一个静态的IP，客户端通过这个IP连接到服务，而不是直接连接Pod。

![](https://image.leejay.top/FvuVqEyEl5Hy5Ng_cWUcMV3RW7QQ)

```yaml
apiVersion: v1
kind: Service
metadata:
	name: kubia
spec:
	ports:
	- port: 80 # 服务可用端口
	  targetPort: 8080 # 服务转发到容器的端口
	selector:
		app: kubia # app=kubia的pod都属于该服务
```

```shell
# 将pod暴露成服务，po即pod的缩写
kubectl expose po kubia --type=LoadBalancer --name kubia-http
# 基于yaml创建service
kubectl apply -f kubia
# 查看服务 svc即service的缩写
kubectl get svc
# 集群内的服务访问（--表示k8s命令的结束）
kubectl exec kubia -- curl -s http://10.106.78.175
```

> ![](https://image.leejay.top/FkIeSzokhxq-kKyPDkk3kmf5ugxj)
>
> 也可以从Node节点上进行访问或创建Pod进行访问。
>
> ![](https://image.leejay.top/Fk59Yq-ILj98KL7lnQvTqPWPzkHs)

##### 服务亲和性

默认情况下服务代理通常将每个连接随机指向选中的后端Pod中的一个。如果我们希望客户端的所有请求都指向同一个客户端，配置服务`亲和性`可以实现该功能。

```yaml
apiVersion: v1
kind: Service
metadata:
	name: kubia
spec:
	sessionAffinity: ClientIP # 此参数会导致每次都请求同一个Pod（默认是None）
	ports:
	- port: 80 # 服务可用端口
	  targetPort: 8080 # 服务转发到容器的端口
	selector:
		app: kubia # app=kubia的pod都属于该服务
```

> 请求该Service，都会指向同一个Pod。

##### 服务暴露多个端口

```yaml
# 直接在yaml中配置Service的多port
apiVersion: v1
kind: Service
metadata:
	name: kubia
spec:
	ports:
	- name: http
	  port: 80 # 服务可用端口
	  targetPort: 8080 # 服务转发到容器的端口
	- name: https
	  port: 443
	  targetPort: 8443
	selector:
		app: kubia # app=kubia的pod都属于该服务
```

> `不同的端口在一个容器中只能适用于一个标签选择器`，若想分别对应不同的，需要多个容器。

```yaml
# 基于pod的yaml在service进行多port配置
kind: Pod
spec:
	containers:
	ports:
	- name: http
	  containerPort: 8080
	- name: https
	  containerPort: 8443
	  
kind: Service
spec:
	ports:
	- name: http
	  port: 80
	  targetPort: http # Pod中的名称
	- name: https
	  port: 443
	  targetPort: https # Pod中的名称
```

##### EndPoint

Pod与Service进行通讯是需要通过`EndPoint`来实现的，我们创建Service时可以不指定`标签选择器`，这样Service不知道我们需要管理哪些Pod，所以需要我们手动创建EndPoint

```yaml
# 创建不带Pod选择器的服务
apiVersion: v1
kind: Service
metadata:
	name: external-service # 这个名字必须与service配置名相同
spec:
	ports:
	- port: 80 # 只指定port不指定选择器

apiVersion: v1
kind: Endpoints
metadata:
	name: external-service # 这个名字必须与service配置名相同
subsets:
	- addresses:
	  - ip: 11.11.11.11 #服务将连接重定向到endpoint的ip地址
	  - ip: 22.22.22.22
	  ports:
	  - port: 80 # endpoint的目标端口
```

![](https://image.leejay.top/FiEc_ugGyuqbDUbBst6eMU_J1-1o)

##### 暴露服务给外部客户端

###### NodePort

将服务类型设置成NodePort（每个集群节点都会在节点上打开一个端口），该端口接受到的流量重定向到基础服务。

```yaml
apiVersion: v1
kind: Service
metadata:
	name: kubia-nodeport
spec:
	type: NodePort  # 为NodePort设置集群IP端口号
	ports:
	- port: 80 # 服务集群IP的端口号
	  targetPort: 8080 # Pod的目标端口号
      nodePort: 30123 # 通过集群节点的30123端口可以访问
    selector:
    	app: kubia
```

> 用户可以通过`$CLUSTER-IP:80`、`$MASTER-IP:30123`或`$NODE-IP:30123`进行访问。

###### LoadBalance

NodePort的一种扩展，服务可以通过一个负载均衡器来访问，负载均衡器将流量重定向到跨所有节点的节点端口，客户端通过负载均衡器的IP连接到服务。

```yaml
apiVersion: v1
kind: Service
metadata:
	name: kubia-loadbalancer
spec:
    externalTrafficcPolicy: Local # 外部访问的将重定向到同一节点上的Pod，不存在就挂起
	type: LoadBalancer
	ports:
	- port: 80
	  targetPort: 8080
	selector:
		app: kubia
```

> LoadBalancer基于NodePort并实现负载均衡，刚创建svc的时候k8s需要一些时间创建负载均衡器。
>
> 浏览器基于ip+port访问的时候，我们会发现每次访问的Pod都是相同的？
>
> 这和`会话亲和性`是没有关系的，即使设置成`sessionAffinity: None`，是因为浏览器基于`keep-alive`连接，而curl每次都会打开一个新的连接，首次打开与服务的连接时，会随机选择一个新的集群，将所有的数据发送到单个集群。所以只要换个tab页请求就能看到返回的Pod不一样了。

###### Ingress

创建一个Ingress资源，这是完全不同的机制，通过一个IP地址公开多个服务。

![](https://image.leejay.top/Fp9nlHS-n9i0lpzFe1fubWC_ktyc)

> 为什么需要Ingress呢？
>
> 相比每个LoadBalancer服务都需要自己的负载均衡器以及独有的公网IP地址。Ingress只需要一个公网IP就能够为许多服务提供访问，Ingress会根据客户端的请求的主机名和路径转发到对应的服务。

我们需要先创建`Ingress控制器`，继而通过控制器创建Ingress资源进行管理。此处我们安装Nginx-Ingress-Controller。

- 安装Nginx-Ingress-Controller

>  https://blog.csdn.net/qq_33430322/article/details/113885788

- 创建Ingress资源（同一个主机同一个路径）

```yaml
apiVersion: apps/v1 # 属于的版本号
kind: ReplicaSet
metadata:
  name: kubia-replicaset
  namespace: ingress-nginx
spec:
  replicas: 1
  selector:
    matchLabels: # 基于matchLabels选择器
      app: kubia
  template:
    metadata:
      namespace: ingress-nginx
      labels:
        app: kubia
    spec:
      containers:
      - name: kubia
        image: xiaokexiang/kubia
        ports:
          - containerPort: 8080
---

apiVersion: v1
kind: Service
metadata:
        name: kubia
        namespace: ingress-nginx
spec:
        type: NodePort # 不要求一定是NodePort
        ports:
        - port: 80 # 服务可用端口
          targetPort: 8080 # 服务转发到容器的端口
          nodePort: 30123
        selector:
                app: kubia # app=kubia的pod都属于该服务
---

apiVersion: extensions/v1beta1
kind: Ingress
metadata:
    name: kubia
spec:
	rules:
	- host: kubia.example.com
	  http:
      	paths:
     	- path: /
      		backend:
              serviceName: kubia-nodeport
              servicePort: 80 # 这里的端口不是30123是80（服务处理的是80）
```

> 1. `kubectl apply -f kubia-replicaset.yaml`基于rs创建Pod。
> 2. `kubectl apply -f kubia-servic.yaml` 创建svc服务。
> 3. `kubectl get ingress -n ingress-nginx`基于svc服务创建ingress。
> 4. 配置hosts映射，kubia.example.com 映射到 Node的ip地址。

![](https://image.leejay.top/Fo804pOzRSnMgcGTT2-okuw2hyo2)

- 创建Ingress资源（同一个主机不同路径）

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
    name: kubia
spec:
	rules:
	- host: kubia.example.com
	  http:
      	paths:
     	- path: /a
      		backend:
              serviceName: kubia
              servicePort: 80 # 这里的端口不是30123是80（服务处理的是80）
        - path: /b
            backend:
              serviceName: kubia-v2 # 不同的服务
              service: 80 
```

> `curl kubia.example.com/a`和`curl kubia.example.com/b`

- 创建Ingress资源（不同主机不同路径）

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
    name: kubia
spec:
	rules:
	- host: kubia.example.com
	  http:
      	paths:
     	- path: /a
      		backend:
              serviceName: kubia
              servicePort: 80 # 这里的端口不是30123是80（服务处理的是80）
    - host: foo.example.com
       http:
       	 paths:
       	 - path: /b
       	 	 backend:
       	 	   serviceName: kubia-v2
       	 	   servicePort: 80
```

> `curl kubia.example.com/a`和`curl foo.example.com/b`

- Ingress配置TLS认证

```shell
# 生成证书
openssl genrsa -out tls.key 2048
openssl req -new -x509 -key tls.key -out tls.cert -days 360 -subj /CN=kubia.example.com
# 生成secret
kubectl create secret tls tls-secret --cert=tls.cert --key=tls.key
```

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
        name: kubia
        namespace: ingress-nginx
spec: 
        tls: # 配置证书
        - hosts:
          - kubia.example.com
          secretName: tls-secret
        rules:
        - host: kubia.example.com
          http:
                paths:
                - path: /
                  backend: 
                        serviceName: kubia
                        servicePort: 80
```

#### 卷（服务挂载）

> `Pod中的每个容器都有自己独立的文件系统`，k8s通过`定义存储卷`来实现Pod在重启后能够识别前一个容器写入卷的所有文件，且存储卷可以被Pod内的所有容器使用。

k8s的卷是Pod的一个组成部分，不能单独创建和删除。Pod内的每个容器都可以使用卷，但必须要先将它挂载在每个需要访问它的容器中。

##### 卷的类型

| 类型     | 作用                                      |
| -------- | ----------------------------------------- |
| emptyDir | 用于存储临时数据的简单空目录              |
| hostPath | 用于将目录从工作节点的文件系统挂载到Pod中 |
| gitRepo  | 通过检出git仓库来初始化卷                 |
| nfs      | 挂载到Pod中的NFS共享卷                    |

- emptyDir

```yaml
apiVersion: v1
kind: Pod
metadata:
	name: fortune
spec:
	containers:
	- image: luksa/fortune
  	  name: html_generator
  	  volumeMounts:
  	  - name: html # 将html的卷挂载在容器内的/var/htdocs中
        mountPath: /var/htdocs
	- image: nginx:alpine
  	  name: web-server
      volumeMounts:
      - name: html # 将html的卷挂载在容器内的/usr/share/nginx/html中且是只读的
        mountPath: /usr/share/nginx/html
        readOnly: true
      ports:  # nginx暴露的端口号
      - containerPort: 80
        protocol:  TCP
    volumes: #创建名为html的emptyDir卷，挂载在上面两个容器中
	- name: html
  	  emptyDir: {}
  	# emptyDir:
  	  # medium: Memory # emptyDir的文件会被存储在内存中
```

> 在Pod中创建两个容器，基于挂载实现一个容器负责向指定目录写入文件内容，一个容器负责读取这个目录下的文件内容。

- gitRepo

相比emptyDir，gitRepo只是最初用Git仓库的内容填充了emptyDir。但是并不能和对应的仓库进行同步，卷重的文件不会被更新，但如果Pod是基于ReplicationController（或ReplicaSet）进行管理，那么通过删除Pod，重新创建时卷则会包含最新的内容。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gitrepo-volume-pod
spec:
  containers:
  - image: nginx:alpine # 创建nginx容器
    name: web-server
    volumeMounts:
    - name: html # 将html挂载到/usr/local/nginx/html目录下
      mountPath: /usr/local/nginx/html
      readOnly: true
    ports:
    - containerPort: 80
      protocol: TCP
  volumes:
  - name: html
    gitRepo: # 选择gitRepo
      repository: https://github.com/luksa/kubia-website-example.git
      revision: master # 分支
      directory: . # clone到根目录
```

> 或使用`gitsync sidecar`实现不删除重启容器，将更新内容挂载到目录实现动态更新。

- hostPath

hostPath卷指向节点文件系统上的特定文件或者目录。在同一个节点上运行并在其hostPath卷中使用相同路径的Pod可以看到相同的文件。

![](https://image.leejay.top/FoZsxQDiO8dZNKJjEkHMQ6YDIYyl)

> `hostPath`卷是`持久性`存储，之前的`emptyDir`和`gitRepo`都会随着Pod被删除时删除。
>
> 通常用于单节点集群中的持久化部署。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-hostpath
spec:
  containers:
  - image: nginx:alpine # 创建nginx容器
    name: web-server
    volumeMounts:
    - name: html
      mountPath: /usr/local/nginx/html
    ports:
    - containerPort: 80
      protocol: TCP
  volumes:
  - name: html
    hostPath:
      path: /opt/nginx # 挂载节点上的文件系统
      type: DirectoryOrCreate # 目录不存在就创建
#       type: FileOrCreate # 文件不存在就创建
```

> 我们需要查看Pod在哪个node节点，那么就去node节点上的文件系统查看。

##### 持久卷与持久卷声明

![](https://image.leejay.top/Ftq8UQJwkhQKKcvVhRAgl1eO5fec)

> 当集群用户需要在其Pod使用持久化存储时，他们首先创建持久化声明（PersistentVolumeClaim）清单，指定所需要的`最低容量要求和访问模式`。
>
> 持久卷声明可以当作Pod中的一个卷来使用，其他用户不能使用相同的持久卷（除非先删除）。

- 持久卷

`Persistent Volume（pv）`持久卷，相对于`Volumes`存储一些有必要保存的数据，它主要是为了管理集群的存储。且它相对于Pod独立创建。

```yaml
# 持久化卷
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongodb-pv
spec:
  capacity:
    storage: 200Mi
  volumeMode: Filesystem # 默认值，或设置Block（块设备）
  accessModes:
  - ReadWriteOnce # 被单个客户端挂载为读写模式
  - ReadOnlyMany # 被多个客户端挂载为读模式
 #- ReadWriteMany # 被多个客户端挂载为读写模式 
  persistentVolumeReclaimPolicy: Recycle # 当pvc被释放后的操作，pv被回收，或者Retain/delete保留
  storageClassName: ""
  local: # 基于本地的pv
    path: /opt # 本地磁盘的路径
  nodeAffinity: # 设置Node的亲和性
    required: # 使用此块pv的node必须在k8s-node1上
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - k8s-node1
```

- 持久卷声明

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
spec:
  resources:
    requests:
      storage: 100Mi # 申请1GB的空间
  accessModes:
  - ReadWriteOnce # 允许单个客户端访问（同时支持读和写）
  storageClassName: ""
```

> 当我们创建好持久卷声明（pvc）后，k8s会找到适当的持久卷并绑定该声明（`持久卷容量必须大于声明的需求`）
>
> - 查看pv![](https://image.leejay.top/FidraFaWFpAyG2h2dU9xl3aaHShg)
>
> - 查看pvc![](https://image.leejay.top/FlMTXuf6shrSsakF-dlO83cwsEOI)

- Pod中使用持久卷声明

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mongodb
spec:
  containers:
  - image: mongo
    name: mongodb
    volumeMounts:
    - name: mongodb-data
      mountPath: /data/db # 容器内的/data/db挂载pvc
    ports:
    - containerPort: 27017
      protcol: TCP
  volumes:
  - name: mongodb-data # 与上面的挂载名称对应
    persistentVolumeClaim:
     claimName: mongodb-pvc # 此处是上文的pvc名称
```

> 将PVC和Pod进行挂载。
>
> ![](https://image.leejay.top/FobLQT8OqAUSBPhp132uRWFdr5n4)
>
> 如果我们删除Pod，那么Pod绑定的PVC还存在，那么新的Pod可以读取前一个Pod存放的数据。我们可以通过配置PV中的`persistentVolumeReclaimPolicy`参数为`Recycle`进行回收。

#### ConfigMap & Secret

##### 在容器中指定环境变量

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: env-pod
spec:
  containers:
  - image: luksa/fortune:env
    name: html-generator
    volumeMounts:
    - name: local
      mountPath: /var/htdocs/index.html
    env:
    - name: INTERVAL # key java: System.get("INTERVAL")
      value: "30" # 字符串不需要引号，数值需要
  volumes:
  - name: local
    hostPath:
      path: /opt/nginx/index.html
      type: FileOrCreate
```

> 参数在Pod的yaml中指定。一旦创建不能修改。
>
> ```yaml
> env:
> - name: name1
>   value: hello
> - name: name2
>   value: "${name1} world" # 引用第一个变量的值
> ```

##### ConfigMap

k8st允许将配置分离到单独的资源配置对象ConfigMap中，本质就是一个键值对。应用无需读取ConfigMap，映射的内容通过环境变量或卷文件的形式传递给容器。通过`${ENV_VAR}$`的形式引用环境变量。

- 基于命令创建

```shell
# 创建configMap key-value为 sleep-interval: 25
kubectl create configmap fortune-config --from-literal=sleep-interval=25 --from-literal=hello=world

# 从配置文件中读取value[]
kubectl create configmap fortune-config-v2 --from-file=custom-key=config.conf
```

- 基于yaml创建

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fortune-config
data:
  sleep-interval: "25"
```

- ConfigMap中某个条目作为环境变量

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fortune-env-configmap
spec:
  containers:
  - image: luksa/forune:env
    env:
    - name: INTERVAL  # key
      # value来自fortune-config中的sleep-interval
      valueFrom: 
        configMapKeyRef:
          name: fortune-config
          key: sleep-interval
```

> 如果ConfigMap不存在，那么Pod会启动失败，等到此ConfigMap存在了就自动启动，无需重新创建。

- ConfigMap的所有条目作为环境变量

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fortune-env-all-pod
spec:
  containers:
  - image: luksa/fortune:env
    envFrom:
    - prefix: CONFIG_  # 所有的前缀都加上CONFIG_
      configMapRef:
        name: fortune-env # 引用哪个configmap
```

> 如果ConfigMap中存在非法的key（例如hello-world），那么创建环境变量时会被自动忽略。

- ConfigMap中的某个条目作为命令行参数

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fortune-arg-configmap
spec:
  containers:
  - image: luksa/fortune:args
    env:
    - name: INTERVAL
      valueFrom:
        configMapKeyRef:
          name: fortune-config
          key: sleep-interval
    args: ["${INTERVAL}"]
```

- 基于文件传递大配置文件

```shell
# 创建nginx配置文件
cat >> ./nginx-config.conf <<EOF 
  server {
   listen    80;
   server_name www.kubia-example.com;
   
   gzip on;
   gzip_types text/plain application/xml;
   
   localtion / {
     root /usr/share/nginx/html;
     index index.html index.htm;
   }
}
EOF

# 基于文件创建配置
kubectl create configmap fortune-config --from-file=nginx.conf
```

- 基于yaml传递大配置文件

```yaml
# configMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: fortune-config
data:
  my-nginx-config: |
    server {
      listen 80;
      server_name www.kubia-example.com;
    
      gzip on;
      gzip_type text/plain application/xml;
    
      location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
      }
    }
  sleep-interval: |
    25
```

> configMap的namespace必须与pod的相同，且创建早于Pod。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fortune-configmap-volume
spec:
  containers:
  - image: nginx:1.19.2
    name: web-server
    volumeMounts:
    - name: config
      mountPath: /etc/nginx/conf.d #容器内部挂载的容器
      readOnly: true
  volumes:
  - name: config
    configMap:
      name: fortune-config # 引用上文创建的CM
      defaultMode: 0777 # 设置权限
```

> 如果我们不想挂载整个卷，只想挂载某个文件，可以进行如下配置：
>
> ```yaml
> volumes:
>   - name: config
>     configMap:
>       name: fortune-config # 引用上文创建的CM
>       items:
>       - key: my-nginx-config # 指定对应的key
>         path: gzip.conf # 将值存储在这个文件中
> ```
>
> 
>
> `默认情况下挂载文件夹内的原有文件会被隐藏。`如果我们想原有的文件不被隐藏，需要使用`subPath`参数。
>
> ```yaml
> volumeMounts:
>   - name: config
>     mountPath: /etc/something.conf # 挂载至某一文件
>     subPath: myconfig.conf # 挂载指定cm：config中的条目
> ```
>
> `整个卷挂载`的文件在修改后会被应用监听到进行重载，`只挂载部分文件`则不会进行热更新。

##### Secret

- 默认令牌Secret

每个Pod都会被自动挂载上一个Secret卷，包含三个条目：`ca.crt`、`namespace`、`token`。

```shell
# 查看secret下的文件
kubectl exec pod ls /var/run/secrets/kubernetes.io/serviceaccount/
```

- 创建secret

```shell
# 生成证书
openssl genrsa -out https.key 2048
openssl req -new -x509 -key https.key -out https.cert -days 360 -subj /CN=www.kubia-example.com
# 生成secret
kubectl create secret generic fortune-https --from-file=https.key --from-file=https.cert --from-file=foo
```

> 上文在基于ingress处理网络时就使用了secret。

- 查看secret

![](https://image.leejay.top/FrQrlr-tf5mO-p10qKILkz0hXEGZ)

> secret中的data会经过`base64`编码处理。目的是为了二进制数据也可以转换为纯文本。

- Pod中使用secret

```yaml
# configMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: fortune-config
data:
  my-nginx-config.conf: |
    server {
      listen                80;
      listen                443 ssl;
      server_name           www.kubia-example.com;
      ssl_certificate       certs/https.cert;
      ssl_certificate_key   certs/https.key;  
      ssl_protocols         TLSv1 TLSv1.1 TLSv1.2;
      ssl_ciphers           HIGH:!aNULL:!MD5;

      location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
      }
     }
  sleep-interval: |
    25
```

> 配置文件的当前目录是`/etc/nginx`。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: fortune-https
spec:
  containers:
  - image: luksa/fortune:env
    name: html-generator
    env:
    - name: INTERVAL
      valueFrom:
        configMapKeyRef: # 获取cm中的value
          name: fortune-config
          key: sleep-interval
    volumeMounts:
    - name: html
      mountPath: /var/htdocs
  - image: nginx:1.19.2
    name: web-server
    volumeMounts:
    - name: html
      mountPath: /usr/share/nginx/html
      readOnly: true
    - name: config  # https.conf 放到此目录下
      mountPath: /etc/nginx/conf.d
      readOnly: true
    - name: certs # secret中存放的证书放到此目录下
      mountPath: /etc/nginx/certs/
      readOnly: true
    ports:
    - containerPort: 80
    - containerPort: 443
  :
  - name: html
    emptyDir: {}
  - name: config
    configMap:
      name: fortune-config
      items:
      - key: my-nginx-config.conf
        path: https.conf
  - name: certs
    secret: # 将secret挂载，需要和https.conf
      secretName: fortune-https
```

```yaml
# 基于环境变量使用secret
apiVersion: v1
kind: Pod
metadata:
  name: fortune-https
spec:
  containers:
  - image: luksa/fortune:env
    name: html-generator
    env:
    - name: FOO_SECRET
      valueFrom:
        secretKeyRef:
          name: fortune-https #secret名称
          key: foo # 对应的key
```

> `curl https://localhost -k`进行https测试。

#### Downward API

将Pod的元数据（`事先无法知道的数据，ex Pod名`，Yaml中已定义的数据）通过`环境变量或文件`的方式给Pod内的容器调用。

![](https://image.leejay.top/Fo2PkMv00ZDKljelL67DkSjDjfE1)

> Pod manifest是预先定义的数据，还有容器运行后才知道的数据，都交予downwardAPI进行暴露。

DownwardAPI可以传递：`Pod名称`、`Pod IP`、`Pod的ns`、`Pod运行节点的名称`、`Pod运行所属服务账号的名称`、`每个容器请求的CPU和内存使用量`、`每个容器可以使用的CPU和内存的限制`、`Pod的标签`、`Pod的注解`。

- 基于环境变量暴露

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: downward
spec:
  containers:
  - name: main
    image: busybox
    command: ["sleep", "99999999"]
    resources:
      requests: # 限制cpu和内存大小
        cpu: 100m
        memory: 90Mi
      limits:
        cpu: 100m
        memory: 90Mi
    env:
    - name: POD_NAME
      valueFrom:
        fieldRef:
          fieldPath: metadata.name
    - name: POD_NAMESPACE
      valueFrom:
        fieldRef:
          fieldPath: metadata.namespace
	- name: POD_IP
      valueFrom:
        fieldRef:
          fieldPath: status.podIP
	- name: NODE_NAME
      valueFrom:
        fieldRef:
          fieldPath: spec.nodeName
	- name: SERVICE_ACCOUNT
      valueFrom:
        fieldRef:
          fieldPath: spec.serviceAccountName
	- name: CONTAINER_CPU_REQUEST_MILLICORES
      valueFrom:
        resourceFieldRef:
	      resource: requests.cpu
          divisor: 1m # 定义基数单位 
	- name: CONTAINER_MEMORY_LIMIT_KIBIBYTES
      valueFrom:
        resourceFieldRef:
	      resource: limits.memory
          divisor: 1Ki # 定义基数单位 
```

> 通过查看Pod的环境变量，确定DownwardAPI是否生效
>
> ```shell
> kubectl exec downward -- env
> ```
>
> ![](https://image.leejay.top/Fghh0IPjOfaMPgd-7nAAiQGeGkz4)

- 基于卷暴露

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: downward2
  labels:
    foo: bar
  annotations:
    key1: value1
    key2: |
      multi
      line
      value
spec:
  containers:
  - name: main
    image: busybox
    command: ["sleep", "99999999"]
    resources:
      requests: # 限制cpu和内存大小
        cpu: 100m
        memory: 90Mi
      limits:
        cpu: 100m
        memory: 90Mi
    volumeMounts:
    - name: downward
      mountPath: /etc/downward
  volumes:
  - name: downward
    downwardAPI:
      items:
        - path: "podName"
          fieldRef:
            fieldPath: metadata.name
        - path: "podNamespace"
          fieldRef:
            fieldPath: metadata.namespace
        - path: "labels"
          fieldRef:
            fieldPath: metadata.labels
        - path: "annotations"
          fieldRef:
            fieldPath: metadata.annotations
        - path: "containerCpuRequestMilliCores"
          resourceFieldRef:
            containerName: main
            resource: requests.cpu
            divisor: 1m # 定义基数单位 
        - path: "containerMemoryLimitBytes"
          resourceFieldRef:
            containerName: main
            resource: limits.memory
            divisor: 1Ki # 定义基数单位
```

> `kubectl exec downward2 -- ls -lL /etc/downward`
>
> ![](https://image.leejay.top/FjwibRAMwynGFzv_weiLA1htDV4l)

#### Kubernetes API

```shell
# 查看集群信息
kubectl cluster-info
# 开启代理
kubectl proxy
> Starting to serve on 127.0.0.1:8001

# 查看Kubernetes API
curl localhost:8001
# 在拥有svc服务的pod上访问
curl https://kubernetes -k
# 将CA证书写入环境变量
export CURL_CA_BUNDLE=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
# 为API服务器授权
# 1. 将token作为环境变量
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
# 2. curl访问
curl -H "Authorization: Bearer $TOKEN" https://kubernetes
```

```yaml
# 基于ambassador容器简化与API服务器的交互
apiVersion: v1
kind: Pod
metadata:
  name: curl-with-ambassador
spec:
  containers:
  - name: main
    image: tutum/curl
    command: ["sleep", "9999999"]
  - name: ambassador
    image: luksa/kubectl-proxy:1.6.2
```

### Deployment

#### 更新策略

- 直接删除所有现有的pod，然后创建新的pod（`存在一段时间服务不可用`）。
- 创建新的pod，等待成功运行后，再删除旧的pod（`需要更多的硬件资源`）。
- 创建新的pod，等待成功运行后，按照创建顺序删除旧的pod（又称为`滚动升级`）。

Deployment是一种更高阶资源，用于部署应用程序并以`声明的方式`升级应用（RS和RC属于更底层的概念）。当创建一个Deployment时，ReplicaSet资源也会随之创建，实际的Pod是由Deployment的ReplicaSet创建和管理的，而不是Deployment直接创建和管理。

> Deployment可以用于协调多个RC来管理Pod，实现Pod的升级、扩容等功能。

```yaml
# Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubia-deployment-v1
  labels:
    app: kubia
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kubia
  template:
    metadata:
      labels:
        app: kubia
    spec:
      containers:
      - name: nodejs
        image: luksa/kubia:v1
---
# service
apiVersion: v1
kind: Service
metadata:
  name: kubia
spec:
  sessionAffinity: ClientIP # 默认None
  type: LoadBalancer
  ports:
  - port: 80 # 服务可用端口
    targetPort: 8080 # 服务转发到容器的端口
  selector:
    app: kubia # app=kubia的pod都属于该服务
```

> `kubectl apply -f kubia-deployment-v1.yaml --record` 
>
> Deployment会负责创建一个ReplicaSet管理Pods，`--record`用于记录历史版本号。
>
> `kubectl rollout status deployment kubia-deployment-v1`查看升级状态。

#### Deployment升级

默认情况下是执行`滚动升级（RollingUpdate）`策略。还有`删除再创建（Recreate）`策略，一次删除全部旧的Pod再创建新的Pod。需要注意的是，只有我们`修改了Pod模板`才会导致Deployment的更新。

```shell
# 减缓滚动升级速度,patch命令修改Deployment的自有属性，不会触发Pod的任何更新
kubectl patch deployment kubia-deployment-v1 -p '{"spec": {"minReadySeconds": 10}}'
# 更新镜像为luksa:v2
kubectl set image deployment kubia-deployment-v1 nodejs=luksa/kubia:v2
# 循环请求服务（开窗口并行）
while true; do curl 10.110.71.58; sleep 2; done
```

> 执行滚动升级后，新的容器启动后会依次关闭旧的容器。
> ![](https://image.leejay.top/FmZFe4RW8DYoHNd-XzpFGBOrKrS9)
>
> ![](https://image.leejay.top/Ft-OGwUJpSsUoP4-I8-Knkwoojd2)
>
> 另一边我们可以看到请求的响应由V1变为了V2。![](https://image.leejay.top/Fm9IKNeQZbAwue3BZZNQddMjo0KB)

#### Deployment修改方式

| 方法                 | 作用                                                         |
| -------------------- | ------------------------------------------------------------ |
| **kubectl edit**     | 使用默认编辑器打开资源配置。`kubectl edit deployment kubia`  |
| **kubectl patch**    | 修改单个属性。`kubectl patch deployment Kubia -p '{"spec": {"minReadySeconds": 10}}'` |
| **kubectl apply**    | 通过完整的yaml或json文件修改对象。`kubectl apply -f kubia.yaml` |
| **kubectl replace**  | 替换原有yaml或json创建的对象。`kubectl replace -f kubia.yaml` |
| **kubectl setimage** | 修改pod、rc、rs、deploymeny、ds、job内的镜像。`kubectl set image deployment kubia nodejs=luksa:v2` |

#### Deployment回滚

```shell
# 升级到v3版本用于后面回滚
kubectl set image deployment kubia-deployment-v1 nodejs=luksa/kubia:v3
# 回滚当前版本到上一个版本
kubectl rollout undo deployment kubia-deployment-v1
# 查看滚动升级历史
kubectl rollout history deployment kubia-deployment-v1
# 回滚到指定版本（history可以看到）
kubectl rollout undo deployment kubia-deployment-v1 --to-revision=1
# 暂停升级
kubectl rollout pause deployment kubia-deployment-v1
# 恢复升级
kubectl rollout resume deployment kubia-deployment-v1
```

> 如果在升级过程中运行回滚，那么会直接停止滚动升级。已创建的Pod会被老Pod替代。

#### Deployment升级策略

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubia-deployment-v1
  labels:
    app: kubia
spec:
  minReadySeconds: 10  # Pod需要至少运行10s后才能视为可用（探针）
  strategy:
    rollingUpdate:
      maxSurge: 1 # 基于期望的副本数上Pod最多允许超过的数量（3+1）
      maxUnavailable: 0 # 最多不可以Pod数量
    type: RollingUpdate # 滚动升级
  replicas: 3
  selector:
    matchLabels:
      app: kubia
  template:
    metadata:
      labels:
        app: kubia
    spec:
      containers:
      - name: nodejs
        image: luksa/kubia:v1
```

![](https://image.leejay.top/Fk9PDjz3r31aO1q4uPLMF9Qx34Fa)

#### Deployment配置就绪探针

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubia-deployment-v1
  labels:
    app: kubia
spec:
  minReadySeconds: 10  # Pod需要至少运行10s后才能视为可用（用于就绪探针工作）
  progressDeadlineSeconds: 300 # 设置滚动升级超过5分钟就失败
  strategy:
    rollingUpdate:
      maxSurge: 1 # 基于期望的副本数上Pod最多允许超过的数量（3+1）
      maxUnavailable: 0 # 最多不可以Pod数量
    type: RollingUpdate # 滚动升级
  replicas: 3
  selector:
    matchLabels:
      app: kubia
  template:
    metadata:
      labels:
        app: kubia
    spec:
      containers:
      - name: nodejs
        image: luksa/kubia:v1
        readinessProbe: # 定义就绪探针每隔1s执行依次
          periodSeconds: 1
          httpGet:
            path: /  # 发送http get请求
            port: 8080
```

> 当Deployment进行Pod升级的时候，就绪探针每隔1s会发起一次请求，请求失败后被标记为`未就绪`。![](https://image.leejay.top/Fi2BLLwSimFPEcFghGrNXhNurtwk)
>
> Pod成功的有3个，没有ready的就是就绪探针探测不可用的Pod（升级失败）。
>
> 默认`10分钟`内不能完成滚动升级，就会视为失败。![](https://image.leejay.top/FtGEDC_M-jGuiXty8nVjwlpReyws)

### StatefulSet

它是专门定制的类应用，这类应用中的每一个实例都是不可替代的个体，都有稳定的名字、存储和状态。而这些Pod又称为`有状态Pod`。

> 相比于ReplicaSet、ReplicaController，StatefulSet创建的`Pod应用都可以拥有一组独立的数据卷`，且创建的Pod名字都是规律的，不是随机的。StatefulSet在某个节点失效时，创建与之前`一模一样`的Pod，而其他的则是使用一个不相干的新的Pod替换。并且`修改StatefulSet的配置后并不会重新启动Pod（删除Pod可以触发）`，这点和RS相同。
>
> ![](https://image.leejay.top/Fs_BdvUPHXrdxCft8aWwrDpEx21F)

```yaml
# 需要创建持久卷,statefulset里面几个副本就创建几个持久卷
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv
spec:
  capacity:
    storage: 200Mi
  volumeMode: Filesystem # 默认值，或设置Block（块设备）
  accessModes:
  - ReadWriteOnce # 被单个客户端挂载为读写模式
  - ReadOnlyMany # 被多个客户端挂载为读模式
  - ReadWriteMany # 被多个客户端挂载为读写模式 
  persistentVolumeReclaimPolicy: Recycle # 当pvc被释放后的操作，pv被回收
  local:
    path: /opt # 本地磁盘的路径
  nodeAffinity: # 设置Node的亲和性
    required: # 使用此块pv的node必须在k8s-node1上
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - k8s-node1
```

```yaml
# 需要先创建用于有状态Pod之间提供网络标识的headless service
apiVersion: v1
kind: Service
metadata:
  name: kubia-stateful
spec:
  clusterIP: None # headless核心
  selector:
    app: kubia
  ports:
  - name: http
    port: 80
```

```yaml
# statefulSet
apiVersion: apps/v1beta1
kind: StatefulSet
metadata:
  name: kubia-stateful
spec:
  serviceName: kubia
  replicas: 2
  selector:
    matchLabels:
      app: kubia
  template:
    metadata:
      labels:
        app: kubia
    spec:
      containers:
      - name: kubia
        image: luksa/kubia-pet
        ports:
        - name: http
          containerPort: 8080
        volumeMounts:
        - name: data
          mountPath: /var/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      resources:
        requests:
          storage: 1Mi
      accessModes:
      - ReadWriteOnce
```

> `statefulSet`会等到第一个Pod启动完毕后才会启动第二个Pod。如果某个Pod被删除，那么statefulSet会创建一个新的Pod（标识符、存储相同的新Pod，`新旧Pod不一定会在一个node上`）。
>
> ![](https://image.leejay.top/FgjEI4fIfZEuQeKMB_HqPOsyoLA3)
>
> 我们可以通过`curl -X POST -d "Hey there! This greeting was submitted to kubia-0. " localhost:8001/api/v1/namespaces/default/pods/kubia-stateful-0/proxy/`前后访问两次来判断新旧Pod是否使用相同的存储空间和标识符。
>
> 如果我们需要对statefulSet进行缩容，那么会`优先删除索引值高`的Pod，然后再删除索引值次高的。