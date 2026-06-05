# 认证鉴权

青鸟 API 使用 Bearer Token 进行接口鉴权。每个请求都需要在请求头中携带 API Key。

## 请求头格式

```http
Authorization: Bearer YOUR_API_KEY
```

示例：

```bash
curl https://bluebirdapi.com/v1/models \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx"
```

## 安全建议

- 不要把 API Key 暴露在浏览器、移动端安装包、公开仓库或前端源码中。
- 推荐只在服务端调用青鸟 API，再由你的服务端把结果返回给客户端。
- 如果 API Key 泄露，应立即删除或重置该 Key。
- 建议不同项目、不同环境使用不同 Key，便于审计和停用。
- 生产环境建议为 Key 设置合理的额度或调用上限。
- 日志中不要记录完整 API Key，可以只保留前后几位用于排查。

## 常见鉴权失败

| 状态码 | 常见原因 | 处理方式 |
| --- | --- | --- |
| 401 | 未传 `Authorization`、Key 错误或 Key 已删除 | 检查请求头和 Key 状态 |
| 403 | Key 无权限、账号受限或模型不可用 | 检查账号状态和可用模型 |

## 服务端调用示意

```text
用户浏览器 -> 你的业务服务端 -> 青鸟 API
```

不要采用下面这种方式：

```text
用户浏览器 -> 青鸟 API
```

前端直连会让 API Key 暴露给用户，存在被滥用和异常消耗额度的风险。
