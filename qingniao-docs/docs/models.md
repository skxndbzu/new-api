# 模型列表

青鸟 API 支持 OpenAI-Compatible 的模型列表接口。

## 接口

```http
GET /v1/models
```

该接口需要 API Key。

## curl 示例

```bash
curl https://bluebirdapi.com/v1/models \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx"
```

## 返回示例

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o-mini",
      "object": "model",
      "created": 1710000000,
      "owned_by": "provider"
    }
  ]
}
```

## 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `object` | string | 列表对象类型，通常为 `list` |
| `data` | array | 模型数组 |
| `data[].id` | string | 模型名称，调用其他接口时传入 `model` |
| `data[].object` | string | 模型对象类型 |
| `data[].created` | number | 创建时间戳，可能因模型来源不同而变化 |
| `data[].owned_by` | string | 模型来源标识 |

::: tip
实际可用模型取决于你的账号权限、额度状态和平台开放范围。请以接口返回为准。
:::
