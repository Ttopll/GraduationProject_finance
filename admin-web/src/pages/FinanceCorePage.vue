<template>
  <section class="page-section">
    <article v-if="!familyId" class="panel-card">
      <div class="panel-head">
        <div>
          <div class="panel-kicker">家庭上下文</div>
          <h2>请先创建或加入家庭</h2>
        </div>
      </div>
      <div class="feedback-box info">
        家庭理财看板需要当前家庭上下文。请先在“用户与家庭”页面创建家庭或加入家庭。
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="本月收入" :value="formatAmount(overview.totalIncome)" :meta="incomeMeta" />
      <StatCard label="本月支出" :value="formatAmount(overview.totalExpense)" :meta="expenseMeta" />
      <StatCard label="结余率" :value="formatPercent(overview.savingsRate)" :meta="savingsMeta" />
      <StatCard label="健康评分" :value="healthScore.score || '-'" :meta="healthScore.levelLabel || '等待评分'" />
    </div>

    <AdminTableCard kicker="家庭理财总览" title="收支、预算、资产与建议">
      <template #actions>
        <button class="ghost-button" type="button" @click="refreshAll">刷新看板</button>
        <button class="primary-button" type="button" @click="generateAdvice">生成理财建议</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline field-inline-short">
            <span>统计月份</span>
            <input v-model="selectedMonth" class="field-input" type="month" />
          </label>
          <label class="field-inline field-inline-short">
            <span>趋势月份</span>
            <select v-model.number="trendMonths" class="field-input">
              <option :value="3">近 3 个月</option>
              <option :value="6">近 6 个月</option>
              <option :value="12">近 12 个月</option>
            </select>
          </label>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="feedback" class="feedback-box info">{{ feedback }}</div>
      </template>

      <div class="summary-grid finance-core-grid">
        <div class="summary-item">
          <strong>收支结余</strong>
          <span>{{ formatAmount(overview.netCashFlow) }}</span>
          <span :class="Number(overview.netCashFlow || 0) >= 0 ? 'summary-normal' : 'summary-danger'">
            {{ cashFlowConclusion }}
          </span>
        </div>
        <div class="summary-item">
          <strong>消费结构</strong>
          <span>{{ keyIndicators.topExpenseCategory || "暂无支出分类" }}</span>
          <span>{{ formatPercent(keyIndicators.topExpenseRatio) }} / {{ formatAmount(keyIndicators.topExpenseAmount) }}</span>
        </div>
        <div class="summary-item">
          <strong>预算风险</strong>
          <span>{{ keyIndicators.alertBudgetCount || 0 }} 条预警 / {{ keyIndicators.exceededBudgetCount || 0 }} 条超支</span>
          <span :class="(keyIndicators.exceededBudgetCount || 0) > 0 ? 'summary-danger' : 'summary-normal'">
            {{ budgetConclusion }}
          </span>
        </div>
        <div class="summary-item">
          <strong>资产负债</strong>
          <span>资产 {{ formatAmount(assetSnapshot.totalAssetValue) }}</span>
          <span>负债 {{ formatAmount(assetSnapshot.totalDebtBalance) }} / 负债率 {{ formatPercent(keyIndicators.debtToAssetRatio) }}</span>
        </div>
        <div class="summary-item">
          <strong>流动资金覆盖</strong>
          <span>{{ formatNumber(keyIndicators.liquidityCoverageMonths) }} 个月</span>
          <span>{{ liquidityConclusion }}</span>
        </div>
        <div class="summary-item">
          <strong>恩格尔系数</strong>
          <span>{{ formatPercent(keyIndicators.engelCoefficient) }}</span>
          <span>根据餐饮类支出占比估算</span>
        </div>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="家庭财务月报" :title="monthlyReport.title || '月度综合分析报告'">
      <div class="summary-grid finance-core-grid">
        <div class="summary-item summary-item-wide">
          <strong>综合结论</strong>
          <span>{{ monthlyReport.overallConclusion || "暂无月报结论" }}</span>
        </div>
        <div class="summary-item">
          <strong>收支结论</strong>
          <span>{{ monthlyReport.cashFlowConclusion || "-" }}</span>
        </div>
        <div class="summary-item">
          <strong>预算结论</strong>
          <span>{{ monthlyReport.budgetConclusion || "-" }}</span>
        </div>
        <div class="summary-item">
          <strong>消费结构结论</strong>
          <span>{{ monthlyReport.expenseConclusion || "-" }}</span>
        </div>
        <div class="summary-item">
          <strong>资产负债结论</strong>
          <span>{{ monthlyReport.assetDebtConclusion || "-" }}</span>
        </div>
        <div class="summary-item">
          <strong>理财建议摘要</strong>
          <span>{{ monthlyReport.adviceConclusion || "-" }}</span>
        </div>
      </div>
      <div class="summary-grid dashboard-sublist">
        <div v-for="item in monthlyReport.actionItems || []" :key="item" class="summary-item">
          <strong>下一步动作</strong>
          <span>{{ item }}</span>
        </div>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="财务健康评分" title="家庭财务健康诊断">
      <div class="health-score-layout">
        <div class="health-score-card" :class="healthLevelClass">
          <span>综合评分</span>
          <strong>{{ healthScore.score || "-" }}</strong>
          <em>{{ healthScore.levelLabel || "暂无评级" }}</em>
        </div>
        <div class="health-factor-list">
          <div v-for="item in healthScore.factors || []" :key="item.factorCode" class="health-factor">
            <div class="health-factor-head">
              <strong>{{ item.factorName }}</strong>
              <span>{{ item.factorScore }} / {{ item.maxScore }}</span>
            </div>
            <div class="progress-line">
              <span :style="{ width: factorWidth(item) }"></span>
            </div>
            <small>{{ item.conclusion }}</small>
          </div>
        </div>
      </div>
      <div class="summary-grid dashboard-sublist">
        <div v-for="item in healthScore.improvementSuggestions || []" :key="item" class="summary-item">
          <strong>改进建议</strong>
          <span>{{ item }}</span>
        </div>
      </div>
    </AdminTableCard>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="财务分析" title="月度收支趋势">
        <div class="finance-bars">
          <div v-for="item in monthlyTrend" :key="item.month" class="finance-bar-row">
            <div class="finance-bar-label">{{ item.month }}</div>
            <div class="finance-bar-track">
              <span class="finance-bar-income" :style="{ width: barWidth(item.income, trendMaxAmount) }"></span>
              <span class="finance-bar-expense" :style="{ width: barWidth(item.expense, trendMaxAmount) }"></span>
            </div>
            <div class="finance-bar-values">
              <span>收入 {{ formatAmount(item.income) }}</span>
              <span>支出 {{ formatAmount(item.expense) }}</span>
            </div>
          </div>
          <div v-if="monthlyTrend.length === 0" class="empty-text">暂无月度趋势数据。</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="消费结构" title="支出分类占比">
        <div class="risk-list">
          <div v-for="item in expenseStructure" :key="item.categoryId || item.categoryName" class="risk-item">
            <div class="risk-item-head">
              <strong>{{ item.categoryName || "未分类" }}</strong>
              <span>{{ formatAmount(item.amount) }}</span>
            </div>
            <div class="progress-line">
              <span :style="{ width: percentWidth(item.ratio) }"></span>
            </div>
            <div class="risk-item-body">
              <span>占总支出 {{ formatPercent(item.ratio) }}</span>
            </div>
          </div>
          <div v-if="expenseStructure.length === 0" class="empty-text">暂无支出结构数据。</div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="理财画像" title="风险偏好与家庭目标">
        <template #actions>
          <button class="ghost-button" type="button" @click="loadProfile">读取画像</button>
          <button class="primary-button" type="button" @click="saveProfile">保存画像</button>
        </template>
        <div class="form-grid">
          <label class="field-block">
            <span>风险偏好</span>
            <select v-model="profileForm.riskPreference" class="field-input">
              <option value="LOW">稳健型</option>
              <option value="MEDIUM">平衡型</option>
              <option value="HIGH">进取型</option>
            </select>
          </label>
          <label class="field-block">
            <span>目标储蓄率</span>
            <input v-model.number="profileForm.savingsTargetRatePercent" class="field-input" type="number" min="0" max="100" step="1" />
          </label>
          <label class="field-block">
            <span>应急金覆盖月数</span>
            <input v-model.number="profileForm.emergencyFundMonths" class="field-input" type="number" min="1" max="24" step="1" />
          </label>
          <label class="field-block">
            <span>主要理财目标</span>
            <select v-model="profileForm.goalType" class="field-input">
              <option value="HOUSE">购房准备</option>
              <option value="CAR">购车准备</option>
              <option value="EDUCATION">教育储备</option>
              <option value="RETIREMENT">养老储备</option>
              <option value="TRAVEL">旅行计划</option>
              <option value="OTHER">家庭储蓄</option>
            </select>
          </label>
          <label class="field-block">
            <span>目标金额</span>
            <input v-model.number="profileForm.goalAmount" class="field-input" type="number" min="0" step="1000" />
          </label>
          <label class="field-block">
            <span>目标年份</span>
            <input v-model.number="profileForm.targetYear" class="field-input" type="number" min="2026" max="2100" step="1" />
          </label>
        </div>
        <div class="summary-grid dashboard-sublist">
          <div class="summary-item">
            <strong>画像用途</strong>
            <span>用于生成应急资金、储蓄率、债务压力和资产配置建议。</span>
          </div>
          <div class="summary-item">
            <strong>当前目标</strong>
            <span>{{ goalTypeLabel(profileForm.goalType) }} / {{ formatAmount(profileForm.goalAmount) }}</span>
            <span>目标年份 {{ profileForm.targetYear || "-" }}</span>
          </div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="预算管理" title="预算执行与预警">
        <div class="table-shell compact-table-shell">
          <table class="admin-table">
            <thead>
              <tr>
                <th>预算</th>
                <th>分类</th>
                <th>金额</th>
                <th>使用率</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in budgetProgress" :key="item.budgetId">
                <td>{{ item.budgetName }}</td>
                <td>{{ item.categoryName || "-" }}</td>
                <td>{{ formatAmount(item.spentAmount) }} / {{ formatAmount(item.budgetAmount) }}</td>
                <td>{{ formatPercent(item.usageRatio) }}</td>
                <td>
                  <span class="status-badge" :class="budgetStatusClass(item)">
                    {{ budgetStatusLabel(item) }}
                  </span>
                </td>
              </tr>
              <tr v-if="budgetProgress.length === 0">
                <td colspan="5" class="table-empty">暂无预算执行数据。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="家庭理财建议" title="建议生成与处理">
        <template #actions>
          <button class="ghost-button" type="button" @click="loadAdvices">刷新建议</button>
        </template>
        <div class="risk-list">
          <div v-for="item in advices" :key="item.id" class="risk-item">
            <div class="risk-item-head">
              <strong>{{ item.title }}</strong>
              <span class="status-badge" :class="adviceLevelClass(item.suggestionLevel)">
                {{ adviceLevelLabel(item.suggestionLevel) }}
              </span>
            </div>
            <div class="risk-item-body">
              <span>{{ item.content }}</span>
            </div>
            <div v-if="snapshotSummary(item)" class="advice-snapshot">
              {{ snapshotSummary(item) }}
            </div>
            <div class="button-row button-row-tight">
              <button class="ghost-button small" type="button" @click="toggleAdviceRead(item)">
                {{ item.status === "READ" ? "标记未读" : "标记已读" }}
              </button>
              <button class="ghost-button danger small" type="button" @click="deleteAdvice(item.id)">删除</button>
            </div>
          </div>
          <div v-if="advices.length === 0" class="empty-text">暂无理财建议，可点击“生成理财建议”。</div>
        </div>
      </AdminTableCard>
    </div>

    <AdminTableCard kicker="数据备份与导出" title="家庭财务数据备份">
      <template #actions>
        <button class="primary-button" type="button" @click="exportTransactions">导出收支流水</button>
        <button class="ghost-button" type="button" @click="exportBudgets">导出预算执行</button>
        <button class="ghost-button" type="button" @click="loadExports">刷新导出记录</button>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>导出类型</th>
              <th>文件名</th>
              <th>状态</th>
              <th>完成时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in exportLogs" :key="item.id">
              <td>{{ exportTypeLabel(item.exportType) }}</td>
              <td>{{ item.fileName || item.filePath || "-" }}</td>
              <td><span class="status-badge" :class="item.status === 'SUCCESS' ? 'is-success' : 'is-warn'">{{ item.status }}</span></td>
              <td>{{ formatDateTime(item.completedAt || item.createdAt) }}</td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="downloadExport(item)" :disabled="item.status !== 'SUCCESS'">下载</button>
                </div>
              </td>
            </tr>
            <tr v-if="exportLogs.length === 0">
              <td colspan="5" class="table-empty">暂无导出记录。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import StatCard from "@/components/StatCard.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import FilterBar from "@/components/FilterBar.vue";
import { authStore } from "@/stores/auth";
import { financeAnalysisApi } from "@/api/financeAnalysis";
import { financialAdvicesApi } from "@/api/financialAdvices";
import { familyFinancialProfileApi } from "@/api/familyFinancialProfile";
import { dataExportsApi } from "@/api/dataExports";
import { usePageRefresh } from "@/composables/pageRefresh";

const familyId = computed(() => authStore.currentFamilyId);
const selectedMonth = ref(currentMonth());
const trendMonths = ref(6);
const feedback = ref("");
const analysis = ref(null);
const advices = ref([]);
const exportLogs = ref([]);
const profileForm = ref({
  riskPreference: "LOW",
  savingsTargetRatePercent: 20,
  emergencyFundMonths: 3,
  goalType: "OTHER",
  goalAmount: 0,
  targetYear: new Date().getFullYear() + 3
});

const overview = computed(() => analysis.value?.overview || {});
const assetSnapshot = computed(() => analysis.value?.assetSnapshot || {});
const keyIndicators = computed(() => analysis.value?.keyIndicators || {});
const healthScore = computed(() => analysis.value?.healthScore || {});
const monthlyReport = computed(() => analysis.value?.monthlyReport || {});
const monthlyTrend = computed(() => analysis.value?.monthlyTrend || []);
const expenseStructure = computed(() => analysis.value?.expenseStructure || []);
const budgetProgress = computed(() => analysis.value?.budgetProgress || []);

const trendMaxAmount = computed(() => {
  const values = monthlyTrend.value.flatMap((item) => [Number(item.income || 0), Number(item.expense || 0)]);
  return Math.max(...values, 1);
});

const incomeMeta = computed(() => `${overview.value.incomeTransactionCount || 0} 笔收入`);
const expenseMeta = computed(() => `${overview.value.expenseTransactionCount || 0} 笔支出`);
const savingsMeta = computed(() => `结余 ${formatAmount(overview.value.savingsAmount)}`);
const healthLevelClass = computed(() => `is-${String(healthScore.value.level || "watch").toLowerCase()}`);

const cashFlowConclusion = computed(() => Number(overview.value.netCashFlow || 0) >= 0
  ? "本月现金流为正"
  : "本月支出高于收入");
const budgetConclusion = computed(() => {
  if ((keyIndicators.value.exceededBudgetCount || 0) > 0) {
    return "存在超支预算，需要处理";
  }
  if ((keyIndicators.value.alertBudgetCount || 0) > 0) {
    return "存在接近上限的预算";
  }
  return "预算整体稳定";
});
const liquidityConclusion = computed(() => {
  const months = Number(keyIndicators.value.liquidityCoverageMonths || 0);
  if (!months) {
    return "暂无可计算的月支出";
  }
  return months >= 3 ? "流动资金相对安全" : "建议补足应急资金";
});

async function refreshAll() {
  if (!familyId.value) {
    return;
  }
  try {
    feedback.value = "";
    await Promise.all([loadAnalysis(), loadAdvices(), loadExports(), loadProfile()]);
  } catch (error) {
    feedback.value = `家庭理财看板加载失败：${error.message}`;
  }
}

async function loadAnalysis() {
  analysis.value = await financeAnalysisApi.dashboard(familyId.value, selectedMonth.value, trendMonths.value);
}

async function loadAdvices() {
  advices.value = await financialAdvicesApi.list(familyId.value);
}

async function loadExports() {
  exportLogs.value = await dataExportsApi.list(familyId.value);
}

async function loadProfile() {
  const profile = await familyFinancialProfileApi.get(familyId.value);
  const preference = parseInvestmentPreference(profile.investmentPreferenceJson);
  profileForm.value = {
    riskPreference: profile.riskPreference || "LOW",
    savingsTargetRatePercent: Math.round(Number(profile.savingsTargetRate || 0.2) * 100),
    emergencyFundMonths: profile.emergencyFundMonths || 3,
    goalType: preference.goalType || "OTHER",
    goalAmount: Number(preference.goalAmount || 0),
    targetYear: Number(preference.targetYear || new Date().getFullYear() + 3)
  };
}

async function saveProfile() {
  if (!familyId.value) {
    return;
  }
  try {
    await familyFinancialProfileApi.save({
      familyId: familyId.value,
      riskPreference: profileForm.value.riskPreference,
      savingsTargetRate: Number(profileForm.value.savingsTargetRatePercent || 0) / 100,
      emergencyFundMonths: Number(profileForm.value.emergencyFundMonths || 3),
      investmentPreferenceJson: JSON.stringify({
        goalType: profileForm.value.goalType,
        goalAmount: Number(profileForm.value.goalAmount || 0),
        targetYear: Number(profileForm.value.targetYear || 0)
      })
    });
    feedback.value = "家庭理财画像已保存，可重新生成理财建议。";
  } catch (error) {
    feedback.value = `家庭理财画像保存失败：${error.message}`;
  }
}

async function generateAdvice() {
  if (!familyId.value) {
    return;
  }
  try {
    const result = await financialAdvicesApi.generate(familyId.value, selectedMonth.value);
    feedback.value = `已生成 ${result.generatedCount || 0} 条理财建议。`;
    await loadAdvices();
  } catch (error) {
    feedback.value = `理财建议生成失败：${error.message}`;
  }
}

async function toggleAdviceRead(item) {
  try {
    if (item.status === "READ") {
      await financialAdvicesApi.markUnread(item.id);
    } else {
      await financialAdvicesApi.markRead(item.id);
    }
    await loadAdvices();
  } catch (error) {
    feedback.value = `建议状态更新失败：${error.message}`;
  }
}

async function deleteAdvice(adviceId) {
  try {
    await financialAdvicesApi.remove(adviceId);
    await loadAdvices();
  } catch (error) {
    feedback.value = `理财建议删除失败：${error.message}`;
  }
}

async function exportTransactions() {
  await runExport(() => dataExportsApi.exportTransactions(familyId.value, null, selectedMonth.value), "收支流水");
}

async function exportBudgets() {
  await runExport(() => dataExportsApi.exportBudgets(familyId.value, null, selectedMonth.value), "预算执行");
}

async function runExport(action, label) {
  if (!familyId.value) {
    return;
  }
  try {
    const result = await action();
    feedback.value = `${label}导出完成，导出 ${result.rowCount || 0} 行。`;
    await loadExports();
  } catch (error) {
    feedback.value = `${label}导出失败：${error.message}`;
  }
}

async function downloadExport(item) {
  const blob = await dataExportsApi.download(item.id);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.fileName || "finance-export.csv";
  link.click();
  window.URL.revokeObjectURL(url);
}

function budgetStatusClass(item) {
  if (item.exceeded) {
    return "is-warn";
  }
  if (item.alertTriggered) {
    return "is-warn";
  }
  return "is-success";
}

function budgetStatusLabel(item) {
  if (item.exceeded) {
    return "已超支";
  }
  if (item.alertTriggered) {
    return "已预警";
  }
  return "正常";
}

function adviceLevelClass(level) {
  return level === "HIGH" ? "is-warn" : "is-success";
}

function adviceLevelLabel(level) {
  return level === "HIGH" ? "重点建议" : "普通建议";
}

function snapshotSummary(item) {
  const snapshot = parseInvestmentPreference(item.snapshotJson);
  const pieces = [];
  if (snapshot.healthScore !== undefined && snapshot.healthScore !== null) {
    pieces.push(`健康评分 ${snapshot.healthScore}${snapshot.healthLevel ? `（${snapshot.healthLevel}）` : ""}`);
  }
  if (snapshot.savingsRate !== undefined && snapshot.savingsRate !== null) {
    pieces.push(`储蓄率 ${formatPercent(snapshot.savingsRate)}`);
  }
  if (snapshot.debtToAssetRatio !== undefined && snapshot.debtToAssetRatio !== null) {
    pieces.push(`负债率 ${formatPercent(snapshot.debtToAssetRatio)}`);
  }
  if (snapshot.liquidityCoverageMonths !== undefined && snapshot.liquidityCoverageMonths !== null) {
    pieces.push(`流动资金 ${formatNumber(snapshot.liquidityCoverageMonths)} 个月`);
  }
  if (snapshot.totalDebtBalance !== undefined && snapshot.totalDebtBalance !== null) {
    pieces.push(`债务 ${formatAmount(snapshot.totalDebtBalance)}`);
  }
  if (snapshot.topExpenseCategory) {
    pieces.push(`最大支出 ${snapshot.topExpenseCategory}`);
  }
  return pieces.join(" / ");
}

function parseInvestmentPreference(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return {};
  }
}

function goalTypeLabel(type) {
  const labels = {
    HOUSE: "购房准备",
    CAR: "购车准备",
    EDUCATION: "教育储备",
    RETIREMENT: "养老储备",
    TRAVEL: "旅行计划",
    OTHER: "家庭储蓄"
  };
  return labels[type] || "家庭储蓄";
}

function exportTypeLabel(type) {
  const labels = {
    TRANSACTION_RECORD: "收支流水",
    BUDGET_USAGE: "预算执行"
  };
  return labels[type] || type || "-";
}

function barWidth(value, maxValue) {
  const percent = Math.max(4, Math.round((Number(value || 0) / Math.max(maxValue, 1)) * 100));
  return `${Math.min(percent, 100)}%`;
}

function percentWidth(value) {
  const percent = Math.max(3, Math.round(Number(value || 0) * 100));
  return `${Math.min(percent, 100)}%`;
}

function factorWidth(item) {
  const maxScore = Number(item.maxScore || 1);
  const score = Number(item.factorScore || 0);
  return `${Math.min(Math.round((score / maxScore) * 100), 100)}%`;
}

function formatAmount(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return Number(value).toFixed(1);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return String(value).replace("T", " ").slice(0, 19);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

usePageRefresh(refreshAll);

onMounted(refreshAll);
</script>
