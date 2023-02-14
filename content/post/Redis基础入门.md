---
title: "Redis基础入门"
date: 2021-01-28T11:10:39+08:00
tags: ["Redis"]
categories: [
  "Redis"
]
slug: redis_in_action
---

> 基于内存存储的`非关系型`数据库，支持五种数据结构，并支持`发布与订阅`、`主从复制`、`持久化`等功能。

<!--more-->
## Redis数据结构

### STRING

可以存储`字符串`、`整数`或`浮点数`。

| 命令        | 作用                                                        |
| ----------- | ----------------------------------------------------------- |
| GET         | 获取存储在指定key的值                                       |
| SET         | 设置存储在指定key的值                                       |
| DEL         | 删除存储在指定key的值(任何类型都通用)                       |
| INCR        | 将键存储的值加1                                             |
| DECR        | 将键存储的值减1                                             |
| INCRBY      | 将键存储的值加上整数                                        |
| DECRBY      | 将键存储的值减去整数                                        |
| INCRBYFLOAT | 将键存储的值加上浮点数                                      |
| APPEND      | 将value追加到旧值后，返回追加后值长度                       |
| GETRANGE    | 获取指定闭区间的字符串                                      |
| SETRANGE    | 从某个index开始替换字符串                                   |
| GITBIT      | 将字符串转换为二进制位串，并返回位串中指定index的二进制位值 |
| SETBIT      | 将二进制串中指定index替换为指定的值                         |
| BITCOUNT    | 统计二进制串中指定区间内值为1的数量                         |
| BITOP       | 将多个二进制位串进行位运算并把结果保存在指定key中           |

```shell
$ SET hello world
"OK"
$ GET hello
"world"
# 删除指定key的value，返回删除成功的数量
$ DEL hello
"1"
# 获取key的值不存在返回null
$ GET hello
(niL)
# 将hello追加到旧值后
$ APPEND hello hello
"10"
# 获取字符串[0,4]
$ GETRANGE hello 0 4
"hello"
# 换成hello world
$ SETRANGE 5 world
"10"
```

> Redis中key`大小写敏感`，`GET HELLO` 不同于 `GET hello`。
>
> `keys *`可以查看全部的keys

### LIST

`LIST`列表结构可以`有序`、`重复`的存储`多个字符串`。类比Java中的`Map<key, List<String>>`结构。

| 命令   | 作用                                   |
| ------ | -------------------------------------- |
| LPUSH  | 将给定的值推入列表的`左端`             |
| RPUSH  | 将给定的值推入列表的`右端`             |
| LRANGE | 获取列表指定范围的所有值               |
| LINDEX | 获取列指定位置上的单个元素             |
| LPOP   | 从列表的`左端`移除一个值，并返回该值   |
| RPOP   | 从列表的`右端`移除一个值，并返回该值   |
| LTRIM  | 对列表进行`修剪`，只保留指定范围的元素 |
| LLEN   | 返回列表的长度                         |

```shell
# 左端推入一个值，并返回该key对应的列表数量
$ LPUSH list hello
"1"
$ RPUSH list world
"2"
$ LINDEX list 0
"hello"
$ LPUSH list say
# 查询列表的全部值
$ LRANGE list 0 -1
1)  "say"
2)  "hello"
3)  "world"
# 移除列表左端值并返回
$ LPOP list
"say"
# 移除列表右端值并返回
$ RPOP list
"world"
```

#### 阻塞式列表操作

| 命令                                     | 作用                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| BLPOP [key-name...] timeout              | 1. 从第一个非空列表弹出最`左端`的元素<br>2. 或在timeout秒之内阻塞并等待可弹出元素出现 |
| BRPOP  [key-name...] timeout             | 1. 从第一个非空列表弹出最`右端`的元素<br/>2. 或在timeout秒之内阻塞并等待可弹出元素出现 |
| RPOPLPUSH <source-key>  <dest-key>       | 从source中弹出最右边元素，<br>并推入dest最左端并返回该元素   |
| BRPOPLPUSH<source-key><dest-key> timeout | 相比`RPOPLPUSH`，如果source没有元素<br>那么会阻塞等待timeout |

> 以上四个command常用于`redis队列`。

```shell
# 弹出list最左端的元素(only one)，直到5s后超时
$ BLPOP list 5
 1)  "list"
 2)  "hello"
# 弹出source最右侧元素，推入dest最左侧
$ RPOPLPUSH source dest
null
# 弹出source最右侧元素，推入dest最左侧，阻塞直到timeout
$ BRPOPLPUSH source dest
<空>
```

### SET

`SET`集合结构可以`无序`、`不重复`的存储`多个字符串`。类比Java中的`Map<key, Set<String>>`结构。

| 命令                    | 作用                                                         |
| ----------------------- | ------------------------------------------------------------ |
| SADD                    | 将给定元素添加到集合中                                       |
| SMEMBERS                | 返回集合包含的所有元素                                       |
| SISMEMBER               | 检查指定元素是否存在集合中                                   |
| SREM                    | 如果给定的元素存在于集合中，那么移除该元素                   |
| `SCARD`                 | 返回集合中元素的数量                                         |
| SRANDMEMBER key [count] | 从集合里面随机返回一个或多个元素，count>0返回不重复，<0则会重复 |
| SPOP                    | 随机的从集合中移除一个元素并返回                             |
| SMOVE                   | 从source中移除元素并添加到dest中，成功为1，否则为0           |

```shell
# 添加元素到指定key的值集合中，返回添加的数量
$ SADD set hello world ya
"3"
# 获取集合中的全部元素
$ SMEMBERS set
1) "world"
2) "ya"
3) "hello"
# 查询hello是否存在key为set的值集合中
$ SISMEMBER set hello
"1"
$ SISMEMBER set hello1
"0"
# 如果hello存在key为set的值集合中，那么移除该元素
$ SREM set hello
"1"
$ SREM set hello
"0"
```

#### 多个集合的处理命令

| 命令                    | 作用                            |
| ----------------------- | ------------------------------- |
| SDIFF <key> [<key>...]  | 多个集合取`差集`                |
| SDIFFSTORE              | 多个集合取差集将结果存入某个key |
| SINTER <key> [<key>...] | 多个集合取`交集`                |
| SINTERSTORE             | 多个集合取交集将结果存入某个key |
| SUNION <key> [<key>...] | 多个集合取`并集`                |
| SUNIONSTORE             | 多个集合取并集将结果存入某个key |

```shell
$ SADD set1 hello
$ SADD set2 world
# 返回set1与set2的差集
$ SDIFF set1 set2
1)  "hello"
# 将差集结果存入res
$ SDIFFSTORE res set1 set2
"1"
# 取交集
$ SINTER set1 set2
<空>
# 取并集
$ SUNION set1 set2
"world"
"hello"
```

### HASH

`HASH`散列结构可以`无序`、`不重复`的存储多个`字符串或数值`类型的键值对。类比Java中`Map<key, HashMap<v1,v2>>`。

| 命令      | 作用                                   |
| --------- | -------------------------------------- |
| HSET      | 给指定的key关联键值对                  |
| HGET      | 获取指定的key的键值对中`指定键的值`    |
| HGETALL   | 获取指定key关联的全部键值对            |
| HDEL      | 如果键值对中存在指定键，那么移除这个键 |
| HINCRBY   | 将键值对中键的值增加指定数量           |
| HLEN      | 返回`HASH`中键值对数量                 |
| HMGET     | 批量获取一个或多个键的值               |
| HMSET     | 批量的设置一个或多个键的值             |
| `HEXISTS` | 检查指定键是否存在散列中               |
| HKEYS     | 获取散列包含的所有键                   |
| HVALS     | 获取散列包含的所有值                   |
| HGETALL   | 获取散列包含的全部键值对               |

```shell
# 给key为hash的设置键值对，如果键值对中的键存在，那么返回0，否则返回1
$ HSET hash hello world
(integer)1
$ HSET hash hello world
(integer)0
$ HSET hash ni hao
(integer)1
# 获取指定key的键值对中指定键的值
$ HGET hash hello
"world"
# 获取指定key的全部键值对
$ HGETALL hash
"hello"
"world"
"ni"
"hao"
# 若键值对中存在指定键hello和ni，那么移除它们
# 与DEL不同。后者删除全部的值
$ HDEL hash hello ni
(integer)2
$ HGETALL hash
(empty list or set)
```

### ZSET

`ZSET`结构是`有序`、`不重复`的存储多个键值对。其中有序集合的键被称为`成员(member)`，值被称为`分值(score)`，分值必须为浮点数。`ZSET`是redis中唯一一个既可以根据`成员`访问，也可以根据`分值及分值的排列顺序`来访问元素的结构。

| 命令                  | 行为                                         |
| --------------------- | -------------------------------------------- |
| ZADD key score member | 添加一个带有给定分值的成员添加到有序集合中   |
| `ZRANGE`              | 根据元素在ZSET中所处位置，从ZSET获取多个元素 |
| ZRANGEBYSCORE         | 获取ZSET在给定分值范围内的所有元素           |
| ZREM                  | 如果给定的成员存在ZSET集合，那么移除该成员   |
| ZINCRBY               | 将键值对中指定的键的分数增加指定数值         |
| `ZSOCRE`              | 输出键值对中指定键的分数                     |
| `ZCARD`               | 返回`ZSET`中成员数量                         |
| ZCOUNT                | 返回介于[min,max]之间分值元素的数量          |
| ZRANK                 | 返回元素在`ZSET`的排名                       |

```shell
# 添加元素到ZSET中，如果member存在，会返回0，否则为1
$ ZADD zset 100 first
(integer)1
$ ZADD zset 200 second
(integer)1
# 输出键为second的分数
$ ZSCORE zset second
"200"
# 查询指定index的元素，不包括score
$ ZRANGE zset 0 -1
"first"
"second"
# 查询指定index的元素，包括score
$ ZRANGE zset 0 -1 WITHSCORES
1) "first"
2) "100"
3) "second"
4) "200"
# 获取给定分值范围[0,100]内的从0开始的1个元素
$ ZRANGEBYSCORE zset 0 100 WITHSCORES LIMIT 0 1
1) "first"
2) "100"
# 若成员们存在ZSET，那么移除该成员们
$ ZREM zset first second
(integer) 2
# 将键为first的分数增加101
$ ZINCRBY zset 101 first
"201"
```

#### 有序集合命令

| 命令               | 作用                                                         |
| ------------------ | ------------------------------------------------------------ |
| ZREVRANK           | 返回`ZSET`中member的排名，按照分值从大到小排列               |
| `ZREVRANGE`        | 返回`ZSET`给定范围内的成员，按照分值从大到小排列             |
| `ZRANGEBYSCORE`    | 返回有序集合中分值介于[min,max]的所有成员，按照分值从小到大排列 |
| ZREVRANGEBYSCORE   | 与`ZRANGEBYSCORE`顺序相反，从大到小排列                      |
| ZREMRANGEBYRANK    | 移除`排名`介于[start,stop]之间的所有成员                     |
| `ZREMRANGEBYSCORE` | 移除`分值`介于[min,max]之间的所有成员                        |
| `ZINTERSCORE`      | 对于多个`ZSET`进行`交集`运算                                 |
| `ZUNIONSTORE`      | 对于多个`ZSET`进行`并集`运算                                 |

> `ZSET`默认按照`score升序`排序。

```shell
# 定义如下zset集合
$ ZRANGE zset 0 -1 WITHSCORES	
1)  "n2"
2)  "5"
3)  "n1"
4)  "10"
5)  "n3"
6)  "15"
# 获取n3的排名
$ ZREVRANK zset n3
"0"
# 降序获取范围内元素
$ ZREVRANGE zset 0 -1 WITHSCORES
1)  "n3"
2)  "15"
3)  "n1"
4)  "10"
5)  "n2"
6)  "5"
# 返回分数在[6,10]内，index=0开始的第一个元素
$ ZRANGEBYSCORE zset 6 10 WITHSCORES LIMIT 0 1

# 定义两个ZSET集合
$ ZRANGE zset-1 0 -1 WITHSCORES
1)  "a"
2)  "1"
3)  "b"
4)  "2"
5)  "c"
6)  "3"
$ ZRANGE zset-2 0 -1 WITHSCORES
1)  "d"
2)  "0"
3)  "c"
4)  "1"
5)  "b"
6)  "4"
# 多个`ZSET`进行交集运算,取分值最大的哪个作为新的key中的score
$ ZINTERSTORE zinter 2 zset-1 zset-2 AGGREGATE MAX
"2"
# 多个`ZSET`进行并集运算,取分值综合作为新的key中的score
$ ZUNIONSTORE zunion 2 zset-1 zset-2 AGGREGATE SUM
"4"
```

---

## 发布与订阅

> `发布与订阅(pub/sub)`的特点是`订阅者(subscribe)`负责订阅`频道(channel)`，`发布者(publisher)`负责向频道中发送`二进制字符串`消息。
>
> ![](https://image.leejay.top/image/20200914/PGhhPKDQGtFh.png?imageslim)

| 命令                        | 作用                                   |
| --------------------------- | -------------------------------------- |
| SUBSCRIBE [ channel ... ]   | 订阅一个或多个频道                     |
| UNSUBSCRIBE [ channel ... ] | 退订一个或多个频道，不传频道就退订全部 |
| PUBLISH <channel> <message> | 向给定频道发送消息                     |
| PSUBSCIBE [ pattern ...]    | 订阅正则匹配的所有频道                 |
| PUNSUBSCRIBE []             | 退订正则匹配的模式，不传默认退订全部   |

```shell
# 订阅channel
$ SUBSCRIBE channel
1)  "subscribe"
2)  "channel"
3)  "1"
# 向频道发送消息
$ PUBLISH channel helloworld
 1)  "message"
 2)  "channel"
 3)  "helloworld"
```

```python
def publish():
    # 用于连接时长
    time.sleep(2)
    for i in [1, 2, 3, 4, 5, 6]:
        connection.publish('channel', i)


def subscribe(conn):
    # 启动线程发送消息
    threading.Thread(target=publish, args=()).start()
    # 获取发布/订阅对象
    pub_sub = conn.pubsub()
    # 订阅频道,一开始会出现确认信息：data表示此频道被订阅数量
    # {'type': 'subscribe', 'pattern': None, 'channel': b'channel', 'data': 1}
    pub_sub.subscribe('channel')
    count = 0
    for item in pub_sub.listen():
        # {'type': 'message', 'pattern': None, 'channel': b'channel', 'data': b'1'}
        print(item)
        count += 1
        if count == 5:
         # 取消订阅也会出现信息：data表示此频道被订阅数量
         #{'type': 'unsubscribe', 'pattern': None, 'channel': b'channel', 'data': 0}
            pub_sub.unsubscribe('channel')
```

> `发布/订阅`模式的两个缺点：
>
> 1. 如果客户端订阅了某些频道，但是它的消费速度不够快，带来的消息堆积会导致Redis速度变慢
> 2. 数据的可靠性问题，如果出现网络断开的情况，消息的丢失如何处理的问题。

---

## 其他命令

### 排序

类似关系型数据库中的`order by`关键字

| 命令                                                         | 作用                   |
| ------------------------------------------------------------ | ---------------------- |
| SORT source-key [LIMIT offset count] [alpha] [ASC\|DESC] [STORE dest-key] | 根据条件进行排序并保存 |

```shell
# 模拟数据
$ RPUSH list 0 1 10 12 5 9 6
$ LRANGE list 0 -1
1)  "0"
2)  "1"
3)  "10"
4)  "12"
5)  "5"
6)  "9"
7)  "6"
# 倒序展示5个元素
$ SORT list LIMIT 0 5 DESC
1)  "12"
2)  "10"
3)  "9"
4)  "6"
5)  "5"
# 正序并将结果保存到dest
$ SORT list LIMIT 0 5 ALPHA ASC STORE dest
"5"
$ LRANGE dest 0 -1
1)  "0"
2)  "1"
3)  "5"
4)  "6"
5)  "9"
```

> `ALPHA`表示对元素进行`字母表顺序`排序。
>
> `SORT`支持`LIST`、`HASH`、`SET`进行排序

### Redis基本事务

`Redis基本事务`：让一个客户端在不被其他客户端打断的情况下执行多个命令，这需要用到`MULTI`、`EXEC`命令，与关系型数据库不同是：被`MULTI`、`EXEC`包裹的所有命令会一个接一个的执行，直到所有命令执行完毕，当一个事务执行完毕后，`Redis`才会处理其他客户端的命令。

> Redis提供了5个命令用于不被打断的情况下对多键执行操作，它们分别是：`WATCH`、`MULTI`、`EXEC`、`UNWATCH`、`DISCARD`

Redis接受到`MULTI`命令时，会键之后收到的命令放入`队列`中，直到客户端发送`EXEC`。然后就会在不被打断的情况下一条一条的执行命令。python上的redis库是通过`pipeline`实现，将多个命令打包好再发送给redis，减少网络通信的往返次数。

```python
def incr_decr():
    # 获取队列
    pipeline = connection.pipeline()
    pipeline.incr('tran')
    time.sleep(1)
    pipeline.decr('tran')
    print(pipeline.execute()[0])

"""
三个线程事务的执行加减法
"""
def transaction():
    for i in range(3):
        threading.Thread(target=incr_decr).start()
    time.sleep(.5)
    
    
# result: 1 1 1
transaction()   
```

### 过期时间

>  `Redis`中可以通过设置`Expire time`来让键在给定的时间后自动被删除。

| 命令                   | 作用                                       |
| ---------------------- | ------------------------------------------ |
| PERSIST                | 移除键的过期时间                           |
| `TTL`                  | 查看指定键过期时间还有多少秒               |
| `EXPIRE` key second    | 给定键指定`秒`后过期                       |
| EXPIREAT key timestamp | 给定键指定`UNIX时间戳`格式后过期           |
| PTTL                   | 查看指定键过期时间还有多少`毫秒`           |
| PEXPIRE                | 给定键指定`毫秒`后过期                     |
| PEXPIREDAT             | 给定键指定`毫秒`级别`UNIX时间戳`格式后过期 |

> 对于`除了STRING`这样的结构来说，`EXPIRE`只会将`整个键过期`，而不会只过期其中的某条数据。

```shell
# 设置key-value
$ SET hello world
# 设置2s后过期,设为-1等于不过期
$ EXPIRE hello 2
# 2s后获取key对应的value不村子
$ GET hello
null
# 查看距离过期还有多久s
$ TTL hello
"10"
#如果已经过期返回-2
$ TTL hello
"-2"
# 如果未设置过期时间，返回-1
$ TTL demo
"-1"
```

---

## Redis持久化

> Redis提供了两种`持久化`方法用于将数据存储到硬盘：`快照(rdb)和只追加文件(aof)`。
>
> 这两种方法和可以同时使用，也可以单独使用。


### 快照

Redis可以通过创建`快照(snapshotting)`来获得存储在内存里面的数据在`某个时间点`上的副本。若在新的快照文件创建完毕之前，系统、redis或硬件中任意一个崩溃，那么Redis将会`丢失`最近一次创建快照之后写入的所有数据。

> 快照的持久化方式适合`即使丢了一部分数据也不会造成问题的应用程序`，redis中是默认开启的。

#### 快照的创建方式

- `BGSAVE`命令创建快照，Redis会调用`fork`来创建一个子进程，然后子进程负责将`快照写入磁盘`，而父进程负责继续处理命令请求。

  > 当一个线程创建子进程时，系统底层会创建该`进程的一个副本。在unix系统中，刚开始时，父子进程`共享相同的内存`，直到父或子进程对内存进行写入后，对被写入内存的共享才会结束

- `SAVE`命令创建快照，Redis服务器接收到此请求后，在快照创建完成之前`不会响应`任何其他命令。该命令一般只在没有足够内存执行`BGSAVE`命令时才会使用。
- `SAVE 60 1000`命令，从Redis最近一次创建快照之后算起，当`60s内有1000次写入`这个条件被满足，Redis会自动触发`BGSAVE`命令。任意一个`SAVE ？ ？`命令满足时就会触发一次`BGSAVE`命令。

  > 假如我们能接受一个小时数据的丢失，可以使用`SAVE 3600 1`。即`3600s内`有一次写入就创建快照。

- Redis接收到`SHUTDOWN`命令或`TERM`命令时，就会执行`SAVE`命令，阻塞所有客户端，不执行任何客户端发送的命令，并在`SAVE`命令执行完毕后关闭服务器。
- 当一台Redis服务器连接另一台Redis服务器时，通过`SYNC`命令开始一次复制操作的时候，若主服务器没有正在执行或刚执行过`BGSAVE`命令，那么主服务器就会执行`BGSAVE`命令。

  > 
  > |   配置   |                        作用                        |
  > | :------: | :----------------------------------------------------: |
  > |  save 60 1000  | 60s内有1000次写入就会触发`BGSAVE`命令 |
  > | stop-writes-on-bgsave-error no |     当`BGSAVE`命令执行发生错误时是否停止写入     |
  > |    rdbcompression yes  |           redis通过快照存储数据至本地数据库是否压缩               |
  > |    dbfilename dump.rdb  |           快照存储的文件名               |

#### SAVE or BGSAVE

我们知道`SAVE`生成快照期间会阻塞所有的客户端命令，而`BGSAVE`通过创建子进程实现的`快照`生成会带来短暂的停顿，这种情况在Redis进程占用的内存越大的情况下越明显。`一般来说Redis进程每多占用1GB内存，创建该进程的子进程的耗时就增加10-20ms`。

为了防止创建子进程而出现的停顿，我们可以考虑关闭`自动保存`，通过手动发送`BGSAVE`命令控制停顿出现的时间。虽然`SAVE`会一直阻塞Redis直到快照生成完毕，但因为`SAVE`不需要创建子进程，不会导致Redis停顿且没有子进程竞争，所以`SAVE`创建快照的速度会比`BGSAVE`创建快照的时候`更短`。

---

### 只追加文件

AOF持久化会将被执行的`写命令`写到AOF文件的末尾，以此来记录数据发生的变化。只需要从头执行一次AOF文件包含的所有写命令，就可以恢复AOF文件所记录的数据集。

#### 开启AOF

```bash
appendonly yes # 开启AOF
appendfsync always/everysec/no
```
> AOF模式是默认关闭的，需要手动开启
>
> |   选项   |                        同步频率                        |
> | :------: | :----------------------------------------------------: |
> |  always  | 每个`Redis写命令`都要同步写入磁盘，会严重降低redis速度 |
> | everysec |     每秒执行一次同步，显式的将多个写命令同步到磁盘     |
> |    no    |                让系统决定何时来进行同步                |

#### AOF文件压缩/重写

AOF持久化不易丢失数据的优势下，存在着体积过大的问题。因为Redis不断将被执行的`写命令`记录到AOF文件中，随着Redis不断运行，AOF文件体积会越来越大。并且Redis重启后通过执行AOF文件还原数据集的时间也会随着体积的增大越来越长。

> 我们可以通过`BGREWRITEAOF`重写命令，该命令会移除AOF文件中冗余的命令来重写（Rewrite）AOF文件。该命令原理与`BGSAVE`类似，都是创建子进程，并由子进程进行重写（也会带来性能和内存占用问题）。
>
> 且我们可以通过`auto-aof-rewrite-percentage`和`auto-aof-rewrite-min-size`来控制`BGREWRITEAOF`命令的触发时机。
> 
> `auto-aof-rewrite-percentage 100; auto-aof-rewrite-min-size 64mb`表明当AOF文件体积大于64MB且AOF文件体积比上一次重写的体积大了100%时，redis会执行`BGREWRITEAOF`命令。

---

### 复制

对于多台机器之间的数据同步可以通过`复制`实现：一台主服务器（master）处理`写命令`，并向多台从服务器（slave）发送更新，从服务器处理`读请求`。

#### 配置

默认情况下快照开启，当从服务器连接主服务器的时候，主服务器会自动执行`BGSAVE`命令，此时需要保证已经设置了如下参数：

```bash

# 快照的文件名
dbfilename dump.rdb

# 文件默认存放到当前目录下
dir ./
```
> 也可以通过`SLAVEOF ${host} ${port}`命令手动开启复制。


#### 复制流程

![](https://image.leejay.top/Fpw3Wh42cQwbUZ3X7ON8FEa4rcvB)
> 注意事项：
> 1. 从服务器的旧数据会被全部清空。
> 2. 需要保留部分内存作为缓冲区，存放写命令使用。

#### 多台从服务器
- 如果多台从服务器连接一台主服务器，那么所有的从服务器都会收到`相同的快照文件和缓冲区写命令`。
- 如果一台从服务器C连接时，恰好有一台从服务器B正在复制，那么会等B执行完上图步骤后再由C执行上图步骤。


### 验证工具

```bash
# 验证/修复AOF文件
redis-check-aof [--fix] <file.aof>

# 验证快照文件
redis-check-dump <dump.rdb>

```
> 修复AOF文件会将错误或不完整的命令删除，只保留正确的命令。
> 目前出错的快照文件为u发删除(因为快照本身经过了压缩）。