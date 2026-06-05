# 基础信息

## Base URL

示例 Base URL：

```text
https://bluebirdapi.com/v1
```

接口路径示例：

```text
POST https://bluebirdapi.com/v1/chat/completions
GET  https://bluebirdapi.com/v1/models
```

## 请求格式

大多数接口使用 JSON 请求体：

```http
Content-Type: application/json
Authorization: Bearer sk-xxxxxxxxxxxxxxxx
```

## 响应格式

普通响应通常是 JSON：

```json
{
  "id": "chatcmpl_example",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好，有什么可以帮你？"
      },
      "finish_reason": "stop"
    }
  ]
}
```

错误响应通常包含 `error` 或 `message` 字段，具体以实际接口返回为准。

## 超时时间建议

- 普通非流式请求：建议客户端超时设置为 60 到 120 秒。
- 长文本生成或复杂任务：建议使用流式响应。
- 服务端代理调用时，请确保你的反向代理也允许足够长的超时时间。

## 流式响应

当请求参数中设置：

```json
{ "stream": true }
```

接口会以 Server-Sent Events 的形式返回增量内容。详见 [流式响应](/docs/streaming)。

## OpenAI-Compatible 兼容说明

青鸟 API 提供 OpenAI-Compatible 调用方式。你可以使用 OpenAI SDK 或兼容 OpenAI 接口的 HTTP 客户端，并将 `baseURL` / `base_url` 指向青鸟 API 的 `/v1` 地址。

不同模型支持的参数可能有所差异。建议在生产环境中只传入业务确实需要的参数。
