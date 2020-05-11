---
title: ElasticSearch实战3
date: 2018-07-11 11:23:48
tags: ElasticSearch
toc: true
categories:
- ElasticSearch
thumbnail: https://image.leejay.top/image/20200511/0vS4gvoGHTCO.jpg?imageslim
---
## 聚合
### 概念
* 度量型（metrics）
度量型聚集是指一组文档的统计分析，可以得到最小值，最大值，平均值等度量值。

* 桶型（bucket）
桶聚集将匹配的文档切分为一个或者多个容器（桶），然后告诉你每个桶里的文档数量。

* 默认聚合是聚合全部的文档（隐含match_all），但是也支持先查询再聚合，from&size对聚合的结果没有影响，<font color="red">但是使用size=0可以不展示文档搜索结果</font>

* <font color="red">过滤器filter先于查询执行，post_filter叫做后过滤器，在查询后执行，对聚合的结果无影响。
同时拥有过滤器的查询性能是优于拥有后过滤器的查询的。</font>

<!-- more -->

## 度量聚集
### 单值聚合
* avg（平均数）

``` json
GET /my_index/user/_search
{
  "aggs": {
    "agg_avg": {
      "avg": {
        "field": "age"
      }
    }
  }
}
```
* sum（求和）

``` java
GET my_index/user/_search
{
  "size": 0,
  "aggs": {
    "age_sum": {
      "sum": {
        "field": "age"
      }
    }
  }
}
```
* max（最大值）

``` java
GET my_index/user/_search
{
  "size": 0, 
  "aggs": {
    "age_max": {
      "max": {
        "field": "age"
      }
    }
  }
}
```
* min（最小值）

``` java
GET my_index/user/_search
{
  "size": 0, 
  "aggs": {
    "age_max": {
      "min": {
        "field": "age"
      }
    }
  }
}
```
* Cardinality（求基数）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "agg_cardinality": {
      "cardinality": {
        "field": "gender"
      }
    }
  }
}
```
### 多值聚合
* 百分位（可以发现所有值中的x%比这个值低，其中x是给定的百分比）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "agg_per": {
      "percentiles": {
        "field": "age",
        "percents": [30,80]
      }
    }
  }
}
结果：
{
  "took": 3,
  "timed_out": false,
  "_shards": {
    "total": 5,
    "successful": 5,
    "skipped": 0,
    "failed": 0
  },
  "hits": {
    "total": 5,
    "max_score": 0,
    "hits": []
  },
  "aggregations": {
    "agg_per": {
      "values": {
        "30.0": 29,
        "80.0": 30.2
      }
    }
  }
}
理解： 30%的值不大于29,80%的值不大于30.2，类似于最大最小值进行等额区间划分，用于区间查看。
```
* percentile_ranks（与百分位相反，通过值来计算百分比）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "agg_per": {
      "percentile_ranks": {
        "field": "age",
        "values": [29,30]
      }
    }
  }
}
计算年龄在29-30之间的百分比是多少
```

* stats（包括sum，count，min，max，avg）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "agg_stats": {
      "stats": {
        "field": "age"
      }
    }
  }
}
```
* extended_stats（stats + 标准差 + 平方和）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "agg_stats": {
      "extended_stats": {
        "field": "age"
      }
    }
  }
}
```

### 其他聚合
* terms聚合（分别汇总count）

* order排序（支持_term 和 _count，默认是doc_count排序）


## 多桶型聚集
### 词条型聚集 （terms agg）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "agg_terms": {
      "terms": {
        "shard_size": 10,
        "size": 10,
        "min_doc_count": 10, 
        "include": ".*", 
        "exclude": ".*", 
        "field": "gender",
        "order": {
          "_term": "asc"
        }
      }
    }
  }
}
```
*  order：排序（支持_term 和 _count，默认是doc_count培训）
* shard_size：指定每个分片返回的最多size。
* size：指定分片数据汇总之后返回的数量。
* min_doc_count：指定分组的最小count数量，用于排除不相关数据。
* include&exclude： 包含&不包含通配符匹配的bucket。

### 范围聚集 （range agg）
* range 范围不是必须连续，但是必须是合理的取值

``` java
GET /my_index/user/_search
{
  "size": 0, 
  "aggs": {
    "agg_rang": {
      "range": {
        "field": "age",
        "ranges": [
          {
            "from": 0,
            "to": 28
          },{
            "from": 29,
            "to": 50
          }
        ]
      }
    }
  }
}
```
* date_range （需要确认的是日期的格式）

``` java
GET my_index/user/_search
{
  "size": 0,
  "aggs": {
    "date_agg": {
      "date_range": {
        "field": "birthday",
        "format": "yyyy-MM-dd",
        "ranges": [
          {
            "from": "1989-09-01",
            "to": "1999-09-01"
          }
        ]
      }
    }
  }
}
```
### 直方图聚集 （histogram agg）
* histogram（以固定的区间bucket值）
tips:<font color="red">min_doc_count的取值可以展示全部区间或者部分满足条件的区间</font>，interval则是区间的差。

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "histogram_agg": {
      "histogram": {
        "field": "age",
        "interval": 1,
        "min_doc_count": 1
      }
    }
  }
}
```
* date_histogram (区间的取值： year，month，day ...)

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "date_agg": {
      "date_histogram": {
        "field": "birthday",
        "interval": "year",
        "min_doc_count": 1
      }
    }
  }
}
```
### 嵌套聚集 （nested agg）
#### 嵌套聚集： 就是基于一个聚集上的再一次聚集。

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "gender_agg": {
      "terms": {
        "field": "gender",
        "size": 10
      },
      "aggs": {
        "date_agg": {
          "date_histogram": {
            "field": "birthday",
            "interval": "year",
            "min_doc_count": 1
          }
        }
      }
    }
  }
}
```
### 单桶聚集

* global: 查询和聚集基于不同的文档不一致，因为查询是有条件的，聚集使用了global，建立在全部文档上。

``` java
GET /my_index/user/_search
{
  "query": {
    "match": {
      "name": "曾小贤"
    }
  },
  "aggs": {
    "all_document": {
      "global": {},
      "aggs": {
        "date_agg": {
          "date_histogram": {
            "field": "birthday",
            "interval": "year",
            "min_doc_count": 1
          }
        }
      }
    }
  }
}
```
* filter聚集（在子聚集过程中的过滤器，用于过滤聚集结果）

``` java
GET /my_index/user/_search
{
  "size": 0,
  "aggs": {
    "all_aggs": {
      "aggs": {
        "date_agg": {
          "date_histogram": {
            "field": "birthday",
            "interval": "year",
            "min_doc_count": 1
          }
        }
      },
      "filter": {
        "range": {
          "birthday": {
            "gte": "1988-01-01",
            "lte": "1999-01-01"
          }
        }
      }
    }
  }
}
```
* missing聚集（如果某文档确实要聚集的字段，可以使用该方法，结果中会提示miss_doc数量）

``` java
GET /my_index/user/_search
{
  "aggs": {
    "miss": {
      "date_histogram": {
        "field": "birthday",
        "interval": "year",
        "min_doc_count": 1
      }
    },
    "miss2": {
      "missing": {
        "field": "birthday"
      }
    }
  }
}
```



