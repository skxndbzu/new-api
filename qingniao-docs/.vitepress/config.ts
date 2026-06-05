import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '青鸟 API 文档',
  description: 'AI API 聚合与分发平台接口文档',
  lang: 'zh-CN',
  base: '/docs/',
  outDir: '../web/docs',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/docs/favicon.png' }],
    ['meta', { property: 'og:title', content: '青鸟 API 文档' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'AI API 聚合与分发平台接口文档',
      },
    ],
  ],
  themeConfig: {
    logo: '/logo.png',
    siteTitle: '青鸟 API 文档',
    search: {
      provider: 'local',
    },
    nav: [
      { text: '首页', link: '/' },
      { text: '快速开始', link: '/docs/quick-start' },
      { text: '接口文档', link: '/docs/chat-completions' },
      { text: '错误码', link: '/docs/errors' },
      { text: '常见问题', link: '/docs/faq' },
    ],
    sidebar: [
      {
        text: '入门',
        items: [
          { text: '快速开始', link: '/docs/quick-start' },
          { text: '认证鉴权', link: '/docs/authentication' },
          { text: '基础信息', link: '/docs/base-url' },
        ],
      },
      {
        text: '接口文档',
        items: [
          { text: '模型列表', link: '/docs/models' },
          { text: 'Chat Completions', link: '/docs/chat-completions' },
          { text: 'Responses API', link: '/docs/responses' },
          { text: 'Embeddings', link: '/docs/embeddings' },
          { text: '图像接口', link: '/docs/images' },
        ],
      },
      {
        text: '调用指南',
        items: [
          { text: '流式响应', link: '/docs/streaming' },
          { text: '错误码', link: '/docs/errors' },
          { text: '最佳实践', link: '/docs/best-practices' },
        ],
      },
      {
        text: '账号与额度',
        items: [
          { text: '额度与计费', link: '/docs/billing' },
          { text: '速率限制', link: '/docs/rate-limit' },
        ],
      },
      {
        text: '规范与限制',
        items: [{ text: '禁止用途', link: '/docs/forbidden-usage' }],
      },
      {
        text: '支持',
        items: [
          { text: 'FAQ', link: '/docs/faq' },
          { text: '变更日志', link: '/docs/changelog' },
        ],
      },
    ],
    footer: {
      message: '青鸟 API 用户接口文档。请遵守平台规则与适用法律法规。',
      copyright:
        'Based on the open-source project New API. Licensed under AGPLv3.',
    },
    outline: {
      label: '本页目录',
      level: [2, 3],
    },
    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },
  },
})
