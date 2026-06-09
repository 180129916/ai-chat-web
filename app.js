const STORAGE_KEY = "ai-chat-web-state-v1";
const SETTINGS_KEY = "ai-chat-web-api-settings-v1";
const THEME_KEY = "ai-chat-web-theme-v1";

const providerPresets = {
  openai: { label: "OpenAI Responses", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1" },
  compatible: { label: "OpenAI 兼容接口", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  qwen: { label: "Qwen / 阿里百炼", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  minimax: { label: "MiniMax", baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-Text-01" },
  kimi: { label: "Kimi / Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  doubao: { label: "豆包 / 火山方舟", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-seed-1-6-250615" },
  zhipu: { label: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-plus" },
  anthropic: { label: "Anthropic Claude", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5" },
  gemini: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.5-flash" },
};

const starterPrompts = [
  { title: "深度思考", text: "帮我设计一个 30 天学习 AI 工具的计划" },
  { title: "专业分析", text: "从用户体验角度分析一个 AI 对话页面应该包含什么" },
  { title: "内容创作", text: "写一段产品官网的开场文案，语气专业克制" },
  { title: "编程助手", text: "解释 React 中 useEffect 常见的三个使用场景" },
];

const fallbackChats = [
  { id: crypto.randomUUID(), title: "欢迎使用 WeekendAI", createdAt: Date.now(), messages: [
    { role: "assistant", content: "你好！我是 WeekendAI，你的 AI 对话助手。\n\n我可以帮你写作、编程、分析问题、翻译文档等等。当前为前端演示模式，接入 API Key 后可获得真实的模型回答。" },
  ]},
];

let state = loadState();
let apiSettings = loadApiSettings();
let activeChatId = state.activeChatId || state.chats[0].id;
let isResponding = false;
var introTyped = false;
var userScrolledUp = false;
var abortController = null;

const sidebar = document.querySelector("#sidebar");
const chatList = document.querySelector("#chatList");
const messages = document.querySelector("#messages");
const composer = document.querySelector("#composer");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const searchInput = document.querySelector("#searchInput");
const newChatButton = document.querySelector("#newChatButton");
const clearChatsButton = document.querySelector("#clearChatsButton");
const exportButton = document.querySelector("#exportButton");
const openSidebar = document.querySelector("#openSidebar");
const closeSidebar = document.querySelector("#closeSidebar");
const modelSelect = document.querySelector("#modelSelect");
const settingsButton = document.querySelector("#settingsButton");
const settingsModal = document.querySelector("#settingsModal");
const closeSettings = document.querySelector("#closeSettings");
const settingsForm = document.querySelector("#settingsForm");
const providerSelect = document.querySelector("#providerSelect");
const apiKeyInput = document.querySelector("#apiKeyInput");
const modelInput = document.querySelector("#modelInput");
const baseUrlInput = document.querySelector("#baseUrlInput");
const systemPromptInput = document.querySelector("#systemPromptInput");
const testSettingsButton = document.querySelector("#testSettingsButton");
const settingsStatus = document.querySelector("#settingsStatus");
const themeSwitcher = document.querySelector("#themeSwitcher");

initTheme();

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
  themeSwitcher.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.theme);
      localStorage.setItem(THEME_KEY, btn.dataset.theme);
    });
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (document.documentElement.dataset.theme === "system") applyTheme("system");
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeSwitcher.querySelectorAll(".theme-option").forEach((btn) => {
    const isActive = btn.dataset.theme === theme;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-checked", isActive);
  });
}

render();
renderModelSelect();
fillSettingsForm();

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isResponding) sendMessage(messageInput.value.trim());
});

messageInput.addEventListener("input", () => {
  autoResizeInput();
  sendButton.disabled = !messageInput.value.trim() || isResponding;
});

messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  const chat = createChat();
  state.chats.unshift(chat);
  activeChatId = chat.id;
  state.activeChatId = activeChatId;
  saveState();
  render();
  messageInput.focus();
});

searchInput.addEventListener("input", renderChatList);

clearChatsButton.addEventListener("click", () => {
  introTyped = false;
  state = { chats: fallbackChats.map((c) => ({ ...c, id: crypto.randomUUID() })), activeChatId: null };
  activeChatId = state.chats[0].id;
  state.activeChatId = activeChatId;
  saveState();
  render();
});

exportButton.addEventListener("click", () => {
  const chat = getActiveChat();
  const content = chat.messages.map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`).join("\n\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${chat.title}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
});

openSidebar.addEventListener("click", () => sidebar.classList.add("open"));
closeSidebar.addEventListener("click", () => sidebar.classList.remove("open"));

modelSelect.addEventListener("change", () => {
  apiSettings.model = modelSelect.value;
  saveApiSettings();
  fillSettingsForm();
});

settingsButton.addEventListener("click", () => {
  fillSettingsForm();
  settingsStatus.textContent = "API Key 会保存在浏览器 localStorage，仅用于这个本地页面。";
  settingsModal.classList.add("open");
  settingsModal.setAttribute("aria-hidden", "false");
});

closeSettings.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettingsModal();
});

providerSelect.addEventListener("change", () => {
  const preset = providerPresets[providerSelect.value];
  modelInput.value = preset.model;
  baseUrlInput.value = preset.baseUrl;
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  apiSettings = readSettingsForm();
  saveApiSettings();
  renderModelSelect();
  settingsStatus.textContent = "设置已保存。";
  closeSettingsModal();
});

testSettingsButton.addEventListener("click", async () => {
  const draftSettings = readSettingsForm();
  settingsStatus.textContent = "正在测试连接...";
  testSettingsButton.disabled = true;
  try {
    const response = await fetch("/api/chat/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: draftSettings }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "测试失败");
    settingsStatus.textContent = `连接成功：${data.reply}`;
  } catch (error) {
    settingsStatus.textContent = `连接失败：${error.message}`;
  } finally {
    testSettingsButton.disabled = false;
  }
});

document.querySelectorAll(".tool-button").forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.prompt;
    autoResizeInput();
    sendButton.disabled = false;
    messageInput.focus();
  });
});

// ── Stop generation ──

sendButton.addEventListener("click", (event) => {
  if (isResponding) {
    event.preventDefault();
    stopGeneration();
  }
});

function stopGeneration() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

// ── Streaming send ──

async function sendMessage(text) {
  if (!text || isResponding) return;

  const chat = getActiveChat();
  chat.messages.push({ role: "user", content: text });
  if (chat.title === "新对话" || chat.title === "欢迎使用 WeekendAI")
    chat.title = text.slice(0, 22);

  messageInput.value = "";
  autoResizeInput();
  isResponding = true;
  userScrolledUp = false;
  saveState();
  render();

  const payload = chat.messages.map((m) => ({ role: m.role, content: m.content }));
  const assistantMessage = { role: "assistant", content: "" };
  chat.messages.push(assistantMessage);
  renderMessages();

  abortController = new AbortController();

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: apiSettings, messages: payload }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `请求失败（${response.status}）`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();

        try {
          const event = JSON.parse(payload);
          if (event.token) {
            assistantMessage.content += event.token;
            const stick = !userScrolledUp && isNearBottom();
            renderMessages(stick);
          } else if (event.error) {
            throw new Error(event.error);
          }
          // event.done is handled after the loop
        } catch (e) {
          if (e.message !== event?.error) throw e;
        }
      }
    }
  } catch (error) {
    if (error.name === "AbortError") {
      if (!assistantMessage.content) {
        assistantMessage.content = "已停止生成。";
      }
    } else {
      assistantMessage.content = `请求失败：${error.message}`;
    }
  } finally {
    isResponding = false;
    abortController = null;
    sendButton.disabled = !messageInput.value.trim();
    saveState();
    renderChatList();
    renderMessages(isNearBottom());
  }
}

// ── Data ──

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.chats?.length) return saved;
  } catch { localStorage.removeItem(STORAGE_KEY); }
  return { chats: fallbackChats, activeChatId: fallbackChats[0].id };
}

function loadApiSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved?.provider && providerPresets[saved.provider])
      return { ...defaultApiSettings(saved.provider), ...saved };
  } catch { localStorage.removeItem(SETTINGS_KEY); }
  return defaultApiSettings("openai");
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats: state.chats, activeChatId }));
}

function saveApiSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(apiSettings));
}

function defaultApiSettings(provider) {
  const preset = providerPresets[provider];
  return {
    provider, apiKey: "", model: preset.model, baseUrl: preset.baseUrl,
    systemPrompt: "你是一个专业、直接、可靠的中文 AI 助手。回答要准确、可执行；不确定时明确说明。",
  };
}

function fillSettingsForm() {
  providerSelect.value = apiSettings.provider;
  apiKeyInput.value = apiSettings.apiKey || "";
  modelInput.value = apiSettings.model || providerPresets[apiSettings.provider].model;
  baseUrlInput.value = apiSettings.baseUrl || providerPresets[apiSettings.provider].baseUrl;
  systemPromptInput.value = apiSettings.systemPrompt || defaultApiSettings(apiSettings.provider).systemPrompt;
}

function readSettingsForm() {
  const provider = providerSelect.value;
  const preset = providerPresets[provider];
  return {
    provider, apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim() || preset.model,
    baseUrl: baseUrlInput.value.trim() || preset.baseUrl,
    systemPrompt: systemPromptInput.value.trim() || defaultApiSettings(provider).systemPrompt,
  };
}

function renderModelSelect() {
  const preset = providerPresets[apiSettings.provider];
  const options = new Set([apiSettings.model, preset.model, ...getModelSuggestions(apiSettings.provider)]);
  modelSelect.innerHTML = "";
  for (const model of options) {
    if (!model) continue;
    const option = document.createElement("option");
    option.value = model;
    option.textContent = `${preset.label} · ${model}`;
    option.selected = model === apiSettings.model;
    modelSelect.append(option);
  }
}

function getModelSuggestions(provider) {
  return {
    openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
    compatible: ["deepseek-chat", "deepseek-reasoner", "qwen-plus"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    qwen: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen-long"],
    minimax: ["MiniMax-Text-01", "abab6.5s-chat", "abab6.5g-chat"],
    kimi: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    doubao: ["doubao-seed-1-6-250615", "doubao-1-5-pro-32k-250115", "doubao-1-5-lite-32k-250115"],
    zhipu: ["glm-4-plus", "glm-4-air", "glm-4-flash"],
    anthropic: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-5-haiku-latest"],
    gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-flash"],
  }[provider];
}

function closeSettingsModal() {
  settingsModal.classList.remove("open");
  settingsModal.setAttribute("aria-hidden", "true");
}

function createChat() {
  return { id: crypto.randomUUID(), title: "新对话", createdAt: Date.now(), messages: [] };
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === activeChatId) || state.chats[0];
}

// ── Intro typewriter (local-only welcome, no API call) ──

function typeIntro(chat, reply) {
  var i = 0;
  var timer = window.setInterval(function () {
    var stick = !userScrolledUp && isNearBottom();
    chat.messages[0].content = reply.slice(0, i);
    renderMessages(stick);
    i += 2;
    if (i > reply.length) {
      chat.messages[0].content = reply;
      window.clearInterval(timer);
      isResponding = false;
      sendButton.disabled = !messageInput.value.trim();
      renderMessages(isNearBottom());
    }
  }, 22);
}

// ── Rendering ──

function render() {
  renderChatList();
  renderMessages();
  sendButton.disabled = !messageInput.value.trim() || isResponding;
  sendButton.classList.toggle("is-stop", isResponding);
  sendButton.textContent = isResponding ? "■" : "↑";
}

function renderChatList() {
  const keyword = searchInput.value.trim().toLowerCase();
  const chats = state.chats.filter((chat) => chat.title.toLowerCase().includes(keyword));
  chatList.innerHTML = "";
  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.className = `chat-item${chat.id === activeChatId ? " active" : ""}`;
    button.innerHTML = `<span class="chat-title">${escapeHtml(chat.title)}</span><span class="chat-time">${formatTime(chat.createdAt)}</span>`;
    button.addEventListener("click", () => {
      activeChatId = chat.id;
      state.activeChatId = activeChatId;
      sidebar.classList.remove("open");
      saveState();
      render();
    });
    chatList.append(button);
  });
}

function renderMessages(stickToBottom) {
  if (stickToBottom === undefined) stickToBottom = true;
  const chat = getActiveChat();
  messages.innerHTML = "";

  var panel = document.querySelector(".chat-panel");
  var isIntro = chat.messages.length === 1 && chat.messages[0].role === "assistant"
    && chat.messages[0].content.indexOf("我是 WeekendAI") > 0;
  if (chat.messages.length === 0 || isIntro) {
    panel.classList.add("is-empty");
  } else {
    panel.classList.remove("is-empty");
  }

  if (!chat.messages.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `<h1>今天想聊什么？</h1><div class="prompt-grid">${starterPrompts.map((prompt) => `<button class="prompt-card" data-prompt="${escapeHtml(prompt.text)}"><strong>${escapeHtml(prompt.title)}</strong><span>${escapeHtml(prompt.text)}</span></button>`).join("")}</div>`;
    messages.append(emptyState);
    emptyState.querySelectorAll(".prompt-card").forEach((button) => {
      button.addEventListener("click", () => {
        messageInput.value = button.dataset.prompt;
        autoResizeInput();
        sendButton.disabled = false;
        messageInput.focus();
      });
    });
    return;
  }

  var _introFull = null;
  if (!introTyped && chat.messages.length === 1) {
    var fm = chat.messages[0];
    if (fm.role === "assistant" && fm.content.indexOf("我是 WeekendAI") > 0) {
      _introFull = fm.content;
      fm.content = "";
    }
  }

  chat.messages.forEach((message) => {
    messages.append(createMessageElement(message));
  });

  if (stickToBottom) messages.scrollTop = messages.scrollHeight;

  if (_introFull) {
    chat.messages[0].content = _introFull;
    introTyped = true;
    isResponding = true;
    sendButton.classList.toggle("is-stop", true);
    sendButton.textContent = "■";
    typeIntro(chat, _introFull);
  }
}

function createMessageElement(message) {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${message.role}`;
  const avatarText = message.role === "user" ? "U" : "AI";
  wrapper.innerHTML = `<div class="avatar">${avatarText}</div><div class="bubble rich-text">${renderRichContent(message.content)}</div>`;
  return wrapper;
}

function showTyping() {
  const typing = document.createElement("article");
  typing.className = "message assistant";
  typing.dataset.typing = "true";
  typing.innerHTML = `<div class="avatar">AI</div><div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div>`;
  messages.append(typing);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  messages.querySelector("[data-typing='true']")?.remove();
}

messages.addEventListener("scroll", function () {
  if (isResponding && !isNearBottom()) {
    userScrolledUp = true;
  }
});

function isNearBottom() {
  return messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
}

function autoResizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(timestamp);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
}

// ── Markdown rendering ──

if (typeof marked !== "undefined") marked.setOptions({ breaks: true, gfm: true });

function renderRichContent(source) {
  if (!source) return "";
  const text = String(source).replace(/\r\n/g, "\n");
  if (/^\s*<(!doctype|html|head|body|div|table|form|article|section|main|nav|header|footer|aside|figure|details|dialog|fieldset)[\s>]/i.test(text) && /<\/[a-z][a-z0-9]*>/i.test(text))
    return sanitizeHtml(text);
  let html;
  if (typeof marked !== "undefined") {
    try { html = marked.parse(text); } catch { html = "<p>" + escapeHtml(text) + "</p>"; }
  } else {
    html = "<p>" + escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
  }
  return sanitizeHtml(html);
}

function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["A","ABBR","B","BLOCKQUOTE","BR","CAPTION","CITE","CODE","COL","COLGROUP","DD","DEL","DETAILS","DFN","DIV","DL","DT","EM","FIGCAPTION","FIGURE","H1","H2","H3","H4","H5","H6","HR","I","IMG","INS","KBD","LI","MARK","OL","P","PRE","Q","S","SAMP","SMALL","SPAN","STRONG","SUB","SUMMARY","SUP","TABLE","TBODY","TD","TFOOT","TH","THEAD","TR","UL","VAR"]);
  const allowedAttrs = new Set(["href","target","rel","src","alt","width","height","loading","referrerpolicy","class","id","colspan","rowspan","scope","align","valign","start","type","reversed","open"]);
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      if (!allowedTags.has(child.tagName)) { child.replaceWith(...child.childNodes); continue; }
      for (const attr of [...child.attributes]) { if (!allowedAttrs.has(attr.name)) child.removeAttribute(attr.name); }
      if (child.tagName === "A") {
        const href = child.getAttribute("href") || "";
        if (!/^(https?:|mailto:|\/\/|data:)/i.test(href)) child.removeAttribute("href");
        else { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noreferrer noopener"); }
      }
      if (child.tagName === "IMG") {
        const src = child.getAttribute("src") || "";
        if (!/^https?:|^data:image\//i.test(src)) { child.remove(); continue; }
        child.setAttribute("loading", "lazy");
        child.setAttribute("referrerpolicy", "no-referrer");
      }
      walk(child);
    }
  };
  walk(template.content);
  return template.innerHTML;
}
