# Chatbox Lite

基于 [Chatbox Community Edition](https://github.com/chatboxai/chatbox) 的聊天精简版，维护于 [smgjch/chatbox](https://github.com/smgjch/chatbox)。尽量保留原版界面、操作习惯和聊天细节。

## 功能

保留多会话、流式回复、Markdown/代码/公式、消息编辑与重试、会话分支、搜索、上下文压缩、图片输入、文件附件、本地导入导出、主题和快捷键。文档在本地解析，解析出的文本直接进入聊天上下文；大文档仍受所选模型的上下文窗口限制。

移除 MCP、知识库、Skills、Agent/工具执行、记忆、Chatbox 账户/订阅/额度/云解析、生成图片、“我的搭档”及网页发布。停用原版遥测、远程配置和自动更新。HTML 代码预览使用本地沙箱 iframe。

保留原版第三方模型供应商。自定义供应商支持 OpenAI Chat Completions、OpenAI Responses、Claude 和原生 Gemini 协议。

## 接入 AGIHub Gemini

打开 **设置 → 模型提供方 → 添加提供方 → 添加自定义提供方**，点击 **使用 AGIHub Gemini 预设**，添加后填入自己的 API Key。预设已经配置：

| 项目 | 值 |
| --- | --- |
| API 模式 | Google Gemini API Compatible |
| API Host | `https://agihub.bytedance.net/api_proxy/auto_mode/call/v1beta` |
| 鉴权 | `Authorization: Bearer <API Key>` |
| 请求体包含 model | 开启 |
| 流式输出 | 关闭，使用 `:generateContent` |
| 模型 ID | `gemini-4-argon` |
| 推理参数模式 | 等级（thinkingLevel） |

也可以粘贴完整的 `…/models/gemini-4-argon:generateContent` 地址，程序会提取基地址。其他 Gemini 代理可手动选择 `x-goog-api-key` 或 Bearer 鉴权，并分别控制请求体 `model` 字段和流式请求。启用流式后使用 `:streamGenerateContent?alt=sse`，需要网关支持此接口。

流式输出需要同时开启“设置 → 聊天 → 流式输出”和“设置 → 模型提供方 → 对应 Gemini 提供方 → Gemini 流式响应”，并且会话没有单独关闭流式。AGIHub 预设为兼容示例中的 `generateContent`，默认关闭提供方的流式开关；推理强度和思考摘要设置不会改变这个开关。

2026-11-27 的一次实际网关排查中，`gemini-4-argon:generateContent` 返回 200，而 `gemini-4-argon:streamGenerateContent?alt=sse` 两次返回 503、`protocol_unavailable`。这表示当时该网关路由未提供原生流式协议，不代表所有 AGIHub 模型或接口都不支持流式。此情况需网关开通相应协议，单独打开客户端开关无法恢复流式。

选择模型后，在输入框的推理强度菜单选择 **默认 / 低 / 中 / 高**。Gemini 3 及更新命名模型使用 `generationConfig.thinkingConfig.thinkingLevel`；Gemini 2.5 使用 `thinkingBudget`。代理使用自定义模型别名时，可在模型编辑中指定推理参数模式。强度按提供方和模型分别保存，切换模型不会串用参数。

选择“高”时，发送的请求形如：

```http
POST /api_proxy/auto_mode/call/v1beta/models/gemini-4-argon:generateContent
Content-Type: application/json
Authorization: Bearer <API Key>
```

```json
{
  "model": "gemini-4-argon",
  "contents": [{ "role": "user", "parts": [{ "text": "hi" }] }],
  "generationConfig": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } }
}
```

“默认”不指定推理强度或预算，保留服务端默认行为；支持思考的 Gemini 模型仍会请求 `includeThoughts: true` 以获取原生摘要。实际请求还可能包含会话系统提示和其他聊天参数。具体参数是否被接受取决于网关对应的模型。

### 确认推理是否生效

推理强度图标表示客户端选择的参数，不代表服务端执行结果。选择“高”并发送一条需要推理的问题，然后查看以下证据：

- **思考摘要**：如果 Gemini 返回 `candidates[].content.parts[]` 中带 `thought: true` 的文本，回复上方的“思考摘要”可以展开、收起和复制。它是服务端提供的摘要，不保证包含完整思考过程。非流式请求在整条回复完成后才显示。
- **推理用量**：Gemini 的 `usageMetadata.thoughtsTokenCount` 会保存为消息的 `usage.reasoningTokens`。摘要区域会显示服务端报告的推理 token。大于 0 表示服务端报告实际使用了推理 token，即使没有公开摘要。没有摘要时显示“服务端未提供摘要”，没有用量字段时显示“未提供推理用量”。两者分别判断，不会额外请求模型生成说明。
- **检查现有回复**：打开“设置 → 数据与备份 → 导出数据”，选择相应对话，在“导出给旧版本使用”中选“仅导出对话（V1 JSON）”。用文本编辑器打开导出的 JSON，找到对应 assistant 消息的 `usage.reasoningTokens`，以及 `contentParts` 中 `type: "reasoning"` 的部分。

旧记录中无法确认来源的 0 用量按“未提供推理用量”显示。如果只有最终答案、推理 token 为 0 或缺失，仍不能据此断定推理被关闭：网关可能未转发摘要或用量字段。此时需要检查网关原始响应或服务端日志，确认它是否识别并透传 `thinkingLevel` 和 `includeThoughts`。不要用响应耗时或模型自述作为开启推理的证据。

## 开发与构建

需要 Node.js 22.13–22.x 和 pnpm 10.17 或更新版本。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

仅启动浏览器界面：

```bash
pnpm dev:web:standalone
```

访问 `http://localhost:1212`。浏览器版请求受网关 CORS 限制，桌面版通过 Electron 网络层请求。

检查与构建：

```bash
pnpm check
pnpm check:packages
pnpm test
pnpm build
pnpm exec electron-builder --mac zip --arm64 --publish never
```

最后一条命令在 macOS 上生成 `release/build/mac-arm64/Chatbox Lite.app` 和对应 ZIP 压缩包；Windows/Linux 可在相应平台使用 electron-builder 的 `--win` / `--linux` 参数。默认构建不发布、不公证，也不依赖原版签名服务。

## 数据兼容

应用名和标识使用独立的 Chatbox Lite，桌面数据目录与原版分开。可通过原版导出、Lite 导入迁移聊天。导入后会清除账户密钥等官方服务设置，并强制关闭已移除的服务；第三方供应商配置继续保留。

兼容结构仍保留部分旧记录字段，以读取已有会话和备份。历史工具记录只显示内容，不提供执行入口；旧 Agent 会话按普通聊天处理。知识库索引、记忆、Skills、工具工作目录等不迁移为可运行功能。

## 验证说明

2026-11-26：应用和工作区 TypeScript 检查通过；完整 `pnpm test` 共 6,795 项通过、14 项跳过；Electron 生产构建通过。macOS arm64 本地签名应用已验证启动、真实 Electron HTTP 通道、模型选择、文本与图片附件、PDF 本地解析、Markdown 显示、自动命名、记录恢复和多轮聊天的推理强度保存。

新增测试覆盖 Gemini 真实 SDK 请求序列化、Bearer/Google 两种鉴权、基地址处理、流式与非流式协议、推理参数、供应商配置导入以及聊天上下文隔离。另通过浏览器验证预设添加、推理强度选择、发送回复、自动命名和刷新后的记录恢复。

0.1.1 新增原生思考摘要面板、实际请求元数据保存及缺失推理用量的识别；相关单元和组件测试通过。完整回归共 6,809 项通过、14 项跳过。

上述构建验证使用模拟服务，不等同于确认网关当前模型可用性。2026-11-27 另对配置的 Argon 路由进行了流式与非流式接口对照排查，结果见上文；其他模型和路由未进行线上验证。

## 许可证

沿用 [GPL-3.0](LICENSE)。原版 Chatbox 的版权和作者归属保持不变；Chatbox Lite 是修改后的独立 fork。
