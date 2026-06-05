# Embeddings

Embeddings 接口用于将文本转换为向量，适合语义检索、相似度匹配、聚类和推荐等场景。

## 接口

```http
POST /v1/embeddings
```

## 请求示例

```bash
curl https://bluebirdapi.com/v1/embeddings \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "青鸟 API 是一个 AI API 聚合与分发平台。"
  }'
```

## 批量输入

```json
{
  "model": "text-embedding-3-small",
  "input": [
    "第一段文本",
    "第二段文本"
  ]
}
```

## 返回示例

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0123, -0.0456, 0.0789]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 12,
    "total_tokens": 12
  }
}
```

## 字段说明

| 字段 | 说明 |
| --- | --- |
| `model` | 向量模型名称 |
| `input` | 文本或文本数组 |
| `data[].embedding` | 向量数组 |
| `usage` | 本次调用用量统计 |

::: tip
向量维度由模型决定。切换模型后，请确认你的向量数据库索引维度是否需要同步调整。
:::
