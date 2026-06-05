# 流式响应

流式响应适合长文本生成、聊天和需要实时展示内容的场景。

## 启用方式

在请求体中设置：

```json
{
  "stream": true
}
```

## SSE 基础说明

流式响应通常使用 Server-Sent Events。服务端会分多次返回数据片段，客户端需要边读取边解析。

常见格式：

```text
data: {"choices":[{"delta":{"content":"你好"}}]}

data: {"choices":[{"delta":{"content":"，世界"}}]}

data: [DONE]
```

## curl 示例

```bash
curl https://bluebirdapi.com/v1/chat/completions \
  -N \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "user", "content": "写一段短文。" }
    ],
    "stream": true
  }'
```

## Node.js 读取流示例

```js
const res = await fetch('https://bluebirdapi.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sk-xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: '写一段短文。' }],
    stream: true,
  }),
})

const reader = res.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { value, done } = await reader.read()
  if (done) break
  process.stdout.write(decoder.decode(value, { stream: true }))
}
```

## Python 读取流示例

```python
import requests

with requests.post(
    "https://bluebirdapi.com/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-xxxxxxxxxxxxxxxx",
        "Content-Type": "application/json",
    },
    json={
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "写一段短文。"}],
        "stream": True,
    },
    stream=True,
    timeout=120,
) as response:
    for line in response.iter_lines(decode_unicode=True):
        if line:
            print(line)
```

## 常见问题

### 为什么流会中断

可能原因包括网络连接中断、客户端超时、反向代理超时、模型服务暂时异常或请求内容过长。

### 为什么响应变慢

可能原因包括模型负载较高、输出内容较长、上下文过大、网络延迟较高。

### 如何设置超时时间

客户端和服务端代理都应设置足够长的读取超时。长文本建议至少 120 秒，并根据业务场景调整。

### 如何做重试

对网络错误、429 和部分 5xx 可以做重试。重试时使用指数退避，并避免重复提交会产生副作用的业务操作。
