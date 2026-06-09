const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

loadEnvFile();

const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;

const providerDefaults = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4.1",
  },
  compatible: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  },
  minimax: {
    baseUrl: "https://api.minimaxi.com/v1",
    model: "MiniMax-Text-01",
  },
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
  },
  doubao: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-250615",
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
};

const mimeTypes = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".md": "text/markdown;charset=utf-8",
  ".txt": "text/plain;charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/chat/test") {
      await handleChat(req, res, true);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AI Chat Web running at http://127.0.0.1:${PORT}`);
});

async function handleChat(req, res, isTest = false) {
  const body = await readJson(req);
  const settings = normalizeSettings(body.settings || {});
  const messages = isTest
    ? [{ role: "user", content: "请只回复：连接成功" }]
    : normalizeMessages(body.messages);

  if (!messages.length) {
    sendJson(res, 400, { error: "No messages provided" });
    return;
  }

  if (!settings.apiKey) {
    sendJson(res, 400, {
      error: "请先在设置里填写 API Key。",
    });
    return;
  }

  const result = await callProvider(settings, messages);
  sendJson(res, 200, result);
}

async function callProvider(settings, messages) {
  if (settings.provider === "openai") {
    return callOpenAIResponses(settings, messages);
  }

  if (isOpenAICompatibleProvider(settings.provider)) {
    return callOpenAICompatible(settings, messages);
  }

  if (settings.provider === "anthropic") {
    return callAnthropic(settings, messages);
  }

  if (settings.provider === "gemini") {
    return callGemini(settings, messages);
  }

  throw new Error("Unsupported provider");
}

async function callOpenAIResponses(settings, messages) {
  const response = await fetch(`${trimSlash(settings.baseUrl)}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      input: [
        {
          role: "system",
          content: settings.systemPrompt,
        },
        ...messages,
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ProviderError(data.error?.message || "OpenAI API request failed", response.status);
  }

  return {
    reply: extractResponseText(data),
    model: data.model || settings.model,
  };
}

async function callOpenAICompatible(settings, messages) {
  const response = await fetch(`${trimSlash(settings.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: "system", content: settings.systemPrompt }, ...messages],
      temperature: 0.7,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ProviderError(data.error?.message || "OpenAI-compatible API request failed", response.status);
  }

  return {
    reply: data.choices?.[0]?.message?.content || "模型返回了空内容。",
    model: data.model || settings.model,
  };
}

async function callAnthropic(settings, messages) {
  const response = await fetch(`${trimSlash(settings.baseUrl)}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      system: settings.systemPrompt,
      max_tokens: 4096,
      messages,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ProviderError(data.error?.message || "Anthropic API request failed", response.status);
  }

  return {
    reply:
      data.content
        ?.filter((item) => item.type === "text" && item.text)
        ?.map((item) => item.text)
        ?.join("\n") || "模型返回了空内容。",
    model: data.model || settings.model,
  };
}

async function callGemini(settings, messages) {
  const response = await fetch(
    `${trimSlash(settings.baseUrl)}/models/${encodeURIComponent(settings.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": settings.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: settings.systemPrompt }],
        },
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ProviderError(data.error?.message || "Gemini API request failed", response.status);
  }

  return {
    reply:
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        ?.filter(Boolean)
        ?.join("\n") || "模型返回了空内容。",
    model: settings.model,
  };
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const targetPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT, `.${targetPath}`);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const type = mimeTypes[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => message?.content && ["user", "assistant"].includes(message.role))
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: String(message.content).slice(0, 12000),
    }));
}

function normalizeSettings(settings) {
  const provider = providerDefaults[settings.provider] ? settings.provider : "openai";
  const defaults = providerDefaults[provider];

  return {
    provider,
    apiKey: String(settings.apiKey || getEnvApiKey(provider) || "").trim(),
    model: String(settings.model || defaults.model).trim(),
    baseUrl: String(settings.baseUrl || defaults.baseUrl).trim(),
    systemPrompt:
      String(settings.systemPrompt || "").trim() ||
      "你是一个专业、直接、可靠的中文 AI 助手。回答要准确、可执行；不确定时明确说明。",
  };
}

function getEnvApiKey(provider) {
  return {
    openai: process.env.OPENAI_API_KEY,
    compatible: process.env.COMPATIBLE_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    qwen: process.env.QWEN_API_KEY,
    minimax: process.env.MINIMAX_API_KEY,
    kimi: process.env.KIMI_API_KEY,
    doubao: process.env.DOUBAO_API_KEY,
    zhipu: process.env.ZHIPU_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }[provider];
}

function isOpenAICompatibleProvider(provider) {
  return ["compatible", "deepseek", "qwen", "minimax", "kimi", "doubao", "zhipu"].includes(provider);
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const text = data.output
    ?.flatMap((item) => item.content || [])
    ?.filter((content) => content.type === "output_text" && content.text)
    ?.map((content) => content.text)
    ?.join("\n")
    ?.trim();

  return text || "模型返回了空内容。";
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json;charset=utf-8" });
  res.end(JSON.stringify(data));
}

function trimSlash(value) {
  return value.replace(/\/+$/, "");
}

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fsSync.existsSync(envPath)) {
    return;
  }

  const content = fsSync.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}
