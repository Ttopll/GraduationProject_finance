let token = "";
let latestSummary = null;
let latestImport = null;
let memberships = [];

function byId(id) {
  return document.getElementById(id);
}

async function api(path, method = "GET", body = null, auth = true) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function renderMetric(id, value) {
  byId(id).textContent = value ?? "-";
}

function renderCountryList(items) {
  const host = byId("countryList");
  if (!items || items.length === 0) {
    host.innerHTML = '<div class="summary-item">暂无国家分布数据</div>';
    return;
  }
  host.innerHTML = items.map((item, index) => `
    <div class="country-item">
      <div>
        <div class="country-rank">TOP ${index + 1}</div>
        <div class="country-name">${item.country ?? "-"}</div>
      </div>
      <div class="country-amount">${item.totalAmount ?? "-"}</div>
    </div>
  `).join("");
}

function renderWorldBank(worldBankTrend) {
  const host = byId("worldBankSummary");
  const points = worldBankTrend?.points || [];
  if (points.length === 0) {
    host.innerHTML = '<div class="summary-item">暂无国家趋势数据</div>';
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  host.innerHTML = `
    <div class="summary-item">国家：${worldBankTrend.countryName ?? "-"} (${worldBankTrend.countryIso3 ?? "-"})</div>
    <div class="summary-item">起始年份：${first.year ?? "-"}，起始值：${first.value ?? "-"}</div>
    <div class="summary-item">最新年份：${last.year ?? "-"}，最新值：${last.value ?? "-"}</div>
    <div class="summary-item">最新同比：${last.yearOnYearGrowthRatio ?? "-"}</div>
  `;
}

function renderFred(fredSeries) {
  const host = byId("fredSummary");
  const points = fredSeries?.points || [];
  if (points.length === 0) {
    host.innerHTML = `<div class="summary-item">${fredSeries?.seriesId ?? "PCE"} 当前无数据点，可按软降级处理。</div>`;
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  host.innerHTML = `
    <div class="summary-item">序列：${fredSeries.seriesId ?? "-"}</div>
    <div class="summary-item">首点：${first.date ?? "-"} / ${first.value ?? "-"}</div>
    <div class="summary-item">末点：${last.date ?? "-"} / ${last.value ?? "-"}</div>
    <div class="summary-item">数据点数：${points.length}</div>
  `;
}

function renderConclusions(conclusions) {
  const host = byId("conclusionList");
  if (!conclusions || conclusions.length === 0) {
    host.innerHTML = '<div class="conclusion-item">暂无自动结论</div>';
    return;
  }
  host.innerHTML = conclusions.map((item, index) => `
    <div class="conclusion-item">${index + 1}. ${item}</div>
  `).join("");
}

function renderRaw(payload) {
  byId("rawPayload").textContent = JSON.stringify(payload, null, 2);
}

function renderLatestImport(result) {
  const host = byId("latestImportResult");
  if (!result) {
    host.innerHTML = '<div class="summary-item">暂无导入结果</div>';
    return;
  }
  host.innerHTML = `
    <div class="summary-item">处理目录：${result.processedDir ?? "-"}</div>
    <div class="summary-item">retailImported：${result.retailImported ?? 0}</div>
    <div class="summary-item">worldBankImported：${result.worldBankImported ?? 0}</div>
    <div class="summary-item">fredImported：${result.fredImported ?? 0}</div>
  `;
}

function getCurrentFamilyId() {
  return Number(byId("familySelect").value || 0);
}

function getCurrentMemberId() {
  return Number(byId("memberSelect").value || 0);
}

function renderMemberships(items) {
  memberships = items || [];
  const familySelect = byId("familySelect");

  if (memberships.length === 0) {
    familySelect.innerHTML = '<option value="">无家庭</option>';
    updateMemberOptions();
    return;
  }

  familySelect.innerHTML = memberships.map((item, index) => `
    <option value="${item.familyId}" ${index === 0 ? "selected" : ""}>
      ${item.familyName || `家庭${item.familyId}`}
    </option>
  `).join("");

  updateMemberOptions();
}

function updateMemberOptions() {
  const memberSelect = byId("memberSelect");
  const currentFamilyId = getCurrentFamilyId();
  const filtered = memberships.filter((item) => Number(item.familyId) === currentFamilyId);
  if (filtered.length === 0) {
    memberSelect.innerHTML = '<option value="">无成员</option>';
    return;
  }
  memberSelect.innerHTML = filtered.map((item, index) => `
    <option value="${item.familyMemberId}" ${index === 0 ? "selected" : ""}>
      ${item.roleCode || "MEMBER"} / ${item.familyMemberId}
    </option>
  `).join("");
}

function renderRules(items) {
  const host = byId("rulesList");
  if (!items || items.length === 0) {
    host.innerHTML = '<div class="summary-item">当前家庭暂无规则</div>';
    return;
  }
  host.innerHTML = items.map((item) => `
    <div class="summary-item">
      <strong>${item.ruleName ?? "-"}</strong><br>
      类型：${item.ruleType ?? "-"} / 启用：${item.enabled ?? "-"} / 优先级：${item.priority ?? "-"}
    </div>
  `).join("");
}

function renderNotifications(items) {
  const host = byId("notificationsList");
  if (!items || items.length === 0) {
    host.innerHTML = '<div class="summary-item">当前家庭暂无通知</div>';
    return;
  }
  host.innerHTML = items.slice(0, 8).map((item) => `
    <div class="summary-item">
      <strong>${item.title ?? "-"}</strong><br>
      来源：${item.sourceType ?? "-"} / 已读：${item.readStatus ?? "-"}
    </div>
  `).join("");
}

function renderSummary(summary) {
  latestSummary = summary;
  renderMetric("metricTotalRecords", summary?.retailOverview?.totalRecords ?? "-");
  renderMetric("metricTotalAmount", summary?.retailOverview?.totalAmount ?? "-");
  renderMetric("metricWorldBankPoints", summary?.worldBankTrend?.points?.length ?? 0);
  renderMetric("metricFredPoints", summary?.fredSeries?.points?.length ?? 0);
  renderCountryList(summary?.retailOverview?.topCountries || []);
  renderWorldBank(summary?.worldBankTrend);
  renderFred(summary?.fredSeries);
  renderConclusions(summary?.conclusions || []);
  renderRaw(summary);
}

async function login() {
  const username = byId("username").value.trim();
  const password = byId("password").value;
  try {
    const result = await api("/api/auth/login", "POST", { username, password }, false);
    token = result.accessToken || "";
    byId("loginStatus").textContent = token ? `已登录：${result.user?.username ?? "-"}` : "登录失败";
    renderMemberships(result.memberships || []);
  } catch (error) {
    byId("loginStatus").textContent = `登录失败：${error.message}`;
  }
}

async function importData() {
  byId("importStatus").textContent = "正在导入真实数据...";
  byId("importStatusMirror").textContent = "正在导入真实数据...";
  try {
    const result = await api("/api/real-data-analysis/import?processedDir=data/processed&truncateBeforeImport=true&batchSize=5000", "POST");
    latestImport = result;
    byId("importStatus").textContent = `导入完成：retail=${result.retailImported}, worldBank=${result.worldBankImported}, fred=${result.fredImported}`;
    byId("importStatusMirror").textContent = byId("importStatus").textContent;
    renderLatestImport(result);
    renderRaw(result);
    return result;
  } catch (error) {
    byId("importStatus").textContent = `导入失败：${error.message}`;
    byId("importStatusMirror").textContent = byId("importStatus").textContent;
    throw error;
  }
}

async function loadDefenseSummary() {
  const iso3 = (byId("countryIso3").value || "CHN").trim().toUpperCase();
  const seriesId = (byId("seriesId").value || "PCE").trim().toUpperCase();
  byId("importStatus").textContent = "正在加载汇总...";
  try {
    const summary = await api(`/api/real-data-analysis/defense-summary?countryIso3=${iso3}&seriesId=${seriesId}&topCountries=10`, "GET");
    renderSummary(summary);
    byId("importStatus").textContent = "汇总加载完成";
    return summary;
  } catch (error) {
    byId("importStatus").textContent = `汇总加载失败：${error.message}`;
    throw error;
  }
}

async function runAcceptance() {
  byId("importStatus").textContent = "正在执行一键验收...";
  byId("importStatusMirror").textContent = "正在执行一键验收...";
  try {
    await importData();
    await loadDefenseSummary();
    byId("importStatus").textContent = "一键验收完成";
    byId("importStatusMirror").textContent = "一键验收完成";
  } catch (error) {
    byId("importStatus").textContent = `一键验收失败：${error.message}`;
    byId("importStatusMirror").textContent = byId("importStatus").textContent;
  }
}

async function loadRules() {
  const familyId = getCurrentFamilyId();
  if (!familyId) {
    byId("rulesStatus").textContent = "请先登录并选择家庭";
    return;
  }
  byId("rulesStatus").textContent = "正在加载规则...";
  try {
    const items = await api(`/api/rules?familyId=${familyId}`, "GET");
    renderRules(items);
    byId("rulesStatus").textContent = `规则加载完成，共 ${items.length} 条`;
  } catch (error) {
    byId("rulesStatus").textContent = `规则加载失败：${error.message}`;
  }
}

async function loadNotifications() {
  const familyId = getCurrentFamilyId();
  const memberId = getCurrentMemberId();
  if (!familyId) {
    byId("rulesStatus").textContent = "请先登录并选择家庭";
    return;
  }
  byId("rulesStatus").textContent = "正在加载通知...";
  try {
    const items = await api(`/api/notifications?familyId=${familyId}&targetMemberId=${memberId}`, "GET");
    renderNotifications(items);
    byId("rulesStatus").textContent = `通知加载完成，共 ${items.length} 条`;
  } catch (error) {
    byId("rulesStatus").textContent = `通知加载失败：${error.message}`;
  }
}

async function evaluateRules() {
  const familyId = getCurrentFamilyId();
  if (!familyId) {
    byId("rulesStatus").textContent = "请先登录并选择家庭";
    return;
  }
  byId("rulesStatus").textContent = "正在执行规则评估...";
  try {
    const result = await api(`/api/rules/evaluate?familyId=${familyId}`, "POST");
    byId("rulesStatus").textContent = `评估完成：触发规则 ${result.triggeredRuleCount ?? 0} 条，生成通知 ${result.generatedNotificationCount ?? 0} 条`;
    renderRaw(result);
    await loadNotifications();
  } catch (error) {
    byId("rulesStatus").textContent = `规则评估失败：${error.message}`;
  }
}

function switchView(viewName) {
  const mapping = {
    analysis: { title: "真实数据分析总控台", id: "analysisView" },
    imports: { title: "真实数据导入管理", id: "importsView" },
    rules: { title: "规则与通知管理", id: "rulesView" },
    acceptance: { title: "系统验收与回归", id: "acceptanceView" }
  };
  const target = mapping[viewName] || mapping.analysis;

  document.querySelectorAll(".menu-item").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.view === viewName);
  });
  document.querySelectorAll(".view-section").forEach((node) => {
    node.classList.toggle("is-active", node.id === target.id);
  });
  byId("pageTitle").textContent = target.title;
}

document.addEventListener("DOMContentLoaded", () => {
  byId("loginBtn").addEventListener("click", login);
  byId("importBtn").addEventListener("click", importData);
  byId("importBtnMirror").addEventListener("click", importData);
  byId("summaryBtn").addEventListener("click", loadDefenseSummary);
  byId("acceptanceBtn").addEventListener("click", runAcceptance);
  byId("acceptanceBtnMirror").addEventListener("click", runAcceptance);
  byId("loadRulesBtn").addEventListener("click", loadRules);
  byId("loadNotificationsBtn").addEventListener("click", loadNotifications);
  byId("evaluateRulesBtn").addEventListener("click", evaluateRules);
  byId("familySelect").addEventListener("change", updateMemberOptions);
  document.querySelectorAll(".menu-item").forEach((node) => {
    node.addEventListener("click", () => switchView(node.dataset.view));
  });
  renderConclusions([]);
  renderCountryList([]);
  renderWorldBank(null);
  renderFred(null);
  renderLatestImport(null);
  renderRules([]);
  renderNotifications([]);
  switchView("analysis");
});
