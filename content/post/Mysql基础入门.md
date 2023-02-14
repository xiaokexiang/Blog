---
title: "Mysql学习笔记"
date: 2021-07-23T09:51:37+08:00
description: "基于掘金小册《Mysql是怎样运行》的读书笔记。"
tags: ["Mysql"]
categories: [
  "Mysql"
]
slug: mysql
---
## MySQL中的字符集和比较规则

### 字符集

```mysql
SHOW CHARSET LIKE 'utf8_%';
```

| 字符集                                         | 编码长度                                           |
| ---------------------------------------------- | -------------------------------------------------- |
| ASCII（128个字符）                             | 1字节                                              |
| ISO 8859-1（256个字符，又叫latin1）            | 1字节                                              |
| GB2312（收录6763个汉字，兼容ASCII）            | 字符在ASCII中采用1字节，否则2字节                  |
| GBK（对GB2312进行扩充，兼容GB2312）            | 与GB2312相同                                       |
| Unicode（兼容`ASCII`字符集，采用变长编码方式） | UTF-8:：1-4个字节，UTF-16：2或4字节，UTF-32：4字节 |

> MySQL中的`utf8`和`utf8mb4`字符集区别在于前者是1-3字符（阉割），后者是1-4字符。

### 比较规则

```mysql
SHOW COLLATION LIKE 'utf8_%';
```

|  后缀  |         英文         |    不区分重音    |
| :----: | :------------------: | :--------------: |
| `_ai`  | `accent insensitive` |    不区分重音    |
| `_as`  |  `accent sensitive`  |     区分重音     |
| `_ci`  |  `case insensitive`  |   不区分大小写   |
| `_cs`  |   `case sensitive`   |    区分大小写    |
| `_bin` |       `binary`       | 以二进制方式比较 |

> MySQL中utf8默认的比较规则就是`utf8_general_ci`。

### 字符集与比较规则的级别

```mysql
# [服务器级别]
SHOW VARIABLES LIKE 'character_set_server';
SHOW VARIABLES LIKE 'collation_server';
# [创建或修改数据库比较规则]
CREATE[ALTER] DATABASE [database_name] CHARACTER SET utf8 COLLATE utf8_general_ci;
# [数据库级别]
USE [database_name];
SHOW VARIABLES LIKE 'character_set_database';
SHOW VARIABLES LIKE 'collation_database';
# [表级别] 如果表不设置字符集和比较规则，默认继承数据库的配置
CREATE[ALTER] TABLE unicode(name VARCHAR(10)) CHARACTER SET utf8 COLLATE utf8_general_ci;
# [表级别] 查看表的字符集和编码规则
SHOW TABLE STATUS FROM unicode;

# [创建列的字符集和比较规则] 不设置默认读取表的配置
CREATE TABLE line(
	name VARCHAR(10) CHARACTER SET utf8 COLLATE utf8_general_ci,
    age INT(16)
)
ALTER TABLE [table_name] MODIFY [column] VARCHAR CHARACTER SET latin1 COLLATE latin1_general_cs;
```

> 无论是只修改字符集或比较规则，未设置的一方都会自动的改为与修改一方对应的配置。

### MySQL中字符集的转换

![](https://image.leejay.top/FrSGcCPcK8QLB6_kDsuBDygM8shm)

> 可以使用`SET NAMES utf8;`一起设置如上三个参数配置。

---

## MySQL索引

### 概念

#### B+树

B+树最上层的是根节点，还包含存放目录记录的数据页（目录页）非叶子节点和存放用户记录的数据页（用户记录页）叶子节点。

![](https://image.leejay.top/Fk4MgNHjS271O1t7aTzGFQ8mwf6A)

> 目录页和用户记录页的区别在于前者中的目录数据的`record_type = 1`，后者的用户记录数据的`record_type  = 0`。目录页中映射的索引列的值都是对应用户记录页中索引列的最小值。

#### 聚簇索引

根据`主键值的大小(从小到大)`进行目录页（双向链表）和记录页（单向链表）的排序，B+树的叶子节点存储的是`完整的用户数据（包括隐藏列）。`InnoDB存储引擎会自动的为我们创建聚簇索引。

#### 二级索引

根据`指定列的大小（从小到大）`进行目录页（双向链表）和记录页（单向链表）的排序， B+树的叶子节点存储的是``指定列的值 + 主键值`，相比聚簇索引，二级索引第一次查询得到主键值后，会进行第二次`回表查询`操作。

> 二级索引在目录页中存放的记录是`指定列 + 主键值 + 目录页码（保证唯一性）`，这样能够在指定列出现相同值时定位到目录页（叶子节点）。
>
> 回表还是全表扫描，这个是由回表的代价决定的，如果第一次查询二级索引（顺序IO）有90%的数据需要回表查询(随机IO)，那么不如直接进行全表扫描（这个是由`查询优化器`决定的）。
>
> 所以更推荐`覆盖索引`，即查询的列表中只包含索引列。
>
> ```mysql
> # 这样就不需要回表查询了，因为查询的字段在二级索引的叶子节点中都存在
> SELECT name, birthday, phone_number FROM person_info ORDER BY name, birthday, phone_number;
> ```

#### 联合索引

本质上也是一个二级索引，现根据A列的大小进行排序，在A列的值相等的情况下根据B列的值进行排序。非叶子节点（目录页）由`A列 + B列 + 主键 + 页码`组成，同时叶子节点的用户记录由`A列 + B列 + 主键列`组成。

#### 注意事项

- 每当表创建一个B+树时，都会为这个索引创建一个根节点页面，随着表中插入数据，会先把数据插入根节点中，随着数据量增多，会复制数据到新的页中，并升级为目录页。此过程中根节点地址是不会变的，变的只是角色。
- 一个页面至少存储两条数据。

#### 索引的查询

```mysql
# 创建表时添加索引
CREATE TABLE demo(
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(10),
  PRIMARY KEY(id),
  UNIQUE INDEX idx_name(name) # 创建唯一索引
)
# 修改表添加索引
ALTER TABLE demo DROP INDEX idx_name;
ALTER TABLE demo ADD FULLTEXT INDEX f_name_idx(name); 
```

---

### 索引适用条件

#### 全值匹配

搜索条件中的列和索引列一致的话，这种情况就称为全值匹配。即使我们不按照联合索引创建的列的顺序查询，也是会走联合索引的（查询优化器）。

#### 最左匹配

在全值匹配的基础上，查询可以不用包含全部的列，只需要包含一个或多个最左边的列就可以（最左匹配原则）。我们按照`a-b-c`的顺序创建了联合索引，那么`a、a-b、a-b-c、a-c（a生效）`查询方式都是可以走联合索引的。但`b-c`是不生效的。

> 最左匹配原则遇到`范围查询`就会停止匹配。

#### 前缀匹配

查询的字符串列的前缀都是排好序的，那么只匹配它的前缀也是可以快速定位记录。

```mysql
SELECT * FROM person_info WHERE name LIKE 'As%'; √
SELECT * FROM person_info WHERE name LIKE '%As%'; ×
```

> 针对一些无法使用前缀匹配的字段，比如`xxx.com`的搜索，我们可以反转字符串然后基于`com%`进行前缀匹配。

#### 范围匹配

```mysql
SELECT * FROM person_info WHERE name > 'Asa' AND name < 'Barlow';
```

> 基于联合索引（此处只用到了`name`）找到第一个大于`Asa`的数据返回主键，回表查询返回给客户端。然后沿着上一步记录所在的链表继续查找，下一条二级索引记录，并判断是否符合小于`Barlow`，符合就回表查询并返回数据，重复步骤直到条件不符合。

```mysql
SELECT * FROM person_info WHERE name > 'Asa' AND name < 'Barlow' AND birthday > '1980-01-01';
```

> 基于上步的范围匹配流程得到的结果集，进行`birthday > '1980-01-01'`再匹配（但不会走联合索引）。

#### 精确匹配某一列与范围匹配另一列

```mysql
SELECT * FROM person_info WHERE name = 'Ashburn' AND birthday > '1980-01-01' AND birthday < '2000-12-31' AND phone_number > '15100000000'; ×
SELECT * FROM person_info WHERE name = 'Ashburn' AND birthday = '1980-01-01' AND phone_number > '15100000000'; √
```

> `name`等值匹配可以走联合索引，当`name相同时`都是按照`birthday`从小到大的进行排序，所以可以进行`birthday`的范围匹配，但`birthday`的范围匹配就无法保证`phone_number`从小到大排序，所以`phone_number`只能遍历结果进行筛选，无法走联合索引。

#### 排序

```mysql
SELECT * FROM person_info ORDER BY name, birthday, phone_number LIMIT 10; √
SELECT * FROM person_info ORDER BY name asc, birthday desc, phone_number asc; ×
SELECT * FROM person_info WHERE name = 'A' ORDER BY birthday, phone_number LIMIT 10; √
SELECT * FROM person_info ORDER BY name, country LIMIT 10; ×
SELECT * FROM person_info ORDER BY UPPER(name) LIMIT 10; ×
```

> 按照联合索引的顺序进行排序（默认联合索引的B+树就按照这个顺序创建）。
>
> 1. 如果联合索引中的每个列的查询顺序不一致，那么不能使用索引进行排序。
> 2. 如果排序中列包含非同一个索引的列，那么不能使用索引进行排序。
> 3. 排序列使用了复杂的表达式，如`UPPER()、REPLACE()`等。

#### 分组

```mysql
SELECT name, birthday, phone_number, COUNT(*) FROM person_info GROUP BY name, birthday, phone_number; √
```

> `group by`按照联合索引的顺序，索引也是生效的。

### 如何使用索引

- 只为用于搜索、排序、分组的列创建索引。

- 为基数大（这一列中不重复的数据，基数越大不重复的越多）的列创建索引。

- 索引列的类型尽量的小（减少磁盘占用和提升读写IO）。

- 索引字符串值的前缀，针对列的值特别长的情况（但是基于`此列的排序会走文件排序`：在内存或磁盘中排序）。

  ```mysql
  # 添加字符串前缀索引，只索引前10个字符的编码
  ALTER TABLE person_info ADD INDEX idx_name(name(10));
  ```

  > 通过前缀索引然后定位到相应前缀所在的位置，然后回表匹配完成的字符串。

- 索引列在比较表达式中单独出现（age > 2 √  age * 2 > 10  ×）。

- 主键最好自增，避免因为主键值忽大忽小带来的页分裂问题（性能损失）。

- 避免创建冗余和重复索引。

- 尽量使用索引覆盖（查询索引中的字段）进行查询，避免由回表查询变为全文搜索。

---

## MySQL的数据目录

### 数据目录的组成

```mysql
# 查看mysql的数据目录（不是安装目录，安装目录包含bin文件夹）
SHOW VARIABLES LIKE 'datadir';
```

> MySQL的数据目录下存在与`创建的数据库同名`的文件夹，文件夹内会存在`表名.frm`和`表名.ibd`两种类型的文件。
>
> 其中`表名.frm`是表结构的描述文件，`表名.ibd`存放的是表的数据（MySQL5.6.6以前的版本中所有的表记录都存放到名为ibdata1的文件中（系统表空间），之后的版本中每个表都对应着一个`表名.ibd`的文件（独立表空间）。
>
> 除此之外，数据目录下还存在MySQL服务进程文件、日志文件、SSL和RSA密钥文件等。

## MySQL系统数据库

- `mysql`

  它存储了MySQL的用户账户和权限信息，一些存储过程、事件的定义信息，一些运行过程中产生的日志信息，一些帮助信息以及时区信息等。

- `information_schema`

  这个数据库保存着MySQL服务器维护的所有其他数据库的信息，比如有哪些表、哪些视图、哪些触发器、哪些列、哪些索引。这些信息并不是真实的用户数据，而是一些描述性信息，有时候也称之为元数据。

- `performance_schema`：

  这个数据库里主要保存MySQL服务器运行过程中的一些状态信息，算是对MySQL服务器的一个性能监控。包括统计最近执行了哪些语句，在执行过程的每个阶段都花费了多长时间，内存的使用情况等等信息。

- `sys`

  这个数据库主要是通过视图的形式把`information_schema`和`performance_schema`结合起来，让程序员可以更方便的了解MySQL服务器的一些性能信息。

---

## MySQL的单表访问方法

MySQL执行查询语句的方式称为`访问方法`。对于单表来说，MySQL的单表查询方式被分为`全表扫描查询`和`索引查询`。

### 单表访问方法

![](https://image.leejay.top/FqwMONwuoy55A6NFM1ghvcBD090-)

### 单表访问的注意事项

#### 单个二级索引

`一般情况`下只能利用`单个二级索引`执行查询。

```mysql
SELECT * FROM single_table WHERE key1 = 'abc' AND key2 > 1000;
```

> MySQL查询优化器会判断使用哪个二级索引查询扫描的行数更少，选择较少的那个二级索引查询主键，回表查询后将得到的结果再根据其他的条件进行过滤。

#### 索引合并

一般情况下执行一个查询时最多只会用到单个二级索引，但使用到多个索引来完成一次查询的执行方法称之为：`index merge（索引合并）`。

- Intersection合并

某个查询可以使用多个二级索引，将二级索引查询的结果取`交集`，再回表查询。必须符合如下情况才可能会使用到Intersection合并：

1. 二级索引列都是等值匹配的情况，对于联合索引来说，在联合索引中的`每个列都必须等值匹配`，不能出现只匹配部分列的情况。

```mysql
SELECT * FROM single_table WHERE key1 = 'a' AND key3 = 'b';
```

2. 主键列可以是范围匹配。因为二级索引的列相同时会按照主键的顺序进行排序，有序的主键有助于提升取交集速度。

```mysql
# 可能会用到聚簇索引和二级索引合并，因为key1作为二级索引叶子节点中是包含主键的，可以直接二级索引查询后再
# 进行主键匹配，然后回表。这里主键的搜索条件只是从别的二级索引得到的结果集中过滤记录。是不是等值不重要
SELECT * FROM single_table WHERE id > 100 AND key1 = 'a'; 
```

> 按照有序的主键回表取记录有个专有名词叫：Rowid Ordered Retrieval，简称ROR。

上述的条件一二是发生Intersection合并的必要条件，但不是充分条件，也就是说即使情况一、情况二成立，也不一定发生`Intersection`索引合并，这得看优化器的心情。优化器只有在单独根据搜索条件从某个二级索引中获取的记录数太多，导致回表开销太大，而通过`Intersection`索引合并后需要回表的记录数大大减少时才会使用`Intersection`索引合并。

如果多个列不需要单独使用的话还是`推荐使用联合索引替代索引合并`，少读一颗B+树的同时也不同合并结果。

- Union合并

某个查询可以使用多个二级索引，将二级索引查询的结果取`并集`，再回表查询。必须符合如下情况才可能会使用到Union合并：

1. 二级索引列都是等值匹配的情况，对于联合索引来说，在联合索引中的`每个列都必须等值匹配`，不能出现只匹配部分列的情况。
2. 主键列可以是范围匹配
3. 使用`Intersection`索引合并的搜索条件

```mysql
SELECT * FROM single_table WHERE key_part1 = 'a' AND key_part2 = 'b' AND key_part3 = 'c' OR (key1 = 'a' AND key3 = 'b');
```

> 1. 先按照`key1 = 'a' AND key3 = 'b'`使用`Intersection索引合并`的方式得到一个主键集合。
> 2. 再通过ref的访问方法获取`key_part1 = 'a' AND key_part2 = 'b' AND key_part3 = 'c'`的主键集合。
> 3. 采用`Union`索引合并的方式把上述两个主键集合取并集，然后进行回表操作返回数据。

- Sort-Union合并

按照二级索引记录的主键值进行排序，之后按照`Union`索引合并方式执行的方式称之为`Sort-Union`索引合并。比单纯的`Union`索引合并多了一步对二级索引记录的主键值排序的过程。

> Intersection合并适合的是从二级索引中获取的记录数太多，导致回表开销太大而出现的，如果存在Sort-Intersection合并，那么对大量数据进行排序是非常耗时的，所以不存在Sort-Intersection合并。

---

## Mysql多表查询

### 连接的过程

1. 首选确定第一个需要查询的表，这个表被称为`驱动表`（基于单表查询代价最小的表）。根据条件过滤驱动表数据。驱动表只会被查询一次。
2. 根据驱动表查询的每一条记录依次去`被驱动表`中寻找匹配的记录。驱动表有多少条符合条件的数据，被驱动表就会被访问几次。

### 连接的类型

![](https://image.leejay.top/Fi6x8i1-tA_70KPt3y3JTYAVBwJ8)

```mysql
# 内连接
SELECT A.*, B.* FROM A,B WHERE A.id = B.id;
# 左外连接
SELECT A.*, B.* FROM A LEFT JOIN B ON A.id = B.id WHERE A.age > 10;
# 右外连接
SELECT A.*, B.* FROM A RIGHT JOIN B ON A.id = B.id WHERE A.age > 10;
```

> 如果是超过两张表的连接，那么先连接两张表，再将两张表的结果作为新的驱动表执行连接操作。

### 连接的原理

#### 循环嵌套连接

驱动表只访问一次，但被驱动表却可能被多次访问，访问次数取决于`对驱动表执行单表查询后的结果集中的记录条数`的连接执行方式称之为`嵌套循环连接`（`Nested-Loop Join`）

- 步骤1：选取驱动表，使用与驱动表相关的过滤条件，选取代价最低的单表访问方法来执行对驱动表的单表查询。
- 步骤2：对上一步骤中查询驱动表得到的结果集中每一条记录，都分别到被驱动表中查找匹配的记录。

> 我们可以通过给被驱动表添加`索引`来实现快速连接，因为被驱动表可能会访问多次。

#### 基于块的连接

循环嵌套连接中，每次匹配都是`驱动表`拿出一条记录，然后从`被驱动表中取出记录加载到内存中`，然后被驱动表的记录和这一条驱动表记录进行比对，然后从内存中清除被驱动表记录。再拿出驱动表的另一条记录，再将被驱动表的记录加载到内存中进行比对，所以有多少条驱动表记录，那么被驱动表就会被加载到内存中多少次。

块连接是基于`join buffer`的嵌套连接算法。

> `join buffer`是在执行连接查询前申请的`一块固定大小的内存`，先把若干条驱动表结果集中的记录装在这个`join buffer`中，然后开始扫描被驱动表，每一条被驱动表的记录一次性和`join buffer`中的多条驱动表记录做匹配。

假设A表和B表进行基于块的连接查询，那么A表会根据A的条件进行单表查询（不包含关联条件），将结果放入`join buffer`，再执行B表的条件查询（不包含关联条件），将结果放入`join buffer`中，在内存中进行匹配，执行一批后再进行下一批，如此往复。

`join buffer`通过参数`join_buffer_size`设置，默认`262144字节（256k）`。需要注意的是`驱动表的记录并不是所有列`都会被放到`join buffer`中，只有`查询列表中的列和过滤条件中的列`才会被放到`join buffer`中，所以连接查询中我们不要用`*`作为查询列，这样可以将更多的表记录放到`join buffer`中。

---

## Mysql基于成本的优化

### 成本的定义

- I/O成本：数据从磁盘加载到内存中,基于InnoDB存储引擎，页是交互的基本单位，成本常数为1.0。
- CPU成本：读取以及检测记录是否满足对应的搜索条件，对结果集进行排序.成本常数为0.2。

### 单表查询的成本

#### 基于成本的优化步骤

![](https://image.leejay.top/FjnYzl9paMRg3ikoAe8c1KitfQgO)

#### 基于索引统计数据的成本计算

![](https://image.leejay.top/Fr9WBjq_vmiWXxIa7y5xoXqSEQay)

### 多表连接的成本

![](https://image.leejay.top/FoM8ItkUI26AxAhNrgCF0GKj7bYh)

> 多表连接的成本计算`依托于单表查询的成本计算`，且`多表连接的顺序不同导致不同的成本（n!种顺序，n>1）`。

---
## Mysql基于规则的优化
### 条件化简
![](https://image.leejay.top/FrMLiZwyvlTu1ehOMCowMU7H5cOE)

### 外连接消除
外连查询中的被驱动表的 IS NOT NULL等同于两表内联查询。
```mysql
SELECT S1.*, S2.* FROM S1 LEFT JOIN S2 ON S1.id = S2.id WHERE S2 IS NOT NULL;
转换为
SELECT S1.*, S2.* FROM S1,S2 WHERE S1.id = S2.id
```

### 子查询优化 
![](https://image.leejay.top/Fqla9zqISkoC9etH3NDWb0KAZMdP)

---

## Explain

一条查询语句在经过MySQL查询优化器`基于成本和规则的优化`后会生成`执行计划`。执行计划可以展示具体的执行查询方式。而`EXPLAIN`可以帮助我们查询具体查询的执行计划。

```mysql
# 不限于SELECT,DELETE,UPDATE,REPLACE都可以
EXPLAIN SELECT * FROM T1 WHERE id = 1;
```

### Explain名词解释

#### id

在一个查询语句中每个`SELECT`关键字都对应一个唯一的`id`。

1. 即使存在多个SELECT也可能被优化成一个。
2. 关联查询Explain排在前面的记录就是驱动表，后面的是被驱动表。
3. id为null的时候说明创建了临时表用于存放数据。

#### select_type

| 类型                   | 含义                                                         |
| :--------------------- | :----------------------------------------------------------- |
| **SIMPLE**             | 查询语句中不包含`UNION`或者子查询的查询                      |
| **PRIMARY**            | 对于包含`UNION`、`UNION ALL`或者子查询的大查询来说，它是由几个小查询组成的，其中最左边的那个查询的`select_type`值就是`PRIMARY` |
| **UNION**              | 对于包含`UNION`、`UNION ALL`或者子查询的大查询来说，它是由几个小查询组成的，除了最左边的查询，其余的查询`select_type`值就是`UNION` |
| **UNION RESULT**       | MySQL`选择使用临时表来完成`UNION`查询的去重工作，针对该临时表的查询的`select_type`就是`UNION RESULT |
| **SUBQUERY**           | 如果包含子查询的查询语句不能够转为对应的`semi-join`的形式，并且该子查询是不相关子查询，并且查询优化器决定采用将该子查询物化的方案来执行该子查询时，该子查询的第一个`SELECT`关键字代表的那个查询的`select_type`就是`SUBQUERY` |
| **DEPENDENT SUBQUERY** | 如果包含子查询的查询语句不能够转为对应的`semi-join`的形式，并且该子查询是相关子查询，则该子查询的第一个`SELECT`关键字代表的那个查询的`select_type`就是`DEPENDENT SUBQUERY` |
| **DEPENDENT UNION**    | 在包含`UNION`或者`UNION ALL`的大查询中，如果各个小查询都依赖于外层查询的话，那除了最左边的那个小查询之外，其余的小查询的`select_type`的值就是`DEPENDENT UNION` |
| **DERIVED**            | 对于采用物化的方式执行的包含派生表的查询，该派生表对应的子查询的`select_type`就是`DERIVED` |
| **MATERIALIZED**       | 当查询优化器在执行包含子查询的语句时，选择将子查询物化之后与外层查询进行连接查询时，该子查询对应的`select_type`属性就是`MATERIALIZED` |

#### type

对应着单表的访问方式，<a href="###单表访问方法">上文的单表访问方法</a>中介绍了一部分，但仍包含部分没有介绍。

|      访问方法       |                             释义                             |
| :-----------------: | :----------------------------------------------------------: |
|     **system**      | 当表中只有一条记录并且该表使用的存储引擎的统计数据是精确的（MyISAM） |
|      **const**      |         根据主键或者唯一二级索引列与常数进行等值匹配         |
|     **eq_ref**      | 被驱动表是通过主键或者唯一二级索引列等值匹配（联合索引全部等值匹配）的方式进行访问 |
|       **ref**       |              普通的二级索引列与常量进行等值匹配              |
|   **ref_or_null**   |      当对普通二级索引进行等值匹配查询，且同时查询null值      |
|   **index_merge**   | 使用<a href="####索引合并">索引合并</a>来执行查询，只有此类型可以使用多个索引 |
|      **range**      |                 聚簇索引或二级索引的范围查询                 |
|      **index**      |  当需要扫描全表的时候，查询的列正好包含在索引中（索引覆盖）  |
|       **ALL**       |                           全表扫描                           |
| **unique_subquery** | 类似于`eq_ref`，针对查询优化器将IN子查询转换为EXISTS，且子查询可使用主键进行等值匹配 |
| **index_subquery**  |   与`unique_subquery`类似，不过是子查询时使用的是普通索引    |

#### possible_keys和key

`possible_keys`列表示在某个查询语句中，对某个表执行单表查询时可能用到的索引有哪些，`key`列表示实际用到的索引有哪些。

> 1. 使用`index`访问方法来查询某个表时，`possible_keys`列是空的，而`key`列展示的是实际使用到的索引。
> 2. `possible_keys`列中的值并不是越多越好，可能使用的索引越多，查询优化器计算查询成本会花费更长时间。

#### key_len

`key_len`列表示当优化器决定使用某个索引执行查询时，该索引记录的最大长度，它是由这三个部分构成的：

- 对于使用固定长度类型的索引列来说，它实际占用的存储空间的最大长度就是该固定值
- 如果该索引列可以存储`NULL`值，则`key_len`比不可以存储`NULL`值时多1个字节。
- 对于变长字段来说，都会有2个字节的空间来存储该变长列的实际长度。

> 通过`key_len`我们可以区分某个使用联合索引的查询具体用了几个索引列。

#### ref

当使用索引列等值匹配的条件去执行查询时，`ref`列展示的就是与索引列作等值匹配的对象，可能是一个常数，一个列或者一个函数。

```mysql
SELECT * FROM TABLE WHERE a.id = 3; # const
SELECT * FROM TABLE_A A, TABLE_B B WHERE A.id = B.id; # TABLE_B.id
SELECT * FROM TABLE_A A, TABLE_B B WHERE A.id = UPPER(B.id); # func
```

#### rows

如果查询优化器决定使用全表扫描的方式对某个表执行查询时，执行计划的`rows`列就代表预计需要扫描的行数，如果使用索引来执行查询时，执行计划的`rows`列就代表预计扫描的索引记录行数。

#### filtered

`MySQL`在计算驱动表扇出时采用的一个策略：

- 如果使用的是全表扫描的方式执行的单表查询，那么计算驱动表扇出时需要估计出满足搜索条件的记录有多少条。
- 如果使用的是索引执行的单表扫描，那么计算驱动表扇出的时候需要估计出满足除使用到对应索引的搜索条件外的其他搜索条件的记录有多少条。

> rows x filerted 的值在全表扫描下就是`满足搜索条件的记录数`，在索引执行的单表扫描下就是`满足使用到的索引条件外的其他索引条件的记录数`。
>
> 在多表关联查询中，多用于计算驱动表的扇出值。

#### Extra

`Extra`列是用来说明一些额外信息的

| **值**                               | **释义**                                                     |
| :----------------------------------- | :----------------------------------------------------------- |
| **No tables used**                   | 查询语句的没有`FROM`子句时                                   |
| **Impossible WHERE**                 | 查询语句的`WHERE`子句永远为`FALSE`时                         |
| **No matching min/max row**          | 当查询列表处有`MIN`或者`MAX`聚集函数，但是并没有符合`WHERE`子句中的搜索条件的记录时 |
| **Using index**                      | 查询列表以及搜索条件中只包含属于某个索引的列（索引覆盖）     |
| **Using index condition**            | 有些搜索条件中虽然出现了索引列，但却不能使用到索引           |
| **Using where**                      | 1. 使用全表扫描来执行对某个表的查询，并且语句的`WHERE`子句中有针对该表的搜索条件2. 使用索引访问来执行对某个表的查询，并且该语句的`WHERE`子句中有除了该索引包含的列之外的其他搜索条件时 |
| **Using join buffer**                | 当被驱动表不能有效的利用索引加快访问速度，会基于`块连接`来加快连接速度 |
| **Not exists**                       | 如果`WHERE`子句中包含要求被驱动表的某个列等于`NULL`值的搜索条件，而且那个列又是不允许存储`NULL`值 |
| **Using intersect/union/sort_union** | 准备使用索引合并的方式执行查询（会标出使用索引合并的索引有哪些） |
| **Zero limit**                       | 使用limit 0 时会提示该信息                                   |
| **Using filesort**                   | 使用`文件排序`对结果进行排序（数据少时内存排序 ，多时磁盘排序），当能够使用`索引排序`的时候就不会使用文件排序 |
| **Using temporary**                  | 借助临时表来完成一些功能（去重、排序 等）                    |

#### Json格式查看成本

```mysql
EXPLAIN FORMAT=JSON SELECT common_field FROM TABLE GROUP BY common_field;
```

```json
{
  "query_block": {
    "select_id": 1, // 查询id（一个select一个id）
    "cost_info": { // 成本
      "query_cost": "0.35"
    },
    "grouping_operation": { // group by操作
      "using_temporary_table": true, // 是否使用了临时表
      "using_filesort": false, // 是否使用了文件排序
      "table": {
        "table_name": "single_table", // 查询的表名
        "access_type": "ALL", // 查询类型
        "rows_examined_per_scan": 1, // 查询表一次大概查询多少数据 = rows
        "rows_produced_per_join": 1, // 扇出的数据量
        "filtered": "100.00", // filtered
        "cost_info": { // 成本
          "read_cost": "0.25", // IO成本 + rows*(1-filtered)成本
          "eval_cost": "0.10", // rows × filter的成本
          "prefix_cost": "0.35", // 单独查询表的成本（read_cost+eval_cost）
          "data_read_per_join": "1K" // 此次查询中需要读取的数据量
        },
        "used_columns": [ // 使用到的列 
          "id",
          "common_field"
        ]
      }
    }
  }
}
```

#### 	Extended EXPLAIN

```mysql
SHOW WARNINGS;
```

> 在执行了EXPLAIN后执行该命令，会出现`Code`和`Message`，当`Code = 1003`时，`Message`展示的是优化器重写后的查询语句（不能直接作为查询语句）。

---

## 事务

### 事务的属性

![](https://image.leejay.top/FgHSE1SE423hCiFbkPdrEs5Ehuhp)

### 事务的基本命令

```mysql
BEGIN;
START TRANSACTION [READ ONLY|READ WRITE|WITH CONSISTENT SNAPSHOT];
ROLLBACK;
# 手动提交
COMMIT;
# 查看自动提交是否开启
SHOW VARIABLES LIKE 'AUTOCOMMIT';
# 开启自动提交
SET AUTOCOMMIT = 'ON';
# 保存点savepoint
SAVEPOINT [save name];
# 回滚到保存点
ROLLBACK TO SAVEPOINT [save name];
# 删除保存点
RELEASE SAVEPOINT [save name];
```

### redo log（保证持久性）

`InnoDB`存储引擎是以页为单位来管理存储空间的，每次都把磁盘的数据读到内存中`Buffer Pool`后才能使用，又因为事务需要具备`持久性`，如果我们只在内存的`Buffer Pool`中修改了页面，假设在事务提交后突然发生了某个故障，导致内存中的数据都失效了，那么这个已经提交了的事务对数据库中所做的更改也就跟着丢失了。所以引入了`redo log`，又称为`redo 日志`。

>  将第0号表空间的100号页面的偏移量为1000处的值更新为`2`

在事务提交时，把上述内容刷新到磁盘中，即使之后系统崩溃了，重启之后只要按照上述内容所记录的步骤重新更新一下数据页，那么该事务对数据库中所做的修改又可以被恢复出来，也就意味着满足`持久性`的要求。上述内容被称为`redo 日志`。`redo 日志`具有如下优点：

- `redo`日志占用的空间非常小
- `redo`日志是顺序写入磁盘的

![](https://image.leejay.top/FgBvSFXW44giQZrgiJpW9_87kuiT)

### undo log（保证原子性）

在事务的使用过程中因为服务异常或手动调用`ROLLBACK`命令时，需要将数据改回原状以保证原子性。而这边为了`回滚`而记录的信息叫做`undo 日志`。

### 事务的隔离级别

| 事务隔离级别                          | 脏读 | 不可重复度 | 幻读 |
| :------------------------------------ | :--- | :--------- | :--- |
| Read Uncommited（读未提交）           | ×    | ×          | ×    |
| Read Committed（读已提交 Oracle默认） | √    | ×          | ×    |
| Repeatable Read（可重复读 MySQL默认） | √    | √          | ×    |
| Serializable（序列化）                | √    | √          | √    |

```mysql
# 查看事务隔离级别
# mysql5.7.20前
SHOW VARIABLES LIKE '%tx_isolation%'
SELECT @@tx_isolation;
# mysql8
SELECT @@transaction_isolation;

# 设置事务隔离级别
SET [SESSION|GLOBAL] TRANSACTION ISOLATION LEVEL [READ UNCOMMITTED|READ COMMITTED|REPEATABLE READ|SERIALIZABLE]
```

---

## MVCC

MVCC（多版本并发控制）指的就是在使用READ COMMITTD、REPEATABLE READ这两种隔离级别的事务在执行普通的SELECT操作时访问记录的版本链的过程。使不同的事务读写、写读并发执行，提升系统性能。

> 事务利用`MVCC`进行的读取操作称之为`一致性读`。所有普通的`SELECT`语句（`plain SELECT`）在`READ COMMITTED`、`REPEATABLE READ`隔离级别下都算是`一致性读`。

### 版本链

Innodb的行格式中包含两个隐藏列，分别是`trx_id`和`roll_pointer`，如果没有主键或唯一索引也会创建隐藏列`row_id`。

- trx_id

每次一个事务对某条聚簇索引记录进行改动时，都会把该事务的`事务id`赋值给`trx_id`隐藏列。

> 只有在事务对表中的记录做改动时（增删改）才会为这个事务分配一个唯一的`事务id`。整个系统中分配的`事务id`值是一个递增的数字。先被分配`id`的事务得到的是较小的`事务id`，后被分配`id`的事务得到的是较大的`事务id`。

- roll_pointer

每次对某条聚簇索引记录进行改动时，都会把旧的版本写入到`undo日志`中，然后这个隐藏列就相当于一个`指针`，可以通过它来找到该记录修改前的信息。

> `undo日志`被存放到了类型为`FIL_PAGE_UNDO_LOG`的页面中。

![](https://image.leejay.top/FiQ_8fz_DRgQ7xNk766_RSjjxWko)

对记录每次更新后，都会将旧值放到一条`undo日志`中，就算是该记录的一个旧版本，随着更新次数的增多，所有的版本都会被`roll_pointer`属性连接成一个链表，我们把这个链表称之为`版本链`，版本链的头节点就是当前记录最新的值。另外，每个版本中还包含生成该版本时对应的`事务id`。

### ReadView

#### 概念

- `m_ids`：表示在生成`ReadView`时当前系统中活跃的读写事务的`事务id`列表。

- `min_trx_id`：表示在生成`ReadView`时当前系统中活跃的读写事务中最小的`事务id`，也是`m_ids`中的最小值。

- `max_trx_id`：表示生成`ReadView`时系统中应该分配给下一个事务的`id`值。

  > 注意max_trx_id并不是m_ids中的最大值，事务id是递增分配的。比方说现在有id为1，2，3这三个事务，之后id为3的事务提交了。那么一个新的读事务在生成ReadView时，m_ids就包括1和2，min_trx_id的值就是1，max_trx_id的值就是4。

- `creator_trx_id`：表示生成该`ReadView`的事务的`事务id`。

  > 只有在对表中的记录做改动时（执行INSERT、DELETE、UPDATE这些语句时）才会为事务分配事务id，否则在一个只读事务中的事务id值都默认为0。

#### 规则

| 规则                                           | 结果                                                         |
| :--------------------------------------------- | :----------------------------------------------------------- |
| **trx_id = creator_trx_id**                    | 着当前事务在访问它自己修改过的记录，所以该版本可以被当前事务访问。 |
| **trx_id < min_trx_id**                        | 当前事务在生成ReadView之前已提交(即不活跃)，所以可以访问     |
| **trx_id >= max_trx_id**                       | 当前事务在生成ReadView后才开启，所以不能访问                 |
| **trx_id >= min_trx_id & trx_id < max_trx_id** | 如果当前事务id在m_ids中，说明该事务仍活跃，则不能被访问，不在m_ids中则可以访问 |

> 依次和版本链中（包含页面中的那条数据）的数据依次进行比对，找到符合的数据就返回并退出比对。

#### 生成时间

- READ COMMITTED（`每次SELECT前都生成一个ReadView`）

- REPEATABLE READ（`在第一次SELECT的时候生成一个ReadView`）

---

## 锁

### 表级

![](https://image.leejay.top/FiXjk26bZZfdbX2y-1NedMILfMlT)

```mysql
# 创建表级读写锁
LOCK TABLES T1 READ, T2 WRITE;
# 解锁
UNLOCK TABLES;
# 手动查看当前被锁的表并KILL
SHOW OPEN TABLES where In_use > 0
SHOW PROCESSLIST
KILL ${ID}
```

### 行级

![](https://image.leejay.top/Fh1Nn1_6SmYIXXxb0_J91WJ7e77D)

```mysql
# 共享锁
SELECT * FROM T1 LOCK IN SHARE MODE;
# 独占锁
SELECT * FROM T1 FOR UPDATE;
```


