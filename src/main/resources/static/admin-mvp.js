const STORAGE_TOKEN_KEY = "finance_admin_token";
const STORAGE_SESSION_KEY = "finance_admin_session";

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
let activeView = "analysis";

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

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const number = Number(value);
  if (Number.isNaN(number)) {
    return String(value);
  }
  return number.toLocaleString("zh-CN", { maximumFractionDigits: digits });
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

function formatBoolean(value) {
  return value ? "是" : "否";
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function api(path, options = {}) {
  const { method = "GET", body = null, auth = true } = options;
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function saveSession(session) {
  token = session?.accessToken || token || "";
  if (token) {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
  }
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({
    user: session?.user || null,
    memberships: session?.memberships || []
  }));
}

function clearSession() {
  token = "";
  memberships = [];
  allRules = [];
  filteredRules = [];
  notificationsPage = [];
  selectedRuleId = null;
  selectedNotificationId = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_SESSION_KEY);
  renderSession(null);
  renderMemberships([]);
  renderRules([]);
  renderNotifications([]);
  setRulesStatus("请先登录后再加载规则与通知。", true);
}

function restoreSession() {
  token = localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  const rawSession = localStorage.getItem(STORAGE_SESSION_KEY);
  if (!rawSession) {
    renderSession(null);
    renderMemberships([]);
    return;
  }
  try {
    const session = JSON.parse(rawSession);
    renderSession(session.user || null);
    renderMemberships(session.memberships || []);
  } catch (error) {
    clearSession();
  }
}

function renderSession(user) {
  const status = byId("loginStatus");
  if (!user) {
    status.textContent = "未登录";
    return;
  }
  const label = [user.nickname || user.realName || user.username, user.userType].filter(Boolean).join(" / ");
  status.textContent = label || "已登录";
}

function setStatus(id, message, isError = false) {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.textContent = message;
  node.style.color = isError ? "#b91c1c" : "";
}

function setImportStatuses(message, isError = false) {
  setStatus("importStatus", message, isError);
  setStatus("importStatusMirror", message, isError);
}

function setRulesStatus(message, isError = false) {
  setStatus("rulesStatus", message, isError);
}

function renderMetric(id, value) {
  byId(id).textContent = value ?? "-";
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

function getCurrentFamilyId() {
  const value = Number(byId("familySelect").value || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function getCurrentMemberId() {
  const value = Number(byId("memberSelect").value || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function renderEmptyBoard(id, message) {
  const host = byId(id);
  host.classList.add("empty-board");
  host.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function renderCountryList(items) {
  const host = byId("countryList");
  if (!items || items.length === 0) {
    host.innerHTML = '<div class="summary-item">暂无国家交易分布数据</div>';
    return;
  }
  host.innerHTML = items.map((item, index) => `
    <div class="country-item">
      <div>
        <div class="country-rank">TOP ${index + 1}</div>
        <div class="country-name">${escapeHtml(item.country || "未知国家")}</div>
      </div>
      <div>
        <div class="country-amount">${formatNumber(item.totalAmount)}</div>
        <div class="table-meta">记录数 ${formatNumber(item.recordCount, 0)}</div>
      </div>
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
    <div class="summary-item"><strong>${escapeHtml(worldBankTrend.countryName || "未知国家")}</strong> (${escapeHtml(worldBankTrend.countryIso3 || "-")})</div>
    <div class="detail-grid">
      <div class="detail-item"><strong>起始年份</strong><div>${escapeHtml(first.year)}</div><div>数值 ${formatNumber(first.value)}</div></div>
      <div class="detail-item"><strong>最新年份</strong><div>${escapeHtml(last.year)}</div><div>数值 ${formatNumber(last.value)}</div></div>
      <div class="detail-item"><strong>最新同比</strong><div>${formatNumber(last.yearOnYearGrowthRatio)}</div></div>
      <div class="detail-item"><strong>趋势点数</strong><div>${formatNumber(points.length, 0)}</div></div>
    </div>
  `;
}

function renderFred(fredSeries) {
  const host = byId("fredSummary");
  const points = fredSeries?.points || [];
  if (points.length === 0) {
    host.innerHTML = `<div class="summary-item">序列 ${escapeHtml(fredSeries?.seriesId || "PCE")} 当前无数据点，属于已处理的软降级状态。</div>`;
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  host.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><strong>序列</strong><div>${escapeHtml(fredSeries.seriesId)}</div></div>
      <div class="detail-item"><strong>首个数据点</strong><div>${escapeHtml(first.date)}</div><div>${formatNumber(first.value)}</div></div>
      <div class="detail-item"><strong>最新数据点</strong><div>${escapeHtml(last.date)}</div><div>${formatNumber(last.value)}</div></div>
      <div class="detail-item"><strong>点数</strong><div>${formatNumber(points.length, 0)}</div></div>
    </div>
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
    <div class="summary-item"><strong>处理目录</strong><div>${escapeHtml(result.processedDir)}</div></div>
    <div class="detail-grid">
      <div class="detail-item"><strong>批次 ID</strong><div>${formatNumber(result.importBatchId, 0)}</div></div>
      <div class="detail-item"><strong>批大小</strong><div>${formatNumber(result.batchSize, 0)}</div></div>
      <div class="detail-item"><strong>是否清空</strong><div>${formatBoolean(result.truncatedBeforeImport)}</div></div>
      <div class="detail-item"><strong>零售导入</strong><div>${formatNumber(result.retailImported, 0)}</div></div>
      <div class="detail-item"><strong>世行导入</strong><div>${formatNumber(result.worldBankImported, 0)}</div></div>
      <div class="detail-item"><strong>FRED 导入</strong><div>${formatNumber(result.fredImported, 0)}</div></div>
      <div class="detail-item"><strong>导入状态</strong><div>${escapeHtml(result.importStatus)}</div></div>
      <div class="detail-item"><strong>导入时间</strong><div>${formatDateTime(result.importedAt)}</div></div>
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
    renderEmptyBoard("importHistoryList", "暂无导入历史");
    return;
  }
  host.classList.remove("empty-board");
  host.innerHTML = importHistory.map((item) => `
    <div class="table-row ${item.id === selectedImportHistoryId ? "is-active" : ""}" data-action="select-import-history" data-history-id="${item.id}">
      <div class="table-main">
        <div class="table-title">${escapeHtml(item.params.processedDir)}</div>
        <div class="table-meta">${item.params.truncateBeforeImport ? "清空后全量导入" : "增量导入"} / batchSize=${formatNumber(item.params.batchSize, 0)}</div>
        <div class="meta-line">${formatDateTime(item.createdAt)}</div>
      </div>
      <div class="table-side">
        <span class="status-chip success">retail ${formatNumber(item.result?.retailImported, 0)}</span>
        <span class="status-chip success">world ${formatNumber(item.result?.worldBankImported, 0)}</span>
        <span class="status-chip ${Number(item.result?.fredImported || 0) > 0 ? "success" : "warning"}">fred ${formatNumber(item.result?.fredImported, 0)}</span>
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
      <div class="detail-item"><strong>批次 ID</strong><div>${formatNumber(record.result?.importBatchId, 0)}</div></div>
      <div class="detail-item"><strong>处理目录</strong><div>${escapeHtml(record.params.processedDir)}</div></div>
      <div class="detail-item"><strong>清空导入</strong><div>${formatBoolean(record.params.truncateBeforeImport)}</div></div>
      <div class="detail-item"><strong>批大小</strong><div>${formatNumber(record.params.batchSize, 0)}</div></div>
      <div class="detail-item"><strong>零售导入</strong><div>${formatNumber(record.result?.retailImported, 0)}</div></div>
      <div class="detail-item"><strong>世行导入</strong><div>${formatNumber(record.result?.worldBankImported, 0)}</div></div>
      <div class="detail-item"><strong>FRED 导入</strong><div>${formatNumber(record.result?.fredImported, 0)}</div></div>
      <div class="detail-item"><strong>状态</strong><div>${escapeHtml(record.result?.importStatus)}</div></div>
    </div>
    <div class="item-actions">
      <button class="mini-btn" type="button" data-action="reuse-import-history" data-history-id="${record.id}">回填参数</button>
      <button class="mini-btn" type="button" data-action="load-summary-from-history" data-history-id="${record.id}">切到分析并加载汇总</button>
      <button class="mini-btn" type="button" data-action="show-import-payload" data-history-id="${record.id}">查看导入回执</button>
    </div>
  `;
}

function renderMemberships(items) {
  memberships = items || [];
  const familySelect = byId("familySelect");
  if (memberships.length === 0) {
    familySelect.innerHTML = '<option value="">未选择家庭</option>';
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
  const currentMembers = memberships.filter((item) => Number(item.familyId) === Number(currentFamilyId));
  if (currentMembers.length === 0) {
    memberSelect.innerHTML = '<option value="">未选择成员</option>';
    return;
  }
  memberSelect.innerHTML = currentMembers.map((item, index) => `
    <option value="${item.familyMemberId}" ${index === 0 ? "selected" : ""}>
      ${escapeHtml(item.roleCode || "MEMBER")} / ${escapeHtml(item.familyName || `家庭${item.familyId}`)}
    </option>
  `).join("");
}

function renderDescriptionPairs(items) {
  return items.map((item) => `
    <div class="detail-pair">
      <div class="detail-pair-label">${escapeHtml(item.label)}</div>
      <div class="detail-pair-value">${escapeHtml(item.value)}</div>
    </div>
  `).join("");
}

function renderRuleDetail(item) {
  const host = byId("ruleDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧规则查看详情</div>';
    return;
  }
  const statusText = Number(item.enabled) === 1 ? "启用中" : "已停用";
  host.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div>
          <h3 class="detail-title">${escapeHtml(item.ruleName)}</h3>
          <div class="detail-subtitle">规则定义详情，包含指标、阈值、动作和启停状态。</div>
        </div>
        <div class="detail-badge-row">
          <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${statusText}</span>
          <span class="status-chip muted">${escapeHtml(item.ruleType)}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">基础属性</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs([
            { label: "规则类型", value: item.ruleType },
            { label: "指标类型", value: item.metricType },
            { label: "时间范围", value: item.timeScope },
            { label: "运算符", value: item.operatorType },
            { label: "阈值", value: formatNumber(item.thresholdValue) },
            { label: "优先级", value: formatNumber(item.priority, 0) },
            { label: "动作类型", value: item.actionType },
            { label: "启用状态", value: statusText }
          ])}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">消息模板</div>
        <div class="detail-section-body">${escapeHtml(item.messageTemplate)}</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">扩展阈值 JSON</div>
        <div class="detail-section-body">${escapeHtml(item.thresholdJson || "-")}</div>
      </div>
    </div>
  `;
}

function updateRulesStats(items) {
  const total = items?.length || 0;
  const enabled = (items || []).filter((item) => Number(item.enabled) === 1).length;
  const disabled = total - enabled;
  byId("rulesStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">启用：${formatNumber(enabled, 0)}</div>
    <div class="stats-pill">停用：${formatNumber(disabled, 0)}</div>
  `;
}

function getFilteredRules(items) {
  const enabledFilter = byId("ruleEnabledFilter").value;
  const ruleTypeFilter = (byId("ruleTypeFilter").value || "").trim().toUpperCase();
  return (items || []).filter((item) => {
    const enabledMatched = enabledFilter === "all" || String(item.enabled) === enabledFilter;
    const typeMatched = !ruleTypeFilter || String(item.ruleType || "").toUpperCase().includes(ruleTypeFilter);
    return enabledMatched && typeMatched;
  });
}

function renderRules(items) {
  const host = byId("rulesList");
  if (!items || items.length === 0) {
    updateRulesStats([]);
    renderEmptyBoard("rulesList", token ? "当前筛选条件下暂无规则" : "请先登录并选择家庭");
    renderRuleDetail(null);
    return;
  }
  host.classList.remove("empty-board");
  updateRulesStats(items);
  host.innerHTML = `
    <div class="data-table">
      <div class="data-table-header rules-table-header">
        <div>规则名称</div>
        <div>规则类型</div>
        <div>指标类型</div>
        <div>优先级</div>
        <div>状态</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row rules-table-row ${item.id === selectedRuleId ? "is-active" : ""}" data-action="select-rule" data-rule-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">规则名称</span>
              <span class="data-cell-value">${escapeHtml(item.ruleName)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">规则类型</span>
              <span class="data-cell-value">${escapeHtml(item.ruleType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">指标类型</span>
              <span class="data-cell-value">${escapeHtml(item.metricType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">优先级</span>
              <span class="data-cell-value">${formatNumber(item.priority, 0)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用中" : "已停用"}</span>
            </div>
            <div class="data-cell data-cell-actions">
              <div class="table-action-group">
                <button class="mini-btn" type="button" data-action="toggle-rule" data-rule-id="${item.id}" data-enabled="${item.enabled}">${Number(item.enabled) === 1 ? "停用规则" : "启用规则"}</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
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
  const readText = Number(item.readStatus) === 1 ? "已读" : "未读";
  host.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div>
          <h3 class="detail-title">${escapeHtml(item.title)}</h3>
          <div class="detail-subtitle">通知详情，展示来源、等级、目标成员和发送状态。</div>
        </div>
        <div class="detail-badge-row">
          <span class="status-chip ${Number(item.readStatus) === 1 ? "read" : "unread"}">${readText}</span>
          <span class="status-chip muted">${escapeHtml(item.levelCode)}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">通知属性</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs([
            { label: "来源类型", value: item.sourceType },
            { label: "通知等级", value: item.levelCode },
            { label: "已读状态", value: readText },
            { label: "目标成员", value: formatNumber(item.targetMemberId, 0) },
            { label: "发送时间", value: formatDateTime(item.sentAt) },
            { label: "创建时间", value: formatDateTime(item.createdAt) }
          ])}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">通知内容</div>
        <div class="detail-section-body">${escapeHtml(item.content)}</div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="mark-notification-read" data-notification-id="${item.id}">标记已读</button>
        <button class="mini-btn danger" type="button" data-action="delete-notification" data-notification-id="${item.id}">删除通知</button>
      </div>
    </div>
  `;
}

function updateNotificationsStats(items) {
  const total = items?.length || 0;
  const read = (items || []).filter((item) => Number(item.readStatus) === 1).length;
  const unread = total - read;
  byId("notificationsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">未读：${formatNumber(unread, 0)}</div>
    <div class="stats-pill">已读：${formatNumber(read, 0)}</div>
  `;
}

function renderNotifications(items) {
  const host = byId("notificationsList");
  if (!items || items.length === 0) {
    updateNotificationsStats([]);
    renderEmptyBoard("notificationsList", token ? "当前筛选条件下暂无通知" : "请先登录并选择家庭");
    renderNotificationDetail(null);
    return;
  }
  host.classList.remove("empty-board");
  updateNotificationsStats(items);
  host.innerHTML = `
    <div class="data-table">
      <div class="data-table-header notifications-table-header">
        <div>标题</div>
        <div>等级</div>
        <div>来源类型</div>
        <div>状态</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row notifications-table-row ${item.id === selectedNotificationId ? "is-active" : ""}" data-action="select-notification" data-notification-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">标题</span>
              <span class="data-cell-value">${escapeHtml(item.title)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">等级</span>
              <span class="data-cell-value">${escapeHtml(item.levelCode)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">来源类型</span>
              <span class="data-cell-value">${escapeHtml(item.sourceType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.readStatus) === 1 ? "read" : "unread"}">${Number(item.readStatus) === 1 ? "已读" : "未读"}</span>
            </div>
            <div class="data-cell data-cell-actions">
              <div class="table-action-group">
                <button class="mini-btn" type="button" data-action="mark-notification-read" data-notification-id="${item.id}">已读</button>
                <button class="mini-btn danger" type="button" data-action="delete-notification" data-notification-id="${item.id}">删除</button>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  const selected = items.find((item) => item.id === selectedNotificationId) || items[0];
  selectedNotificationId = selected?.id ?? null;
  renderNotificationDetail(selected || null);
}

function renderSummary(summary) {
  latestSummary = summary;
  const retailOverview = summary?.retailOverview || {};
  const worldBankTrend = summary?.worldBankTrend || {};
  const fredSeries = summary?.fredSeries || {};

  renderMetric("metricTotalRecords", formatNumber(retailOverview.totalRecords, 0));
  renderMetric("metricTotalAmount", formatNumber(retailOverview.totalAmount));
  renderMetric("metricWorldBankPoints", formatNumber(worldBankTrend.points?.length || 0, 0));
  renderMetric("metricFredPoints", formatNumber(fredSeries.points?.length || 0, 0));
  renderCountryList(retailOverview.topCountries || []);
  renderWorldBank(worldBankTrend);
  renderFred(fredSeries);
  renderConclusions(summary?.conclusions || []);
  renderRaw(summary);
}

function resetSummary() {
  renderMetric("metricTotalRecords", "-");
  renderMetric("metricTotalAmount", "-");
  renderMetric("metricWorldBankPoints", "-");
  renderMetric("metricFredPoints", "-");
  renderCountryList([]);
  renderWorldBank(null);
  renderFred(null);
  renderConclusions([]);
  renderRaw({ message: "waiting" });
}

function applyImportPreset(batchSize, truncate) {
  byId("batchSizeInput").value = String(batchSize);
  byId("truncateBeforeImportInput").checked = String(truncate) === "true";
  setImportStatuses(`已应用导入预设：batchSize=${batchSize}，truncate=${truncate}`);
}

function syncImportParamsToAnalysis() {
  switchView("analysis");
  setImportStatuses("已同步导入参数，当前可直接执行导入或加载汇总。");
}

function fillImportParamsFromHistory(record) {
  if (!record) {
    return;
  }
  byId("processedDirInput").value = record.params.processedDir || "data/processed";
  byId("batchSizeInput").value = String(record.params.batchSize || 5000);
  byId("truncateBeforeImportInput").checked = Boolean(record.params.truncateBeforeImport);
  setImportStatuses("已回填导入参数。");
}

function updateViewMeta(view) {
  const metas = {
    analysis: {
      eyebrow: "数据治理与分析后台",
      title: "真实数据分析总控台",
      breadcrumb: "后台首页 / 真实数据分析"
    },
    imports: {
      eyebrow: "Import Center",
      title: "导入管理中心",
      breadcrumb: "后台首页 / 导入管理"
    },
    rules: {
      eyebrow: "Rules And Notifications",
      title: "规则与通知工作台",
      breadcrumb: "后台首页 / 规则与通知"
    },
    acceptance: {
      eyebrow: "Acceptance",
      title: "系统联通验收",
      breadcrumb: "后台首页 / 系统验收"
    }
  };
  const meta = metas[view] || metas.analysis;
  byId("pageEyebrow").textContent = meta.eyebrow;
  byId("pageTitle").textContent = meta.title;
  byId("pageBreadcrumb").textContent = meta.breadcrumb;
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll("[data-view]").forEach((node) => {
    const isActive = node.dataset.view === view;
    if (node.classList.contains("menu-item") || node.classList.contains("view-tab")) {
      node.classList.toggle("is-active", isActive);
    }
  });
  document.querySelectorAll(".view-section").forEach((node) => {
    node.classList.toggle("is-active", node.id === `${view}View`);
  });
  updateViewMeta(view);
}

async function loadMe() {
  if (!token) {
    return;
  }
  try {
    const response = await api("/api/auth/me");
    saveSession({
      accessToken: token,
      user: response.user,
      memberships: response.memberships
    });
    renderSession(response.user);
    renderMemberships(response.memberships || []);
  } catch (error) {
    clearSession();
    setRulesStatus(`登录态已失效：${error.message}`, true);
  }
}

async function handleLogin() {
  const username = (byId("username").value || "").trim();
  const password = byId("password").value || "";
  if (!username || !password) {
    setImportStatuses("请输入用户名和密码。", true);
    return;
  }
  try {
    setImportStatuses("登录中...");
    const response = await api("/api/auth/login", {
      method: "POST",
      auth: false,
      body: { username, password }
    });
    saveSession(response);
    renderSession(response.user || null);
    renderMemberships(response.memberships || []);
    setImportStatuses("登录成功，已接通家庭与成员上下文。");
    setRulesStatus("登录成功，可以加载规则与通知。");
    if (getCurrentFamilyId()) {
      await Promise.all([loadRules(), loadNotifications()]);
    }
  } catch (error) {
    clearSession();
    setImportStatuses(`登录失败：${error.message}`, true);
  }
}

async function performImport() {
  const params = getImportParams();
  try {
    setImportStatuses("正在导入真实数据...");
    const response = await api(`/api/real-data-analysis/import${buildQuery(params)}`, {
      method: "POST",
      auth: false
    });
    latestImport = response;
    renderLatestImport(response);
    setImportStatuses(`导入完成：retail=${formatNumber(response.retailImported, 0)}，world=${formatNumber(response.worldBankImported, 0)}，fred=${formatNumber(response.fredImported, 0)}`);
    await loadImportHistory();
    return response;
  } catch (error) {
    setImportStatuses(`导入失败：${error.message}`, true);
    throw error;
  }
}

async function loadImportHistory() {
  try {
    const items = await api("/api/real-data-analysis/imports", { auth: false });
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
    setImportStatuses(`导入历史加载失败：${error.message}`, true);
  }
}

async function loadSummary() {
  const params = getAnalysisParams();
  try {
    setImportStatuses("正在加载分析汇总...");
    const response = await api(`/api/real-data-analysis/defense-summary${buildQuery(params)}`, { auth: false });
    renderSummary(response);
    setImportStatuses("分析汇总已刷新。");
    return response;
  } catch (error) {
    setImportStatuses(`汇总加载失败：${error.message}`, true);
    throw error;
  }
}

async function runAcceptance() {
  try {
    setImportStatuses("开始执行一键验收：导入 -> 汇总 -> 规则/通知刷新。");
    await performImport();
    await loadSummary();
    if (token && getCurrentFamilyId()) {
      await Promise.all([loadRules(), loadNotifications()]);
    }
    setImportStatuses("一键验收完成。");
    switchView("acceptance");
  } catch (error) {
    setImportStatuses(`一键验收失败：${error.message}`, true);
  }
}

async function loadRules() {
  const familyId = getCurrentFamilyId();
  if (!token) {
    renderRules([]);
    setRulesStatus("请先登录后再加载规则。", true);
    return;
  }
  if (!familyId) {
    renderRules([]);
    setRulesStatus("请先选择家庭。", true);
    return;
  }
  try {
    setRulesStatus("加载规则中...");
    allRules = await api(`/api/rules${buildQuery({ familyId })}`);
    filteredRules = getFilteredRules(allRules);
    if (selectedRuleId && !filteredRules.some((item) => item.id === selectedRuleId)) {
      selectedRuleId = null;
    }
    renderRules(filteredRules);
    setRulesStatus(`规则加载完成，共 ${formatNumber(allRules.length, 0)} 条。`);
  } catch (error) {
    renderRules([]);
    setRulesStatus(`规则加载失败：${error.message}`, true);
  }
}

async function toggleRule(ruleId, enabled) {
  try {
    const action = Number(enabled) === 1 ? "disable" : "enable";
    await api(`/api/rules/${ruleId}/${action}`, { method: "POST" });
    setRulesStatus(`${Number(enabled) === 1 ? "停用" : "启用"}规则成功。`);
    await loadRules();
  } catch (error) {
    setRulesStatus(`切换规则失败：${error.message}`, true);
  }
}

async function evaluateRules() {
  const familyId = getCurrentFamilyId();
  if (!token || !familyId) {
    setRulesStatus("执行规则评估前请先登录并选择家庭。", true);
    return;
  }
  try {
    setRulesStatus("正在执行规则评估...");
    const response = await api(`/api/rules/evaluate${buildQuery({ familyId })}`, { method: "POST" });
    const detailText = (response.details || []).slice(0, 3).join("；") || "无附加细节";
    setRulesStatus(`规则评估完成：触发 ${formatNumber(response.triggeredRuleCount, 0)} 条，生成通知 ${formatNumber(response.generatedNotificationCount, 0)} 条。${detailText}`);
    await Promise.all([loadRules(), loadNotifications()]);
  } catch (error) {
    setRulesStatus(`规则评估失败：${error.message}`, true);
  }
}

async function loadNotifications() {
  const familyId = getCurrentFamilyId();
  if (!token) {
    renderNotifications([]);
    setRulesStatus("请先登录后再加载通知。", true);
    return;
  }
  if (!familyId) {
    renderNotifications([]);
    setRulesStatus("请先选择家庭。", true);
    return;
  }
  const params = {
    familyId,
    targetMemberId: getCurrentMemberId(),
    readStatus: byId("notificationReadFilter").value,
    sourceType: (byId("notificationSourceFilter").value || "").trim().toUpperCase(),
    page: 0,
    size: Number(byId("notificationPageSize").value || 8)
  };
  try {
    setRulesStatus("加载通知中...");
    const page = await api(`/api/notifications/search${buildQuery(params)}`);
    notificationsPage = page.items || [];
    if (selectedNotificationId && !notificationsPage.some((item) => item.id === selectedNotificationId)) {
      selectedNotificationId = null;
    }
    renderNotifications(notificationsPage);
    setRulesStatus(`通知加载完成，本页 ${formatNumber(notificationsPage.length, 0)} 条，总计 ${formatNumber(page.totalElements, 0)} 条。`);
  } catch (error) {
    renderNotifications([]);
    setRulesStatus(`通知加载失败：${error.message}`, true);
  }
}

async function markNotificationRead(notificationId) {
  try {
    await api(`/api/notifications/${notificationId}/read`, { method: "POST" });
    setRulesStatus("通知已标记为已读。");
    await loadNotifications();
  } catch (error) {
    setRulesStatus(`通知已读失败：${error.message}`, true);
  }
}

async function deleteNotification(notificationId) {
  try {
    await api(`/api/notifications/${notificationId}`, { method: "DELETE" });
    setRulesStatus("通知已删除。");
    await loadNotifications();
  } catch (error) {
    setRulesStatus(`删除通知失败：${error.message}`, true);
  }
}

async function markAllNotificationsRead() {
  const familyId = getCurrentFamilyId();
  if (!token || !familyId) {
    setRulesStatus("请先登录并选择家庭。", true);
    return;
  }
  try {
    const response = await api(`/api/notifications/read-all${buildQuery({ familyId, targetMemberId: getCurrentMemberId() })}`, { method: "POST" });
    setRulesStatus(`批量已读完成，影响 ${formatNumber(response.affectedCount, 0)} 条通知。`);
    await loadNotifications();
  } catch (error) {
    setRulesStatus(`批量已读失败：${error.message}`, true);
  }
}

async function clearReadNotifications() {
  const familyId = getCurrentFamilyId();
  if (!token || !familyId) {
    setRulesStatus("请先登录并选择家庭。", true);
    return;
  }
  try {
    const response = await api(`/api/notifications/read${buildQuery({ familyId, targetMemberId: getCurrentMemberId() })}`, { method: "DELETE" });
    setRulesStatus(`清理已读完成，删除 ${formatNumber(response.affectedCount, 0)} 条通知。`);
    await loadNotifications();
  } catch (error) {
    setRulesStatus(`清理已读失败：${error.message}`, true);
  }
}

function handleDocumentClick(event) {
  const actionNode = event.target.closest("[data-action], [data-view]");
  if (!actionNode) {
    return;
  }

  if (actionNode.dataset.view) {
    switchView(actionNode.dataset.view);
    return;
  }

  const { action } = actionNode.dataset;
  if (!action) {
    return;
  }

  switch (action) {
    case "apply-import-preset":
      applyImportPreset(actionNode.dataset.batchSize, actionNode.dataset.truncate);
      break;
    case "select-import-history":
      selectedImportHistoryId = Number(actionNode.dataset.historyId);
      renderImportHistory();
      renderImportHistoryDetail();
      break;
    case "reuse-import-history": {
      const record = importHistory.find((item) => item.id === Number(actionNode.dataset.historyId));
      fillImportParamsFromHistory(record);
      break;
    }
    case "load-summary-from-history": {
      const record = importHistory.find((item) => item.id === Number(actionNode.dataset.historyId));
      fillImportParamsFromHistory(record);
      syncImportParamsToAnalysis();
      loadSummary();
      break;
    }
    case "show-import-payload": {
      const record = importHistory.find((item) => item.id === Number(actionNode.dataset.historyId));
      if (record) {
        switchView("analysis");
        renderRaw(record.result);
        setImportStatuses("已在分析面板显示导入回执。");
      }
      break;
    }
    case "select-rule": {
      selectedRuleId = Number(actionNode.dataset.ruleId);
      const item = filteredRules.find((rule) => rule.id === selectedRuleId) || null;
      renderRules(filteredRules);
      renderRuleDetail(item);
      break;
    }
    case "toggle-rule":
      event.stopPropagation();
      toggleRule(Number(actionNode.dataset.ruleId), Number(actionNode.dataset.enabled));
      break;
    case "select-notification": {
      selectedNotificationId = Number(actionNode.dataset.notificationId);
      const item = notificationsPage.find((notification) => notification.id === selectedNotificationId) || null;
      renderNotifications(notificationsPage);
      renderNotificationDetail(item);
      break;
    }
    case "mark-notification-read":
      event.stopPropagation();
      markNotificationRead(Number(actionNode.dataset.notificationId));
      break;
    case "delete-notification":
      event.stopPropagation();
      deleteNotification(Number(actionNode.dataset.notificationId));
      break;
    default:
      break;
  }
}

function bindEvents() {
  byId("loginBtn").addEventListener("click", handleLogin);
  byId("importBtn").addEventListener("click", performImport);
  byId("importBtnMirror").addEventListener("click", performImport);
  byId("summaryBtn").addEventListener("click", loadSummary);
  byId("acceptanceBtn").addEventListener("click", runAcceptance);
  byId("acceptanceBtnMirror").addEventListener("click", runAcceptance);
  byId("syncAnalysisParamsBtn").addEventListener("click", syncImportParamsToAnalysis);
  byId("clearImportHistoryBtn").addEventListener("click", loadImportHistory);
  byId("loadRulesBtn").addEventListener("click", loadRules);
  byId("evaluateRulesBtn").addEventListener("click", evaluateRules);
  byId("loadNotificationsBtn").addEventListener("click", loadNotifications);
  byId("readAllNotificationsBtn").addEventListener("click", markAllNotificationsRead);
  byId("clearReadNotificationsBtn").addEventListener("click", clearReadNotifications);
  byId("familySelect").addEventListener("change", async () => {
    updateMemberOptions();
    if (token) {
      await Promise.all([loadRules(), loadNotifications()]);
    }
  });
  byId("memberSelect").addEventListener("change", () => {
    if (token) {
      loadNotifications();
    }
  });
  byId("ruleEnabledFilter").addEventListener("change", () => {
    filteredRules = getFilteredRules(allRules);
    renderRules(filteredRules);
  });
  byId("ruleTypeFilter").addEventListener("input", () => {
    filteredRules = getFilteredRules(allRules);
    renderRules(filteredRules);
  });
  byId("notificationReadFilter").addEventListener("change", loadNotifications);
  byId("notificationSourceFilter").addEventListener("input", loadNotifications);
  byId("notificationPageSize").addEventListener("change", loadNotifications);
  document.addEventListener("click", handleDocumentClick);
}

async function init() {
  restoreSession();
  resetSummary();
  renderLatestImport(null);
  renderImportHistory();
  renderImportHistoryDetail();
  renderRules([]);
  renderNotifications([]);
  switchView(activeView);
  bindEvents();
  await loadImportHistory();
  if (token) {
    await loadMe();
    if (getCurrentFamilyId()) {
      await Promise.all([loadRules(), loadNotifications()]);
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
