---
title: 基于Java图片上传下载
date: 2019-05-02 14:19:01
tags: Java
toc: true
categories:
- Java
thumbnail: https://tvax1.sinaimg.cn/large/005BYqpggy1g4ccm5pmvsj30j60a4glz.jpg

---
### 图片上传-存储在项目下
* 获取项目resource下的static文件夹内文件

``` java
File srcFile = ResourceUtils.getFile("classpath:static");
```

* 基于InputStream&OutputStream的文件下载

``` java
// 获取源文件
File srcFile = ResourceUtils.getFile("classpath:static");
// 指定目标文件地址
String property = System.getProperty("user.dir") + File.separator + "fastdfs_images";
File descFile = new File(property);
// 创建文件夹
if (!descFile.exists()) {
    // 递归生成文件夹
    descFile.mkdirs();
}
// 如果是源文件夹内是多个文件
for (String fileName : Objects.requireNonNull(srcFile.list())) {
    File fromFile = new File(srcFile.getAbsoluteFile(), fileName);
    File toFile = new File(property, fileName);
    inputStream = new FileInputStream(fromFile);
    outputStream = new FileOutputStream(toFile);
    IOUtils.copy(inputStream, outputStream);
    inputStream.close();
    outputStream.close();
}

```
<!-- more -->
### 图片上传-FTP方式

``` java
@Slf4j
@Service
public class OperateServiceImpl implements OperateService {

    @Autowired
    private DfsConfig dfsConfig;
    private static final List<String> IMAGES_LIST = Lists.newArrayList("bmp", "jpg", "png", "tif", "gif");

    /**
     * 上传文件
     *
     * @param multipartFile
     * @return
     */
    @Override
    public String uploadFile(MultipartFile multipartFile, Boolean cropSwitch, Integer width, Integer height) {
        // 获取文件名
        String fileName = multipartFile.getOriginalFilename();
        // 获取文件名后缀
        String ext = fileName.substring(fileName.lastIndexOf(".") + 1);
        FTPClient ftpClient = new FTPClient();
        byte[] bytes;
        try {

            // 如果不是图片那么不允许裁剪
            if (IMAGES_LIST.contains(ext.toLowerCase())) {
                if (cropSwitch) {
                    bytes = CropPictureUtil.cropPicture(multipartFile, width, height);
                    if (null == bytes) {
                        throw new FileUploadException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                ErrorMsg.UPLOAD_BYTES_CAN_NOT_BE_NULL);
                    }
                } else {
                    bytes = transferToBytes(multipartFile);
                }
            } else {
                bytes = transferToBytes(multipartFile);
            }

            // 建立ftp连接
            ftpClient.connect(dfsConfig.getStorageIp());
            ftpClient.login(dfsConfig.getUsername(), dfsConfig.getPassword());
            // 判断连接是否成功
            if (!FTPReply.isPositiveCompletion(ftpClient.getReplyCode())) {
                throw new FileUploadException(HttpStatus.INTERNAL_SERVER_ERROR.value(), ftpClient.getReplyString());
            }
            // 设置ftp被动模式
            ftpClient.enterLocalPassiveMode();
            ftpClient.setBufferSize(1024);
            ftpClient.setControlEncoding("GBK");

            // 设置文件类型（二进制）
            ftpClient.setFileType(FTPClient.BINARY_FILE_TYPE);
            InputStream inputStream = new ByteArrayInputStream(bytes);
            String newFileName = UUID.randomUUID().toString().replace("-", "") + "." + ext;

            // 上传文件
            if (!ftpClient.storeFile(newFileName, inputStream)) {
                log.warn("文件: {}, 上传失败! 原因: {}", newFileName, ftpClient.getReplyString());
                throw new FileUploadException(HttpStatus.INTERNAL_SERVER_ERROR.value(), ftpClient.getReplyString());
            }
            log.info("文件: {}, 上传成功!", newFileName);
            ftpClient.logout();
            inputStream.close();
            return newFileName;
        } catch (IOException e) {
            throw new FileUploadException(HttpStatus.INTERNAL_SERVER_ERROR.value(), e.getMessage());
        } finally {
            if (ftpClient.isConnected()) {
                try {
                    ftpClient.disconnect();
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }
    }

    /**
     * inputStream 转 byte
     *
     * @param multipartFile
     * @return
     */
    private byte[] transferToBytes(MultipartFile multipartFile) {
        try {
            InputStream inputStream = multipartFile.getInputStream();
            if (multipartFile.getInputStream() == null) {
                throw new FileUploadException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        ErrorMsg.UPLOAD_BYTES_CAN_NOT_BE_NULL);
            }
            byte[] bytes = new byte[multipartFile.getInputStream().available()];
            inputStream.read(bytes);
            inputStream.close();
            return bytes;
        } catch (IOException e) {
            throw new FileUploadException(HttpStatus.INTERNAL_SERVER_ERROR.value(), e.getMessage());
        }
    }
}

```

### 图片裁剪工具类

``` java
public class CropPictureUtil {

    private static final String FORMAT_NAME = "png";
    public static byte[] cropPicture(MultipartFile multipartFile, int width, int height) {
        BufferedImage buffer;
        try {
            buffer = ImageIO.read(multipartFile.getInputStream());
            //核心算法，计算图片的压缩比
            int w = buffer.getWidth();
            int h = buffer.getHeight();
            double ratiox = 0.5d;
            double ratioy = 0.5d;

            ratiox = w * ratiox / width;
            ratioy = h * ratioy / height;

            if (ratiox >= 1) {
                if (ratioy < 1) {
                    ratiox = height * 1.0 / h;
                } else {
                    if (ratiox > ratioy) {
                        ratiox = height * 1.0 / h;
                    } else {
                        ratiox = width * 1.0 / w;
                    }
                }
            } else {
                if (ratioy < 1) {
                    if (ratiox > ratioy) {
                        ratiox = height * 1.0 / h;
                    } else {
                        ratiox = width * 1.0 / w;
                    }
                } else {
                    ratiox = width * 1.0 / w;
                }
            }

            //对于图片的放大或缩小倍数计算完成，ratiox大于1，则表示放大，否则表示缩小
            AffineTransformOp op = new AffineTransformOp(AffineTransform
                    .getScaleInstance(ratiox, ratiox), null);

            buffer = op.filter(buffer, null);
            //从放大的图像中心截图
            buffer = buffer.getSubimage((buffer.getWidth() - width) / 2, (buffer.getHeight() - height) / 2, width, height);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(buffer, FORMAT_NAME, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new CropPictureException(HttpStatus.INTERNAL_SERVER_ERROR.value(), e.getMessage());
        }
    }
}

```