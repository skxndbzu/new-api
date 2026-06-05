# 图像接口

青鸟 API 后端路由已支持 OpenAI-Compatible 的图像生成和图像编辑接口。

## 图片生成

```http
POST /v1/images/generations
```

### 请求示例

```bash
curl https://bluebirdapi.com/v1/images/generations \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-1",
    "prompt": "一只蓝色飞鸟，简洁科技风图标",
    "size": "1024x1024"
  }'
```

### 返回示例

```json
{
  "created": 1710000000,
  "data": [
    {
      "url": "https://example.com/generated-image.png"
    }
  ]
}
```

## 图片编辑

```http
POST /v1/images/edits
```

图片编辑通常使用 `multipart/form-data` 上传图片文件和提示词。实际可用参数取决于模型能力。

```bash
curl https://bluebirdapi.com/v1/images/edits \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -F "model=gpt-image-1" \
  -F "image=@input.png" \
  -F "prompt=把背景改为浅蓝色"
```

## 文件大小限制

文件大小、图片尺寸和格式限制可能因模型而异。建议：

- 上传 PNG、JPEG 或 WebP 等常见格式。
- 控制图片体积，避免上传超大文件。
- 对失败请求做明确错误提示，不要无限重试。

## 注意事项

- 图像接口可能比文本接口耗时更长。
- 图片生成和编辑会消耗额度。
- 请勿上传包含敏感个人信息、违法内容或未经授权的素材。
- 不同模型返回 `url` 或 `b64_json` 的方式可能不同，请以实际响应为准。
