---
title: "Shell启动服务"
date: 2020-12-29T18:29:04+08:00
description: "shell脚本通过jar方式启动java服务"
weight: 3
tags: ["shell","linux"]
categories: [
  "Shell"
]
---

```shell
__dir__=/www/server/code/service-platform
__web__=ruoyi-web
__admin__=ruoyi-admin
__app__=("$__web__" "$__admin__")

# 使用说明，用来提示输入参数 
usage() {
    echo "Usage: sh deploy.sh [start|stop|restart|status]"
    exit 1
}

pull() {
    cd $__dir__
    git pull
    echo "git pull code success"
}

build_parent() {
    mvn clean install -Dmaven.test.skip=true -f $__dir__/pom.xml
}

build_module() {
    mvn clean package -Dmaven.test.skip=true -f $__dir__/$1/pom.xml
    echo "############# $1 Build success #############"
}

is_exist() {
    pid=$(ps -ef | grep $1 | grep -v grep | awk '{print $2}')
    #如果不存在返回1，存在返回0
    if [ -z "${pid}" ]; then
        return 1
    else
        return 0
    fi
}

backup() {
    __jar__=$1-$2.jar
    mv $__dir__/$1/target/$1.jar $__dir__/backup/$__jar__
    echo "############# $1 backup to $__dir__/backup/$__jar__ #############"
}

start() {
    pull
    mkdir -p $__dir__/{logs,backup}
    build_parent
    for name in ${__app__[@]}
    do
        __date__=`date +"%Y%m%d%H%M%S"`
        backup $name $__date__
        build_module $name
        is_exist $name
        if [ $? -eq "0" ]; then
            echo "${name} is already running. pid=${pid} ."
        else
            nohup java -jar $__dir__/$name/target/$name.jar --spring.profiles.active=druid>$__dir__/logs/$name$__date__.log 2>&1 &
            echo "${name} start success"
        fi
    done
}
#停止方法
stop() {
    for name in ${__app__[@]}
    do
    	is_exist $name
    	if [ $? -eq "0" ]; then
            kill -9 $pid
	    echo "kill ${name} success"
    	else
            echo "${name} is not running"
    	fi
    done
}
#输出运行状态
status() {
    for name in ${__app__[@]}
    do
        is_exist $name
        if [ $? -eq "0" ]; then
	    echo "${name} is running"
        else
            echo "${name} is not running"
        fi
    done
}
#重启
restart() {
    stop
    start
}
#根据输入参数，选择执行对应方法，不输入则执行使用说明
case "$1" in
"start")
    start
    ;;
"stop")
    stop
    ;;
"status")
    status
    ;;
"restart")
    restart
    ;;
*)
    usage
    ;;
esac
```

