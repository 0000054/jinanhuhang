(function (global) {
  const S = global.CampusShieldSchools;
  const CAMPUS_TERMS = ["教务", "统一身份", "校园", "学生", "学工", "邮箱", "奖学金", "招聘", "选课", "缴费", "成绩", "教务处", "login", "sso", "portal"];
  const CAMPUS_PAGE_TERMS = ["教务", "统一身份", "校园", "学生", "学工", "校园邮箱", "校园招聘", "奖学金", "校园缴费", "选课", "成绩", "教务处"];
  const SENSITIVE_TERMS = ["密码", "验证码", "支付", "银行卡", "身份证", "password", "captcha", "credit", "card"];

  function hasIpHost(hostname) {
    return /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(hostname) || /^0x[\da-f]+(?:\.0x[\da-f]+){3}$/i.test(hostname);
  }

  function levenshtein(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  }

  function tokenize(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").split(/\s+/).filter(Boolean);
  }

  function analyzeUrl(rawUrl, config = {}) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (_) { return { level: "high", score: 100, reasons: ["链接格式无法解析"], blocking: true }; }
    const hostname = parsed.hostname.toLowerCase();
    const trustedDomains = S.allTrustedDomains(config);
    const trusted = trustedDomains.some((domain) => S.isDomainOrSubdomain(hostname, domain));
    const reasons = [];
    let score = 0;
    const suspiciousTokens = /(verify|secure|signin|login|account|update|campus|jnu|sysu|scut|scnu|edu)/i.test(hostname);
    if (parsed.protocol !== "https:") { score += 18; reasons.push("页面未使用 HTTPS"); }
    if (hasIpHost(hostname)) { score += 42; reasons.push("使用 IP 地址访问，缺少稳定域名"); }
    if (hostname.includes("xn--")) { score += 36; reasons.push("域名含有国际化编码，可能隐藏相似字符"); }
    if (/@/.test(parsed.href)) { score += 36; reasons.push("链接包含 @ 符号，可能造成视觉误导"); }
    if (hostname.includes("-")) { score += 8; reasons.push("域名包含连接符，需核对官方入口"); }
    if (hostname.split(".").length > 4) { score += 10; reasons.push("子域层级较多"); }
    if (parsed.href.length > 100) { score += 12; reasons.push("链接较长，包含较多跳转参数"); }
    if (suspiciousTokens && !trusted) { score += 18; reasons.push("域名包含校园或登录相关词，但不在可信域名名单中"); }
    const possibleSpoof = !trusted && trustedDomains.some((domain) => {
      const base = domain.split(".")[0];
      const hostBase = hostname.split(".").slice(-3, -2)[0] || hostname.split(".")[0];
      const hostSuffix = hostname.split(".").slice(-2).join(".");
      const trustedSuffix = domain.split(".").slice(-2).join(".");
      return hostSuffix === trustedSuffix && hostBase && hostBase.length >= 3 && Math.abs(hostBase.length - base.length) <= 1 && levenshtein(hostBase, base) <= 2 && hostBase !== base;
    });
    if (possibleSpoof) { score = Math.max(score, 90); reasons.unshift("域名与已配置的校园官方域名高度相似"); }
    return { hostname, trusted, score: Math.min(100, score), reasons, possibleSpoof, parsed: { protocol: parsed.protocol, href: parsed.href } };
  }

  function analyzePage(input, config = {}) {
    const urlResult = analyzeUrl(input.url, config);
    const text = `${input.title || ""} ${input.text || ""}`.toLowerCase();
    const campusMatches = CAMPUS_TERMS.filter((term) => text.includes(term.toLowerCase()));
    const pageContext = `${input.title || ""} ${urlResult.hostname}`.toLowerCase();
    const pageCampusMatches = CAMPUS_PAGE_TERMS.filter((term) => pageContext.includes(term.toLowerCase()));
    const forms = input.forms || [];
    const passwordForms = forms.filter((form) => form.passwordCount > 0);
    const sensitive = SENSITIVE_TERMS.some((term) => text.includes(term.toLowerCase())) || passwordForms.length > 0;
    const campusRelated = urlResult.trusted || pageCampusMatches.length > 0 || (campusMatches.length > 0 && sensitive && passwordForms.length > 0);
    if (!campusRelated) {
      return {
        url: input.url, hostname: urlResult.hostname, title: input.title || "", level: "irrelevant",
        score: 0, campusRelated: false, trusted: urlResult.trusted, sensitive: false, blocking: false,
        reasons: ["未检测到校园服务相关特征，不进行校园风险拦截"], checkedAt: new Date().toISOString(),
        signals: { campusMatches: [], passwordForms: 0, crossOriginForms: 0, mailtoForms: 0 }
      };
    }
    let score = urlResult.score;
    const reasons = [...urlResult.reasons];
    let crossOriginForms = 0;
    let mailtoForms = 0;
    forms.forEach((form) => {
      if (form.actionOrigin && form.actionOrigin !== form.pageOrigin) crossOriginForms += 1;
      if (String(form.action || "").startsWith("mailto:")) mailtoForms += 1;
    });
    if (passwordForms.length) { score += 10; reasons.push(`发现 ${passwordForms.length} 个密码输入区域`); }
    if (crossOriginForms) { score += 30; reasons.push("登录表单提交到不同域名"); }
    if (mailtoForms) { score += 35; reasons.push("表单尝试通过 mailto 提交"); }
    if (sensitive && !urlResult.trusted) { score += 18; reasons.push("页面可能要求输入敏感信息，但当前域名未被验证"); }
    const blocking = Boolean((urlResult.possibleSpoof && (campusRelated || sensitive)) || (campusRelated && sensitive && crossOriginForms > 0 && score >= 70));
    const level = score >= 70 ? "high" : score >= 30 ? "attention" : "safe";
    return {
      url: input.url, hostname: urlResult.hostname, title: input.title || "", level,
      score: Math.min(100, score), campusRelated, trusted: urlResult.trusted, sensitive,
      blocking, reasons: reasons.length ? [...new Set(reasons)] : ["暂未发现明显风险信号"],
      checkedAt: new Date().toISOString(), signals: { campusMatches, passwordForms: passwordForms.length, crossOriginForms, mailtoForms }
    };
  }

  global.CampusShieldRules = { analyzeUrl, analyzePage, CAMPUS_TERMS, SENSITIVE_TERMS };
})(globalThis);
