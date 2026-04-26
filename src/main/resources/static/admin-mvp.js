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
let transactionQuickFilter = "all";
let selectedTransactionId = null;
let latestBusinessAction = null;
let businessFormType = null;
let businessFormMode = "create";
let notificationsPageIndex = 0;
let notificationsTotalPages = 0;
let activeView = "analysis";
let currentUser = null;

function byId(id) {
  return document.getElementById(id);
}

function setNodeText(node, value = "") {
  if (!node) {
    return false;
  }
  node.textContent = value ?? "";
  return true;
}

function setTextById(id, value = "") {
  return setNodeText(byId(id), value);
}

function setTextByIds(ids, value = "") {
  (ids || []).forEach((id) => setTextById(id, value));
}

function scrollToVisibleSection(id) {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateSidebarActiveState(view = activeView) {
  document.querySelectorAll("[data-sidebar-view]").forEach((node) => {
    node.classList.toggle("active", node.dataset.sidebarView === view);
  });
}

function applyViewContext(view = activeView) {
  activeView = view;
  updateViewMeta(view);
  renderGlobalCommandDeck();
  updateSidebarActiveState(view);
}

function adminPageNavigate(view = "analysis", targetId = "") {
  switchView(view);
  if (view === "business" && token && getCurrentFamilyId() && accounts.length === 0 && categories.length === 0 && budgets.length === 0 && transactionTotalElements === 0) {
    loadBusinessOverview();
  }
  if (view === "rules" && token && getCurrentFamilyId() && allRules.length === 0 && notificationsPage.length === 0) {
    Promise.all([loadRules(), loadNotifications()]);
  }
  if (view === "analysis" && token && !latestSummary) {
    loadSummary().catch(() => {});
  }
  if (targetId) {
    syncScrollSectionState(targetId);
    setTimeout(() => scrollToVisibleSection(targetId), 120);
  }
}

function adminScrollTo(targetId = "") {
  if (!targetId) {
    return;
  }
  scrollToVisibleSection(targetId);
}

function syncScrollSectionState(activeSectionId = "") {
  document.querySelectorAll(".scroll-section").forEach((node) => {
    node.classList.toggle("is-current", node.id === activeSectionId);
  });
}

function getScrollSpySection() {
  const scroller = byId("adminMainScroller");
  if (!scroller) {
    return null;
  }
  const sections = Array.from(document.querySelectorAll(".scroll-section[data-scroll-view]"));
  if (sections.length === 0) {
    return null;
  }
  const scrollerRect = scroller.getBoundingClientRect();
  const focusLine = scrollerRect.top + 160;
  let bestSection = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const visible = rect.bottom > scrollerRect.top + 80 && rect.top < scrollerRect.bottom - 80;
    if (!visible) {
      return;
    }
    const distance = Math.abs(rect.top - focusLine);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSection = section;
    }
  });

  return bestSection || sections[0];
}

function handleScrollSpy() {
  const section = getScrollSpySection();
  if (!section) {
    return;
  }
  syncScrollSectionState(section.id);
  applyViewContext(section.dataset.scrollView || "analysis");
}

function registerScrollSpy() {
  const scroller = byId("adminMainScroller");
  if (!scroller || scroller.dataset.scrollSpyBound === "true") {
    return;
  }
  scroller.dataset.scrollSpyBound = "true";
  let ticking = false;
  scroller.addEventListener("scroll", () => {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(() => {
      handleScrollSpy();
      ticking = false;
    });
  }, { passive: true });
  handleScrollSpy();
}

window.adminPageNavigate = adminPageNavigate;
window.adminScrollTo = adminScrollTo;

function getCurrentFamilyMemberships() {
  const familyId = getCurrentFamilyId();
  return (memberships || []).filter((item) => Number(item.familyId) === Number(familyId));
}

function renderHeaderControls() {
  const unreadNotifications = (notificationsPage || []).filter((item) => Number(item.readStatus) !== 1).length;
  const dot = byId("headerNotificationDot");
  if (dot) {
    dot.classList.toggle("hidden", unreadNotifications === 0);
  }
  const name = currentUser?.nickname || currentUser?.realName || currentUser?.username || "未登录";
  setTextById("headerProfileName", name);
  const avatar = byId("headerProfileAvatar");
  if (avatar) {
    avatar.textContent = String(name).trim().slice(0, 1) || "未";
  }
}

function renderUserFamilyWorkspace() {
  const host = byId("userFamilyWorkspace");
  if (!host) {
    return;
  }
  const currentMemberships = getCurrentFamilyMemberships();
  const familyMap = new Map();
  (memberships || []).forEach((item) => {
    const familyId = Number(item.familyId);
    if (!Number.isFinite(familyId) || familyId <= 0) {
      return;
    }
    const current = familyMap.get(familyId) || {
      familyId,
      familyName: item.familyName || `家庭${familyId}`,
      members: 0,
      roles: new Set()
    };
    current.members += 1;
    if (item.roleCode) {
      current.roles.add(item.roleCode);
    }
    familyMap.set(familyId, current);
  });
  const familyRows = Array.from(familyMap.values()).sort((left, right) => left.familyId - right.familyId);
  const selectedFamilyId = getCurrentFamilyId();
  const selectedMemberId = getCurrentMemberId();
  if (!token) {
    host.innerHTML = `
      <div class="workspace-stack">
        <div class="workspace-note">尚未登录后台账号，暂时无法查看用户信息、家庭上下文和成员关系。先登录，再刷新当前页面。</div>
        <div class="ops-grid">
          <div class="ops-card">
            <div class="ops-card-label">当前账号</div>
            <div class="ops-card-value">未登录</div>
            <div class="ops-card-meta">登录后显示用户、家庭与成员上下文。</div>
          </div>
          <div class="ops-card">
            <div class="ops-card-label">可访问家庭</div>
            <div class="ops-card-value">0</div>
            <div class="ops-card-meta">当前无会话数据。</div>
          </div>
          <div class="ops-card">
            <div class="ops-card-label">成员关系</div>
            <div class="ops-card-value">0</div>
            <div class="ops-card-meta">登录成功后自动拉取。</div>
          </div>
        </div>
      </div>
    `;
    return;
  }
  host.innerHTML = `
    <div class="workspace-stack">
      <div class="ops-grid">
        <div class="ops-card">
          <div class="ops-card-label">当前账号</div>
          <div class="ops-card-value">${escapeHtml(currentUser?.nickname || currentUser?.username || "已登录")}</div>
          <div class="ops-card-meta">账号类型：${escapeHtml(currentUser?.userType || "-")} / 用户名：${escapeHtml(currentUser?.username || "-")}</div>
        </div>
        <div class="ops-card">
          <div class="ops-card-label">可访问家庭数</div>
          <div class="ops-card-value">${formatNumber(familyRows.length, 0)}</div>
          <div class="ops-card-meta">${selectedFamilyId ? `当前选中家庭 ID ${escapeHtml(selectedFamilyId)}` : "尚未选择家庭"}</div>
        </div>
        <div class="ops-card">
          <div class="ops-card-label">当前家庭成员关系</div>
          <div class="ops-card-value">${formatNumber(currentMemberships.length, 0)}</div>
          <div class="ops-card-meta">${selectedMemberId ? `当前成员：${escapeHtml(formatMemberRef(selectedMemberId))}` : "尚未选择成员"}</div>
        </div>
      </div>
      <div class="workspace-note">这一块用于说明后台登录态已经拿到用户、家庭、成员三层上下文。后续小程序端和管理员端共用这套家庭维度数据时，这里就是最直接的会话证明。</div>
      <div class="ops-table">
        <div class="ops-table-head">
          <div>成员关系</div>
          <div>所属家庭</div>
          <div>角色</div>
          <div>成员编号</div>
          <div>会话说明</div>
        </div>
        ${(currentMemberships.length > 0 ? currentMemberships : memberships).slice(0, 10).map((item) => `
          <div class="ops-table-row">
            <div class="ops-cell-main">
              <span class="ops-cell-title">${escapeHtml(item.familyName || `家庭${item.familyId}`)}</span>
              <span class="ops-cell-meta">家庭 ID ${escapeHtml(item.familyId)}</span>
            </div>
            <div>${escapeHtml(item.familyName || `家庭${item.familyId}`)}</div>
            <div><span class="ops-badge ${selectedMemberId && Number(item.familyMemberId) === Number(selectedMemberId) ? "success" : ""}">${escapeHtml(item.roleCode || "MEMBER")}</span></div>
            <div>${escapeHtml(item.familyMemberId)}</div>
            <div class="ops-cell-meta">${selectedFamilyId && Number(item.familyId) === Number(selectedFamilyId) ? "当前选中家庭上下文" : "可切换访问的家庭成员关系"}</div>
          </div>
        `).join("") || `
          <div class="ops-table-row">
            <div class="ops-cell-main">
              <span class="ops-cell-title">暂无成员关系</span>
              <span class="ops-cell-meta">当前登录会话还没有返回 memberships。</span>
            </div>
            <div>-</div>
            <div><span class="ops-badge warning">待加载</span></div>
            <div>-</div>
            <div class="ops-cell-meta">请刷新登录态或检查接口返回。</div>
          </div>
        `}
      </div>
      <div class="ops-table">
        <div class="ops-table-head">
          <div>家庭概览</div>
          <div>成员数</div>
          <div>角色覆盖</div>
          <div>当前状态</div>
          <div>备注</div>
        </div>
        ${familyRows.map((item) => `
          <div class="ops-table-row">
            <div class="ops-cell-main">
              <span class="ops-cell-title">${escapeHtml(item.familyName)}</span>
              <span class="ops-cell-meta">家庭 ID ${escapeHtml(item.familyId)}</span>
            </div>
            <div>${formatNumber(item.members, 0)}</div>
            <div>${escapeHtml(Array.from(item.roles).join(" / ") || "-")}</div>
            <div><span class="ops-badge ${selectedFamilyId && Number(item.familyId) === Number(selectedFamilyId) ? "success" : ""}">${selectedFamilyId && Number(item.familyId) === Number(selectedFamilyId) ? "当前家庭" : "可访问"}</span></div>
            <div class="ops-cell-meta">${selectedFamilyId && Number(item.familyId) === Number(selectedFamilyId) ? "业务、规则、通知都会基于这个家庭维度查询" : "可切换到该家庭继续查看业务数据"}</div>
          </div>
        `).join("") || `
          <div class="ops-table-row">
            <div class="ops-cell-main">
              <span class="ops-cell-title">暂无家庭记录</span>
              <span class="ops-cell-meta">登录态已存在，但当前未返回家庭列表。</span>
            </div>
            <div>-</div>
            <div>-</div>
            <div><span class="ops-badge warning">待补全</span></div>
            <div class="ops-cell-meta">通常是接口未返回 memberships 或当前用户未加入家庭。</div>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderSystemLogWorkspace() {
  const host = byId("systemLogWorkspace");
  if (!host) {
    return;
  }
  const latestImportRecord = importHistory[0] || (latestImport ? { result: latestImport, createdAt: latestImport.importedAt } : null);
  const latestImportStatus = latestImportRecord?.result?.importStatus || latestImport?.importStatus || "未执行";
  const acceptanceReady = Boolean(latestImportRecord && latestSummary && (accounts.length || categories.length || budgets.length || transactionTotalElements));
  const systemEvents = [
    {
      time: formatDateTime(latestImportRecord?.createdAt || latestImportRecord?.result?.importedAt),
      title: latestImportRecord ? "真实数据导入" : "真实数据导入未执行",
      meta: latestImportRecord
        ? `状态：${latestImportStatus} / 批次：${latestImportRecord?.result?.importBatchId || "-"} / 目录：${latestImportRecord?.params?.processedDir || "data/processed"}`
        : "需要先执行导入，后续分析与答辩结论才有真实数据支撑。"
    },
    {
      time: formatDateTime(latestSummary?.generatedAt || latestSummary?.createdAt),
      title: latestSummary ? "分析汇总已生成" : "分析汇总未生成",
      meta: latestSummary
        ? `零售记录：${formatNumber(latestSummary?.retailOverview?.totalRecords, 0)} / 国家趋势点：${formatNumber(latestSummary?.worldBankTrend?.points?.length || 0, 0)} / FRED 点数：${formatNumber(latestSummary?.fredSeries?.points?.length || 0, 0)}`
        : "导入完成后需要刷新 defense summary，才能展示交易结构和国家趋势。"
    },
    {
      time: formatDateTime(latestRuleEvaluation?.evaluatedAt || latestRuleEvaluation?.createdAt),
      title: latestRuleEvaluation ? "规则评估已执行" : "规则评估未执行",
      meta: latestRuleEvaluation
        ? `触发规则：${formatNumber(latestRuleEvaluation.triggeredRuleCount, 0)} / 生成通知：${formatNumber(latestRuleEvaluation.generatedNotificationCount, 0)}`
        : "建议至少执行一次规则评估，形成导入 -> 分析 -> 规则 -> 通知闭环。"
    },
    {
      time: formatDateTime(latestBusinessAction?.occurredAt || latestBusinessAction?.createdAt || latestBusinessAction?.operationTime),
      title: latestBusinessAction ? "最近业务操作" : "最近业务操作缺失",
      meta: latestBusinessAction
        ? `${latestBusinessAction?.actionType || latestBusinessAction?.operationType || "业务变更"} / ${latestBusinessAction?.targetType || latestBusinessAction?.moduleName || "业务模块"} / ${latestBusinessAction?.description || latestBusinessAction?.message || "已有最近一次业务动作回执"}`
        : "当前还缺少最新业务动作摘要，可继续在账户、分类、预算、交易模块操作并刷新页面。"
    },
    {
      time: formatDateTime(notificationsPage?.[0]?.createdAt),
      title: notificationsPage.length > 0 ? "通知中心已有数据" : "通知中心当前为空",
      meta: notificationsPage.length > 0
        ? `当前页 ${formatNumber(notificationsPage.length, 0)} 条 / 未读 ${formatNumber((notificationsPage || []).filter((item) => Number(item.readStatus) !== 1).length, 0)} 条`
        : "通知列表还没有加载出记录，可以先执行规则评估或切换家庭后刷新。"
    }
  ];
  host.innerHTML = `
    <div class="workspace-stack">
      <div class="ops-grid">
        <div class="ops-card">
          <div class="ops-card-label">API 与鉴权</div>
          <div class="ops-card-value">${token ? "已接通" : "未登录"}</div>
          <div class="ops-card-meta">${token ? "当前可以正常访问后台接口。" : "需先登录后台账号后再调用接口。"}</div>
        </div>
        <div class="ops-card">
          <div class="ops-card-label">最近导入批次</div>
          <div class="ops-card-value">${latestImportRecord?.result?.importBatchId ? formatNumber(latestImportRecord.result.importBatchId, 0) : "-"}</div>
          <div class="ops-card-meta">导入状态：${escapeHtml(latestImportStatus)}</div>
        </div>
        <div class="ops-card">
          <div class="ops-card-label">系统闭环状态</div>
          <div class="ops-card-value">${acceptanceReady ? "可演示" : "待补全"}</div>
          <div class="ops-card-meta">${acceptanceReady ? "导入、分析、业务查询已经打通。" : "还需要继续补业务、规则或通知的实际回执。"}</div>
        </div>
      </div>
      <div class="workspace-note">这一块不再只是“状态说明”，而是明确展示后台最近发生了什么。录屏或答辩时，可以直接从这里讲清楚导入、分析、业务、规则、通知是否形成闭环。</div>
      <div class="ops-table">
        <div class="ops-table-head">
          <div>检查项</div>
          <div>当前结果</div>
          <div>状态</div>
          <div>最近时间</div>
          <div>说明</div>
        </div>
        <div class="ops-table-row">
          <div class="ops-cell-main">
            <span class="ops-cell-title">分析汇总</span>
            <span class="ops-cell-meta">defense summary / 交易结构 / 趋势结论</span>
          </div>
          <div>${latestSummary ? "已加载" : "未加载"}</div>
          <div><span class="ops-badge ${latestSummary ? "success" : "warning"}">${latestSummary ? "正常" : "待执行"}</span></div>
          <div>${formatDateTime(latestSummary?.generatedAt || latestSummary?.createdAt)}</div>
          <div class="ops-cell-meta">${latestSummary ? "可以继续展示国家趋势和交易结构结论。" : "需要先加载分析汇总。"} </div>
        </div>
        <div class="ops-table-row">
          <div class="ops-cell-main">
            <span class="ops-cell-title">业务数据</span>
            <span class="ops-cell-meta">账户 / 分类 / 预算 / 交易</span>
          </div>
          <div>${accounts.length || categories.length || budgets.length || transactionTotalElements ? "已进入页面" : "未进入页面"}</div>
          <div><span class="ops-badge ${accounts.length || categories.length || budgets.length || transactionTotalElements ? "success" : "warning"}">${accounts.length || categories.length || budgets.length || transactionTotalElements ? "正常" : "待刷新"}</span></div>
          <div>${formatDateTime(latestBusinessAction?.occurredAt || latestBusinessAction?.createdAt || latestBusinessAction?.operationTime)}</div>
          <div class="ops-cell-meta">账户 ${formatNumber(accounts.length, 0)} / 分类 ${formatNumber(categories.length, 0)} / 预算 ${formatNumber(budgets.length, 0)} / 交易 ${formatNumber(transactionTotalElements, 0)}</div>
        </div>
        <div class="ops-table-row">
          <div class="ops-cell-main">
            <span class="ops-cell-title">规则与通知</span>
            <span class="ops-cell-meta">规则评估 / 通知生成 / 通知运营</span>
          </div>
          <div>${latestRuleEvaluation ? "已执行" : "未执行"}</div>
          <div><span class="ops-badge ${latestRuleEvaluation ? "success" : "warning"}">${latestRuleEvaluation ? "正常" : "待执行"}</span></div>
          <div>${formatDateTime(latestRuleEvaluation?.evaluatedAt || latestRuleEvaluation?.createdAt)}</div>
          <div class="ops-cell-meta">触发 ${formatNumber(latestRuleEvaluation?.triggeredRuleCount || 0, 0)} 条 / 当前页通知 ${formatNumber(notificationsPage.length, 0)} 条</div>
        </div>
      </div>
      <div class="ops-timeline">
        ${systemEvents.map((event) => `
          <div class="ops-timeline-item">
            <div class="ops-timeline-time">${escapeHtml(event.time || "-")}</div>
            <div>
              <div class="ops-timeline-title">${escapeHtml(event.title)}</div>
              <div class="ops-timeline-meta">${escapeHtml(event.meta)}</div>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="dashboard-refresh-summary">刷新分析汇总</button>
        <button class="mini-btn" type="button" data-action="dashboard-refresh-business">刷新业务数据</button>
        <button class="mini-btn" type="button" data-action="dashboard-evaluate-rules">执行规则评估</button>
        <button class="mini-btn" type="button" data-action="dashboard-run-acceptance">一键验收</button>
      </div>
    </div>
  `;
}

function renderHeaderAndSupportPanels() {
  renderHeaderControls();
  renderUserFamilyWorkspace();
  renderSystemLogWorkspace();
}

async function refreshData() {
  const icon = byId("refreshIcon");
  icon?.classList.add("animate-spin");
  try {
    const jobs = [loadImportHistory()];
    if (token) {
      jobs.push(loadMe());
      if (latestSummary) {
        jobs.push(loadSummary().catch(() => {}));
      }
      if (getCurrentFamilyId()) {
        jobs.push(loadRules().catch(() => {}), loadNotifications().catch(() => {}), loadBusinessOverview().catch(() => {}));
      }
    }
    await Promise.all(jobs);
    renderHeaderAndSupportPanels();
  } finally {
    setTimeout(() => icon?.classList.remove("animate-spin"), 400);
  }
}

window.refreshData = refreshData;

function renderTopStats() {
  const familyCount = new Set((memberships || []).map((item) => Number(item.familyId)).filter((item) => Number.isFinite(item) && item > 0)).size;
  const membershipCount = (memberships || []).length;
  const unreadNotifications = (notificationsPage || []).filter((item) => Number(item.readStatus) !== 1).length;
  const latestImportStatus = importHistory[0]?.result?.importStatus || latestImport?.importStatus || "未执行";
  const enabledRules = (allRules || []).filter((item) => Number(item.enabled) === 1).length;

  setTextById("dashboardStat1Value", familyCount > 0 ? formatNumber(familyCount, 0) : "-");
  setTextById("dashboardStat1Meta", familyCount > 0 ? `当前登录态覆盖 ${formatNumber(familyCount, 0)} 个家庭` : "登录后显示家庭上下文");

  setTextById("dashboardStat2Value", membershipCount > 0 ? formatNumber(membershipCount, 0) : "-");
  setTextById("dashboardStat2Meta", membershipCount > 0 ? `当前会话包含 ${formatNumber(membershipCount, 0)} 条成员关系` : "登录后统计成员关系");

  setTextById("dashboardStat3Value", accounts.length > 0 ? formatNumber(accounts.length, 0) : "-");
  setTextById("dashboardStat3Meta", accounts.length > 0 ? `分类 ${formatNumber(categories.length, 0)} / 预算 ${formatNumber(budgets.length, 0)}` : "加载业务后统计账户数量");

  setTextById("dashboardStat4Value", transactionTotalElements > 0 ? formatNumber(transactionTotalElements, 0) : "-");
  setTextById("dashboardStat4Meta", transactionTotalElements > 0 ? `未读通知 ${formatNumber(unreadNotifications, 0)} / 启用规则 ${formatNumber(enabledRules, 0)}` : "交易列表刷新后显示总量");

  setTextById("dashboardStat5Value", importHistory.length > 0 || latestImport ? formatNumber(importHistory.length || 1, 0) : "-");
  setTextById("dashboardStat5Meta", importHistory.length > 0 || latestImport ? `最近状态：${latestImportStatus}` : "导入历史加载后更新");
}

function ensureWorkspaceSelectOptions() {
  const optionSets = {
    accountStatusFilter: [
      { value: "", label: "全部状态" },
      { value: "1", label: "仅启用" },
      { value: "0", label: "仅停用" }
    ],
    accountSortFilter: [
      { value: "name-asc", label: "名称 A-Z" },
      { value: "balance-desc", label: "余额从高到低" },
      { value: "balance-asc", label: "余额从低到高" }
    ],
    categoryEnabledFilter: [
      { value: "", label: "全部状态" },
      { value: "1", label: "仅启用" },
      { value: "0", label: "仅停用" }
    ],
    categorySortFilter: [
      { value: "sort-asc", label: "排序值升序" },
      { value: "name-asc", label: "名称 A-Z" },
      { value: "name-desc", label: "名称 Z-A" }
    ],
    budgetEnabledFilter: [
      { value: "", label: "全部状态" },
      { value: "1", label: "仅启用" },
      { value: "0", label: "仅停用" }
    ],
    budgetSortFilter: [
      { value: "amount-desc", label: "金额从高到低" },
      { value: "amount-asc", label: "金额从低到高" },
      { value: "name-asc", label: "名称 A-Z" }
    ],
    transactionTypeFilter: [
      { value: "", label: "全部类型" },
      { value: "INCOME", label: "收入" },
      { value: "EXPENSE", label: "支出" },
      { value: "TRANSFER", label: "转账" }
    ],
    transactionPageSize: [
      { value: "8", label: "每页 8 条" },
      { value: "20", label: "每页 20 条" },
      { value: "50", label: "每页 50 条" }
    ],
    accountTypeFilter: [
      { value: "", label: "全部账户类型" },
      { value: "CASH", label: "现金" },
      { value: "BANK", label: "银行卡" },
      { value: "CREDIT", label: "信用账户" },
      { value: "INVEST", label: "投资账户" }
    ],
    categoryTypeFilter: [
      { value: "", label: "全部分类类型" },
      { value: "EXPENSE", label: "支出" },
      { value: "INCOME", label: "收入" }
    ],
    budgetPeriodFilter: [
      { value: "", label: "全部周期" },
      { value: "MONTH", label: "月度预算" },
      { value: "WEEK", label: "周预算" },
      { value: "YEAR", label: "年度预算" }
    ],
    ruleEnabledFilter: [
      { value: "", label: "全部规则" },
      { value: "1", label: "仅启用" },
      { value: "0", label: "仅停用" }
    ],
    ruleTypeFilter: [
      { value: "", label: "全部规则类型" },
      { value: "THRESHOLD", label: "阈值规则" },
      { value: "CONSECUTIVE_THRESHOLD", label: "连续阈值" },
      { value: "TREND_ANOMALY", label: "趋势异常" }
    ],
    notificationReadFilter: [
      { value: "", label: "全部通知" },
      { value: "0", label: "仅未读" },
      { value: "1", label: "仅已读" }
    ],
    notificationSourceFilter: [
      { value: "", label: "全部来源" },
      { value: "RULE", label: "规则触发" },
      { value: "BUDGET", label: "预算预警" },
      { value: "SYSTEM", label: "系统消息" }
    ],
    notificationPageSize: [
      { value: "8", label: "每页 8 条" },
      { value: "20", label: "每页 20 条" },
      { value: "50", label: "每页 50 条" }
    ]
  };
  Object.entries(optionSets).forEach(([id, items]) => {
    const node = byId(id);
    if (!node || node.tagName !== "SELECT" || node.options.length > 0) {
      return;
    }
    node.innerHTML = items.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
  });
}

function styleWorkspaceButton(id, label, tone = "default") {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.type = "button";
  node.textContent = label;
  node.className = tone === "primary"
    ? "px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
    : tone === "danger"
      ? "px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
      : "px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors";
}

function styleWorkspaceSelect(id) {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.className = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800";
}

function styleWorkspaceField(id) {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.className = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800";
}

function styleWorkspaceStatus(id) {
  const node = byId(id);
  if (!node) {
    return;
  }
  node.classList.add("rounded-lg", "border", "border-gray-200", "bg-gray-50", "px-4", "py-3", "text-sm", "text-gray-600");
}

function mountNodeToHost(nodeId, hostId, className = "") {
  const node = byId(nodeId);
  const host = byId(hostId);
  if (!node || !host) {
    return;
  }
  if (className) {
    node.className = className;
  }
  host.appendChild(node);
}

function appendLabeledField(hostId, label, nodeId) {
  const host = byId(hostId);
  const node = byId(nodeId);
  if (!host || !node) {
    return;
  }
  const wrapper = document.createElement("label");
  wrapper.className = "block";
  const title = document.createElement("span");
  title.className = "block text-xs font-medium text-gray-500 mb-1";
  title.textContent = label;
  wrapper.appendChild(title);
  wrapper.appendChild(node);
  host.appendChild(wrapper);
}

function buildWorkspaceSectionChrome() {
  const commandHost = byId("adminCommandWorkspace");
  if (commandHost) {
    commandHost.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm font-semibold text-gray-900 mb-3">登录与上下文</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div id="adminStatusHost" class="space-y-3"></div>
              <div>
                <div id="adminSelectorHost" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
                <div id="adminAuthActions" class="flex flex-wrap gap-2 mt-3"></div>
              </div>
            </div>
          </div>
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm font-semibold text-gray-900 mb-3">加载与维护动作</div>
            <div id="adminLoadActions" class="flex flex-wrap gap-2"></div>
            <div id="adminCreateActions" class="flex flex-wrap gap-2 mt-3"></div>
          </div>
        </div>
      </div>
    `;
  }

  const accountHost = byId("accountsWorkspace");
  if (accountHost) {
    accountHost.innerHTML = `
      <div class="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
        <div class="space-y-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div id="accountsFilterBar" class="grid grid-cols-1 md:grid-cols-3 gap-3"></div>
            <div id="accountsQuickBar" class="flex flex-wrap gap-2 mt-3"></div>
            <div id="accountFilterSummaryVisible" class="mt-3"></div>
          </div>
          <div id="accountsStatsVisible"></div>
          <div id="accountListVisible"></div>
        </div>
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="text-sm font-semibold text-gray-900 mb-3">账户详情</div>
          <div id="accountDetailVisible"></div>
        </div>
      </div>
    `;
  }

  const categoryHost = byId("categoriesWorkspace");
  if (categoryHost) {
    categoryHost.innerHTML = `
      <div class="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
        <div class="space-y-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div id="categoriesFilterBar" class="grid grid-cols-1 md:grid-cols-3 gap-3"></div>
            <div id="categoriesQuickBar" class="flex flex-wrap gap-2 mt-3"></div>
            <div id="categoryFilterSummaryVisible" class="mt-3"></div>
          </div>
          <div id="categoriesStatsVisible"></div>
          <div id="categoryListVisible"></div>
        </div>
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div class="text-sm font-semibold text-gray-900 mb-3">分类详情</div>
          <div id="categoryDetailVisible"></div>
        </div>
      </div>
    `;
  }

  const budgetHost = byId("budgetsWorkspace");
  if (budgetHost) {
    budgetHost.innerHTML = `
      <div class="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-4">
        <div class="space-y-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div id="budgetsFilterBar" class="grid grid-cols-1 md:grid-cols-3 gap-3"></div>
            <div id="budgetsQuickBar" class="flex flex-wrap gap-2 mt-3"></div>
            <div id="budgetFilterSummaryVisible" class="mt-3"></div>
          </div>
          <div id="budgetsStatsVisible"></div>
          <div id="budgetListVisible"></div>
        </div>
        <div class="space-y-4">
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm font-semibold text-gray-900 mb-3">预算详情</div>
            <div id="budgetDetailVisible"></div>
          </div>
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm font-semibold text-gray-900 mb-3">预算动作</div>
            <div id="budgetActionVisible"></div>
          </div>
        </div>
      </div>
    `;
  }

  const transactionHost = byId("transactionsWorkspace");
  if (transactionHost) {
    transactionHost.innerHTML = `
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div id="transactionsFilterBar" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
          <div id="transactionsQuickBar" class="flex flex-wrap gap-2 mt-3"></div>
          <div id="transactionFilterSummaryVisible" class="mt-3"></div>
        </div>
        <div id="transactionsStatsVisible"></div>
        <div class="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <div class="space-y-4">
            <div id="transactionListVisible"></div>
            <div id="transactionsPager" class="rounded-xl border border-gray-200 bg-white p-4"></div>
          </div>
          <div class="space-y-4">
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div class="text-sm font-semibold text-gray-900 mb-3">交易详情</div>
              <div id="transactionDetailVisible"></div>
            </div>
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div class="text-sm font-semibold text-gray-900 mb-3">交易审计</div>
              <div id="transactionAuditVisible"></div>
            </div>
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div class="text-sm font-semibold text-gray-900 mb-3">月度收支摘要</div>
              <div id="transactionMonthlySummaryVisible"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const rulesHost = byId("rulesWorkspace");
  if (rulesHost) {
    rulesHost.innerHTML = `
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div id="rulesFilterBar" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
          <div id="rulesQuickBar" class="flex flex-wrap gap-2 mt-3"></div>
        </div>
        <div id="rulesStatsVisible"></div>
        <div class="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
          <div id="rulesListVisible"></div>
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm font-semibold text-gray-900 mb-3">规则详情</div>
            <div id="ruleDetailVisible"></div>
          </div>
        </div>
      </div>
    `;
  }

  const notificationsHost = byId("notificationsWorkspace");
  if (notificationsHost) {
    notificationsHost.innerHTML = `
      <div class="space-y-4">
        <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div id="notificationsFilterBar" class="grid grid-cols-1 md:grid-cols-3 gap-3"></div>
          <div id="notificationsToolbar" class="flex flex-wrap gap-2 mt-3"></div>
        </div>
        <div id="notificationsStatsVisible"></div>
        <div class="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
          <div class="space-y-4">
            <div id="notificationsListVisible"></div>
            <div id="notificationsPager" class="rounded-xl border border-gray-200 bg-white p-4"></div>
          </div>
          <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="text-sm font-semibold text-gray-900 mb-3">通知详情</div>
            <div id="notificationDetailVisible"></div>
          </div>
        </div>
      </div>
    `;
  }
}

function mountVisibleAdminWorkspaces() {
  buildWorkspaceSectionChrome();
  ensureWorkspaceSelectOptions();

  styleWorkspaceStatus("loginStatus");
  styleWorkspaceStatus("authGatewayStatus");
  styleWorkspaceSelect("familySelect");
  styleWorkspaceSelect("memberSelect");
  styleWorkspaceButton("openAuthPageBtn", "去登录页", "primary");
  styleWorkspaceButton("logoutBtn", "退出登录");
  styleWorkspaceButton("loadBusinessBtn", "加载业务");
  styleWorkspaceButton("loadTransactionsBtn", "加载交易");
  styleWorkspaceButton("loadRulesBtn", "加载规则");
  styleWorkspaceButton("loadNotificationsBtn", "加载通知");
  styleWorkspaceButton("evaluateRulesBtn", "执行规则评估", "primary");
  styleWorkspaceButton("createAccountBtn", "新增账户", "primary");
  styleWorkspaceButton("createCategoryBtn", "新增分类", "primary");
  styleWorkspaceButton("createBudgetBtn", "新增预算", "primary");
  styleWorkspaceButton("createTransactionBtn", "新增交易", "primary");
  styleWorkspaceButton("readAllNotificationsBtn", "全部标记已读");
  styleWorkspaceButton("clearReadNotificationsBtn", "清理已读通知", "danger");
  styleWorkspaceButton("exportTransactionsBtn", "导出当前交易");
  styleWorkspaceButton("resetAccountFiltersBtn", "重置账户筛选");
  styleWorkspaceButton("resetCategoryFiltersBtn", "重置分类筛选");
  styleWorkspaceButton("resetBudgetFiltersBtn", "重置预算筛选");
  styleWorkspaceButton("resetTransactionFiltersBtn", "重置交易筛选");

  appendLabeledField("adminSelectorHost", "当前家庭", "familySelect");
  appendLabeledField("adminSelectorHost", "当前成员", "memberSelect");
  mountNodeToHost("loginStatus", "adminStatusHost");
  mountNodeToHost("authGatewayStatus", "adminStatusHost");
  ["openAuthPageBtn", "logoutBtn"].forEach((id) => mountNodeToHost(id, "adminAuthActions"));
  ["loadBusinessBtn", "loadTransactionsBtn", "loadRulesBtn", "loadNotificationsBtn", "evaluateRulesBtn"].forEach((id) => mountNodeToHost(id, "adminLoadActions"));
  ["createAccountBtn", "createCategoryBtn", "createBudgetBtn", "createTransactionBtn"].forEach((id) => mountNodeToHost(id, "adminCreateActions"));

  mountNodeToHost("businessOverviewBoard", "businessOverviewVisible");
  mountNodeToHost("businessFocusBoard", "businessFocusVisible");
  mountNodeToHost("businessStateBoard", "businessStateVisible");
  mountNodeToHost("businessSelectionBoard", "businessSelectionVisible");
  mountNodeToHost("businessActionFeedbackBoard", "businessFeedbackVisible");
  mountNodeToHost("rulesOverviewBoard", "rulesOverviewVisible");
  mountNodeToHost("notificationsOverviewBoard", "notificationsOverviewVisible");
  mountNodeToHost("rulesStateBoard", "rulesStateVisible");
  mountNodeToHost("notificationsActionBoard", "notificationsActionVisible");

  ["accountStatusFilter", "accountTypeFilter", "accountSortFilter"].forEach((id) => styleWorkspaceSelect(id));
  appendLabeledField("accountsFilterBar", "账户状态", "accountStatusFilter");
  appendLabeledField("accountsFilterBar", "账户类型关键词", "accountTypeFilter");
  appendLabeledField("accountsFilterBar", "排序方式", "accountSortFilter");
  ["accountQuickAllBtn", "accountQuickSharedBtn", "accountQuickCreditBtn", "accountQuickEnabledBtn", "resetAccountFiltersBtn"].forEach((id) => mountNodeToHost(id, "accountsQuickBar"));
  mountNodeToHost("accountFilterSummary", "accountFilterSummaryVisible");
  mountNodeToHost("accountsStats", "accountsStatsVisible");
  mountNodeToHost("accountList", "accountListVisible");
  mountNodeToHost("accountDetailPanel", "accountDetailVisible");

  ["categoryEnabledFilter", "categoryTypeFilter", "categorySortFilter"].forEach((id) => styleWorkspaceSelect(id));
  appendLabeledField("categoriesFilterBar", "分类状态", "categoryEnabledFilter");
  appendLabeledField("categoriesFilterBar", "分类类型关键词", "categoryTypeFilter");
  appendLabeledField("categoriesFilterBar", "排序方式", "categorySortFilter");
  ["categoryQuickAllBtn", "categoryQuickExpenseBtn", "categoryQuickIncomeBtn", "categoryQuickEnabledBtn", "resetCategoryFiltersBtn"].forEach((id) => mountNodeToHost(id, "categoriesQuickBar"));
  mountNodeToHost("categoryFilterSummary", "categoryFilterSummaryVisible");
  mountNodeToHost("categoriesStats", "categoriesStatsVisible");
  mountNodeToHost("categoryList", "categoryListVisible");
  mountNodeToHost("categoryDetailPanel", "categoryDetailVisible");

  ["budgetEnabledFilter", "budgetPeriodFilter", "budgetSortFilter"].forEach((id) => styleWorkspaceSelect(id));
  appendLabeledField("budgetsFilterBar", "预算状态", "budgetEnabledFilter");
  appendLabeledField("budgetsFilterBar", "预算周期关键词", "budgetPeriodFilter");
  appendLabeledField("budgetsFilterBar", "排序方式", "budgetSortFilter");
  ["budgetQuickAllBtn", "budgetQuickAlertBtn", "budgetQuickExceededBtn", "budgetQuickMonthlyBtn", "resetBudgetFiltersBtn"].forEach((id) => mountNodeToHost(id, "budgetsQuickBar"));
  mountNodeToHost("budgetFilterSummary", "budgetFilterSummaryVisible");
  mountNodeToHost("budgetsStats", "budgetsStatsVisible");
  mountNodeToHost("budgetList", "budgetListVisible");
  mountNodeToHost("budgetDetailPanel", "budgetDetailVisible");
  mountNodeToHost("budgetActionBoard", "budgetActionVisible");

  ["transactionTypeFilter", "transactionPageSize"].forEach((id) => styleWorkspaceSelect(id));
  appendLabeledField("transactionsFilterBar", "交易类型", "transactionTypeFilter");
  appendLabeledField("transactionsFilterBar", "分页规模", "transactionPageSize");
  ["transactionQuickAllBtn", "transactionQuickMissingCategoryBtn", "transactionQuickMissingReferenceBtn", "transactionQuickLargeAmountBtn", "resetTransactionFiltersBtn", "exportTransactionsBtn"].forEach((id) => mountNodeToHost(id, "transactionsQuickBar"));
  mountNodeToHost("transactionFilterSummary", "transactionFilterSummaryVisible");
  mountNodeToHost("transactionsStats", "transactionsStatsVisible");
  mountNodeToHost("transactionList", "transactionListVisible");
  mountNodeToHost("transactionDetailPanel", "transactionDetailVisible");
  mountNodeToHost("transactionAuditBoard", "transactionAuditVisible");
  mountNodeToHost("transactionMonthlySummary", "transactionMonthlySummaryVisible");

  ["ruleEnabledFilter", "ruleTypeFilter"].forEach((id) => styleWorkspaceSelect(id));
  appendLabeledField("rulesFilterBar", "规则状态", "ruleEnabledFilter");
  appendLabeledField("rulesFilterBar", "规则类型关键词", "ruleTypeFilter");
  ["ruleQuickAllBtn", "ruleQuickHighBtn"].forEach((id) => mountNodeToHost(id, "rulesQuickBar"));
  mountNodeToHost("rulesStats", "rulesStatsVisible");
  mountNodeToHost("rulesList", "rulesListVisible");
  mountNodeToHost("ruleDetailPanel", "ruleDetailVisible");

  ["notificationReadFilter", "notificationSourceFilter", "notificationPageSize"].forEach((id) => styleWorkspaceSelect(id));
  appendLabeledField("notificationsFilterBar", "通知状态", "notificationReadFilter");
  appendLabeledField("notificationsFilterBar", "来源类型", "notificationSourceFilter");
  appendLabeledField("notificationsFilterBar", "分页规模", "notificationPageSize");
  ["readAllNotificationsBtn", "clearReadNotificationsBtn"].forEach((id) => mountNodeToHost(id, "notificationsToolbar"));
  mountNodeToHost("notificationsStats", "notificationsStatsVisible");
  mountNodeToHost("notificationsList", "notificationsListVisible");
  mountNodeToHost("notificationDetailPanel", "notificationDetailVisible");

  const businessFormModal = byId("businessFormModal");
  const businessForm = byId("businessForm");
  const businessFormTitle = byId("businessFormTitle");
  const businessFormSubtitle = byId("businessFormSubtitle");
  const businessFormStatus = byId("businessFormStatus");
  const businessFormFields = byId("businessFormFields");
  const businessFormCloseBtn = byId("businessFormCloseBtn");
  const businessFormCancelBtn = byId("businessFormCancelBtn");
  const businessFormSubmitBtn = byId("businessFormSubmitBtn");
  if (
    businessFormModal
    && businessForm
    && businessFormTitle
    && businessFormSubtitle
    && businessFormStatus
    && businessFormFields
    && businessFormCloseBtn
    && businessFormCancelBtn
    && businessFormSubmitBtn
    && !businessFormModal.dataset.mounted
  ) {
    businessFormModal.dataset.mounted = "true";
    businessFormModal.hidden = true;
    businessFormModal.className = "modal";
    businessForm.className = "modal-panel business-form-panel";
    const header = document.createElement("div");
    header.className = "modal-header";
    const titleWrap = document.createElement("div");
    businessFormTitle.className = "modal-title";
    businessFormSubtitle.className = "modal-subtitle";
    titleWrap.appendChild(businessFormTitle);
    titleWrap.appendChild(businessFormSubtitle);
    businessFormCloseBtn.className = "modal-close-btn";
    businessFormCloseBtn.textContent = "关闭";
    header.appendChild(titleWrap);
    header.appendChild(businessFormCloseBtn);

    businessFormStatus.className = "";
    businessFormFields.className = "form-grid";
    const actions = document.createElement("div");
    actions.className = "modal-actions";
    businessFormCancelBtn.className = "secondary-btn";
    businessFormCancelBtn.textContent = "取消";
    businessFormSubmitBtn.className = "primary-btn";
    businessFormSubmitBtn.textContent = "提交";
    actions.appendChild(businessFormCancelBtn);
    actions.appendChild(businessFormSubmitBtn);

    businessForm.appendChild(header);
    businessForm.appendChild(businessFormStatus);
    businessForm.appendChild(businessFormFields);
    businessForm.appendChild(actions);
    businessFormModal.appendChild(businessForm);
    document.body.appendChild(businessFormModal);
  }
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

function scrollToPanel(id) {
  const node = byId(id);
  if (node) {
    document.querySelectorAll(".is-focus-target").forEach((item) => item.classList.remove("is-focus-target"));
    document.querySelectorAll(".is-focus-panel").forEach((item) => item.classList.remove("is-focus-panel"));
    node.classList.add("is-focus-target");
    const panel = node.closest(".panel");
    if (panel) {
      panel.classList.add("is-focus-panel");
    }
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    window.clearTimeout(node._focusCleanupTimer);
    node._focusCleanupTimer = window.setTimeout(() => {
      node.classList.remove("is-focus-target");
      panel?.classList.remove("is-focus-panel");
    }, 2600);
  }
}

function getCurrentImportHistoryItems(filter = importHistoryQuickFilter) {
  const previousFilter = importHistoryQuickFilter;
  importHistoryQuickFilter = filter;
  const items = getSortedImportHistory(getFilteredImportHistory(importHistory));
  importHistoryQuickFilter = previousFilter;
  return items;
}

function focusImportHistory(filter = "all") {
  importHistoryQuickFilter = filter;
  const items = getCurrentImportHistoryItems(filter);
  selectedImportHistoryId = items[0]?.id ?? null;
  applyImportHistoryQuickFilter(filter);
  switchView("imports");
  if (selectedImportHistoryId) {
    renderImportHistory();
    renderImportHistoryDetail();
    scrollToPanel("importHistoryDetail");
    return;
  }
  scrollToPanel("importHistoryList");
}

async function focusRulesNotifications(mode = "unread") {
  switchView("rules");
  notificationsPageIndex = 0;
  byId("notificationReadFilter").value = mode === "all" ? "" : "0";
  byId("notificationSourceFilter").value = mode === "rule" ? "RULE" : "";
  if (mode === "high-priority-rules") {
    if (allRules.length === 0 && token && getCurrentFamilyId()) {
      await loadRules();
    }
    byId("ruleEnabledFilter").value = "1";
    byId("ruleTypeFilter").value = "";
    applyRuleQuickFilter("high");
    selectedRuleId = filteredRules[0]?.id ?? null;
    renderRules(filteredRules);
    scrollToPanel(selectedRuleId ? "ruleDetailPanel" : "rulesList");
    return;
  }
  if (notificationsPage.length === 0 && token && getCurrentFamilyId()) {
    await loadNotifications(0);
  } else {
    await loadNotifications(0);
  }
  selectedNotificationId = notificationsPage[0]?.id ?? null;
  renderNotifications(notificationsPage);
  scrollToPanel(selectedNotificationId ? "notificationDetailPanel" : "notificationsList");
}

async function focusBusinessArea(mode = "overview") {
  switchView("business");
  if (mode === "overview") {
    scrollToPanel("businessOverviewBoard");
    return;
  }
  if (mode === "shared-accounts") {
    byId("accountStatusFilter").value = "";
    byId("accountTypeFilter").value = "";
    byId("accountSortFilter").value = "name-asc";
    applyAccountQuickFilter("shared");
    scrollToPanel(selectedAccountId ? "accountDetailPanel" : "accountList");
    return;
  }
  if (mode === "enabled-budgets") {
    byId("budgetEnabledFilter").value = "1";
    byId("budgetPeriodFilter").value = "";
    byId("budgetSortFilter").value = "amount-desc";
    applyBudgetQuickFilter("all");
    scrollToPanel(selectedBudgetId ? "budgetDetailPanel" : "budgetList");
    return;
  }
  if (mode === "alert-budgets") {
    byId("budgetEnabledFilter").value = "";
    byId("budgetPeriodFilter").value = "";
    byId("budgetSortFilter").value = "amount-desc";
    applyBudgetQuickFilter("alert");
    scrollToPanel(selectedBudgetId ? "budgetActionBoard" : "budgetList");
    return;
  }
  if (mode === "exceeded-budgets") {
    byId("budgetEnabledFilter").value = "";
    byId("budgetPeriodFilter").value = "";
    byId("budgetSortFilter").value = "amount-desc";
    applyBudgetQuickFilter("exceeded");
    scrollToPanel(selectedBudgetId ? "budgetActionBoard" : "budgetList");
    return;
  }
  if (mode === "recent-transactions") {
    transactionPageIndex = 0;
    byId("transactionTypeFilter").value = "";
    transactionQuickFilter = "all";
    updateQuickTagButtons({
      all: "transactionQuickAllBtn",
      "missing-category": "transactionQuickMissingCategoryBtn",
      "missing-reference": "transactionQuickMissingReferenceBtn",
      "large-amount": "transactionQuickLargeAmountBtn"
    }, transactionQuickFilter);
    await loadTransactions(0);
    scrollToPanel(selectedTransactionId ? "transactionDetailPanel" : "transactionList");
    return;
  }
  if (mode === "transactions-missing-category") {
    byId("transactionTypeFilter").value = "";
    applyTransactionQuickFilter("missing-category");
    scrollToPanel(selectedTransactionId ? "transactionAuditBoard" : "transactionList");
    return;
  }
  if (mode === "transactions-missing-reference") {
    byId("transactionTypeFilter").value = "";
    applyTransactionQuickFilter("missing-reference");
    scrollToPanel(selectedTransactionId ? "transactionAuditBoard" : "transactionList");
    return;
  }
  if (mode === "transactions-large-amount") {
    byId("transactionTypeFilter").value = "";
    applyTransactionQuickFilter("large-amount");
    scrollToPanel(selectedTransactionId ? "transactionAuditBoard" : "transactionList");
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
  family: ["analysis-summary", "business-shared", "rules-unread", "acceptance-run"],
  business: ["business-alert-budgets", "business-shared", "rules-unread", "acceptance-run"],
  rules: ["rules-unread", "rules-high-priority", "business-alert-budgets", "acceptance-run"],
  system: ["acceptance-run", "imports-issues", "analysis-summary", "rules-unread"],
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
    fred: "analysisFredPanel",
    conclusions: "analysisConclusionPanel",
    raw: "analysisRawPanel"
  };
  scrollToPanel(mapping[target] || mapping.dashboard);
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

function getFilteredTransactions(items = transactionItems) {
  const transactionType = byId("transactionTypeFilter")?.value || "";
  return (items || []).filter((item) => {
    if (transactionType && !includesKeyword(item.transactionType, transactionType)) {
      return false;
    }
    if (transactionQuickFilter === "missing-category" && item.categoryId) {
      return false;
    }
    if (transactionQuickFilter === "missing-reference" && String(item.note || "").trim()) {
      return false;
    }
    if (transactionQuickFilter === "missing-reference" && String(item.externalTradeNo || "").trim()) {
      return false;
    }
    if (transactionQuickFilter === "large-amount" && Math.abs(Number(item.amount || 0)) < 1000) {
      return false;
    }
    return true;
  });
}

function hasActiveTransactionFilters() {
  return Boolean((byId("transactionTypeFilter")?.value || "") || transactionQuickFilter !== "all");
}

function renderTransactionFilterSummary(filteredCount, totalCount) {
  const summary = byId("transactionFilterSummary");
  if (!summary) {
    return;
  }
  const parts = [];
  const type = byId("transactionTypeFilter")?.value || "";
  if (type) {
    parts.push(`类型=${{ INCOME: "收入", EXPENSE: "支出", TRANSFER: "转账" }[type] || type}`);
  }
  if (transactionQuickFilter !== "all") {
    parts.push(`快捷=${{
      "missing-category": "缺少分类",
      "missing-reference": "缺少说明",
      "large-amount": "大额交易"
    }[transactionQuickFilter] || transactionQuickFilter}`);
  }
  const pageSize = byId("transactionPageSize")?.value || "8";
  summary.textContent = parts.length === 0
    ? `当前未启用筛选，本页返回 ${formatNumber(totalCount, 0)} 条；每页 ${pageSize} 条`
    : `已筛选：${parts.join("，")}；命中 ${formatNumber(filteredCount, 0)} / ${formatNumber(totalCount, 0)} 条；每页 ${pageSize} 条`;
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

function resetTransactionFilters() {
  byId("transactionTypeFilter").value = "";
  byId("transactionPageSize").value = "8";
  transactionQuickFilter = "all";
  updateQuickTagButtons({
    all: "transactionQuickAllBtn",
    "missing-category": "transactionQuickMissingCategoryBtn",
    "missing-reference": "transactionQuickMissingReferenceBtn",
    "large-amount": "transactionQuickLargeAmountBtn"
  }, transactionQuickFilter);
  loadTransactions(0);
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

function applyTransactionQuickFilter(filter) {
  transactionQuickFilter = filter;
  updateQuickTagButtons({
    all: "transactionQuickAllBtn",
    "missing-category": "transactionQuickMissingCategoryBtn",
    "missing-reference": "transactionQuickMissingReferenceBtn",
    "large-amount": "transactionQuickLargeAmountBtn"
  }, transactionQuickFilter);
  renderTransactions(transactionItems);
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

function exportCurrentTransactions() {
  const items = getFilteredTransactions(transactionItems);
  downloadCsv("transactions_current_view.csv", [
    ["ID", "交易对象", "类型", "金额", "时间", "分类", "账户", "来源平台", "备注/外部单号"],
    ...items.map((item) => [
      item.id,
      item.merchantName || item.counterpartyName || `交易#${item.id}`,
      item.transactionType,
      item.amount,
      item.transactionTime || "",
      item.categoryId ? formatCategoryRef(item.categoryId) : "未分类",
      formatAccountRef(item.accountId),
      item.sourcePlatform || "-",
      item.note || item.externalTradeNo || "-"
    ])
  ]);
  setBusinessStatus(`交易当前结果已导出，共 ${formatNumber(items.length, 0)} 条。`);
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
  transactionQuickFilter = "all";
  selectedTransactionId = null;
  latestBusinessAction = null;
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
  renderBusinessActionFeedback();
  renderSidebarStatusPanel();
  renderAcceptanceWorkspace();
  renderTopStats();
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
  currentUser = user || null;
  const status = byId("loginStatus");
  const gatewayStatus = byId("authGatewayStatus");
  if (!user) {
    setNodeText(status, "未登录");
    if (gatewayStatus) {
      setNodeText(gatewayStatus, "当前未登录，请先进入独立登录/注册页完成认证。");
    }
    renderHeaderAndSupportPanels();
    return;
  }
  const label = [user.nickname || user.realName || user.username, user.userType].filter(Boolean).join(" / ");
  setNodeText(status, label || "已登录");
  if (gatewayStatus) {
    setNodeText(gatewayStatus, `${label || "已登录"}，当前可直接执行导入、分析和后台管理操作。`);
  }
  renderHeaderAndSupportPanels();
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

function recordBusinessAction(action) {
  const entityIds = Array.isArray(action.entityIds)
    ? action.entityIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
    : (action.entityId ? [Number(action.entityId)] : []);
  latestBusinessAction = {
    scope: action.scope || "业务",
    operation: action.operation || "更新",
    target: action.target || "-",
    detail: action.detail || "",
    count: Number(action.count || 0),
    tone: action.tone || "info",
    success: action.success !== false,
    entityId: entityIds[0] || null,
    entityIds,
    time: new Date().toISOString()
  };
  renderBusinessActionFeedback();
}

function getBusinessScopeState(scope) {
  if (scope === "账户") {
    return { selectedId: selectedAccountId, items: accounts, action: "business-feedback-open-account" };
  }
  if (scope === "分类") {
    return { selectedId: selectedCategoryId, items: categories, action: "business-feedback-open-category" };
  }
  if (scope === "预算") {
    return { selectedId: selectedBudgetId, items: budgets, action: "business-feedback-open-budget" };
  }
  if (scope === "交易") {
    return { selectedId: selectedTransactionId, items: transactionItems, action: "business-feedback-open-transaction" };
  }
  return { selectedId: null, items: [], action: "business-feedback-open-scope" };
}

function isLatestBusinessActionTarget(scope, entityId) {
  return Boolean(
    latestBusinessAction
    && latestBusinessAction.scope === scope
    && (latestBusinessAction.entityIds || []).some((id) => Number(id) === Number(entityId || 0))
  );
}

function getLatestBusinessActionListMessage(scope) {
  if (!latestBusinessAction || latestBusinessAction.scope !== scope) {
    return null;
  }
  return `${latestBusinessAction.operation}：${latestBusinessAction.detail || "已完成最近一次操作"}`;
}

function getLatestBusinessActionEntityIds(scope) {
  if (!latestBusinessAction || latestBusinessAction.scope !== scope) {
    return [];
  }
  return (latestBusinessAction.entityIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id));
}

function showLatestBusinessActionResultsOnly() {
  if (!latestBusinessAction) {
    return;
  }
  switchView("business");
  const ids = getLatestBusinessActionEntityIds(latestBusinessAction.scope);
  if (latestBusinessAction.scope === "账户") {
    selectedAccountIds = ids;
    accountShowSelectedOnly = true;
    if (ids[0]) {
      selectedAccountId = ids[0];
    }
    renderAccounts(getFilteredAccounts(accounts));
    return;
  }
  if (latestBusinessAction.scope === "分类") {
    selectedCategoryIds = ids;
    categoryShowSelectedOnly = true;
    if (ids[0]) {
      selectedCategoryId = ids[0];
    }
    renderCategories(getFilteredCategories(categories));
    return;
  }
  if (latestBusinessAction.scope === "预算") {
    selectedBudgetIds = ids;
    budgetShowSelectedOnly = true;
    if (ids[0]) {
      selectedBudgetId = ids[0];
    }
    renderBudgets(getFilteredBudgets(budgets));
    return;
  }
  if (latestBusinessAction.scope === "交易") {
    if (ids[0]) {
      selectedTransactionId = ids[0];
    }
    renderTransactions(transactionItems);
    scrollToPanel("transactionList");
  }
}

function focusLatestBusinessActionTarget() {
  if (!latestBusinessAction) {
    return;
  }
  switchView("business");
  if (latestBusinessAction.scope === "账户" && latestBusinessAction.entityId) {
    selectedAccountId = Number(latestBusinessAction.entityId);
    renderAccounts(getFilteredAccounts(accounts));
    renderAccountDetail(accounts.find((item) => Number(item.id) === selectedAccountId) || null);
    scrollToPanel("accountDetailPanel");
    return;
  }
  if (latestBusinessAction.scope === "分类" && latestBusinessAction.entityId) {
    selectedCategoryId = Number(latestBusinessAction.entityId);
    renderCategories(getFilteredCategories(categories));
    renderCategoryDetail(categories.find((item) => Number(item.id) === selectedCategoryId) || null);
    scrollToPanel("categoryDetailPanel");
    return;
  }
  if (latestBusinessAction.scope === "预算" && latestBusinessAction.entityId) {
    selectedBudgetId = Number(latestBusinessAction.entityId);
    renderBudgets(getFilteredBudgets(budgets));
    renderBudgetDetail(budgets.find((item) => Number(item.id) === selectedBudgetId) || null);
    scrollToPanel("budgetDetailPanel");
    return;
  }
  if (latestBusinessAction.scope === "交易") {
    if (latestBusinessAction.entityId) {
      selectedTransactionId = Number(latestBusinessAction.entityId);
    }
    renderTransactions(transactionItems);
    renderTransactionDetail(transactionItems.find((item) => Number(item.id) === Number(latestBusinessAction.entityId || selectedTransactionId)) || null);
    scrollToPanel("transactionDetailPanel");
  }
}

function syncLatestBusinessActionSelection() {
  if (!latestBusinessAction || !latestBusinessAction.success || !latestBusinessAction.entityIds?.length) {
    return;
  }
  const visibleIds = latestBusinessAction.entityIds.map((id) => Number(id));
  if (latestBusinessAction.scope === "账户" && latestBusinessAction.operation !== "删除") {
    selectedAccountIds = visibleIds.filter((id) => accounts.some((item) => Number(item.id) === id));
    if (selectedAccountIds[0]) {
      selectedAccountId = selectedAccountIds[0];
    }
  }
  if (latestBusinessAction.scope === "分类" && latestBusinessAction.operation !== "删除") {
    selectedCategoryIds = visibleIds.filter((id) => categories.some((item) => Number(item.id) === id));
    if (selectedCategoryIds[0]) {
      selectedCategoryId = selectedCategoryIds[0];
    }
  }
  if (latestBusinessAction.scope === "预算" && latestBusinessAction.operation !== "删除") {
    selectedBudgetIds = visibleIds.filter((id) => budgets.some((item) => Number(item.id) === id));
    if (selectedBudgetIds[0]) {
      selectedBudgetId = selectedBudgetIds[0];
    }
  }
  if (latestBusinessAction.scope === "交易" && latestBusinessAction.operation !== "删除") {
    const matchedIds = visibleIds.filter((id) => transactionItems.some((item) => Number(item.id) === id));
    if (matchedIds[0]) {
      selectedTransactionId = matchedIds[0];
    }
  }
}

function renderBusinessActionFeedback() {
  const host = byId("businessActionFeedbackBoard");
  if (!host) {
    return;
  }
  if (!token || !getCurrentFamilyId()) {
    host.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看最近业务操作</div>';
    return;
  }
  if (!latestBusinessAction) {
    host.innerHTML = '<div class="summary-item">当前还没有业务操作记录，执行新增、编辑、启停或删除后会在这里回显结果</div>';
    return;
  }
  const action = latestBusinessAction;
  const tone = action.tone || (action.success ? "info" : "danger");
  const scopeState = getBusinessScopeState(action.scope);
  const canFocusTarget = Boolean(action.entityIds?.length && scopeState.items.some((item) => action.entityIds.includes(Number(item.id))));
  const focusLabel = action.count > 1 ? "查看当前结果" : "定位受影响对象";
  host.innerHTML = `
    ${renderResultOverview([
      { label: "操作模块", value: action.scope, meta: action.operation, tone },
      { label: "影响对象", value: action.target, meta: action.count > 0 ? `影响 ${formatNumber(action.count, 0)} 项` : "单项操作" },
      { label: "执行结果", value: action.success ? "已完成" : "失败", meta: action.detail || "-", tone: action.success ? tone : "danger" }
    ])}
    ${renderAlertStrip([
      { text: `${action.scope}${action.operation}${action.success ? "已完成" : "失败"}：${action.detail || "请结合右侧列表继续核对结果"}`, tone: action.success ? tone : "danger" }
    ])}
    <div class="detail-section">
      <div class="detail-section-title">操作快照</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "模块", value: action.scope },
          { label: "动作", value: action.operation },
          { label: "对象", value: action.target },
          { label: "影响范围", value: action.count > 0 ? `${formatNumber(action.count, 0)} 项` : "1 项" },
          { label: "执行时间", value: formatDateTime(action.time) }
        ])}
      </div>
    </div>
    <div class="item-actions">
      <button class="mini-btn" type="button" data-action="business-feedback-open-scope">打开对应模块</button>
      <button class="mini-btn" type="button" data-action="business-feedback-open-target" ${canFocusTarget ? "" : "disabled"}>${focusLabel}</button>
      <button class="mini-btn" type="button" data-action="business-feedback-filter-targets" ${canFocusTarget ? "" : "disabled"}>仅看最近受影响</button>
    </div>
  `;
}

function renderMetric(id, value) {
  setTextById(id, value ?? "-");
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
  if (!host) {
    return;
  }
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
  if (!host) {
    return;
  }
  const points = worldBankTrend?.points || [];
  if (points.length === 0) {
    host.innerHTML = '<div class="summary-item">暂无国家趋势数据</div>';
    return;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const yoyText = last.yearOnYearGrowthRatio === null || last.yearOnYearGrowthRatio === undefined
    ? "暂无同比"
    : `${formatNumber(Number(last.yearOnYearGrowthRatio) * 100)}%`;
  host.innerHTML = `
    <div class="summary-item"><strong>${escapeHtml(worldBankTrend.countryName || "未知国家")}</strong> (${escapeHtml(worldBankTrend.countryIso3 || "-")})</div>
    <div class="detail-grid">
      <div class="detail-item"><strong>起始年份</strong><div>${escapeHtml(first.year)}</div><div>数值 ${formatNumber(first.value)}</div></div>
      <div class="detail-item"><strong>最新年份</strong><div>${escapeHtml(last.year)}</div><div>数值 ${formatNumber(last.value)}</div></div>
      <div class="detail-item"><strong>最新同比</strong><div>${yoyText}</div></div>
      <div class="detail-item"><strong>趋势点数</strong><div>${formatNumber(points.length, 0)}</div></div>
    </div>
  `;
}

function renderFred(fredSeries) {
  const host = byId("fredSummary");
  if (!host) {
    return;
  }
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
  if (!host) {
    return;
  }
  if (!conclusions || conclusions.length === 0) {
    host.innerHTML = '<div class="conclusion-item">暂无自动结论</div>';
    return;
  }
  host.innerHTML = conclusions.map((item, index) => `
    <div class="conclusion-item">${index + 1}. ${escapeHtml(item)}</div>
  `).join("");
}

function resolveGrowthDirection(ratio) {
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric)) {
    return "波动情况暂不明确";
  }
  if (numeric > 0.05) {
    return "保持明显上升";
  }
  if (numeric > 0) {
    return "小幅上升";
  }
  if (numeric < -0.05) {
    return "出现明显回落";
  }
  if (numeric < 0) {
    return "略有回落";
  }
  return "整体基本持平";
}

function buildRetailInsights(retailOverview) {
  const topCountries = retailOverview?.topCountries || [];
  if (!retailOverview || !topCountries.length) {
    return [];
  }
  const totalRecords = Number(retailOverview.totalRecords || 0);
  const totalAmount = Number(retailOverview.totalAmount || 0);
  const avgAmount = Number(retailOverview.averageAmount || 0);
  const topCountry = topCountries[0] || null;
  const secondCountry = topCountries[1] || null;
  const topCountryShare = totalAmount > 0 && topCountry ? (Number(topCountry.totalAmount || 0) / totalAmount) : 0;
  const concentrationText = topCountryShare >= 0.35
    ? "头部国家集中度较高，交易分布不均衡。"
    : "头部国家占比适中，交易分布相对分散。";
  return [
    {
      title: "结构判断",
      tone: topCountryShare >= 0.35 ? "warning" : "success",
      text: `零售数据共 ${formatNumber(totalRecords, 0)} 条，平均单笔金额 ${formatNumber(avgAmount)}。${concentrationText}`
    },
    {
      title: "头部国家",
      tone: "info",
      text: topCountry
        ? `${topCountry.country || "未知国家"} 当前排名第一，交易额 ${formatNumber(topCountry.totalAmount)}，记录数 ${formatNumber(topCountry.recordCount, 0)}。${secondCountry ? `第二名为 ${secondCountry.country || "未知国家"}。` : ""}`
        : "暂无头部国家数据。"
    },
    {
      title: "答辩可讲",
      tone: "success",
      text: topCountry
        ? `可以直接说明：当前零售交易呈现“${topCountry.country || "头部国家"}领先、其余国家分散”的结构特征。`
        : "暂无可用于答辩的交易结构结论。"
    }
  ];
}

function buildTrendInsights(worldBankTrend, fredSeries) {
  const insights = [];
  const worldPoints = worldBankTrend?.points || [];
  if (worldPoints.length > 1) {
    const first = worldPoints[0];
    const last = worldPoints[worldPoints.length - 1];
    const delta = Number(last.value || 0) - Number(first.value || 0);
    insights.push({
      title: "国家趋势",
      tone: delta >= 0 ? "success" : "warning",
      text: `${worldBankTrend.countryName || worldBankTrend.countryIso3 || "目标国家"}从 ${escapeHtml(first.year)} 到 ${escapeHtml(last.year)} 的居民消费指标总体${delta >= 0 ? "上行" : "回落"}，最新一年${resolveGrowthDirection(last.yearOnYearGrowthRatio)}。`
    });
    insights.push({
      title: "答辩可讲",
      tone: "info",
      text: `可以直接说明：${worldBankTrend.countryName || worldBankTrend.countryIso3 || "该国"}居民消费长期趋势${delta >= 0 ? "总体增长" : "存在阶段性回落"}，说明该接口已经具备趋势分析输出能力。`
    });
  }
  const fredPoints = fredSeries?.points || [];
  if (fredPoints.length > 1) {
    const firstFred = fredPoints[0];
    const lastFred = fredPoints[fredPoints.length - 1];
    insights.push({
      title: "宏观序列",
      tone: "info",
      text: `${fredSeries.seriesId || "FRED"} 序列已返回 ${formatNumber(fredPoints.length, 0)} 个点，时间范围从 ${escapeHtml(firstFred.date)} 到 ${escapeHtml(lastFred.date)}，可作为宏观背景数据进行补充说明。`
    });
  } else if (fredSeries?.seriesId) {
    insights.push({
      title: "宏观序列",
      tone: "warning",
      text: `${fredSeries.seriesId} 当前为空或软降级，不影响零售与国家趋势分析，但答辩时应说明宏观数据源存在容错处理。`
    });
  }
  return insights;
}

function renderInsightBoard(id, items, emptyMessage) {
  const host = byId(id);
  if (!host) {
    return;
  }
  if (!items || items.length === 0) {
    host.innerHTML = `<div class="summary-item">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  host.innerHTML = items.map((item) => `
    <div class="summary-item">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <strong>${escapeHtml(item.title || "分析结果")}</strong>
        <span class="status-chip ${escapeHtml(item.tone || "info")}">${escapeHtml(
          item.tone === "success" ? "可展示" : item.tone === "warning" ? "关注" : "说明"
        )}</span>
      </div>
      <div style="margin-top:8px;">${escapeHtml(item.text || "")}</div>
    </div>
  `).join("");
}

function syncAnalysisParamMirrors() {
  const mapping = [
    ["countryIso3Mirror", "countryIso3"],
    ["seriesIdMirror", "seriesId"],
    ["topCountriesMirror", "topCountries"]
  ];
  mapping.forEach(([mirrorId, sourceId]) => {
    const mirror = byId(mirrorId);
    const source = byId(sourceId);
    if (!mirror || !source) {
      return;
    }
    mirror.value = source.value || mirror.value || "";
  });
}

function applyAnalysisParamMirrors() {
  const mapping = [
    ["countryIso3Mirror", "countryIso3"],
    ["seriesIdMirror", "seriesId"],
    ["topCountriesMirror", "topCountries"]
  ];
  mapping.forEach(([mirrorId, sourceId]) => {
    const mirror = byId(mirrorId);
    const source = byId(sourceId);
    if (!mirror || !source) {
      return;
    }
    source.value = mirror.value || source.value || "";
  });
}

function renderRaw(payload) {
  setTextById("rawPayload", JSON.stringify(payload, null, 2));
}

function renderImportStateBoard(result = latestImport) {
  const host = byId("importStateBoard");
  if (!host) {
    return;
  }
  if (!result) {
    host.innerHTML = `
      ${renderResultOverview([
        { label: "当前状态", value: "未执行", meta: "尚未产生可复核的导入批次", tone: "warning" },
        { label: "核心数据", value: "待导入", meta: "零售、世行、FRED 仍未入库", tone: "warning" },
        { label: "建议动作", value: "先执行导入", meta: "推荐使用默认批次 5000 并清空后重导", tone: "warning" }
      ])}
      ${renderAlertStrip([{ text: "当前没有最近批次，建议先执行导入，再判断质量、异常和后续动作。", tone: "warning" }])}
    `;
    return;
  }
  const quality = getImportQualityConclusion(result);
  const status = result.importStatus || "";
  const hasFailure = isImportFailed(status);
  const hasDegrade = Number(result.fredImported || 0) === 0;
  const alerts = [
    ...(hasFailure ? [{ text: `最近批次状态异常：${status || "未知"}，当前不适合直接继续分析。`, tone: "danger" }] : []),
    ...(hasDegrade ? [{ text: "FRED 当前处于软降级状态，宏观序列展示会缺数。", tone: "warning" }] : []),
    ...(!hasFailure && !hasDegrade ? [{ text: "最近批次整体可用，可以直接切换分析页刷新汇总。", tone: "success" }] : [])
  ];
  const actions = [
    ...(hasFailure ? [{ label: "重新导入", command: "acceptance-run" }] : []),
    ...(!hasFailure ? [{ label: "刷新分析汇总", command: "analysis-summary" }] : []),
    ...(hasDegrade ? [{ label: "查看降级批次", command: "imports-degraded" }] : [{ label: "查看导入异常", command: "imports-issues" }])
  ];
  host.innerHTML = `
    ${renderResultOverview([
      { label: "导入质量", value: quality.label, meta: quality.detail, tone: quality.tone || "warning" },
      { label: "导入状态", value: status || "未知", meta: `批次 ${formatNumber(result.importBatchId, 0)}`, tone: hasFailure ? "danger" : (!isImportSuccessful(status) ? "warning" : "success") },
      { label: "核心数据", value: `${formatNumber(result.retailImported, 0)} / ${formatNumber(result.worldBankImported, 0)}`, meta: "零售 / 世行", tone: Number(result.retailImported || 0) > 0 && Number(result.worldBankImported || 0) > 0 ? "success" : "danger" },
      { label: "FRED 状态", value: hasDegrade ? "软降级" : "已接通", meta: hasDegrade ? "当前宏观序列未入库" : `已导入 ${formatNumber(result.fredImported, 0)} 条`, tone: hasDegrade ? "warning" : "success" },
      { label: "下一步", value: hasFailure ? "先修导入" : "可继续分析", meta: hasFailure ? "建议复查目录、批次和接口状态" : (hasDegrade ? "可先分析，但答辩前建议补抓 FRED" : "建议立即刷新分析汇总"), tone: hasFailure ? "danger" : (hasDegrade ? "warning" : "success") }
    ])}
    ${renderAlertStrip(alerts)}
    <div class="detail-section">
      <div class="detail-section-title">导入状态摘要</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "处理目录", value: result.processedDir || "-" },
          { label: "批大小", value: formatNumber(result.batchSize, 0) },
          { label: "清空重导", value: formatBoolean(result.truncatedBeforeImport) },
          { label: "导入时间", value: formatDateTime(result.importedAt) }
        ])}
      </div>
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
      ${renderResultOverview([
        { label: "分析状态", value: "加载中", meta: "正在请求真实数据分析汇总", tone: "warning" },
        { label: "国家趋势", value: "等待返回", meta: "稍后同步更新世行趋势点", tone: "warning" },
        { label: "宏观序列", value: "等待返回", meta: "稍后同步更新 FRED 状态", tone: "warning" }
      ])}
      ${renderAlertStrip([{ text: "正在请求真实数据分析汇总，稍后会同步更新国家趋势、FRED 状态、自动结论和原始回执。", tone: "warning" }])}
    `;
    return;
  }
  if (state === "error") {
    host.innerHTML = `
      ${renderResultOverview([
        { label: "分析状态", value: "失败", meta: errorMessage || "当前未拿到分析结果", tone: "danger" },
        { label: "建议动作", value: "检查接口", meta: "确认导入、参数和服务状态", tone: "danger" },
        { label: "回退方案", value: "查看原始回执", meta: "必要时先回看最近导入结果", tone: "warning" }
      ])}
      ${renderAlertStrip([{ text: errorMessage || "当前未拿到分析结果，请检查接口状态和参数。", tone: "danger" }])}
    `;
    return;
  }
  if (!summary) {
    host.innerHTML = `
      ${renderResultOverview([
        { label: "分析状态", value: "未生成", meta: "当前分析页还没有真实结果", tone: "warning" },
        { label: "国家趋势", value: "待刷新", meta: "世行趋势仍未计算", tone: "warning" },
        { label: "宏观序列", value: "待刷新", meta: "FRED 序列仍未计算", tone: "warning" }
      ])}
      ${renderAlertStrip([{ text: "建议先完成导入，再执行分析汇总。", tone: "warning" }])}
    `;
    return;
  }
  const retailOverview = summary?.retailOverview || {};
  const worldBankTrend = summary?.worldBankTrend || {};
  const fredSeries = summary?.fredSeries || {};
  const worldBankPoints = worldBankTrend.points?.length || 0;
  const fredPoints = fredSeries.points?.length || 0;
  const conclusions = summary?.conclusions || [];
  const alerts = [
    ...(worldBankPoints === 0 ? [{ text: "世行趋势为空，当前无法支撑国家趋势结论。", tone: "danger" }] : []),
    ...(fredPoints === 0 ? [{ text: "FRED 当前无点数，宏观序列按软降级展示。", tone: "warning" }] : []),
    ...(conclusions.length === 0 ? [{ text: "当前没有自动结论输出，汇报时需手动组织结论。", tone: "warning" }] : []),
    ...(worldBankPoints > 0 && conclusions.length > 0 ? [{ text: "当前已形成可解释的分析结果，可直接用于汇报和演示。", tone: "success" }] : [])
  ];
  host.innerHTML = `
    ${renderResultOverview([
      { label: "零售数据", value: formatNumber(retailOverview.totalRecords, 0), meta: `金额 ${formatNumber(retailOverview.totalAmount)}`, tone: Number(retailOverview.totalRecords || 0) > 0 ? "success" : "warning" },
      { label: "国家趋势", value: worldBankPoints > 0 ? formatNumber(worldBankPoints, 0) : "0", meta: worldBankPoints > 0 ? `${worldBankTrend.countryIso3 || "-"} 趋势点` : "世行趋势为空", tone: worldBankPoints > 0 ? "success" : "danger" },
      { label: "宏观序列", value: fredPoints > 0 ? formatNumber(fredPoints, 0) : "0", meta: fredPoints > 0 ? `${fredSeries.seriesId || "-"} 已接通` : "当前软降级", tone: fredPoints > 0 ? "success" : "warning" },
      { label: "自动结论", value: formatNumber(conclusions.length, 0), meta: conclusions.length > 0 ? "已可用于汇报说明" : "当前没有自动结论", tone: conclusions.length > 0 ? "success" : "warning" }
    ])}
    ${renderAlertStrip(alerts)}
    <div class="detail-section">
      <div class="detail-section-title">分析状态摘要</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "国家参数", value: worldBankTrend.countryIso3 || byId("countryIso3")?.value || "-" },
          { label: "FRED 序列", value: fredSeries.seriesId || byId("seriesId")?.value || "-" },
          { label: "Top Countries", value: formatNumber(byId("topCountries")?.value || 0, 0) },
          { label: "说明", value: "原始回执区可作为结果解释依据", meta: "自动结论对应零售、世行和 FRED 的原始结构" }
        ])}
      </div>
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
    renderTopStats();
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
  renderTopStats();
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
  renderTopStats();
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
    renderTopStats();
    return;
  }

  familySelect.innerHTML = memberships.map((item, index) => `
    <option value="${item.familyId}" ${index === 0 ? "selected" : ""}>
      ${escapeHtml(item.familyName || `家庭${item.familyId}`)}
    </option>
  `).join("");
  updateMemberOptions();
  renderTopStats();
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
      ${item.meta ? `<div class="detail-pair-meta">${escapeHtml(item.meta)}</div>` : ""}
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
  setTextById("businessFormTitle", config.title);
  setTextById("businessFormSubtitle", config.subtitle);
  setTextById("businessFormSubmitBtn", config.submitText);
  if (byId("businessFormSubmitBtn")) {
    byId("businessFormSubmitBtn").dataset.idleText = config.submitText;
  }
  if (byId("businessFormFields")) {
    byId("businessFormFields").innerHTML = config.fields.map(renderBusinessFormField).join("");
  }
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
  if (!node) {
    return;
  }
  if (!message) {
    node.hidden = true;
    setNodeText(node, "");
    return;
  }
  node.hidden = false;
  setNodeText(node, message);
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
  const visibleTotal = items?.length || 0;
  const total = allRules.length || visibleTotal;
  const enabled = (items || []).filter((item) => Number(item.enabled) === 1).length;
  const disabled = visibleTotal - enabled;
  const highPriority = (items || []).filter((item) => Number(item.priority || 0) >= 8).length;
  const typeCount = new Set((items || []).map((item) => String(item.ruleType || "").trim()).filter(Boolean)).size;
  byId("rulesStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(total, 0)}</div>
    <div class="stats-pill">当前结果：${formatNumber(visibleTotal, 0)}</div>
    <div class="stats-pill">启用：${formatNumber(enabled, 0)}</div>
    <div class="stats-pill">停用：${formatNumber(disabled, 0)}</div>
    <div class="stats-pill">高优先级：${formatNumber(highPriority, 0)}</div>
    <div class="stats-pill">规则类型：${formatNumber(typeCount, 0)}</div>
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
  renderHeaderAndSupportPanels();
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
  renderTopStats();
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

function renderBusinessWorkspacePanels() {
  const stateHost = byId("businessStateBoard");
  const selectionHost = byId("businessSelectionBoard");
  if (!stateHost || !selectionHost) {
    return;
  }
  if (!token || !getCurrentFamilyId()) {
    stateHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看当前业务上下文</div>';
    selectionHost.innerHTML = '<div class="summary-item">请先登录并选择家庭后查看选中对象与操作范围</div>';
    return;
  }

  const filteredAccounts = getFilteredAccounts(accounts);
  const filteredCategories = getFilteredCategories(categories);
  const filteredBudgets = getFilteredBudgets(budgets);
  const visibleTransactions = transactionItems || [];
  const sharedAccounts = accounts.filter((item) => Number(item.isShared) === 1).length;
  const disabledAccounts = accounts.filter((item) => Number(item.status) !== 1).length;
  const disabledCategories = categories.filter((item) => Number(item.enabled) !== 1).length;
  const alertBudgetCount = budgetUsage.filter((item) => item.alertTriggered || item.exceeded).length;
  const exceededBudgetCount = budgetUsage.filter((item) => item.exceeded).length;
  const incomeTransactions = visibleTransactions.filter((item) => includesKeyword(item.transactionType, "INCOME")).length;
  const expenseTransactions = visibleTransactions.filter((item) => includesKeyword(item.transactionType, "EXPENSE")).length;
  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) || null;
  const selectedCategory = categories.find((item) => item.id === selectedCategoryId) || null;
  const selectedBudget = budgets.find((item) => item.id === selectedBudgetId) || null;
  const selectedTransaction = transactionItems.find((item) => item.id === selectedTransactionId) || null;

  const riskItems = [
    ...(exceededBudgetCount > 0 ? [{ text: `存在 ${exceededBudgetCount} 个超支预算，应优先处理预算异常`, tone: "danger" }] : []),
    ...(alertBudgetCount > exceededBudgetCount ? [{ text: `另有 ${alertBudgetCount - exceededBudgetCount} 个预算处于预警线附近`, tone: "warning" }] : []),
    ...(disabledAccounts > 0 ? [{ text: `共有 ${disabledAccounts} 个账户处于停用状态，需确认是否仍保留`, tone: "warning" }] : []),
    ...(disabledCategories > 0 ? [{ text: `共有 ${disabledCategories} 个分类已停用，建议核对预算与交易引用`, tone: "warning" }] : []),
    ...(sharedAccounts > 0 ? [{ text: `当前存在 ${sharedAccounts} 个共享账户，适合复核成员权限`, tone: "info" }] : []),
    ...(transactionTotalElements === 0 ? [{ text: "当前交易列表没有真实返回，交易链路仍需检查", tone: "warning" }] : [])
  ];

  const workspaceHealth = exceededBudgetCount > 0
    ? "当前业务存在预算超支，需要先处理预算异常。"
    : alertBudgetCount > 0 || disabledAccounts > 0 || disabledCategories > 0
      ? "当前业务可继续操作，但仍有预警项和配置项需要跟进。"
      : transactionTotalElements > 0
        ? "当前业务数据整体健康，适合继续做新增、编辑和联调验证。"
        : "当前已加载基础业务数据，但交易链路仍需补齐验证。";

  stateHost.innerHTML = `
    ${renderResultOverview([
      { label: "筛选命中", value: `${formatNumber(filteredAccounts.length, 0)} / ${formatNumber(filteredCategories.length, 0)} / ${formatNumber(filteredBudgets.length, 0)} / ${formatNumber(visibleTransactions.length, 0)}`, meta: "账户 / 分类 / 预算 / 当前页交易" },
      { label: "风险项", value: formatNumber(riskItems.length, 0), meta: riskItems.length > 0 ? "已识别当前页重点处理事项" : "当前未发现明显阻塞项", tone: riskItems.length > 0 ? "warning" : "" },
      { label: "工作区判断", value: exceededBudgetCount > 0 ? "优先处理预算" : (selectedAccountIds.length + selectedCategoryIds.length + selectedBudgetIds.length > 0 ? "可批量处理" : "可继续单项维护"), meta: workspaceHealth, tone: exceededBudgetCount > 0 ? "danger" : "" }
    ])}
    <div class="detail-section">
      <div class="detail-section-title">当前上下文</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "账户结果", value: `${formatNumber(filteredAccounts.length, 0)} / ${formatNumber(accounts.length, 0)}` },
          { label: "分类结果", value: `${formatNumber(filteredCategories.length, 0)} / ${formatNumber(categories.length, 0)}` },
          { label: "预算结果", value: `${formatNumber(filteredBudgets.length, 0)} / ${formatNumber(budgets.length, 0)}` },
          { label: "交易结果", value: `${formatNumber(visibleTransactions.length, 0)} / ${formatNumber(transactionTotalElements, 0)}` },
          { label: "共享账户", value: `${formatNumber(sharedAccounts, 0)} 个` },
          { label: "预算异常", value: `${formatNumber(alertBudgetCount, 0)} 项` },
          { label: "当前页收入", value: `${formatNumber(incomeTransactions, 0)} 条` },
          { label: "当前页支出", value: `${formatNumber(expenseTransactions, 0)} 条` }
        ])}
      </div>
    </div>
    ${renderAlertStrip(riskItems)}
  `;

  selectionHost.innerHTML = `
    ${renderResultOverview([
      { label: "批量账户", value: formatNumber(selectedAccountIds.length, 0), meta: selectedAccountIds.length > 0 ? "可执行批量启停" : "当前未勾选账户" },
      { label: "批量分类", value: formatNumber(selectedCategoryIds.length, 0), meta: selectedCategoryIds.length > 0 ? "可执行批量启停" : "当前未勾选分类" },
      { label: "批量预算", value: formatNumber(selectedBudgetIds.length, 0), meta: selectedBudgetIds.length > 0 ? "可执行批量启停" : "当前未勾选预算" }
    ])}
    <div class="detail-section">
      <div class="detail-section-title">当前选中对象</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "账户", value: selectedAccount ? `${selectedAccount.accountName} / ${selectedAccount.accountType}` : "未选中" },
          { label: "分类", value: selectedCategory ? `${selectedCategory.categoryName} / ${selectedCategory.categoryType}` : "未选中" },
          { label: "预算", value: selectedBudget ? `${selectedBudget.budgetName} / ${formatNumber(selectedBudget.amount)}` : "未选中" },
          { label: "交易", value: selectedTransaction ? `${selectedTransaction.merchantName || selectedTransaction.counterpartyName || `交易#${selectedTransaction.id}`} / ${formatNumber(selectedTransaction.amount)}` : "未选中" }
        ])}
      </div>
    </div>
    <div class="item-actions">
      <button class="mini-btn" type="button" data-action="create-account">新增账户</button>
      <button class="mini-btn" type="button" data-action="create-category">新增分类</button>
      <button class="mini-btn" type="button" data-action="create-budget">新增预算</button>
      <button class="mini-btn" type="button" data-action="create-transaction">新增交易</button>
    </div>
  `;
  renderBusinessActionFeedback();
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
  const ruleAlerts = [
    ...(highPriorityRules.length > 0 ? [{ text: `当前有 ${formatNumber(highPriorityRules.length, 0)} 条高优先级规则，建议优先复核。`, tone: "warning" }] : []),
    ...(disabledRules > 0 ? [{ text: `当前有 ${formatNumber(disabledRules, 0)} 条停用规则，需确认是否应恢复。`, tone: "info" }] : []),
    ...(allRules.length === 0 ? [{ text: "当前没有规则数据，风控链路仍未完整接通。", tone: "warning" }] : [])
  ];
  const notificationAlerts = [
    ...(criticalNotifications.length > 0 ? [{ text: `存在 ${formatNumber(criticalNotifications.length, 0)} 条高等级通知，应优先处理。`, tone: "danger" }] : []),
    ...(unreadNotifications > 0 ? [{ text: `当前仍有 ${formatNumber(unreadNotifications, 0)} 条未读通知待处理。`, tone: "warning" }] : []),
    ...(notificationsPage.length === 0 ? [{ text: "当前页没有通知数据，建议先刷新通知列表。", tone: "info" }] : [])
  ];

  rulesHost.innerHTML = `
    ${renderResultOverview([
      { label: "规则总数", value: formatNumber(allRules.length, 0), meta: "当前家庭全部规则", tone: allRules.length > 0 ? "success" : "warning" },
      { label: "启用规则", value: formatNumber(enabledRules, 0), meta: `启用率 ${allRules.length > 0 ? formatNumber((enabledRules / allRules.length) * 100) : "0"}%`, tone: enabledRules > 0 ? "success" : "warning" },
      { label: "高优先级", value: formatNumber(highPriorityRules.length, 0), meta: "优先关注可能影响通知产出的规则", tone: highPriorityRules.length > 0 ? "warning" : "success" },
      { label: "当前筛选", value: formatNumber(filteredRules.length, 0), meta: ruleQuickFilter === "high" ? "当前仅看高优先级规则" : "当前展示规则筛选结果" }
    ])}
    ${renderAlertStrip(ruleAlerts)}
    <div class="detail-section">
      <div class="detail-section-title">规则状态</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "当前筛选命中", value: `${formatNumber(filteredRules.length, 0)} 条` },
          { label: "停用规则", value: `${formatNumber(allRules.length - enabledRules, 0)} 条` },
          { label: "规则类型", value: `${formatNumber(new Set(allRules.map((item) => String(item.ruleType || "").trim()).filter(Boolean)).size, 0)} 类` },
          { label: "重点提示", value: highPriorityRules.length > 0 ? "建议优先复核高优先级规则" : "当前无高优先级堆积" }
        ])}
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="rules-open-all">查看全部规则</button>
        <button class="mini-btn" type="button" data-action="rules-open-enabled">查看启用规则</button>
        <button class="mini-btn" type="button" data-action="rules-open-high-priority">查看高优先级规则</button>
      </div>
    </div>
  `;

  notificationsHost.innerHTML = `
    ${renderResultOverview([
      { label: "当前页通知", value: formatNumber(notificationsPage.length, 0), meta: `总计 ${formatNumber(notificationsTotalElements || notificationsPage.length, 0)} 条` },
      { label: "未读通知", value: formatNumber(unreadNotifications, 0), meta: "建议先处理未读消息", tone: unreadNotifications > 0 ? "warning" : "success" },
      { label: "规则来源", value: formatNumber(ruleSourceNotifications, 0), meta: "便于追踪规则评估产出" },
      { label: "高等级通知", value: formatNumber(criticalNotifications.length, 0), meta: "高等级消息需要优先处理", tone: criticalNotifications.length > 0 ? "danger" : "success" }
    ])}
    ${renderAlertStrip(notificationAlerts)}
    <div class="detail-section">
      <div class="detail-section-title">最近动态</div>
      <div class="detail-descriptions">
        ${renderDescriptionPairs([
          { label: "最近通知", value: latestNotification ? summarizeText(latestNotification.title, 28) : "暂无通知" },
          { label: "通知等级", value: latestNotification?.levelCode || "-" },
          { label: "来源类型", value: latestNotification?.sourceType || "-" },
          { label: "创建时间", value: latestNotification ? formatDateTime(latestNotification.createdAt) : "-" }
        ])}
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="notifications-open-all">查看全部通知</button>
        <button class="mini-btn" type="button" data-action="notifications-open-unread">查看未读通知</button>
        <button class="mini-btn" type="button" data-action="notifications-open-rule-source">查看规则来源通知</button>
      </div>
    </div>
  `;
  stateHost.innerHTML = `
    ${renderResultOverview([
      { label: "当前判断", value: unreadNotifications > 0 || highPriorityRules.length > 0 ? "存在待处理风险" : "状态稳定", meta: unreadNotifications > 0 || highPriorityRules.length > 0 ? "建议先看未读通知和高优先级规则" : "可进入常规巡检", tone: riskTone },
      { label: "最近评估", value: latestRuleEvaluation ? "已执行" : "未执行", meta: latestRuleEvaluation ? `触发 ${formatNumber(latestRuleEvaluation.triggeredRuleCount, 0)} / 通知 ${formatNumber(latestRuleEvaluation.generatedNotificationCount, 0)}` : "尚未执行本轮评估", tone: latestRuleEvaluation ? "success" : "warning" },
      { label: "高等级通知", value: formatNumber(criticalNotifications.length, 0), meta: "高等级越多，当前压力越高", tone: criticalNotifications.length > 0 ? "danger" : "success" }
    ])}
    ${renderAlertStrip([
      { text: unreadNotifications > 0 || highPriorityRules.length > 0 ? "当前仍存在待处理风险项，建议先看未读通知和高优先级规则。" : "当前规则与通知状态相对稳定，可以进入常规巡检。", tone: riskTone }
    ])}
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
  const analysisReady = Boolean(latestSummary);
  const importReadyForUse = Boolean(latestImportRecord && !isImportFailed(latestImportStatus));
  const businessReady = Boolean(accounts.length || categories.length || budgets.length || transactionTotalElements);
  const rulesReady = Boolean(allRules.length || notificationsPage.length);
  const dashboardReadyCount = [importReadyForUse, analysisReady, businessReady, rulesReady].filter(Boolean).length;
  const latestBusinessActionLabel = latestBusinessAction
    ? `${latestBusinessAction.scope}${latestBusinessAction.operation}`
    : "暂无";
  const latestBusinessActionMeta = latestBusinessAction
    ? `${latestBusinessAction.target} / ${formatDateTime(latestBusinessAction.time)}`
    : "尚未执行业务维护动作";
  const recentCriticalNotification = notificationsPage.find((item) => includesKeyword(item.levelCode, "HIGH") || includesKeyword(item.levelCode, "CRITICAL")) || null;
  const dashboardChecks = [
    {
      label: "导入链路",
      ready: importReadyForUse,
      danger: Boolean(latestImportRecord && isImportFailed(latestImportStatus)),
      meta: latestImportRecord ? `${latestImportQuality?.label || "待确认"} / ${latestImportStatus || "未知"}` : "尚未执行导入",
      action: "dashboard-open-import-issues"
    },
    {
      label: "分析链路",
      ready: analysisReady,
      danger: Boolean(latestSummary && (worldBankPoints === 0 || fredPoints === 0)),
      meta: analysisReady ? `零售 ${formatNumber(retailOverview.totalRecords, 0)} / 世行 ${formatNumber(worldBankPoints, 0)} / FRED ${formatNumber(fredPoints, 0)}` : "尚未刷新分析汇总",
      action: "dashboard-open-analysis-anomalies"
    },
    {
      label: "业务链路",
      ready: businessReady,
      danger: budgetAlerts > 0,
      meta: `账户 ${formatNumber(accounts.length, 0)} / 分类 ${formatNumber(categories.length, 0)} / 预算异常 ${formatNumber(budgetAlerts, 0)}`,
      action: "dashboard-open-exceeded-budgets"
    },
    {
      label: "规则通知",
      ready: rulesReady,
      danger: unreadNotifications > 0 || highPriorityRules.length > 0,
      meta: `规则 ${formatNumber(allRules.length, 0)} / 未读 ${formatNumber(unreadNotifications, 0)} / 高优先级 ${formatNumber(highPriorityRules.length, 0)}`,
      action: "dashboard-open-rule-notifications"
    }
  ];
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
  const groupedTodoSections = [
    {
      title: "数据与分析",
      items: [...importIssues, ...analysisIssues].slice(0, 4)
    },
    {
      title: "业务与预算",
      items: exceededBudgetItems.slice(0, 3).map(({ budget, usage }) => ({
        tone: usage?.exceeded ? "danger" : "warning",
        label: usage?.exceeded ? "预算超支" : "预算预警",
        text: budget.budgetName,
        meta: `已支出 ${formatNumber(usage?.spentAmount)} / 剩余 ${formatNumber(usage?.remainingAmount)}`,
        count: "业务",
        action: "dashboard-open-exceeded-budgets"
      }))
    },
    {
      title: "规则与通知",
      items: [
        ...unreadTodoNotifications.slice(0, 2).map((item) => ({
          tone: "warning",
          label: "未读通知",
          text: item.title,
          meta: `${formatDateTime(item.createdAt)} / ${item.sourceType || "来源未标记"}`,
          count: "通知",
          action: "dashboard-open-unread-notifications"
        })),
        ...highPriorityRules.slice(0, 2).map((item) => ({
          tone: "info",
          label: "高优先级规则",
          text: item.ruleName,
          meta: `${item.ruleType || "类型未标记"} / 优先级 ${formatNumber(item.priority, 0)}`,
          count: "规则",
          action: "dashboard-open-high-priority-rules"
        }))
      ].slice(0, 4)
    }
  ];
  const systemSnapshotItems = [
    {
      label: "最近导入",
      value: latestImportRecord?.result?.importBatchId ? `批次 ${formatNumber(latestImportRecord.result.importBatchId, 0)}` : "未执行",
      meta: latestImportStatus || "等待导入"
    },
    {
      label: "最新分析",
      value: analysisReady ? "已生成" : "未生成",
      meta: analysisReady ? `零售 ${formatNumber(retailOverview.totalRecords, 0)} / 世行 ${formatNumber(worldBankPoints, 0)} / FRED ${formatNumber(fredPoints, 0)}` : "等待刷新分析汇总"
    },
    {
      label: "最近业务操作",
      value: latestBusinessActionLabel,
      meta: latestBusinessActionMeta
    },
    {
      label: "规则评估",
      value: latestRuleEvaluation ? "本轮已执行" : "未执行",
      meta: latestRuleEvaluation ? `触发 ${formatNumber(latestRuleEvaluation.triggeredRuleCount, 0)} / 通知 ${formatNumber(latestRuleEvaluation.generatedNotificationCount, 0)}` : "等待手动执行规则评估"
    }
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
      <div class="result-card ${dashboardReadyCount === dashboardChecks.length ? "success" : "warning"}">
        <div class="result-card-label">首页就绪度</div>
        <div class="result-card-value">${formatNumber(dashboardReadyCount, 0)}/${formatNumber(dashboardChecks.length, 0)}</div>
        <div class="result-card-meta">${dashboardReadyCount === dashboardChecks.length ? "关键模块都已接通" : "仍有模块待刷新或待处理"}</div>
      </div>
    </div>
    <div class="summary-item">
      <strong>首页关键检查</strong>
      <div class="acceptance-check-grid">
        ${dashboardChecks.map((item) => {
          const tone = item.danger ? "danger" : (item.ready ? "success" : "warning");
          const stateText = item.danger ? "异常" : (item.ready ? "就绪" : "待完成");
          return `
            <button class="acceptance-check-item ${tone}" type="button" data-action="${item.action}">
              <div class="acceptance-check-head">
                <strong>${escapeHtml(item.label)}</strong>
                <span class="status-chip ${item.danger ? "danger" : (item.ready ? "enabled" : "warning")}">${stateText}</span>
              </div>
              <div class="acceptance-check-meta">${escapeHtml(item.meta)}</div>
            </button>
          `;
        }).join("")}
      </div>
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
        <div>最近业务动作：${escapeHtml(latestBusinessActionLabel)}</div>
        <div class="action-row">
          <button class="mini-btn" type="button" data-view="business">打开业务管理</button>
          <button class="mini-btn" type="button" data-view="rules">打开规则通知</button>
        </div>
      </div>
      <div class="toolbar-card">
        <div class="toolbar-title">最近联动动作</div>
        <div>业务操作：${escapeHtml(latestBusinessActionMeta)}</div>
        <div>规则评估：${latestRuleEvaluation ? `触发 ${formatNumber(latestRuleEvaluation.triggeredRuleCount, 0)} / 通知 ${formatNumber(latestRuleEvaluation.generatedNotificationCount, 0)}` : "尚未执行本轮规则评估"}</div>
        <div>${recentCriticalNotification ? `高等级通知：${escapeHtml(summarizeText(recentCriticalNotification.title, 26))}` : "当前没有高等级通知堆积"}</div>
        <div class="action-row">
          <button class="mini-btn" type="button" data-action="dashboard-evaluate-rules">执行规则评估</button>
          <button class="mini-btn" type="button" data-action="business-feedback-open-scope">打开业务结果</button>
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
      <strong>跨模块待办分组</strong>
      <div class="toolbar-grid dashboard-grid">
        ${groupedTodoSections.map((section) => `
          <div class="toolbar-card">
            <div class="toolbar-title">${escapeHtml(section.title)}</div>
            <div class="todo-list">
              ${section.items.length > 0 ? section.items.map((item) => `
                <button class="todo-item ${item.tone}" type="button" data-action="${item.action}">
                  <span class="todo-item-main">
                    <span class="todo-item-header">
                      <span class="todo-item-label">${escapeHtml(item.label)}</span>
                      <span class="todo-item-count">${escapeHtml(item.count || "-")}</span>
                    </span>
                    <span class="todo-item-text">${escapeHtml(item.text)}</span>
                    <span class="todo-item-meta">${escapeHtml(item.meta)}</span>
                  </span>
                </button>
              `).join("") : '<div class="todo-empty">当前没有需要优先处理的事项</div>'}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="summary-item">
      <strong>最近操作与系统快照</strong>
      <div class="detail-descriptions">
        ${renderDescriptionPairs(systemSnapshotItems)}
      </div>
      <div class="action-row">
        <button class="mini-btn" type="button" data-action="dashboard-open-import-issues">查看导入状态</button>
        <button class="mini-btn" type="button" data-action="dashboard-open-analysis-anomalies">查看分析快照</button>
        <button class="mini-btn" type="button" data-action="business-feedback-open-scope">查看最近业务结果</button>
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
          <button class="mini-btn" type="button" data-view="acceptance">查看验收联通</button>
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
  const highlightedByAction = isLatestBusinessActionTarget("账户", item.id);
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
          ${highlightedByAction ? '<span class="status-chip warning">最近受影响</span>' : ""}
        </div>
      </div>
      ${highlightedByAction ? `<div class="summary-item"><strong>最近操作</strong><div>${escapeHtml(latestBusinessAction.operation)}：${escapeHtml(latestBusinessAction.detail || "-")}</div></div>` : ""}
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
  renderTopStats();
  renderHeaderAndSupportPanels();
  if (!items || items.length === 0) {
    updateAccountsStats([]);
    renderEmptyBoard("accountList", token ? (hasActiveAccountFilters() ? "当前筛选条件下未找到账户，请调整条件或重置筛选" : "当前家庭暂无账户数据") : "请先登录并选择家庭");
    renderAccountDetail(null);
    renderBusinessMetrics();
    renderBusinessWorkspacePanels();
    return;
  }
  host.classList.remove("empty-board");
  updateAccountsStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedAccountIds.includes(Number(item.id)));
  const totalBalance = items.reduce((sum, item) => sum + Number(item.currentBalance || 0), 0);
  const creditCount = items.filter((item) => includesKeyword(item.accountType, "CREDIT")).length;
  const disabledCount = items.filter((item) => Number(item.status) !== 1).length;
  const recentActionMessage = getLatestBusinessActionListMessage("账户");
  const recentActionCount = items.filter((item) => isLatestBusinessActionTarget("账户", item.id)).length;
  host.innerHTML = `
    ${renderBatchToolbar("account", selectedAccountIds.length, items.length, { enable: "启用", disable: "停用" })}
    ${renderResultOverview([
      { label: "当前结果总余额", value: formatNumber(totalBalance), meta: `覆盖 ${formatNumber(items.length, 0)} 个账户` },
      { label: "信用账户", value: formatNumber(creditCount, 0), meta: "便于检查授信类账户" },
      { label: "停用账户", value: formatNumber(disabledCount, 0), meta: disabledCount > 0 ? "建议确认是否仍需保留" : "当前无停用账户", tone: disabledCount > 0 ? "warning" : "" },
      ...(recentActionMessage ? [{ label: "最近操作", value: formatNumber(recentActionCount, 0), meta: recentActionMessage, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
    ])}
    ${renderAlertStrip([
      ...(disabledCount > 0 ? [{ text: `当前结果中有 ${disabledCount} 个停用账户，可批量启用或清理`, tone: "warning" }] : []),
      ...(items.some((item) => Number(item.isShared) === 1) ? [{ text: "包含共享账户，适合优先检查成员权限与归属", tone: "info" }] : []),
      ...(recentActionMessage ? [{ text: `账户列表最近操作：${recentActionMessage}`, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
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
          <div class="data-table-row accounts-table-row ${item.id === selectedAccountId ? "is-active" : ""} ${isLatestBusinessActionTarget("账户", item.id) ? "is-active" : ""}" data-action="select-account" data-account-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-account-select" data-account-id="${item.id}" ${selectedAccountIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">账户名称</span>
              <span class="data-cell-value">${escapeHtml(item.accountName)}</span>
              <span class="data-cell-meta">${formatTableMeta(item.institutionName || "-", formatMemberRef(item.ownerMemberId), isLatestBusinessActionTarget("账户", item.id) ? "最近受影响" : "")}</span>
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
  renderBusinessWorkspacePanels();
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
  const highlightedByAction = isLatestBusinessActionTarget("分类", item.id);
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
          ${highlightedByAction ? '<span class="status-chip warning">最近受影响</span>' : ""}
        </div>
      </div>
      ${highlightedByAction ? `<div class="summary-item"><strong>最近操作</strong><div>${escapeHtml(latestBusinessAction.operation)}：${escapeHtml(latestBusinessAction.detail || "-")}</div></div>` : ""}
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
  renderTopStats();
  renderHeaderAndSupportPanels();
  if (!items || items.length === 0) {
    updateCategoriesStats([]);
    renderEmptyBoard("categoryList", token ? (hasActiveCategoryFilters() ? "当前筛选条件下未找到分类，请调整条件或重置筛选" : "当前家庭暂无分类数据") : "请先登录并选择家庭");
    renderCategoryDetail(null);
    renderBusinessMetrics();
    renderBusinessWorkspacePanels();
    return;
  }
  host.classList.remove("empty-board");
  updateCategoriesStats(items);
  const allSelected = items.length > 0 && items.every((item) => selectedCategoryIds.includes(Number(item.id)));
  const expenseCount = items.filter((item) => includesKeyword(item.categoryType, "EXPENSE")).length;
  const rootCount = items.filter((item) => !item.parentId).length;
  const disabledCount = items.filter((item) => Number(item.enabled) !== 1).length;
  const recentActionMessage = getLatestBusinessActionListMessage("分类");
  const recentActionCount = items.filter((item) => isLatestBusinessActionTarget("分类", item.id)).length;
  host.innerHTML = `
    ${renderBatchToolbar("category", selectedCategoryIds.length, items.length, { enable: "启用", disable: "停用" })}
    ${renderResultOverview([
      { label: "支出分类", value: formatNumber(expenseCount, 0), meta: `当前结果 ${formatNumber(items.length, 0)} 项` },
      { label: "根分类", value: formatNumber(rootCount, 0), meta: "便于检查分类层级结构" },
      { label: "停用分类", value: formatNumber(disabledCount, 0), meta: disabledCount > 0 ? "建议确认是否仍被预算或交易引用" : "当前无停用项", tone: disabledCount > 0 ? "warning" : "" },
      ...(recentActionMessage ? [{ label: "最近操作", value: formatNumber(recentActionCount, 0), meta: recentActionMessage, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
    ])}
    ${renderAlertStrip([
      ...(disabledCount > 0 ? [{ text: `当前结果中有 ${disabledCount} 个停用分类，建议优先核对引用关系`, tone: "warning" }] : []),
      ...(rootCount === 0 && items.length > 0 ? [{ text: "当前结果未包含根分类，可能筛选到了某个子层级", tone: "info" }] : []),
      ...(recentActionMessage ? [{ text: `分类列表最近操作：${recentActionMessage}`, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
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
          <div class="data-table-row categories-table-row ${item.id === selectedCategoryId ? "is-active" : ""} ${isLatestBusinessActionTarget("分类", item.id) ? "is-active" : ""}" data-action="select-category" data-category-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-category-select" data-category-id="${item.id}" ${selectedCategoryIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">分类名称</span>
              <span class="data-cell-value">${escapeHtml(item.categoryName)}</span>
              <span class="data-cell-meta">${formatTableMeta(formatCategoryRef(item.parentId), item.scopeType || "-", isLatestBusinessActionTarget("分类", item.id) ? "最近受影响" : "")}</span>
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
  renderBusinessWorkspacePanels();
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
  const actionHost = byId("budgetActionBoard");
  const alertBudgets = budgets
    .map((budget) => ({ budget, usage: getBudgetUsageItem(budget.id) }))
    .filter(({ usage }) => usage?.alertTriggered || usage?.exceeded)
    .sort((left, right) => Number(right.usage?.spentAmount || 0) - Number(left.usage?.spentAmount || 0))
    .slice(0, 3);
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧预算查看详情</div>';
    if (actionHost) {
      actionHost.innerHTML = alertBudgets.length > 0 ? `
        ${renderResultOverview([
          { label: "异常预算", value: formatNumber(alertBudgets.length, 0), meta: "当前家庭存在预算预警或超支" },
          { label: "建议动作", value: "优先检查异常项", meta: "从左侧选择异常预算可查看详细执行情况", tone: "warning" }
        ])}
        ${renderAlertStrip(alertBudgets.map(({ budget, usage }) => ({
          text: `${budget.budgetName}：${usage?.exceeded ? "已超支" : "预警中"}，已支出 ${formatNumber(usage?.spentAmount)}`,
          tone: usage?.exceeded ? "danger" : "warning"
        })))}
      ` : '<div class="summary-item">当前没有预算异常项，右侧将显示所选预算的处置建议</div>';
    }
    return;
  }
  const usage = getBudgetUsageItem(item.id);
  const spentAmount = Number(usage?.spentAmount || 0);
  const budgetAmount = Number(usage?.budgetAmount ?? item.amount ?? 0);
  const usageRatio = budgetAmount > 0 ? spentAmount / budgetAmount : 0;
  const statusText = usage?.exceeded ? "已超支" : usage?.alertTriggered ? "已预警" : "正常";
  const highlightedByAction = isLatestBusinessActionTarget("预算", item.id);
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
          ${highlightedByAction ? '<span class="status-chip warning">最近受影响</span>' : ""}
        </div>
      </div>
      ${highlightedByAction ? `<div class="summary-item"><strong>最近操作</strong><div>${escapeHtml(latestBusinessAction.operation)}：${escapeHtml(latestBusinessAction.detail || "-")}</div></div>` : ""}
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
  if (actionHost) {
    actionHost.innerHTML = `
      ${renderResultOverview([
        { label: "当前预算状态", value: statusText, meta: usage?.exceeded ? "已超过预算额度" : usage?.alertTriggered ? "已到达预警线" : "当前执行平稳", tone: usage?.exceeded ? "danger" : (usage?.alertTriggered ? "warning" : "") },
        { label: "执行比例", value: budgetAmount > 0 ? `${formatNumber(usageRatio * 100)}%` : "-", meta: `已支出 ${formatNumber(spentAmount)} / 预算 ${formatNumber(budgetAmount)}` },
        { label: "同页异常预算", value: formatNumber(alertBudgets.length, 0), meta: alertBudgets.length > 0 ? "下方已列出当前最需要处理的预算" : "当前没有其他异常预算", tone: alertBudgets.length > 0 ? "warning" : "" }
      ])}
      ${renderAlertStrip([
        ...(usage?.exceeded ? [{ text: "该预算已超支，建议先调整预算金额或复核异常支出。", tone: "danger" }] : []),
        ...(usage?.alertTriggered && !usage?.exceeded ? [{ text: "该预算已到预警线，建议在本周期内限制新增支出。", tone: "warning" }] : []),
        ...(Number(item.enabled) !== 1 ? [{ text: "该预算当前处于停用状态，确认是否还需要继续维护。", tone: "info" }] : []),
        ...(!usage?.alertTriggered && !usage?.exceeded ? [{ text: "该预算当前执行正常，可继续作为对照组观察。", tone: "info" }] : [])
      ])}
      <div class="detail-section">
        <div class="detail-section-title">异常预算摘要</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs(
            alertBudgets.length > 0
              ? alertBudgets.map(({ budget, usage: riskUsage }) => ({
                  label: budget.budgetName,
                  value: `${riskUsage?.exceeded ? "超支" : "预警"} / 已支出 ${formatNumber(riskUsage?.spentAmount)}`
                }))
              : [{ label: "当前结果", value: "暂无其他异常预算" }]
          )}
        </div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="edit-budget" data-budget-id="${item.id}">调整预算</button>
        <button class="mini-btn" type="button" data-action="toggle-budget" data-budget-id="${item.id}" data-enabled="${item.enabled}">${Number(item.enabled) === 1 ? "停用预算" : "启用预算"}</button>
        <button class="mini-btn" type="button" data-action="create-budget">新增预算</button>
      </div>
    `;
  }
}

function renderBudgets(items) {
  const host = byId("budgetList");
  selectedBudgetIds = syncSelectionToVisible(selectedBudgetIds, items);
  renderBudgetFilterSummary(items?.length || 0, budgets.length);
  renderTopStats();
  renderHeaderAndSupportPanels();
  if (!items || items.length === 0) {
    updateBudgetsStats([]);
    renderEmptyBoard("budgetList", token ? (hasActiveBudgetFilters() ? "当前筛选条件下未找到预算，请调整条件或重置筛选" : "当前家庭暂无预算数据") : "请先登录并选择家庭");
    renderBudgetDetail(null);
    renderBusinessMetrics();
    renderBusinessWorkspacePanels();
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
  const recentActionMessage = getLatestBusinessActionListMessage("预算");
  const recentActionCount = items.filter((item) => isLatestBusinessActionTarget("预算", item.id)).length;
  host.innerHTML = `
    ${renderBatchToolbar("budget", selectedBudgetIds.length, items.length, { enable: "启用", disable: "停用" })}
    ${renderResultOverview([
      { label: "预算总额", value: formatNumber(totalBudgetAmount), meta: `覆盖 ${formatNumber(items.length, 0)} 个预算` },
      { label: "预警预算", value: formatNumber(alertCount, 0), meta: "建议优先复核支出进度", tone: alertCount > 0 ? "warning" : "" },
      { label: "超支预算", value: formatNumber(exceededCount, 0), meta: exceededCount > 0 ? "属于当前待处理项" : "当前无超支项", tone: exceededCount > 0 ? "danger" : "" },
      ...(recentActionMessage ? [{ label: "最近操作", value: formatNumber(recentActionCount, 0), meta: recentActionMessage, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
    ])}
    ${renderAlertStrip([
      ...(exceededCount > 0 ? [{ text: `当前结果中有 ${exceededCount} 个超支预算，建议先处理异常预算`, tone: "danger" }] : []),
      ...(alertCount > exceededCount ? [{ text: `另有 ${alertCount - exceededCount} 个预算处于预警线附近`, tone: "warning" }] : []),
      ...(recentActionMessage ? [{ text: `预算列表最近操作：${recentActionMessage}`, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
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
          <div class="data-table-row budgets-table-row ${item.id === selectedBudgetId ? "is-active" : ""} ${isLatestBusinessActionTarget("预算", item.id) ? "is-active" : ""}" data-action="select-budget" data-budget-id="${item.id}">
            <div class="data-cell data-cell-checkbox">
              <input type="checkbox" data-action="toggle-budget-select" data-budget-id="${item.id}" ${selectedBudgetIds.includes(Number(item.id)) ? "checked" : ""}>
            </div>
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">预算名称</span>
              <span class="data-cell-value">${escapeHtml(item.budgetName)}</span>
              <span class="data-cell-meta">${formatTableMeta(formatCategoryRef(item.categoryId), formatMemberRef(item.createdByMemberId), isLatestBusinessActionTarget("预算", item.id) ? "最近受影响" : "")}</span>
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
  renderBusinessWorkspacePanels();
}

function updateTransactionsStats(items) {
  const income = items.filter((item) => String(item.transactionType).toUpperCase() === "INCOME").length;
  const expense = items.filter((item) => String(item.transactionType).toUpperCase() === "EXPENSE").length;
  const missingCategory = items.filter((item) => !item.categoryId).length;
  byId("transactionsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(transactionTotalElements, 0)}</div>
    <div class="stats-pill">收入：${formatNumber(income, 0)}</div>
    <div class="stats-pill">支出：${formatNumber(expense, 0)}</div>
    <div class="stats-pill">缺分类：${formatNumber(missingCategory, 0)}</div>
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
  const auditHost = byId("transactionAuditBoard");
  const visibleTransactions = transactionItems || [];
  const missingCategoryCount = visibleTransactions.filter((transaction) => !transaction.categoryId).length;
  const missingNoteCount = visibleTransactions.filter((transaction) => !String(transaction.note || "").trim() && !String(transaction.externalTradeNo || "").trim()).length;
  const transferCount = visibleTransactions.filter((transaction) => includesKeyword(transaction.transactionType, "TRANSFER")).length;
  const suspiciousTransactions = [...visibleTransactions]
    .sort((left, right) => Math.abs(Number(right.amount || 0)) - Math.abs(Number(left.amount || 0)))
    .slice(0, 3);
  const latestMonthly = (transactionMonthlySummary || [])[0] || null;
  if (!item) {
    host.innerHTML = '<div class="summary-item">点击左侧交易查看详情</div>';
    if (auditHost) {
      auditHost.innerHTML = suspiciousTransactions.length > 0 ? `
        ${renderResultOverview([
          { label: "当前页交易", value: formatNumber(visibleTransactions.length, 0), meta: `总计 ${formatNumber(transactionTotalElements, 0)} 条` },
          { label: "待核查", value: formatNumber(missingCategoryCount + missingNoteCount, 0), meta: "缺少分类或补充说明的记录应优先复核", tone: missingCategoryCount + missingNoteCount > 0 ? "warning" : "" },
          { label: "最大金额", value: formatNumber(Math.abs(Number(suspiciousTransactions[0]?.amount || 0))), meta: "以下列出当前页金额最大的几条交易" }
        ])}
        ${renderAlertStrip([
          ...(missingCategoryCount > 0 ? [{ text: `有 ${missingCategoryCount} 条交易缺少分类，统计口径可能失真`, tone: "warning" }] : []),
          ...(missingNoteCount > 0 ? [{ text: `有 ${missingNoteCount} 条交易缺少备注或外部单号，追踪性较弱`, tone: "info" }] : [])
        ])}
      ` : '<div class="summary-item">当前没有交易数据，加载交易后这里会显示核查结论</div>';
    }
    return;
  }
  const hasCategory = Boolean(item.categoryId);
  const hasReference = Boolean(String(item.note || "").trim() || String(item.externalTradeNo || "").trim());
  const auditTone = !hasCategory ? "danger" : (!hasReference ? "warning" : "");
  const highlightedByAction = isLatestBusinessActionTarget("交易", item.id);
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
          ${highlightedByAction ? '<span class="status-chip warning">最近受影响</span>' : ""}
        </div>
      </div>
      ${highlightedByAction ? `<div class="summary-item"><strong>最近操作</strong><div>${escapeHtml(latestBusinessAction.operation)}：${escapeHtml(latestBusinessAction.detail || "-")}</div></div>` : ""}
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
  if (auditHost) {
    auditHost.innerHTML = `
      ${renderResultOverview([
        { label: "核查状态", value: !hasCategory ? "缺少分类" : (!hasReference ? "补充信息不足" : "信息完整"), meta: !hasCategory ? "建议先补齐分类，避免影响预算与统计分析" : (!hasReference ? "建议补充备注或外部单号" : "当前记录可直接用于联调与展示"), tone: auditTone },
        { label: "当前页转账", value: formatNumber(transferCount, 0), meta: "转账类交易适合重点检查账户流向" },
        { label: "最近月净额", value: latestMonthly ? formatNumber(latestMonthly.netAmount) : "-", meta: latestMonthly ? `${latestMonthly.month} 收支结果` : "暂无月报汇总" }
      ])}
      ${renderAlertStrip([
        ...(!hasCategory ? [{ text: "当前选中交易没有分类，预算归集和报表统计会受影响。", tone: "danger" }] : []),
        ...(!hasReference ? [{ text: "当前选中交易缺少备注或外部单号，建议补充追踪信息。", tone: "warning" }] : []),
        ...(includesKeyword(item.transactionType, "TRANSFER") ? [{ text: "当前为转账交易，请核对转出和转入账户是否匹配。", tone: "info" }] : []),
        ...(latestMonthly && Number(latestMonthly.netAmount || 0) < 0 ? [{ text: `最近月份 ${latestMonthly.month} 净额为负，建议关注支出压力。`, tone: "warning" }] : [])
      ])}
      <div class="detail-section">
        <div class="detail-section-title">可疑交易摘要</div>
        <div class="detail-descriptions">
          ${renderDescriptionPairs(
            suspiciousTransactions.length > 0
              ? suspiciousTransactions.map((transaction) => ({
                  label: transaction.merchantName || transaction.counterpartyName || `交易#${transaction.id}`,
                  value: `${formatNumber(transaction.amount)} / ${transaction.transactionType}`
                }))
              : [{ label: "当前结果", value: "暂无需要核查的交易" }]
          )}
        </div>
      </div>
      <div class="item-actions">
        <button class="mini-btn" type="button" data-action="edit-transaction" data-transaction-id="${item.id}">修正交易</button>
        <button class="mini-btn" type="button" data-action="create-transaction">新增交易</button>
      </div>
    `;
  }
}

function renderTransactions(items) {
  const host = byId("transactionList");
  const pageSize = Number(byId("transactionPageSize")?.value || 8);
  const filteredItems = getFilteredTransactions(items || []);
  renderTransactionFilterSummary(filteredItems.length, (items || []).length);
  renderTopStats();
  renderHeaderAndSupportPanels();
  if (!filteredItems || filteredItems.length === 0) {
    updateTransactionsStats([]);
    renderEmptyBoard("transactionList", token ? "当前筛选条件下暂无交易数据" : "请先登录并选择家庭");
    renderTransactionDetail(null);
    renderBusinessMetrics();
    renderPager("transactionsPager", transactionPageIndex, transactionTotalPages, transactionTotalElements, pageSize, "transactions");
    renderBusinessWorkspacePanels();
    return;
  }
  host.classList.remove("empty-board");
  updateTransactionsStats(filteredItems);
  const missingCategoryCount = filteredItems.filter((item) => !item.categoryId).length;
  const missingReferenceCount = filteredItems.filter((item) => !String(item.note || "").trim() && !String(item.externalTradeNo || "").trim()).length;
  const largeAmountCount = filteredItems.filter((item) => Math.abs(Number(item.amount || 0)) >= 1000).length;
  const recentActionMessage = getLatestBusinessActionListMessage("交易");
  const recentActionCount = filteredItems.filter((item) => isLatestBusinessActionTarget("交易", item.id)).length;
  host.innerHTML = `
    ${renderResultOverview([
      { label: "当前页结果", value: formatNumber(filteredItems.length, 0), meta: `本页返回 ${formatNumber((items || []).length, 0)} 条` },
      { label: "缺少分类", value: formatNumber(missingCategoryCount, 0), meta: missingCategoryCount > 0 ? "建议优先补齐分类字段" : "当前结果分类完整", tone: missingCategoryCount > 0 ? "warning" : "" },
      { label: "大额交易", value: formatNumber(largeAmountCount, 0), meta: largeAmountCount > 0 ? "适合复核金额和账户流向" : "当前结果无大额记录" },
      ...(recentActionMessage ? [{ label: "最近操作", value: formatNumber(recentActionCount, 0), meta: recentActionMessage, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
    ])}
    ${renderAlertStrip([
      ...(missingCategoryCount > 0 ? [{ text: `当前结果中有 ${missingCategoryCount} 条交易缺少分类，建议先做数据修正`, tone: "warning" }] : []),
      ...(missingReferenceCount > 0 ? [{ text: `当前结果中有 ${missingReferenceCount} 条交易缺少备注或外部单号`, tone: "info" }] : []),
      ...(hasActiveTransactionFilters() ? [{ text: "当前列表已启用核查型筛选，适合逐条复核后继续编辑。", tone: "info" }] : []),
      ...(recentActionMessage ? [{ text: `交易列表最近操作：${recentActionMessage}`, tone: latestBusinessAction.success ? "info" : "danger" }] : [])
    ])}
    <div class="table-section-meta">
      <span>当前页显示 ${formatNumber(filteredItems.length, 0)} 条交易，共 ${formatNumber(transactionTotalElements, 0)} 条</span>
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
        ${filteredItems.map((item) => `
          <div class="data-table-row transactions-table-row ${item.id === selectedTransactionId ? "is-active" : ""} ${isLatestBusinessActionTarget("交易", item.id) ? "is-active" : ""}" data-action="select-transaction" data-transaction-id="${item.id}">
            <div class="data-cell data-cell-primary">
              <span class="data-cell-label">交易对象</span>
              <span class="data-cell-value">${escapeHtml(item.merchantName || item.counterpartyName || `交易#${item.id}`)}</span>
              <span class="data-cell-meta">${formatTableMeta(
                item.targetAccountId
                  ? `${formatAccountRef(item.accountId)} -> ${formatAccountRef(item.targetAccountId)}`
                  : formatAccountRef(item.accountId),
                item.categoryId ? formatCategoryRef(item.categoryId) : "",
                isLatestBusinessActionTarget("交易", item.id) ? "最近受影响" : ""
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
  const selected = filteredItems.find((item) => item.id === selectedTransactionId) || filteredItems[0];
  selectedTransactionId = selected?.id ?? null;
  renderTransactionDetail(selected || null);
  renderBusinessMetrics();
  renderBusinessWorkspacePanels();
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
    syncLatestBusinessActionSelection();
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
    recordBusinessAction({
      scope: "账户",
      operation: Number(status) === 1 ? "停用" : "启用",
      target: `账户#${accountId}`,
      detail: `已${Number(status) === 1 ? "停用" : "启用"}该账户，可继续核对列表状态和余额信息。`,
      tone: "info",
      success: true,
      entityId: accountId
    });
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`账户状态更新失败：${error.message}`, true);
    recordBusinessAction({ scope: "账户", operation: "状态更新", target: `账户#${accountId}`, detail: error.message, tone: "danger", success: false, entityId: accountId });
  }
}

async function deleteAccount(accountId) {
  if (!window.confirm("确认删除该账户吗？")) {
    return;
  }
  try {
    await api(`/api/accounts/${accountId}`, { method: "DELETE" });
    setBusinessStatus("账户已删除。");
    recordBusinessAction({ scope: "账户", operation: "删除", target: `账户#${accountId}`, detail: "账户已删除，建议检查共享关系与关联交易。", tone: "warning", success: true, entityId: accountId });
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`账户删除失败：${error.message}`, true);
    recordBusinessAction({ scope: "账户", operation: "删除", target: `账户#${accountId}`, detail: error.message, tone: "danger", success: false, entityId: accountId });
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
    recordBusinessAction({
      scope: "分类",
      operation: Number(enabled) === 1 ? "停用" : "启用",
      target: `分类#${categoryId}`,
      detail: `已${Number(enabled) === 1 ? "停用" : "启用"}该分类，建议核对预算与交易引用。`,
      tone: Number(enabled) === 1 ? "warning" : "info",
      success: true,
      entityId: categoryId
    });
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`分类状态更新失败：${error.message}`, true);
    recordBusinessAction({ scope: "分类", operation: "状态更新", target: `分类#${categoryId}`, detail: error.message, tone: "danger", success: false, entityId: categoryId });
  }
}

async function deleteCategory(categoryId) {
  if (!window.confirm("确认删除该分类吗？")) {
    return;
  }
  try {
    await api(`/api/categories/${categoryId}`, { method: "DELETE" });
    setBusinessStatus("分类已删除。");
    recordBusinessAction({ scope: "分类", operation: "删除", target: `分类#${categoryId}`, detail: "分类已删除，建议关注预算与交易是否仍引用该分类。", tone: "warning", success: true, entityId: categoryId });
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`分类删除失败：${error.message}`, true);
    recordBusinessAction({ scope: "分类", operation: "删除", target: `分类#${categoryId}`, detail: error.message, tone: "danger", success: false, entityId: categoryId });
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
    recordBusinessAction({
      scope: "预算",
      operation: Number(enabled) === 1 ? "停用" : "启用",
      target: `预算#${budgetId}`,
      detail: `已${Number(enabled) === 1 ? "停用" : "启用"}该预算，建议继续关注执行进度和预警状态。`,
      tone: Number(enabled) === 1 ? "warning" : "info",
      success: true,
      entityId: budgetId
    });
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`预算状态更新失败：${error.message}`, true);
    recordBusinessAction({ scope: "预算", operation: "状态更新", target: `预算#${budgetId}`, detail: error.message, tone: "danger", success: false, entityId: budgetId });
  }
}

async function deleteBudget(budgetId) {
  if (!window.confirm("确认删除该预算吗？")) {
    return;
  }
  try {
    await api(`/api/budgets/${budgetId}`, { method: "DELETE" });
    setBusinessStatus("预算已删除。");
    recordBusinessAction({ scope: "预算", operation: "删除", target: `预算#${budgetId}`, detail: "预算已删除，建议重新检查预算异常和月报口径。", tone: "warning", success: true, entityId: budgetId });
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`预算删除失败：${error.message}`, true);
    recordBusinessAction({ scope: "预算", operation: "删除", target: `预算#${budgetId}`, detail: error.message, tone: "danger", success: false, entityId: budgetId });
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
    recordBusinessAction({ scope: "交易", operation: "删除", target: `交易#${recordId}`, detail: "交易记录已删除，建议继续核查分类完整性与月报变化。", tone: "warning", success: true, entityId: recordId });
    transactionPageIndex = transactionPageIndex > 0 && transactionItems.length <= 1 ? transactionPageIndex - 1 : transactionPageIndex;
    await loadBusinessOverview();
  } catch (error) {
    setBusinessStatus(`交易记录删除失败：${error.message}`, true);
    recordBusinessAction({ scope: "交易", operation: "删除", target: `交易#${recordId}`, detail: error.message, tone: "danger", success: false, entityId: recordId });
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
  recordBusinessAction({ scope: "账户", operation: `批量${enabled ? "启用" : "停用"}`, target: "已选账户", detail: `已处理 ${formatNumber(selectedAccountIds.length, 0)} 个账户。`, count: selectedAccountIds.length, tone: "info", success: true, entityIds: [...selectedAccountIds] });
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
  recordBusinessAction({ scope: "账户", operation: "批量删除", target: "已选账户", detail: `已删除 ${formatNumber(selectedAccountIds.length, 0)} 个账户。`, count: selectedAccountIds.length, tone: "warning", success: true, entityIds: [...selectedAccountIds] });
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
  recordBusinessAction({ scope: "分类", operation: `批量${enabled ? "启用" : "停用"}`, target: "已选分类", detail: `已处理 ${formatNumber(selectedCategoryIds.length, 0)} 个分类。`, count: selectedCategoryIds.length, tone: enabled ? "info" : "warning", success: true, entityIds: [...selectedCategoryIds] });
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
  recordBusinessAction({ scope: "分类", operation: "批量删除", target: "已选分类", detail: `已删除 ${formatNumber(selectedCategoryIds.length, 0)} 个分类。`, count: selectedCategoryIds.length, tone: "warning", success: true, entityIds: [...selectedCategoryIds] });
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
  recordBusinessAction({ scope: "预算", operation: `批量${enabled ? "启用" : "停用"}`, target: "已选预算", detail: `已处理 ${formatNumber(selectedBudgetIds.length, 0)} 个预算。`, count: selectedBudgetIds.length, tone: enabled ? "info" : "warning", success: true, entityIds: [...selectedBudgetIds] });
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
  recordBusinessAction({ scope: "预算", operation: "批量删除", target: "已选预算", detail: `已删除 ${formatNumber(selectedBudgetIds.length, 0)} 个预算。`, count: selectedBudgetIds.length, tone: "warning", success: true, entityIds: [...selectedBudgetIds] });
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
      const response = await api(isEdit ? `/api/accounts/${selectedAccountId}` : "/api/accounts", {
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
      recordBusinessAction({ scope: "账户", operation: isEdit ? "编辑" : "新增", target: form.accountName || "账户", detail: isEdit ? "账户信息已更新。" : "账户已创建，可继续检查余额和共享设置。", tone: "info", success: true, entityId: response?.id || selectedAccountId });
    }

    if (businessFormType === "category") {
      const response = await api(isEdit ? `/api/categories/${selectedCategoryId}` : "/api/categories", {
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
      recordBusinessAction({ scope: "分类", operation: isEdit ? "编辑" : "新增", target: form.categoryName || "分类", detail: isEdit ? "分类信息已更新。" : "分类已创建，可继续检查层级和作用域。", tone: "info", success: true, entityId: response?.id || selectedCategoryId });
    }

    if (businessFormType === "budget") {
      const response = await api(isEdit ? `/api/budgets/${selectedBudgetId}` : "/api/budgets", {
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
      recordBusinessAction({ scope: "预算", operation: isEdit ? "编辑" : "新增", target: form.budgetName || "预算", detail: isEdit ? "预算信息已更新。" : "预算已创建，可继续检查执行和预警设置。", tone: "info", success: true, entityId: response?.id || selectedBudgetId });
    }

    if (businessFormType === "transaction") {
      const response = await api(isEdit ? `/api/transaction-records/${selectedTransactionId}` : "/api/transaction-records", {
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
      recordBusinessAction({ scope: "交易", operation: isEdit ? "编辑" : "新增", target: form.merchantName || form.counterpartyName || "交易", detail: isEdit ? "交易记录已更新。" : "交易记录已创建，可继续核查分类和备注完整性。", tone: "info", success: true, entityId: response?.id || selectedTransactionId });
    }

    closeBusinessForm();
    await loadBusinessOverview();
  } catch (error) {
    setBusinessFormStatus(`提交失败：${error.message}`, true);
    setBusinessStatus(`表单提交失败：${error.message}`, true);
    recordBusinessAction({ scope: businessFormType === "account" ? "账户" : businessFormType === "category" ? "分类" : businessFormType === "budget" ? "预算" : "交易", operation: businessFormMode === "edit" ? "编辑" : "新增", target: "表单提交", detail: error.message, tone: "danger", success: false });
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
  const visibleTotal = items?.length || 0;
  const read = (items || []).filter((item) => Number(item.readStatus) === 1).length;
  const unread = visibleTotal - read;
  const critical = (items || []).filter((item) => includesKeyword(item.levelCode, "HIGH") || includesKeyword(item.levelCode, "CRITICAL")).length;
  const ruleSource = (items || []).filter((item) => includesKeyword(item.sourceType, "RULE")).length;
  byId("notificationsStats").innerHTML = `
    <div class="stats-pill">总数：${formatNumber(notificationsTotalElements || visibleTotal, 0)}</div>
    <div class="stats-pill">当前页：${formatNumber(visibleTotal, 0)}</div>
    <div class="stats-pill">未读：${formatNumber(unread, 0)}</div>
    <div class="stats-pill">已读：${formatNumber(read, 0)}</div>
    <div class="stats-pill">高等级：${formatNumber(critical, 0)}</div>
    <div class="stats-pill">规则来源：${formatNumber(ruleSource, 0)}</div>
  `;
}

function renderNotifications(items) {
  const host = byId("notificationsList");
  selectedNotificationIds = syncSelectionToVisible(selectedNotificationIds, items);
  const pageSize = Number(byId("notificationPageSize")?.value || 8);
  renderHeaderAndSupportPanels();
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
  renderTopStats();
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
  renderInsightBoard("retailInsightBoard", buildRetailInsights(retailOverview), "暂无交易结构分析");
  renderInsightBoard("trendInsightBoard", buildTrendInsights(worldBankTrend, fredSeries), "暂无趋势解释");
  renderRaw(summary);
  renderAnalysisStateBoard("ready", summary);
  renderExecutiveDashboard();
  renderTopStats();
  renderHeaderAndSupportPanels();
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
  renderInsightBoard("retailInsightBoard", [], "暂无交易结构分析");
  renderInsightBoard("trendInsightBoard", [], "暂无趋势解释");
  renderRaw({ message: "waiting" });
  renderAnalysisStateBoard("idle", null);
  renderExecutiveDashboard();
  renderTopStats();
  renderHeaderAndSupportPanels();
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
    family: {
      eyebrow: "Identity And Family Context",
      title: "用户与家庭上下文",
      breadcrumb: "后台首页 / 用户与家庭",
      workspaceTag: "用户工作区",
      focus: "登录用户、家庭维度、成员关系与会话上下文",
      hint: "优先确认当前登录用户、选中家庭和成员关系是否正确"
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
    system: {
      eyebrow: "System And Operation Log",
      title: "系统与日志中心",
      breadcrumb: "后台首页 / 系统与日志",
      workspaceTag: "系统工作区",
      focus: "导入回执、分析生成、业务动作、规则触发与通知状态",
      hint: "重点核对最近事件时间线和系统闭环状态"
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
  setTextById("pageEyebrow", meta.eyebrow);
  setTextById("pageTitle", meta.title);
  setTextById("pageBreadcrumb", meta.breadcrumb);
  setTextById("pageWorkspaceTag", meta.workspaceTag);
  setTextById("pageFocus", meta.focus);
  setTextById("pageHint", meta.hint);
  setTextByIds(["pageTitleVisible"], meta.title);
  setTextByIds(["pageHintVisible"], meta.hint);
  setTextByIds(["pageBreadcrumbVisible"], meta.breadcrumb);
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
  applyViewContext(view);
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
  if (!token) {
    setImportStatuses("请先在左上角登录后台账号，再执行真实数据导入。", true);
    throw new Error("未登录，无法执行导入");
  }
  try {
    setImportStatuses("正在导入真实数据...");
    const response = await api(`/api/real-data-analysis/import${buildQuery(params)}`, {
      method: "POST"
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
  if (!token) {
    importHistory = [];
    renderImportHistory();
    renderImportHistoryDetail();
    setImportStatuses("请先登录后台账号，再查看导入历史。", true);
    return;
  }
  try {
    const items = await api("/api/real-data-analysis/imports");
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
  applyAnalysisParamMirrors();
  const params = getAnalysisParams();
  if (!token) {
    setImportStatuses("请先在左上角登录后台账号，再加载分析汇总。", true);
    renderAnalysisStateBoard("error", null, "当前未登录，无法读取分析汇总。");
    throw new Error("未登录，无法加载分析汇总");
  }
  try {
    setImportStatuses("正在加载分析汇总...");
    renderAnalysisStateBoard("loading", null);
    const response = await api(`/api/real-data-analysis/defense-summary${buildQuery(params)}`);
    renderSummary(response);
    setImportStatuses("分析汇总已刷新。");
    return response;
  } catch (error) {
    setImportStatuses(`汇总加载失败：${error.message}`, true);
    renderAnalysisStateBoard("error", null, error.message);
    throw error;
  }
}

function openAuthPage() {
  window.location.href = "/login.html";
}

function handleLogout() {
  clearSession();
  setImportStatuses("已退出当前登录，请重新进入登录/注册页认证。");
  switchView("analysis");
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
      focusBusinessArea("exceeded-budgets");
      break;
    case "dashboard-open-import-issues":
      {
        let targetFilter = "all";
        if (importHistory.some((item) => isImportFailed(item.result?.importStatus))) {
          targetFilter = "abnormal";
        } else if (importHistory.some((item) => Number(item.result?.fredImported || 0) === 0)) {
          targetFilter = "degraded";
        } else if (latestImport) {
          if (isImportFailed(latestImport.importStatus)) {
            targetFilter = "abnormal";
          } else if (Number(latestImport.fredImported || 0) === 0) {
            targetFilter = "degraded";
          }
        }
        focusImportHistory(targetFilter);
      }
      break;
    case "dashboard-open-analysis-anomalies":
      if (latestSummary) {
        renderRaw(latestSummary);
      }
      if (!latestSummary) {
        focusAnalysisArea("dashboard");
      } else if ((latestSummary.worldBankTrend?.points?.length || 0) === 0) {
        focusAnalysisArea("worldBank");
      } else if ((latestSummary.fredSeries?.points?.length || 0) === 0) {
        focusAnalysisArea("fred");
      } else if ((latestSummary.conclusions || []).length === 0) {
        focusAnalysisArea("conclusions");
      } else {
        focusAnalysisArea("raw");
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
    case "business-feedback-open-scope":
      if (latestBusinessAction?.scope === "交易") {
        if (latestBusinessAction.entityIds?.length > 1) {
          showLatestBusinessActionResultsOnly();
          scrollToPanel("transactionList");
        } else {
          focusLatestBusinessActionTarget();
        }
      } else if (latestBusinessAction?.scope === "账户") {
        if (latestBusinessAction.entityIds?.length > 1) {
          showLatestBusinessActionResultsOnly();
          scrollToPanel("accountList");
        } else {
          focusLatestBusinessActionTarget();
        }
      } else if (latestBusinessAction?.scope === "分类") {
        if (latestBusinessAction.entityIds?.length > 1) {
          showLatestBusinessActionResultsOnly();
          scrollToPanel("categoryList");
        } else {
          focusLatestBusinessActionTarget();
        }
      } else if (latestBusinessAction?.scope === "预算") {
        if (latestBusinessAction.entityIds?.length > 1) {
          showLatestBusinessActionResultsOnly();
          scrollToPanel("budgetList");
        } else {
          focusLatestBusinessActionTarget();
        }
      } else {
        focusBusinessArea("overview");
      }
      break;
    case "business-feedback-open-target":
      focusLatestBusinessActionTarget();
      break;
    case "business-feedback-filter-targets":
      showLatestBusinessActionResultsOnly();
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
    case "transactions-export-current":
      event.stopPropagation();
      exportCurrentTransactions();
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
  byId("headerQuickSearch")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = byId("headerQuickSearch").value || "";
      if (byId("globalCommandInput")) {
        byId("globalCommandInput").value = value;
      }
      executeGlobalCommand(value || "analysis-summary");
    }
  });
  byId("headerNotificationBtn")?.addEventListener("click", () => adminPageNavigate("rules", "notificationsWorkspace"));
  byId("headerProfileBtn")?.addEventListener("click", () => adminScrollTo("userFamilyWorkspace"));
  byId("openAuthPageBtn").addEventListener("click", openAuthPage);
  byId("logoutBtn").addEventListener("click", handleLogout);
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
  ["countryIso3Mirror", "seriesIdMirror", "topCountriesMirror"].forEach((id) => {
    byId(id)?.addEventListener("input", applyAnalysisParamMirrors);
    byId(id)?.addEventListener("change", applyAnalysisParamMirrors);
  });
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
  byId("resetTransactionFiltersBtn").addEventListener("click", resetTransactionFilters);
  byId("exportTransactionsBtn").addEventListener("click", exportCurrentTransactions);
  byId("transactionQuickAllBtn").addEventListener("click", () => applyTransactionQuickFilter("all"));
  byId("transactionQuickMissingCategoryBtn").addEventListener("click", () => applyTransactionQuickFilter("missing-category"));
  byId("transactionQuickMissingReferenceBtn").addEventListener("click", () => applyTransactionQuickFilter("missing-reference"));
  byId("transactionQuickLargeAmountBtn").addEventListener("click", () => applyTransactionQuickFilter("large-amount"));
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
  try {
    mountVisibleAdminWorkspaces();
    restoreSession();
    syncAnalysisParamMirrors();
    renderTopStats();
    renderHeaderAndSupportPanels();
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
    registerScrollSpy();
    await loadImportHistory();
    if (token) {
      await loadMe();
      if (getCurrentFamilyId()) {
        await Promise.all([loadRules(), loadNotifications()]);
      }
    }
  } catch (error) {
    console.error("admin-mvp init failed", error);
    setImportStatuses(`页面初始化失败：${error.message}`, true);
  }
}

document.addEventListener("DOMContentLoaded", init);


