# WeekendAI — 本地 AI 对话应用

一个轻量级、开箱即用的 AI 聊天 Web 应用，纯前端 + Node.js 后端，支持十余家主流模型商。无需数据库、无需构建步骤，几行命令即可在本地跑起来。

## 功能

- **多模型商支持** — OpenAI Responses · Anthropic Claude · Google Gemini · 以及 DeepSeek / Qwen / MiniMax / Kimi / 豆包 / 智谱等 OpenAI 兼容接口
- **即时切换模型** — 页面顶部下拉即可切换，配置保存在浏览器本地
- **Markdown 富文本渲染** — 代码高亮、表格、列表、引用块等完整支持
- **打字机效果** — AI 回复逐字呈现，滚动到底部自动跟随
- **明暗主题** — 亮色 / 暗色 / 跟随系统，一键切换
- **对话管理** — 搜索、多会话并存、清空历史、导出对话为 TXT
- **移动端适配** — 侧边栏抽屉式交互，小屏下布局自动调整
- **零依赖前端** — 仅通过 CDN 引入 `marked.js` 做 Markdown 解析

## 前置要求

- **Node.js >= 20**（无需额外安装 npm 包——服务端仅使用 Node 内置模块）
- 至少一个模型商的 API Key

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/180129916/ai-chat-web.git
cd ai-chat-web

# 2. 创建环境变量文件（可选）
cp .env.example .env

# 3. 启动服务
node server.js
```

启动后浏览器打开 [http://127.0.0.1:4174](http://127.0.0.1:4174)。

首次使用请在页面右上角点击 **设置**，填写 API Key 和模型信息后保存。

## 详细部署指南

### 1. 环境变量（可选）

复制 `.env.example` 为 `.env`，填写对应模型商的 API Key：

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4.1

# 以下按需填写，页面内直接填写 API Key 时可不填
DEEPSEEK_API_KEY=
QWEN_API_KEY=
MINIMAX_API_KEY=
KIMI_API_KEY=
DOUBAO_API_KEY=
ZHIPU_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

PORT=4174
```

> 服务器启动时会自动加载 `.env` 文件。`.env` 中的 API Key 优先级**低于**页面内填写的 Key——也就是说，页面内留空时才会回退到环境变量。这一设计方便在多人共享部署时，由部署者预置 Key 而每位用户仍可使用自己的 Key。

服务端通过 `process.env` 读取环境变量，**不会**将 API Key 暴露到前端，仅在服务端代理请求时使用。

### 2. 修改端口

默认端口 `4174`，可通过 `.env` 中的 `PORT` 变量或启动时指定：

```bash
# 方式一：.env 中设置
PORT=8080

# 方式二：命令行指定（仅限 Windows PowerShell）
$env:PORT='8080'; node server.js
```

### 3. 作为后台服务运行

**Linux / macOS（使用 nohup）**

```bash
nohup node server.js > app.log 2>&1 &
```

**Windows（使用 PowerShell 后台作业）**

```powershell
Start-Process -NoNewWindow node -ArgumentList "server.js"
```

如需生产环境部署，建议使用 **PM2**：

```bash
npm install -g pm2
pm2 start server.js --name ai-chat-web
pm2 save
pm2 startup
```

### 4. 反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name chat.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4174;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 5. Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE 4174
CMD ["node", "server.js"]
```

```bash
docker build -t ai-chat-web .
docker run -d -p 4174:4174 --env-file .env ai-chat-web
```

## 自定义配置模型

### 支持的模型商

启动后在页面右上角点击**设置**，从以下模型商中选择：

| 模型商 | 接口类型 | 默认模型 | 预设地址 |
|--------|---------|---------|---------|
| OpenAI | Responses API | `gpt-4.1` | `https://api.openai.com/v1` |
| OpenAI 兼容接口 | Chat Completions | `deepseek-chat` | `https://api.deepseek.com` |
| DeepSeek | Chat Completions | `deepseek-chat` | `https://api.deepseek.com` |
| Qwen / 阿里百炼 | Chat Completions | `qwen-plus` | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| MiniMax | Chat Completions | `MiniMax-Text-01` | `https://api.minimaxi.com/v1` |
| Kimi / Moonshot | Chat Completions | `moonshot-v1-8k` | `https://api.moonshot.cn/v1` |
| 豆包 / 火山方舟 | Chat Completions | `doubao-seed-1-6-250615` | `https://ark.cn-beijing.volces.com/api/v3` |
| 智谱 GLM | Chat Completions | `glm-4-plus` | `https://open.bigmodel.cn/api/paas/v4` |
| Anthropic Claude | Messages API | `claude-sonnet-4-5` | `https://api.anthropic.com` |
| Google Gemini | generateContent | `gemini-2.5-flash` | `https://generativelanguage.googleapis.com/v1beta` |

### 接入自定义兼容接口

如果你的服务提供了 **OpenAI Chat Completions 兼容接口**（如 One API、LobeHub、LiteLLM、Ollama 等），选择 **OpenAI 兼容接口** 提供商，然后：

1. **API Key** — 填写你服务的 Key
2. **模型名** — 填写你服务支持的模型名（如 `gpt-4o`、`llama3`、`qwen2.5`）
3. **接口地址** — 填写你的服务地址（如 `https://your-api.example.com/v1`）
4. **系统提示词** — 自定义 AI 的角色行为

配置完成后点击**保存设置**即可生效。

### 系统提示词

系统提示词决定了 AI 的回答风格。页面默认提供了一个中文助理风格的提示词：

```
你是一个专业、直接、可靠的中文 AI 助手。回答要准确、可执行；不确定时明确说明。
```

你可以根据需要修改，例如：

- **代码助手**：`你是一个资深全栈工程师，回答时优先给出可直接运行的代码示例。`
- **翻译模式**：`你是中英双语翻译专家。用户输入中文则译为英文，输入英文则译为中文。只输出译文。`
- **创意写作**：`你是一个有文学素养的中文写作者，文笔优美但不浮夸。`

## 技术架构

```
ai-chat-web/
├── index.html      # 前端 UI（纯 HTML，无框架）
├── styles.css      # 主题与布局（CSS 变量驱动的明暗主题）
├── app.js          # 前端逻辑（状态管理、渲染、API 调用）
├── server.js       # Node.js 后端（HTTP 服务 + 多模型商代理）
├── package.json    # 项目元数据
└── .env.example    # 环境变量模板
```

- 前端通过 `fetch('/api/chat')` 将对话请求发送到同源后端
- 后端根据设置中的提供商，将请求代理到对应的模型 API
- API Key 仅保存在服务端内存 / 浏览器 localStorage，不经过第三方

## License

MIT
