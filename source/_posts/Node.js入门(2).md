---
title: Node.js入门(2)
date: 2019-06-25 09:28:33
top: true
tags: Node.js
toc: true
categories:
  - Node.js
  - mocha
  - devtools
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4cecbzxmxj30go069jrp.jpg
---
### 基于Mocha实现Node.js代码的单元测试

#### npm安装

``` bash
# 初始化npm,会生成package.json文件
$ npm init -y
#安装Mocha包 --save-dev: 开发依赖 --save-exact 记录精确的版本号
$ npm install --save-dev --save-exact mocha@3.4.2
```
*Node.js中包含几种不同类型的依赖,常规依赖是代码运行时会使用到,常用require引入,开发依赖是指开发时需要的模块,指定--save-dev或-D参数即可,需要注意的是执行npm install命令时都会将各类型的依赖安装到项目中*

*package-lock.json代表本次安装的所有模块的版本号*

#### 关于模块的语义版本号

*版本号由: 主版本号,次版本号,修订版本号组成*
* 如果本次没有新增或者删除任何功能,只是修改bug,应该增加修订版本号
* 如果本次新增了功能,但没有删除或者修改已有功能,应该增加次版本号,并重置修订版本号
* 如果本次修改会对现有功能产生影响,应该增加主版本号,并重置次版本号和修订版本号

*如果npm install时去掉--save-exact参数,则会在package.json中添加带^的版本号,表明npm会安装与你指定版本相同或者更新的次版本*

<!--more-->
#### 使用Mocha开发单元测试
``` js
// Mocha测试用例
'use strict'
const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const LDJClient = require('../../socket-io/lib/ldj-client.js');

// describe创建上下文环境,第二个参数是函数,包含测试具体内容
describe('LDJClient', () => {
    let stream = null;
    let client = null;

    // 新实例赋值
    beforeEach(() => {
        stream = new EventEmitter();
        client = new LDJClient(stream);
    });

    // it()函数进行实际测试
    it('should emit a message event from a single data event', done => {
        client.on('message', message => {
            assert.deepEqual(message, { foo: 'bar' });
            done();
        });
        stream.emit('data', '{"foo":"bar"}\n');
    });
});
```

### 数据转换

_读取 rdf 文件,将其转成 JSON 保存到数据库中_

#### 提取属性

```js
const cheerio = require("cheerio");

// 解析rdf文件
module.exports = rdf => {
  const $ = cheerio.load(rdf);
  const book = {};
  // 转换bookId此处的+号是为了保证结果为数字
  book.id = +$("pgterms\\:ebook")
    .attr("rdf:about")
    .replace("ebooks/", "");
  book.title = $("dcterms\\:title").text();
  // 获取作者,作者是数组 element返回的是文档节点,需要使用$包装获取,实现作者Array
  book.authers = $("pgterms\\:agent pgterms\\:name")
    .toArray()
    .map(element => $(element).text());
  // 获取主题列表
  book.subjects = $('[rdf\\:resource$="/LCSH"]')
    .parent()
    .find("rdf\\:value")
    .toArray()
    .map(element => $(element).text());
  return book;
};
```

#### 批量转换 rdf 文件

```bash
$ npm install --save --save-exact node-dir@0.1.16
```

```js
"use strict";
// 批量 rdf to json

const dir = require("node-dir");
const parseRDF = require("./lib/parse-rdf.js");
const dirname = process.argv[2];

const options = {
  match: /\.rdf$/,
  exclude: ["pg0.rdf"]
};

// 使用node-dir遍历目录树
dir.readFiles(dirname, options, (err, content, next) => {
  if (err) {
    throw err;
  }
  const doc = parseRDF(content);
  // es id
  console.log(JSON.stringify({ index: { _id: `pg${doc.id}` } }));
  console.log(JSON.stringify(doc));
  next();
});
```

### chrome devtools 工具

#### debug 调试程序

```bash
$ node --inspect rdf-to-json-bulk.js(debug的js) ../../cache/epub(此js对应的参数)
```

#### DevTools 设备页面

地址栏输入`chrome://inspect`进入 DevTools 设备页面

<img src="./DevTools.png"/>
