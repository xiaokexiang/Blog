---
title: ElasticSearch工作使用小结
date: 2018-05-19 11:01:20
tags: ElasticSearch
categories:
- ElasticSearch
---

## Es的三种客户端

```text
 a.Transport Client,基于transport的连接,使用es的9300端口
 b.JestClient,基于http的连接,使用es的9200端口
 c.RestClient,基于http的连接,es官方推荐,使用9200端口
```

## scroll查询

* 第一次查询:加入_doc进行排序

``` java
/index/type/_search?scroll=5m&size=10000 "{\"sort\":[{\"_doc\":{\"order\":\"asc\"}}],\"query\":{\"match_all\":{}}}" ```
    📌: 5m是指游标存在的时长,es默认size不超过10000

* 带条件和排序查询

``` java
{"sort": [{"_doc": {"order": "asc"}}],"query": {"bool": {"must": [{"term": {"SuccessSign": 0}}]}}}
```

* 第二次查询:以后每次查询需要带入上一次查询的scroll_id

``` java
_search/scroll?scroll=5m "{\"scroll_id\": " + "\"" + scroll_id + "\"" + "}"

```
📌: 不需要指定index,type

## 基于时间聚合的代码:

``` java
@Service
@Slf4j
public class ResourceServiceImpl implements ResourceService {

    @Resource(name = "viidJestClient")
    private JestClient jestClient;
    private static final String ENTRYTIME = "EntryTime";
    private static final String VIID = "viid";
    private static final String VIDEOSLICE = "VideoSlice";
    private static final String IMAGE = "Image";

    @Override
    public ResourcesVO summary(QueryParam queryParam) {
        List<Object> rangeTime = queryParam.getTerms().stream().filter(term -> term.getColumn().equals(ENTRYTIME))
                .map(Term::getValue).collect(Collectors.toList());

        if (2 != rangeTime.size() || CollectionUtils.isEmpty(rangeTime)) {
            throw new ParamNoExistException(ErrorConstant.PARAM_NO_EXIST, I18nConstant.DTAE_PARAM_NOT_EXIST);
        }

        Object beginTime = rangeTime.get(0);
        Object endTime = rangeTime.get(1);
        SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
        BoolQueryBuilder queryBuilder = QueryBuilders.boolQuery().must(QueryBuilders.rangeQuery(ENTRYTIME).gte(beginTime).lte(endTime));

        DateHistogramAggregationBuilder field = AggregationBuilders.dateHistogram("agg").field(ENTRYTIME);
        field.dateHistogramInterval(DateHistogramInterval.DAY);
        field.format("yyyy-MM-dd");
        // 强制返回空buckets
        field.minDocCount(0);
        field.extendedBounds(new ExtendedBounds(parseDate(beginTime), parseDate(endTime)));
        searchSourceBuilder.query(queryBuilder);
        searchSourceBuilder.aggregation(field);
        searchSourceBuilder.size(0);

        Search videoSearch = new Search.Builder(searchSourceBuilder.toString()).addIndex(VIID).addType(VIDEOSLICE).build();
        Search imageSearch = new Search.Builder(searchSourceBuilder.toString()).addIndex(VIID).addType(IMAGE).build();
        SearchResult videoResult;
        SearchResult imageResult;
        try {
            videoResult = jestClient.execute(videoSearch);
            imageResult = jestClient.execute(imageSearch);
        } catch (IOException e) {
            throw new JestExcuteException(ErrorConstant.JEST_EXCUTE_ERROR, I18nConstant.JEST_IO_EXCEPTION);
        }

        List<ResourceVO> resourceVOS = Lists.newArrayList();
        assert videoResult != null;
        List<DateHistogramAggregation.DateHistogram> videoBuckets = videoResult.getAggregations().getDateHistogramAggregation("agg").getBuckets();

        for (DateHistogramAggregation.DateHistogram videoBucket : videoBuckets) {
            ResourceVO resourceVO = new ResourceVO();
            resourceVO.setTime(videoBucket.getTimeAsString());
            resourceVO.setVideoCount(videoBucket.getCount());
            resourceVOS.add(resourceVO);
        }

        assert imageResult != null;
        List<DateHistogramAggregation.DateHistogram> imageBuckets = imageResult.getAggregations().getDateHistogramAggregation("agg").getBuckets();
        for (DateHistogramAggregation.DateHistogram imageBucket : imageBuckets) {
            ResourceVO imageResourceVO ;
            Optional<ResourceVO> optional = resourceVOS.stream().filter(resourceVO -> resourceVO.getTime().equals(imageBucket.getTimeAsString())).findFirst();
            if (optional.isPresent()) {
                imageResourceVO = optional.get();
                imageResourceVO.setImageCount(imageBucket.getCount());
                resourceVOS.add(imageResourceVO);
            }
        }

        List<Long> collect = resourceVOS.stream().map(resourceVO -> resourceVO.getImageCount() + resourceVO.getVideoCount()).collect(Collectors.toList());
        ResourcesVO resourcesVO = new ResourcesVO();
        resourcesVO.setResourceVOS(resourceVOS.stream().sorted(Comparator.comparing(ResourceVO::getTime)).distinct().collect(Collectors.toList()));
        OptionalDouble average = collect.stream().mapToLong(Long::longValue).average();
        if (average.isPresent()) {
            resourcesVO.setAvgCount(NumberUtil.round(average.getAsDouble(), 2).doubleValue());
        }
        
        return resourcesVO;
    }

    /**
     * 转换时间格式
     *
     * @param object
     * @return
     */
    private String parseDate(Object object) {
        return DateUtil.format(DateUtil.beginOfDay(DateUtil.parse((String) (object))).toJdkDate(), DatePattern.NORM_DATE_FORMAT);
    }
}
```
## 文档来源:

 📍 <a href="https://blog.csdn.net/lvyuan1234/article/details/78655493">基于jestClient的es聚合</a>: 此文解决了jest基本的聚合操作
 📍 <a href="https://blog.csdn.net/xuyingzhong/article/details/78839744">基于时间的es聚合</a>: 此文解决了不返回空bucket的问题
 📍 <a href="https://www.elastic.co/guide/en/elasticsearch/reference/5.4">es官方文档</a> 
 📍 <a href="https://www.jianshu.com/p/32f4d276d433">基于scroll的深度分页</a>: 需要注意的是每次传入scroll时长