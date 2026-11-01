const DEFAULT_STATE = { selectedSchool: "jnu", customDomains: [], enabled: true, feedbackEndpoint: "" };

chrome.runtime.onInstalled.addListener(() => chrome.storage.sync.get(DEFAULT_STATE, (current) => chrome.storage.sync.set({ ...DEFAULT_STATE, ...current })));

function badgeFor(level) {
  if (level === "high") return { text: "高", color: "#c43d35" };
  if (level === "attention") return { text: "注", color: "#b87918" };
  if (level === "irrelevant") return { text: "—", color: "#8a9b92" };
  return { text: "✓", color: "#087f52" };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "scan-result" && sender.tab?.id !== undefined) {
    const tabId = String(sender.tab.id);
    const badge = badgeFor(message.result.level);
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: badge.text });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: badge.color });
    const title = message.result.level === "high" ? "高风险" : message.result.level === "attention" ? "需要注意" : message.result.level === "irrelevant" ? "与校园无关" : "低风险";
    chrome.action.setTitle({ tabId: sender.tab.id, title: `暨南护航：${title}${message.result.level === "irrelevant" ? "" : ` · ${message.result.score}`}` });
    chrome.storage.local.get({ scanResults: {} }, (data) => chrome.storage.local.set({ scanResults: { ...data.scanResults, [tabId]: message.result } }));
  }
  if (message.type === "report-feedback") {
    chrome.storage.sync.get({ feedbackEndpoint: "" }, async ({ feedbackEndpoint }) => {
      const payload = { ...message.feedback, createdAt: new Date().toISOString() };
      if (feedbackEndpoint) {
        try { await fetch(feedbackEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); sendResponse({ ok: true, mode: "remote" }); return; } catch (_) { /* queue below */ }
      }
      chrome.storage.local.get({ feedbackQueue: [] }, (data) => chrome.storage.local.set({ feedbackQueue: [...data.feedbackQueue, payload] }));
      sendResponse({ ok: true, mode: "local-queue" });
    });
    return true;
  }
  if (message.type === "get-current-state") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      chrome.storage.local.get({ scanResults: {} }, (data) => sendResponse({ result: tabId !== undefined ? data.scanResults[String(tabId)] : null, tab: tabs[0] }));
    });
    return true;
  }
});
