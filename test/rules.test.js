const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

globalThis.CampusShieldSchools = {};
eval(fs.readFileSync(path.join(__dirname, "..", "src/core/schools.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "..", "src/core/rules.js"), "utf8"));

const S = globalThis.CampusShieldSchools;
const R = globalThis.CampusShieldRules;
const jnuConfig = { selectedSchool: "jnu", customDomains: [] };

test("selected school and custom domains define the trusted boundary", () => {
  assert.deepEqual(S.allTrustedDomains({ selectedSchool: "jnu", customDomains: ["https://portal.example.edu.cn/login", "portal.example.edu.cn"] }), ["sysu.edu.cn", "scut.edu.cn", "jnu.edu.cn", "scnu.edu.cn", "portal.example.edu.cn"]);
  assert.equal(S.isDomainOrSubdomain("login.jnu.edu.cn", "jnu.edu.cn"), true);
  assert.equal(S.isDomainOrSubdomain("jnu.edu.cn.example.com", "jnu.edu.cn"), false);
  assert.equal(S.normalizeDomain("https://WWW.JNU.EDU.CN/path"), "jnu.edu.cn");
  assert.equal(S.normalizeDomain("not a domain"), "");
});

test("ordinary pages are not treated as campus pages", () => {
  const result = R.analyzePage({ url: "http://localhost:8080/normal.html", title: "普通示例页面", text: "这是一个普通页面。", forms: [] }, jnuConfig);
  assert.equal(result.level, "irrelevant");
  assert.equal(result.blocking, false);
});

test("cross-origin campus password forms are blocked", () => {
  const result = R.analyzePage({
    url: "http://localhost:8080/campus-login.html",
    title: "暨南大学统一身份认证",
    text: "校园登录页跨域提交密码",
    forms: [{ action: "https://collector.example.test/submit", actionOrigin: "https://collector.example.test", pageOrigin: "http://localhost:8080", passwordCount: 1 }]
  }, jnuConfig);
  assert.equal(result.level, "high");
  assert.equal(result.blocking, true);
  assert.equal(result.signals.crossOriginForms, 1);
});

test("same-origin sensitive campus pages require attention without blocking", () => {
  const result = R.analyzePage({
    url: "http://localhost:8080/sensitive-same-origin.html",
    title: "校园缴费演示",
    text: "页面要求银行卡号和验证码，但表单仍提交到当前站点",
    forms: [{ action: "http://localhost:8080/pay", actionOrigin: "http://localhost:8080", pageOrigin: "http://localhost:8080", passwordCount: 0 }]
  }, jnuConfig);
  assert.equal(result.level, "attention");
  assert.ok(result.score >= 30 && result.score < 70);
  assert.equal(result.blocking, false);
});

test("lookalike campus domains are detected on the root and subdomain", () => {
  const root = R.analyzeUrl("https://jnnu.edu.cn/login", jnuConfig);
  const subdomain = R.analyzeUrl("https://login.jnnu.edu.cn/login", jnuConfig);
  const unrelated = R.analyzeUrl("https://jnnu.com/login", jnuConfig);
  assert.equal(root.possibleSpoof, true);
  assert.equal(subdomain.possibleSpoof, true);
  assert.equal(unrelated.possibleSpoof, false);
});

test("malformed URLs are treated as blocking failures", () => {
  const result = R.analyzeUrl("not a valid url", jnuConfig);
  assert.equal(result.level, "high");
  assert.equal(result.blocking, true);
  assert.equal(result.score, 100);
});
