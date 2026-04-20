const STORAGE_TOKEN_KEY = "finance_admin_token";
const STORAGE_SESSION_KEY = "finance_admin_session";
const STORAGE_COMMAND_RECENTS_KEY = "finance_admin_recent_commands";

let token = "";
let latestSummary = null;
let latestImport = null;
let memberships = [];
let importHistory = [];
let importHistoryQuickFilter = "all";
let importHistorySort = "created-desc";
let selectedImportHistoryId = null;
let allRules = [];
let filteredRules = [];
let notificationsPage = [];
let selectedRuleIds = [];
let selectedRuleId = null;
let selectedNotificationIds = [];
let selectedNotificationId = null;
let latestRuleEvaluation = null;
let accounts = [];
let categories = [];
let budgets = [];
let budgetUsage = [];
let transactionItems = [];
let transactionMonthlySummary = [];
let transactionTotalElements = 0;
let transactionPageIndex = 0;
let transactionTotalPages = 0;
let notificationsTotalElements = 0;
let accountQuickFilter = "all";
let accountShowSelectedOnly = false;
let selectedAccountIds = [];
let selectedAccountId = null;
let categoryQuickFilter = "all";
let categoryShowSelectedOnly = false;
let selectedCategoryIds = [];
let selectedCategoryId = null;
let budgetQuickFilter = "all";
let budgetShowSelectedOnly = false;
let selectedBudgetIds = [];
let selectedBudgetId = null;
let ruleQuickFilter = "all";
let selectedTransactionId = null;
let businessFormType = null;
let businessFormMode = "create";
let notificationsPageIndex = 0;
let notificationsTotalPages = 0;
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

function summarizeText(value, maxLength = 18) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "-";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function formatTableMeta(...parts) {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim() !== "")
    .map((part) => escapeHtml(part))
    .join(" · ");
}

function includesKeyword(value, keyword) {
  return String(value ?? "").toUpperCase().includes(String(keyword ?? "").trim().toUpperCase());
}

function isImportFailed(status) {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (!normalized) {
    return false;
  }
  return ["FAIL", "FAILED", "ERROR", "EXCEPTION"].some((keyword) => normalized.includes(keyword));
}

function isImportSuccessful(status) {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (!normalized) {
    return false;
  }
  return ["SUCCESS", "SUCCEEDED", "COMPLETED", "DONE"].some((keyword) => normalized.includes(keyword));
}

function getImportHistoryTone(record) {
  const status = record?.result?.importStatus || "";
  if (isImportFailed(status)) {
    return "danger";
  }
  if (!isImportSuccessful(status) || Number(record?.result?.fredImported || 0) === 0) {
    return "warning";
  }
  return "success";
}

function getImportQualityConclusion(result) {
  const status = result?.importStatus || "";
  const retailImported = Number(result?.retailImported || 0);
  const worldBankImported = Number(result?.worldBankImported || 0);
  const fredImported = Number(result?.fredImported || 0);

  if (isImportFailed(status) || retailImported === 0 || worldBankImported === 0) {
    return {
      label: "需重导",
      tone: "danger",
      detail: "核心数据未成功入库，不适合直接用于答辩展示。"
    };
  }
  if (!isImportSuccessful(status) || fredImported === 0) {
    return {
      label: "仅软降级",
      tone: "warning",
      detail: "零售与世行数据可展示，但宏观序列或状态存在降级。"
    };
  }
  return {
    label: "可用于答辩",
    tone: "info",
    detail: "三类数据已形成可展示结果，适合继续分析与汇报。"
  };
}

function buildTodoSummary(todoItems) {
  const counters = todoItems.reduce((acc, item) => {
    acc.total += 1;
    acc[item.count] = (acc[item.count] || 0) + 1;
    acc[item.tone] = (acc[item.tone] || 0) + 1;
    return acc;
  }, { total: 0, danger: 0, warning: 0, info: 0 });
  return [
    { label: "待处理总数", value: formatNumber(counters.total, 0), tone: counters.total > 0 ? "info" : "" },
    { label: "高风险", value: formatNumber(counters.danger || 0, 0), tone: counters.danger > 0 ? "danger" : "" },
    { label: "需跟进", value: formatNumber(counters.warning || 0, 0), tone: counters.warning > 0 ? "warning" : "" },
    { label: "导入/分析", value: formatNumber((counters["导入"] || 0) + (counters["分析"] || 0), 0), tone: (counters["导入"] || 0) + (counters["分析"] || 0) > 0 ? "info" : "" },
    { label: "业务/规则", value: formatNumber((counters["业务"] || 0) + (counters["通知"] || 0) + (counters["规则"] || 0), 0), tone: (counters["业务"] || 0) + (counters["通知"] || 0) + (counters["规则"] || 0) > 0 ? "info" : "" }
  ];
}

function getFilteredImportHistory(items) {
  return (items || []).filter((item) => {
    const tone = getImportHistoryTone(item);
    if (importHistoryQuickFilter === "abnormal") {
      return tone === "danger";
    }
    if (importHistoryQuickFilter === "degraded") {
      return Number(item.result?.fredImported || 0) === 0;
    }
    if (importHistoryQuickFilter === "success") {
      return tone === "success";
    }
    return true;
  });
}

function getSortedImportHistory(items) {
  return applySort(items, importHistorySort, {
    "created-desc": (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    "batch-desc": (a, b) => Number(b.result?.importBatchId || 0) - Number(a.result?.importBatchId || 0),
    "issue-first": (a, b) => {
      const toneWeight = { danger: 3, warning: 2, success: 1 };
      const toneDiff = (toneWeight[getImportHistoryTone(b)] || 0) - (toneWeight[getImportHistoryTone(a)] || 0);
      if (toneDiff !== 0) {
        return toneDiff;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    },
    default: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  });
}

function applyImportHistoryQuickFilter(filter) {
  importHistoryQuickFilter = filter;
  updateQuickTagButtons({
    all: "importHistoryQuickAllBtn",
    abnormal: "importHistoryQuickAbnormalBtn",
    degraded: "importHistoryQuickDegradedBtn",
    success: "importHistoryQuickSuccessBtn"
  }, importHistoryQuickFilter);
  renderImportHistory();
  renderImportHistoryDetail();
}

function focusImportHistory(filter = "all") {
  applyImportHistoryQuickFilter(filter);
  switchView("imports");
}

function focusRulesNotifications(mode = "unread") {
  switchView("rules");
  notificationsPageIndex = 0;
  byId("notificationReadFilter").value = mode === "all" ? "" : "0";
  byId("notificationSourceFilter").value = mode === "rule" ? "RULE" : "";
  if (mode === "high-priority-rules") {
    byId("ruleEnabledFilter").value = "1";
    byId("ruleTypeFilter").value = "";
    applyRuleQuickFilter("high");
    return;
  }
  loadNotifications(0);
}

function focusBusinessArea(mode = "overview") {
  switchView("business");
  if (mode === "shared-accounts") {
    byId("accountStatusFilter").value = "";
    byId("accountTypeFilter").value = "";
    byId("accountSortFilter").value = "name-asc";
    applyAccountQuickFilter("shared");
    return;
  }
  if (mode === "enabled-budgets") {
    byId("budgetEnabledFilter").value = "1";
    byId("budgetPeriodFilter").value = "";
    byId("budgetSortFilter").value = "amount-desc";
    applyBudgetQuickFilter("all");
    return;
  }
  if (mode === "alert-budgets") {
    byId("budgetEnabledFilter").value = "";
    byId("budgetPeriodFilter").value = "";
    byId("budgetSortFilter").value = "amount-desc";
    applyBudgetQuickFilter("alert");
    return;
  }
  if (mode === "recent-transactions") {
    transactionPageIndex = 0;
    byId("transactionTypeFilter").value = "";
    loadTransactions(0);
  }
}

const GLOBAL_COMMANDS = [
  { key: "analysis-summary", label: "打开分析总控台", aliases: ["分析总控台", "分析汇总", "分析面板", "summary", "analysis"], section: "分析", description: "回到总控台查看分析指标、趋势与自动结论。" },
  { key: "imports-issues", label: "查看导入异常", aliases: ["导入异常", "导入失败", "import issues", "imports"], section: "导入", description: "定位失败批次、字段异常和数据质量问题。" },
  { key: "imports-degraded", label: "查看 FRED 降级批次", aliases: ["fred 降级", "降级批次", "宏观降级", "fred"], section: "导入", description: "快速检查宏观序列是否因网络问题触发软降级。" },
  { key: "business-shared", label: "查看共享账户", aliases: ["共享账户", "shared accounts", "shared"], section: "业务", description: "跳转到账户工作区并筛选共享账户。" },
  { key: "business-alert-budgets", label: "查看预算异常", aliases: ["预算异常", "预警预算", "alert budgets", "budget"], section: "业务", description: "直接进入预算预警视图查看超额和告警项目。" },
  { key: "rules-unread", label: "查看未读通知", aliases: ["未读通知", "通知未读", "unread notifications", "unread"], section: "规则通知", description: "打开通知中心并聚焦当前未读消息。" },
  { key: "rules-high-priority", label: "查看高优先级规则", aliases: ["高优先级规则", "priority rules", "high priority"], section: "规则通知", description: "快速复核高优先级规则的启用状态和影响范围。" },
  { key: "acceptance-run", label: "执行一键验收", aliases: ["一键验收", "系统验收", "acceptance", "run acceptance"], section: "验收", description: "串联导入、分析、规则与通知做一次完整联通检查。" }
];
const VIEW_COMMAND_PRESETS = {
  analysis: ["analysis-summary", "imports-issues", "imports-degraded", "acceptance-run"],
  imports: ["imports-issues", "imports-degraded", "analysis-summary", "acceptance-run"],
  business: ["business-alert-budgets", "business-shared", "rules-unread", "acceptance-run"],
  rules: ["rules-unread", "rules-high-priority", "business-alert-budgets", "acceptance-run"],
  acceptance: ["acceptance-run", "imports-issues", "analysis-summary", "rules-unread"]
};
let filteredGlobalCommands = [...GLOBAL_COMMANDS];
let activeGlobalCommandIndex = 0;
let globalCommandMenuOpen = false;
let recentGlobalCommands = [];

function normalizeCommandText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getCommandByKey(commandKey) {
  return GLOBAL_COMMANDS.find((item) => item.key === commandKey) || null;
}

function restoreRecentGlobalCommands() {
  try {
    const rawValue = localStorage.getItem(STORAGE_COMMAND_RECENTS_KEY);
    if (!rawValue) {
      recentGlobalCommands = [];
      return;
    }
    const parsed = JSON.parse(rawValue);
    recentGlobalCommands = Array.isArray(parsed)
      ? parsed.map((item) => String(item || "")).filter((key) => getCommandByKey(key))
      : [];
  } catch (error) {
    recentGlobalCommands = [];
  }
}

function persistRecentGlobalCommands() {
  localStorage.setItem(STORAGE_COMMAND_RECENTS_KEY, JSON.stringify(recentGlobalCommands.slice(0, 6)));
}

function pushRecentGlobalCommand(commandKey) {
  if (!getCommandByKey(commandKey)) {
    return;
  }
  recentGlobalCommands = [commandKey, ...recentGlobalCommands.filter((item) => item !== commandKey)].slice(0, 6);
  persistRecentGlobalCommands();
}

function buildCommandOptionMarkup(item, index, extraMeta = "") {
  return `
    <button
      class="command-option ${index === activeGlobalCommandIndex ? "is-active" : ""}"
      type="button"
      data-action="select-global-command"
      data-command="${item.key}"
      data-command-index="${index}"
    >
      <span class="command-option-title">${escapeHtml(item.label)}</span>
      <span class="command-option-meta">${escapeHtml(extraMeta || item.description || item.aliases.slice(0, 3).join(" / "))}</span>
    </button>
  `;
}

function renderCommandSection(title, subtitle, commands, startIndex, options = {}) {
  const { recent = false, defaultKey = "" } = options;
  if (commands.length === 0) {
    return { markup: "", nextIndex: startIndex };
  }
  let currentIndex = startIndex;
  const rows = commands.map((item) => {
    const badges = [
      recent ? "最近使用" : "",
      item.key === defaultKey ? "回车默认执行" : "",
      item.section || ""
    ].filter(Boolean).join(" / ");
    const markup = buildCommandOptionMarkup(item, currentIndex, badges || item.description || item.aliases.slice(0, 3).join(" / "));
    currentIndex += 1;
    return markup;
  }).join("");
  return {
    markup: `
      <section class="command-section">
        <div class="command-section-header">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <div class="command-section-list">
          ${rows}
        </div>
      </section>
    `,
    nextIndex: currentIndex
  };
}

function renderGlobalCommandDeck() {
  const contextHost = byId("commandContextTags");
  const recentHost = byId("commandRecentTags");
  if (!contextHost || !recentHost) {
    return;
  }
  const contextCommands = (VIEW_COMMAND_PRESETS[activeView] || VIEW_COMMAND_PRESETS.analysis || [])
    .map((key) => getCommandByKey(key))
    .filter(Boolean);
  const recentCommands = recentGlobalCommands
    .map((key) => getCommandByKey(key))
    .filter(Boolean)
    .slice(0, 4);
  contextHost.innerHTML = contextCommands.map((item, index) => `
    <button class="tag-btn ${index === 0 ? "is-active" : ""}" type="button" data-action="run-global-command" data-command="${item.key}">
      ${escapeHtml(item.label)}
    </button>
  `).join("");
  recentHost.innerHTML = recentCommands.length > 0
    ? recentCommands.map((item) => `
      <button class="tag-btn command-muted" type="button" data-action="run-global-command" data-command="${item.key}">
        ${escapeHtml(item.label)}
      </button>
    `).join("")
    : '<span class="tag-btn command-muted">暂无最近命令</span>';
}
function openGlobalCommandMenu() {
  const host = byId("globalCommandMenu");
  const input = byId("globalCommandInput");
  if (!host) {
    return;
  }
  host.hidden = false;
  globalCommandMenuOpen = true;
  if (input) {
    input.setAttribute("aria-expanded", "true");
  }
}

function closeGlobalCommandMenu() {
  const host = byId("globalCommandMenu");
  const input = byId("globalCommandInput");
  if (!host) {
    return;
  }
  host.hidden = true;
  globalCommandMenuOpen = false;
  if (input) {
    input.setAttribute("aria-expanded", "false");
  }
}

function renderGlobalCommandOptions(filter = "") {
  const host = byId("globalCommandMenu");
  if (!host) {
    return;
  }
  const keyword = normalizeCommandText(filter);
  const commands = GLOBAL_COMMANDS.filter((item) => {
    if (!keyword) {
      return true;
    }
    return normalizeCommandText(item.label).includes(keyword)
      || item.aliases.some((alias) => normalizeCommandText(alias).includes(keyword));
  });
  let displayedCommands = [...commands];
  let sectionMarkup = "";
  let runningIndex = 0;
  if (keyword) {
    const defaultCommand = commands[0] || null;
    const groupedCommands = commands.reduce((acc, item) => {
      const section = item.section || "其他";
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(item);
      return acc;
    }, {});
    sectionMarkup = Object.entries(groupedCommands).map(([sectionName, sectionItems]) => {
      const section = renderCommandSection(sectionName, `匹配 ${formatNumber(sectionItems.length, 0)} 条`, sectionItems, runningIndex, { defaultKey: defaultCommand?.key || "" });
      runningIndex = section.nextIndex;
      return section.markup;
    }).join("");
  } else {
    const recentItems = recentGlobalCommands.map((key) => getCommandByKey(key)).filter(Boolean);
    const catalogItems = GLOBAL_COMMANDS.filter((item) => !recentItems.some((recentItem) => recentItem.key === item.key));
    displayedCommands = [...recentItems, ...catalogItems];
    const defaultCommand = displayedCommands[0] || null;
    const recentSection = renderCommandSection("最近使用", recentItems.length > 0 ? "保留最近 6 条执行记录" : "暂无执行记录，首次执行后会在这里显示", recentItems, runningIndex, { recent: true, defaultKey: defaultCommand?.key || "" });
    runningIndex = recentSection.nextIndex;
    const groupedCommands = catalogItems.reduce((acc, item) => {
      const section = item.section || "其他";
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(item);
      return acc;
    }, {});
    const groupedMarkup = Object.entries(groupedCommands).map(([sectionName, sectionItems]) => {
      const section = renderCommandSection(sectionName, `共 ${formatNumber(sectionItems.length, 0)} 条命令`, sectionItems, runningIndex, { defaultKey: defaultCommand?.key || "" });
      runningIndex = section.nextIndex;
      return section.markup;
    }).join("");
    sectionMarkup = `${recentSection.markup}${groupedMarkup}`;
  }
  filteredGlobalCommands = displayedCommands;
  activeGlobalCommandIndex = displayedCommands.length > 0 ? 0 : -1;
  const defaultCommand = displayedCommands[0] || null;
  const optionsMarkup = displayedCommands.length > 0
    ? sectionMarkup
    : `
      <div class="command-empty">
        <strong>没有匹配命令</strong>
        可继续输入中文关键词，或直接选择下方建议命令快速进入对应工作区。
      </div>
      ${renderCommandSection("建议命令", "你可以先从最常用入口开始", GLOBAL_COMMANDS.slice(0, 4), 0, {}).markup}
    `;
  const summaryText = displayedCommands.length > 0
    ? `共 ${formatNumber(displayedCommands.length, 0)} 条候选${defaultCommand ? `，回车将执行“${escapeHtml(defaultCommand.label)}”` : ""}`
    : `未找到“${escapeHtml(filter || "当前输入")}”对应命令`;
  host.innerHTML = `
    ${optionsMarkup}
    <div class="command-menu-footer">
      <span class="command-menu-summary">${summaryText}</span>
      <div class="command-shortcuts">
        <span class="command-shortcut-badge">/ 聚焦</span>
        <span class="command-shortcut-badge">↑↓ 切换</span>
        <span class="command-shortcut-badge">Enter 执行</span>
        <span class="command-shortcut-badge">Esc 关闭</span>
      </div>
    </div>
  `;
  const hint = byId("globalCommandHint");
  if (hint) {
    hint.textContent = displayedCommands.length > 0
      ? `可执行 ${formatNumber(displayedCommands.length, 0)} 条命令${defaultCommand ? `，直接回车默认执行：${defaultCommand.label}` : ""}`
      : "没有匹配命令，可输入 导入异常 / 预算异常 / 未读通知 / 一键验收 等关键词。";
  }
  if (document.activeElement?.id === "globalCommandInput") {
    openGlobalCommandMenu();
  } else {
    closeGlobalCommandMenu();
  }
}

function updateGlobalCommandActiveOption(nextIndex) {
  if (filteredGlobalCommands.length === 0) {
    activeGlobalCommandIndex = -1;
    return;
  }
  const total = filteredGlobalCommands.length;
  activeGlobalCommandIndex = ((nextIndex % total) + total) % total;
  const host = byId("globalCommandMenu");
  if (!host) {
    return;
  }
  host.querySelectorAll(".command-option").forEach((node, index) => {
    node.classList.toggle("is-active", index === activeGlobalCommandIndex);
  });
  const activeNode = host.querySelector(".command-option.is-active");
  activeNode?.scrollIntoView({ block: "nearest" });
}

function resolveGlobalCommand(value) {
  const keyword = normalizeCommandText(value);
  if (!keyword) {
    return GLOBAL_COMMANDS[0]?.key || "";
  }
  const exact = GLOBAL_COMMANDS.find((item) => normalizeCommandText(item.key) === keyword || normalizeCommandText(item.label) === keyword || item.aliases.some((alias) => normalizeCommandText(alias) === keyword));
  if (exact) {
    return exact.key;
  }
  const fuzzy = GLOBAL_COMMANDS.find((item) => normalizeCommandText(item.label).includes(keyword) || item.aliases.some((alias) => normalizeCommandText(alias).includes(keyword)));
  return fuzzy?.key || "";
}

function executeGlobalCommand(commandInput) {
  const command = resolveGlobalCommand(commandInput);
  const commandInputNode = byId("globalCommandInput");
  const matched = getCommandByKey(command);
  if (commandInputNode && matched) {
    commandInputNode.value = matched.label;
  }
  if (matched) {
    pushRecentGlobalCommand(matched.key);
  }
  renderGlobalCommandDeck();
  closeGlobalCommandMenu();
  switch (command) {
    case "analysis-summary":
      switchView("analysis");
      loadSummary();
      break;
    case "imports-issues":
      focusImportHistory("abnormal");
      break;
    case "imports-degraded":
      focusImportHistory("degraded");
      break;
    case "business-shared":
      focusBusinessArea("shared-accounts");
      break;
    case "business-alert-budgets":
      focusBusinessArea("alert-budgets");
      break;
    case "rules-unread":
      focusRulesNotifications("unread");
      break;
    case "rules-high-priority":
      focusRulesNotifications("high-priority-rules");
      break;
    case "acceptance-run":
      switchView("acceptance");
      runAcceptance();
      break;
    default:
      {
        const hint = byId("globalCommandHint");
        if (hint) {
          hint.textContent = "未识别该命令，可输入 导入异常 / 预算异常 / 未读通知 / 一键验收。";
        }
      }
      break;
  }
}

function focusAnalysisArea(target = "dashboard") {
  switchView("analysis");
  const mapping = {
    dashboard: "analysisDashboardPanel",
    countries: "analysisCountryPanel",
    worldBank: "analysisWorldBankPanel",
    fred: "analysisFredPanel"
  };
  const node = byId(mapping[target] || mapping.dashboard);
  if (node) {
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function compareText(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "zh-CN");
}

function applySort(items, sortValue, strategies) {
  const list = [...(items || [])];
  const sorter = strategies[sortValue] || strategies.default;
  return sorter ? list.sort(sorter) : list;
}

function updateQuickTagButtons(mapping, activeKey) {
  Object.entries(mapping).forEach(([key, id]) => {
    const node = byId(id);
    if (node) {
      node.classList.toggle("is-active", key === activeKey);
    }
  });
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, "\"\"")}"`;
  }).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getFilteredAccounts(items = accounts) {
  const status = byId("accountStatusFilter")?.value || "";
  const typeKeyword = byId("accountTypeFilter")?.value || "";
  const filtered = (items || []).filter((item) => {
    if (status !== "" && String(item.status ?? "") !== status) {
      return false;
    }
    if (typeKeyword && !includesKeyword(item.accountType, typeKeyword) && !includesKeyword(item.accountName, typeKeyword)) {
      return false;
    }
    if (accountQuickFilter === "shared" && Number(item.isShared) !== 1) {
      return false;
    }
    if (accountQuickFilter === "credit" && !includesKeyword(item.accountType, "CREDIT")) {
      return false;
    }
    if (accountQuickFilter === "enabled" && Number(item.status) !== 1) {
      return false;
    }
    if (accountShowSelectedOnly && !selectedAccountIds.includes(Number(item.id))) {
      return false;
    }
    return true;
  });
  return applySort(filtered, byId("accountSortFilter")?.value || "name-asc", {
    "name-asc": (a, b) => compareText(a.accountName, b.accountName),
    "balance-desc": (a, b) => Number(b.currentBalance || 0) - Number(a.currentBalance || 0),
    "balance-asc": (a, b) => Number(a.currentBalance || 0) - Number(b.currentBalance || 0),
    default: (a, b) => compareText(a.accountName, b.accountName)
  });
}

function hasActiveAccountFilters() {
  return Boolean((byId("accountStatusFilter")?.value || "") || (byId("accountTypeFilter")?.value || "").trim() || accountQuickFilter !== "all");
}

function getFilteredCategories(items = categories) {
  const enabled = byId("categoryEnabledFilter")?.value || "";
  const typeKeyword = byId("categoryTypeFilter")?.value || "";
  const filtered = (items || []).filter((item) => {
    if (enabled !== "" && String(item.enabled ?? "") !== enabled) {
      return false;
    }
    if (typeKeyword && !includesKeyword(item.categoryType, typeKeyword) && !includesKeyword(item.categoryName, typeKeyword)) {
      return false;
    }
    if (categoryQuickFilter === "expense" && !includesKeyword(item.categoryType, "EXPENSE")) {
      return false;
    }
    if (categoryQuickFilter === "income" && !includesKeyword(item.categoryType, "INCOME")) {
      return false;
    }
    if (categoryQuickFilter === "enabled" && Number(item.enabled) !== 1) {
      return false;
    }
    if (categoryShowSelectedOnly && !selectedCategoryIds.includes(Number(item.id))) {
      return false;
    }
    return true;
  });
  return applySort(filtered, byId("categorySortFilter")?.value || "sort-asc", {
    "sort-asc": (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0),
    "name-asc": (a, b) => compareText(a.categoryName, b.categoryName),
    "name-desc": (a, b) => compareText(b.categoryName, a.categoryName),
    default: (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
  });
}

function hasActiveCategoryFilters() {
  return Boolean((byId("categoryEnabledFilter")?.value || "") || (byId("categoryTypeFilter")?.value || "").trim() || categoryQuickFilter !== "all");
}

function getFilteredBudgets(items = budgets) {
  const enabled = byId("budgetEnabledFilter")?.value || "";
  const periodKeyword = byId("budgetPeriodFilter")?.value || "";
  const filtered = (items || []).filter((item) => {
    if (enabled !== "" && String(item.enabled ?? "") !== enabled) {
      return false;
    }
    if (periodKeyword && !includesKeyword(item.periodType, periodKeyword) && !includesKeyword(item.budgetName, periodKeyword)) {
      return false;
    }
    const usage = getBudgetUsageItem(item.id);
    if (budgetQuickFilter === "alert" && !(usage?.alertTriggered || usage?.exceeded)) {
      return false;
    }
    if (budgetQuickFilter === "exceeded" && !usage?.exceeded) {
      return false;
    }
    if (budgetQuickFilter === "monthly" && !includesKeyword(item.periodType, "MONTH")) {
      return false;
    }
    if (budgetShowSelectedOnly && !selectedBudgetIds.includes(Number(item.id))) {
      return false;
    }
    return true;
  });
  return applySort(filtered, byId("budgetSortFilter")?.value || "amount-desc", {
    "amount-desc": (a, b) => Number(b.amount || 0) - Number(a.amount || 0),
    "amount-asc": (a, b) => Number(a.amount || 0) - Number(b.amount || 0),
    "name-asc": (a, b) => compareText(a.budgetName, b.budgetName),
    default: (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
  });
}

function hasActiveBudgetFilters() {
  return Boolean((byId("budgetEnabledFilter")?.value || "") || (byId("budgetPeriodFilter")?.value || "").trim() || budgetQuickFilter !== "all");
}

function renderAccountFilterSummary(filteredCount, totalCount) {
  const summary = byId("accountFilterSummary");
  if (!summary) {
    return;
  }
  const parts = [];
  const status = byId("accountStatusFilter")?.value || "";
  const keyword = (byId("accountTypeFilter")?.value || "").trim();
  if (status !== "") {
    parts.push(`状态=${status === "1" ? "启用" : "停用"}`);
  }
  if (keyword) {
    parts.push(`关键词=${keyword}`);
  }
  if (accountQuickFilter !== "all") {
    parts.push(`快捷=${{ shared: "共享账户", credit: "信用账户", enabled: "仅启用" }[accountQuickFilter] || accountQuickFilter}`);
  }
  const sortLabel = { "name-asc": "名称 A-Z", "balance-desc": "余额从高到低", "balance-asc": "余额从低到高" }[byId("accountSortFilter")?.value || "name-asc"];
  summary.textContent = parts.length === 0
    ? `当前未启用筛选，共 ${formatNumber(totalCount, 0)} 个账户；当前排序：${sortLabel}`
    : `已筛选：${parts.join("，")}；命中 ${formatNumber(filteredCount, 0)} / ${formatNumber(totalCount, 0)} 个账户；当前排序：${sortLabel}`;
}

function renderCategoryFilterSummary(filteredCount, totalCount) {
  const summary = byId("categoryFilterSummary");
  if (!summary) {
    return;
  }
  const parts = [];
  const enabled = byId("categoryEnabledFilter")?.value || "";
  const keyword = (byId("categoryTypeFilter")?.value || "").trim();
  if (enabled !== "") {
    parts.push(`状态=${enabled === "1" ? "启用" : "停用"}`);
  }
  if (keyword) {
    parts.push(`关键词=${keyword}`);
  }
  if (categoryQuickFilter !== "all") {
    parts.push(`快捷=${{ expense: "支出分类", income: "收入分类", enabled: "仅启用" }[categoryQuickFilter] || categoryQuickFilter}`);
  }
  const sortLabel = { "sort-asc": "排序值升序", "name-asc": "名称 A-Z", "name-desc": "名称 Z-A" }[byId("categorySortFilter")?.value || "sort-asc"];
  summary.textContent = parts.length === 0
    ? `当前未启用筛选，共 ${formatNumber(totalCount, 0)} 个分类；当前排序：${sortLabel}`
    : `已筛选：${parts.join("，")}；命中 ${formatNumber(filteredCount, 0)} / ${formatNumber(totalCount, 0)} 个分类；当前排序：${sortLabel}`;
}

function renderBudgetFilterSummary(filteredCount, totalCount) {
  const summary = byId("budgetFilterSummary");
  if (!summary) {
    return;
  }
  const parts = [];
  const enabled = byId("budgetEnabledFilter")?.value || "";
  const keyword = (byId("budgetPeriodFilter")?.value || "").trim();
  if (enabled !== "") {
    parts.push(`状态=${enabled === "1" ? "启用" : "停用"}`);
  }
  if (keyword) {
    parts.push(`关键词=${keyword}`);
  }
  if (budgetQuickFilter !== "all") {
    parts.push(`快捷=${{ alert: "预警预算", exceeded: "超支预算", monthly: "月度预算" }[budgetQuickFilter] || budgetQuickFilter}`);
  }
  const sortLabel = { "amount-desc": "金额从高到低", "amount-asc": "金额从低到高", "name-asc": "名称 A-Z" }[byId("budgetSortFilter")?.value || "amount-desc"];
  summary.textContent = parts.length === 0
    ? `当前未启用筛选，共 ${formatNumber(totalCount, 0)} 个预算；当前排序：${sortLabel}`
    : `已筛选：${parts.join("，")}；命中 ${formatNumber(filteredCount, 0)} / ${formatNumber(totalCount, 0)} 个预算；当前排序：${sortLabel}`;
}

function resetAccountFilters() {
  byId("accountStatusFilter").value = "";
  byId("accountTypeFilter").value = "";
  byId("accountSortFilter").value = "name-asc";
  accountQuickFilter = "all";
  accountShowSelectedOnly = false;
  updateQuickTagButtons({
    all: "accountQuickAllBtn",
    shared: "accountQuickSharedBtn",
    credit: "accountQuickCreditBtn",
    enabled: "accountQuickEnabledBtn"
  }, accountQuickFilter);
  renderAccounts(getFilteredAccounts(accounts));
}

function resetCategoryFilters() {
  byId("categoryEnabledFilter").value = "";
  byId("categoryTypeFilter").value = "";
  byId("categorySortFilter").value = "sort-asc";
  categoryQuickFilter = "all";
  categoryShowSelectedOnly = false;
  updateQuickTagButtons({
    all: "categoryQuickAllBtn",
    expense: "categoryQuickExpenseBtn",
    income: "categoryQuickIncomeBtn",
    enabled: "categoryQuickEnabledBtn"
  }, categoryQuickFilter);
  renderCategories(getFilteredCategories(categories));
}

function resetBudgetFilters() {
  byId("budgetEnabledFilter").value = "";
  byId("budgetPeriodFilter").value = "";
  byId("budgetSortFilter").value = "amount-desc";
  budgetQuickFilter = "all";
  budgetShowSelectedOnly = false;
  updateQuickTagButtons({
    all: "budgetQuickAllBtn",
    alert: "budgetQuickAlertBtn",
    exceeded: "budgetQuickExceededBtn",
    monthly: "budgetQuickMonthlyBtn"
  }, budgetQuickFilter);
  renderBudgets(getFilteredBudgets(budgets));
}

function applyAccountQuickFilter(filter) {
  accountQuickFilter = filter;
  updateQuickTagButtons({
    all: "accountQuickAllBtn",
    shared: "accountQuickSharedBtn",
    credit: "accountQuickCreditBtn",
    enabled: "accountQuickEnabledBtn"
  }, accountQuickFilter);
  renderAccounts(getFilteredAccounts(accounts));
}

function applyCategoryQuickFilter(filter) {
  categoryQuickFilter = filter;
  updateQuickTagButtons({
    all: "categoryQuickAllBtn",
    expense: "categoryQuickExpenseBtn",
    income: "categoryQuickIncomeBtn",
    enabled: "categoryQuickEnabledBtn"
  }, categoryQuickFilter);
  renderCategories(getFilteredCategories(categories));
}

function applyBudgetQuickFilter(filter) {
  budgetQuickFilter = filter;
  updateQuickTagButtons({
    all: "budgetQuickAllBtn",
    alert: "budgetQuickAlertBtn",
    exceeded: "budgetQuickExceededBtn",
    monthly: "budgetQuickMonthlyBtn"
  }, budgetQuickFilter);
  renderBudgets(getFilteredBudgets(budgets));
}

function applyRuleQuickFilter(filter) {
  ruleQuickFilter = filter;
  updateQuickTagButtons({
    all: "ruleQuickAllBtn",
    high: "ruleQuickHighBtn"
  }, ruleQuickFilter);
  filteredRules = getFilteredRules(allRules);
  renderRules(filteredRules);
}

function exportCurrentAccounts() {
  const items = getFilteredAccounts(accounts);
  downloadCsv("accounts_current_view.csv", [
    ["ID", "账户名称", "类型", "余额", "状态", "共享", "所属成员"],
    ...items.map((item) => [item.id, item.accountName, item.accountType, item.currentBalance, Number(item.status) === 1 ? "启用" : "停用", Number(item.isShared) === 1 ? "是" : "否", formatMemberRef(item.ownerMemberId)])
  ]);
  setBusinessStatus(`账户当前结果已导出，共 ${formatNumber(items.length, 0)} 条。`);
}

function exportCurrentCategories() {
  const items = getFilteredCategories(categories);
  downloadCsv("categories_current_view.csv", [
    ["ID", "分类名称", "类型", "作用域", "状态", "排序"],
    ...items.map((item) => [item.id, item.categoryName, item.categoryType, item.scopeType || "-", Number(item.enabled) === 1 ? "启用" : "停用", item.sortOrder ?? ""])
  ]);
  setBusinessStatus(`分类当前结果已导出，共 ${formatNumber(items.length, 0)} 条。`);
}

function exportCurrentBudgets() {
  const items = getFilteredBudgets(budgets);
  downloadCsv("budgets_current_view.csv", [
    ["ID", "预算名称", "周期", "金额", "状态", "预警状态"],
    ...items.map((item) => {
      const usage = getBudgetUsageItem(item.id);
      return [item.id, item.budgetName, item.periodType, item.amount, Number(item.enabled) === 1 ? "启用" : "停用", usage?.exceeded ? "超支" : usage?.alertTriggered ? "预警" : "正常"];
    })
  ]);
  setBusinessStatus(`预算当前结果已导出，共 ${formatNumber(items.length, 0)} 条。`);
}

function toggleSelection(list, id, checked) {
  const targetId = Number(id);
  const set = new Set(list || []);
  if (checked) {
    set.add(targetId);
  } else {
    set.delete(targetId);
  }
  return Array.from(set);
}

function syncSelectionToVisible(selectedIds, items) {
  const visibleIds = new Set((items || []).map((item) => Number(item.id)));
  return (selectedIds || []).filter((id) => visibleIds.has(Number(id)));
}

function renderBatchToolbar(kind, selectedCount, totalCount, labels) {
  const showSelectedOnly = {
    account: accountShowSelectedOnly,
    category: categoryShowSelectedOnly,
    budget: budgetShowSelectedOnly
  }[kind];
  return `
    <div class="batch-toolbar">
      <div class="batch-toolbar-info">已选 ${formatNumber(selectedCount, 0)} 项，当前列表 ${formatNumber(totalCount, 0)} 项</div>
      <div class="batch-toolbar-actions">
        <button class="mini-btn" type="button" data-action="${kind}-select-all">全选当前列表</button>
        <button class="mini-btn" type="button" data-action="${kind}-clear-selection">清空选择</button>
        <button class="mini-btn" type="button" data-action="${kind}-toggle-selected-view">${showSelectedOnly ? "显示全部结果" : "仅看已选"}</button>
        <button class="mini-btn" type="button" data-action="${kind}-export-current">导出当前结果</button>
        <button class="mini-btn" type="button" data-action="${kind}-batch-enable" ${selectedCount === 0 ? "disabled" : ""}>批量${labels.enable}</button>
        <button class="mini-btn" type="button" data-action="${kind}-batch-disable" ${selectedCount === 0 ? "disabled" : ""}>批量${labels.disable}</button>
        <button class="mini-btn danger" type="button" data-action="${kind}-batch-delete" ${selectedCount === 0 ? "disabled" : ""}>批量删除</button>
      </div>
    </div>
  `;
}

function renderResultOverview(cards) {
  return `
    <div class="result-overview">
      ${cards.map((card) => `
        <div class="result-card ${card.tone || ""}">
          <div class="result-card-label">${escapeHtml(card.label)}</div>
          <div class="result-card-value">${escapeHtml(card.value)}</div>
          <div class="result-card-meta">${escapeHtml(card.meta || "")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderAlertStrip(items) {
  if (!items || items.length === 0) {
    return "";
  }
  return `
    <div class="alert-strip">
      ${items.map((item) => `<div class="alert-chip ${item.tone || ""}">${escapeHtml(item.text)}</div>`).join("")}
    </div>
  `;
}

function renderRulesBatchToolbar(selectedCount, totalCount) {
  return `
    <div class="batch-toolbar">
      <div class="batch-toolbar-info">已选 ${formatNumber(selectedCount, 0)} 条规则，当前列表 ${formatNumber(totalCount, 0)} 条</div>
      <div class="batch-toolbar-actions">
        <button class="mini-btn" type="button" data-action="rule-select-all">全选当前列表</button>
        <button class="mini-btn" type="button" data-action="rule-clear-selection">清空选择</button>
        <button class="mini-btn" type="button" data-action="rule-batch-enable" ${selectedCount === 0 ? "disabled" : ""}>批量启用</button>
        <button class="mini-btn" type="button" data-action="rule-batch-disable" ${selectedCount === 0 ? "disabled" : ""}>批量停用</button>
      </div>
    </div>
  `;
}

function renderNotificationsBatchToolbar(selectedCount, totalCount) {
  return `
    <div class="batch-toolbar">
      <div class="batch-toolbar-info">已选 ${formatNumber(selectedCount, 0)} 条通知，当前列表 ${formatNumber(totalCount, 0)} 条</div>
      <div class="batch-toolbar-actions">
        <button class="mini-btn" type="button" data-action="notification-select-all">全选当前列表</button>
        <button class="mini-btn" type="button" data-action="notification-clear-selection">清空选择</button>
        <button class="mini-btn" type="button" data-action="notification-batch-read" ${selectedCount === 0 ? "disabled" : ""}>批量已读</button>
        <button class="mini-btn danger" type="button" data-action="notification-batch-delete" ${selectedCount === 0 ? "disabled" : ""}>批量删除</button>
      </div>
    </div>
  `;
}

function renderBusinessLists() {
  renderAccounts(getFilteredAccounts(accounts));
  renderCategories(getFilteredCategories(categories));
  renderBudgets(getFilteredBudgets(budgets));
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
  latestRuleEvaluation = null;
  accounts = [];
  categories = [];
  budgets = [];
  budgetUsage = [];
  transactionItems = [];
  transactionMonthlySummary = [];
  transactionTotalElements = 0;
  transactionPageIndex = 0;
  transactionTotalPages = 0;
  notificationsTotalElements = 0;
  notificationsPageIndex = 0;
  notificationsTotalPages = 0;
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
  renderRulesOverviewPanel();
  renderAccounts([]);
  renderCategories([]);
  renderBudgets([]);
  renderTransactions([]);
  renderTransactionMonthlySummary([]);
  renderBusinessOverviewPanel();
  renderSidebarStatusPanel();
  renderAcceptanceWorkspace();
  setRulesStatus("请先登录后再加载规则与通知。", true);
  setBusinessStatus("请先登录后再加载业务模块。", true);
}

function restoreSession() {
  token = localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  restoreRecentGlobalCommands();
  renderGlobalCommandDeck();
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

function renderSidebarStatusPanel() {
  const host = byId("sidebarStatusBoard");
  if (!host) {
    return;
  }
  const latestImportRecord = importHistory[0] || (latestImport ? { result: latestImport } : null);
  const importQuality = latestImportRecord ? getImportQualityConclusion(latestImportRecord.result) : { label: "待确认", tone: "info" };
  const budgetAlerts = budgetUsage.filter((item) => item.alertTriggered || item.exceeded).length;
  const unreadNotifications = notificationsPage.filter((item) => Number(item.readStatus) !== 1).length;
  const highPriorityRules = allRules.filter((item) => Number(item.priority || 0) >= 8).length;
  const statusItems = [
    {
      label: "导入质量",
      hint: latestImportRecord ? "跳转到导入中心查看最新批次" : "跳转到导入中心",
      value: importQuality.label,
      tone: importQuality.tone || "",
      action: "dashboard-open-import-issues"
    },
    {
      label: "预算异常",
      hint: budgetAlerts > 0 ? "跳转到预算异常视图" : "跳转到预算管理",
      value: formatNumber(budgetAlerts, 0),
      tone: budgetAlerts > 0 ? "warning" : "",
      action: "business-open-alert-budgets"
    },
    {
      label: "未读通知",
      hint: unreadNotifications > 0 ? "跳转到未读通知列表" : "跳转到通知中心",
      value: formatNumber(unreadNotifications, 0),
      tone: unreadNotifications > 0 ? "warning" : "",
      action: "notifications-open-unread"
    },
    {
      label: "高优先级规则",
      hint: highPriorityRules > 0 ? "跳转到高优先级规则视图" : "跳转到规则列表",
      value: formatNumber(highPriorityRules, 0),
      tone: highPriorityRules > 0 ? "info" : "",
      action: "rules-open-high-priority"
    }
  ];
  host.innerHTML = `
    ${statusItems.map((item) => `
      <button class="sidebar-status-item ${item.tone}" type="button" data-action="${item.action}">
        <span class="sidebar-status-copy">
          <span>${escapeHtml(item.label)}</span>
          <small>${escapeHtml(item.hint)}</small>
        </span>
        <strong>${escapeHtml(item.value)}</strong>
      </button>
    `).join("")}
  `;
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

function renderPager(containerId, pageIndex, totalPages, totalElements, pageSize, prefix) {
  const host = byId(containerId);
  if (!host) {
    return;
  }
  const safeTotalPages = Math.max(Number(totalPages) || 0, 0);
  const safePageIndex = Math.max(Math.min(Number(pageIndex) || 0, Math.max(safeTotalPages - 1, 0)), 0);
  const safeTotalElements = Math.max(Number(totalElements) || 0, 0);
  const safePageSize = Math.max(Number(pageSize) || 1, 1);
  const from = safeTotalElements === 0 ? 0 : safePageIndex * safePageSize + 1;
  const to = safeTotalElements === 0 ? 0 : Math.min((safePageIndex + 1) * safePageSize, safeTotalElements);

  host.innerHTML = `
    <div class="pager-info">
      共 ${formatNumber(safeTotalElements, 0)} 条，第 ${formatNumber(safePageIndex + 1, 0)} / ${formatNumber(Math.max(safeTotalPages, 1), 0)} 页，当前显示 ${formatNumber(from, 0)}-${formatNumber(to, 0)}
    </div>
    <div class="pager-actions">
      <button class="mini-btn" type="button" data-action="${prefix}-prev-page" ${safePageIndex <= 0 ? "disabled" : ""}>上一页</button>
      <button class="mini-btn" type="button" data-action="${prefix}-next-page" ${safeTotalPages === 0 || safePageIndex >= safeTotalPages - 1 ? "disabled" : ""}>下一页</button>
      <input id="${prefix}PageInput" class="pager-input" type="number" min="1" max="${Math.max(safeTotalPages, 1)}" value="${safePageIndex + 1}">
      <button class="mini-btn" type="button" data-action="${prefix}-jump-page">跳转</button>
    </div>
  `;
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

function renderImportStateBoard(result = latestImport) {
  const host = byId("importStateBoard");
  if (!host) {
    return;
  }
  if (!result) {
    host.innerHTML = `
      <div class="summary-item">
        <strong>尚未执行导入</strong>
        <div>当前没有最近批次，建议先执行导入，再判断质量、异常和后续动作。</div>
      </div>
    `;
    return;
  }
  const quality = getImportQualityConclusion(result);
  const status = result.importStatus || "";
  const hasFailure = isImportFailed(status);
  const hasDegrade = Number(result.fredImported || 0) === 0;
  const cards = [
    {
      label: "总体质量",
      tone: quality.tone || "warning",
      meta: quality.detail || quality.label
    },
    {
      label: "零售与世行",
      tone: Number(result.retailImported || 0) > 0 && Number(result.worldBankImported || 0) > 0 ? "success" : "warning",
      meta: `retail ${formatNumber(result.retailImported, 0)} / world ${formatNumber(result.worldBankImported, 0)}`
    },
    {
      label: "FRED 状态",
      tone: hasDegrade ? "warning" : "success",
      meta: hasDegrade ? "当前为软降级，宏观序列未入库" : `已导入 ${formatNumber(result.fredImported, 0)} 条宏观点`
    },
    {
      label: "后续动作",
      tone: hasFailure ? "danger" : (hasDegrade ? "warning" : "success"),
      meta: hasFailure ? "建议先复查参数并重新导入" : (hasDegrade ? "可先继续分析，但答辩前建议补抓 FRED" : "可以直接切换分析页刷新汇总")
    }
  ];
  const actions = [
    ...(hasFailure ? [{ label: "重新导入", command: "acceptance-run" }] : []),
    ...(!hasFailure ? [{ label: "刷新分析汇总", command: "analysis-summary" }] : []),
    ...(hasDegrade ? [{ label: "查看降级批次", command: "imports-degraded" }] : [{ label: "查看导入异常", command: "imports-issues" }])
  ];
  host.innerHTML = `
    <div class="import-state-grid">
      ${cards.map((item) => `
        <div class="import-state-item ${item.tone}">
          <div class="import-state-head">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="status-chip ${item.tone === "danger" ? "danger" : (item.tone === "warning" ? "warning" : "success")}">${item.tone === "danger" ? "异常" : (item.tone === "warning" ? "待确认" : "完成")}</span>
          </div>
          <div class="import-state-meta">${escapeHtml(item.meta)}</div>
        </div>
      `).join("")}
    </div>
    <div class="item-actions">
      ${actions.map((item) => `
        <button class="mini-btn" type="button" data-action="run-global-command" data-command="${item.command}">
          ${escapeHtml(item.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderAnalysisStateBoard(state = "idle", summary = latestSummary, errorMessage = "") {
  const host = byId("analysisStateBoard");
  if (!host) {
    return;
  }
  if (state === "loading") {
    host.innerHTML = `
      <div class="summary-item warning">
        <strong>分析汇总加载中</strong>
        <div>正在请求真实数据分析汇总，稍后会同步更新国家趋势、FRED 状态、自动结论和原始回执。</div>
      </div>
    `;
    return;
  }
  if (state === "error") {
    host.innerHTML = `
      <div class="summary-item danger">
        <strong>分析汇总加载失败</strong>
        <div>${escapeHtml(errorMessage || "当前未拿到分析结果，请检查接口状态和参数。")}</div>
      </div>
    `;
    return;
  }
  if (!summary) {
    host.innerHTML = `
      <div class="summary-item">
        <strong>尚未生成分析汇总</strong>
        <div>当前分析页还没有真实结果，建议先完成导入，再执行分析汇总。</div>
      </div>
    `;
    return;
  }
  const retailOverview = summary?.retailOverview || {};
  const worldBankTrend = summary?.worldBankTrend || {};
  const fredSeries = summary?.fredSeries || {};
  const worldBankPoints = worldBankTrend.points?.length || 0;
  const fredPoints = fredSeries.points?.length || 0;
  const conclusions = summary?.conclusions || [];
  const cards = [
    {
      label: "零售数据",
      tone: Number(retailOverview.totalRecords || 0) > 0 ? "success" : "warning",
      meta: `记录 ${formatNumber(retailOverview.totalRecords, 0)} 条 / 金额 ${formatNumber(retailOverview.totalAmount)}`
    },
    {
      label: "国家趋势",
      tone: worldBankPoints > 0 ? "success" : "danger",
      meta: worldBankPoints > 0 ? `${escapeHtml(worldBankTrend.countryIso3 || "-")} 共 ${formatNumber(worldBankPoints, 0)} 个趋势点` : "世行趋势为空，当前无法支撑国家趋势结论"
    },
    {
      label: "宏观序列",
      tone: fredPoints > 0 ? "success" : "warning",
      meta: fredPoints > 0 ? `${escapeHtml(fredSeries.seriesId || "-")} 共 ${formatNumber(fredPoints, 0)} 个点` : "FRED 当前无点数，属于软降级展示"
    },
    {
      label: "自动结论",
      tone: conclusions.length > 0 ? "success" : "warning",
      meta: conclusions.length > 0 ? `已生成 ${formatNumber(conclusions.length, 0)} 条结论，可直接用于汇报说明` : "当前没有自动结论输出"
    }
  ];
  host.innerHTML = `
    <div class="analysis-state-grid">
      ${cards.map((item) => `
        <div class="analysis-state-item ${item.tone}">
          <div class="analysis-state-title">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="status-chip ${item.tone === "danger" ? "danger" : (item.tone === "warning" ? "warning" : "success")}">${item.tone === "danger" ? "异常" : (item.tone === "warning" ? "待确认" : "完成")}</span>
          </div>
          <div class="analysis-state-meta">${escapeHtml(item.meta)}</div>
        </div>
      `).join("")}
    </div>
    <div class="summary-item">
      <strong>分析完成说明</strong>
      <div>自动结论来自当前汇总结果；原始回执区域用于解释这些结论对应的零售、世行和 FRED 原始结构。</div>
    </div>
  `;
}

function updateImportHistoryStats(items) {
  const total = items?.length || 0;
  const successful = (items || []).filter((item) => getImportHistoryTone(item) === "success").length;
  const abnormal = (items || []).filter((item) => getImportHistoryTone(item) === "danger").length;
  const degraded = (items || []).filter((item) => Number(item.result?.fredImported || 0) === 0).length;
  const latestStatus = items?.[0]?.result?.importStatus || latestImport?.importStatus || "未执行";
  const filteredCount = getFilteredImportHistory(items).length;
  byId("importHistoryStats").innerHTML = `
    <div class="stats-pill">总批次：${formatNumber(total, 0)}</div>
    <div class="stats-pill">当前筛选：${formatNumber(filteredCount, 0)}</div>
    <div class="stats-pill">成功：${formatNumber(successful, 0)}</div>
    <div class="stats-pill">异常：${formatNumber(abnormal, 0)}</div>
    <div class="stats-pill">FRED 降级：${formatNumber(degraded, 0)}</div>
    <div class="stats-pill">最近状态：${escapeHtml(latestStatus)}</div>
  `;
}

function renderLatestImport(result) {
  const host = byId("latestImportResult");
  if (!result) {
    host.innerHTML = '<div class="summary-item">暂无导入结果</div>';
    renderImportStateBoard(null);
    return;
  }
  const importTone = getImportHistoryTone({ result });
  const qualityConclusion = getImportQualityConclusion(result);
  host.innerHTML = `
    ${renderResultOverview([
      { label: "导入状态", value: escapeHtml(result.importStatus || "未知"), meta: `批次 ${formatNumber(result.importBatchId, 0)}`, tone: importTone === "danger" ? "danger" : importTone === "warning" ? "warning" : "" },
      { label: "零售导入", value: formatNumber(result.retailImported, 0), meta: "主交易明细" },
      { label: "世行导入", value: formatNumber(result.worldBankImported, 0), meta: "国家趋势数据" },
      { label: "FRED 导入", value: formatNumber(result.fredImported, 0), meta: Number(result.fredImported || 0) === 0 ? "当前为软降级" : "宏观序列已接通", tone: Number(result.fredImported || 0) === 0 ? "warning" : "" },
      { label: "导入质量", value: qualityConclusion.label, meta: qualityConclusion.detail, tone: qualityConclusion.tone }
    ])}
    <div class="summary-item"><strong>处理目录</strong><div>${escapeHtml(result.processedDir)}</div></div>
    <div class="summary-item">
      <strong>结果判断</strong>
      <div>${Number(result.retailImported || 0) > 0 && Number(result.worldBankImported || 0) > 0 ? "核心真实数据已入库，可继续分析。" : "当前核心数据未完全入库，建议优先复核批次结果。"} ${Number(result.fredImported || 0) === 0 ? "FRED 当前处于软降级状态。" : ""}</div>
    </div>
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
    <div class="item-actions">
      <button class="mini-btn" type="button" data-action="run-global-command" data-command="analysis-summary">切到分析并刷新</button>
      <button class="mini-btn" type="button" data-action="run-global-command" data-command="${Number(result.fredImported || 0) === 0 ? "imports-degraded" : "imports-issues"}">查看对应批次</button>
    </div>
  `;
  renderImportStateBoard(result);
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
  updateImportHistoryStats(importHistory);
  const items = getSortedImportHistory(getFilteredImportHistory(importHistory));
  if (items.length === 0) {
    renderEmptyBoard("importHistoryList", importHistory.length > 0 ? "当前筛选条件下暂无导入记录" : "暂无导入历史");
    renderAcceptanceWorkspace();
    return;
  }
  if (selectedImportHistoryId && !items.some((item) => item.id === selectedImportHistoryId)) {
    selectedImportHistoryId = items[0]?.id ?? null;
  }
  if (!selectedImportHistoryId) {
    selectedImportHistoryId = items[0]?.id ?? null;
  }
  host.classList.remove("empty-board");
  host.innerHTML = items.map((item) => `
    <div class="table-row import-history-row import-history-row-${getImportHistoryTone(item)} ${item.id === selectedImportHistoryId ? "is-active" : ""}" data-action="select-import-history" data-history-id="${item.id}">
      <div class="table-main">
        <div class="table-title">${escapeHtml(item.params.processedDir)}</div>
        <div class="table-meta">${item.params.truncateBeforeImport ? "清空后全量导入" : "增量导入"} / batchSize=${formatNumber(item.params.batchSize, 0)} / 批次 ${formatNumber(item.result?.importBatchId, 0)}</div>
        <div class="meta-line">${formatDateTime(item.createdAt)}</div>
      </div>
      <div class="table-side">
        <span class="status-chip ${getImportHistoryTone(item)}">${escapeHtml(item.result?.importStatus || "状态未知")}</span>
        <span class="status-chip success">retail ${formatNumber(item.result?.retailImported, 0)}</span>
        <span class="status-chip success">world ${formatNumber(item.result?.worldBankImported, 0)}</span>
        <span class="status-chip ${Number(item.result?.fredImported || 0) > 0 ? "success" : "warning"}">fred ${formatNumber(item.result?.fredImported, 0)}</span>
      </div>
    </div>
  `).join("");
  renderAcceptanceWorkspace();
}

function renderImportHistoryDetail() {
  const host = byId("importHistoryDetail");
  const record = importHistory.find((item) => item.id === selectedImportHistoryId);
  if (!record) {
    host.innerHTML = '<div class="summary-item">请选择左侧某次导入记录</div>';
    return;
  }
  const qualityConclusion = getImportQualityConclusion(record.result);
  const alerts = [
    ...(isImportFailed(record.result?.importStatus) ? [{ text: `当前批次导入失败：${record.result?.importStatus || "状态未知"}`, tone: "danger" }] : []),
    ...(!isImportFailed(record.result?.importStatus) && !isImportSuccessful(record.result?.importStatus) ? [{ text: `当前批次状态待确认：${record.result?.importStatus || "状态未知"}`, tone: "warning" }] : []),
    ...(Number(record.result?.fredImported || 0) === 0 ? [{ text: "FRED 本批次导入为 0，前台宏观序列会以软降级方式展示。", tone: "warning" }] : []),
    ...(Number(record.result?.worldBankImported || 0) === 0 ? [{ text: "World Bank 本批次导入为 0，国家趋势可能无法展示。", tone: "danger" }] : [])
  ];
  host.innerHTML = `
    ${renderAlertStrip(alerts)}
    ${renderResultOverview([
      { label: "导入质量结论", value: qualityConclusion.label, meta: qualityConclusion.detail, tone: qualityConclusion.tone },
      { label: "导入状态", value: escapeHtml(record.result?.importStatus || "未知"), meta: `批次 ${formatNumber(record.result?.importBatchId, 0)}`, tone: getImportHistoryTone(record) === "danger" ? "danger" : getImportHistoryTone(record) === "warning" ? "warning" : "" }
    ])}
    <div class="summary-item"><strong>导入时间</strong><div>${formatDateTime(record.createdAt)}</div></div>
    <div class="summary-item">
      <strong>批次结论</strong>
      <div>${isImportFailed(record.result?.importStatus) ? "该批次导入失败，不建议直接用于分析或验收，请先回填参数并重试。" : (Number(record.result?.fredImported || 0) === 0 ? "该批次核心数据已可用，但 FRED 处于软降级状态。可以继续分析，同时建议保留说明。" : "该批次导入完整，可直接用于分析汇总与系统验收。")}</div>
    </div>
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
      <button class="mini-btn" type="button" data-action="run-global-command" data-command="${Number(record.result?.fredImported || 0) === 0 ? "imports-degraded" : "analysis-summary"}">${Number(record.result?.fredImported || 0) === 0 ? "查看降级批次" : "转到分析页"}</button>
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
    const quickMatched = ruleQuickFilter !== "high" || Number(item.priority || 0) >= 8;
    return enabledMatched && typeMatched && quickMatched;
  });
}

function renderRules(items) {
  const host = byId("rulesList");
  selectedRuleIds = syncSelectionToVisible(selectedRuleIds, items);
  if (!items || items.length === 0) {
    updateRulesStats([]);
    renderEmptyBoard("rulesList", token ? "当前筛选条件下暂无规则" : "请先登录并选择家庭");
    renderRuleDetail(null);
    renderRulesOverviewPanel();
    return;
  }
  host.classList.remove("empty-board");
  updateRulesStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedRuleIds.includes(Number(item.id)));
  host.innerHTML = `
    ${renderRulesBatchToolbar(selectedRuleIds.length, items.length)}
    ${renderResultOverview([
      { label: "启用规则", value: formatNumber(items.filter((item) => Number(item.enabled) === 1).length, 0), meta: `当前结果 ${formatNumber(items.length, 0)} 条` },
      { label: "高优先级", value: formatNumber(items.filter((item) => Number(item.priority || 0) >= 8).length, 0), meta: "优先关注可能影响通知产出的规则", tone: items.some((item) => Number(item.priority || 0) >= 8) ? "warning" : "" },
      { label: "停用规则", value: formatNumber(items.filter((item) => Number(item.enabled) !== 1).length, 0), meta: "可批量启停", tone: items.some((item) => Number(item.enabled) !== 1) ? "warning" : "" }
    ])}
    <div class="data-table">
      <div class="data-table-header rules-table-header">
        <div><input type="checkbox" data-action="rule-toggle-all" ${allSelected ? "checked" : ""}></div>
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
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-rule-select" data-rule-id="${item.id}" ${selectedRuleIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
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
  renderRulesOverviewPanel();
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

function renderBusinessOverviewPanel() {
  const overviewHost = byId("businessOverviewBoard");
  const focusHost = byId("businessFocusBoard");
  if (!overviewHost || !focusHost) {
    return;
  }
  if (!token || !getCurrentFamilyId()) {
    overviewHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看业务总览</div>';
    focusHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看待处理项</div>';
    return;
  }

  const totalBalance = accounts.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const enabledBudgetCount = budgets.filter((item) => Number(item.enabled) === 1).length;
  const alertBudgetItems = budgetUsage.filter((item) => item.alertTriggered || item.exceeded);
  const sharedAccounts = accounts.filter((item) => Number(item.isShared) === 1).length;
  const recentTransactions = [...transactionItems]
    .sort((a, b) => new Date(b.transactionTime || 0).getTime() - new Date(a.transactionTime || 0).getTime())
    .slice(0, 4);
  const latestMonthly = (transactionMonthlySummary || [])[0] || null;

  overviewHost.innerHTML = `
    <div class="business-summary-grid">
      <button class="business-summary-item overview-action-card" type="button" data-action="business-open-balance-overview">
        <strong>账户总余额</strong>
        <div>${formatNumber(totalBalance)}</div>
      </button>
      <button class="business-summary-item overview-action-card" type="button" data-action="business-open-shared-accounts">
        <strong>共享账户</strong>
        <div>${formatNumber(sharedAccounts, 0)}</div>
      </button>
      <button class="business-summary-item overview-action-card" type="button" data-action="business-open-enabled-budgets">
        <strong>启用预算</strong>
        <div>${formatNumber(enabledBudgetCount, 0)}</div>
      </button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">关键状态</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "分类规模", value: `${formatNumber(categories.length, 0)} 个分类` },
          { label: "预算预警", value: `${formatNumber(alertBudgetItems.length, 0)} 项` },
          { label: "交易总量", value: `${formatNumber(transactionTotalElements, 0)} 条` },
          { label: "最近月净额", value: latestMonthly ? formatNumber(latestMonthly.netAmount) : "-" }
        ])}
      </div>
    </div>
  `;

  focusHost.innerHTML = `
    <button class="summary-item overview-action-card" type="button" data-action="business-open-alert-budgets">
      <strong>待处理预算</strong>
      <div>${alertBudgetItems.length > 0 ? `当前有 ${formatNumber(alertBudgetItems.length, 0)} 个预算处于预警/超支状态` : "当前没有预算异常项"}</div>
    </button>
    <button class="summary-item overview-action-card" type="button" data-action="business-open-recent-transactions">
      <strong>最近交易</strong>
      <div>
        ${recentTransactions.length > 0 ? recentTransactions.map((item) => `
          <div class="focus-line">
            <span>${escapeHtml(item.merchantName || item.counterpartyName || `交易#${item.id}`)}</span>
            <span>${formatNumber(item.amount)} / ${escapeHtml(item.transactionType)}</span>
          </div>
        `).join("") : "当前没有交易数据"}
      </div>
    </button>
  `;
  renderExecutiveDashboard();
}

function renderRulesOverviewPanel() {
  const rulesHost = byId("rulesOverviewBoard");
  const notificationsHost = byId("notificationsOverviewBoard");
  const stateHost = byId("rulesStateBoard");
  const actionsHost = byId("notificationsActionBoard");
  if (!rulesHost || !notificationsHost || !stateHost || !actionsHost) {
    return;
  }
  if (!token || !getCurrentFamilyId()) {
    rulesHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看规则总览</div>';
    notificationsHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看通知总览</div>';
    stateHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后判断当前风控状态</div>';
    actionsHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看通知处置建议</div>';
    renderExecutiveDashboard();
    return;
  }
  const enabledRules = allRules.filter((item) => Number(item.enabled) === 1).length;
  const highPriorityRules = allRules.filter((item) => Number(item.priority || 0) >= 8).length;
  const unreadNotifications = notificationsPage.filter((item) => Number(item.readStatus) !== 1).length;
  const ruleSourceNotifications = notificationsPage.filter((item) => includesKeyword(item.sourceType, "RULE")).length;
  const latestNotification = notificationsPage[0] || null;
  const criticalNotifications = notificationsPage.filter((item) => includesKeyword(item.levelCode, "HIGH") || includesKeyword(item.levelCode, "CRITICAL"));
  const disabledRules = allRules.length - enabledRules;
  const riskTone = unreadNotifications > 0 || highPriorityRules > 0 ? "warning" : "success";

  rulesHost.innerHTML = `
    <div class="business-summary-grid">
      <button class="business-summary-item overview-action-card" type="button" data-action="rules-open-all">
        <strong>规则总数</strong>
        <div>${formatNumber(allRules.length, 0)}</div>
      </button>
      <button class="business-summary-item overview-action-card" type="button" data-action="rules-open-enabled">
        <strong>启用规则</strong>
        <div>${formatNumber(enabledRules, 0)}</div>
      </button>
      <button class="business-summary-item overview-action-card" type="button" data-action="rules-open-high-priority">
        <strong>高优先级</strong>
        <div>${formatNumber(highPriorityRules, 0)}</div>
      </button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">规则状态</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "当前筛选命中", value: `${formatNumber(filteredRules.length, 0)} 条` },
          { label: "停用规则", value: `${formatNumber(allRules.length - enabledRules, 0)} 条` },
          { label: "重点提示", value: highPriorityRules > 0 ? "建议优先复核高优先级规则" : "当前无高优先级堆积" }
        ])}
      </div>
    </div>
  `;

  notificationsHost.innerHTML = `
    <div class="business-summary-grid">
      <button class="business-summary-item overview-action-card" type="button" data-action="notifications-open-all">
        <strong>当前页通知</strong>
        <div>${formatNumber(notificationsPage.length, 0)}</div>
      </button>
      <button class="business-summary-item overview-action-card" type="button" data-action="notifications-open-unread">
        <strong>未读通知</strong>
        <div>${formatNumber(unreadNotifications, 0)}</div>
      </button>
      <button class="business-summary-item overview-action-card" type="button" data-action="notifications-open-rule-source">
        <strong>规则来源</strong>
        <div>${formatNumber(ruleSourceNotifications, 0)}</div>
      </button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">最近动态</div>
      <div class="detail-section-body">${latestNotification ? `${escapeHtml(latestNotification.title)} / ${escapeHtml(latestNotification.levelCode || "-")}` : "当前没有通知数据"}</div>
    </div>
  `;
  stateHost.innerHTML = `
    <div class="summary-item ${riskTone}">
      <strong>当前风控判断</strong>
      <div>${unreadNotifications > 0 || highPriorityRules > 0 ? "当前仍存在待处理风险项，建议先看未读通知和高优先级规则。" : "当前规则与通知状态相对稳定，可以进入常规巡检。"} </div>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">核心指标</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "启用规则", value: `${formatNumber(enabledRules, 0)} 条` },
          { label: "停用规则", value: `${formatNumber(disabledRules, 0)} 条` },
          { label: "高优先级规则", value: `${formatNumber(highPriorityRules, 0)} 条` },
          { label: "未读通知", value: `${formatNumber(unreadNotifications, 0)} 条` },
          { label: "高等级通知", value: `${formatNumber(criticalNotifications.length, 0)} 条` },
          { label: "最近评估", value: latestRuleEvaluation ? `触发 ${formatNumber(latestRuleEvaluation.triggeredRuleCount, 0)} / 通知 ${formatNumber(latestRuleEvaluation.generatedNotificationCount, 0)}` : "尚未执行本轮评估" }
        ])}
      </div>
    </div>
  `;
  actionsHost.innerHTML = `
    <div class="summary-item">
      <strong>处置顺序</strong>
      <div>${criticalNotifications.length > 0 ? "先处理高等级通知，再回到规则列表复核相关规则。" : unreadNotifications > 0 ? "先清理未读通知，再评估是否需要复跑规则评估。" : "当前通知压力较低，可按规则优先级做巡检。"} </div>
    </div>
    <div class="item-actions">
      <button class="mini-btn" type="button" data-action="notifications-open-unread">查看未读通知</button>
      <button class="mini-btn" type="button" data-action="rules-open-high-priority">查看高优先级规则</button>
      <button class="mini-btn" type="button" data-action="dashboard-evaluate-rules">重新执行评估</button>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">处置建议</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "通知来源", value: ruleSourceNotifications > 0 ? `当前页 ${formatNumber(ruleSourceNotifications, 0)} 条来自规则评估` : "当前页暂无规则来源通知" },
          { label: "最近通知", value: latestNotification ? summarizeText(latestNotification.title, 28) : "暂无通知" },
          { label: "建议动作", value: unreadNotifications > 0 ? "先标记已读或删除无效通知" : "可继续复核规则启停和优先级" }
        ])}
      </div>
    </div>
  `;
  renderExecutiveDashboard();
}

function renderExecutiveDashboard() {
  const host = byId("executiveDashboard");
  if (!host) {
    return;
  }
  const retailOverview = latestSummary?.retailOverview || {};
  const worldBankTrend = latestSummary?.worldBankTrend || {};
  const fredSeries = latestSummary?.fredSeries || {};
  const importReady = latestImport ? "最近一次导入已完成" : "尚未执行导入";
  const budgetAlerts = budgetUsage.filter((item) => item.alertTriggered || item.exceeded).length;
  const unreadNotifications = notificationsPage.filter((item) => Number(item.readStatus) !== 1).length;
  const enabledRules = allRules.filter((item) => Number(item.enabled) === 1).length;
  const recentImports = importHistory.slice(0, 3);
  const alertBudgets = budgets
    .map((item) => ({ budget: item, usage: getBudgetUsageItem(item.id) }))
    .filter(({ usage }) => usage?.alertTriggered || usage?.exceeded)
    .slice(0, 3);
  const recentNotifications = notificationsPage.slice(0, 3);
  const recentTransactions = [...transactionItems]
    .sort((a, b) => new Date(b.transactionTime || 0).getTime() - new Date(a.transactionTime || 0).getTime())
    .slice(0, 3);
  const highPriorityRules = allRules.filter((item) => Number(item.priority || 0) >= 8);
  const exceededBudgetItems = alertBudgets.filter(({ usage }) => usage?.exceeded);
  const unreadTodoNotifications = notificationsPage.filter((item) => Number(item.readStatus) !== 1);
  const latestImportRecord = importHistory[0] || (latestImport ? { id: latestImport.importBatchId, result: latestImport, createdAt: latestImport.importedAt } : null);
  const latestImportStatus = latestImportRecord?.result?.importStatus || latestImport?.importStatus || "";
  const latestImportQuality = latestImportRecord ? getImportQualityConclusion(latestImportRecord.result) : null;
  const worldBankPoints = worldBankTrend.points?.length || 0;
  const fredPoints = fredSeries.points?.length || 0;
  const analysisIssues = [
    ...(latestSummary && worldBankPoints === 0 ? [{
      tone: "danger",
      label: "分析异常",
      text: "世行趋势结果为空",
      meta: "World Bank 未返回可展示趋势点，请检查导入数据或国家参数。",
      count: "分析",
      action: "dashboard-open-analysis-anomalies"
    }] : []),
    ...(latestSummary && fredPoints === 0 ? [{
      tone: "warning",
      label: "分析降级",
      text: `FRED 序列 ${fredSeries?.seriesId || "PCE"} 当前无数据点`,
      meta: "属于已处理的软降级状态，但建议在答辩前补抓或说明。",
      count: "分析",
      action: "dashboard-open-analysis-anomalies"
    }] : []),
    ...(!latestSummary ? [{
      tone: "warning",
      label: "分析待刷新",
      text: "分析汇总尚未执行",
      meta: "首页指标仍未接入最新真实数据结果。",
      count: "分析",
      action: "dashboard-open-analysis-anomalies"
    }] : [])
  ];
  const importIssues = [
    ...(latestImportRecord && isImportFailed(latestImportStatus) ? [{
      tone: "danger",
      label: "导入失败",
      text: `批次 ${formatNumber(latestImportRecord.result?.importBatchId, 0)} 状态异常`,
      meta: `${latestImportStatus || "状态未知"} / ${formatDateTime(latestImportRecord.createdAt)}`,
      count: "导入",
      action: "dashboard-open-import-issues"
    }] : []),
    ...(latestImportRecord && !isImportFailed(latestImportStatus) && !isImportSuccessful(latestImportStatus) ? [{
      tone: "warning",
      label: "导入待确认",
      text: `最近批次状态为 ${latestImportStatus || "未知"}`,
      meta: "建议进入导入中心查看详细回执和各表导入量。",
      count: "导入",
      action: "dashboard-open-import-issues"
    }] : []),
    ...(latestImportRecord && Number(latestImportRecord.result?.fredImported || 0) === 0 ? [{
      tone: "warning",
      label: "导入降级",
      text: "FRED 本次导入为 0",
      meta: "当前系统可继续运行，但宏观序列展示会处于软降级状态。",
      count: "导入",
      action: "dashboard-open-import-issues"
    }] : [])
  ];
  const todoItems = [
    ...importIssues,
    ...analysisIssues,
    ...(exceededBudgetItems.map(({ budget, usage }) => ({
      tone: "danger",
      label: "预算超支",
      text: budget.budgetName,
      meta: `已用 ${formatNumber(usage?.usedAmount)} / 预算 ${formatNumber(budget.budgetAmount)}`,
      count: "业务",
      action: "dashboard-open-exceeded-budgets"
    }))),
    ...(unreadTodoNotifications.slice(0, 2).map((item) => ({
      tone: "warning",
      label: "未读通知",
      text: item.title,
      meta: `${formatDateTime(item.createdAt)} / ${item.sourceType || "来源未标记"}`,
      count: "通知",
      action: "dashboard-open-unread-notifications"
    }))),
    ...(highPriorityRules.slice(0, 2).map((item) => ({
      tone: "info",
      label: "高优先级规则",
      text: item.ruleName,
      meta: `${item.ruleType || "类型未标记"} / 优先级 ${formatNumber(item.priority, 0)}`,
      count: "规则",
      action: "dashboard-open-high-priority-rules"
    })))
  ]
    .sort((a, b) => ({ danger: 3, warning: 2, info: 1 }[b.tone] - ({ danger: 3, warning: 2, info: 1 }[a.tone])))
    .slice(0, 5);
  const todoSummary = buildTodoSummary(todoItems);
  const totalTodoCount = importIssues.length + analysisIssues.length + exceededBudgetItems.length + unreadTodoNotifications.length + highPriorityRules.length;
  const hiddenTodoCount = Math.max(totalTodoCount - todoItems.length, 0);
  renderSidebarStatusPanel();

  host.innerHTML = `
    <div class="result-overview dashboard-overview">
      <button class="result-card dashboard-card-action ${latestImportQuality?.tone || ""}" type="button" data-action="dashboard-open-import-issues">
        <div class="result-card-label">导入中心</div>
        <div class="result-card-value">${latestImport ? formatNumber(latestImport.importBatchId, 0) : "-"}</div>
        <div class="result-card-meta">${escapeHtml(latestImportQuality?.label || importReady)}</div>
      </button>
      <button class="result-card dashboard-card-action ${latestSummary ? "" : "warning"}" type="button" data-action="dashboard-open-analysis-anomalies">
        <div class="result-card-label">真实分析</div>
        <div class="result-card-value">${formatNumber(retailOverview.totalRecords, 0)}</div>
        <div class="result-card-meta">零售记录 / 世行点数 ${formatNumber(worldBankTrend.points?.length || 0, 0)}</div>
      </button>
      <button class="result-card dashboard-card-action ${budgetAlerts > 0 ? "warning" : ""}" type="button" data-action="dashboard-open-exceeded-budgets">
        <div class="result-card-label">业务状态</div>
        <div class="result-card-value">${formatNumber(accounts.length + budgets.length + categories.length, 0)}</div>
        <div class="result-card-meta">账户+分类+预算总量 / 预算预警 ${formatNumber(budgetAlerts, 0)}</div>
      </button>
      <button class="result-card dashboard-card-action ${unreadNotifications > 0 ? "warning" : ""}" type="button" data-action="dashboard-open-rule-notifications">
        <div class="result-card-label">规则通知</div>
        <div class="result-card-value">${formatNumber(enabledRules, 0)}</div>
        <div class="result-card-meta">启用规则 / 当前页未读通知 ${formatNumber(unreadNotifications, 0)}</div>
      </button>
    </div>
    <div class="toolbar-grid dashboard-grid">
      <div class="toolbar-card">
        <div class="toolbar-title">导入与分析</div>
        <div>最近导入状态：${escapeHtml(latestImport?.importStatus || "未执行")}</div>
        <div>导入质量：${escapeHtml(latestImportQuality?.label || "待确认")}</div>
        <div>FRED 点数：${formatNumber(fredSeries.points?.length || 0, 0)}</div>
        <div class="action-row">
          <button class="mini-btn" type="button" data-view="imports">打开导入中心</button>
          <button class="mini-btn" type="button" data-view="analysis">留在分析面板</button>
        </div>
      </div>
      <div class="toolbar-card">
        <div class="toolbar-title">业务与风控</div>
        <div>共享账户：${formatNumber(accounts.filter((item) => Number(item.isShared) === 1).length, 0)}</div>
        <div>预算异常：${formatNumber(budgetAlerts, 0)}</div>
        <div class="action-row">
          <button class="mini-btn" type="button" data-view="business">打开业务管理</button>
          <button class="mini-btn" type="button" data-view="rules">打开规则通知</button>
        </div>
      </div>
    </div>
    <div class="dashboard-detail-grid">
      <div class="summary-item">
        <strong>最近导入记录</strong>
        <div>
          ${recentImports.length > 0 ? recentImports.map((item) => `
            <div class="focus-line">
              <span>${escapeHtml(item.params.processedDir)}</span>
              <span>${formatDateTime(item.createdAt)}</span>
            </div>
          `).join("") : "暂无导入历史"}
        </div>
      </div>
      <div class="summary-item">
        <strong>异常预算</strong>
        <div>
          ${alertBudgets.length > 0 ? alertBudgets.map(({ budget, usage }) => `
            <div class="focus-line">
              <span>${escapeHtml(budget.budgetName)}</span>
              <span>${usage?.exceeded ? "超支" : "预警"}</span>
            </div>
          `).join("") : "当前没有预算异常项"}
        </div>
      </div>
      <div class="summary-item">
        <strong>最近通知</strong>
        <div>
          ${recentNotifications.length > 0 ? recentNotifications.map((item) => `
            <div class="focus-line">
              <span>${escapeHtml(item.title)}</span>
              <span>${Number(item.readStatus) === 1 ? "已读" : "未读"}</span>
            </div>
          `).join("") : "当前没有通知数据"}
        </div>
      </div>
      <div class="summary-item">
        <strong>最近交易</strong>
        <div>
          ${recentTransactions.length > 0 ? recentTransactions.map((item) => `
            <div class="focus-line">
              <span>${escapeHtml(item.merchantName || item.counterpartyName || `交易#${item.id}`)}</span>
              <span>${formatNumber(item.amount)}</span>
            </div>
          `).join("") : "当前没有交易数据"}
        </div>
      </div>
    </div>
    <div class="summary-item">
      <strong>首页快捷操作</strong>
      <div class="action-row dashboard-actions">
        <button class="mini-btn" type="button" data-action="dashboard-refresh-summary">刷新分析汇总</button>
        <button class="mini-btn" type="button" data-action="dashboard-refresh-business">刷新业务数据</button>
        <button class="mini-btn" type="button" data-action="dashboard-evaluate-rules">执行规则评估</button>
        <button class="mini-btn" type="button" data-action="dashboard-run-acceptance">一键验收</button>
      </div>
    </div>
    <div class="summary-item">
      <strong>优先处理事项</strong>
      <div class="todo-summary-strip">
        ${todoSummary.map((item) => `
          <div class="todo-summary-pill ${item.tone}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="todo-list">
        ${todoItems.length > 0 ? todoItems.map((item) => `
          <button class="todo-item ${item.tone}" type="button" data-action="${item.action}">
            <span class="todo-item-main">
              <span class="todo-item-header">
                <span class="todo-item-label">${escapeHtml(item.label)}</span>
                <span class="todo-item-count">${escapeHtml(item.count)}</span>
              </span>
              <span class="todo-item-text">${escapeHtml(item.text)}</span>
              <span class="todo-item-meta">${escapeHtml(item.meta)}</span>
            </span>
            <span class="todo-item-arrow">前往处理</span>
          </button>
        `).join("") : '<div class="todo-empty">当前没有需要优先处理的事项</div>'}
      </div>
      <div class="todo-footer">
        <span>${hiddenTodoCount > 0 ? `当前仅展示前 ${formatNumber(todoItems.length, 0)} 项，另有 ${formatNumber(hiddenTodoCount, 0)} 项待处理。` : "当前展示的是全部优先事项。"}</span>
        <div class="action-row">
          <button class="mini-btn" type="button" data-action="dashboard-open-import-issues">查看更多导入/分析</button>
          <button class="mini-btn" type="button" data-action="dashboard-open-rule-notifications">查看更多规则通知</button>
        </div>
      </div>
    </div>
  `;
  renderAcceptanceWorkspace();
}

function renderAcceptanceWorkspace() {
  const readinessHost = byId("acceptanceReadinessBoard");
  const stepsHost = byId("acceptanceNextStepsBoard");
  const snapshotHost = byId("acceptanceSnapshotBoard");
  const statusHost = byId("acceptanceStatus");
  if (!readinessHost || !stepsHost || !snapshotHost || !statusHost) {
    return;
  }
  const latestImportRecord = importHistory[0] || (latestImport ? { result: latestImport, createdAt: latestImport.importedAt } : null);
  const latestImportStatus = latestImportRecord?.result?.importStatus || latestImport?.importStatus || "";
  const importQuality = latestImportRecord ? getImportQualityConclusion(latestImportRecord.result) : null;
  const hasBusinessData = accounts.length > 0 || categories.length > 0 || budgets.length > 0 || transactionTotalElements > 0;
  const hasRulesData = allRules.length > 0;
  const hasNotificationsData = notificationsPage.length > 0;
  const checkpoints = [
    {
      label: "登录与上下文",
      ready: Boolean(token && getCurrentFamilyId()),
      danger: false,
      meta: token ? (getCurrentFamilyId() ? "已接通登录态和家庭上下文" : "已登录，但尚未选择家庭") : "尚未登录，无法联调业务和规则模块"
    },
    {
      label: "真实数据导入",
      ready: Boolean(latestImportRecord && !isImportFailed(latestImportStatus)),
      danger: Boolean(latestImportRecord && isImportFailed(latestImportStatus)),
      meta: latestImportRecord ? `${importQuality?.label || "待确认"} / ${latestImportStatus || "状态未知"}` : "尚未执行导入"
    },
    {
      label: "分析汇总",
      ready: Boolean(latestSummary),
      danger: Boolean(latestSummary && ((latestSummary.worldBankTrend?.points?.length || 0) === 0)),
      meta: latestSummary ? `零售 ${formatNumber(latestSummary.retailOverview?.totalRecords, 0)} 条 / 世行 ${formatNumber(latestSummary.worldBankTrend?.points?.length || 0, 0)} 点 / FRED ${formatNumber(latestSummary.fredSeries?.points?.length || 0, 0)} 点` : "尚未刷新分析汇总"
    },
    {
      label: "业务模块",
      ready: hasBusinessData,
      danger: false,
      meta: hasBusinessData ? `账户 ${formatNumber(accounts.length, 0)} / 分类 ${formatNumber(categories.length, 0)} / 预算 ${formatNumber(budgets.length, 0)} / 交易 ${formatNumber(transactionTotalElements, 0)}` : "尚未加载业务模块数据"
    },
    {
      label: "规则与通知",
      ready: hasRulesData || hasNotificationsData,
      danger: false,
      meta: `规则 ${formatNumber(allRules.length, 0)} 条 / 当前页通知 ${formatNumber(notificationsPage.length, 0)} 条 / 未读 ${formatNumber(notificationsPage.filter((item) => Number(item.readStatus) !== 1).length, 0)}`
    },
    {
      label: "验收闭环",
      ready: Boolean(latestImportRecord && latestSummary && hasBusinessData && (hasRulesData || hasNotificationsData)),
      danger: false,
      meta: "导入、分析、业务、规则通知四块至少都应有真实返回"
    }
  ];
  const readyCount = checkpoints.filter((item) => item.ready).length;
  const dangerCount = checkpoints.filter((item) => item.danger).length;
  statusHost.textContent = dangerCount > 0
    ? `当前验收存在 ${formatNumber(dangerCount, 0)} 项高风险阻塞，请先处理异常项。`
    : `当前验收已完成 ${formatNumber(readyCount, 0)}/${formatNumber(checkpoints.length, 0)} 项关键检查。`;
  readinessHost.innerHTML = `
    <div class="acceptance-check-grid">
      ${checkpoints.map((item) => {
        const tone = item.danger ? "danger" : (item.ready ? "success" : "warning");
        const stateText = item.danger ? "异常" : (item.ready ? "就绪" : "待完成");
        return `
          <div class="acceptance-check-item ${tone}">
            <div class="acceptance-check-head">
              <strong>${escapeHtml(item.label)}</strong>
              <span class="status-chip ${item.danger ? "danger" : (item.ready ? "enabled" : "warning")}">${stateText}</span>
            </div>
            <div class="acceptance-check-meta">${escapeHtml(item.meta)}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
  const nextSteps = [
    ...(!token ? [{ title: "先登录管理员账号", meta: "没有登录态时，业务、规则和通知接口都无法形成完整联调。", action: "analysis-summary" }] : []),
    ...(token && !getCurrentFamilyId() ? [{ title: "选择家庭上下文", meta: "当前需要先锁定家庭，再加载业务和规则数据。", action: "analysis-summary" }] : []),
    ...(!latestImportRecord || isImportFailed(latestImportStatus) ? [{ title: "重新执行真实数据导入", meta: "先确保导入结果可用，再做分析和验收。", action: "acceptance-run" }] : []),
    ...(!latestSummary ? [{ title: "刷新分析汇总", meta: "导入后需要重新拉取零售、世行和 FRED 汇总结果。", action: "analysis-summary" }] : []),
    ...(!hasBusinessData ? [{ title: "加载业务模块", meta: "确保账户、分类、预算、交易至少有一块已接通。", action: "business-shared" }] : []),
    ...(!(hasRulesData || hasNotificationsData) ? [{ title: "加载规则与通知", meta: "规则和通知页需要有真实数据才能证明风控链路已打通。", action: "rules-unread" }] : [])
  ].slice(0, 4);
  stepsHost.innerHTML = nextSteps.length > 0 ? `
    <div class="acceptance-step-list">
      ${nextSteps.map((item) => `
        <button class="acceptance-step-item" type="button" data-action="run-global-command" data-command="${item.action}">
          <strong>${escapeHtml(item.title)}</strong>
          <div>${escapeHtml(item.meta)}</div>
        </button>
      `).join("")}
    </div>
  ` : '<div class="summary-item">当前关键模块都已具备验收条件，建议执行一键验收并核对脚本报告。</div>';
  snapshotHost.innerHTML = `
    <div class="summary-item">
      <strong>当前快照</strong>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "最近导入批次", value: latestImportRecord?.result?.importBatchId ? formatNumber(latestImportRecord.result.importBatchId, 0) : "-" },
          { label: "导入状态", value: latestImportStatus || "未执行" },
          { label: "分析汇总", value: latestSummary ? "已刷新" : "未刷新" },
          { label: "业务数据", value: hasBusinessData ? "已加载" : "未加载" },
          { label: "规则数据", value: hasRulesData ? "已加载" : "未加载" },
          { label: "通知数据", value: hasNotificationsData ? "已加载" : "未加载" }
        ])}
      </div>
    </div>
    <div class="summary-item">
      <strong>建议判定</strong>
      <div>${readyCount === checkpoints.length ? "当前管理员端已具备较完整的联通验收展示条件。" : "当前仍建议按左侧建议动作逐步补齐验收链路。"} </div>
    </div>
  `;
}

function updateAccountsStats(items) {
  const total = accounts.length;
  const matched = items.length;
  const enabled = items.filter((item) => Number(item.status) === 1).length;
  const shared = items.filter((item) => Number(item.isShared) === 1).length;
  byId("accountsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">命中：${formatNumber(matched, 0)}</div>
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
  selectedAccountIds = syncSelectionToVisible(selectedAccountIds, items);
  renderAccountFilterSummary(items?.length || 0, accounts.length);
  if (!items || items.length === 0) {
    updateAccountsStats([]);
    renderEmptyBoard("accountList", token ? (hasActiveAccountFilters() ? "当前筛选条件下未找到账户，请调整条件或重置筛选" : "当前家庭暂无账户数据") : "请先登录并选择家庭");
    renderAccountDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateAccountsStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedAccountIds.includes(Number(item.id)));
  const totalBalance = items.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const creditCount = items.filter((item) => includesKeyword(item.accountType, "CREDIT")).length;
  const disabledCount = items.filter((item) => Number(item.status) !== 1).length;
  host.innerHTML = `
    ${renderBatchToolbar("account", selectedAccountIds.length, items.length, { enable: "启用", disable: "停用" })}
    ${renderResultOverview([
      { label: "当前结果总余额", value: formatNumber(totalBalance), meta: `覆盖 ${formatNumber(items.length, 0)} 个账户` },
      { label: "信用账户", value: formatNumber(creditCount, 0), meta: "便于检查授信类账户" },
      { label: "停用账户", value: formatNumber(disabledCount, 0), meta: disabledCount > 0 ? "建议确认是否仍需保留" : "当前无停用账户", tone: disabledCount > 0 ? "warning" : "" }
    ])}
    ${renderAlertStrip([
      ...(disabledCount > 0 ? [{ text: `当前结果中有 ${disabledCount} 个停用账户，可批量启用或清理`, tone: "warning" }] : []),
      ...(items.some((item) => Number(item.isShared) === 1) ? [{ text: "包含共享账户，适合优先检查成员权限与归属", tone: "info" }] : [])
    ])}
    <div class="table-section-meta">
      <span>当前显示 ${formatNumber(items.length, 0)} 个账户</span>
      <span>点击行查看详情，也可直接在行内执行编辑和启停操作</span>
    </div>
    <div class="data-table">
      <div class="data-table-header accounts-table-header">
        <div><input type="checkbox" data-action="account-toggle-all" ${allSelected ? "checked" : ""}></div>
        <div>账户名称</div>
        <div>类型</div>
        <div>余额</div>
        <div>账务信息</div>
        <div>状态</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row accounts-table-row ${item.id === selectedAccountId ? "is-active" : ""}" data-action="select-account" data-account-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-account-select" data-account-id="${item.id}" ${selectedAccountIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">账户名称</span>
              <span class="data-cell-value">${escapeHtml(item.accountName)}</span>
              <span class="data-cell-meta">${formatTableMeta(item.institutionName || "-", formatMemberRef(item.ownerMemberId))}</span>
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
              <span class="data-cell-label">账务信息</span>
              <span class="data-cell-value">账单日 ${item.billingDay ? formatNumber(item.billingDay, 0) : "-"}</span>
              <span class="data-cell-meta">${formatTableMeta(`还款日 ${item.repaymentDay ? formatNumber(item.repaymentDay, 0) : "-"}`, Number(item.isShared) === 1 ? "共享" : "私有")}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.status) === 1 ? "enabled" : "disabled"}">${Number(item.status) === 1 ? "启用" : "停用"}</span>
            </div>
            <div class="data-cell data-cell-actions">
              <div class="table-action-group">
                <button class="mini-btn" type="button" data-action="edit-account" data-account-id="${item.id}">编辑</button>
                <button class="mini-btn" type="button" data-action="toggle-account" data-account-id="${item.id}" data-status="${item.status}">${Number(item.status) === 1 ? "停用" : "启用"}</button>
                <button class="mini-btn danger" type="button" data-action="delete-account" data-account-id="${item.id}">删除</button>
              </div>
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
  const total = categories.length;
  const matched = items.length;
  const enabled = items.filter((item) => Number(item.enabled) === 1).length;
  const expense = items.filter((item) => String(item.categoryType).toUpperCase().includes("EXPENSE")).length;
  byId("categoriesStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">命中：${formatNumber(matched, 0)}</div>
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
  selectedCategoryIds = syncSelectionToVisible(selectedCategoryIds, items);
  renderCategoryFilterSummary(items?.length || 0, categories.length);
  if (!items || items.length === 0) {
    updateCategoriesStats([]);
    renderEmptyBoard("categoryList", token ? (hasActiveCategoryFilters() ? "当前筛选条件下未找到分类，请调整条件或重置筛选" : "当前家庭暂无分类数据") : "请先登录并选择家庭");
    renderCategoryDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateCategoriesStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedCategoryIds.includes(Number(item.id)));
  const expenseCount = items.filter((item) => includesKeyword(item.categoryType, "EXPENSE")).length;
  const rootCount = items.filter((item) => !item.parentId).length;
  const disabledCount = items.filter((item) => Number(item.enabled) !== 1).length;
  host.innerHTML = `
    ${renderBatchToolbar("category", selectedCategoryIds.length, items.length, { enable: "启用", disable: "停用" })}
    ${renderResultOverview([
      { label: "支出分类", value: formatNumber(expenseCount, 0), meta: `当前结果 ${formatNumber(items.length, 0)} 项` },
      { label: "根分类", value: formatNumber(rootCount, 0), meta: "便于检查分类层级结构" },
      { label: "停用分类", value: formatNumber(disabledCount, 0), meta: disabledCount > 0 ? "建议确认是否仍被预算或交易引用" : "当前无停用项", tone: disabledCount > 0 ? "warning" : "" }
    ])}
    ${renderAlertStrip([
      ...(disabledCount > 0 ? [{ text: `当前结果中有 ${disabledCount} 个停用分类，建议优先核对引用关系`, tone: "warning" }] : []),
      ...(rootCount === 0 && items.length > 0 ? [{ text: "当前结果未包含根分类，可能筛选到了某个子层级", tone: "info" }] : [])
    ])}
    <div class="table-section-meta">
      <span>当前显示 ${formatNumber(items.length, 0)} 个分类</span>
      <span>支持直接从列表编辑分类结构和启停状态</span>
    </div>
    <div class="data-table">
      <div class="data-table-header categories-table-header">
        <div><input type="checkbox" data-action="category-toggle-all" ${allSelected ? "checked" : ""}></div>
        <div>分类名称</div>
        <div>类型</div>
        <div>作用域</div>
        <div>层级信息</div>
        <div>状态</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row categories-table-row ${item.id === selectedCategoryId ? "is-active" : ""}" data-action="select-category" data-category-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-category-select" data-category-id="${item.id}" ${selectedCategoryIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">分类名称</span>
              <span class="data-cell-value">${escapeHtml(item.categoryName)}</span>
              <span class="data-cell-meta">${formatTableMeta(formatCategoryRef(item.parentId), item.scopeType || "-")}</span>
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
              <span class="data-cell-label">层级信息</span>
              <span class="data-cell-value">父分类 ${escapeHtml(formatCategoryRef(item.parentId))}</span>
              <span class="data-cell-meta">${formatTableMeta(`排序 ${formatNumber(item.sortOrder, 0)}`, `图标 ${item.iconCode || "-"}`)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用" : "停用"}</span>
            </div>
            <div class="data-cell data-cell-actions">
              <div class="table-action-group">
                <button class="mini-btn" type="button" data-action="edit-category" data-category-id="${item.id}">编辑</button>
                <button class="mini-btn" type="button" data-action="toggle-category" data-category-id="${item.id}" data-enabled="${item.enabled}">${Number(item.enabled) === 1 ? "停用" : "启用"}</button>
                <button class="mini-btn danger" type="button" data-action="delete-category" data-category-id="${item.id}">删除</button>
              </div>
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
  const total = budgets.length;
  const matched = items.length;
  const enabled = items.filter((item) => Number(item.enabled) === 1).length;
  const alerts = budgetUsage.filter((item) => item.alertTriggered || item.exceeded).length;
  byId("budgetsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">命中：${formatNumber(matched, 0)}</div>
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
  selectedBudgetIds = syncSelectionToVisible(selectedBudgetIds, items);
  renderBudgetFilterSummary(items?.length || 0, budgets.length);
  if (!items || items.length === 0) {
    updateBudgetsStats([]);
    renderEmptyBoard("budgetList", token ? (hasActiveBudgetFilters() ? "当前筛选条件下未找到预算，请调整条件或重置筛选" : "当前家庭暂无预算数据") : "请先登录并选择家庭");
    renderBudgetDetail(null);
    renderBusinessMetrics();
    return;
  }
  host.classList.remove("empty-board");
  updateBudgetsStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedBudgetIds.includes(Number(item.id)));
  const alertCount = items.filter((item) => {
    const usage = getBudgetUsageItem(item.id);
    return usage?.alertTriggered || usage?.exceeded;
  }).length;
  const exceededCount = items.filter((item) => {
    const usage = getBudgetUsageItem(item.id);
    return usage?.exceeded;
  }).length;
  const totalBudgetAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  host.innerHTML = `
    ${renderBatchToolbar("budget", selectedBudgetIds.length, items.length, { enable: "启用", disable: "停用" })}
    ${renderResultOverview([
      { label: "预算总额", value: formatNumber(totalBudgetAmount), meta: `覆盖 ${formatNumber(items.length, 0)} 个预算` },
      { label: "预警预算", value: formatNumber(alertCount, 0), meta: "建议优先复核支出进度", tone: alertCount > 0 ? "warning" : "" },
      { label: "超支预算", value: formatNumber(exceededCount, 0), meta: exceededCount > 0 ? "属于当前待处理项" : "当前无超支项", tone: exceededCount > 0 ? "danger" : "" }
    ])}
    ${renderAlertStrip([
      ...(exceededCount > 0 ? [{ text: `当前结果中有 ${exceededCount} 个超支预算，建议先处理异常预算`, tone: "danger" }] : []),
      ...(alertCount > exceededCount ? [{ text: `另有 ${alertCount - exceededCount} 个预算处于预警线附近`, tone: "warning" }] : [])
    ])}
    <div class="table-section-meta">
      <span>当前显示 ${formatNumber(items.length, 0)} 个预算</span>
      <span>列表聚焦预算状态，右侧继续展示使用详情</span>
    </div>
    <div class="data-table">
      <div class="data-table-header budgets-table-header">
        <div><input type="checkbox" data-action="budget-toggle-all" ${allSelected ? "checked" : ""}></div>
        <div>预算名称</div>
        <div>周期</div>
        <div>预算金额</div>
        <div>执行情况</div>
        <div>状态</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => {
          const usage = getBudgetUsageItem(item.id);
          return `
          <div class="data-table-row budgets-table-row ${item.id === selectedBudgetId ? "is-active" : ""}" data-action="select-budget" data-budget-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-budget-select" data-budget-id="${item.id}" ${selectedBudgetIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">预算名称</span>
              <span class="data-cell-value">${escapeHtml(item.budgetName)}</span>
              <span class="data-cell-meta">${formatTableMeta(formatCategoryRef(item.categoryId), formatMemberRef(item.createdByMemberId))}</span>
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
              <span class="data-cell-label">执行情况</span>
              <span class="data-cell-value">${usage?.exceeded ? "已超支" : usage?.alertTriggered ? "预警中" : "正常"}</span>
              <span class="data-cell-meta">${formatTableMeta(`已支出 ${formatNumber(usage?.spentAmount)}`, `剩余 ${formatNumber(usage?.remainingAmount)}`)}</span>
            </div>
            <div class="data-cell">
              <span class="data-cell-label">状态</span>
              <span class="status-chip ${Number(item.enabled) === 1 ? "enabled" : "disabled"}">${Number(item.enabled) === 1 ? "启用" : "停用"}</span>
            </div>
            <div class="data-cell data-cell-actions">
              <div class="table-action-group">
                <button class="mini-btn" type="button" data-action="edit-budget" data-budget-id="${item.id}">编辑</button>
                <button class="mini-btn" type="button" data-action="toggle-budget" data-budget-id="${item.id}" data-enabled="${item.enabled}">${Number(item.enabled) === 1 ? "停用" : "启用"}</button>
                <button class="mini-btn danger" type="button" data-action="delete-budget" data-budget-id="${item.id}">删除</button>
              </div>
            </div>
          </div>
        `;
        }).join("")}
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
  const pageSize = Number(byId("transactionPageSize")?.value || 8);
  if (!items || items.length === 0) {
    updateTransactionsStats([]);
    renderEmptyBoard("transactionList", token ? "当前筛选条件下暂无交易数据" : "请先登录并选择家庭");
    renderTransactionDetail(null);
    renderBusinessMetrics();
    renderPager("transactionsPager", transactionPageIndex, transactionTotalPages, transactionTotalElements, pageSize, "transactions");
    return;
  }
  host.classList.remove("empty-board");
  updateTransactionsStats(items);
  host.innerHTML = `
    <div class="table-section-meta">
      <span>当前页显示 ${formatNumber(items.length, 0)} 条交易，共 ${formatNumber(transactionTotalElements, 0)} 条</span>
      <span>支持直接在列表编辑或删除交易，右侧查看完整详情与月报</span>
    </div>
    <div class="data-table">
      <div class="data-table-header transactions-table-header">
        <div>交易对象</div>
        <div>类型</div>
        <div>金额</div>
        <div>时间</div>
        <div>补充信息</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row transactions-table-row ${item.id === selectedTransactionId ? "is-active" : ""}" data-action="select-transaction" data-transaction-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">交易对象</span>
              <span class="data-cell-value">${escapeHtml(item.merchantName || item.counterpartyName || `交易#${item.id}`)}</span>
              <span class="data-cell-meta">${formatTableMeta(
                item.targetAccountId
                  ? `${formatAccountRef(item.accountId)} -> ${formatAccountRef(item.targetAccountId)}`
                  : formatAccountRef(item.accountId),
                item.categoryId ? formatCategoryRef(item.categoryId) : ""
              )}</span>
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
            <div class="data-cell">
              <span class="data-cell-label">补充信息</span>
              <span class="data-cell-value">${escapeHtml(formatMemberRef(item.createdByMemberId))}</span>
              <span class="data-cell-meta">${formatTableMeta(item.sourcePlatform || "-", summarizeText(item.note || item.externalTradeNo || "-"))}</span>
            </div>
            <div class="data-cell data-cell-actions">
              <div class="table-action-group">
                <button class="mini-btn" type="button" data-action="edit-transaction" data-transaction-id="${item.id}">编辑</button>
                <button class="mini-btn danger" type="button" data-action="delete-transaction" data-transaction-id="${item.id}">删除</button>
              </div>
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
  renderPager("transactionsPager", transactionPageIndex, transactionTotalPages, transactionTotalElements, pageSize, "transactions");
}

async function loadTransactions(page = transactionPageIndex) {
  const familyId = getCurrentFamilyId();
  if (!token) {
    transactionPageIndex = 0;
    transactionTotalPages = 0;
    transactionTotalElements = 0;
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先登录后再加载交易模块。", true);
    return;
  }
  if (!familyId) {
    transactionPageIndex = 0;
    transactionTotalPages = 0;
    transactionTotalElements = 0;
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先选择家庭。", true);
    return;
  }
  try {
    setBusinessStatus("加载交易与月报中...");
    const transactionType = byId("transactionTypeFilter").value;
    const size = Number(byId("transactionPageSize").value || 8);
    const pageToLoad = Math.max(Number(page) || 0, 0);
    const [page, summary] = await Promise.all([
      api(`/api/transaction-records/search${buildQuery({ familyId, transactionType, page: pageToLoad, size })}`),
      api(`/api/transaction-records/family/${familyId}/monthly-summary${buildQuery({ months: 6 })}`)
    ]);
    if ((page.items || []).length === 0 && (page.totalElements || 0) > 0 && pageToLoad > 0) {
      const fallbackPage = Math.max((page.totalPages || 1) - 1, 0);
      if (fallbackPage !== pageToLoad) {
        await loadTransactions(fallbackPage);
        return;
      }
    }
    transactionItems = page.items || [];
    transactionPageIndex = page.page || 0;
    transactionTotalPages = page.totalPages || 0;
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
    transactionPageIndex = 0;
    transactionTotalPages = 0;
    transactionTotalElements = 0;
    renderAccounts([]);
    renderCategories([]);
    renderBudgets([]);
    renderTransactions([]);
    renderTransactionMonthlySummary([]);
    setBusinessStatus("请先登录后再加载业务模块。", true);
    return;
  }
  if (!familyId) {
    transactionPageIndex = 0;
    transactionTotalPages = 0;
    transactionTotalElements = 0;
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
      api(`/api/transaction-records/search${buildQuery({ familyId, transactionType, page: transactionPageIndex, size })}`),
      api(`/api/transaction-records/family/${familyId}/monthly-summary${buildQuery({ months: 6 })}`)
    ]);
    accounts = accountData || [];
    categories = categoryData || [];
    budgets = budgetData || [];
    budgetUsage = budgetUsageData || [];
    transactionItems = transactionPage.items || [];
    transactionPageIndex = transactionPage.page || 0;
    transactionTotalPages = transactionPage.totalPages || 0;
    transactionTotalElements = transactionPage.totalElements || transactionItems.length;
    transactionMonthlySummary = summary || [];
    renderBusinessLists();
    renderTransactions(transactionItems);
    renderTransactionMonthlySummary(transactionMonthlySummary);
    renderBusinessOverviewPanel();
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
    transactionPageIndex = transactionPageIndex > 0 && transactionItems.length <= 1 ? transactionPageIndex - 1 : transactionPageIndex;
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`交易记录删除失败：${error.message}`, true);
  }
}

async function batchToggleAccounts(enabled) {
  if (selectedAccountIds.length === 0) {
    return;
  }
  const action = enabled ? "enable" : "disable";
  for (const id of selectedAccountIds) {
    await api(`/api/accounts/${id}/${action}`, { method: "POST" });
  }
  setBusinessStatus(`账户批量${enabled ? "启用" : "停用"}完成，共处理 ${formatNumber(selectedAccountIds.length, 0)} 项。`);
  selectedAccountIds = [];
  await loadBusinessOverview();
}

async function batchDeleteAccounts() {
  if (selectedAccountIds.length === 0 || !window.confirm(`确认删除已选中的 ${selectedAccountIds.length} 个账户吗？`)) {
    return;
  }
  for (const id of selectedAccountIds) {
    await api(`/api/accounts/${id}`, { method: "DELETE" });
  }
  setBusinessStatus(`账户批量删除完成，共处理 ${formatNumber(selectedAccountIds.length, 0)} 项。`);
  selectedAccountIds = [];
  await loadBusinessOverview();
}

async function batchToggleCategories(enabled) {
  if (selectedCategoryIds.length === 0) {
    return;
  }
  const action = enabled ? "enable" : "disable";
  for (const id of selectedCategoryIds) {
    await api(`/api/categories/${id}/${action}`, { method: "POST" });
  }
  setBusinessStatus(`分类批量${enabled ? "启用" : "停用"}完成，共处理 ${formatNumber(selectedCategoryIds.length, 0)} 项。`);
  selectedCategoryIds = [];
  await loadBusinessOverview();
}

async function batchDeleteCategories() {
  if (selectedCategoryIds.length === 0 || !window.confirm(`确认删除已选中的 ${selectedCategoryIds.length} 个分类吗？`)) {
    return;
  }
  for (const id of selectedCategoryIds) {
    await api(`/api/categories/${id}`, { method: "DELETE" });
  }
  setBusinessStatus(`分类批量删除完成，共处理 ${formatNumber(selectedCategoryIds.length, 0)} 项。`);
  selectedCategoryIds = [];
  await loadBusinessOverview();
}

async function batchToggleBudgets(enabled) {
  if (selectedBudgetIds.length === 0) {
    return;
  }
  const action = enabled ? "enable" : "disable";
  for (const id of selectedBudgetIds) {
    await api(`/api/budgets/${id}/${action}`, { method: "POST" });
  }
  setBusinessStatus(`预算批量${enabled ? "启用" : "停用"}完成，共处理 ${formatNumber(selectedBudgetIds.length, 0)} 项。`);
  selectedBudgetIds = [];
  await loadBusinessOverview();
}

async function batchDeleteBudgets() {
  if (selectedBudgetIds.length === 0 || !window.confirm(`确认删除已选中的 ${selectedBudgetIds.length} 个预算吗？`)) {
    return;
  }
  for (const id of selectedBudgetIds) {
    await api(`/api/budgets/${id}`, { method: "DELETE" });
  }
  setBusinessStatus(`预算批量删除完成，共处理 ${formatNumber(selectedBudgetIds.length, 0)} 项。`);
  selectedBudgetIds = [];
  await loadBusinessOverview();
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
    <div class="stats-pill">总数：${formatNumber(notificationsTotalElements || total, 0)}</div>
    <div class="stats-pill">未读：${formatNumber(unread, 0)}</div>
    <div class="stats-pill">已读：${formatNumber(read, 0)}</div>
  `;
}

function renderNotifications(items) {
  const host = byId("notificationsList");
  selectedNotificationIds = syncSelectionToVisible(selectedNotificationIds, items);
  const pageSize = Number(byId("notificationPageSize")?.value || 8);
  if (!items || items.length === 0) {
    updateNotificationsStats([]);
    renderEmptyBoard("notificationsList", token ? "当前筛选条件下暂无通知" : "请先登录并选择家庭");
    renderNotificationDetail(null);
    renderPager("notificationsPager", notificationsPageIndex, notificationsTotalPages, notificationsTotalElements, pageSize, "notifications");
    renderRulesOverviewPanel();
    return;
  }
  host.classList.remove("empty-board");
  updateNotificationsStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedNotificationIds.includes(Number(item.id)));
  host.innerHTML = `
    ${renderNotificationsBatchToolbar(selectedNotificationIds.length, items.length)}
    ${renderResultOverview([
      { label: "未读通知", value: formatNumber(items.filter((item) => Number(item.readStatus) !== 1).length, 0), meta: `当前页 ${formatNumber(items.length, 0)} 条`, tone: items.some((item) => Number(item.readStatus) !== 1) ? "warning" : "" },
      { label: "规则来源", value: formatNumber(items.filter((item) => includesKeyword(item.sourceType, "RULE")).length, 0), meta: "便于追踪规则评估产出" },
      { label: "高等级通知", value: formatNumber(items.filter((item) => includesKeyword(item.levelCode, "HIGH") || includesKeyword(item.levelCode, "CRITICAL")).length, 0), meta: "建议优先处理高等级消息", tone: items.some((item) => includesKeyword(item.levelCode, "HIGH") || includesKeyword(item.levelCode, "CRITICAL")) ? "danger" : "" }
    ])}
    <div class="data-table">
      <div class="data-table-header notifications-table-header">
        <div><input type="checkbox" data-action="notification-toggle-all" ${allSelected ? "checked" : ""}></div>
        <div>标题</div>
        <div>等级</div>
        <div>来源类型</div>
        <div>状态</div>
        <div>操作</div>
      </div>
      <div class="data-table-body">
        ${items.map((item) => `
          <div class="data-table-row notifications-table-row ${item.id === selectedNotificationId ? "is-active" : ""}" data-action="select-notification" data-notification-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-notification-select" data-notification-id="${item.id}" ${selectedNotificationIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
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
  renderPager("notificationsPager", notificationsPageIndex, notificationsTotalPages, notificationsTotalElements, pageSize, "notifications");
  renderRulesOverviewPanel();
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
  renderAnalysisStateBoard("ready", summary);
  renderExecutiveDashboard();
}

function resetSummary() {
  latestSummary = null;
  renderMetric("metricTotalRecords", "-");
  renderMetric("metricTotalAmount", "-");
  renderMetric("metricWorldBankPoints", "-");
  renderMetric("metricFredPoints", "-");
  renderCountryList([]);
  renderWorldBank(null);
  renderFred(null);
  renderConclusions([]);
  renderRaw({ message: "waiting" });
  renderAnalysisStateBoard("idle", null);
  renderExecutiveDashboard();
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
      breadcrumb: "后台首页 / 真实数据分析",
      workspaceTag: "分析工作区",
      focus: "真实数据汇总、趋势判断、自动结论输出",
      hint: "先执行导入，再刷新分析汇总与首页总控台"
    },
    imports: {
      eyebrow: "Import Center",
      title: "导入管理中心",
      breadcrumb: "后台首页 / 导入管理",
      workspaceTag: "导入工作区",
      focus: "导入批次、数据质量、异常定位与回执复核",
      hint: "优先查看最近批次质量结论，再决定是否重导"
    },
    business: {
      eyebrow: "Business Modules",
      title: "业务管理工作台",
      breadcrumb: "后台首页 / 业务管理",
      workspaceTag: "业务工作区",
      focus: "账户、分类、预算、交易的日常运营与数据维护",
      hint: "从共享账户、预算异常和最近交易切入排查"
    },
    rules: {
      eyebrow: "Rules And Notifications",
      title: "规则与通知工作台",
      breadcrumb: "后台首页 / 规则与通知",
      workspaceTag: "规则工作区",
      focus: "规则启停、优先级复核、通知运营与来源追踪",
      hint: "优先查看未读通知与高优先级规则"
    },
    acceptance: {
      eyebrow: "Acceptance",
      title: "系统联通验收",
      breadcrumb: "后台首页 / 系统验收",
      workspaceTag: "验收工作区",
      focus: "联通检查、接口回执、端到端结果确认",
      hint: "执行一键验收后核对导入、分析、业务与规则状态"
    }
  };
  const meta = metas[view] || metas.analysis;
  byId("pageEyebrow").textContent = meta.eyebrow;
  byId("pageTitle").textContent = meta.title;
  byId("pageBreadcrumb").textContent = meta.breadcrumb;
  byId("pageWorkspaceTag").textContent = meta.workspaceTag;
  byId("pageFocus").textContent = meta.focus;
  byId("pageHint").textContent = meta.hint;
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
  renderGlobalCommandDeck();
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
    renderAnalysisStateBoard("loading", null);
    const response = await api(`/api/real-data-analysis/defense-summary${buildQuery(params)}`, { auth: false });
    renderSummary(response);
    setImportStatuses("分析汇总已刷新。");
    return response;
  } catch (error) {
    setImportStatuses(`汇总加载失败：${error.message}`, true);
    renderAnalysisStateBoard("error", null, error.message);
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
    selectedRuleIds = syncSelectionToVisible(selectedRuleIds, filteredRules);
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

async function batchToggleRules(enabled) {
  if (selectedRuleIds.length === 0) {
    return;
  }
  const action = enabled ? "enable" : "disable";
  for (const id of selectedRuleIds) {
    await api(`/api/rules/${id}/${action}`, { method: "POST" });
  }
  setRulesStatus(`规则批量${enabled ? "启用" : "停用"}完成，共处理 ${formatNumber(selectedRuleIds.length, 0)} 条。`);
  selectedRuleIds = [];
  await loadRules();
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
    latestRuleEvaluation = response;
    const detailText = (response.details || []).slice(0, 3).join("；") || "无附加细节";
    setRulesStatus(`规则评估完成：触发 ${formatNumber(response.triggeredRuleCount, 0)} 条，生成通知 ${formatNumber(response.generatedNotificationCount, 0)} 条。${detailText}`);
    await Promise.all([loadRules(), loadNotifications()]);
  } catch (error) {
    setRulesStatus(`规则评估失败：${error.message}`, true);
  }
}

async function loadNotifications(page = notificationsPageIndex) {
  const familyId = getCurrentFamilyId();
  if (!token) {
    notificationsPageIndex = 0;
    notificationsTotalPages = 0;
    notificationsTotalElements = 0;
    renderNotifications([]);
    setRulesStatus("请先登录后再加载通知。", true);
    return;
  }
  if (!familyId) {
    notificationsPageIndex = 0;
    notificationsTotalPages = 0;
    notificationsTotalElements = 0;
    renderNotifications([]);
    setRulesStatus("请先选择家庭。", true);
    return;
  }
  const params = {
    familyId,
    targetMemberId: getCurrentMemberId(),
    readStatus: byId("notificationReadFilter").value,
    sourceType: (byId("notificationSourceFilter").value || "").trim().toUpperCase(),
    page: Math.max(Number(page) || 0, 0),
    size: Number(byId("notificationPageSize").value || 8)
  };
  try {
    setRulesStatus("加载通知中...");
    const page = await api(`/api/notifications/search${buildQuery(params)}`);
    if ((page.items || []).length === 0 && (page.totalElements || 0) > 0 && params.page > 0) {
      const fallbackPage = Math.max((page.totalPages || 1) - 1, 0);
      if (fallbackPage !== params.page) {
        await loadNotifications(fallbackPage);
        return;
      }
    }
    notificationsPage = page.items || [];
    selectedNotificationIds = syncSelectionToVisible(selectedNotificationIds, notificationsPage);
    notificationsPageIndex = page.page || 0;
    notificationsTotalPages = page.totalPages || 0;
    notificationsTotalElements = page.totalElements || notificationsPage.length;
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
    await reloadNotificationsAfterMutation();
  } catch (error) {
    setRulesStatus(`删除通知失败：${error.message}`, true);
  }
}

async function batchMarkNotificationsRead() {
  if (selectedNotificationIds.length === 0) {
    return;
  }
  for (const id of selectedNotificationIds) {
    await api(`/api/notifications/${id}/read`, { method: "POST" });
  }
  setRulesStatus(`通知批量已读完成，共处理 ${formatNumber(selectedNotificationIds.length, 0)} 条。`);
  selectedNotificationIds = [];
  await loadNotifications();
}

async function batchDeleteNotifications() {
  if (selectedNotificationIds.length === 0 || !window.confirm(`确认删除已选中的 ${selectedNotificationIds.length} 条通知吗？`)) {
    return;
  }
  for (const id of selectedNotificationIds) {
    await api(`/api/notifications/${id}`, { method: "DELETE" });
  }
  setRulesStatus(`通知批量删除完成，共处理 ${formatNumber(selectedNotificationIds.length, 0)} 条。`);
  selectedNotificationIds = [];
  await reloadNotificationsAfterMutation();
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

function getPagerInputPage(inputId, totalPages, fallbackPageIndex) {
  const value = Number(byId(inputId)?.value || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return fallbackPageIndex;
  }
  const maxPage = Math.max(Number(totalPages) || 1, 1);
  return Math.min(value, maxPage) - 1;
}

async function reloadTransactionsAfterMutation() {
  const fallbackPage = transactionPageIndex > 0 && transactionItems.length <= 1 ? transactionPageIndex - 1 : transactionPageIndex;
  await loadTransactions(fallbackPage);
}

async function reloadNotificationsAfterMutation() {
  const fallbackPage = notificationsPageIndex > 0 && notificationsPage.length <= 1 ? notificationsPageIndex - 1 : notificationsPageIndex;
  await loadNotifications(fallbackPage);
}

function handleDocumentClick(event) {
  if (globalCommandMenuOpen && !event.target.closest(".command-panel")) {
    closeGlobalCommandMenu();
  }
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
    case "dashboard-refresh-summary":
      loadSummary();
      break;
    case "analysis-open-country-list":
      focusAnalysisArea("countries");
      break;
    case "analysis-open-dashboard":
      focusAnalysisArea("dashboard");
      break;
    case "analysis-open-world-bank":
      focusAnalysisArea("worldBank");
      break;
    case "analysis-open-fred":
      focusAnalysisArea("fred");
      break;
    case "dashboard-refresh-business":
      loadBusinessOverview();
      break;
    case "dashboard-evaluate-rules":
      evaluateRules();
      break;
    case "dashboard-run-acceptance":
      runAcceptance();
      break;
    case "run-global-command":
      executeGlobalCommand(actionNode.dataset.command || byId("globalCommandInput")?.value || "");
      break;
    case "select-global-command":
      executeGlobalCommand(actionNode.dataset.command || "");
      break;
    case "dashboard-open-exceeded-budgets":
      switchView("business");
      byId("budgetEnabledFilter").value = "";
      byId("budgetPeriodFilter").value = "";
      byId("budgetSortFilter").value = "amount-desc";
      applyBudgetQuickFilter("exceeded");
      break;
    case "dashboard-open-import-issues":
      {
        const importRecord = importHistory[0] || (latestImport ? { id: latestImport.importBatchId, result: latestImport, createdAt: latestImport.importedAt } : null);
        let targetFilter = "all";
        if (importRecord) {
          if (isImportFailed(importRecord.result?.importStatus)) {
            targetFilter = "abnormal";
          } else if (Number(importRecord.result?.fredImported || 0) === 0) {
            targetFilter = "degraded";
          }
        }
        focusImportHistory(targetFilter);
        if (importRecord?.id) {
          selectedImportHistoryId = importRecord.id;
        }
        renderImportHistory();
        renderImportHistoryDetail();
      }
      break;
    case "dashboard-open-analysis-anomalies":
      switchView("analysis");
      if (latestSummary) {
        renderRaw(latestSummary);
      }
      break;
    case "dashboard-open-unread-notifications":
      focusRulesNotifications("unread");
      break;
    case "dashboard-open-rule-notifications":
      focusRulesNotifications("rule");
      break;
    case "dashboard-open-high-priority-rules":
      focusRulesNotifications("high-priority-rules");
      break;
    case "rules-open-all":
      byId("ruleEnabledFilter").value = "all";
      byId("ruleTypeFilter").value = "";
      applyRuleQuickFilter("all");
      break;
    case "rules-open-enabled":
      byId("ruleEnabledFilter").value = "1";
      byId("ruleTypeFilter").value = "";
      applyRuleQuickFilter("all");
      break;
    case "rules-open-high-priority":
      focusRulesNotifications("high-priority-rules");
      break;
    case "notifications-open-all":
      focusRulesNotifications("all");
      break;
    case "notifications-open-unread":
      focusRulesNotifications("unread");
      break;
    case "notifications-open-rule-source":
      focusRulesNotifications("rule");
      break;
    case "business-open-balance-overview":
      focusBusinessArea("overview");
      break;
    case "business-open-shared-accounts":
      focusBusinessArea("shared-accounts");
      break;
    case "business-open-enabled-budgets":
      focusBusinessArea("enabled-budgets");
      break;
    case "business-open-alert-budgets":
      focusBusinessArea("alert-budgets");
      break;
    case "business-open-recent-transactions":
      focusBusinessArea("recent-transactions");
      break;
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
    case "toggle-rule-select":
      event.stopPropagation();
      selectedRuleIds = toggleSelection(selectedRuleIds, actionNode.dataset.ruleId, event.target.checked);
      renderRules(filteredRules);
      break;
    case "rule-toggle-all":
      event.stopPropagation();
      selectedRuleIds = event.target.checked ? filteredRules.map((item) => Number(item.id)) : [];
      renderRules(filteredRules);
      break;
    case "rule-select-all":
      event.stopPropagation();
      selectedRuleIds = filteredRules.map((item) => Number(item.id));
      renderRules(filteredRules);
      break;
    case "rule-clear-selection":
      event.stopPropagation();
      selectedRuleIds = [];
      renderRules(filteredRules);
      break;
    case "rule-batch-enable":
      event.stopPropagation();
      batchToggleRules(true);
      break;
    case "rule-batch-disable":
      event.stopPropagation();
      batchToggleRules(false);
      break;
    case "select-account": {
      selectedAccountId = Number(actionNode.dataset.accountId);
      const item = accounts.find((account) => account.id === selectedAccountId) || null;
      renderAccounts(getFilteredAccounts(accounts));
      renderAccountDetail(item);
      break;
    }
    case "toggle-account-select":
      event.stopPropagation();
      selectedAccountIds = toggleSelection(selectedAccountIds, actionNode.dataset.accountId, event.target.checked);
      renderAccounts(getFilteredAccounts(accounts));
      break;
    case "account-toggle-all":
      event.stopPropagation();
      selectedAccountIds = event.target.checked ? getFilteredAccounts(accounts).map((item) => Number(item.id)) : [];
      renderAccounts(getFilteredAccounts(accounts));
      break;
    case "account-select-all":
      event.stopPropagation();
      selectedAccountIds = getFilteredAccounts(accounts).map((item) => Number(item.id));
      renderAccounts(getFilteredAccounts(accounts));
      break;
    case "account-clear-selection":
      event.stopPropagation();
      selectedAccountIds = [];
      accountShowSelectedOnly = false;
      renderAccounts(getFilteredAccounts(accounts));
      break;
    case "account-toggle-selected-view":
      event.stopPropagation();
      accountShowSelectedOnly = !accountShowSelectedOnly;
      renderAccounts(getFilteredAccounts(accounts));
      break;
    case "account-export-current":
      event.stopPropagation();
      exportCurrentAccounts();
      break;
    case "account-batch-enable":
      event.stopPropagation();
      batchToggleAccounts(true);
      break;
    case "account-batch-disable":
      event.stopPropagation();
      batchToggleAccounts(false);
      break;
    case "account-batch-delete":
      event.stopPropagation();
      batchDeleteAccounts();
      break;
    case "create-account":
      createAccount();
      break;
    case "edit-account":
      if (actionNode.dataset.accountId) {
        selectedAccountId = Number(actionNode.dataset.accountId);
      }
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
      renderCategories(getFilteredCategories(categories));
      renderCategoryDetail(item);
      break;
    }
    case "toggle-category-select":
      event.stopPropagation();
      selectedCategoryIds = toggleSelection(selectedCategoryIds, actionNode.dataset.categoryId, event.target.checked);
      renderCategories(getFilteredCategories(categories));
      break;
    case "category-toggle-all":
      event.stopPropagation();
      selectedCategoryIds = event.target.checked ? getFilteredCategories(categories).map((item) => Number(item.id)) : [];
      renderCategories(getFilteredCategories(categories));
      break;
    case "category-select-all":
      event.stopPropagation();
      selectedCategoryIds = getFilteredCategories(categories).map((item) => Number(item.id));
      renderCategories(getFilteredCategories(categories));
      break;
    case "category-clear-selection":
      event.stopPropagation();
      selectedCategoryIds = [];
      categoryShowSelectedOnly = false;
      renderCategories(getFilteredCategories(categories));
      break;
    case "category-toggle-selected-view":
      event.stopPropagation();
      categoryShowSelectedOnly = !categoryShowSelectedOnly;
      renderCategories(getFilteredCategories(categories));
      break;
    case "category-export-current":
      event.stopPropagation();
      exportCurrentCategories();
      break;
    case "category-batch-enable":
      event.stopPropagation();
      batchToggleCategories(true);
      break;
    case "category-batch-disable":
      event.stopPropagation();
      batchToggleCategories(false);
      break;
    case "category-batch-delete":
      event.stopPropagation();
      batchDeleteCategories();
      break;
    case "create-category":
      createCategory();
      break;
    case "edit-category":
      if (actionNode.dataset.categoryId) {
        selectedCategoryId = Number(actionNode.dataset.categoryId);
      }
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
      renderBudgets(getFilteredBudgets(budgets));
      renderBudgetDetail(item);
      break;
    }
    case "toggle-budget-select":
      event.stopPropagation();
      selectedBudgetIds = toggleSelection(selectedBudgetIds, actionNode.dataset.budgetId, event.target.checked);
      renderBudgets(getFilteredBudgets(budgets));
      break;
    case "budget-toggle-all":
      event.stopPropagation();
      selectedBudgetIds = event.target.checked ? getFilteredBudgets(budgets).map((item) => Number(item.id)) : [];
      renderBudgets(getFilteredBudgets(budgets));
      break;
    case "budget-select-all":
      event.stopPropagation();
      selectedBudgetIds = getFilteredBudgets(budgets).map((item) => Number(item.id));
      renderBudgets(getFilteredBudgets(budgets));
      break;
    case "budget-clear-selection":
      event.stopPropagation();
      selectedBudgetIds = [];
      budgetShowSelectedOnly = false;
      renderBudgets(getFilteredBudgets(budgets));
      break;
    case "budget-toggle-selected-view":
      event.stopPropagation();
      budgetShowSelectedOnly = !budgetShowSelectedOnly;
      renderBudgets(getFilteredBudgets(budgets));
      break;
    case "budget-export-current":
      event.stopPropagation();
      exportCurrentBudgets();
      break;
    case "budget-batch-enable":
      event.stopPropagation();
      batchToggleBudgets(true);
      break;
    case "budget-batch-disable":
      event.stopPropagation();
      batchToggleBudgets(false);
      break;
    case "budget-batch-delete":
      event.stopPropagation();
      batchDeleteBudgets();
      break;
    case "create-budget":
      createBudget();
      break;
    case "edit-budget":
      if (actionNode.dataset.budgetId) {
        selectedBudgetId = Number(actionNode.dataset.budgetId);
      }
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
      if (actionNode.dataset.transactionId) {
        selectedTransactionId = Number(actionNode.dataset.transactionId);
      }
      editTransaction();
      break;
    case "delete-transaction":
      event.stopPropagation();
      deleteTransaction(Number(actionNode.dataset.transactionId));
      break;
    case "transactions-prev-page":
      if (transactionPageIndex > 0) {
        loadTransactions(transactionPageIndex - 1);
      }
      break;
    case "transactions-next-page":
      if (transactionPageIndex + 1 < transactionTotalPages) {
        loadTransactions(transactionPageIndex + 1);
      }
      break;
    case "transactions-jump-page":
      loadTransactions(getPagerInputPage("transactionsPageInput", transactionTotalPages, transactionPageIndex));
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
    case "toggle-notification-select":
      event.stopPropagation();
      selectedNotificationIds = toggleSelection(selectedNotificationIds, actionNode.dataset.notificationId, event.target.checked);
      renderNotifications(notificationsPage);
      break;
    case "notification-toggle-all":
      event.stopPropagation();
      selectedNotificationIds = event.target.checked ? notificationsPage.map((item) => Number(item.id)) : [];
      renderNotifications(notificationsPage);
      break;
    case "notification-select-all":
      event.stopPropagation();
      selectedNotificationIds = notificationsPage.map((item) => Number(item.id));
      renderNotifications(notificationsPage);
      break;
    case "notification-clear-selection":
      event.stopPropagation();
      selectedNotificationIds = [];
      renderNotifications(notificationsPage);
      break;
    case "notification-batch-read":
      event.stopPropagation();
      batchMarkNotificationsRead();
      break;
    case "notification-batch-delete":
      event.stopPropagation();
      batchDeleteNotifications();
      break;
    case "mark-notification-read":
      event.stopPropagation();
      markNotificationRead(Number(actionNode.dataset.notificationId));
      break;
    case "delete-notification":
      event.stopPropagation();
      deleteNotification(Number(actionNode.dataset.notificationId));
      break;
    case "notifications-prev-page":
      if (notificationsPageIndex > 0) {
        loadNotifications(notificationsPageIndex - 1);
      }
      break;
    case "notifications-next-page":
      if (notificationsPageIndex + 1 < notificationsTotalPages) {
        loadNotifications(notificationsPageIndex + 1);
      }
      break;
    case "notifications-jump-page":
      loadNotifications(getPagerInputPage("notificationsPageInput", notificationsTotalPages, notificationsPageIndex));
      break;
    default:
      break;
  }
}

function bindEvents() {
  byId("loginBtn").addEventListener("click", handleLogin);
  byId("runGlobalCommandBtn").addEventListener("click", () => {
    executeGlobalCommand(byId("globalCommandInput").value || "analysis-summary");
  });
  byId("globalCommandInput").addEventListener("input", () => {
    renderGlobalCommandOptions(byId("globalCommandInput").value || "");
  });
  byId("globalCommandInput").addEventListener("focus", () => {
    renderGlobalCommandOptions(byId("globalCommandInput").value || "");
  });
  byId("globalCommandMenu").addEventListener("mousemove", (event) => {
    const option = event.target.closest("[data-command-index]");
    if (!option) {
      return;
    }
    updateGlobalCommandActiveOption(Number(option.dataset.commandIndex));
  });
  byId("globalCommandInput").addEventListener("blur", () => {
    setTimeout(() => {
      closeGlobalCommandMenu();
    }, 120);
  });
  byId("importBtn").addEventListener("click", performImport);
  byId("importBtnMirror").addEventListener("click", performImport);
  byId("summaryBtn").addEventListener("click", loadSummary);
  byId("acceptanceBtn").addEventListener("click", runAcceptance);
  byId("acceptanceBtnMirror").addEventListener("click", runAcceptance);
  byId("syncAnalysisParamsBtn").addEventListener("click", syncImportParamsToAnalysis);
  byId("clearImportHistoryBtn").addEventListener("click", loadImportHistory);
  byId("importHistorySort").addEventListener("change", () => {
    importHistorySort = byId("importHistorySort").value || "created-desc";
    renderImportHistory();
    renderImportHistoryDetail();
  });
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
      notificationsPageIndex = 0;
      transactionPageIndex = 0;
      const jobs = [loadRules(), loadNotifications()];
      if (activeView === "business") {
        jobs.push(loadBusinessOverview());
      }
      await Promise.all(jobs);
    }
  });
  byId("memberSelect").addEventListener("change", () => {
    if (token) {
      notificationsPageIndex = 0;
      loadNotifications(0);
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
  byId("ruleQuickAllBtn").addEventListener("click", () => applyRuleQuickFilter("all"));
  byId("ruleQuickHighBtn").addEventListener("click", () => applyRuleQuickFilter("high"));
  byId("importHistoryQuickAllBtn").addEventListener("click", () => applyImportHistoryQuickFilter("all"));
  byId("importHistoryQuickAbnormalBtn").addEventListener("click", () => applyImportHistoryQuickFilter("abnormal"));
  byId("importHistoryQuickDegradedBtn").addEventListener("click", () => applyImportHistoryQuickFilter("degraded"));
  byId("importHistoryQuickSuccessBtn").addEventListener("click", () => applyImportHistoryQuickFilter("success"));
  byId("notificationReadFilter").addEventListener("change", () => {
    notificationsPageIndex = 0;
    loadNotifications(0);
  });
  byId("notificationSourceFilter").addEventListener("input", () => {
    notificationsPageIndex = 0;
    loadNotifications(0);
  });
  byId("notificationPageSize").addEventListener("change", () => {
    notificationsPageIndex = 0;
    loadNotifications(0);
  });
  byId("transactionTypeFilter").addEventListener("change", () => {
    transactionPageIndex = 0;
    loadTransactions(0);
  });
  byId("transactionPageSize").addEventListener("change", () => {
    transactionPageIndex = 0;
    loadTransactions(0);
  });
  byId("accountStatusFilter").addEventListener("change", () => {
    renderAccounts(getFilteredAccounts(accounts));
  });
  byId("accountTypeFilter").addEventListener("input", () => {
    renderAccounts(getFilteredAccounts(accounts));
  });
  byId("accountSortFilter").addEventListener("change", () => {
    renderAccounts(getFilteredAccounts(accounts));
  });
  byId("resetAccountFiltersBtn").addEventListener("click", resetAccountFilters);
  byId("accountQuickAllBtn").addEventListener("click", () => applyAccountQuickFilter("all"));
  byId("accountQuickSharedBtn").addEventListener("click", () => applyAccountQuickFilter("shared"));
  byId("accountQuickCreditBtn").addEventListener("click", () => applyAccountQuickFilter("credit"));
  byId("accountQuickEnabledBtn").addEventListener("click", () => applyAccountQuickFilter("enabled"));
  byId("categoryEnabledFilter").addEventListener("change", () => {
    renderCategories(getFilteredCategories(categories));
  });
  byId("categoryTypeFilter").addEventListener("input", () => {
    renderCategories(getFilteredCategories(categories));
  });
  byId("categorySortFilter").addEventListener("change", () => {
    renderCategories(getFilteredCategories(categories));
  });
  byId("resetCategoryFiltersBtn").addEventListener("click", resetCategoryFilters);
  byId("categoryQuickAllBtn").addEventListener("click", () => applyCategoryQuickFilter("all"));
  byId("categoryQuickExpenseBtn").addEventListener("click", () => applyCategoryQuickFilter("expense"));
  byId("categoryQuickIncomeBtn").addEventListener("click", () => applyCategoryQuickFilter("income"));
  byId("categoryQuickEnabledBtn").addEventListener("click", () => applyCategoryQuickFilter("enabled"));
  byId("budgetEnabledFilter").addEventListener("change", () => {
    renderBudgets(getFilteredBudgets(budgets));
  });
  byId("budgetPeriodFilter").addEventListener("input", () => {
    renderBudgets(getFilteredBudgets(budgets));
  });
  byId("budgetSortFilter").addEventListener("change", () => {
    renderBudgets(getFilteredBudgets(budgets));
  });
  byId("resetBudgetFiltersBtn").addEventListener("click", resetBudgetFilters);
  byId("budgetQuickAllBtn").addEventListener("click", () => applyBudgetQuickFilter("all"));
  byId("budgetQuickAlertBtn").addEventListener("click", () => applyBudgetQuickFilter("alert"));
  byId("budgetQuickExceededBtn").addEventListener("click", () => applyBudgetQuickFilter("exceeded"));
  byId("budgetQuickMonthlyBtn").addEventListener("click", () => applyBudgetQuickFilter("monthly"));
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && event.target?.tagName !== "INPUT" && event.target?.tagName !== "TEXTAREA" && event.target?.tagName !== "SELECT") {
      event.preventDefault();
      byId("globalCommandInput").focus();
      byId("globalCommandInput").select();
      return;
    }
    if (event.target?.id === "globalCommandInput" && event.key === "ArrowDown") {
      event.preventDefault();
      if (!globalCommandMenuOpen) {
        renderGlobalCommandOptions(byId("globalCommandInput").value || "");
      } else {
        updateGlobalCommandActiveOption(activeGlobalCommandIndex + 1);
      }
      return;
    }
    if (event.target?.id === "globalCommandInput" && event.key === "ArrowUp") {
      event.preventDefault();
      updateGlobalCommandActiveOption(activeGlobalCommandIndex - 1);
      return;
    }
    if (event.target?.id === "globalCommandInput" && event.key === "Enter") {
      event.preventDefault();
      if (globalCommandMenuOpen && activeGlobalCommandIndex >= 0 && filteredGlobalCommands[activeGlobalCommandIndex]) {
        executeGlobalCommand(filteredGlobalCommands[activeGlobalCommandIndex].key);
      } else {
        executeGlobalCommand(byId("globalCommandInput").value || "analysis-summary");
      }
      return;
    }
    if (event.target?.id === "globalCommandInput" && event.key === "Escape") {
      event.preventDefault();
      closeGlobalCommandMenu();
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    if (event.target?.id === "transactionsPageInput") {
      event.preventDefault();
      loadTransactions(getPagerInputPage("transactionsPageInput", transactionTotalPages, transactionPageIndex));
      return;
    }
    if (event.target?.id === "notificationsPageInput") {
      event.preventDefault();
      loadNotifications(getPagerInputPage("notificationsPageInput", notificationsTotalPages, notificationsPageIndex));
    }
  });
  document.addEventListener("click", handleDocumentClick);
}

async function init() {
  restoreSession();
  renderGlobalCommandOptions("");
  renderGlobalCommandDeck();
  resetSummary();
  renderLatestImport(null);
  renderImportHistory();
  renderImportHistoryDetail();
  renderAccounts([]);
  renderCategories([]);
  renderBudgets([]);
  renderTransactions([]);
  renderTransactionMonthlySummary([]);
  renderBusinessOverviewPanel();
  renderRules([]);
  renderNotifications([]);
  renderSidebarStatusPanel();
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


