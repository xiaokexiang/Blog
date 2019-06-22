---
title: Hibernate-Validate校验注解
date: 2018-11-29 14:45:18
tags: Java
toc: true
categories:
- Java
thumbnail: http://ww1.sinaimg.cn/mw690/70ef936dly1g49zwmgutoj20q90dvdjd.jpg
---
## 自定义注解

* 注解
``` Java
@Target({ElementType.FIELD, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ValidStringLength.class)
@Documented
public @interface ValidString {

    String message() default "This String is inValid";

    int max();

    int min() default 0;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
```
* 校验(字符串长度校验，中文为3，英文为1)
``` Java
public class ValidStringLength implements ConstraintValidator<ValidString, String> {

	private int max;

	@Override
	public void initialize(ValidString validStringAnnotation) {

		max = validStringAnnotation.max();
	}

	@Override
	public boolean isValid(String value, ConstraintValidatorContext context) {

		return !StringUtils.isBlank(value) &&getLength(value) <= max;
	}

	/**
	 * 中文加3 英文加1
	 *
	 * @param value
	 * @return
	 */
	private int getLength(String value) {

		int length = 0;
		for (int i = 0; i < value.length(); i++) {
			byte[] bytes = value.substring(i, i + 1).getBytes(StandardCharsets.UTF_8);
			if (bytes.length > 1) {
				length += 3;
			} else {
				length += 1;
			}
		}
		return length;
	}
}
```
* 开发异常记录
``` Java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class AssetVO {

    @NotNull(message = "PARAM_PARENTID")
    private Long parentId;
    @ValidString(max = 60, message = "PARAM_NAME_60")
    private String name;
    @ValidString(max = 40, message = "PARAM_CODE_40")
    private String code;
    @NotNull(message = "PARAM_CLASSIFICATIONID")
    private Long classificationId;
    @NotNull(message = "PARAM_TYPEID")
    private Long typeId;
    private Long subtypeId;

    private List<AssetAttributesVO> assetAttrList;

    @Valid
    public List<AssetAttributesVO> getAssetAttrList() {
        return assetAttrList;
    }

    public void setAssetAttrList(List<AssetAttributesVO> assetAttrList) {
        this.assetAttrList = assetAttrList;
    }
}
```
之前在开发中，线下校验没有出现问题，线上就会出现如下错误提示：
```
org.springframework.beans.NotReadablePropertyException: Invalid property 'o[1]' of bean class [com.siemens.ofmasset.vo.h]: Bean property 'o[1]' is not readable or has an invalid getter method: Does the return type of the getter match the parameter type of 
```
<font color="red">最终发现是我在定义assetVO中定义了List<T>，这个list的字段也是需要校验的，需要将@valid放在list的get方法上，多层嵌套需要将注解放在get方法上！！！！</font>