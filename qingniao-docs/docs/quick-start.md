# 快速开始

本页带你完成从账号到第一次 API 调用的最短路径。

## 1. 注册账号

打开青鸟 API 网站，注册并登录你的账号。登录后进入个人控制台。

## 2. 获取 API Key

在控制台中进入令牌或 API Key 管理页面，创建一个新的 API Key。请妥善保存该 Key，页面可能只在创建时完整展示一次。

示例 Key：

```text
sk-xxxxxxxxxxxxxxxx
```

## 3. 配置 Base URL

示例 Base URL：

```text
https://bluebirdapi.com/v1
```

如果你使用 OpenAI SDK，通常需要把 SDK 的 `baseURL` 或 `base_url` 设置为上面的地址。

## 4. 发送第一个请求

### curl

```bash
curl https://bluebirdapi.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "system", "content": "你是一个简洁可靠的助手。" },
      { "role": "user", "content": "你好，青鸟 API。" }
    ]
  }'
```

### Node.js

```js
const response = await fetch('https://bluebirdapi.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer sk-xxxxxxxxxxxxxxxx',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: '你好，青鸟 API。' }],
  }),
})

const data = await response.json()
console.log(data.choices?.[0]?.message?.content)
```

### Python

```python
import requests

response = requests.post(
    "https://bluebirdapi.com/v1/chat/completions",
    headers={
        "Authorization": "Bearer sk-xxxxxxxxxxxxxxxx",
        "Content-Type": "application/json",
    },
    json={
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "你好，青鸟 API。"}],
    },
    timeout=60,
)

print(response.json()["choices"][0]["message"]["content"])
```

### Java

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class QingniaoQuickStart {
  public static void main(String[] args) throws Exception {
    String body = """
      {
        "model": "gpt-4o-mini",
        "messages": [
          { "role": "user", "content": "你好，青鸟 API。" }
        ]
      }
      """;

    HttpRequest request = HttpRequest.newBuilder()
      .uri(URI.create("https://bluebirdapi.com/v1/chat/completions"))
      .header("Authorization", "Bearer sk-xxxxxxxxxxxxxxxx")
      .header("Content-Type", "application/json")
      .POST(HttpRequest.BodyPublishers.ofString(body))
      .build();

    HttpClient client = HttpClient.newHttpClient();
    HttpResponse<String> response =
      client.send(request, HttpResponse.BodyHandlers.ofString());

    System.out.println(response.body());
  }
}
```

## 下一步

- 阅读 [认证鉴权](/docs/authentication)，了解 API Key 的安全建议。
- 阅读 [Chat Completions](/docs/chat-completions)，了解完整请求参数。
- 阅读 [错误码](/docs/errors)，提前准备错误处理逻辑。
