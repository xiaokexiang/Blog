---
title: kafka权威指南-Avro的使用总结
date: 2018-06-02 22:20:19
tags: Kafka
toc: true
categories:
- Kafka
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccmvpfgqj30gs08ggm2.jpg

---
## pom.xml中引入Avro相关配置

``` java
    <dependencies>
        <dependency>
            <groupId>org.apache.avro</groupId>
            <artifactId>avro</artifactId>
            <version>1.8.1</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            <plugin>
                <groupId>org.apache.avro</groupId>
                <artifactId>avro-maven-plugin</artifactId>
                <version>1.8.1</version>
                <executions>
                    <execution>
                        <phase>generate-sources</phase>
                        <goals>
                            <goal>schema</goal>
                        </goals>
                        <configuration>
                          <outputDirectory>${project.basedir}/src/main/java/</outputDirectory>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <source>1.8</source>
                    <target>1.8</target>
                </configuration>
            </plugin>
        </plugins>
    </build>
```

<!-- more -->

##  自定义xxxx.avsc后缀结尾的文件

文件格式如下:其中namespace表示解析后的avro文件的包地址,name为解析后的文件名

```json
{
  "namespace": "top.leejay.kafka.kafkaSerializer.avro",
  "type": "record",
  "name": "Weather",
  "doc": "A weather reading.",
  "fields": [
    {
      "name": "station",
      "type": "string",
      "order": "ignore"
    },
    {
      "name": "time",
      "type": "long"
    },
    {
      "name": "temp",
      "type": "int"
    }
  ]
}
```
#### 3.运行mvn complier编译即可
参考blog:https://blog.csdn.net/xmeng1/article/details/81049555
Avro文档地址:http://avro.apache.org/docs/1.8.1/gettingstartedjava.html