---
title: '@Valid和@Validated的区别'
date: 2019-04-12 16:01:49
tags: Java
toc: true
categories:
- Hibernate
thumbnail: http://ww1.sinaimg.cn/thumbnail/70ef936dly1g4a06egs13j20i008jwep.jpg
---
## @Valid

*  一般用于@RequestBody()注解,@Valid配合BindResult使用

``` java
@RestController
@RequestMapping("/test")
public class ValidateOrValidController {

    @PostMapping("/valid")
    public String validRequestBody(@RequestBody @Valid ValidBody validBody, BindingResult result) {
        if (result.hasErrors()) {
            return result.getAllErrors().get(0).getDefaultMessage();
        }
        return validBody.toString();
    }
}

@Data
public class ValidBody {
    private Integer id;
    @Length(max = 8)
    private String name;
    @Length(min = 11, max = 11)
    private String phoneNumber;
}

```

## @Validated
 *  一般用于@RequestParam注解,校验抛出的异常需要自己捕获封装

``` java
@RestController
@RequestMapping("/test")
@Validated(这里的注解非常重要!!!)
public class ValidateOrValidController {

    @GetMapping("/validated")
    public String validatedRequestParam(@RequestParam("value") @Size(min = 1, max = 8) String value) {
        return value;
    }
}

```