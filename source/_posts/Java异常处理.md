---
title: Java异常处理
date: 2018-09-17 19:40:39
tags: Java
toc: true
categories:
- Java
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccm5pmvsj30j60a4glz.jpg

---
## 异常
### 异常结构图
![20180414224710614.png](http://img.blog.csdn.net/20160331115514210)
<!-- more -->
### 自定义异常
* 自定义总异常
``` Java
@Data
public class CommonException extends RuntimeException {

    private int status;

    private String msg;

    public CommonException(int status, String msg) {
        super(msg);
        this.status = status;
    }
}
```
* 自定义异常 继承 CommonException
``` Java
public class DemoException extends CommonException {
    public DemoException(int status, String msg) {
        super(status, msg);
    }
}
```
* 自定义响应体
``` Java
@Data
public class ResponseMessage<T> implements Serializable {
    private static final long serialVersionUID = 8992436576262574064L;

    protected String message;

    protected T result;

    protected int status;

    private Long timestamp;

    public static <T> ResponseMessage<T> error(String message) {
        return error(500, message);
    }

    public static <T> ResponseMessage<T> error(int status, String message) {
        ResponseMessage<T> msg = new ResponseMessage<>();
        msg.message = message;
        msg.status(status);
        return msg.putTimeStamp();
    }

    public static <T> ResponseMessage<T> ok() {
        return ok(null);
    }

    private ResponseMessage<T> putTimeStamp() {
        this.timestamp = System.currentTimeMillis();
        return this;
    }

    public static <T> ResponseMessage<T> ok(T result) {
        return new ResponseMessage<T>()
                .result(result)
                .putTimeStamp()
                .status(200);
    }

    public ResponseMessage<T> result(T result) {
        this.result = result;
        return this;
    }

    public ResponseMessage() {

    }

    @Override
    public String toString() {
        return JSON.toJSONStringWithDateFormat(this, "yyyy-MM-dd HH:mm:ss");
    }

    public ResponseMessage<T> status(int status) {
        this.status = status;
        return this;
    }
}
```
* 全部异常handler(返回格式为json,使用ControllerAdvice + ResponseBody效果相同)
``` Java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseMessage handlerError(Exception e) {
        return ResponseMessage.error(e.getMessage());
    }
}
```