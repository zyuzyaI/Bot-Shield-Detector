// background.js - Intercepts network requests and stores headers per tab

const tabData = {};

// Listen for response headers
browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== "main_frame") return;

    const tabId = details.tabId;
    if (tabId < 0) return;

    if (!tabData[tabId]) {
      tabData[tabId] = { responseHeaders: [], url: details.url, timestamp: Date.now() };
    }

    tabData[tabId].responseHeaders = details.responseHeaders || [];
    tabData[tabId].url = details.url;
    tabData[tabId].timestamp = Date.now();
    tabData[tabId].statusCode = details.statusCode;
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["responseHeaders"]
);

// Listen for request headers (what we send)
browser.webRequest.onSendHeaders.addListener(
  (details) => {
    if (details.type !== "main_frame") return;
    const tabId = details.tabId;
    if (tabId < 0) return;

    if (!tabData[tabId]) {
      tabData[tabId] = { responseHeaders: [], url: details.url, timestamp: Date.now() };
    }

    tabData[tabId].requestHeaders = details.requestHeaders || [];
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["requestHeaders"]
);

// Clean up when tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  delete tabData[tabId];
});

// Message handler for popup requests
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_TAB_DATA") {
    const { tabId } = message;
    sendResponse({ data: tabData[tabId] || null });
  }

  if (message.type === "SET_CONTENT_DATA") {
    const { tabId, contentData } = message;
    if (!tabData[tabId]) tabData[tabId] = {};
    tabData[tabId].contentData = contentData;
    sendResponse({ ok: true });
  }

  return true;
});
