---
layout: home
hero:
  name: 青鸟 API 文档
  text: 面向开发者的 AI API 聚合与分发平台
  tagline: 统一鉴权，多模型接入，OpenAI-Compatible 调用方式。
  image:
    src: /logo.png
    alt: 青鸟 API Logo
  actions:
    - theme: brand
      text: 快速开始
      link: /docs/quick-start
    - theme: alt
      text: Chat Completions
      link: /docs/chat-completions
features:
  - title: 统一鉴权
    details: 使用同一套 Bearer Token 调用不同模型，降低多平台接入成本。
  - title: 多模型接入
    details: 通过统一 API 访问可用模型，业务侧只需要关注模型名称和请求参数。
  - title: OpenAI-Compatible
    details: 兼容常见 OpenAI SDK 和 HTTP 调用方式，便于从现有项目迁移。
  - title: 流式响应
    details: 支持 stream=true 的 SSE 输出，适合聊天、写作、代码生成等实时场景。
---

## 青鸟 API 是什么

青鸟 API 是面向开发者的 AI API 聚合与分发平台。你可以使用统一的 API Key 和标准 HTTP 接口调用平台中可用的模型，快速接入聊天补全、文本向量、图像生成等能力。

本文档只面向普通 API 用户，重点说明如何鉴权、如何请求接口、如何处理响应、错误、额度和速率限制。

## 常用入口

- [快速开始](/docs/quick-start)：注册账号、获取 API Key，并发送第一个请求。
- [模型列表](/docs/models)：查询当前 Key 可用的模型。
- [Chat Completions](/docs/chat-completions)：使用 OpenAI-Compatible 聊天补全接口。
- [错误码](/docs/errors)：理解常见错误和排查方式。
- [FAQ](/docs/faq)：常见接入问题与处理建议。

## 调用方式概览

```bash
curl https://bluebirdapi.com/v1/chat/completions \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "user", "content": "用一句话介绍青鸟 API" }
    ]
  }'
```

::: tip
本文档示例默认使用 `https://bluebirdapi.com` 作为服务地址，请将 `sk-xxxxxxxxxxxxxxxx` 替换为你的实际 API Key。
:::
