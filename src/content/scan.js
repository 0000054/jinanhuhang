(function () {
  let latestResult;
  let overlay;
  let riskPill;

  function getConfig() {
    return new Promise((resolve) => chrome.storage.sync.get({ selectedSchool: "jnu", customDomains: [], enabled: true }, resolve));
  }

  function collectForms() {
    return [...document.forms].map((form) => {
      let action = form.getAttribute("action") || location.href;
      try { action = new URL(action, location.href).href; } catch (_) { /* retain raw */ }
      let actionOrigin = ""; try { actionOrigin = new URL(action, location.href).origin; } catch (_) { /* ignore */ }
      return { action, actionOrigin, pageOrigin: location.origin, passwordCount: form.querySelectorAll('input[type="password"]').length };
    });
  }

  function collectInput() {
    return { url: location.href, title: document.title, text: (document.body?.innerText || "").slice(0, 8000), forms: collectForms() };
  }

  function send(result) {
    latestResult = result;
    chrome.runtime.sendMessage({ type: "scan-result", result });
  }

  function removeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }

  function renderRiskPill(result) {
    if (riskPill) riskPill.remove();
    riskPill = document.createElement("div");
    riskPill.id = "campus-shield-risk-pill";
    riskPill.attachShadow({ mode: "open" });
    const tone = result.level === "high" ? "high" : result.level === "attention" ? "attention" : result.level === "irrelevant" ? "irrelevant" : "safe";
    const label = result.level === "high" ? "高风险" : result.level === "attention" ? "需要注意" : result.level === "irrelevant" ? "与校园无关" : "低风险";
    riskPill.shadowRoot.innerHTML = `<style>
      :host{all:initial;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .pill{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid #c9e4d4;border-radius:999px;background:#fff;box-shadow:0 8px 24px rgba(15,58,39,.18);color:#14352a;font:700 12px/1 system-ui,sans-serif}
      .dot{width:9px;height:9px;border-radius:50%;background:#198754}.high{border-color:#efc4bf;color:#963c34}.high .dot{background:#c43d35}.attention{border-color:#edd8aa;color:#916319}.attention .dot{background:#b87918}.irrelevant{border-color:#dce6e0;color:#6a8277}.irrelevant .dot{background:#8a9b92}.score{font-weight:500;color:#6a8277}
    </style><div class="pill ${tone}" role="status" aria-live="polite"><span class="dot"></span><span>${label}</span><span class="score">· ${result.score}</span></div>`;
    document.documentElement.appendChild(riskPill);
  }

  function showOverlay(result) {
    if (overlay || sessionStorage.getItem("campusShieldAllowOnce") === "1") return;
    overlay = document.createElement("div");
    overlay.id = "campus-shield-overlay";
    overlay.attachShadow({ mode: "open" });
    overlay.shadowRoot.innerHTML = `<style>
      :host{all:initial;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .veil{position:fixed;inset:0;background:rgba(9,36,27,.84);z-index:2147483647;display:grid;place-items:center;padding:24px}
      .card{max-width:480px;background:#fff;border-radius:20px;padding:30px;color:#14352a;box-shadow:0 24px 80px rgba(0,0,0,.28)}
      .mark{width:42px;height:42px;border-radius:14px;background:#087f52;color:#fff;display:grid;place-items:center;font-weight:800;font-size:18px;margin-bottom:22px}
      h1{font-size:22px;margin:0 0 10px;letter-spacing:-.02em}p{font-size:14px;line-height:1.65;color:#557167;margin:0 0 18px}
      ul{padding:0 0 0 18px;color:#274e3e;font-size:13px;line-height:1.8}.actions{display:flex;gap:10px;margin-top:24px}
      button{border:0;border-radius:10px;padding:11px 16px;font:600 13px inherit;cursor:pointer}.primary{background:#087f52;color:#fff}.ghost{background:#edf5f1;color:#276047}
    </style><div class="veil"><section class="card" role="alertdialog" aria-labelledby="title"><div class="mark">盾</div><h1 id="title">请先确认这个页面</h1><p>暨南护航发现当前页面可能仿冒校园服务，已暂时遮挡页面，避免误填敏感信息。</p><ul>${result.reasons.slice(0, 4).map((reason) => `<li>${reason}</li>`).join("")}</ul><div class="actions"><button class="primary" id="back">返回安全页面</button><button class="ghost" id="continue">我了解风险，继续访问</button></div></section></div>`;
    document.documentElement.appendChild(overlay);
    overlay.shadowRoot.getElementById("continue").onclick = () => { sessionStorage.setItem("campusShieldAllowOnce", "1"); removeOverlay(); };
    overlay.shadowRoot.getElementById("back").onclick = () => history.back();
  }

  async function scan() {
    const config = await getConfig();
    if (!config.enabled) return;
    const result = CampusShieldRules.analyzePage(collectInput(), config);
    send(result);
    if (result.blocking) showOverlay(result);
    renderRiskPill(result);
  }

  function watchSensitiveLinks() {
    document.addEventListener("click", (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor) return;
      let target; try { target = new URL(anchor.href, location.href); } catch (_) { return; }
      const result = CampusShieldRules.analyzeUrl(target.href, latestResult || {});
      if (result.possibleSpoof && !sessionStorage.getItem("campusShieldAllowOnce")) {
        event.preventDefault();
        showOverlay({ ...result, reasons: result.reasons.length ? result.reasons : ["链接与可信校园域名相似"] });
        renderRiskPill({ ...result, level: "high", score: Math.max(result.score || 0, 90) });
      }
    }, true);
  }

  scan();
  watchSensitiveLinks();
})();
