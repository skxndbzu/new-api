# 错误码

接口调用失败时，请先查看 HTTP 状态码和响应体中的错误信息。

## 示例响应

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "invalid_request_error",
    "code": "invalid_api_key"
  }
}
```

部分接口可能返回：

```json
{
  "success": false,
  "message": "请求失败"
}
```

## 常见错误

| 状态码 | 含义 | 常见原因 | 解决方式 |
| --- | --- | --- | --- |
| 400 Bad Request | 请求格式错误 | JSON 错误、参数类型错误、缺少必填字段 | 检查请求体和 `Content-Type` |
| 401 Unauthorized | 未认证 | API Key 缺失、错误或已删除 | 检查 `Authorization` 请求头 |
| 403 Forbidden | 无权限 | 账号受限、模型无权限、Key 不允许调用 | 检查账号状态和可用模型 |
| 404 Not Found | 路径不存在 | URL 写错、接口路径不支持 | 检查 Base URL 和接口路径 |
| 429 Too Many Requests | 请求过多 | 触发频率、并发或额度限制 | 降低请求频率并退避重试 |
| 500 Internal Server Error | 服务内部错误 | 平台内部异常 | 稍后重试并联系支持 |
| 502 Bad Gateway | 上游异常 | 模型服务异常或响应格式异常 | 稍后重试或切换模型 |
| 503 Service Unavailable | 服务不可用 | 临时维护、上游不可用或资源不足 | 稍后重试 |
| 504 Gateway Timeout | 超时 | 模型响应过慢、代理超时 | 使用流式响应或提高超时 |

## 处理建议

- 对 400、401、403、404：优先修正请求或账号配置，不要盲目重试。
- 对 429：使用指数退避重试，并降低并发。
- 对 500、502、503、504：可以有限次数重试，并记录请求 ID、模型、时间和错误信息。
- 不要在日志中记录完整 API Key 或用户敏感输入。
