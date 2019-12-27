---
title: Java-Rsa加密解密
toc: true
date: 2019-10-23 14:28:05
tags: Java
categories:
  - Java
thumbnail: http://image.leejay.top/image/20191227/nRplcX5b4tNK.png
---

### 前言

因为工作的原因要和第三方进行数据交互, 第三方要求我们对数据的传输进行 RSA 加密解密, 但是第三方给的加密解密工具类跑不起来, 前后结果不一致 🙂, 所以我抽空找了点资料, 结合网上已有的相关资料, 写了一个简单的 RSA 加密解密工具类, 经过多次测试, 是完全没有问题的。顺便提下, 因为加密后显示乱码, 我使用 Base64 进行转换, 便于传输, 话不多说上代码 💪

### RsaUtil

其实 RSA 工具类遵循的是`公钥加密&私钥解密`, 所以我们需要首先生成一对公钥&私钥, 这是加密解密的关键。
至于 Base64 工具类, 我使用的是`org.apache.commons.codec.binary.Base64`包下的 Base64Utils 用来 encode 和decode

<!--more-->
- Base64Utils

```java
 <dependency>
    <groupId>commons-codec</groupId>
    <artifactId>commons-codec</artifactId>
    <version>1.11</version>
    <scope>compile</scope>
 </dependency>

```

- RsaUtil

```java
@Slf4j
public class RsaUtil {
    private static final int SIZE = 1024;
    private static final String ALGORITHM = "RSA";
    // RSA SEED 理解成加密的种子就行
    private static final String SEED = "Area_Service";

    /**
     * 生成公钥 & 私钥
     */
    public static void createKey() {
        KeyPairGenerator keyPairGenerator;
        try {
            keyPairGenerator = KeyPairGenerator.getInstance(ALGORITHM);
            SecureRandom secureRandom = new SecureRandom(SEED.getBytes(Charset.forName("UTF-8")));
            keyPairGenerator.initialize(SIZE, secureRandom);
            KeyPair keyPair = keyPairGenerator.genKeyPair();
            String publicKey = Base64Utils.encodeToString(keyPair.getPublic().getEncoded());
            log.info("publicKey: {}", publicKey);
            String privateKey = Base64Utils.encodeToString(keyPair.getPrivate().getEncoded());
            log.info("privateKey: {}", privateKey);
        } catch (NoSuchAlgorithmException e) {
            throw new RsaException(e.getMessage());
        }
    }

    /**
     * 公钥加密
     *
     * @param unencryptedData 未加密的数据
     * @param publicKey       base64处理后公钥
     * @return base64处理后的加密数据
     */
    public static String encryptByPublicKey(String unencryptedData, String publicKey) {
        try {
            byte[] bytes = encryptByPublicKey(unencryptedData.getBytes(Charset.forName("UTF-8")), Base64Utils.decodeFromString(publicKey));
            return Base64Utils.encodeToString(bytes);
        } catch (Exception e) {
            throw new RsaException(e.getMessage());
        }
    }

    private static byte[] encryptByPublicKey(byte[] unencryptedData, byte[] publicKey) throws Exception {
        X509EncodedKeySpec x509KeySpec = new X509EncodedKeySpec(publicKey);
        KeyFactory keyFactory = KeyFactory.getInstance(ALGORITHM);
        PublicKey aPublic = keyFactory.generatePublic(x509KeySpec);
        // 对数据加密
        Cipher cipher = Cipher.getInstance(keyFactory.getAlgorithm());
        cipher.init(Cipher.ENCRYPT_MODE, aPublic);
        return cipher.doFinal(unencryptedData);
    }

    /**
     * 私钥解密
     *
     * @param encryptedData 已加密未解密的数据
     * @param privateKey    base64处理后私钥
     * @return 源数据
     */
    public static String decryptByPrivateKey(String encryptedData, String privateKey) {
        try {
            byte[] bytes = decryptByPrivateKey(Base64Utils.decodeFromString(encryptedData), Base64Utils.decodeFromString(privateKey));
            return new String(bytes, Charset.forName("UTF-8"));
        } catch (Exception e) {
            throw new RsaException(e.getMessage());
        }
    }

    public static byte[] decryptByPrivateKey(byte[] encryptedData, byte[] privateKey) throws Exception {
        PKCS8EncodedKeySpec pkcs8KeySpec = new PKCS8EncodedKeySpec(privateKey);
        KeyFactory keyFactory = KeyFactory.getInstance(ALGORITHM);
        PrivateKey aPrivate = keyFactory.generatePrivate(pkcs8KeySpec);
        // 对数据解密
        Cipher cipher = Cipher.getInstance(keyFactory.getAlgorithm());
        cipher.init(Cipher.DECRYPT_MODE, aPrivate);
        return cipher.doFinal(encryptedData);
    }
}

```

- unit test

```java
@Test
public void test6() {
    // PUBLIC_KEY & PRIVATE_KEY 由RsaUtil.createKey()生成;
    JSONObject jsonObject = new JSONObject();
    jsonObject.put("username", "zhangsan");
    String encryptedData = RsaUtil.encryptByPublicKey(jsonObject.toJSONString(), PUBLIC_KEY);
    System.out.println("encryptedData: " + encryptedData);
    System.out.println();
    String decryptedData = RsaUtil.decryptByPrivateKey(encryptedData, PRIVATE_KEY);
    System.out.println("decryptedData: " + decryptedData);
}

```

### 小问题

Q: 将生成公钥加密后的 base64 字符串, 用 GET 方法传输的时候会出现将`+号`转换成空格的情况
A: 一种是将 base64 生成的字符串中的`+号用%2B`代替, 一种是在代码中将空格替换回+号`(但是这种只适用于参数中没有空格的情况)`
