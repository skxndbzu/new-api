# Chat Completions

Chat Completions 是最常用的文本生成接口，适合聊天、问答、摘要、分类、结构化生成和代码辅助等场景。

## 接口

```http
POST /v1/chat/completions
```

## 非流式请求

```bash
curl https://bluebirdapi.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "system", "content": "你是一个简洁可靠的助手。" },
      { "role": "user", "content": "写一句产品介绍。" }
    ],
    "temperature": 0.7,
    "max_tokens": 300
  }'
```

## 流式请求

```bash
curl https://bluebirdapi.com/v1/chat/completions \
  -N \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "user", "content": "用三点说明 API 网关的价值。" }
    ],
    "stream": true
  }'
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | 要调用的模型名称 |
| `messages` | array | 是 | 对话消息列表 |
| `temperature` | number | 否 | 随机性，值越高输出越发散 |
| `max_tokens` | number | 否 | 允许生成的最大 token 数 |
| `stream` | boolean | 否 | 是否启用流式响应 |
| `top_p` | number | 否 | nucleus sampling 参数 |
| `frequency_penalty` | number | 否 | 降低重复词频的倾向 |
| `presence_penalty` | number | 否 | 鼓励引入新主题的倾向 |

## messages 结构

```json
[
  { "role": "system", "content": "你是一个专业助手。" },
  { "role": "user", "content": "用户问题" },
  { "role": "assistant", "content": "历史回答" }
]
```

| role | 说明 |
| --- | --- |
| `system` | 系统提示词，用于约束助手行为 |
| `user` | 用户输入 |
| `assistant` | 助手历史回复 |

## Node.js 示例

```js
const res = await fetch('https://bluebirdapi.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sk-xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: '解释什么是流式响应。' }],
  }),
})

const json = await res.json()
console.log(json.choices?.[0]?.message?.content)
```

## Python 示例

```python
import requests

payload = {
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "解释什么是流式响应。"}],
}

res = requests.post(
    "https://bluebirdapi.com/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-xxxxxxxxxxxxxxxx",
        "Content-Type": "application/json",
    },
    json=payload,
    timeout=60,
)

print(res.json()["choices"][0]["message"]["content"])
```

## Java 示例

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ChatCompletionsExample {
  public static void main(String[] args) throws Exception {
    String body = """
      {
        "model": "gpt-4o-mini",
        "messages": [
          { "role": "user", "content": "解释什么是流式响应。" }
        ]
      }
      """;

    HttpRequest request = HttpRequest.newBuilder()
      .uri(URI.create("https://bluebirdapi.com/v1/chat/completions"))
      .header("Authorization", "Bearer sk-xxxxxxxxxxxxxxxx")
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(body))
      .build();

    HttpResponse<String> response = HttpClient.newHttpClient()
      .send(request, HttpResponse.BodyHandlers.ofString());

    System.out.println(response.body());
  }
}
```

## 返回结构示例

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
        "content": "流式响应是服务器边生成边返回内容的方式。"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 18,
    "total_tokens": 38
  }
}
```

## 常见错误说明

- `401 Unauthorized`：API Key 缺失、错误或已失效。
- `403 Forbidden`：账号或 Key 没有权限调用该模型。
- `429 Too Many Requests`：请求过快或超过并发限制。
- `502 Bad Gateway`：上游模型服务异常或暂时不可用。

详见 [错误码](/docs/errors)。
