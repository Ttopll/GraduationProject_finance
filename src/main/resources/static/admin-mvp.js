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
let accounts = [];
let categories = [];
let budgets = [];
let budgetUsage = [];
let transactionItems = [];
let transactionMonthlySummary = [];
let transactionTotalElements = 0;
let selectedAccountId = null;
let selectedCategoryId = null;
let selectedBudgetId = null;
let selectedTransactionId = null;
let businessFormType = null;
let businessFormMode = "create";
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
  accounts = [];
  categories = [];
  budgets = [];
  budgetUsage = [];
  transactionItems = [];
  transactionMonthlySummary = [];
  transactionTotalElements = 0;
  selectedRuleId = null;
  selectedNotificationId = null;
  selectedAccountId = null;
  selectedCategoryId = null;
  selectedBudgetId = null;
  selectedTransactionId = null;
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_SESSION_KEY);
  renderSession(null);
  renderMemberships([]);
  renderRules([]);
  renderNotifications([]);
  renderAccounts([]);
  renderCategories([]);
  renderBudgets([]);
  renderTransactions([]);
  renderTransactionMonthlySummary([]);
  setRulesStatus("请先登录后再加载规则与通知。", true);
  setBusinessStatus("请先登录后再加载业务模块。", true);
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

function setBusinessStatus(message, isError = false) {
  setStatus("businessStatus", message, isError);
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

function formatLocalDateTimeForApi(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function formatLocalDateForApi(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(value);
}

function sortEnabledFirst(items, enabledKey) {
  return [...items].sort((left, right) => {
    const leftEnabled = Number(left?.[enabledKey]) === 1 ? 1 : 0;
    const rightEnabled = Number(right?.[enabledKey]) === 1 ? 1 : 0;
    if (leftEnabled !== rightEnabled) {
      return rightEnabled - leftEnabled;
    }
    return String(left?.id ?? "").localeCompare(String(right?.id ?? ""), "zh-CN", { numeric: true });
  });
}

function buildAccountOptions(includeEmpty = false, emptyLabel = "请选择账户") {
  const items = sortEnabledFirst(accounts, "status").map((item) => ({
    value: String(item.id),
    label: `${item.accountName} / ${item.accountType}${Number(item.status) === 1 ? "" : " / 已停用"}`
  }));
  return includeEmpty ? [{ value: "", label: emptyLabel }, ...items] : items;
}

function buildCategoryOptions(includeEmpty = false, emptyLabel = "请选择分类") {
  const items = sortEnabledFirst(categories, "enabled").map((item) => ({
    value: String(item.id),
    label: `${item.categoryName} / ${item.categoryType}${Number(item.enabled) === 1 ? "" : " / 已停用"}`
  }));
  return includeEmpty ? [{ value: "", label: emptyLabel }, ...items] : items;
}

function buildParentCategoryOptions(selectedId = null) {
  return [{ value: "", label: "无父分类" }].concat(
    sortEnabledFirst(categories, "enabled")
      .filter((item) => item.id !== selectedId)
      .map((item) => ({
        value: String(item.id),
        label: `${item.categoryName} / ${item.categoryType}${Number(item.enabled) === 1 ? "" : " / 已停用"}`
      }))
  );
}

function formatAccountRef(accountId) {
  if (!accountId) {
    return "-";
  }
  const account = accounts.find((item) => Number(item.id) === Number(accountId));
  if (!account) {
    return `账户#${formatNumber(accountId, 0)}`;
  }
  return `${account.accountName} / ${account.accountType}`;
}

function formatCategoryRef(categoryId) {
  if (!categoryId) {
    return "-";
  }
  const category = categories.find((item) => Number(item.id) === Number(categoryId));
  if (!category) {
    return `分类#${formatNumber(categoryId, 0)}`;
  }
  return `${category.categoryName} / ${category.categoryType}`;
}

function formatMemberRef(memberId) {
  if (!memberId) {
    return "-";
  }
  const member = memberships.find((item) => Number(item.familyMemberId) === Number(memberId));
  if (!member) {
    return `成员#${formatNumber(memberId, 0)}`;
  }
  return `${member.roleCode || "MEMBER"} / ${member.familyName || `家庭${member.familyId}`}`;
}

function getSelectedBusinessItem(type) {
  if (type === "account") {
    return accounts.find((item) => item.id === selectedAccountId) || null;
  }
  if (type === "category") {
    return categories.find((item) => item.id === selectedCategoryId) || null;
  }
  if (type === "budget") {
    return budgets.find((item) => item.id === selectedBudgetId) || null;
  }
  if (type === "transaction") {
    return transactionItems.find((item) => item.id === selectedTransactionId) || null;
  }
  return null;
}

function openBusinessForm(type, mode = "create") {
  businessFormType = type;
  businessFormMode = mode;
  renderBusinessForm(type);
  clearBusinessFormErrors();
  byId("businessFormModal").hidden = false;
}

function closeBusinessForm() {
  businessFormType = null;
  businessFormMode = "create";
  byId("businessForm").reset();
  byId("businessFormFields").innerHTML = "";
  byId("businessFormModal").hidden = true;
}

function renderBusinessFormField(field) {
  const isSelect = field.type === "select";
  const isTextarea = field.type === "textarea";
  const className = `field-group${field.full ? " is-full" : ""}`;

  if (isSelect) {
    return `
      <label class="${className}" data-field-name="${escapeHtml(field.name)}">
        <span>${escapeHtml(field.label)}</span>
        <select class="field-input" name="${escapeHtml(field.name)}" ${field.required ? "required" : ""}>
          ${(field.options || []).map((option) => `
            <option value="${escapeHtml(option.value)}" ${String(option.value) === String(field.value ?? "") ? "selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
        <div class="field-error" hidden></div>
      </label>
    `;
  }

  if (isTextarea) {
    return `
      <label class="${className}" data-field-name="${escapeHtml(field.name)}">
        <span>${escapeHtml(field.label)}</span>
        <textarea class="field-input" name="${escapeHtml(field.name)}" rows="4" ${field.required ? "required" : ""}>${escapeHtml(field.value ?? "")}</textarea>
        <div class="field-error" hidden></div>
      </label>
    `;
  }

  return `
    <label class="${className}" data-field-name="${escapeHtml(field.name)}">
      <span>${escapeHtml(field.label)}</span>
      <input
        class="field-input"
        name="${escapeHtml(field.name)}"
        type="${escapeHtml(field.type || "text")}"
        value="${escapeHtml(field.value ?? "")}"
        ${field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : ""}
        ${field.required ? "required" : ""}
        ${field.step ? `step="${escapeHtml(field.step)}"` : ""}
      >
      <div class="field-error" hidden></div>
    </label>
  `;
}

function getBusinessFormConfig(type) {
  const familyId = getCurrentFamilyId();
  const selectedCategory = categories.find((item) => item.id === selectedCategoryId);
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId);
  const selectedItem = getSelectedBusinessItem(type);
  const isEdit = businessFormMode === "edit";
  const commonTypes = {
    account: {
      title: isEdit ? "编辑账户" : "新增账户",
      subtitle: isEdit ? "Account Update" : "Account Create",
      submitText: isEdit ? "保存账户" : "创建账户",
      fields: [
        ...(isEdit ? [] : [{ label: "家庭 ID", name: "familyId", type: "number", value: familyId ?? "", required: true }]),
        { label: "账户名称", name: "accountName", value: selectedItem?.accountName || "招商银行储蓄卡", required: true },
        { label: "账户类型", name: "accountType", type: "select", value: selectedItem?.accountType || "DEBIT", required: true, options: [
          { value: "DEBIT", label: "借记卡" },
          { value: "CREDIT", label: "信用卡" },
          { value: "CASH", label: "现金" },
          { value: "ALIPAY", label: "支付宝" },
          { value: "WECHAT", label: "微信" }
        ] },
        { label: "机构名称", name: "institutionName", value: selectedItem?.institutionName || "招商银行" },
        ...(!isEdit ? [{ label: "当前余额", name: "currentBalance", type: "number", value: "0", step: "0.01" }] : []),
        { label: "卡号掩码", name: "accountNoMask", value: selectedItem?.accountNoMask || "" },
        { label: "信用额度", name: "creditLimit", type: "number", value: selectedItem?.creditLimit ?? "", step: "0.01" },
        { label: "账单日", name: "billingDay", type: "number", value: selectedItem?.billingDay ?? "" },
        { label: "还款日", name: "repaymentDay", type: "number", value: selectedItem?.repaymentDay ?? "" },
        { label: "是否共享", name: "isShared", type: "select", value: String(selectedItem?.isShared ?? 0), options: [
          { value: "0", label: "否" },
          { value: "1", label: "是" }
        ] },
        { label: "备注", name: "remark", full: true, value: selectedItem?.remark || "" }
      ]
    },
    category: {
      title: isEdit ? "编辑分类" : "新增分类",
      subtitle: isEdit ? "Category Update" : "Category Create",
      submitText: isEdit ? "保存分类" : "创建分类",
      fields: [
        ...(isEdit ? [] : [{ label: "家庭 ID", name: "familyId", type: "number", value: familyId ?? "", required: true }]),
        { label: "分类名称", name: "categoryName", value: selectedItem?.categoryName || "餐饮", required: true },
        { label: "分类类型", name: "categoryType", type: "select", value: selectedItem?.categoryType || selectedCategory?.categoryType || "EXPENSE", required: true, options: [
          { value: "EXPENSE", label: "支出" },
          { value: "INCOME", label: "收入" }
        ] },
        { label: "作用域", name: "scopeType", type: "select", value: selectedItem?.scopeType || "FAMILY", options: [
          { value: "FAMILY", label: "家庭" },
          { value: "PERSONAL", label: "个人" }
        ] },
        { label: "父分类", name: "parentId", type: "select", value: selectedItem?.parentId ?? "", options: buildParentCategoryOptions(selectedItem?.id ?? null) },
        { label: "图标代码", name: "iconCode", value: selectedItem?.iconCode || "" },
        { label: "排序", name: "sortOrder", type: "number", value: selectedItem?.sortOrder ?? "0" }
      ]
    },
    budget: {
      title: isEdit ? "编辑预算" : "新增预算",
      subtitle: isEdit ? "Budget Update" : "Budget Create",
      submitText: isEdit ? "保存预算" : "创建预算",
      fields: [
        ...(isEdit ? [] : [{ label: "家庭 ID", name: "familyId", type: "number", value: familyId ?? "", required: true }]),
        { label: "预算名称", name: "budgetName", value: selectedItem?.budgetName || "餐饮月预算", required: true },
        { label: "预算分类", name: "categoryId", type: "select", value: selectedItem?.categoryId ?? selectedCategoryId ?? "", required: true, options: buildCategoryOptions(true, "请选择预算分类") },
        { label: "周期类型", name: "periodType", type: "select", value: selectedItem?.periodType || "MONTHLY", required: true, options: [
          { value: "MONTHLY", label: "月度" },
          { value: "WEEKLY", label: "周度" },
          { value: "YEARLY", label: "年度" }
        ] },
        { label: "预算金额", name: "amount", type: "number", value: selectedItem?.amount ?? "2000", step: "0.01", required: true },
        { label: "预警比例", name: "alertRatio", type: "number", value: selectedItem?.alertRatio ?? "0.8", step: "0.01" },
        { label: "开始日期", name: "startDate", type: "date", value: selectedItem?.startDate || formatLocalDateForApi(), required: true },
        { label: "结束日期", name: "endDate", type: "date", value: selectedItem?.endDate || "" },
        { label: "备注", name: "remark", full: true, value: selectedItem?.remark || "" }
      ]
    },
    transaction: {
      title: isEdit ? "编辑交易" : "新增交易",
      subtitle: isEdit ? "Transaction Update" : "Transaction Create",
      submitText: isEdit ? "保存交易" : "创建交易",
      fields: [
        ...(isEdit ? [] : [{ label: "家庭 ID", name: "familyId", type: "number", value: familyId ?? "", required: true }]),
        { label: "交易账户", name: "accountId", type: "select", value: selectedItem?.accountId ?? selectedAccount?.id ?? "", required: true, options: buildAccountOptions(true, "请选择交易账户") },
        { label: "目标账户", name: "targetAccountId", type: "select", value: selectedItem?.targetAccountId ?? "", options: buildAccountOptions(true, "请选择目标账户") },
        { label: "交易分类", name: "categoryId", type: "select", value: selectedItem?.categoryId ?? selectedCategoryId ?? "", options: buildCategoryOptions(true, "请选择交易分类") },
        { label: "交易类型", name: "transactionType", type: "select", value: selectedItem?.transactionType || "EXPENSE", required: true, options: [
          { value: "EXPENSE", label: "支出" },
          { value: "INCOME", label: "收入" },
          { value: "TRANSFER", label: "转账" }
        ] },
        { label: "交易金额", name: "amount", type: "number", value: selectedItem?.amount ?? "100", step: "0.01", required: true },
        { label: "交易时间", name: "transactionTime", type: "datetime-local", value: (selectedItem?.transactionTime ? String(selectedItem.transactionTime).slice(0, 16) : formatLocalDateTimeForApi().slice(0, 16)), required: true },
        { label: "商户名称", name: "merchantName", value: selectedItem?.merchantName || "线下消费" },
        { label: "交易对手", name: "counterpartyName", value: selectedItem?.counterpartyName || "" },
        { label: "来源平台", name: "sourcePlatform", value: selectedItem?.sourcePlatform || "" },
        { label: "外部单号", name: "externalTradeNo", value: selectedItem?.externalTradeNo || "" },
        { label: "备注", name: "note", full: true, value: selectedItem?.note || "" }
      ]
    }
  };
  return commonTypes[type];
}

function renderBusinessForm(type) {
  const config = getBusinessFormConfig(type);
  if (!config) {
    return;
  }
  byId("businessFormTitle").textContent = config.title;
  byId("businessFormSubtitle").textContent = config.subtitle;
  byId("businessFormSubmitBtn").textContent = config.submitText;
  byId("businessFormSubmitBtn").dataset.idleText = config.submitText;
  byId("businessFormFields").innerHTML = config.fields.map(renderBusinessFormField).join("");
  syncTransactionFormBehavior();
  applyBusinessFormPrerequisiteMessage();
}

function getBusinessFormData() {
  const formData = new FormData(byId("businessForm"));
  return Object.fromEntries(formData.entries());
}

function getBusinessFormPrerequisiteMessage(type) {
  if (type === "budget" && categories.length === 0) {
    return "当前家庭还没有可选分类，请先创建分类后再维护预算。";
  }
  if (type === "transaction") {
    if (accounts.length === 0) {
      return "当前家庭还没有可选账户，请先创建账户后再维护交易。";
    }
    if (categories.length === 0) {
      return "当前家庭还没有可选分类，收入或支出交易将无法直接提交，建议先创建分类。";
    }
  }
  return "";
}

function setBusinessFormStatus(message = "", isError = true) {
  const node = byId("businessFormStatus");
  if (!message) {
    node.hidden = true;
    node.textContent = "";
    return;
  }
  node.hidden = false;
  node.textContent = message;
  node.style.borderColor = isError ? "#fecaca" : "#bbf7d0";
  node.style.background = isError ? "#fff1f2" : "#f0fdf4";
  node.style.color = isError ? "#b91c1c" : "#166534";
}

function setBusinessFormSubmitting(submitting) {
  const panel = byId("businessFormModal").querySelector(".modal-panel");
  const form = byId("businessForm");
  const submitBtn = byId("businessFormSubmitBtn");
  const cancelBtn = byId("businessFormCancelBtn");
  const closeBtn = byId("businessFormCloseBtn");
  const defaultText = businessFormMode === "edit" ? "保存" : "提交";

  panel.classList.toggle("is-submitting", submitting);
  form.querySelectorAll(".field-input").forEach((node) => {
    node.disabled = submitting;
  });
  submitBtn.disabled = submitting;
  cancelBtn.disabled = submitting;
  closeBtn.disabled = submitting;
  submitBtn.textContent = submitting ? "提交中..." : (submitBtn.dataset.idleText || defaultText);
}

function clearBusinessFormErrors() {
  setBusinessFormStatus("");
  byId("businessFormFields").querySelectorAll("[data-field-name]").forEach((wrapper) => {
    const input = wrapper.querySelector(".field-input");
    const errorNode = wrapper.querySelector(".field-error");
    if (input) {
      input.classList.remove("is-invalid");
    }
    if (errorNode) {
      errorNode.hidden = true;
      errorNode.textContent = "";
    }
  });
}

function applyBusinessFormPrerequisiteMessage() {
  const message = getBusinessFormPrerequisiteMessage(businessFormType);
  if (message) {
    setBusinessFormStatus(message, true);
  }
}

function getBusinessFieldWrapper(name) {
  return byId("businessFormFields").querySelector(`[data-field-name="${name}"]`);
}

function setBusinessFieldVisibility(name, visible) {
  const wrapper = getBusinessFieldWrapper(name);
  if (!wrapper) {
    return;
  }
  wrapper.hidden = !visible;
}

function setBusinessFieldRequired(name, required) {
  const wrapper = getBusinessFieldWrapper(name);
  if (!wrapper) {
    return;
  }
  const input = wrapper.querySelector(".field-input");
  if (input) {
    input.required = required;
  }
}

function setBusinessFieldLabel(name, label) {
  const wrapper = getBusinessFieldWrapper(name);
  if (!wrapper) {
    return;
  }
  const labelNode = wrapper.querySelector("span");
  if (labelNode) {
    labelNode.textContent = label;
  }
}

function syncTransactionFormBehavior() {
  if (businessFormType !== "transaction") {
    return;
  }
  const transactionTypeNode = byId("businessForm").elements.namedItem("transactionType");
  const transactionType = transactionTypeNode ? String(transactionTypeNode.value || "").toUpperCase() : "";
  const isTransfer = transactionType === "TRANSFER";
  setBusinessFieldVisibility("targetAccountId", true);
  setBusinessFieldRequired("targetAccountId", isTransfer);
  setBusinessFieldRequired("categoryId", !isTransfer);
  setBusinessFieldLabel("targetAccountId", isTransfer ? "目标账户" : "目标账户（转账时必填）");
  setBusinessFieldLabel("categoryId", isTransfer ? "交易分类（转账可不填）" : "交易分类");
  applyBusinessFormPrerequisiteMessage();
}

function renderBusinessFormErrors(errors) {
  clearBusinessFormErrors();
  const entries = Object.entries(errors);
  if (entries.length === 0) {
    return;
  }
  setBusinessFormStatus(entries[0][1], true);
  entries.forEach(([name, message]) => {
    const wrapper = byId("businessFormFields").querySelector(`[data-field-name="${name}"]`);
    if (!wrapper) {
      return;
    }
    const input = wrapper.querySelector(".field-input");
    const errorNode = wrapper.querySelector(".field-error");
    if (input) {
      input.classList.add("is-invalid");
    }
    if (errorNode) {
      errorNode.hidden = false;
      errorNode.textContent = message;
    }
  });
}

function validateBusinessForm(type, form) {
  const errors = {};
  const requireValue = (name, message) => {
    if (!String(form[name] ?? "").trim()) {
      errors[name] = message;
    }
  };
  const positiveNumber = (name, message) => {
    const value = form[name];
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Number.isNaN(Number(value)) || Number(value) <= 0) {
      errors[name] = message;
    }
  };
  const rangedInteger = (name, min, max, message) => {
    const value = form[name];
    if (value === undefined || value === null || value === "") {
      return;
    }
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
      errors[name] = message;
    }
  };

  if (type === "account") {
    if (businessFormMode === "create") {
      positiveNumber("familyId", "家庭 ID 必须为正整数。");
    }
    requireValue("accountName", "账户名称不能为空。");
    requireValue("accountType", "请选择账户类型。");
    positiveNumber("currentBalance", "当前余额必须大于 0 或填 0。");
    if (form.currentBalance !== "" && Number(form.currentBalance) < 0) {
      errors.currentBalance = "当前余额不能为负数。";
    }
    if (form.creditLimit !== "" && Number(form.creditLimit) < 0) {
      errors.creditLimit = "信用额度不能为负数。";
    }
    rangedInteger("billingDay", 1, 31, "账单日必须在 1 到 31 之间。");
    rangedInteger("repaymentDay", 1, 31, "还款日必须在 1 到 31 之间。");
  }

  if (type === "category") {
    if (businessFormMode === "create") {
      positiveNumber("familyId", "家庭 ID 必须为正整数。");
    }
    requireValue("categoryName", "分类名称不能为空。");
    requireValue("categoryType", "请选择分类类型。");
    if (form.parentId !== "" && Number(form.parentId) <= 0) {
      errors.parentId = "父分类 ID 必须为正整数。";
    }
    if (form.sortOrder !== "" && !Number.isInteger(Number(form.sortOrder))) {
      errors.sortOrder = "排序必须为整数。";
    }
  }

  if (type === "budget") {
    if (businessFormMode === "create") {
      positiveNumber("familyId", "家庭 ID 必须为正整数。");
    }
    requireValue("budgetName", "预算名称不能为空。");
    positiveNumber("categoryId", "分类 ID 必须为正整数。");
    requireValue("periodType", "请选择周期类型。");
    positiveNumber("amount", "预算金额必须大于 0。");
    requireValue("startDate", "开始日期不能为空。");
    if (form.alertRatio !== "") {
      const ratio = Number(form.alertRatio);
      if (Number.isNaN(ratio) || ratio < 0 || ratio > 1) {
        errors.alertRatio = "预警比例必须在 0 到 1 之间。";
      }
    }
    if (form.endDate && form.startDate && form.endDate < form.startDate) {
      errors.endDate = "结束日期不能早于开始日期。";
    }
  }

  if (type === "transaction") {
    if (businessFormMode === "create") {
      positiveNumber("familyId", "家庭 ID 必须为正整数。");
    }
    positiveNumber("accountId", "账户 ID 必须为正整数。");
    const isTransfer = String(form.transactionType || "").toUpperCase() === "TRANSFER";
    if (isTransfer) {
      positiveNumber("targetAccountId", "转账类型必须选择目标账户。");
      if (form.accountId && form.targetAccountId && String(form.accountId) === String(form.targetAccountId)) {
        errors.targetAccountId = "目标账户不能与交易账户相同。";
      }
    } else if (form.targetAccountId !== "" && Number(form.targetAccountId) <= 0) {
      errors.targetAccountId = "目标账户 ID 必须为正整数。";
    }
    if (!isTransfer && form.categoryId === "") {
      errors.categoryId = "收入或支出交易必须选择分类。";
    }
    if (form.categoryId !== "" && Number(form.categoryId) <= 0) {
      errors.categoryId = "分类 ID 必须为正整数。";
    }
    requireValue("transactionType", "请选择交易类型。");
    positiveNumber("amount", "交易金额必须大于 0。");
    requireValue("transactionTime", "交易时间不能为空。");
  }

  return errors;
}

function renderRuleDetail(item) {
  const host = byId("ruleDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧规则查看详情</div>';
    return;
  }
  const statusText = Number(item.enabled) === 1 ? "启用中" : "已停用";
  host.innerHTML = `
    <div class="detail-panel rule-detail-panel">
      <div class="detail-header">
        <div class="detail-header-main">
          <div class="detail-kicker">Rule Profile</div>
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
    <div class="detail-panel notification-detail-panel">
      <div class="detail-header">
        <div class="detail-header-main">
          <div class="detail-kicker">Notification Profile</div>
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

function renderBusinessMetrics() {
  renderMetric("metricAccountCount", formatNumber(accounts.length, 0));
  renderMetric("metricCategoryCount", formatNumber(categories.length, 0));
  renderMetric("metricBudgetCount", formatNumber(budgets.length, 0));
  renderMetric("metricTransactionCount", formatNumber(transactionTotalElements, 0));
}

function updateAccountsStats(items) {
  const total = items.length;
  const enabled = items.filter((item) => Number(item.status) === 1).length;
  const shared = items.filter((item) => Number(item.isShared) === 1).length;
  byId("accountsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">启用：${formatNumber(enabled, 0)}</div>
    <div class="stats-pill">共享：${formatNumber(shared, 0)}</div>
  `;
}

function renderAccountDetail(item) {
  const host = byId("accountDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧账户查看详情</div>';
    return;
  }
  host.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-header-main">
          <div class="detail-kicker">Account Profile</div>
          <h3 class="detail-title">${escapeHtml(item.accountName)}</h3>
          <div class="detail-subtitle">账户基础信息、余额、账单日和共享设置。</div>
        </div>
        <div class="detail-badge-row">
          <span class="status-chip ${Number(item.status) === 1 ? "enabled" : "disabled"}">${Number(item.status) === 1 ? "启用中" : "已停用"}</span>
          <span class="status-chip muted">${escapeHtml(item.accountType)}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">账户属性</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs([
            { label: "账户类型", value: item.accountType },
            { label: "所属成员", value: formatMemberRef(item.ownerMemberId) },
            { label: "余额", value: formatNumber(item.currentBalance) },
            { label: "信用额度", value: formatNumber(item.creditLimit) },
            { label: "账单日", value: formatNumber(item.billingDay, 0) },
            { label: "还款日", value: formatNumber(item.repaymentDay, 0) },
            { label: "共享账户", value: Number(item.isShared) === 1 ? "是" : "否" },
            { label: "卡号掩码", value: item.accountNoMask || "-" }
          ])}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">机构与备注</div>
        <div class="detail-section-body">${escapeHtml(item.institutionName || "-")} / ${escapeHtml(item.remark || "-")}</div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="create-account">新增账户</button>
        <button class="mini-btn" type="button" data-action="edit-account" data-account-id="${item.id}">编辑账户</button>
        <button class="mini-btn" type="button" data-action="toggle-account" data-account-id="${item.id}" data-status="${item.status}">${Number(item.status) === 1 ? "停用账户" : "启用账户"}</button>
        <button class="mini-btn danger" type="button" data-action="delete-account" data-account-id="${item.id}">删除账户</button>
      </div>
    </div>
  `;
}

function renderAccounts(items) {
  const host = byId("accountList");
  if (!items || items.length === 0) {
    updateAccountsStats([]);
    renderEmptyBoard("accountList", token ? "当前家庭暂无账户数据" : "请先登录并选择家庭");
    renderAccountDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateAccountsStats(items);
  host.innerHTML = `
    <div class="data-table">
      <div class="data-table-header accounts-table-header">
        <div>账户名称</div>
        <div>类型</div>
        <div>余额</div>
        <div>状态</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row accounts-table-row ${item.id === selectedAccountId ? "is-active" : ""}" data-action="select-account" data-account-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">账户名称</span>
              <span class="data-cell-value">${escapeHtml(item.accountName)}</span>
              <span class="data-cell-meta">${escapeHtml(item.institutionName || "-")} / ${escapeHtml(formatMemberRef(item.ownerMemberId))}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">类型</span>
              <span class="data-cell-value">${escapeHtml(item.accountType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">余额</span>
              <span class="data-cell-value">${formatNumber(item.currentBalance)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.status) === 1 ? "enabled" : "disabled"}">${Number(item.status) === 1 ? "启用" : "停用"}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  const selected = items.find((item) => item.id === selectedAccountId) || items[0];
  selectedAccountId = selected?.id ?? null;
  renderAccountDetail(selected || null);
  renderBusinessMetrics();
}

function updateCategoriesStats(items) {
  const total = items.length;
  const enabled = items.filter((item) => Number(item.enabled) === 1).length;
  const expense = items.filter((item) => String(item.categoryType).toUpperCase().includes("EXPENSE")).length;
  byId("categoriesStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">启用：${formatNumber(enabled, 0)}</div>
    <div class="stats-pill">支出：${formatNumber(expense, 0)}</div>
  `;
}

function renderCategoryDetail(item) {
  const host = byId("categoryDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧分类查看详情</div>';
    return;
  }
  host.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-header-main">
          <div class="detail-kicker">Category Profile</div>
          <h3 class="detail-title">${escapeHtml(item.categoryName)}</h3>
          <div class="detail-subtitle">分类层级、作用域和图标配置。</div>
        </div>
        <div class="detail-badge-row">
          <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用中" : "已停用"}</span>
          <span class="status-chip muted">${escapeHtml(item.categoryType)}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">分类属性</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs([
            { label: "分类类型", value: item.categoryType },
            { label: "作用域", value: item.scopeType || "-" },
            { label: "父分类", value: formatCategoryRef(item.parentId) },
            { label: "排序", value: formatNumber(item.sortOrder, 0) },
            { label: "图标", value: item.iconCode || "-" },
            { label: "启用状态", value: Number(item.enabled) === 1 ? "启用中" : "已停用" }
          ])}
        </div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="create-category">新增分类</button>
        <button class="mini-btn" type="button" data-action="edit-category" data-category-id="${item.id}">编辑分类</button>
        <button class="mini-btn" type="button" data-action="toggle-category" data-category-id="${item.id}" data-enabled="${item.enabled}">${Number(item.enabled) === 1 ? "停用分类" : "启用分类"}</button>
        <button class="mini-btn danger" type="button" data-action="delete-category" data-category-id="${item.id}">删除分类</button>
      </div>
    </div>
  `;
}

function renderCategories(items) {
  const host = byId("categoryList");
  if (!items || items.length === 0) {
    updateCategoriesStats([]);
    renderEmptyBoard("categoryList", token ? "当前家庭暂无分类数据" : "请先登录并选择家庭");
    renderCategoryDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateCategoriesStats(items);
  host.innerHTML = `
    <div class="data-table">
      <div class="data-table-header categories-table-header">
        <div>分类名称</div>
        <div>类型</div>
        <div>作用域</div>
        <div>状态</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row categories-table-row ${item.id === selectedCategoryId ? "is-active" : ""}" data-action="select-category" data-category-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">分类名称</span>
              <span class="data-cell-value">${escapeHtml(item.categoryName)}</span>
              <span class="data-cell-meta">${escapeHtml(formatCategoryRef(item.parentId))} / ${escapeHtml(item.scopeType || "-")}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">类型</span>
              <span class="data-cell-value">${escapeHtml(item.categoryType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">作用域</span>
              <span class="data-cell-value">${escapeHtml(item.scopeType || "-")}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用" : "停用"}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  const selected = items.find((item) => item.id === selectedCategoryId) || items[0];
  selectedCategoryId = selected?.id ?? null;
  renderCategoryDetail(selected || null);
  renderBusinessMetrics();
}

function getBudgetUsageItem(budgetId) {
  return budgetUsage.find((item) => item.budgetId === budgetId) || null;
}

function updateBudgetsStats(items) {
  const total = items.length;
  const enabled = items.filter((item) => Number(item.enabled) === 1).length;
  const alerts = budgetUsage.filter((item) => item.alertTriggered || item.exceeded).length;
  byId("budgetsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">启用：${formatNumber(enabled, 0)}</div>
    <div class="stats-pill">预警：${formatNumber(alerts, 0)}</div>
  `;
}

function renderBudgetDetail(item) {
  const host = byId("budgetDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧预算查看详情</div>';
    return;
  }
  const usage = getBudgetUsageItem(item.id);
  host.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-header-main">
          <div class="detail-kicker">Budget Profile</div>
          <h3 class="detail-title">${escapeHtml(item.budgetName)}</h3>
          <div class="detail-subtitle">预算金额、周期、预警比率与执行状态。</div>
        </div>
        <div class="detail-badge-row">
          <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用中" : "已停用"}</span>
          <span class="status-chip ${usage?.alertTriggered || usage?.exceeded ? "warning" : "muted"}">${usage?.exceeded ? "已超支" : usage?.alertTriggered ? "已预警" : "正常"}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">预算属性</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs([
            { label: "周期类型", value: item.periodType },
            { label: "预算金额", value: formatNumber(item.amount) },
            { label: "预警比例", value: formatNumber(item.alertRatio) },
            { label: "开始日期", value: item.startDate || "-" },
            { label: "结束日期", value: item.endDate || "-" },
            { label: "预算分类", value: formatCategoryRef(item.categoryId) },
            { label: "创建成员", value: formatMemberRef(item.createdByMemberId) },
            { label: "备注", value: item.remark || "-" }
          ])}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">预算使用情况</div>
        <div class="business-summary-grid">
          <div class="business-summary-item"><strong>预算</strong><div>${formatNumber(usage?.budgetAmount ?? item.amount)}</div></div>
          <div class="business-summary-item"><strong>已支出</strong><div>${formatNumber(usage?.spentAmount)}</div></div>
          <div class="business-summary-item"><strong>剩余额度</strong><div>${formatNumber(usage?.remainingAmount)}</div></div>
        </div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="create-budget">新增预算</button>
        <button class="mini-btn" type="button" data-action="edit-budget" data-budget-id="${item.id}">编辑预算</button>
        <button class="mini-btn" type="button" data-action="toggle-budget" data-budget-id="${item.id}" data-enabled="${item.enabled}">${Number(item.enabled) === 1 ? "停用预算" : "启用预算"}</button>
        <button class="mini-btn danger" type="button" data-action="delete-budget" data-budget-id="${item.id}">删除预算</button>
      </div>
    </div>
  `;
}

function renderBudgets(items) {
  const host = byId("budgetList");
  if (!items || items.length === 0) {
    updateBudgetsStats([]);
    renderEmptyBoard("budgetList", token ? "当前家庭暂无预算数据" : "请先登录并选择家庭");
    renderBudgetDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateBudgetsStats(items);
  host.innerHTML = `
    <div class="data-table">
      <div class="data-table-header budgets-table-header">
        <div>预算名称</div>
        <div>周期</div>
        <div>预算金额</div>
        <div>状态</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row budgets-table-row ${item.id === selectedBudgetId ? "is-active" : ""}" data-action="select-budget" data-budget-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">预算名称</span>
              <span class="data-cell-value">${escapeHtml(item.budgetName)}</span>
              <span class="data-cell-meta">${escapeHtml(formatCategoryRef(item.categoryId))} / ${escapeHtml(formatMemberRef(item.createdByMemberId))}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">周期</span>
              <span class="data-cell-value">${escapeHtml(item.periodType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">预算金额</span>
              <span class="data-cell-value">${formatNumber(item.amount)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用" : "停用"}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  const selected = items.find((item) => item.id === selectedBudgetId) || items[0];
  selectedBudgetId = selected?.id ?? null;
  renderBudgetDetail(selected || null);
  renderBusinessMetrics();
}

function updateTransactionsStats(items) {
  const income = items.filter((item) => String(item.transactionType).toUpperCase() === "INCOME").length;
  const expense = items.filter((item) => String(item.transactionType).toUpperCase() === "EXPENSE").length;
  byId("transactionsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(transactionTotalElements, 0)}</div>
    <div class="stats-pill">收入：${formatNumber(income, 0)}</div>
    <div class="stats-pill">支出：${formatNumber(expense, 0)}</div>
  `;
}

function renderTransactionMonthlySummary(items) {
  const host = byId("transactionMonthlySummary");
  if (!items || items.length === 0) {
    host.innerHTML = '<div class="summary-item">月度收支摘要暂无数据</div>';
    return;
  }
  host.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">近月收支摘要</div>
      <div class="business-summary-grid">
        ${items.slice(0, 3).map((item) => `
          <div class="business-summary-item">
            <strong>${escapeHtml(item.month)}</strong>
            <div>收入：${formatNumber(item.income)}</div>
            <div>支出：${formatNumber(item.expense)}</div>
            <div>净额：${formatNumber(item.netAmount)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderTransactionDetail(item) {
  const host = byId("transactionDetailPanel");
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧交易查看详情</div>';
    return;
  }
  host.innerHTML = `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-header-main">
          <div class="detail-kicker">Transaction Profile</div>
          <h3 class="detail-title">${escapeHtml(item.merchantName || item.counterpartyName || "交易记录")}</h3>
          <div class="detail-subtitle">交易类型、金额、账户、来源平台和备注。</div>
        </div>
        <div class="detail-badge-row">
          <span class="status-chip muted">${escapeHtml(item.transactionType)}</span>
          <span class="status-chip ${Number(item.status) === 1 ? "enabled" : "disabled"}">${Number(item.status) === 1 ? "有效" : "停用"}</span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">交易属性</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs([
            { label: "金额", value: formatNumber(item.amount) },
            { label: "交易时间", value: formatDateTime(item.transactionTime) },
            { label: "交易账户", value: formatAccountRef(item.accountId) },
            { label: "目标账户", value: formatAccountRef(item.targetAccountId) },
            { label: "交易分类", value: formatCategoryRef(item.categoryId) },
            { label: "创建成员", value: formatMemberRef(item.createdByMemberId) },
            { label: "来源平台", value: item.sourcePlatform || "-" },
            { label: "外部单号", value: item.externalTradeNo || "-" }
          ])}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">备注</div>
        <div class="detail-section-body">${escapeHtml(item.note || "-")}</div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="create-transaction">新增交易</button>
        <button class="mini-btn" type="button" data-action="edit-transaction" data-transaction-id="${item.id}">编辑交易</button>
        <button class="mini-btn danger" type="button" data-action="delete-transaction" data-transaction-id="${item.id}">删除交易</button>
      </div>
    </div>
  `;
}

function renderTransactions(items) {
  const host = byId("transactionList");
  if (!items || items.length === 0) {
    updateTransactionsStats([]);
    renderEmptyBoard("transactionList", token ? "当前筛选条件下暂无交易数据" : "请先登录并选择家庭");
    renderTransactionDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateTransactionsStats(items);
  host.innerHTML = `
    <div class="data-table">
      <div class="data-table-header transactions-table-header">
        <div>交易对象</div>
        <div>类型</div>
        <div>金额</div>
        <div>时间</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row transactions-table-row ${item.id === selectedTransactionId ? "is-active" : ""}" data-action="select-transaction" data-transaction-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">交易对象</span>
              <span class="data-cell-value">${escapeHtml(item.merchantName || item.counterpartyName || `交易#${item.id}`)}</span>
              <span class="data-cell-meta">${escapeHtml(formatAccountRef(item.accountId))}${item.targetAccountId ? ` -> ${escapeHtml(formatAccountRef(item.targetAccountId))}` : ""}${item.categoryId ? ` / ${escapeHtml(formatCategoryRef(item.categoryId))}` : ""}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">类型</span>
              <span class="data-cell-value">${escapeHtml(item.transactionType)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">金额</span>
              <span class="data-cell-value">${formatNumber(item.amount)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">时间</span>
              <span class="data-cell-value">${formatDateTime(item.transactionTime)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  const selected = items.find((item) => item.id === selectedTransactionId) || items[0];
  selectedTransactionId = selected?.id ?? null;
  renderTransactionDetail(selected || null);
  renderBusinessMetrics();
}

async function loadTransactions() {
  const familyId = getCurrentFamilyId();
  if (!token) {
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先登录后再加载交易模块。", true);
    return;
  }
  if (!familyId) {
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先选择家庭。", true);
    return;
  }
  try {
    setBusinessStatus("加载交易与月报中...");
    const transactionType = byId("transactionTypeFilter").value;
    const size = Number(byId("transactionPageSize").value || 8);
    const [page, summary] = await Promise.all([
      api(`/api/transaction-records/search${buildQuery({ familyId, transactionType, page: 0, size })}`),
      api(`/api/transaction-records/family/${familyId}/monthly-summary${buildQuery({ months: 6 })}`)
    ]);
    transactionItems = page.items || [];
    transactionTotalElements = page.totalElements || transactionItems.length;
    transactionMonthlySummary = summary || [];
    if (selectedTransactionId && !transactionItems.some((item) => item.id === selectedTransactionId)) {
      selectedTransactionId = null;
    }
    renderTransactions(transactionItems);
    renderTransactionMonthlySummary(transactionMonthlySummary);
    setBusinessStatus(`交易模块已刷新，本页 ${formatNumber(transactionItems.length, 0)} 条，总计 ${formatNumber(transactionTotalElements, 0)} 条。`);
  } catch (error) {
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus(`交易模块加载失败：${error.message}`, true);
  }
}

async function loadBusinessOverview() {
  const familyId = getCurrentFamilyId();
  if (!token) {
    renderAccounts([]);
    renderCategories([]);
    renderBudgets([]);
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先登录后再加载业务模块。", true);
    return;
  }
  if (!familyId) {
    renderAccounts([]);
    renderCategories([]);
    renderBudgets([]);
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先选择家庭。", true);
    return;
  }
  try {
    setBusinessStatus("正在加载业务模块...");
    const transactionType = byId("transactionTypeFilter").value;
    const size = Number(byId("transactionPageSize").value || 8);
    const [accountData, categoryData, budgetData, budgetUsageData, transactionPage, summary] = await Promise.all([
      api(`/api/accounts${buildQuery({ familyId })}`),
      api(`/api/categories${buildQuery({ familyId })}`),
      api(`/api/budgets${buildQuery({ familyId })}`),
      api(`/api/budgets/usage${buildQuery({ familyId })}`),
      api(`/api/transaction-records/search${buildQuery({ familyId, transactionType, page: 0, size })}`),
      api(`/api/transaction-records/family/${familyId}/monthly-summary${buildQuery({ months: 6 })}`)
    ]);
    accounts = accountData || [];
    categories = categoryData || [];
    budgets = budgetData || [];
    budgetUsage = budgetUsageData || [];
    transactionItems = transactionPage.items || [];
    transactionTotalElements = transactionPage.totalElements || transactionItems.length;
    transactionMonthlySummary = summary || [];
    renderAccounts(accounts);
    renderCategories(categories);
    renderBudgets(budgets);
    renderTransactions(transactionItems);
    renderTransactionMonthlySummary(transactionMonthlySummary);
    setBusinessStatus(`业务模块加载完成：账户 ${formatNumber(accounts.length, 0)}，分类 ${formatNumber(categories.length, 0)}，预算 ${formatNumber(budgets.length, 0)}，交易 ${formatNumber(transactionTotalElements, 0)}。`);
  } catch (error) {
    setBusinessStatus(`业务模块加载失败：${error.message}`, true);
  }
}

async function createAccount() {
  if (!token || !getCurrentFamilyId()) {
    setBusinessStatus("新增账户前请先登录并选择家庭。", true);
    return;
  }
  openBusinessForm("account");
}

async function toggleAccount(accountId, status) {
  try {
    const action = Number(status) === 1 ? "disable" : "enable";
    await api(`/api/accounts/${accountId}/${action}`, { method: "POST" });
    setBusinessStatus(`${Number(status) === 1 ? "停用" : "启用"}账户成功。`);
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`账户状态更新失败：${error.message}`, true);
  }
}

async function deleteAccount(accountId) {
  if (!window.confirm("确认删除该账户吗？")) {
    return;
  }
  try {
    await api(`/api/accounts/${accountId}`, { method: "DELETE" });
    setBusinessStatus("账户已删除。");
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`账户删除失败：${error.message}`, true);
  }
}

async function createCategory() {
  if (!token || !getCurrentFamilyId()) {
    setBusinessStatus("新增分类前请先登录并选择家庭。", true);
    return;
  }
  openBusinessForm("category");
}

async function toggleCategory(categoryId, enabled) {
  try {
    const action = Number(enabled) === 1 ? "disable" : "enable";
    await api(`/api/categories/${categoryId}/${action}`, { method: "POST" });
    setBusinessStatus(`${Number(enabled) === 1 ? "停用" : "启用"}分类成功。`);
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`分类状态更新失败：${error.message}`, true);
  }
}

async function deleteCategory(categoryId) {
  if (!window.confirm("确认删除该分类吗？")) {
    return;
  }
  try {
    await api(`/api/categories/${categoryId}`, { method: "DELETE" });
    setBusinessStatus("分类已删除。");
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`分类删除失败：${error.message}`, true);
  }
}

async function createBudget() {
  if (!token || !getCurrentFamilyId()) {
    setBusinessStatus("新增预算前请先登录并选择家庭。", true);
    return;
  }
  openBusinessForm("budget");
}

async function toggleBudget(budgetId, enabled) {
  try {
    const action = Number(enabled) === 1 ? "disable" : "enable";
    await api(`/api/budgets/${budgetId}/${action}`, { method: "POST" });
    setBusinessStatus(`${Number(enabled) === 1 ? "停用" : "启用"}预算成功。`);
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`预算状态更新失败：${error.message}`, true);
  }
}

async function deleteBudget(budgetId) {
  if (!window.confirm("确认删除该预算吗？")) {
    return;
  }
  try {
    await api(`/api/budgets/${budgetId}`, { method: "DELETE" });
    setBusinessStatus("预算已删除。");
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`预算删除失败：${error.message}`, true);
  }
}

async function createTransaction() {
  if (!token || !getCurrentFamilyId()) {
    setBusinessStatus("新增交易前请先登录并选择家庭。", true);
    return;
  }
  openBusinessForm("transaction");
}

function editAccount() {
  if (!selectedAccountId) {
    setBusinessStatus("请先选择要编辑的账户。", true);
    return;
  }
  openBusinessForm("account", "edit");
}

function editCategory() {
  if (!selectedCategoryId) {
    setBusinessStatus("请先选择要编辑的分类。", true);
    return;
  }
  openBusinessForm("category", "edit");
}

function editBudget() {
  if (!selectedBudgetId) {
    setBusinessStatus("请先选择要编辑的预算。", true);
    return;
  }
  openBusinessForm("budget", "edit");
}

function editTransaction() {
  if (!selectedTransactionId) {
    setBusinessStatus("请先选择要编辑的交易。", true);
    return;
  }
  openBusinessForm("transaction", "edit");
}

async function deleteTransaction(recordId) {
  if (!window.confirm("确认删除该交易记录吗？")) {
    return;
  }
  try {
    await api(`/api/transaction-records/${recordId}`, { method: "DELETE" });
    setBusinessStatus("交易记录已删除。");
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`交易记录删除失败：${error.message}`, true);
  }
}

async function submitBusinessForm(event) {
  event.preventDefault();
  if (!businessFormType) {
    return;
  }
  const form = getBusinessFormData();
  const isEdit = businessFormMode === "edit";
  const errors = validateBusinessForm(businessFormType, form);
  if (Object.keys(errors).length > 0) {
    renderBusinessFormErrors(errors);
    return;
  }
  clearBusinessFormErrors();
  setBusinessFormStatus("表单校验通过，正在提交...", false);
  setBusinessFormSubmitting(true);
  try {
    if (businessFormType === "account") {
      await api(isEdit ? `/api/accounts/${selectedAccountId}` : "/api/accounts", {
        method: isEdit ? "PUT" : "POST",
        body: {
          ...(isEdit ? {} : { familyId: Number(form.familyId) }),
          accountName: form.accountName,
          accountType: form.accountType,
          institutionName: form.institutionName || null,
          accountNoMask: form.accountNoMask || null,
          ...(isEdit ? {} : { currentBalance: form.currentBalance || null }),
          creditLimit: form.creditLimit || null,
          billingDay: parseNullableNumber(form.billingDay),
          repaymentDay: parseNullableNumber(form.repaymentDay),
          isShared: parseNullableNumber(form.isShared) ?? 0,
          remark: form.remark || null
        }
      });
      setBusinessStatus(isEdit ? "账户编辑成功。" : "账户新增成功。");
    }

    if (businessFormType === "category") {
      await api(isEdit ? `/api/categories/${selectedCategoryId}` : "/api/categories", {
        method: isEdit ? "PUT" : "POST",
        body: {
          ...(isEdit ? {} : { familyId: Number(form.familyId) }),
          categoryName: form.categoryName,
          categoryType: form.categoryType,
          scopeType: form.scopeType || null,
          parentId: parseNullableNumber(form.parentId),
          iconCode: form.iconCode || null,
          sortOrder: parseNullableNumber(form.sortOrder)
        }
      });
      setBusinessStatus(isEdit ? "分类编辑成功。" : "分类新增成功。");
    }

    if (businessFormType === "budget") {
      await api(isEdit ? `/api/budgets/${selectedBudgetId}` : "/api/budgets", {
        method: isEdit ? "PUT" : "POST",
        body: {
          ...(isEdit ? {} : { familyId: Number(form.familyId) }),
          categoryId: Number(form.categoryId),
          budgetName: form.budgetName,
          periodType: form.periodType,
          amount: form.amount,
          alertRatio: form.alertRatio || null,
          startDate: form.startDate,
          endDate: form.endDate || null,
          remark: form.remark || null
        }
      });
      setBusinessStatus(isEdit ? "预算编辑成功。" : "预算新增成功。");
    }

    if (businessFormType === "transaction") {
      await api(isEdit ? `/api/transaction-records/${selectedTransactionId}` : "/api/transaction-records", {
        method: isEdit ? "PUT" : "POST",
        body: {
          ...(isEdit ? {} : { familyId: Number(form.familyId) }),
          accountId: Number(form.accountId),
          targetAccountId: parseNullableNumber(form.targetAccountId),
          categoryId: parseNullableNumber(form.categoryId),
          transactionType: form.transactionType,
          amount: form.amount,
          transactionTime: `${form.transactionTime}:00`,
          merchantName: form.merchantName || null,
          counterpartyName: form.counterpartyName || null,
          sourcePlatform: form.sourcePlatform || null,
          externalTradeNo: form.externalTradeNo || null,
          note: form.note || null
        }
      });
      setBusinessStatus(isEdit ? "交易编辑成功。" : "交易新增成功。");
    }

    closeBusinessForm();
    await loadBusinessOverview();
  } catch (error) {
    setBusinessFormStatus(`提交失败：${error.message}`, true);
    setBusinessStatus(`表单提交失败：${error.message}`, true);
  } finally {
    setBusinessFormSubmitting(false);
  }
}

function handleBusinessFormInput(event) {
  if (event.target.name === "transactionType") {
    syncTransactionFormBehavior();
  }
  const wrapper = event.target.closest("[data-field-name]");
  if (!wrapper) {
    return;
  }
  const input = wrapper.querySelector(".field-input");
  const errorNode = wrapper.querySelector(".field-error");
  if (input) {
    input.classList.remove("is-invalid");
  }
  if (errorNode) {
    errorNode.hidden = true;
    errorNode.textContent = "";
  }
  const remainingErrors = byId("businessFormFields").querySelectorAll(".field-error:not([hidden])").length;
  if (remainingErrors === 0) {
    setBusinessFormStatus("");
  }
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
    business: {
      eyebrow: "Business Modules",
      title: "业务管理工作台",
      breadcrumb: "后台首页 / 业务管理"
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
    case "close-business-form":
      closeBusinessForm();
      break;
    case "select-rule": {
      selectedRuleId = Number(actionNode.dataset.ruleId);
      const item = filteredRules.find((rule) => rule.id === selectedRuleId) || null;
      renderRules(filteredRules);
      renderRuleDetail(item);
      break;
    }
    case "select-account": {
      selectedAccountId = Number(actionNode.dataset.accountId);
      const item = accounts.find((account) => account.id === selectedAccountId) || null;
      renderAccounts(accounts);
      renderAccountDetail(item);
      break;
    }
    case "create-account":
      createAccount();
      break;
    case "edit-account":
      editAccount();
      break;
    case "toggle-account":
      event.stopPropagation();
      toggleAccount(Number(actionNode.dataset.accountId), Number(actionNode.dataset.status));
      break;
    case "delete-account":
      event.stopPropagation();
      deleteAccount(Number(actionNode.dataset.accountId));
      break;
    case "select-category": {
      selectedCategoryId = Number(actionNode.dataset.categoryId);
      const item = categories.find((category) => category.id === selectedCategoryId) || null;
      renderCategories(categories);
      renderCategoryDetail(item);
      break;
    }
    case "create-category":
      createCategory();
      break;
    case "edit-category":
      editCategory();
      break;
    case "toggle-category":
      event.stopPropagation();
      toggleCategory(Number(actionNode.dataset.categoryId), Number(actionNode.dataset.enabled));
      break;
    case "delete-category":
      event.stopPropagation();
      deleteCategory(Number(actionNode.dataset.categoryId));
      break;
    case "select-budget": {
      selectedBudgetId = Number(actionNode.dataset.budgetId);
      const item = budgets.find((budget) => budget.id === selectedBudgetId) || null;
      renderBudgets(budgets);
      renderBudgetDetail(item);
      break;
    }
    case "create-budget":
      createBudget();
      break;
    case "edit-budget":
      editBudget();
      break;
    case "toggle-budget":
      event.stopPropagation();
      toggleBudget(Number(actionNode.dataset.budgetId), Number(actionNode.dataset.enabled));
      break;
    case "delete-budget":
      event.stopPropagation();
      deleteBudget(Number(actionNode.dataset.budgetId));
      break;
    case "select-transaction": {
      selectedTransactionId = Number(actionNode.dataset.transactionId);
      const item = transactionItems.find((transaction) => transaction.id === selectedTransactionId) || null;
      renderTransactions(transactionItems);
      renderTransactionDetail(item);
      break;
    }
    case "create-transaction":
      createTransaction();
      break;
    case "edit-transaction":
      editTransaction();
      break;
    case "delete-transaction":
      event.stopPropagation();
      deleteTransaction(Number(actionNode.dataset.transactionId));
      break;
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
  byId("loadBusinessBtn").addEventListener("click", loadBusinessOverview);
  byId("loadTransactionsBtn").addEventListener("click", loadTransactions);
  byId("createAccountBtn").addEventListener("click", createAccount);
  byId("createCategoryBtn").addEventListener("click", createCategory);
  byId("createBudgetBtn").addEventListener("click", createBudget);
  byId("createTransactionBtn").addEventListener("click", createTransaction);
  byId("businessForm").addEventListener("submit", submitBusinessForm);
  byId("businessForm").addEventListener("input", handleBusinessFormInput);
  byId("businessForm").addEventListener("change", handleBusinessFormInput);
  byId("businessFormCloseBtn").addEventListener("click", closeBusinessForm);
  byId("businessFormCancelBtn").addEventListener("click", closeBusinessForm);
  byId("loadRulesBtn").addEventListener("click", loadRules);
  byId("evaluateRulesBtn").addEventListener("click", evaluateRules);
  byId("loadNotificationsBtn").addEventListener("click", loadNotifications);
  byId("readAllNotificationsBtn").addEventListener("click", markAllNotificationsRead);
  byId("clearReadNotificationsBtn").addEventListener("click", clearReadNotifications);
  byId("familySelect").addEventListener("change", async () => {
    updateMemberOptions();
    if (token) {
      const jobs = [loadRules(), loadNotifications()];
      if (activeView === "business") {
        jobs.push(loadBusinessOverview());
      }
      await Promise.all(jobs);
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
  byId("transactionTypeFilter").addEventListener("change", loadTransactions);
  byId("transactionPageSize").addEventListener("change", loadTransactions);
  document.addEventListener("click", handleDocumentClick);
}

async function init() {
  restoreSession();
  resetSummary();
  renderLatestImport(null);
  renderImportHistory();
  renderImportHistoryDetail();
  renderAccounts([]);
  renderCategories([]);
  renderBudgets([]);
  renderTransactions([]);
  renderTransactionMonthlySummary([]);
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
