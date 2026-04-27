<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#29992;&#25143;" :value="authStore.user?.nickname || authStore.user?.username || '-'" :meta="userMeta" />
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="familyId || '-'" :meta="familyMeta" />
      <StatCard label="&#26410;&#35835;&#36890;&#30693;" :value="unreadCount" :meta="notificationMeta" />
      <StatCard label="&#20928;&#36164;&#20135;" :value="formatAmount(overview.netAssetValue)" :meta="netAssetMeta" />
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#24555;&#36895;&#20837;&#21475;" title="&#31995;&#32479;&#24635;&#25511;&#21488;">
        <div class="summary-grid">
          <RouterLink to="/analysis" class="summary-item summary-link">
            <strong>&#30495;&#23454;&#25968;&#25454;&#20998;&#26512;</strong>
            <span>{{ latestImportLabel }}</span>
            <span>{{ defenseSummaryLabel }}</span>
          </RouterLink>
          <RouterLink to="/business" class="summary-item summary-link">
            <strong>&#19994;&#21153;&#25968;&#25454;&#31649;&#29702;</strong>
            <span>{{ accounts.length }} &#20010;&#36134;&#25143; / {{ transactionsTotal }} &#26465;&#20132;&#26131;</span>
            <span>{{ budgets.length }} &#26465;&#39044;&#31639;</span>
          </RouterLink>
          <RouterLink to="/assets" class="summary-item summary-link">
            <strong>&#36164;&#20135;&#19982;&#36127;&#20538;</strong>
            <span>{{ formatAmount(overview.totalFixedAssetValue) }} &#36164;&#20135;</span>
            <span>{{ formatAmount(overview.totalDebtBalance) }} &#36127;&#20538;</span>
          </RouterLink>
          <RouterLink to="/operations" class="summary-item summary-link">
            <strong>&#23548;&#20837;&#19982;&#23548;&#20986;</strong>
            <span>{{ pendingCount }} &#26465;&#24453;&#22788;&#29702;</span>
            <span>{{ exportLogs.length }} &#26465;&#23548;&#20986;&#35760;&#24405;</span>
          </RouterLink>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#31572;&#36777;&#25688;&#35201;" title="&#30495;&#23454;&#25968;&#25454;&#32467;&#35770;" :compact="true">
        <div class="conclusion-list">
          <li>{{ defenseCountryConclusion }}</li>
          <li>{{ defenseRetailConclusion }}</li>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#19994;&#21153;&#25351;&#26631;" title="&#25910;&#25903;&#19982;&#39044;&#31639;" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>&#36817; 6 &#26376;&#25910;&#20837;</strong>
            <span>{{ formatAmount(totalIncome) }}</span>
            <span>{{ monthlySummary.length }} &#20010;&#26376;&#24230;&#28857;&#20301;</span>
          </div>
          <div class="summary-item">
            <strong>&#36817; 6 &#26376;&#25903;&#20986;</strong>
            <span>{{ formatAmount(totalExpense) }}</span>
            <span>{{ exceededBudgetCount }} &#26465;&#39044;&#31639;&#24050;&#36229;&#25903;</span>
          </div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#35268;&#21017;&#24341;&#25806;" title="&#35268;&#21017;&#19982;&#36890;&#30693;" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>&#21551;&#29992;&#35268;&#21017;</strong>
            <span>{{ enabledRuleCount }} &#26465;</span>
            <span>{{ rules.length }} &#26465;&#24635;&#35268;&#21017;</span>
          </div>
          <div class="summary-item">
            <strong>&#26410;&#35835;&#36890;&#30693;</strong>
            <span>{{ unreadCount }} &#26465;</span>
            <span>{{ notifications.length }} &#26465;&#24403;&#21069;&#25289;&#21462;</span>
          </div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#26368;&#36817;&#26376;&#24230;" title="&#25910;&#25903;&#26376;&#24230;&#36208;&#21183;" :compact="true">
        <div class="table-list compact-table">
          <div v-for="item in monthlySummary" :key="item.month" class="table-row-three">
            <strong>{{ item.month }}</strong>
            <span>&#25910;&#20837; {{ formatAmount(item.income) }}</span>
            <span>&#25903;&#20986; {{ formatAmount(item.expense) }}</span>
          </div>
          <div v-if="monthlySummary.length === 0" class="empty-text">&#26242;&#26080;&#26376;&#24230;&#27719;&#24635;&#25968;&#25454;&#12290;</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#24453;&#21150;" title="&#24403;&#21069;&#20219;&#21153;&#25552;&#31034;" :compact="true">
        <div class="conclusion-list">
          <li>{{ pendingCount > 0 ? `当前仍有 ${pendingCount} 条账单待归类，可前往导入与导出页面批量处理。` : "当前没有账单待归类项。" }}</li>
          <li>{{ unreadCount > 0 ? `当前仍有 ${unreadCount} 条未读通知，可前往规则与通知页面处理。` : "当前没有未读通知。" }}</li>
          <li>{{ latestImportLabel }}</li>
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
const overview = ref({
  totalFixedAssetValue: 0,
  totalDebtBalance: 0,
  netAssetValue: 0
});
const transactionsTotal = ref(0);

const userMeta = computed(() => authStore.user?.userType || "USER");
const familyMeta = computed(() => `${authStore.memberships.length} \u6761\u5bb6\u5ead\u5173\u7cfb`);
const unreadCount = computed(() => notifications.value.filter((item) => Number(item.readStatus) !== 1).length);
const notificationMeta = computed(() => `${notifications.value.length} \u6761\u6700\u65b0\u901a\u77e5`);
const netAssetMeta = computed(() => `\u8d44\u4ea7 ${formatAmount(overview.value.totalFixedAssetValue)} / \u8d1f\u503a ${formatAmount(overview.value.totalDebtBalance)}`);
const latestImportLabel = computed(() => {
  const item = importHistory.value[0];
  return item ? `最近导入批次 #${item.id}，状态 ${item.importStatus || "-"}` : "\u5c1a\u672a\u67e5\u5230\u771f\u5b9e\u6570\u636e\u5bfc\u5165\u6279\u6b21";
});
const defenseCountryConclusion = computed(() => {
  const points = defenseSummary.value?.worldBankTrend?.points || [];
  if (points.length < 2) {
    return "\u56fd\u5bb6\u8d8b\u52bf\u6570\u636e\u6682\u4e0d\u8db3\uff0c\u8fd8\u4e0d\u9002\u5408\u505a\u7a33\u5b9a\u7b54\u8fa9\u7ed3\u8bba\u3002";
  }
  const first = points[0];
  const last = points[points.length - 1];
  return `${defenseSummary.value?.worldBankTrend?.countryName || "CHN"} 在 ${first.year} 到 ${last.year} 之间已有 ${points.length} 个年度点位，可直接用于国家趋势展示。`;
});
const defenseRetailConclusion = computed(() => {
  const first = defenseSummary.value?.retailOverview?.topCountries?.[0];
  if (!first) {
    return "\u96f6\u552e\u4ea4\u6613\u7ed3\u6784\u6570\u636e\u6682\u672a\u52a0\u8f7d\u3002";
  }
  return `交易量最高国家为 ${first.country || "未知国家"}，记录数 ${first.recordCount || 0}，总金额 ${formatAmount(first.totalAmount)}。`;
});
const defenseSummaryLabel = computed(() => {
  const conclusions = defenseSummary.value?.conclusions || [];
  return conclusions[0] || "\u53ef\u4ece\u5206\u6790\u9875\u67e5\u770b\u66f4\u5b8c\u6574\u771f\u5b9e\u6570\u636e\u6458\u8981";
});
const totalIncome = computed(() => monthlySummary.value.reduce((sum, item) => sum + Number(item.income || 0), 0));
const totalExpense = computed(() => monthlySummary.value.reduce((sum, item) => sum + Number(item.expense || 0), 0));
const exceededBudgetCount = computed(() => budgetUsage.value.filter((item) => item.exceeded).length);
const enabledRuleCount = computed(() => rules.value.filter((item) => Number(item.enabled) === 1).length);
const pendingCount = computed(() => pendingItems.value.filter((item) => item.status !== "RESOLVED").length);

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("\u5f53\u524d\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u5bb6\u5ead\u4e0a\u4e0b\u6587\u3002");
  }
  return familyId.value;
}

async function refreshAll() {
  if (!familyId.value) {
    return;
  }
  const id = ensureFamilyId();
  const notificationsResponse = await notificationsApi.search({ familyId: id, page: 0, size: 10 });
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
    defenseSummaryResult
  ] = await Promise.all([
    accountsApi.listByFamily(id),
    budgetsApi.listByFamily(id),
    budgetsApi.usage(id),
    transactionsApi.monthlySummary(id, 6),
    rulesApi.listByFamily(id),
    fixedAssetsApi.overview(id),
    realDataApi.getImportHistory(),
    billImportsApi.pendingItems(id, "PENDING"),
    dataExportsApi.list(id),
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
  defenseSummary.value = defenseSummaryResult;
  transactionsTotal.value = transactionSearch.totalElements || 0;
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

onMounted(refreshAll);
usePageRefresh(refreshAll);
</script>
