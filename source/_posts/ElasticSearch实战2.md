---
title: ElasticSearch实战2
date: 2018-07-02 17:30:05
tags: ElasticSearch
toc: true
categories:
- ElasticSearch
thumbnail: https://miro.medium.com/max/892/1*AYP0Mg_MwJMm3Kbx8Xa8lQ.png
---
## 搜索数据

* 执行流程：查询节点，转发到主或者副分片，搜集信息后返回（query_then_fetch）
* 搜索范围：
```java
GET _search                搜索整个集群
GET my_index/_search       搜索my_index索引下数据
GET my_index/user/_search  搜索索引my_index下user类型的数据
GET */user/_search         搜索类型为user的数据
GET _all/_search           搜索整个集群
GET _all/user/_search      搜索类型为user的数据
GET my*/_search            搜索my开头的索引数据
```
* 搜索请求基本模块
  * query:包含过滤，查询条件
  * from&size: 搭配实现分页查询
  * _source: 自定义实现返回字段
  * sort： 排序，默认是按照score排序
  
  ```java
  GET _search
  {
   "query": {
    "range": {
       "age": {
         "gte": 10,
         "lte": 300
       }
     }
   },
   "from": 0,
   "size": 20,
   "_source": ["name","age"],
   "sort": [
     {
       "age": {
         "order": "desc"
       }
     }
   ]
 }
 还支持如下格式
 --------------
 "sort": [
    {
      "title": "asc"
    },
    {
      "age": "desc"
    },
    "_score"
  ]
  --------------
  "_source": {
    "includes": [
      "na*"
    ],
    "excludes": [
      "age"
    ]
  }
  ```

* 返回结果解析
``` java
 {
   "took": 2,  查询耗时（ms）
   "timed_out": false, 是否有分片超时（是否返回部分结果）
   "_shards": {
     "total": 6,  总分片数
     "successful": 6, 成功响应的分片数
     "skipped": 0, 
     "failed": 0
   },
   "hits": {
     "total": 2, 命中的结果数
     "max_score": 0.62191015, 结果中的最大得分
     "hits": [
       {
         "_index": "my_index",
         "_type": "user",
         "_id": "AWc0K0TsgS5m6c_Ixqg3",
         "_score": 0.62191015,
         "_source": {
           "name": "bonne zhang",
           "title": "xxxyyy",
           "birthday": "1991-11-26",
           "age": 27,
           "tags": {
             "first": "zhang",
             "last": "xue"
           }
         }
       }
     ]
   }
 }
```

## 查询和过滤器DSL

### match查询和term过滤器
* match查询
  match是匹配某个字段（match_all是匹配全部的字段）
  operator默认是or，此时的query是 <font color="red">xiao AND lv</font>
  
  ``` java
  GET my_index/user/_search
 {
   "query": {
      "match": {
        "english_name": {
          "query": "xiao lv",
          "operator": "and"
         }
       }
     }
 }
  ```
* term过滤器
  查询和过滤器的区别：过滤器可以进行缓存匹配，命中就返回文档，查询需要进行额外的一步（计算得分），同时不支持缓存。
  
  
  |   | term  | filter  |
| ------------ | ------------ | ------------ |
|缓存  | 不支持  | 支持  |
|计算得分 |  是 |  否 |
|速度|慢|快|
* 过滤查询（包括查询和过滤）
基于查询之后的结果进行过滤器过滤，es在底层建立了一个<font color="red">位集合</font>，通过0/1来表示该文档是否匹配过过滤器
因为过滤器不需要计算得分，所以<font color="red">过滤查询要比完全的查询要快</font>，同时es支持位集合缓存，所以过滤器用于其他的请求时，位集合就不需要再进行计算，速度更快！

```java
GET /my_index/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "name": "zhang"
          }
        },
        {
          "match": {
            "tags.first": "zhang"
          }
        }
      ],
      "filter": [
        {
          "term": {
            "name": "zhang"
          }
        },
        {
          "range": {
            "age": {
              "gte": 10,
              "lte": 300
            }
          }
        }
      ]
    }
  }
}
```
### 常用的基础查询和过滤器
---
* match_all （查询全部推荐）
当你希望返回全部文档或者希望只是用过滤器的时候

``` java
GET /my_index/user/_search
{
  "query": {
    "bool": {
      "must": [
        {"match_all": {}}
      ],
      "filter": {}
    }
  }
}
```
* query_string（查询字符串推荐）
默认情况下query_string会搜索_all字段，底层调用的是Lucene的语法，不建议直接使用query_string，会给集群带来风险，建议使用term，terms，simple_query_string等

``` java
GET /my_index/user/_search
{
  "query": {
    "query_string": {
      "default_field": "name",
      "query": "zhang OR lucky"
    }
  }
}

GET /my_index/user/_search
{
  "query": {
    "simple_query_string": {
      "query": "zhang OR lucky",
      "fields": ["name"]
    }
  }
}
```
* term查询和term过滤器（精确匹配推荐）
使用term必须是精确匹配才会作为结果返回

``` java
GET my_index/user/_search
{
  "query": {
   "bool": {
     "must": [
       {"term": {
         "name": {
           "value": "曾小贤"
         }
       }}
     ],
     "filter": {
       "term": {
         "title": "xuanzekongjuzheng"
       }
     }
   }
  }
}
```
* terms查询（一个字段多个值查询推荐）
支持搜索文档字段中的多个词条
``` java
GET my_index/user/_search
{
  "query": {
    "bool": {
      "must": [
        {"terms": {
          "english_name": [
            "xiao",
            "lv"
          ]
        }}
      ]
    }
  }
}
```
* match_phrase
match_phrase属于match的一种,是针对短语进行精确查询的方式

 * 单个值查询
 
  ``` java
   GET my_index/user/_search
   {
    "query": {
      "match_phrase": {
        "english_name": "xian"
      }
    }
  }
  ```
  * 不连续的值查询，slop参数默认是0，代表着短语分词后的，各值之间的位置差,匹配相对顺序一致的所有指定词语
  tips：<font color="red">es默认分词器对中文效果不好，可以使用<a href="https://github.com/medcl/elasticsearch-analysis-ik/releases">ik分词器</a>插件</font>
  
  ``` java
  GET _analyze
{
  "analyzer": "standard", 
  "text": "Quick brown fox"
}
  ```
  使用ik分词器
  
  ``` java
  GET _analyze
{
  "analyzer": "ik_max_word",
  "text": "中华人民共和国"
}
  ```
下面的查询条件可以搜索出重中华人民共和国，而slop默认值是取不到的
``` java
 GET my_index/user/_search
 {
   "query": {
     "match_phrase": {
       "location":{
         "query": "中人",
         "slop":1
       }
     }
   }
 }
```

* phrase_prefix
就是match_phrase + 词组的最后一个项进行前缀匹配的，顺序需要保证，参数max_expansions设置最大的前缀扩展数量（限制最后一项前缀匹配展示多少个结果，默认50，不建议太大，用于autoComplete）。
``` java
 GET my_index/user/_search
 {
   "query": {
     "match_phrase_prefix": {
       "location":{
         "query": "国",
         "max_expansions": 1
       }
     }
   }
 }
```
* multi_match
在多个字段中查找文档，取并集。
```java
 GET /my_index/user/_search
 {
   "query": {
     "multi_match": {
       "query": "xiao",
       "fields": ["name","english_name"]
     }
   }
 }
```
## 组合查询和复合查询
---
* bool查询
 * must： 结果文档必须匹配搜索条件
 * must_not：结果文档不能包含搜索的条件
 * should：可以匹配，也可以不匹配，<font color="red">但是必须满足minimum_should_match设置的数量才会返回结果（默认有must为0，无must为1）</font>
 
 ``` java
  GET /my_index/user/_search
 {
   "query": {
     "bool": {
       "must": [
         {
           "term": {
             "english_name": {
               "value": "xiao"
             }
           }
         }
       ],
       "must_not": [
         {
           "range": {
             "birthday": {
               "gte": "1999-10-01",
               "lte": "2099-10-01"
             }
           }
         }
       ],
       "should": [
         {
           "term": {
             "name": {
               "value": "吕子乔"
             }
           }
         }
       ],
       "minimum_should_match": 0
     }
   }
  }
 ```
* bool过滤器
 bool过滤器不支持minimum_should_match，默认就是1

## 超越match和过滤器查询
---
* range
range是范围查询，适用于数字，日期，字符串，建议优先使用range过滤器查询。
``` java
GET /my_index/user/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "range": {
            "age": {
              "gte": 10,
              "lte": 20
            }
          }
        }
      ],
      "filter": {
        "range": {
          "age": {
            "gte": 10,
            "lte": 20
          }
        }
      }
    }
  }
}
```
* prefix
支持查询和过滤器，需要注意的是发送请求前不会分析该前缀，所以对大小写敏感！
``` java
GET /my_index/user/_search
{
  "query": {
    "prefix": {
      "name": {
        "value": "吕子"
      }
    }
  }
}
```
* wildcard（重量级查询）
使用通配符进行查询（is *foo？bar），*匹配多个，？匹配一个。
``` java
GET my_index/user/_search
{
  "query": {
    "wildcard": {
      "name": {
        "value": "吕*"
      }
    }
  }
}
```
## 过滤器查询字段的存在性
---
* exist（查看字段是否存在）
``` java
GET my_index/user/_search
{
  "query": {
    "bool": {
      "filter": {
        "exists": {
          "field": "location"
        }
      }
    }
  }
}
```

* missing 过滤器 （已被exist取代）

## 拓展：关于scroll的用法
---
scroll是es的深度分页，因为es默认限制分页1万条数据，所以通过深度分页可以解决性能问题
scroll=5m,代表每次scoll存在的时长，每次请求都需要传入该参数。
``` java
1. GET my_index/user/_search?scroll=5m&size=1
2. POST _search/scroll
{
  "scroll":"1m",
  "scroll_id":第一步返回的scroll_id
}
```