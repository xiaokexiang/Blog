---
title: "Elasticsearch操作文档"
date: 2023-02-09T14:17:55+08:00
tags: ["elasticsearch "]
description: "Elasticsearch是一个`分布式`，`RESTful`风格的搜索和数据分析引擎。"
categories: [
  "elasticsearch"
]
weight: 12
mermaid: true 
hideReadMore: true
---

### 前置知识

Elasticsearch是一个分布式，`RESTful`风格的搜索和数据分析引擎。

#### 概念点

- ES是面向文档的，文档是最小单位，对应着关系型数据库中的一条数据。
- index索引除了存储所有映射类型的字段，还包含一些设置，ex: refresh_interval（新增文档对于搜索可见的时间间隔，准实时）。
- 集群由n个节点（n≥1）组成，节点由m个分片（m≥1）组成。索引由x个主分片（x≥1）和y个副本分片（y≥0）组成。（`副本可以在运行时增加，而主分片不行，在创建索引前必须决定其数量`）
- 新增文档时，会根据文档的id进行hash计算确认一个主分区A（shard_num = hash(_id) % 主分片个数），如果A分区不在当前节点，那么ES会将文档索引到A分区所在的目标节点上，并同步到非目标节点的主分片中，并通过各节点的主分片与副本分片进行同步。

#### RESTful

> ES的查询会涉及到`RESTful`的相关概念
>
> 1. 其中`GET、HEAD、PUT、DELETE`是幂等的操作（即任意多次执行所产生的影响均与一次执行的影响相同）
> 2. `POST`不是幂等的操作（即每次调用都会创建一个新的资源，但实际会通过数据库主键或其他方式进行限制）。`PATCH`也不是幂等的，因为相比`PUT`对资源的全部更新，`PATCH`强调的是部分更新，如果是依赖于当前值的++操作，那么必定是非幂等的。
> 3. `GET、HEAD`是安全的操作，仅仅是查询资源并不会修改资源，`PUT、PATHC、DELETE、POST`是不安全的操作，会修改资源数据。

#### type移除

ES中的`index、type、document、field`分别对应着关系型数据库中的`database、table、row、column`，在`ES8.0`版本中已经不在支持`type`。

> 1. 在es中同一个index中不同的type是存储在同一个lucene索引文件中的，不同type中相同名字的字段的含义必须相同。
>
> 2. 但关系型数据库中的table是独立存储的，所以type在es中的用途就十分有限。

---
### 环境搭建

#### docker部署

```bash
# 基于docker部署es7.8.0
mkdir -p /root/es/plugins /root/es/data /root/es/config && touch /root/es/config/elasticsearch.yml && chmod 777 /root/es/**
docker run -d --name es -p 9200:9200 -p 9300:9300 \
-v /root/es/data:/usr/share/elasticsearch/data \
-v /root/es/plugins:/usr/share/elasticsearch/plugins \
-v /root/es/conig/elasticsearch.yml:/usr/share/elasticsearch/conig/elasticsearch.yml \
-e "discovery.type=single-node" \
-e "ES_JAVA_OPTS=-Xms512m -Xmx512m" \
docker.io/library/elasticsearch:7.8.0
```

#### 配置分词器

```bash
# 配置分词器
wget https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v7.8.0/elasticsearch-analysis-ik-7.8.0.zip \
&& mkdir -p ik/ && unzip -od ik/ elasticsearch-analysis-ik-7.8.0.zip \
&& docker cp ik es:/usr/share/elasticsearch/plugins/ \
&& docker restart es
```

> docker es是什么版本就使用什么版本的ik分词器，具体文档参考<a href="https://github.com/medcl/elasticsearch-analysis-ik">elasticsearch-analysis-ik</a>。

```http
# 分词器验证
PUT /index
PUT /index/_mapping
{"properties": {"content": {"type": "text", "analyzer": "ik_max_word","search_analyzer":"ik_smart"}}}
GET /index/_mapping
# 查看指定索引下的分词结果
POST /{index}/_analyze
{
	"text": "用来验证分词结果",
	"analyzer": "ik_max_word"
}
```

#### 常见分词器

|    分词器    |                     效果                     |
| :----------: | :------------------------------------------: |
| **standard** | 默认的分词器，会将大小转小写，按照单词分词。 |
|    **ik**    |         中文分词器，支持自定义词库。         |
|    simple    |   会将大写转小写，按照非字母切分，符号过滤   |
|  whitespace  |          按照空格分词，不会转小写。          |
|    custom    |                 自定义分词器                 |

#### kibana

```bash
echo "server.name: kibana\nserver.host: "0"\nelasticsearch.hosts: [ "http://{esIp}:{esPort}" ]\nxpack.monitoring.ui.container.elasticsearch.enabled: true" > /root/kibana.yml
docker run -d --name=kibana --restart=always -p 5601:5601 \
  -v /root/kibana.yml:/usr/share/kibana/config/kibana.yml \
  docker.elastic.co/kibana/kibana:7.8.0
```

> 1. ES的地址要写ip地址，不要写localhost。kibana的版本与ES的版本保持一致。

### 基础操作

#### 索引

```http
# 创建索引
PUT /shopping
# 查询索引
GET /shopping
# 查询全部的索引
GET /_cat/indices?v
# 删除索引
DELETE /shopping
```

> 1. 如果使用POST创建索引，会提示错误，因为即不能存在同样名称的索引，不满足幂等要求。
> 2. 使用curl命令时，如果希望展示美化格式，那么需要加上?pretty，默认是将结果展示为一行。

#### 文档

```http
# 创建文档
POST /{index}/_doc {body}
# 创建指定id的文档
PUT /{index}/_create/{id} {body}
# 查询指定id的文档
GET /{index}/_doc/{id}
# 查询索引下全部的文档
GET /{index}/_search
# 更新文档（局部）
POST /{index}/_update/{id} {"doc":{"field":"value"}}
# 更新文档(全量)
PUT/POST /{index}/_doc/{id} {body}
# 删除文档
DELETE /{index}/_doc/{id}
# 删除索引下的全部文档
DELETE /{index}/_delete_by_query {"query":{"match_all": {}}}
```

> 1. 创建文档（不指定id）时并不要求是幂等的操作，多次创建返回的id并不相同，所以创建文档需要使用POST请求。
> 2. 如果创建指定id的文档，那么这个请求是幂等的（即相同id的文档只能创建一次），所以需要使用PUT请求。
> 2. ES中默认的脚本是`painless`，也支持`expression、mustache`。

#### 脚本

```http
# 脚本查询：将文档中所有的age增加2
GET /{index}/_search
{
  "script_fields": {
    "my_doubled_field": {
      "script": { 
        "source": "doc['age'].value * params['multiplier']", 
        "lang": "painless",
        "params": {
          "multiplier": 2
        }
      }
    }
  }
}
# 存储脚本
POST /_scripts/{script_name}
{
  "script": {
    "lang": "painless",
    "source": "doc['age'].value * params['multiplier']"
  }
}
# 查询脚本
GET /_scripts/{script_name}
# 查询时使用脚本
GET /{index}/_search
{
  "query": {
    "script_score": {
      "query": {
        "match_all": {
        }
      },
      "script": {
        "id": {script_name}, 
        "params": {
          "multiplier": 3
        }
      }
    }
  }
}
```

> 1. 如果脚本对应的字段没有文档数据，那么会提示错误。
> 2. 在search查询中使用脚本id查询的话，脚本执行的结果在`max_core`这个参数中。

#### 索引定义

索引定义（mapping） 类似于数据库中的表结构定义 `schema`，用于定义index中的字段名称，类型等相关设置。

```http
# 创建索引同时指定mapping
PUT /{index}
{
  "mappings": {
    "properties": {
      "category": {
        "type": "text"
      }
    }
  }
}
PUT /{index}/_mapping
{
    "properties":{
        "name": {
            "type": "text", // 可以被分词
            "index": true,  // 可以被索引查询（默认true）
            "analyzer":"ik_max_word", // 指定文档存储时为ik分词器
      		"search_analyzer": "standard" // 搜索时对输入按照标准分词器分词
      		"copy_to": "nick_name" // copy_to 在搜索时使用nick_name也可以实现搜索
        },
        "sex": {
            "type": "boolean", // 布尔类型
        },
        "phone": {
            "type": "keyword",  // 不能被分词，完整匹配
            "index": false,     // 不能被索引查询
            "ignore_above": 256 // 超过此值的数据不会被索引
        },
        "age": {
        	"type": "byte/short/long/double/float/int" // 数值型
        },
        "birthday": {
        	"type":"date" // 日期类型
        	"format": "basic_date"
        }
    }
}
# 为已存在的mapping添加新的字段（已经存在的mapping字段无法修改只能新增！）
PUT /{index}/_mapping
{
	"properties": {
		"address": {
			"type": "text",
			"index": true
		}
	}
}
```

> 1. 与其他类型新增保持一致，因为是幂等的（不能重复），所以需要基于PUT创建。
> 2. `text`为文本类型会被分词，`keyword`为关键字类型不会分词，需要`完全匹配（区分大小写）`，`index`表示能否被索引，如果设置false，查询时使用该字段会报错。
> 2. ES默认为整数值分配long，浮点数值分配double。ES date类型支持<a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-date-format.html">多种format格式</a>（也支持`yyyy-MM-dd`形式）。
> 2. text、keyword、number、date都可以用来定义数组，我们只需要在传参的时候传入数组，ES会自动转换。
> 2. copy_to可以将多个字段都赋值给代理字段，查询支持使用代理字段查询。比如使用nick_name也能匹配到name的数据。
> 2. 更多mapping参数定义请点击查看<a href="https://www.elastic.co/guide/en/elasticsearch/reference/current/mapping-params.html">→官网文档←</a>。

#### 批量操作

```http
# 批量新增
POST /_bulk
{"create": {"_index":{index1},"_id": {id1}}}
{"field1": "value1", "field2": "value2"}
{"create": {"_index":{index2},"_id": {id2}}}
{"field1": "value1", "field2": "value2"}
# 批量修改
POST /_bulk
{"update": {"_index":{index1}, "id": {id1}}}
{"doc": {"field1":"value1"}}
{"update": {"_index":{index2},"_id": {id2}}}
{"doc": {"field1":"value2"}}
#批量删除
POST /_bulk
{"delete": {"_index":{index1},"_id": {id1}}}
{"delete": {"_index":{index2},"_id": {id2}}}
```

> 1. 批量修改，不是全量覆盖，如果字段存在那么替换，如果不存在就新增。
> 2. 如果操作的是同一个index，那么可以直接写在url路径中，在body中就不要传递index参数。

---

### 高级操作（Query DSL）

#### 数据模拟

```http
# 创建index & mapping
PUT /product
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text"
      },
      "time": {
        "type": "date",
        "format": "yyyyMMdd"
      },
      "name": {
        "type": "text",
        "analyzer": "ik_max_word"
      },
      "category": {
        "type": "keyword"
      },
      "price": {
        "type": "double"
      }
    }
  }
}
# 批量插入数据
POST /product/_bulk
{"create": {"_id": "1001"}}
{"title": "buy apple Phone", "time": 20220910, "name":"苹果手机", "category": "Phone", "price": 4999.00}
{"create": {"_id": "1002"}}
{"title": "buy huawei Phone","time": 20221120, "name":"华为手机", "category": "Phone", "price": 6999.00}
```

> 在使用默认的standard分词器时，`buy apple Phone` 会被分词为`buy`、`apple`、`phone`，注意`Phone -> phone`。同样`buy huawei Phone`也被分词为了`buy`、`huawei`、`phone`。

#### 基础查询

搜索条件包含：query（包含过滤、查询条件）、_source（自定义返回字段）、from&size（分页查询）、sort（排序，默认按照score排序）四大模块。

```http
# 查询全部数据
POST /product/_search
{
  "query":{
    "match_all": {} // 匹配全部
  },
  "_source": "title", // 只返回source
  "sort": [
    {
      "_id": {      // _id倒序
        "order": "desc"
      }
    }
  ]
}
# 查询全部数据进阶版
POST /{index}/_search
{
  "query":{
    "match_all": {} // 匹配全部
  },
  "_source": {"includes": ["title"], "excludes": ["_i*"]}, // 支持*，只返回includes中的排除了excludes中的字段。
  "sort": [     // 多个排序条件
    {"_id": "desc"},
    "_score" // 默认asc顺序
  ]
}
```

#### 匹配查询

##### match

```http
# 单个单词查询
POST /product/_search 
{
    "query": {
        "match": {
            "title": "buy" // 通过字段匹配
        }
    }
}
# 多个单词查询 匹配2条（buy apple Phone 和 buy huawei Phone）
POST /{index}/_search
{
	"query": {
		"match": {
			"title": {
				"query": "apple huawei",
				"operator": "or" // 多单词查询需要文档全满足或一个满足
			}
		}
	}
}
# 高亮显示
POST /product/_search
{
  "query": {
    "match": {
      "title": "Phone"
    }
  },
  "highlight": {
    "fields": {
      "title": {
        "pre_tags": "<em>",
        "post_tags": "</em>"
      }
    }
  }
}
```

> 1. 在数据模拟中我们解释道，标准分词器会将大写转换为小写，所以使用`phone`去匹配时，2条数据都符合。
> 2. 如果match中查询多个单词，默认（or）是有一个符合要求的文档就会被查询出来。

##### match_all

```http
# 完全匹配
POST /product/_search
{
	"query": {
		"match_all": {} // 完全匹配
	}
}
```
##### multi_match

```http
POST /product/_search
{
  "query": {
    "multi_match": {
      "query": "apple",
      "fields": ["title","name"]
    }
  }
}
```

> 等同于多个字段的match，只要有一个字段match就算匹配成功。

##### match_phrase

```http
# 默认slop
POST /product/_search
{
  "query": {
    "match_phrase": {
      "title": "apple phone", // buy apple Phone 和 buy huawei Phone √
      "slop": 0  // 默认为0
    }
  }
}
# 指定slop
POST /product/_search
{
  "query": {
    "match_phrase": {
      "title": {
        "query": "buy phone", // buy apple Phone 和 buy huawei Phone √
        "slop": 1
      }
    }
  }
}
```

> 1. match_phrase被称为短语搜索，要求所有的分词都必须同时出现在文档里面，且位置都必须相邻。
> 2. slop表示短语分词后，各个词之间的距离整合后进行匹配查询，slop=1时，`buy phone`等于`buy * phone`。

##### match_phrase_prefix

```http
POST /product/_search
{
  "query": {
    "match_phrase_prefix": {
      "title": {
        "query": "buy apple",
        "max_expansions": 10
      }
    }
  }
}
```

> match_phrase_prefix在match_phrase基础上进行查询，如果查询词为`buy apple`，那么根据`buy apple *` 进行匹配，默认最多返回50个匹配的结果，可以通过设置`max_expansions`限制结果返回。常用于搜索时的`auto complete`。

#### 精确查询

##### term

```http
POST /product/_search
{
  "query": {
    "term": { // term完全匹配
      "category": "Phone"
    }
  }
}
```

> 1. term与match不同点在于：term是精确匹配，term不会对搜索词进行分词。
> 2. 例如category是text类型，对应的文档值是`huaiwei phone`，那么经过默认分词器会出现`huawei`和`phone`两个token（单词），此时用term去匹配，如果搜索词是`huawei`，那么可以匹配到，如果是`huawei phone`，那么无法匹配。
> 3. 若`category`是`keyword`类型（添加文档字段不会被分词），那么经过默认分词器会出现一个`huawei phone`的token，此时用term去匹配，如果是`huawei`，那么无法匹配到，如果是`huawei phone`，则是可以匹配到。

##### terms

```http
POST /product/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "terms": { // 效果等同于title in ("buy", "huawei")
            "title": [
              "buy",
              "huawei"
            ]
          }
        }
      ]
    }
  }
}
```

> 1. term适用于一个词（一个体现在不分词，而不是一个单词），terms用于匹配多个词，效果等同于SQL中的in (?,?)查询。

#### 条件查询

##### bool

```http
# 多条件bool查询
POST /{index}/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "title": "phone"
          }
        }
      ],
      "must_not": [
        {
          "range": {
            "time": {
              "gt": "now-4M/M"
            }
          }
        }
      ],
      "should": [
        {
          "term": {
            "name": "手机"
          }
        }
      ]
    }
  }
}
```

> 1. must、must_not、should分别对应Sql中的and、not和or。filter可用于范围过滤，但是并不作用于score计算。
> 2. 每个关键字里面都可以包含多个条件，多个关键字组合使用时，必须保证三者都满足的文档才会被返回。
> 3. (title="phone") && (time < now-4M/M) && (name="手机")  = true的文档才会被返回。

#### 过滤器

##### filter

```http
POST /product/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "title": "phone"
          }
        }
      ],
      "filter": [
        {
          "range": {
            "time": {
              "gte": 20221010,
              "lte": 20230101
            }
          }
        }
      ]
    }
  }
}
```

> 1. query查询注重匹配度，filter注重是否匹配，filter适合大范围筛选数据，query适合精确匹配数据，两者可以配合使用。
> 2. filter可以进行缓存匹配，命中就返回文档，而query需要进行额外一步（计算score）并且不支持缓存。
> 3. ES通过bitmap(0/1)集合来表示文档是否匹配过滤器，那么在过滤器应用于其他请求时，就不需要再次计算匹配。
> 3. filter不光可以作用在`bool`查询中，也支持在`aggs`聚合中使用。

#### 其他查询

##### query_string

```http
POST /product/_search
{
  "query": {
    "query_string": {   // 更推荐simple_query_string
      "default_field": "nick_name", 
      "fields": ["nick_name", "title"], // 与default_field不能共存，只能二选一出现。
      "query": "apple Phone1" // 默认会对搜索词进行分词再匹配，与match相同。
    }
  }
}
```

> 1. query_string在不显式指定default_field属性时，默认会对所有文档的字段都进行匹配。会影响性能，不推荐使用。
> 2. 相比query_string，更推荐simple_query_string，使用时必须要指定查询哪些字段。

##### range

```http
# 范围查询
POST /product/_search
{
  "query": {
    "range": {
      "time": {
        "lte": "20221101"
      }
    }
  }
}
# 范围查询，指定日期格式
POST /product/_search
{
  "query": {
    "range": {
      "time": {
        "lte": "2022-11-01",
        "format": "yyyy-MM-dd||yyyyMMdd" // ES会将输入的yyyy-MM-dd的参数转换为yyyyMMdd
      }
    }
  }
}
```

> 1. 基于时间进行查询时，需要注意输入的格式需要与mapping中定义的格式相同。
> 2. <a href="https://www.elastic.co/guide/en/elasticsearch/reference/7.17/query-dsl-range-query.html">date类型</a>支持表达式（y表示年，M表示月，d表示天），比如`20221010||/M`表示为`20221001`，`20221010||/y`表示为`20220101`，`now-1y/d`表示为当前时间减1年后包含日的时间，若now为`20221010`，那么结果为`20211010`。同理`now-4M/M`，结果为`20220601`。

##### prefix

```http
POST /product/_search
{
  "query": {
    "prefix": {
      "title": {
        "value": "苹果"
      }
    }
  }
}
```

> 1. prefix不会对搜索词进行分析，大小写敏感，score永远为1，不能缓存的filter。

##### wildcard

```http
POST /product/_search
{
  "query": {
    "wildcard": {
      "title": {
        "value": "b*"
      }
    }
  }
}
```

> 1. wildcard使用通配符进行查询，*匹配多个字符或汉字，?匹配一个字符或汉字。
> 2. 大小写敏感，如果是`buy apple phone`，那么通配符是`bu*`这种才可以，`buy app*`是不能完全匹配的。
> 3. 尽量避免`*b`这样的操作，和mysql一样，避免左通配让索引失效。

##### exist

```http
POST /product/_search
{
  "query": {
    "bool": {
      "filter": [
        {
          "exists": {
            "field": "name"
          }
        }
      ]
    }
  }
}
```

> 用于判断字段是否存在，存在会返回文档信息。

---

### 聚合操作

1. 如果查询和聚合一起出现，那么ES会先根据查询过滤文档，对符合条件的文档再进行聚合操作。

2. 需要注意的是`text`类型的因为会分词，尽量不要用于聚合，建议使用`keyword`类型的字段进行聚合。在此前提下仍需要聚合的话，有两种方式：

- 使用`字段.keyword`替代`字段`，即使用`name.keyword`作为聚合field。
- 设置字段类型时，加上`fielddata:true`的配置。

#### 单值聚合

```http
POST /product/_search
{
  "aggs": {
    "avg_aggs": {
      "avg": {           // 聚合类型： 平均值
        "field": "price"
      }
    }
  },
  "size": 0
}
```

> 1. 聚合类型：value_count（数量汇总）、avg（平均值）、sum（求和）、max（最大值）、min（最小值）、cardinality（基数）。
> 2. <a href="https://www.elastic.co/guide/cn/elasticsearch/guide/current/cardinality.html">cardinality</a>作用等同于SQL中的count(distinct)，但是它是一个近似算法，ES提供了`precision_threshold`来设置阈值，默认是100，`字段基数如果在阈值一下，几乎100%是准确的，高于阈值会为了节省内存而牺牲精度`。

#### 多值聚合

##### percentiles

```http
POST /product/_search
{
  "aggs": {
    "percent_aggs": {
      "percentiles": {
        "field": "price",
        "percents": [
          50
        ]
      }
    }
  },
  "size": 0
}
# 结果
{
  "took" : 0,
  "timed_out" : false,
  "_shards" : {
    "total" : 1,
    "successful" : 1,
    "skipped" : 0,
    "failed" : 0
  },
  "hits" : {
    "total" : {
      "value" : 2,
      "relation" : "eq"
    },
    "max_score" : null,
    "hits" : [ ]
  },
  "aggregations" : {
    "percent_aggs" : {
      "values" : {
        "50.0" : 5999.0 // 符合条件的值中，50%的数据不超过5999.0
      }
    }
  }
}
```

> 1. percentiles理解成百分位，用来表示所有值中百分之多少比这个值低，这个百分比是查询时传递的参数。

##### percentile_ranks

```http
POST /product/_search
{
  "aggs": {
    "percent_aggs": {
      "percentile_ranks": {
        "field": "price",
        "values": [
          4999
        ]
      }
    }
  },
  "size": 0
}
```

> 1. 与percentiles完全相反，查询时传递值参数，计算百分比，即百分之多少的数据低于这个值

##### stats

```http
POST /product/_search
{
  "aggs": {
    "stats_aggs": {
      "stats": {
        "field": "price"
      }
    }
  },
  "size": 0
}
```

> 1. stats是`count、min、max、avg、sum`指标的汇总。

##### extended_stats

```http
{
  "aggs": {
    "stats_aggs": {
      "extended_stats": {
        "field": "price"
      }
    }
  },
  "size": 0
}
```

> 1. extended_stats是stats的扩展，添加了`标准差和平方和`。

##### terms

```http
POST /product/_search
{
  "aggs": {
    "terms_aggs": {
      "terms": {
        "field": "price",
        "size": 10, // 分片数据汇总后返回的数量
        "shard_size": "10", // 每个分片最多返回的数量
        "min_doc_count": "10", // group by后最小的count数量，低于此数量的不展示
        "include": ".*", // 通配符过滤bucket数据
        "exclude": ".*", // 排除符合的bucket数据
        "order": {
          "_key": "desc",
          "_count": "asc"
        }
      }
    }
  },
  "size": 0
}
```

> 1. terms中的size用于控制聚合中符合条件的doc_count数量，即group by price limit size。
> 2. terms支持对结果排序，`_key`表示按照字母顺序，`_count`表示按照聚合后的统计数量进行排序。

##### range

```http
POST /product/_search
{
  "aggs": {
    "range_aggs": {
      "range": {
        "field": "price",
        "ranges": [
          {
            "from": 4000,
            "to": 7000
          }
        ]
      }
    }
  }
}
# 时间range聚合
POST /product/_search
{
  "aggs": {
    "date_aggs": {
      "date_range": {
        "field": "time",
        "ranges": [
          {
            "from": "now-1y/y",
            "to": 20221101
          }
        ]
      }
    }
  }
}

```

> 1. range支持多个区间的桶聚合，返回的结果中将`from-to`组合成key返回，范围区间为`左闭右开`。
> 2. `date_range`中时间字段同样支持`date`表达式。

##### histogram 

```http
POST /product/_search
{
  "aggs": {
    "histogram_aggs": {
      "histogram": {
        "field": "price",
        "interval": 50, 
        "min_doc_count": 0
      }
    }
  }
}
{
 "aggregations" : {
    "histogram_aggs" : {
      "buckets" : [
        {
          "key" : 4950.0, // 表示 4950 -> (4950 +interval)这个区间有1条符合条件的文档
          "doc_count" : 1
        }
      ]
    }
  }
}
# date_histogram
POST /product/_search
{
  "aggs": {
    "histogram_aggs": {
      "date_histogram": {
        "field": "time",
        "calendar_interval": "1d", // 支持分钟 (1m)、小时 (1h)、天 (1d)、星期 (1w)、月 (1M)、季度 (1q)、年 (1y)
        "missing": "20220907", 
        "time_zone": "+08:00", 
        "min_doc_count": 1
      }
    }
  }
}
```

> 1. histogram又称为直方图聚合，interval用于指定区间的间隔，min_doc_count用于筛选符合数量的区间。

##### nested

```http
POST /product/_search
{
  "aggs": {
    "first_aggs": {
      "terms": {
        "field": "category"
      },
      "aggs": {
        "second_aggs": {
          "terms": {
            "field": "price",
            "size": 10
          }
        }
      }
    }
  }
}
```

> 1. 嵌套聚合，就是在第一个聚合的基础上再次聚合。

##### global

```http
POST /product/_search
{
  "query": {
    "bool": {
      "must": [
        {
          "match_all": {}
        }
      ],
      "filter": [
        {
          "range": {
            "time": {
              "gte": 20221001,
              "lte": 20221020
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "first_aggs": {
      "global": {},
      "aggs": {
        "first_aggs": {
          "terms": {
            "field": "category"
          }
        }
      }
    }
  }
}
```

> 1. 如果使用了global，那么搜索查询和聚合两者互不影响，即聚合的文档不由搜索决定。

---

### 深度分页

#### from&size

from表示查询的起始位置，size表示每页的文档数量，`from=100&size=20`表示查询`100-120`条数据。

ES在处理from&size的查询时，会先从每个分片上拿取数据，然后在协调节点（coordinating node）上对数据汇总排序，如果是9900-10000的数据，ES会汇总10000条文档，取9900-10000的文档数据返回。所以分页越深，ES需要的内存越多，开销越大。这也是为什么ES默认现在`from+size<=10000`的原因。

```http
# 修改from + size 限制数量
PUT /{index}/_settings
{
	"index.max_result_window": "10001"
}
```

#### scroll

scroll查询作用于需要查询大量的文档，同时对文档的实时性要求不高的情况。使用scroll查询，第一次会生成当前查询条件的快照（快照的缓存时间由查询语句决定），后面每次翻页都基于快照的结果（有新的数据进来也不会被查询出来），滚动查询结果知道没有匹配的文档。

协调节点接受到scroll请求，会请求各个节点的数据，将符合条件的文档id汇总，打成快照缓存下来（query），当后续请求携带scroll_id时，根据这个scroll_id定位到各个节点的游标位置（fetch），最后汇总返回指定size的文档（merge）。

```http
# 第一次请求
POST /product/_search/?scroll=1m
{
  "from": 0, // from第一次只能为0，可以省略不写
  "size": 1
}
# 请求时需要携带上一次请求返回的scroll_id
POST /_search/scroll
{
  "scroll_id": "FGluY2x1ZGVfY29udGV4dF91dWlkDXF1ZXJ5QW5kRmV0Y2gBFDZjMUNNSVlCRC1nd3VJaW5wa0dWAAAAAAAAp9IWekFfNnF0SnZTd0NNQk92VUJ5MUo1QQ==",
  "scroll": "1m"
}
# 删除所有scroll
DELETE /_search/scroll/_all
# 删除指定scroll
DELETE /_search/scoll
{
  "scroll_id": ["xxxqdqqd==","dadwqdqw=="]
}
```

> 1. 第一次请求返回的scroll_id在ES7.8版本中是不变的，可以一直作为参数请求直到快照过期。
> 2. 因为实时性问题，scroll用于实时性不高的任务，比如后台导出大量数据等。

#### search_after

```http
# 第一次查询
POST /product/_search
{
  "query": {
    "match_all": {
    }
  },
  "from": 0, // 第一次传必须是第一页，所以可以省略
  "size": 1, // 指定每次滚动查询的size
  "sort": [
    {
      "_id":"desc", //_id是文档默认id
      "id": "desc"  // id是mapping中定义的业务id
    }
  ]
}
{
 ...
  "hits": {
    ...
    {
      "sort" : [
        "EM3zM4YBD-gwuIin6Jtp",
        1001
      ]
    }
  }
}
# 第二次请求需要携带search_after参数
POST /product/_search
{
  "query": {
    "match_all": {
    }
  },
  "search_after": ["EM3zM4YBD-gwuIin6Jtp","1001"]
  "sort": [
    {
      "_id":"desc",
      "id": "desc"
    }
  ]
}
```

> 1. search_after必须先要指定sort排序（可以是多个字段），并且从第一页开始搜索，并且需要文档有唯一索引（一般是_id或自定义的唯一索引，在新增文档的时候，最好不要指定`_id`，让ES默认生成）。
> 2. search_after不能指定from，只能请求下一页的业务场景（滚动查询），与scroll相比，两者都采用了游标的方式实现滚动查询，但相比scroll基于快照的不实时，search_after每次查询都会针对`最新的文档`，即在search_after查询期间，排序的顺序可能是变化的。
> 3. 我们假设有2个shard，指定time为排序字段，查询20条数据，那么每个shard执行`order by time where time > 0 limit 20`，在协调节点汇总后取前20条数据。
> 4. 第一次查询返回的索引值作为第二次查询的参数，即`order by time where time > $max_time limit 20`，协调节点汇总返回前20条，以此循环反复，直到没有数据返回。
> 5. 假设我们存在id为`1,3,4`的文档数据，size=1，第一次查询我们获取到第一条数据（id=1），在我们查询第二条之前，如果查询了插入了id为2的文档数据，此时继续查询时，会查询到这条文档id为2的数据（假设文档立即入库，实际上还受到refresh_interval的影响）。

#### 对比

| 分页类型     | 优点                   | 缺点                                       |
| ------------ | ---------------------- | ------------------------------------------ |
| from&size    | 使用简单灵活、支持跳页 | 深度分页占用大量资源，默认from+size<=10000 |
| scroll       | 适用非实时处理大量数据 | 基于快照，数据非实时，不能跳页             |
| search_after | 参数无状态，实时查询。 | 需要指定排序和唯一字段，不能跳页。         |

```http
# 验证scroll的非实时和search_after的实时查询
# 1. 新建索引和mapping
PUT /test
{
  "mappings": {
    "properties": {
      "uuid": {
        "type": "keyword"
      },
      "name": {
        "type": "text"
      }
    }
  }
}
# 2. 新增2条文档，uuid不连续
POST /test/_bulk
{"create": {}}
{"uuid": "1001","name": "小米手机"}
{"create": {}}
{"uuid": "1003","name": "苹果手机"}
# 3.1 执行scroll的第一步请求
POST /test/_search?scroll=1m
{
  "size": 1
}
# 3.2 执行 search_after的第一步请求
POST /test/_search
{
  "query": {"match_all": {}},
  "size": 1,
  "sort": ["uuid"]
}
# 4. 执行文档插入操作，uuid为1002
POST /test/_doc
{
  "uuid": "1002",
  "name": "华为手机"
}
# 5. 分别执行scroll和search_after第二步查询文档数据查看结果。
```

> 1. 按照上述的查询流程，第五步查询时，scroll查询的是uuid为1003的数据（非实时），search_after查询的是uuid为1002的新增数据（实时）。