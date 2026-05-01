<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="Current User" :value="authStore.user?.nickname || authStore.user?.username || '-'" :meta="userMeta" />
      <StatCard label="Current Family" :value="familyId || '-'" :meta="familyMeta" />
      <StatCard label="Unread Alerts" :value="unreadCount" :meta="notificationMeta" />
      <StatCard label="Net Assets" :value="formatAmount(overview.netAssetValue)" :meta="netAssetMeta" />
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="Workbench" title="Admin Overview">
        <template #actions>
          <button class="ghost-button" type="button" @click="refreshAll">Refresh overview</button>
        </template>
        <div class="summary-grid dashboard-link-grid">
          <RouterLink to="/analysis" class="summary-item summary-link">
            <strong>Real Data Analysis</strong>
            <span>{{ latestImportLabel }}</span>
            <span>{{ defenseSummaryLabel }}</span>
          </RouterLink>
          <RouterLink to="/operations" class="summary-item summary-link">
            <strong>Import and Export</strong>
            <span>{{ pendingCount }} pending items</span>
            <span>{{ exportLogs.length }} export logs</span>
          </RouterLink>
          <RouterLink to="/business" class="summary-item summary-link">
            <strong>Business Data</strong>
            <span>{{ accounts.length }} accounts / {{ transactionsTotal }} transactions</span>
            <span>{{ budgets.length }} budgets under management</span>
          </RouterLink>
          <RouterLink to="/assets" class="summary-item summary-link">
            <strong>Assets and Debts</strong>
            <span>Assets {{ formatAmount(overview.totalFixedAssetValue) }}</span>
            <span>Debt {{ formatAmount(overview.totalDebtBalance) }}</span>
          </RouterLink>
          <RouterLink to="/bill-parse-rules" class="summary-item summary-link">
            <strong>Bill Parse Rules</strong>
            <span>{{ parseRuleCount }} active parse rules</span>
            <span>{{ parseRuleHitCount }} total hits</span>
          </RouterLink>
          <RouterLink to="/rules" class="summary-item summary-link">
            <strong>Rules and Alerts</strong>
            <span>{{ enabledRuleCount }} enabled rules</span>
            <span>{{ riskyBudgetCount }} risky budgets / {{ unreadCount }} unread</span>
          </RouterLink>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="Defense" title="Real Data Conclusions" :compact="true">
        <div class="conclusion-list">
          <li>{{ defenseCountryConclusion }}</li>
          <li>{{ defenseRetailConclusion }}</li>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="Linkage" title="Budget -> Rule -> Notification" :compact="true">
        <div class="summary-grid dashboard-linkage-grid">
          <div class="summary-item">
            <strong>Budget Risk</strong>
            <span>{{ riskyBudgetCount }} budgets in warning or exceeded state</span>
            <span :class="riskyBudgetCount > 0 ? 'summary-warn' : 'summary-normal'">
              {{ riskyBudgetCount > 0 ? `Exceeded ${exceededBudgetCount} / Warning ${warningBudgetCount}` : 'No risk budget this month' }}
            </span>
          </div>
          <div class="summary-item">
            <strong>Rule Coverage</strong>
            <span>{{ coveredBudgetCount }} / {{ riskyBudgetCount }} risky budgets covered</span>
            <span :class="uncoveredBudgetCount > 0 ? 'summary-danger' : 'summary-normal'">
              {{ uncoveredBudgetCount > 0 ? `${uncoveredBudgetCount} risky budgets still need rule coverage` : 'All risky budgets are covered' }}
            </span>
          </div>
          <div class="summary-item">
            <strong>Budget Alerts</strong>
            <span>{{ budgetNotificationCount }} notifications</span>
            <span>{{ budgetUnreadCount }} unread</span>
          </div>
          <div class="summary-item">
            <strong>Rule Alerts</strong>
            <span>{{ ruleNotificationCount }} notifications</span>
            <span>{{ ruleUnreadCount }} unread</span>
          </div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in riskyBudgetCoverageRows" :key="item.budgetId" class="table-row-four">
            <strong>{{ item.budgetName }}</strong>
            <span>{{ item.categoryName || '-' }} / {{ item.month || '-' }}</span>
            <span :class="item.exceeded ? 'summary-danger' : 'summary-warn'">
              {{ item.exceeded ? 'Exceeded' : 'Warning' }} {{ formatPercent(item.usageRatio) }}
            </span>
            <span>{{ item.coverageLabel }}</span>
          </div>
          <div v-if="riskyBudgetCoverageRows.length === 0" class="empty-text">No risky budgets need linkage review.</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="Alerts" title="Notification Source Summary" :compact="true">
        <div class="summary-grid">
          <div v-for="item in notificationSourceSummary" :key="item.source" class="summary-item">
            <strong>{{ sourceTypeLabel(item.source) }}</strong>
            <span>{{ item.count }} notifications</span>
            <span>{{ item.unread }} unread</span>
          </div>
          <div v-if="notificationSourceSummary.length === 0" class="empty-text">No notification source data.</div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in latestNotifications" :key="item.id" class="table-row-three">
            <strong>{{ item.title || "System Alert" }}</strong>
            <span>{{ sourceTypeLabel(item.sourceType) }}</span>
            <span>{{ formatDateTime(item.createdAt || item.sentAt) }}</span>
          </div>
          <div v-if="latestNotifications.length === 0" class="empty-text">No recent notifications.</div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="Budget Risk" title="Warning and Exceeded Budgets" :compact="true">
        <div class="table-list compact-table">
          <div v-for="item in highlightedBudgets" :key="item.budgetId" class="table-row-four">
            <strong>{{ item.budgetName }}</strong>
            <span>{{ formatAmount(item.spentAmount) }} / {{ formatAmount(item.budgetAmount) }}</span>
            <span :class="item.exceeded ? 'summary-danger' : 'summary-warn'">
              {{ item.exceeded ? "Exceeded" : "Warning" }}
            </span>
            <span>{{ item.categoryName || "-" }}</span>
          </div>
          <div v-if="highlightedBudgets.length === 0" class="empty-text">No budget warning items right now.</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="Trend" title="Last 6 Months Cash Flow" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Income</strong>
            <span>{{ formatAmount(totalIncome) }}</span>
            <span>{{ monthlySummary.length }} monthly points</span>
          </div>
          <div class="summary-item">
            <strong>Expense</strong>
            <span>{{ formatAmount(totalExpense) }}</span>
            <span>{{ highlightedBudgets.length }} risky budgets</span>
          </div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in monthlySummary" :key="item.month" class="table-row-three">
            <strong>{{ item.month }}</strong>
            <span>Income {{ formatAmount(item.income) }}</span>
            <span>Expense {{ formatAmount(item.expense) }}</span>
          </div>
          <div v-if="monthlySummary.length === 0" class="empty-text">No monthly summary data.</div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="Import" title="Recent Imports and Pending Items" :compact="true">
        <div class="table-list compact-table">
          <div v-for="item in recentImports" :key="item.id" class="table-row-four">
            <strong>#{{ item.id }} / {{ item.originalFileName || "batch-file" }}</strong>
            <span>{{ item.sourcePlatform || "-" }}</span>
            <span>{{ item.successCount || 0 }} / {{ item.totalCount || 0 }}</span>
            <span>{{ item.unmatchedCount || 0 }} pending classify</span>
          </div>
          <div v-if="recentImports.length === 0" class="empty-text">No bill import batches yet.</div>
        </div>
        <div class="conclusion-list dashboard-sublist">
          <li>{{ pendingCount > 0 ? `There are still ${pendingCount} unresolved import items waiting for manual handling.` : "There are no unresolved bill import items." }}</li>
          <li>{{ latestImportLabel }}</li>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="Rule Engine" title="Parse and Alert Rules" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Parse Rules</strong>
            <span>{{ parseRuleCount }} configured</span>
            <span>{{ parseRuleHitCount }} accumulated hits</span>
          </div>
          <div class="summary-item">
            <strong>Alert Rules</strong>
            <span>{{ enabledRuleCount }} enabled</span>
            <span>{{ rules.length }} total definitions</span>
          </div>
        </div>
        <div class="table-list compact-table dashboard-sublist">
          <div v-for="item in rules.slice(0, 4)" :key="item.id" class="table-row-three">
            <strong>{{ item.ruleName }}</strong>
            <span>{{ item.metricType || "-" }}</span>
            <span>{{ Number(item.enabled) === 1 ? "Enabled" : "Disabled" }}</span>
          </div>
          <div v-if="rules.length === 0" class="empty-text">No rule definitions found.</div>
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
const familyMeta = computed(() => `${authStore.memberships.length} family memberships`);
const unreadCount = computed(() => notifications.value.filter((item) => Number(item.readStatus) !== 1).length);
const notificationMeta = computed(() => `${notifications.value.length} recent notifications`);
const netAssetMeta = computed(() => `Assets ${formatAmount(overview.value.totalFixedAssetValue)} / Debt ${formatAmount(overview.value.totalDebtBalance)}`);
const latestImportLabel = computed(() => {
  const item = importHistory.value[0];
  return item ? `Latest import batch #${item.id}, status ${item.importStatus || "-"}` : "No real-data import batch found yet";
});
const defenseSummaryLabel = computed(() => {
  const conclusions = defenseSummary.value?.conclusions || [];
  return conclusions[0] || "Open analysis page for detailed real-data summary";
});
const defenseCountryConclusion = computed(() => {
  const points = defenseSummary.value?.worldBankTrend?.points || [];
  if (points.length < 2) {
    return "Country trend points are still insufficient for a stable oral-defense conclusion.";
  }
  const first = points[0];
  const last = points[points.length - 1];
  return `${defenseSummary.value?.worldBankTrend?.countryName || "CHN"} keeps ${points.length} yearly points from ${first.year} to ${last.year}, which is enough for a country-level trend demonstration.`;
});
const defenseRetailConclusion = computed(() => {
  const first = defenseSummary.value?.retailOverview?.topCountries?.[0];
  if (!first) {
    return "Retail structure data has not been loaded yet.";
  }
  return `The highest-volume retail country is ${first.country || "Unknown"}, with ${first.recordCount || 0} records and total amount ${formatAmount(first.totalAmount)}.`;
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
    coverageLabel: coverage.length > 0 ? `${coverage.length} rules matched` : "No enabled rule matched"
  };
}));
const coveredBudgetCount = computed(() => riskyBudgetCoverageRows.value.filter((item) => item.coverageLabel !== "No enabled rule matched").length);
const uncoveredBudgetCount = computed(() => Math.max(riskyBudgetCount.value - coveredBudgetCount.value, 0));

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("Current session has no family context.");
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
    RULE: "Rule Trigger",
    BUDGET: "Budget Alert",
    OTHER: "Other"
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
