let token = "";
let latestSummary = null;
let latestImport = null;
let memberships = [];
let importHistory = [];
let selectedImportHistoryId = null;
let allRules = [];
let filteredRules = [];
let notificationsPage = [];
let selectedRuleId = null;
let selectedNotificationId = null;

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "-")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    return String(value);
  }
  return number.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("zh-CN", { hour12: false });
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
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function getImportParams() {
  return {
    processedDir: (byId("processedDirInput").value || "data/processed").trim() || "data/processed",
    truncateBeforeImport: byId("truncateBeforeImportInput").checked,
    batchSize: Number(byId("batchSizeInput").value || 5000)
  };
}

function getAnalysisParams() {
  return {
    countryIso3: ((byId("countryIso3").value || "CHN").trim() || "CHN").toUpperCase(),
    seriesId: ((byId("seriesId").value || "PCE").trim() || "PCE").toUpperCase(),
    topCountries: Number(byId("topCountries").value || 10)
  };
}

function setStatus(id, message) {
  byId(id).textContent = message;
}

function setImportStatuses(message) {
  setStatus("importStatus", message);
  setStatus("importStatusMirror", message);
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
        <div class="country-name">${escapeHtml(item.country)}</div>
      </div>
      <div class="country-amount">${formatNumber(item.totalAmount)}</div>
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
    <div class="summary-item"><strong>${escapeHtml(worldBankTrend.countryName)}</strong> (${escapeHtml(worldBankTrend.countryIso3)})</div>
    <div class="summary-item">起始年份：${escapeHtml(first.year)}，起始值：${formatNumber(first.value)}</div>
    <div class="summary-item">最新年份：${escapeHtml(last.year)}，最新值：${formatNumber(last.value)}</div>
    <div class="summary-item">最新同比：${formatNumber(last.yearOnYearGrowthRatio)}</div>
  `;
}

function renderFred(fredSeries) {
  const host = byId("fredSummary");
  const points = fredSeries?.points || [];
  if (points.length === 0) {
    host.innerHTML = `<div class="summary-item">${escapeHtml(fredSeries?.seriesId || "PCE")} 当前无数据点，可按软降级处理。</div>`;
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  host.innerHTML = `
    <div class="summary-item">序列：${escapeHtml(fredSeries.seriesId)}</div>
    <div class="summary-item">首点：${escapeHtml(first.date)} / ${formatNumber(first.value)}</div>
    <div class="summary-item">末点：${escapeHtml(last.date)} / ${formatNumber(last.value)}</div>
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
    <div class="conclusion-item">${index + 1}. ${escapeHtml(item)}</div>
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
    <div class="summary-item">处理目录：<strong>${escapeHtml(result.processedDir)}</strong></div>
    <div class="detail-grid">
      <div class="detail-item">importBatchId：${formatNumber(result.importBatchId)}</div>
      <div class="detail-item">batchSize：${formatNumber(result.batchSize)}</div>
      <div class="detail-item">retailImported：${formatNumber(result.retailImported)}</div>
      <div class="detail-item">worldBankImported：${formatNumber(result.worldBankImported)}</div>
      <div class="detail-item">fredImported：${formatNumber(result.fredImported)}</div>
      <div class="detail-item">importStatus：${escapeHtml(result.importStatus)}</div>
    </div>
  `;
}

function normalizeImportHistory(items) {
  return (items || []).map((item) => ({
    id: item.id ?? item.importBatchId,
    createdAt: item.createdAt || item.importedAt,
    params: {
      processedDir: item.processedDir,
      truncateBeforeImport: item.truncatedBeforeImport,
      batchSize: item.batchSize
    },
    result: {
      importBatchId: item.id ?? item.importBatchId,
      processedDir: item.processedDir,
      batchSize: item.batchSize,
      truncatedBeforeImport: item.truncatedBeforeImport,
      retailImported: item.retailImported,
      worldBankImported: item.worldBankImported,
      fredImported: item.fredImported,
      importStatus: item.importStatus,
      importedAt: item.importedAt
    }
  }));
}

function renderImportHistory() {
  const host = byId("importHistoryList");
  if (importHistory.length === 0) {
    host.classList.add("empty-board");
    host.innerHTML = '<div class="empty-state">暂无导入历史</div>';
    return;
  }
  host.classList.remove("empty-board");
  host.innerHTML = importHistory.map((item) => `
    <div class="table-row ${item.id === selectedImportHistoryId ? "is-active" : ""}" data-action="select-import-history" data-history-id="${item.id}">
      <div class="table-main">
        <div class="table-title">${escapeHtml(item.params.processedDir)}</div>
        <div class="table-meta">${item.params.truncateBeforeImport ? "清空导入" : "增量导入"} / batchSize=${formatNumber(item.params.batchSize)}</div>
        <div class="meta-line">${formatDateTime(item.createdAt)}</div>
      </div>
      <div class="table-side">
        <span class="status-chip success">retail ${formatNumber(item.result?.retailImported)}</span>
        <span class="status-chip success">world ${formatNumber(item.result?.worldBankImported)}</span>
        <span class="status-chip ${Number(item.result?.fredImported || 0) > 0 ? "success" : "warning"}">fred ${formatNumber(item.result?.fredImported)}</span>
      </div>
    </div>
  `).join("");
}

function renderImportHistoryDetail() {
  const host = byId("importHistoryDetail");
  const record = importHistory.find((item) => item.id === selectedImportHistoryId);
  if (!record) {
    host.innerHTML = '<div class="summary-item">请选择左侧某次导入记录</div>';
    return;
  }
  host.innerHTML = `
    <div class="summary-item"><strong>导入时间</strong><div>${formatDateTime(record.createdAt)}</div></div>
    <div class="detail-grid">
      <div class="detail-item">importBatchId：${formatNumber(record.result?.importBatchId)}</div>
      <div class="detail-item">processedDir：${escapeHtml(record.params.processedDir)}</div>
      <div class="detail-item">truncateBeforeImport：${record.params.truncateBeforeImport ? "true" : "false"}</div>
      <div class="detail-item">batchSize：${formatNumber(record.params.batchSize)}</div>
      <div class="detail-item">retailImported：${formatNumber(record.result?.retailImported)}</div>
      <div class="detail-item">worldBankImported：${formatNumber(record.result?.worldBankImported)}</div>
      <div class="detail-item">fredImported：${formatNumber(record.result?.fredImported)}</div>
    </div>
    <div class="item-actions">
      <button class="mini-btn" type="button" data-action="reuse-import-history" data-history-id="${record.id}">回填参数</button>
      <button class="mini-btn" type="button" data-action="load-summary-from-history" data-history-id="${record.id}">切到分析并加载汇总</button>
      <button class="mini-btn" type="button" data-action="show-import-payload" data-history-id="${record.id}">查看导入回执</button>
    </div>
  `;
}

async function loadImportHistory() {
  try {
    const items = await api("/api/real-data-analysis/imports", "GET", null, false);
    importHistory = normalizeImportHistory(items);
    if (!selectedImportHistoryId && importHistory.length > 0) {
      selectedImportHistoryId = importHistory[0].id;
    }
    if (selectedImportHistoryId && !importHistory.some((item) => item.id === selectedImportHistoryId)) {
      selectedImportHistoryId = importHistory[0]?.id ?? null;
    }
    renderImportHistory();
    renderImportHistoryDetail();
  } catch (error) {
    setImportStatuses(`导入历史加载失败：${error.message}`);
  }
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
      ${escapeHtml(item.familyName || `家庭${item.familyId}`)}
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
      ${escapeHtml(item.roleCode || "MEMBER")} / ${item.familyMemberId}
    </option>
  `).join("");
}

function renderRuleDetail(item) {
  const host = byId("ruleDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧规则查看详情</div>';
    return;
  }
  host.innerHTML = `
    <div class="summary-item"><strong>${escapeHtml(item.ruleName)}</strong></div>
    <div class="detail-grid">
      <div class="detail-item">ruleType：${escapeHtml(item.ruleType)}</div>
      <div class="detail-item">metricType：${escapeHtml(item.metricType)}</div>
      <div class="detail-item">timeScope：${escapeHtml(item.timeScope)}</div>
      <div class="detail-item">operatorType：${escapeHtml(item.operatorType)}</div>
      <div class="detail-item">thresholdValue：${formatNumber(item.thresholdValue)}</div>
      <div class="detail-item">priority：${formatNumber(item.priority)}</div>
      <div class="detail-item">actionType：${escapeHtml(item.actionType)}</div>
      <div class="detail-item">enabled：${Number(item.enabled) === 1 ? "true" : "false"}</div>
    </div>
    <div class="summary-item">messageTemplate：${escapeHtml(item.messageTemplate)}</div>
    <div class="summary-item">thresholdJson：${escapeHtml(item.thresholdJson)}</div>
  `;
}

function renderRules(items) {
  const host = byId("rulesList");
  if (!items || items.length === 0) {
    host.classList.add("empty-board");
    host.innerHTML = '<div class="empty-state">当前家庭暂无规则</div>';
    renderRuleDetail(null);
    return;
  }
  host.classList.remove("empty-board");
  host.innerHTML = items.map((item) => `
    <div class="table-row ${item.id === selectedRuleId ? "is-active" : ""}" data-action="select-rule" data-rule-id="${item.id}">
      <div class="table-main">
        <div class="table-title">${escapeHtml(item.ruleName)}</div>
        <div class="table-meta">${escapeHtml(item.ruleType)} / ${escapeHtml(item.metricType)} / 优先级 ${formatNumber(item.priority)}</div>
      </div>
      <div class="table-side">
        <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">
          ${Number(item.enabled) === 1 ? "启用中" : "已停用"}
        </span>
        <button class="mini-btn" type="button" data-action="toggle-rule" data-rule-id="${item.id}" data-enabled="${item.enabled}">
          ${Number(item.enabled) === 1 ? "停用规则" : "启用规则"}
        </button>
      </div>
    </div>
  `).join("");
  const selected = items.find((item) => item.id === selectedRuleId) || items[0];
  selectedRuleId = selected?.id ?? null;
  renderRuleDetail(selected || null);
}

function renderNotificationDetail(item) {
  const host = byId("notificationDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧通知查看详情</div>';
    return;
  }
  host.innerHTML = `
    <div class="summary-item"><strong>${escapeHtml(item.title)}</strong></div>
    <div class="detail-grid">
      <div class="detail-item">sourceType：${escapeHtml(item.sourceType)}</div>
      <div class="detail-item">levelCode：${escapeHtml(item.levelCode)}</div>
      <div class="detail-item">readStatus：${Number(item.readStatus) === 1 ? "已读" : "未读"}</div>
      <div class="detail-item">sentAt：${formatDateTime(item.sentAt)}</div>
      <div class="detail-item">createdAt：${formatDateTime(item.createdAt)}</div>
      <div class="detail-item">targetMemberId：${formatNumber(item.targetMemberId)}</div>
    </div>
    <div class="summary-item">${escapeHtml(item.content)}</div>
  `;
}

function renderNotifications(items) {
  const host = byId("notificationsList");
  if (!items || items.length === 0) {
    host.classList.add("empty-board");
    host.innerHTML = '<div class="empty-state">当前家庭暂无通知</div>';
    renderNotificationDetail(null);
    return;
  }
  host.classList.remove("empty-board");
  host.innerHTML = items.map((item) => `
    <div class="table-row ${item.id === selectedNotificationId ? "is-active" : ""}" data-action="select-notification" data-notification-id="${item.id}">
      <div class="table-main">
        <div class="table-title">${escapeHtml(item.title)}</div>
        <div class="table-meta">${escapeHtml(item.sourceType)} / ${formatDateTime(item.createdAt)}</div>
      </div>
      <div class="table-side">
        <span class="status-chip ${Number(item.readStatus) === 1 ? "read" : "unread"}">
          ${Number(item.readStatus) === 1 ? "已读" : "未读"}
        </span>
        <div class="item-actions">
          ${Number(item.readStatus) === 1 ? "" : `<button class="mini-btn" type="button" data-action="read-notification" data-notification-id="${item.id}">标记已读</button>`}
          <button class="mini-btn danger" type="button" data-action="delete-notification" data-notification-id="${item.id}">删除</button>
        </div>
      </div>
    </div>
  `).join("");
  const selected = items.find((item) => item.id === selectedNotificationId) || items[0];
  selectedNotificationId = selected?.id ?? null;
  renderNotificationDetail(selected || null);
}

function renderSummary(summary) {
  latestSummary = summary;
  renderMetric("metricTotalRecords", formatNumber(summary?.retailOverview?.totalRecords ?? "-"));
  renderMetric("metricTotalAmount", formatNumber(summary?.retailOverview?.totalAmount ?? "-"));
  renderMetric("metricWorldBankPoints", formatNumber(summary?.worldBankTrend?.points?.length ?? 0));
  renderMetric("metricFredPoints", formatNumber(summary?.fredSeries?.points?.length ?? 0));
  renderCountryList(summary?.retailOverview?.topCountries || []);
  renderWorldBank(summary?.worldBankTrend);
  renderFred(summary?.fredSeries);
  renderConclusions(summary?.conclusions || []);
  renderRaw(summary);
}

function applyHistoryParams(record) {
  byId("processedDirInput").value = record.params.processedDir;
  byId("truncateBeforeImportInput").checked = !!record.params.truncateBeforeImport;
  byId("batchSizeInput").value = record.params.batchSize;
}

function syncImportParamsToAnalysis() {
  const params = getImportParams();
  setImportStatuses(`导入参数已确认：${params.processedDir} / batchSize=${params.batchSize} / truncate=${params.truncateBeforeImport}`);
}

async function login() {
  const username = byId("username").value.trim();
  const password = byId("password").value;
  try {
    const result = await api("/api/auth/login", "POST", { username, password }, false);
    token = result.accessToken || "";
    byId("loginStatus").textContent = token ? `已登录：${result.user?.username ?? "-"}` : "登录失败";
    renderMemberships(result.memberships || []);
    setStatus("rulesStatus", "登录成功，可加载规则与通知。");
  } catch (error) {
    byId("loginStatus").textContent = `登录失败：${error.message}`;
  }
}

async function importData() {
  const params = getImportParams();
  setImportStatuses(`正在导入真实数据：${params.processedDir} / batchSize=${params.batchSize} ...`);
  try {
    const query = new URLSearchParams({
      processedDir: params.processedDir,
      truncateBeforeImport: String(params.truncateBeforeImport),
      batchSize: String(params.batchSize)
    });
    const result = await api(`/api/real-data-analysis/import?${query.toString()}`, "POST", null, false);
    latestImport = result;
    renderLatestImport(result);
    renderRaw(result);
    await loadImportHistory();
    selectedImportHistoryId = result.importBatchId ?? selectedImportHistoryId;
    renderImportHistory();
    renderImportHistoryDetail();
    setImportStatuses(`导入完成：retail=${formatNumber(result.retailImported)}，worldBank=${formatNumber(result.worldBankImported)}，fred=${formatNumber(result.fredImported)}`);
    return result;
  } catch (error) {
    setImportStatuses(`导入失败：${error.message}`);
    throw error;
  }
}

async function loadDefenseSummary() {
  const params = getAnalysisParams();
  setImportStatuses(`正在加载汇总：${params.countryIso3} / ${params.seriesId} ...`);
  try {
    const query = new URLSearchParams({
      countryIso3: params.countryIso3,
      seriesId: params.seriesId,
      topCountries: String(params.topCountries)
    });
    const summary = await api(`/api/real-data-analysis/defense-summary?${query.toString()}`, "GET", null, false);
    renderSummary(summary);
    setImportStatuses("汇总加载完成");
    return summary;
  } catch (error) {
    setImportStatuses(`汇总加载失败：${error.message}`);
    throw error;
  }
}

async function runAcceptance() {
  setImportStatuses("正在执行一键验收...");
  try {
    await importData();
    await loadDefenseSummary();
    setImportStatuses("一键验收完成");
  } catch (error) {
    setImportStatuses(`一键验收失败：${error.message}`);
  }
}

function applyRuleFilters(items) {
  const enabledFilter = byId("ruleEnabledFilter").value;
  const ruleTypeFilter = (byId("ruleTypeFilter").value || "").trim().toUpperCase();
  return (items || []).filter((item) => {
    const enabledMatch = enabledFilter === "all" || String(item.enabled) === enabledFilter;
    const typeMatch = !ruleTypeFilter || String(item.ruleType || "").toUpperCase().includes(ruleTypeFilter);
    return enabledMatch && typeMatch;
  });
}

async function loadRules() {
  const familyId = getCurrentFamilyId();
  if (!familyId) {
    setStatus("rulesStatus", "请先登录并选择家庭");
    return;
  }
  setStatus("rulesStatus", "正在加载规则...");
  try {
    allRules = await api(`/api/rules?familyId=${familyId}`, "GET");
    filteredRules = applyRuleFilters(allRules);
    selectedRuleId = filteredRules[0]?.id ?? null;
    renderRules(filteredRules);
    setStatus("rulesStatus", `规则加载完成，筛选后 ${filteredRules.length} 条 / 原始 ${allRules.length} 条`);
  } catch (error) {
    setStatus("rulesStatus", `规则加载失败：${error.message}`);
  }
}

async function loadNotifications() {
  const familyId = getCurrentFamilyId();
  const memberId = getCurrentMemberId();
  if (!familyId) {
    setStatus("rulesStatus", "请先登录并选择家庭");
    return;
  }
  setStatus("rulesStatus", "正在加载通知...");
  try {
    const query = new URLSearchParams({
      familyId: String(familyId),
      targetMemberId: String(memberId),
      page: "0",
      size: byId("notificationPageSize").value || "8"
    });
    const readFilter = byId("notificationReadFilter").value;
    const sourceFilter = (byId("notificationSourceFilter").value || "").trim();
    if (readFilter !== "") {
      query.set("readStatus", readFilter);
    }
    if (sourceFilter) {
      query.set("sourceType", sourceFilter);
    }
    const pageResult = await api(`/api/notifications/search?${query.toString()}`, "GET");
    notificationsPage = pageResult?.items || [];
    selectedNotificationId = notificationsPage[0]?.id ?? null;
    renderNotifications(notificationsPage);
    setStatus("rulesStatus", `通知加载完成，本页 ${notificationsPage.length} 条 / 总计 ${pageResult?.totalElements ?? notificationsPage.length} 条`);
  } catch (error) {
    setStatus("rulesStatus", `通知加载失败：${error.message}`);
  }
}

async function evaluateRules() {
  const familyId = getCurrentFamilyId();
  if (!familyId) {
    setStatus("rulesStatus", "请先登录并选择家庭");
    return;
  }
  setStatus("rulesStatus", "正在执行规则评估...");
  try {
    const result = await api(`/api/rules/evaluate?familyId=${familyId}`, "POST");
    setStatus("rulesStatus", `评估完成：触发规则 ${formatNumber(result.triggeredRuleCount)} 条，生成通知 ${formatNumber(result.generatedNotificationCount)} 条`);
    renderRaw(result);
    await loadNotifications();
  } catch (error) {
    setStatus("rulesStatus", `规则评估失败：${error.message}`);
  }
}

async function toggleRule(ruleId, enabled) {
  const nextAction = Number(enabled) === 1 ? "disable" : "enable";
  setStatus("rulesStatus", `正在${nextAction === "enable" ? "启用" : "停用"}规则...`);
  try {
    await api(`/api/rules/${ruleId}/${nextAction}`, "POST");
    await loadRules();
  } catch (error) {
    setStatus("rulesStatus", `规则操作失败：${error.message}`);
  }
}

async function markNotificationRead(notificationId) {
  setStatus("rulesStatus", "正在标记通知已读...");
  try {
    await api(`/api/notifications/${notificationId}/read`, "POST");
    await loadNotifications();
  } catch (error) {
    setStatus("rulesStatus", `通知已读失败：${error.message}`);
  }
}

async function deleteNotification(notificationId) {
  setStatus("rulesStatus", "正在删除通知...");
  try {
    await api(`/api/notifications/${notificationId}`, "DELETE");
    await loadNotifications();
  } catch (error) {
    setStatus("rulesStatus", `通知删除失败：${error.message}`);
  }
}

async function markAllNotificationsRead() {
  const familyId = getCurrentFamilyId();
  const memberId = getCurrentMemberId();
  if (!familyId) {
    setStatus("rulesStatus", "请先登录并选择家庭");
    return;
  }
  setStatus("rulesStatus", "正在批量已读通知...");
  try {
    const result = await api(`/api/notifications/read-all?familyId=${familyId}&targetMemberId=${memberId}`, "POST");
    setStatus("rulesStatus", `批量已读完成，影响 ${formatNumber(result.affectedCount)} 条`);
    await loadNotifications();
  } catch (error) {
    setStatus("rulesStatus", `批量已读失败：${error.message}`);
  }
}

async function clearReadNotifications() {
  const familyId = getCurrentFamilyId();
  const memberId = getCurrentMemberId();
  if (!familyId) {
    setStatus("rulesStatus", "请先登录并选择家庭");
    return;
  }
  setStatus("rulesStatus", "正在清理已读通知...");
  try {
    const result = await api(`/api/notifications/read?familyId=${familyId}&targetMemberId=${memberId}`, "DELETE");
    setStatus("rulesStatus", `已读通知清理完成，影响 ${formatNumber(result.affectedCount)} 条`);
    await loadNotifications();
  } catch (error) {
    setStatus("rulesStatus", `清理已读失败：${error.message}`);
  }
}

function clearImportHistory() {
  importHistory = [];
  selectedImportHistoryId = null;
  renderImportHistory();
  renderImportHistoryDetail();
  setImportStatuses("本地展示历史已清空，再次加载将从后端重新读取");
  loadImportHistory();
}

function switchView(viewName) {
  const mapping = {
    analysis: { title: "真实数据分析总控台", eyebrow: "数据治理与分析后台", breadcrumb: "后台首页 / 真实数据分析", id: "analysisView" },
    imports: { title: "真实数据导入管理", eyebrow: "数据治理与分析后台", breadcrumb: "后台首页 / 导入管理", id: "importsView" },
    rules: { title: "规则与通知管理", eyebrow: "运营规则与消息中心", breadcrumb: "后台首页 / 规则与通知", id: "rulesView" },
    acceptance: { title: "系统验收与联通回归", eyebrow: "三端联通验收", breadcrumb: "后台首页 / 系统验收", id: "acceptanceView" }
  };
  const target = mapping[viewName] || mapping.analysis;

  document.querySelectorAll(".menu-item").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.view === viewName);
  });
  document.querySelectorAll(".view-tab").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.view === viewName);
  });
  document.querySelectorAll(".view-section").forEach((node) => {
    node.classList.toggle("is-active", node.id === target.id);
  });
  byId("pageTitle").textContent = target.title;
  byId("pageEyebrow").textContent = target.eyebrow;
  byId("pageBreadcrumb").textContent = target.breadcrumb;

  if (viewName === "imports") {
    loadImportHistory();
  }
}

function handleImportHistoryAction(action, historyId) {
  const record = importHistory.find((item) => String(item.id) === String(historyId));
  if (!record) {
    return;
  }
  selectedImportHistoryId = record.id;
  renderImportHistory();
  renderImportHistoryDetail();
  if (action === "reuse-import-history") {
    applyHistoryParams(record);
    setImportStatuses("已回填选中记录的导入参数");
  }
  if (action === "load-summary-from-history") {
    switchView("analysis");
    renderRaw(record.result);
    loadDefenseSummary();
  }
  if (action === "show-import-payload") {
    renderRaw(record.result);
    switchView("analysis");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  byId("loginBtn").addEventListener("click", login);
  byId("importBtn").addEventListener("click", importData);
  byId("importBtnMirror").addEventListener("click", importData);
  byId("summaryBtn").addEventListener("click", loadDefenseSummary);
  byId("acceptanceBtn").addEventListener("click", runAcceptance);
  byId("acceptanceBtnMirror").addEventListener("click", runAcceptance);
  byId("syncAnalysisParamsBtn").addEventListener("click", syncImportParamsToAnalysis);
  byId("clearImportHistoryBtn").addEventListener("click", clearImportHistory);
  byId("loadRulesBtn").addEventListener("click", loadRules);
  byId("loadNotificationsBtn").addEventListener("click", loadNotifications);
  byId("evaluateRulesBtn").addEventListener("click", evaluateRules);
  byId("readAllNotificationsBtn").addEventListener("click", markAllNotificationsRead);
  byId("clearReadNotificationsBtn").addEventListener("click", clearReadNotifications);
  byId("familySelect").addEventListener("change", updateMemberOptions);
  byId("ruleEnabledFilter").addEventListener("change", () => {
    filteredRules = applyRuleFilters(allRules);
    selectedRuleId = filteredRules[0]?.id ?? null;
    renderRules(filteredRules);
  });
  byId("ruleTypeFilter").addEventListener("input", () => {
    filteredRules = applyRuleFilters(allRules);
    selectedRuleId = filteredRules[0]?.id ?? null;
    renderRules(filteredRules);
  });

  byId("rulesList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === "toggle-rule") {
      toggleRule(button.dataset.ruleId, button.dataset.enabled);
      return;
    }
    if (action === "select-rule") {
      selectedRuleId = Number(button.dataset.ruleId);
      renderRules(filteredRules);
    }
  });

  byId("notificationsList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    if (action === "read-notification") {
      markNotificationRead(button.dataset.notificationId);
      return;
    }
    if (action === "delete-notification") {
      deleteNotification(button.dataset.notificationId);
      return;
    }
    if (action === "select-notification") {
      selectedNotificationId = Number(button.dataset.notificationId);
      renderNotifications(notificationsPage);
    }
  });

  byId("importHistoryList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    if (button.dataset.action === "select-import-history") {
      selectedImportHistoryId = Number(button.dataset.historyId);
      renderImportHistory();
      renderImportHistoryDetail();
    }
  });

  byId("importHistoryDetail").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    handleImportHistoryAction(button.dataset.action, button.dataset.historyId);
  });

  document.querySelectorAll(".menu-item, .view-tab").forEach((node) => {
    node.addEventListener("click", () => switchView(node.dataset.view));
  });

  document.querySelectorAll(".tag-btn").forEach((node) => {
    node.addEventListener("click", () => {
      byId("batchSizeInput").value = node.dataset.batchSize;
      byId("truncateBeforeImportInput").checked = node.dataset.truncate === "true";
      setImportStatuses(`已应用预设：batchSize=${node.dataset.batchSize} / truncate=${node.dataset.truncate}`);
    });
  });

  renderConclusions([]);
  renderCountryList([]);
  renderWorldBank(null);
  renderFred(null);
  renderLatestImport(null);
  renderImportHistory();
  renderImportHistoryDetail();
  renderRules([]);
  renderNotifications([]);
  switchView("analysis");
  loadImportHistory();
});
