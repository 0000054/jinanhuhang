const $ = (id) => document.getElementById(id);
const labels = { safe: "低风险", attention: "需要注意", high: "高风险", irrelevant: "与校园无关" };
const statusCard = $("status-card");

function render(result, tab) {
  if (!result) { $("level").textContent = "等待页面检测"; $("summary").textContent = tab?.url || "当前标签页暂无结果"; return; }
  statusCard.className = `status-card ${result.level}`;
  $("level").textContent = labels[result.level];
  $("score").textContent = result.level === "irrelevant" ? "—" : `${result.score}`;
  $("summary").textContent = result.hostname || result.url;
  $("checked-at").textContent = result.checkedAt ? new Date(result.checkedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "刚刚";
  $("reasons").innerHTML = result.reasons.map((reason) => `<li>${reason}</li>`).join("");
}

chrome.runtime.sendMessage({ type: "get-current-state" }, (response) => {
  if (chrome.runtime.lastError) return;
  render(response?.result, response?.tab);
  chrome.storage.sync.get({ selectedSchool: "jnu" }, ({ selectedSchool }) => {
    const names = { sysu: "中山大学", scut: "华南理工大学", jnu: "暨南大学", scnu: "华南师范大学" };
    $("school").textContent = names[selectedSchool] || "自定义学校";
  });
});

$("settings").onclick = () => chrome.runtime.openOptionsPage();
$("options-link").onclick = (event) => { event.preventDefault(); chrome.runtime.openOptionsPage(); };
$("report").onclick = () => {
  chrome.runtime.sendMessage({ type: "get-current-state" }, (response) => {
    chrome.runtime.sendMessage({ type: "report-feedback", feedback: { url: response?.result?.url || response?.tab?.url || "", reason: "用户报告误判", result: response?.result || null } }, (ack) => {
      $("report-status").textContent = ack?.mode === "remote" ? "已提交" : "已保存，待同步";
    });
  });
};
