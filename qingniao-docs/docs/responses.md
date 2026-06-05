# Responses API

青鸟 API 后端路由已支持 OpenAI-Compatible 的 Responses API。

## 接口

```http
POST /v1/responses
```

## 请求示例

```bash
curl https://bluebirdapi.com/v1/responses \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "用一句话介绍青鸟 API。"
  }'
```

## 流式请求

```bash
curl https://bluebirdapi.com/v1/responses \
  -N \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "input": "写一个三点说明。",
    "stream": true
  }'
```

## 常用参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 模型名称 |
| `input` | string 或 array | 是 | 输入内容 |
| `stream` | boolean | 否 | 是否启用流式响应 |
| `temperature` | number | 否 | 控制输出随机性 |
| `max_output_tokens` | number | 否 | 最大输出 token 数 |

## 返回说明

Responses API 的返回结构会根据模型能力和请求参数变化。常见字段包括：

| 字段 | 说明 |
| --- | --- |
| `id` | 响应 ID |
| `object` | 对象类型 |
| `model` | 实际使用的模型 |
| `output` | 模型输出内容 |
| `usage` | 用量统计 |

::: warning
不同模型对 Responses API 的支持程度可能不同。如果某个模型调用失败，请先切换到 [Chat Completions](/docs/chat-completions) 或联系支持确认模型能力。
:::
