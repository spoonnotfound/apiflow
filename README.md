# ApiFlow

本项目是一个桌面级 API 代理应用，使用 Axum/Reqwest 做 HTTP 转发，支持流式透传和请求级日志记录。

## 开发运行

```bash
npm install
npm run tauri dev
```

> Linux 需先安装 Tauri 依赖（webkit2gtk、glib2 等）：https://tauri.app/start/prerequisites/

## 使用方式

1) 启动后在 UI 配置：
   - 服务和路由
   - 提供商（上游 Base URL 和 API Key）
   - 监听端口（默认 23333）
2) 点击"启动代理"，客户端会在本机启动 HTTP 代理服务，日志面板实时展示请求详情。
3) 将原有调用地址替换为 `http://localhost:<端口>`，路径保持一致。

## 主要特性

- Axum 本地 HTTP 代理，流式响应透传（SSE）
- 多服务、多提供商路由配置
- 每个请求写入详细日志：时间、方法、路径、上游 URL、状态码、耗时、错误信息
- 数据统计面板
- 支持局域网访问（可复制局域网地址/主机名）
