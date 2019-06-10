---
title: EleasticSearch实战1
date: 2018-06-28 12:09:43
tags: ElasticSearch
categories:
- ElasticSearch
---
## curl命令解析

命令：
``` -java
curl -XPUT 'localhost:9200/lucky/lee/1?pretty' -d '{"name":"lucky","organizer":"kedacom"}'
curl 'localhost:9200/_cat/indices?v' 查看所有索引
```
 * -X 后面带上方法，包括post，put，delete，get（默认不写-X）
 * localhost:9200 es服务地址，默认是有http
 * server/index/type/id,如果查询全部index可以使用server/_all/type/id查询
 * pretty或pretty=true表示使得返回的结果可读性更好，默认是false，展示一行

结果：
``` -java
{
  "_index" : "lucky",
  "_type" : "lee",
  "_id" : "1",
  "_version" : 1,
  "result" : "created",
  "_shards" : {
    "total" : 2,
    "successful" : 1,
    "failed" : 0
  },
  "created" : true
}
```

* 返回index，type，id，version以及查询的分片数
* 如果某个节点宕机导致一个分片不可用，此时es会返回可用分片的查询结果，也会告知错误不可搜索的分片

## elasticSearch概念点

* es是面向文档的，所以文档是最小单位，类似于数据库的每条数据，type类型对应着表，index对应着db库
* 索引存储了所有的映射类型的字段，还包括一些设置，比如refresh_interval(定义了新近索引的文档对于搜索可见的时间间隔，这也是es被称为<font color="red">准实时</font>的原因)
* 集群是由一个或者多个节点构成，每个节点由一个或者多个分片构成。
* <font color="red">es索引由一个或者多个主分片以及零个或者多个副本分片构成。</font>
* <font color="red">副本可以在运行的时候删除和添加，主分片不行，创建索引前必须决定分片的数量。</font>
* 给文档建立索引的过程：
 * 根据文档的id进行hash计算获取一个主分区。
 * 如果此主分片不在当前节点上，es会将该文档索引到目标节点的主分片上。
 * 并同步到非目标节点的主分片的副本上，是的主副本之间保持同步。
 * 一个索引默认5个分片，`curl localhost:9200/_cat/shards?v`查看分片信息
 * 需要注意的是索引的请求是在主分片中进行分发的。然后同步到副本。

## elasticSearch文档核心字段类型
### 字符串类型（string）
* <font color="red">需要注意的而是es5.0之后String变成了过时字段，改成了text&keyword，</font>区别如下：

|  | text  |  keyword |
| ------ | ------ | ------ |
| 分词/建索引  | 支持  | 不支持  |
| 模糊/精确  | 支持  | 支持  |
| 聚合  | 不支持  | 支持  |
* 针对每个字段的类型中都有index选项，有三种值，每个值对应的作用如下：

| index类型  | 区别  |
| ------------ | ------------ |
| analyzed  | 默认值，分词器将所有的字符转成小写，并分解成单词，用于单词的完全匹配。 |
| not analyzed  | 分析过程略过，整个字符串作为单独的词条进行索引  |
| no  | 索引被略过，此字段无法进行索引，适用于无需搜索的字段，节省搜索时间  |
tips： <font color="red">ignore_above：超过此值的数据不会被索引</font>

### 数值类型（numeric）
* 支持byte，short，long，double，float，int
* es默认为整数值分配long，浮点数值分配double

### 日期类型 （date）
* 搜索输入date，es将date转为数值进行处理，效果更快。
* 支持使用默认的format格式或者使用自定义格式,<a herf="https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-date-format.html">文档地址</a>
```java
curl -XPOST 'localhost:9200/index/_mapping/type' -d
 '{
   "properties": {
     "entryTime":{
       "type": "date",
       "format": "basic_date"
     }
   }
 }'
```
### 布尔类型（boolean）
es将true转为T，false转为F进行存储。

### 数组

所有的核心类都支持数组，无需额外进行处理
### 多字段

```java
#object mapping
PUT /my_index
{
  "mappings":{
    "my_type": {
      "properties": {
        "tags": {
          "type": "object",
          "properties": {
            "first": {
              "type": "keyword"
            },
            "last": {
              "type": "keyword"
            }
          }
        }
      }
    }
  }
}
```

### 预定义字段

* 特性：
es默认会部署预定义字段，他们代表着字段相关的含义，预定义字段默认都是_开头
* 分类
1. 控制如何存储和搜索文档
 *  _source:该字段按照原有格式存储原有的文档，默认开启。
   如果只存储某字段使用store:true。
  支持返回特定的字段：`` curl 'localhost:9200/index/type/id?pretty&fields=name'``
  
 * _all: 索引全部的信息，不考虑字段匹配的前提下，返回全部命中的文档。如果不确定索引哪个字段可以使用_all,使用如下配置可以更加灵活的使用_all
 ```json
    "age":
    {
        "type": "integer",
        "include_in_all": false #默认是true
     }
	 6.0以后使用copy to
 ```
2. 唯一识别文档
 * _uid(_id和_type构成)，_id，_type用于识别文档
 * 使用_index搜索，默认_index是关闭的，但是es知道每个结果来源于哪个索引，所以结果可以展示，但是默认不支持索引，需要如下配置开启:
 ```java
     "_index": {
        "enabled": true
      }
    GET /my_index/_search
	{"query":
	  {"index":
	    {"value":"AWcwQ-ThgS5m6c_Ixqgw"}
	  }
	} 使用_index进行搜索
 ```
3. 为文档增加新的属性
4. 控制文档路由到哪些分片

### 更新现有文档

* 文档更新流程： 检索文档 -> 处理文档 -> 并重新索引文档 -> 直至原先文档被覆盖
* 三种更新API：
  * 部分更新
```java
   POST /my_index/user/AWcwdXCEgS5m6c_Ixqgy/_update
   {
      "doc": {
        "title":"wudidashuaib"
      }
    }```
   
  * 使用upsert创建尚不存在的文档
  ```java
    POST /my_index/user/1/_update
    {
      "doc": {
      "name": "hello"
    },
     "upsert": {
       "name": "snake zhang",
       "title": "dameinv",
       "birthday": "2992-11-26",
       "age": 226,
      "tags": {
        "first": "zhang",
        "last": "wei"
       }
     }
   }
  ```
  
  * 脚本更新（script）
  ```java
  POST /my_index/user/1/_update
   {
      "script": {
        "source":"ctx._source.age += params.old",
        "lang":"painless",
        "params": {
            "old":2
         }
      }
    }
  ```

* 通过版本实现并发控制
  * 流程：更新1索引文档1，此时版本号为1，在其更新期间（假设时间较长），更新2索引文档1，并成功修改，此时版本号为2，更新1再去修改文档1，发现版本号不一致，导致修改失败。
  * 通过自动重试实现更新操作（更新1会重新索引文档1，此时版本为2，修改后版本号为3）,添加参数 <font color="red">retry_on_conflict=5(重试5次)</font> 实现。
  * 通过每次请求添加版本号 <font color="red">version=3</font>，如果当前版本号不是3，则会抛出异常。
  * 如果使用外部版本，需要使用 <font color="red">vertion_type=external&version=101</font>，只要版本号高于现有的版本号，es不会自己增加版本号了。
  
### 删除数据
---
* 删除文档：支持根据id删除，单个请求删除多个文档，删除映射类型，删除匹配查询的所有文档。
* 删除后的更新操作会导致重新创建文档，所以es会在60s内保存该删除后的文档版本号，这样就能拒绝更新操作（<font color="red">版本号低于删除操作的版本号</font>）
* 配置elasticsearch.yml中的 <font color="red">action.destructive_requires_name:true</font>来拒绝删除的_all操作及通配符操作。
* 关闭索引/打开索引 _close/_open
### 常用命令（基于kibana）
---
<a herf="www.leejay.top:5601">kibana测试地址</a>

```java
#新建索引
PUT my_index

# 删除索引dele
DELETE my_index

# 查看全部索引
GET _cat/indices

#查看指定索引下的mapping
GET my_index/_mapping

#新建mapping
PUT my_index
{
  "mappings": {
    "user": {
      "_all": {
        "enabled": false
      },
      "_index": {
        "enabled": true
      },
      "properties": {
        "title": {
          "type": "text"
        },
        "name": {
          "type": "text"
        },
        "age": {
          "type": "integer",
          "include_in_all": false
        },
        "birthday": {
          "type": "date",
          "format": "yyyy-MM-dd"
        },
        "tags": {
          "type": "object",
          "properties": {
            "first": {
              "type": "keyword"
            },
            "last": {
              "type": "keyword"
            }
          }
        }
      }
    }
  }
}

# 新增数据
POST /my_index/my_type
{
  "age":25,
  "name":"lucky lee",
  "title":"dashuaib",
  "birthday":"1993-06-26"
}

# 查看文档
GET /my_index/my_type/_search

# 搜索文档
GET /my_index/my_type/_search
{
  "query": {
    "query_string": {
      "default_field": "name.keyword",
      "query": "lucky"
    }
  }
}
如果是name，则可以搜索到！
```

