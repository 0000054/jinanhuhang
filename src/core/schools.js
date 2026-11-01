(function (global) {
  const DEFAULT_SCHOOLS = [
    { id: "sysu", name: "中山大学", domain: "sysu.edu.cn" },
    { id: "scut", name: "华南理工大学", domain: "scut.edu.cn" },
    { id: "jnu", name: "暨南大学", domain: "jnu.edu.cn" },
    { id: "scnu", name: "华南师范大学", domain: "scnu.edu.cn" }
  ];

  function normalizeDomain(value) {
    const domain = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .replace(/\.$/, "");
    return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ? domain : "";
  }

  function isDomainOrSubdomain(hostname, domain) {
    const host = normalizeDomain(hostname);
    const root = normalizeDomain(domain);
    return Boolean(root) && (host === root || host.endsWith(`.${root}`));
  }

  function allTrustedDomains(config) {
    const defaults = DEFAULT_SCHOOLS.map((school) => school.domain);
    return [...new Set(defaults.concat(config?.customDomains || []).map(normalizeDomain).filter(Boolean))];
  }

  global.CampusShieldSchools = { DEFAULT_SCHOOLS, normalizeDomain, isDomainOrSubdomain, allTrustedDomains };
})(globalThis);
