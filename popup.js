// popup.js - Bot Shield Detector - Multi-Model Edition

// ── Model Definitions ──
const MODELS = {
  flask: {
    id: "flask",
    label: "Flask Service",
    provider: "Local Server",
    emoji: "🐍",
    color: "#22d3ee",
    keyPlaceholder: "No key needed",
    keyHint: "Run the Flask service locally: python app.py (configured via .env on the server)",
    needsKey: false,
    needsEndpoint: true,
    endpointLabel: "Flask Service URL",
    endpointPlaceholder: "http://localhost:5000",
    endpointDefault: "http://localhost:5000",
  },
  gemini: {
    id: "gemini",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    emoji: "✦",
    color: "#4285f4",
    keyPlaceholder: "AIza...",
    keyHint: "Get a free key at aistudio.google.com",
    needsKey: true,
    needsEndpoint: false,
  },
  hf: {
    id: "hf",
    label: "HuggingFace TGI",
    provider: "Local / HF",
    emoji: "🤗",
    color: "#ff9d00",
    keyPlaceholder: "hf_... (optional for local)",
    keyHint: "Leave blank for local TGI without auth. Use HF token for cloud inference.",
    needsKey: false,
    needsEndpoint: true,
    endpointLabel: "TGI Endpoint URL",
    endpointPlaceholder: "http://localhost:8080",
    endpointDefault: "http://localhost:8080",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (Local)",
    provider: "Local",
    emoji: "🦙",
    color: "#64dcb4",
    keyPlaceholder: "No key needed",
    keyHint: "Runs fully local. Start with: ollama serve",
    needsKey: false,
    needsEndpoint: true,
    endpointLabel: "Ollama Base URL",
    endpointPlaceholder: "http://localhost:11434",
    endpointDefault: "http://localhost:11434",
  },
};

const LOCAL_MODELS = {
  hf: [
    { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct" },
    { id: "meta-llama/Llama-3.2-3B-Instruct", label: "Llama 3.2 3B" },
    { id: "microsoft/Phi-3-mini-4k-instruct", label: "Phi-3 Mini 4k" },
    { id: "HuggingFaceH4/zephyr-7b-beta", label: "Zephyr 7B Beta" },
  ],
  ollama: [
    { id: "mistral", label: "Mistral 7B" },
    { id: "llama3.2", label: "Llama 3.2 3B" },
    { id: "phi3", label: "Phi-3 Mini" },
    { id: "gemma2", label: "Gemma 2 9B" },
    { id: "qwen2.5", label: "Qwen 2.5 7B" },
  ],
};

// ── Known Bot Protection Signatures ──
const KNOWN_SIGNATURES = {
  cloudflare: {
    name: "Cloudflare",
    emoji: "🟠",
    color: "#fb923c",
    logoClass: "logo-cloudflare",
    headers: ["cf-ray", "cf-cache-status", "cf-request-id", "cf-connecting-ip", "cf-ipcountry"],
    cookies: ["__cflb", "__cfduid", "cf_clearance", "__cf_bm", "_cfuvid"],
    scripts: ["challenges.cloudflare.com", "/cdn-cgi/", "turnstile"],
    globals: ["_cf_chl_opt", "ChallengeRunnerApp"],
  },
  akamai: {
    name: "Akamai Bot Manager",
    emoji: "🔵",
    color: "#60a5fa",
    logoClass: "logo-akamai",
    headers: ["x-check-cacheable", "x-akamai-transformed", "x-akamai-request-id", "akamai-grn", "x-akamai-edgescape"],
    cookies: ["bm_sz", "_abck", "ak_bmsc", "bm_mi", "bm_s", "bm_sv"],
    scripts: ["akam/", "akadns.net", "akamai.com", "bmak"],
    globals: ["bmak", "akamaiAA", "bm_sz", "sensor_data"],
  },
  datadome: {
    name: "DataDome",
    emoji: "🟣",
    color: "#a78bfa",
    logoClass: "logo-datadome",
    headers: ["x-datadome-request", "x-dd-b"],
    cookies: ["datadome", "_dd", "dd_cookie_test"],
    scripts: ["datadome.co", "dd.js", "tags.datadome.co"],
    globals: ["DataDome", "_dd", "ddCaptcha"],
  },
  perimeterx: {
    name: "PerimeterX / HUMAN",
    emoji: "🟡",
    color: "#fbbf24",
    logoClass: "logo-perimeterx",
    headers: ["x-px-enforcer-telemetry", "x-px-block-score"],
    cookies: ["_px", "_px2", "_px3", "_pxvid", "pxcts", "_pxde"],
    scripts: ["client.px-cloud.net", "captcha.px-cdn.net", "_pxAppId"],
    globals: ["px", "_pxAppId", "PerimeterX", "PXReenforcement", "fngrprtd"],
  },
  recaptcha: {
    name: "Google reCAPTCHA",
    emoji: "🟢",
    color: "#64dcb4",
    logoClass: "logo-recaptcha",
    headers: [],
    cookies: ["_grecaptcha", "NID"],
    scripts: ["google.com/recaptcha", "gstatic.com/recaptcha", "recaptcha/api.js"],
    globals: ["_grecaptcha", "grecaptcha"],
  },
  incapsula: {
    name: "Imperva Incapsula",
    emoji: "🔴",
    color: "#f87171",
    logoClass: "logo-incapsula",
    headers: ["x-iinfo", "x-cdn"],
    cookies: ["incap_ses", "visid_incap", "nlbi_"],
    scripts: ["incapsula.com", "imperva.com"],
    globals: ["incap_ses", "visid_incap"],
  },
};

// ── App State ──
let currentTab = null;
let settings = { provider: "gemini", apiKey: "", endpoint: "", localModel: "" };
let expandedCards = new Set();

// ── Init ──
document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  document.getElementById("current-url").textContent =
    tab.url.replace(/^https?:\/\//, "").slice(0, 50);

  const stored = await browser.storage.local.get("settings");
  if (stored.settings) settings = { ...settings, ...stored.settings };

  if (!checkConfig()) {
    showPanel("setup-panel");
    renderSetup();
  } else {
    showPanel("main-content");
    showState("idle");
    renderProviderBadge();
  }

  bindEvents();
});

function checkConfig() {
  const m = MODELS[settings.provider];
  if (!m) return false;
  if (m.needsKey && !settings.apiKey) return false;
  if (m.needsEndpoint && !settings.endpoint) return false;
  // local model only required for hf/ollama, not flask
  if ((m.id === "hf" || m.id === "ollama") && !settings.localModel) return false;
  return true;
}

// ── Setup Panel ──
function renderSetup() {
  const container = document.getElementById("setup-content");
  const m = MODELS[settings.provider || "gemini"];
  const suggestions = LOCAL_MODELS[m.id] || [];
  const currentLocalModel = settings.localModel || "";
  const isCustomModel = currentLocalModel && !suggestions.find((s) => s.id === currentLocalModel);

  container.innerHTML = `
    <div class="setup-header">
      <div class="setup-icon">🛡️</div>
      <h2>Bot Shield Detector</h2>
      <p class="setup-subtitle">Choose an AI provider to power the analysis.</p>
    </div>

    <div class="model-tabs">
      ${Object.values(MODELS).map((mod) => `
        <button class="model-tab ${settings.provider === mod.id ? "active" : ""}" data-provider="${mod.id}">
          <span class="tab-emoji">${mod.emoji}</span>
          <div class="tab-text">
            <span class="tab-name">${mod.label}</span>
            <span class="tab-provider">${mod.provider}</span>
          </div>
        </button>
      `).join("")}
    </div>

    <div class="setup-fields">
      ${m.needsEndpoint ? `
        <div class="field-group">
          <label class="field-label">${m.endpointLabel}</label>
          <input type="text" id="endpoint-input" class="field-input"
                 placeholder="${m.endpointPlaceholder}"
                 value="${settings.provider === m.id && settings.endpoint ? settings.endpoint : m.endpointDefault}" />
        </div>
      ` : ""}

      ${suggestions.length > 0 ? `
        <div class="field-group">
          <label class="field-label">Model</label>
          <select id="local-model-select" class="field-input field-select">
            <option value="">— select a model —</option>
            ${suggestions.map((s) => `
              <option value="${s.id}" ${currentLocalModel === s.id ? "selected" : ""}>${s.label}</option>
            `).join("")}
            <option value="__custom__" ${isCustomModel ? "selected" : ""}>Custom model ID...</option>
          </select>
          <input type="text" id="local-model-custom" class="field-input"
                 placeholder="e.g. mistral or mistralai/Mistral-7B-Instruct-v0.3"
                 style="margin-top:6px;display:${isCustomModel ? "block" : "none"}"
                 value="${isCustomModel ? currentLocalModel : ""}" />
        </div>
      ` : ""}

      ${(m.needsKey || m.id === "hf") ? `
        <div class="field-group">
          <label class="field-label">API Key${!m.needsKey ? " (optional)" : ""}</label>
          <input type="password" id="api-key-input" class="field-input"
                 placeholder="${m.keyPlaceholder}"
                 value="${settings.provider === m.id ? settings.apiKey || "" : ""}" />
        </div>
      ` : ""}

      <p class="field-hint">${m.keyHint}</p>
      <p id="setup-error" class="field-error" style="display:none"></p>
    </div>

    <button id="save-config-btn" class="btn-primary btn-full">Save & Start →</button>
  `;

  // Tab switching
  container.querySelectorAll(".model-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      settings.provider = btn.dataset.provider;
      renderSetup();
    });
  });

  // Custom model toggle
  const modelSelect = container.querySelector("#local-model-select");
  const modelCustom = container.querySelector("#local-model-custom");
  if (modelSelect && modelCustom) {
    modelSelect.addEventListener("change", () => {
      modelCustom.style.display = modelSelect.value === "__custom__" ? "block" : "none";
      if (modelSelect.value === "__custom__") modelCustom.focus();
    });
  }

  container.querySelector("#save-config-btn").addEventListener("click", saveConfig);
}

async function saveConfig() {
  const m = MODELS[settings.provider];
  const keyInput = document.getElementById("api-key-input");
  const endpointInput = document.getElementById("endpoint-input");
  const modelSelect = document.getElementById("local-model-select");
  const modelCustom = document.getElementById("local-model-custom");
  const errorEl = document.getElementById("setup-error");

  const showErr = (msg) => { errorEl.textContent = "⚠ " + msg; errorEl.style.display = "block"; };
  errorEl.style.display = "none";

  settings.apiKey = keyInput ? keyInput.value.trim() : settings.apiKey;
  settings.endpoint = endpointInput ? endpointInput.value.trim() : settings.endpoint;

  if (modelSelect) {
    settings.localModel = modelSelect.value === "__custom__"
      ? (modelCustom ? modelCustom.value.trim() : "")
      : modelSelect.value;
  }

  if (m.needsKey && !settings.apiKey) { showErr("API key is required for " + m.label); return; }
  if (m.id === "gemini" && settings.apiKey && !settings.apiKey.startsWith("AIza")) { showErr("Gemini key should start with AIza"); return; }
  if (m.needsEndpoint && !settings.endpoint) { showErr("Endpoint URL is required"); return; }
  if ((m.id === "hf" || m.id === "ollama") && !settings.localModel) { showErr("Please select or enter a model name"); return; }

  await browser.storage.local.set({ settings });
  showPanel("main-content");
  showState("idle");
  renderProviderBadge();
}

function renderProviderBadge() {
  const m = MODELS[settings.provider];
  const badge = document.getElementById("provider-badge");
  if (!badge || !m) return;

  if (settings.provider === "flask") {
    const endpoint = (settings.endpoint || "http://localhost:5000").replace(/\/$/, "");
    badge.textContent = `${m.emoji} Connecting to Flask...`;
    badge.style.color = m.color;
    fetch(`${endpoint}/health`).then(async (r) => {
      if (r.ok) {
        const info = await r.json();
        badge.textContent = `${m.emoji} Flask → ${info.model}`;
        badge.style.borderColor = "rgba(34,211,238,0.3)";
      } else {
        badge.textContent = `${m.emoji} Flask (offline ⚠)`;
        badge.style.color = "var(--red)";
      }
    }).catch(() => {
      badge.textContent = `${m.emoji} Flask (offline ⚠)`;
      badge.style.color = "var(--red)";
    });
  } else {
    badge.textContent = `${m.emoji} ${settings.localModel || m.label}`;
    badge.style.color = m.color;
  }
}

// ── Events ──
function bindEvents() {
  document.getElementById("analyze-btn")?.addEventListener("click", runAnalysis);
  document.getElementById("re-analyze-btn")?.addEventListener("click", runAnalysis);
  document.getElementById("retry-btn")?.addEventListener("click", runAnalysis);
  document.getElementById("scan-btn")?.addEventListener("click", runAnalysis);
  document.getElementById("settings-btn")?.addEventListener("click", () => {
    showPanel("setup-panel");
    renderSetup();
  });
}

// ── Analysis Pipeline ──
async function runAnalysis() {
  showPanel("main-content");
  showState("loading");
  setStep(0);

  try {
    const url = currentTab.url || "";
    if (url.startsWith("about:") || url.startsWith("moz-extension:") || url.startsWith("chrome:")) {
      throw new Error("Cannot analyze browser internal pages. Navigate to a website first.");
    }

    const bgResponse = await browser.runtime.sendMessage({ type: "GET_TAB_DATA", tabId: currentTab.id });
    const bgData = bgResponse?.data || {};

    let contentSignals = {};
    try {
      const cs = await browser.tabs.sendMessage(currentTab.id, { type: "GET_CONTENT_SIGNALS" });
      if (cs?.signals) contentSignals = cs.signals;
    } catch (e) {
      try {
        await browser.tabs.executeScript(currentTab.id, { file: "content.js" });
        await new Promise((r) => setTimeout(r, 300));
        const cs2 = await browser.tabs.sendMessage(currentTab.id, { type: "GET_CONTENT_SIGNALS" });
        if (cs2?.signals) contentSignals = cs2.signals;
      } catch (e2) {}
    }

    let cookies = [];
    try { cookies = await browser.cookies.getAll({ url }); } catch (e) {}

    setStep(1);

    const payload = buildPayload(bgData, contentSignals, cookies);
    const heuristics = runHeuristics(payload);
    const aiResult = await queryAI(payload, heuristics);

    setStep(2);
    await new Promise((r) => setTimeout(r, 350));
    renderResults(aiResult);
    showState("results");

  } catch (err) {
    console.error(err);
    document.getElementById("error-msg").textContent = err.message || "Analysis failed.";
    showState("error");
  }
}

// ── Payload & Heuristics ──
function buildPayload(bgData, contentSignals, cookies) {
  const responseHeaders = {};
  (bgData.responseHeaders || []).forEach((h) => { responseHeaders[h.name.toLowerCase()] = h.value; });
  const requestHeaders = {};
  (bgData.requestHeaders || []).forEach((h) => { requestHeaders[h.name.toLowerCase()] = h.value; });
  return {
    url: bgData.url || currentTab.url,
    statusCode: bgData.statusCode,
    responseHeaders, requestHeaders,
    cookies: cookies.map((c) => ({ name: c.name, domain: c.domain, httpOnly: c.httpOnly, secure: c.secure })),
    domCookies: contentSignals.cookies || [],
    scripts: contentSignals.scripts || [],
    windowGlobals: contentSignals.windowGlobals || [],
    localStorageKeys: contentSignals.localStorageKeys || [],
    htmlComments: contentSignals.htmlComments || [],
    inlineScripts: contentSignals.inlineScriptSnippets || [],
  };
}

function runHeuristics(payload) {
  const found = {};
  for (const [id, sig] of Object.entries(KNOWN_SIGNATURES)) {
    const signals = []; let score = 0;
    for (const h of sig.headers) {
      if (payload.responseHeaders[h]) { signals.push({ key: `header:${h}`, val: payload.responseHeaders[h].slice(0, 60) }); score += 30; }
    }
    for (const c of sig.cookies) {
      const match = payload.cookies.find((ck) => ck.name.startsWith(c));
      if (match) { signals.push({ key: `cookie:${match.name}`, val: match.domain }); score += 25; }
      const domMatch = payload.domCookies.find((dc) => dc.includes(c));
      if (domMatch && !match) { signals.push({ key: `dom-cookie`, val: domMatch.slice(0, 40) }); score += 20; }
    }
    for (const s of sig.scripts) {
      const hit = payload.scripts.find((sc) => sc.includes(s));
      if (hit) { signals.push({ key: `script`, val: hit.slice(0, 60) }); score += 35; }
    }
    for (const g of sig.globals) {
      if (payload.windowGlobals.includes(g)) { signals.push({ key: `global:${g}`, val: "present" }); score += 40; }
    }
    if (score > 0) found[id] = { score: Math.min(score, 100), signals };
  }
  return found;
}

// ── Shared Prompt ──
function buildPrompt(payload, heuristics) {
  const system = `You are a security analyst specializing in bot protection and anti-bot systems.
Analyze the given web page signals and identify what bot protection / WAF / anti-bot systems are in use.

Return ONLY valid JSON, no markdown, no explanation:
{
  "detections": [
    {
      "id": "cloudflare|akamai|datadome|perimeterx|recaptcha|incapsula|custom|unknown",
      "name": "Human-readable name",
      "confidence": 0-100,
      "type": "WAF|Bot Management|CAPTCHA|Rate Limiting|Fingerprinting|CDN|Unknown",
      "signals": [{"key": "signal type", "val": "value"}],
      "notes": "2-3 sentence technical explanation"
    }
  ],
  "summary": "One paragraph summary of bot protection posture",
  "overallRisk": "none|low|medium|high",
  "riskReason": "Brief reason"
}
Only include detections with confidence > 20. Sort descending. Empty array if nothing found.`;

  const user = `Analyze this page for bot protection:

URL: ${payload.url}
Status: ${payload.statusCode || "unknown"}

RESPONSE HEADERS:
${JSON.stringify(payload.responseHeaders, null, 2)}

COOKIES (${payload.cookies.length}):
${JSON.stringify(payload.cookies.slice(0, 30), null, 2)}

SCRIPTS:
${payload.scripts.slice(0, 20).join("\n")}

GLOBALS: ${JSON.stringify(payload.windowGlobals)}
LOCALSTORAGE: ${JSON.stringify(payload.localStorageKeys.slice(0, 20))}

INLINE SCRIPTS:
${payload.inlineScripts.slice(0, 5).join("\n---\n")}

HTML COMMENTS:
${payload.htmlComments.slice(0, 5).join("\n")}

HEURISTICS:
${JSON.stringify(heuristics, null, 2)}`;

  return { system, user };
}

// ── AI Dispatcher ──
async function queryAI(payload, heuristics) {
  const { system, user } = buildPrompt(payload, heuristics);
  if (settings.provider === "flask")  return queryFlask(payload, heuristics);
  if (settings.provider === "gemini") return queryGemini(system, user);
  if (settings.provider === "hf")     return queryHuggingFace(system, user);
  if (settings.provider === "ollama") return queryOllama(system, user);
  throw new Error("Unknown provider: " + settings.provider);
}

// ── Flask Service ──
async function queryFlask(payload, heuristics) {
  const endpoint = (settings.endpoint || "http://localhost:5000").replace(/\/$/, "");

  // Check service is up first
  let serviceInfo = null;
  try {
    const health = await fetch(`${endpoint}/health`, { method: "GET" });
    if (health.ok) serviceInfo = await health.json();
  } catch (e) {
    throw new Error(
      `Cannot reach Flask service at ${endpoint}\n\n` +
      `Start it with: python app.py\n(in the bot-shield-flask/ folder)`
    );
  }

  const res = await fetch(`${endpoint}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, heuristics }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e?.error || `Flask service error ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Flask service returned an error");

  // Annotate result with which model the server used
  if (serviceInfo) {
    data.result._serverProvider = serviceInfo.provider;
    data.result._serverModel = serviceInfo.model;
  }
  return data.result;
}

async function queryGemini(system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1500, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `Gemini error ${res.status}`); }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function queryHuggingFace(system, user) {
  const endpoint = (settings.endpoint || "http://localhost:8080").replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };
  if (settings.apiKey) headers["Authorization"] = `Bearer ${settings.apiKey}`;

  const res = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: settings.localModel,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: 1500,
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e?.error?.message || `HF TGI error ${res.status}`) + `\n\nIs TGI running at ${endpoint}?`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response from HuggingFace TGI");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Model did not return valid JSON. Try a larger/better model.");
  return JSON.parse(jsonMatch[0]);
}

async function queryOllama(system, user) {
  const endpoint = (settings.endpoint || "http://localhost:11434").replace(/\/$/, "");
  const res = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.localModel,
      stream: false,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      options: { temperature: 0.1, num_predict: 1500 },
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e?.error || `Ollama error ${res.status}`) + `\n\nIs Ollama running? Try: ollama serve`);
  }
  const data = await res.json();
  const text = data?.message?.content || "";
  if (!text) throw new Error("Empty response from Ollama");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Model did not return valid JSON. Try mistral or llama3.2.");
  return JSON.parse(jsonMatch[0]);
}

// ── Render Results ──
function renderResults(result) {
  const container = document.getElementById("results-container");
  container.innerHTML = "";
  const { detections = [], summary, overallRisk = "none" } = result;
  const m = MODELS[settings.provider];

  const header = document.createElement("div");
  header.className = "result-header";
  const modelLabel = result._serverModel
    ? `${m.emoji} Flask → ${result._serverModel}`
    : `${m.emoji} ${settings.localModel || m.label}`;
  header.innerHTML = `
    <span style="font-size:12px;font-weight:600;color:var(--text-muted)">
      ${detections.length} system${detections.length !== 1 ? "s" : ""} detected
      &nbsp;<span style="color:${m.color}">${modelLabel}</span>
    </span>
    <span class="risk-badge risk-${overallRisk}">${overallRisk.toUpperCase()}</span>
  `;
  container.appendChild(header);

  if (summary) {
    const s = document.createElement("div");
    s.className = "ai-summary";
    s.innerHTML = `
      <div class="ai-summary-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" stroke="currentColor" stroke-width="1.8"/>
          <path d="M12 8v4l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
        AI Analysis
      </div>
      <p>${escapeHtml(summary)}</p>`;
    container.appendChild(s);
  }

  if (detections.length === 0) {
    const none = document.createElement("div");
    none.className = "no-detection";
    none.innerHTML = `<div class="icon">✅</div><p>No known bot protection systems detected.</p>`;
    container.appendChild(none);
    return;
  }

  detections.forEach((det) => {
    const sig = KNOWN_SIGNATURES[det.id] || {};
    const card = document.createElement("div");
    card.className = "detection-card";
    const isOpen = expandedCards.has(det.id);
    const conf = det.confidence || 0;
    const confColor = conf >= 80 ? "var(--accent)" : conf >= 50 ? "var(--yellow)" : "var(--text-muted)";
    card.innerHTML = `
      <div class="card-header">
        <div class="card-logo ${sig.logoClass || "logo-unknown"}">${sig.emoji || "🛡️"}</div>
        <div class="card-info">
          <div class="card-name">${escapeHtml(det.name)}<span class="tag tag-detected">${escapeHtml(det.type || "BOT MGMT")}</span></div>
          <div class="confidence-bar-wrap">
            <div class="confidence-bar"><div class="confidence-fill" style="width:${conf}%;background:${confColor}"></div></div>
            <span class="confidence-label">${conf}%</span>
          </div>
        </div>
        <span class="card-toggle">${isOpen ? "▲" : "▼"}</span>
      </div>
      <div class="card-body ${isOpen ? "open" : ""}">
        <p>${escapeHtml(det.notes || "No additional details.")}</p>
        <div class="signals-list">
          ${(det.signals || []).slice(0, 8).map((s) => `
            <div class="signal-item">
              <span class="signal-key">${escapeHtml(s.key)}</span>
              <span class="signal-val">${escapeHtml(String(s.val).slice(0, 80))}</span>
            </div>`).join("")}
        </div>
      </div>`;
    card.querySelector(".card-header").addEventListener("click", () => {
      const body = card.querySelector(".card-body");
      const toggle = card.querySelector(".card-toggle");
      const open = body.classList.toggle("open");
      toggle.textContent = open ? "▲" : "▼";
      if (open) expandedCards.add(det.id); else expandedCards.delete(det.id);
    });
    container.appendChild(card);
  });
}

// ── UI Helpers ──
function showPanel(id) {
  ["setup-panel", "main-content"].forEach((p) => document.getElementById(p)?.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
}

function showState(state) {
  ["idle-state", "loading-state", "results-state", "error-state"].forEach((s) =>
    document.getElementById(s)?.classList.add("hidden"));
  document.getElementById(`${state}-state`)?.classList.remove("hidden");
}

function setStep(active) {
  const steps = ["step-collect", "step-analyze", "step-result"];
  const msgs = ["Collecting page signals...", `Querying ${MODELS[settings.provider]?.label || "AI"}...`, "Processing results..."];
  steps.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("active", "done");
    if (i < active) el.classList.add("done");
    else if (i === active) el.classList.add("active");
  });
  const msgEl = document.getElementById("loading-msg");
  if (msgEl) msgEl.textContent = msgs[active] || "";
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.getElementById('export-btn').addEventListener('click', () => {
    const resultJSON = JSON.stringify(currentResults, null, 2);
    navigator.clipboard.writeText(resultJSON)
        .then(() => alert('Results copied to clipboard!'))
        .catch(err => console.error('Failed to copy: ', err));
});
