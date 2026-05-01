<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="当前用户" :value="authStore.user?.nickname || authStore.user?.username || '-'" :meta="userMeta" />
      <StatCard label="当前家庭" :value="familyId || '-'" :meta="familyMeta" />
      <StatCard label="未读通知" :value="unreadCount" :meta="notificationMeta" />
      <StatCard label="净资产" :value="formatAmount(overview.netAssetValue)" :meta="netAssetMeta" />
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="工作台" title="后台总览">
        <template #actions>
          <button class="ghost-button" type="button" @click="refreshAll">刷新总览</button>
        </template>
        <div class="summary-grid dashboard-link-grid">
          <RouterLink to="/analysis" class="summary-item summary-link">
            <strong>真实数据分析</strong>
            <span>{{ latestImportLabel }}</span>
            <span>{{ defenseSummaryLabel }}</span>
          </RouterLink>
          <RouterLink to="/operations" class="summary-item summary-link">
            <strong>导入与导出</strong>
            <span>{{ pendingCount }} 条待处理</span>
            <span>{{ exportLogs.length }} 条导出记录</span>
          </RouterLink>
          <RouterLink to="/business" class="summary-item summary-link">
            <strong>业务数据管理</strong>
            <span>{{ accounts.length }} 个账户 / {{ transactionsTotal }} 条交易</span>
            <span>{{ budgets.length }} 条预算正在管理</span>
          </RouterLink>
          <RouterLink to="/assets" class="summary-item summary-link">
            <strong>资产与负债</strong>
            <span>资产 {{ formatAmount(overview.totalFixedAssetValue) }}</span>
            <span>负债 {{ formatAmount(overview.totalDebtBalance) }}</span>
          </RouterLink>
          <RouterLink to="/bill-parse-rules" class="summary-item summary-link">
            <strong>账单解析规则</strong>
            <span>{{ parseRuleCount }} 条解析规则</span>
            <span>累计命中 {{ parseRuleHitCount }} 次</span>
          </RouterLink>
          <RouterLink to="/rules" class="summary-item summary-link">
            <strong>规则与通知</strong>
            <span>{{ enabledRuleCount }} 条启用规则</span>
            <span>{{ riskyBudgetCount }} 条风险预算 / {{ unreadCount }} 条未读</span>
          </RouterLink>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="答辩摘要" title="真实数据结论" :compact="true">
        <div class="conclusion-list">
          <li>{{ defenseCountryConclusion }}</li>
          <li>{{ defenseRetailConclusion }}</li>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="联动闭环" title="预算 -> 规则 -> 通知" :compact="true">
        <div class="summary-grid dashboard-linkage-grid">
          <div class="summary-item">
            <strong>预算风险</strong>
            <span>{{ riskyBudgetCount }} 条预算处于预警或超支状态</span>
            <span :class="riskyBudgetCount > 0 ? 'summary-warn' : 'summary-normal'">
              {{ riskyBudgetCount > 0 ? `超支 ${exceededBudgetCount} 条 / 预警 ${warningBudgetCount} 条` : '本月暂无风险预算' }}
            </span>
          </div>
          <div class="summary-item">
            <strong>规则覆盖</strong>
            <span>{{ coveredBudgetCount }} / {{ riskyBudgetCount }} 条风险预算已覆盖</span>
            <span :class="uncoveredBudgetCount > 0 ? 'summary-danger' : 'summary-normal'">
              {{ uncoveredBudgetCount > 0 ? `${uncoveredBudgetCount} 条风险预算仍需补规则` : '风险预算均已覆盖' }}
            </span>
          </div>
          <div class="summary-item">
            <strong>预算通知</strong>
            <span>{{ budgetNotificationCount }} 条通知</span>
            <span>{{ budgetUnreadCount }} 条未读</span>
          </div>
          <div class="summary-item">
            <strong>规则通知</strong>
            <span>{{ ruleNotificationCount }} 条通知</span>
            <span>{{ ruleUnreadCount }} 条未读</span>
          </div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in riskyBudgetCoverageRows" :key="item.budgetId" class="table-row-four">
            <strong>{{ item.budgetName }}</strong>
            <span>{{ item.categoryName || '-' }} / {{ item.month || '-' }}</span>
            <span :class="item.exceeded ? 'summary-danger' : 'summary-warn'">
              {{ item.exceeded ? '已超支' : '已预警' }} {{ formatPercent(item.usageRatio) }}
            </span>
            <span>{{ item.coverageLabel }}</span>
          </div>
          <div v-if="riskyBudgetCoverageRows.length === 0" class="empty-text">暂无需要联动复核的风险预算。</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="通知来源" title="通知来源汇总" :compact="true">
        <div class="summary-grid">
          <div v-for="item in notificationSourceSummary" :key="item.source" class="summary-item">
            <strong>{{ sourceTypeLabel(item.source) }}</strong>
            <span>{{ item.count }} 条通知</span>
            <span>{{ item.unread }} 条未读</span>
          </div>
          <div v-if="notificationSourceSummary.length === 0" class="empty-text">暂无通知来源数据。</div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in latestNotifications" :key="item.id" class="table-row-three">
            <strong>{{ item.title || "系统通知" }}</strong>
            <span>{{ sourceTypeLabel(item.sourceType) }}</span>
            <span>{{ formatDateTime(item.createdAt || item.sentAt) }}</span>
          </div>
          <div v-if="latestNotifications.length === 0" class="empty-text">暂无最近通知。</div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="预算风险" title="预警与超支预算" :compact="true">
        <div class="table-list compact-table">
          <div v-for="item in highlightedBudgets" :key="item.budgetId" class="table-row-four">
            <strong>{{ item.budgetName }}</strong>
            <span>{{ formatAmount(item.spentAmount) }} / {{ formatAmount(item.budgetAmount) }}</span>
            <span :class="item.exceeded ? 'summary-danger' : 'summary-warn'">
              {{ item.exceeded ? "已超支" : "已预警" }}
            </span>
            <span>{{ item.categoryName || "-" }}</span>
          </div>
          <div v-if="highlightedBudgets.length === 0" class="empty-text">当前暂无预算预警项。</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="趋势" title="近 6 个月收支趋势" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>收入</strong>
            <span>{{ formatAmount(totalIncome) }}</span>
            <span>{{ monthlySummary.length }} 个统计点</span>
          </div>
          <div class="summary-item">
            <strong>支出</strong>
            <span>{{ formatAmount(totalExpense) }}</span>
            <span>{{ highlightedBudgets.length }} 条风险预算</span>
          </div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in monthlySummary" :key="item.month" class="table-row-three">
            <strong>{{ item.month }}</strong>
            <span>收入 {{ formatAmount(item.income) }}</span>
            <span>支出 {{ formatAmount(item.expense) }}</span>
          </div>
          <div v-if="monthlySummary.length === 0" class="empty-text">暂无月度汇总数据。</div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="导入" title="最近导入与待处理项" :compact="true">
        <div class="table-list compact-table">
          <div v-for="item in recentImports" :key="item.id" class="table-row-four">
            <strong>#{{ item.id }} / {{ item.originalFileName || "批次文件" }}</strong>
            <span>{{ item.sourcePlatform || "-" }}</span>
            <span>{{ item.successCount || 0 }} / {{ item.totalCount || 0 }}</span>
            <span>{{ item.unmatchedCount || 0 }} 条待归类</span>
          </div>
          <div v-if="recentImports.length === 0" class="empty-text">暂无账单导入批次。</div>
        </div>
        <div class="conclusion-list dashboard-sublist">
          <li>{{ pendingCount > 0 ? `当前仍有 ${pendingCount} 条导入记录等待人工处理。` : "当前没有待处理账单导入项。" }}</li>
          <li>{{ latestImportLabel }}</li>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="规则引擎" title="解析规则与预警规则" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>解析规则</strong>
            <span>{{ parseRuleCount }} 条已配置</span>
            <span>累计命中 {{ parseRuleHitCount }} 次</span>
          </div>
          <div class="summary-item">
            <strong>预警规则</strong>
            <span>{{ enabledRuleCount }} 条启用</span>
            <span>{{ rules.length }} 条规则定义</span>
          </div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in rules.slice(0, 4)" :key="item.id" class="table-row-three">
            <strong>{{ item.ruleName }}</strong>
            <span>{{ item.metricType || "-" }}</span>
            <span>{{ Number(item.enabled) === 1 ? "启用" : "停用" }}</span>
          </div>
          <div v-if="rules.length === 0" class="empty-text">暂无规则定义。</div>
        </div>
      </AdminTableCard>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import StatCard from "@/components/StatCard.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import { authStore } from "@/stores/auth";
import { accountsApi } from "@/api/accounts";
import { budgetsApi } from "@/api/budgets";
import { transactionsApi } from "@/api/transactions";
import { rulesApi } from "@/api/rules";
import { notificationsApi } from "@/api/notifications";
import { fixedAssetsApi } from "@/api/fixedAssets";
import { realDataApi } from "@/api/realData";
import { billImportsApi } from "@/api/billImports";
import { dataExportsApi } from "@/api/dataExports";
import { billParseRulesApi } from "@/api/billParseRules";
import { usePageRefresh } from "@/composables/pageRefresh";

const familyId = computed(() => authStore.currentFamilyId);
const accounts = ref([]);
const budgets = ref([]);
const budgetUsage = ref([]);
const monthlySummary = ref([]);
const rules = ref([]);
const notifications = ref([]);
const importHistory = ref([]);
const defenseSummary = ref(null);
const pendingItems = ref([]);
const exportLogs = ref([]);
const parseRules = ref([]);
const overview = ref({
  totalFixedAssetValue: 0,
  totalDebtBalance: 0,
  netAssetValue: 0
});
const transactionsTotal = ref(0);

const userMeta = computed(() => authStore.user?.userType || "USER");
const familyMeta = computed(() => `${authStore.memberships.length} 条家庭关系`);
const unreadCount = computed(() => notifications.value.filter((item) => Number(item.readStatus) !== 1).length);
const notificationMeta = computed(() => `${notifications.value.length} 条最近通知`);
const netAssetMeta = computed(() => `资产 ${formatAmount(overview.value.totalFixedAssetValue)} / 负债 ${formatAmount(overview.value.totalDebtBalance)}`);
const latestImportLabel = computed(() => {
  const item = importHistory.value[0];
  return item ? `最近导入批次 #${item.id}，状态 ${item.importStatus || "-"}` : "暂无真实数据导入批次";
});
const defenseSummaryLabel = computed(() => {
  const conclusions = defenseSummary.value?.conclusions || [];
  return conclusions[0] || "可进入真实数据分析页查看完整摘要";
});
const defenseCountryConclusion = computed(() => {
  const points = defenseSummary.value?.worldBankTrend?.points || [];
  if (points.length < 2) {
    return "国家趋势点位暂不足，当前不适合形成稳定答辩结论。";
  }
  const first = points[0];
  const last = points[points.length - 1];
  return `${defenseSummary.value?.worldBankTrend?.countryName || "CHN"} 已有 ${points.length} 个年度点位，覆盖 ${first.year} 至 ${last.year}，可用于国家趋势展示。`;
});
const defenseRetailConclusion = computed(() => {
  const first = defenseSummary.value?.retailOverview?.topCountries?.[0];
  if (!first) {
    return "零售交易结构数据暂未加载。";
  }
  return `交易量最高的国家为 ${first.country || "未知国家"}，记录数 ${first.recordCount || 0}，总金额 ${formatAmount(first.totalAmount)}。`;
});
const totalIncome = computed(() => monthlySummary.value.reduce((sum, item) => sum + Number(item.income || 0), 0));
const totalExpense = computed(() => monthlySummary.value.reduce((sum, item) => sum + Number(item.expense || 0), 0));
const enabledRuleCount = computed(() => rules.value.filter((item) => Number(item.enabled) === 1).length);
const pendingCount = computed(() => pendingItems.value.filter((item) => item.status !== "RESOLVED").length);
const recentImports = computed(() => importHistory.value.slice(0, 4));
const latestNotifications = computed(() => notifications.value.slice(0, 4));
const parseRuleCount = computed(() => parseRules.value.length);
const parseRuleHitCount = computed(() => parseRules.value.reduce((sum, item) => sum + Number(item.hitCount || 0), 0));
const highlightedBudgets = computed(() => budgetUsage.value.filter((item) => item.exceeded || item.alertTriggered).slice(0, 6));
const riskyBudgetCount = computed(() => highlightedBudgets.value.length);
const warningBudgetCount = computed(() => highlightedBudgets.value.filter((item) => item.alertTriggered && !item.exceeded).length);
const exceededBudgetCount = computed(() => highlightedBudgets.value.filter((item) => item.exceeded).length);
const budgetNotificationCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "BUDGET").length);
const ruleNotificationCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "RULE").length);
const budgetUnreadCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "BUDGET" && Number(item.readStatus) !== 1).length);
const ruleUnreadCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "RULE" && Number(item.readStatus) !== 1).length);
const notificationSourceSummary = computed(() => {
  const summary = new Map();
  notifications.value.forEach((item) => {
    const source = normalizeSourceType(item.sourceType) || "OTHER";
    if (!summary.has(source)) {
      summary.set(source, { source, count: 0, unread: 0 });
    }
    const target = summary.get(source);
    target.count += 1;
    if (Number(item.readStatus) !== 1) {
      target.unread += 1;
    }
  });
  return Array.from(summary.values()).sort((a, b) => b.count - a.count);
});
const riskyBudgetCoverageRows = computed(() => highlightedBudgets.value.map((item) => {
  const coverage = matchedRules(item);
  return {
    ...item,
    covered: coverage.length > 0,
    coverageLabel: coverage.length > 0 ? `匹配 ${coverage.length} 条规则` : "暂无启用规则匹配"
  };
}));
const coveredBudgetCount = computed(() => riskyBudgetCoverageRows.value.filter((item) => item.covered).length);
const uncoveredBudgetCount = computed(() => Math.max(riskyBudgetCount.value - coveredBudgetCount.value, 0));

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("当前会话没有可用的家庭上下文。");
  }
  return familyId.value;
}

async function refreshAll() {
  if (!familyId.value) {
    return;
  }
  const id = ensureFamilyId();
  const notificationsResponse = await notificationsApi.search({ familyId: id, page: 0, size: 12 });
  const transactionSearch = await transactionsApi.search({ familyId: id, page: 0, size: 1 });
  const [
    accountsResult,
    budgetsResult,
    budgetUsageResult,
    monthlySummaryResult,
    rulesResult,
    overviewResult,
    importHistoryResult,
    pendingItemsResult,
    exportLogsResult,
    parseRulesResult,
    defenseSummaryResult
  ] = await Promise.all([
    accountsApi.listByFamily(id),
    budgetsApi.listByFamily(id),
    budgetsApi.usage(id),
    transactionsApi.monthlySummary(id, 6),
    rulesApi.listByFamily(id),
    fixedAssetsApi.overview(id),
    billImportsApi.list(id).catch(() => []),
    billImportsApi.pendingItems(id, "PENDING"),
    dataExportsApi.list(id),
    billParseRulesApi.list(id).catch(() => []),
    realDataApi.getDefenseSummary({ countryIso3: "CHN", seriesId: "PCE", topCountries: 5 }).catch(() => null)
  ]);
  accounts.value = accountsResult;
  budgets.value = budgetsResult;
  budgetUsage.value = budgetUsageResult;
  monthlySummary.value = monthlySummaryResult;
  rules.value = rulesResult;
  notifications.value = notificationsResponse.items || [];
  overview.value = overviewResult || overview.value;
  importHistory.value = importHistoryResult || [];
  pendingItems.value = pendingItemsResult || [];
  exportLogs.value = exportLogsResult || [];
  parseRules.value = parseRulesResult || [];
  defenseSummary.value = defenseSummaryResult;
  transactionsTotal.value = transactionSearch.totalElements || 0;
}

function matchedRules(usageItem) {
  return rules.value.filter((rule) => {
    if (Number(rule.enabled) !== 1) {
      return false;
    }
    if (rule.metricType === "FAMILY_EXPENSE") {
      return true;
    }
    if (rule.metricType === "CATEGORY_EXPENSE") {
      return Number(rule.categoryId) === Number(usageItem.categoryId);
    }
    return false;
  });
}

function normalizeSourceType(value) {
  return String(value || "").trim().toUpperCase();
}

function sourceTypeLabel(value) {
  return {
    RULE: "规则触发",
    BUDGET: "预算提醒",
    OTHER: "其他"
  }[normalizeSourceType(value)] || value || "-";
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

onMounted(refreshAll);
usePageRefresh(refreshAll);
</script>
