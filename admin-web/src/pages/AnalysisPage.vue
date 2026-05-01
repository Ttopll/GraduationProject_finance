<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="导入批次" :value="importSummary.batch" :meta="importSummary.meta" />
      <StatCard label="零售交易数" :value="summaryStats.retailRecords" :meta="summaryStats.retailMeta" />
      <StatCard label="世行趋势点" :value="summaryStats.worldBankPoints" :meta="summaryStats.worldBankMeta" />
      <StatCard label="FRED 点数" :value="summaryStats.fredPoints" :meta="summaryStats.fredMeta" />
    </div>

    <div class="panel-grid panel-grid-wide">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">导入</div>
            <h2>真实数据导入</h2>
          </div>
          <button class="primary-button" type="button" :disabled="importing" @click="runImport">
            {{ importing ? "导入中..." : "执行导入" }}
          </button>
        </div>
        <div class="form-grid">
          <label class="field-block">
            <span>处理后数据目录</span>
            <input v-model.trim="importForm.processedDir" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>批次大小</span>
            <input v-model.number="importForm.batchSize" class="field-input" type="number" min="1" />
          </label>
          <label class="field-toggle">
            <input v-model="importForm.truncateBeforeImport" type="checkbox" />
            <span>导入前清空目标表</span>
          </label>
        </div>
        <div class="button-row">
          <button class="ghost-button" type="button" @click="applyImportPreset(1000, true)">安全批次</button>
          <button class="ghost-button" type="button" @click="applyImportPreset(5000, true)">默认批次</button>
          <button class="ghost-button" type="button" @click="applyImportPreset(10000, false)">增量批次</button>
        </div>
        <div :class="['feedback-box', importFeedback.type]">{{ importFeedback.text }}</div>
        <div class="two-column">
          <div class="sub-panel">
            <h3>最近一次导入</h3>
            <dl class="detail-list">
              <div><dt>批次</dt><dd>{{ latestImport?.importBatchId || '-' }}</dd></div>
              <div><dt>状态</dt><dd>{{ latestImport?.importStatus || '尚未开始' }}</dd></div>
              <div><dt>零售交易</dt><dd>{{ latestImport?.retailImported || 0 }}</dd></div>
              <div><dt>世行数据</dt><dd>{{ latestImport?.worldBankImported || 0 }}</dd></div>
              <div><dt>FRED</dt><dd>{{ latestImport?.fredImported || 0 }}</dd></div>
            </dl>
          </div>
          <div class="sub-panel">
            <h3>导入历史</h3>
            <div class="history-list">
              <div v-for="item in importHistory" :key="item.id" class="history-item">
                <strong>批次 {{ item.id }}</strong>
                <span>{{ item.importStatus }}</span>
                <small>{{ formatDateTime(item.importedAt || item.createdAt) }}</small>
              </div>
              <div v-if="importHistory.length === 0" class="empty-text">暂无导入历史。</div>
            </div>
          </div>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">答辩摘要</div>
            <h2>真实数据分析摘要</h2>
          </div>
          <button class="primary-button" type="button" :disabled="loadingSummary" @click="loadAnalysisBundle">
            {{ loadingSummary ? "加载中..." : "刷新摘要" }}
          </button>
        </div>
        <div class="form-grid">
          <label class="field-block">
            <span>国家代码</span>
            <input v-model.trim="analysisForm.countryIso3" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>FRED 序列</span>
            <input v-model.trim="analysisForm.seriesId" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>展示国家数</span>
            <input v-model.number="analysisForm.topCountries" class="field-input" type="number" min="1" max="50" />
          </label>
        </div>
        <div :class="['feedback-box', summaryFeedback.type]">{{ summaryFeedback.text }}</div>
        <div class="insight-grid">
          <div class="insight-card">
            <h3>国家趋势</h3>
            <p>{{ countryConclusion }}</p>
          </div>
          <div class="insight-card">
            <h3>交易结构</h3>
            <p>{{ retailConclusion }}</p>
          </div>
        </div>
        <div class="sub-panel">
          <h3>摘要结论</h3>
          <ul class="conclusion-list">
            <li v-for="item in conclusions" :key="item">{{ item }}</li>
            <li v-if="conclusions.length === 0">暂无自动生成结论。</li>
          </ul>
        </div>
        <div class="sub-panel">
          <h3>推荐规则</h3>
          <div class="mini-list">
            <div v-for="item in recommendedRules" :key="item.key" class="mini-list-item">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
              <RouterLink :to="{ name: 'rules', query: item.query }" class="quick-link">带入规则页</RouterLink>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="panel-grid panel-grid-wide">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">零售数据</div>
            <h2>零售交易概览</h2>
          </div>
          <button class="ghost-button" type="button" @click="loadRetailOverview">刷新零售概览</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>总记录数</strong>
            <span>{{ formatNumber(retailOverview?.totalRecords, 0) }}</span>
            <span>{{ retailRangeText }}</span>
          </div>
          <div class="summary-item">
            <strong>总金额</strong>
            <span>{{ formatAmount(retailOverview?.totalAmount) }}</span>
            <span>平均金额 {{ formatAmount(retailOverview?.averageAmount) }}</span>
          </div>
        </div>
        <div class="table-shell" style="margin-top: 14px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>国家</th>
                <th>记录数</th>
                <th>总金额</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in topCountries" :key="item.country">
                <td>{{ item.country || "未知" }}</td>
                <td>{{ formatNumber(item.recordCount, 0) }}</td>
                <td>{{ formatAmount(item.totalAmount) }}</td>
              </tr>
              <tr v-if="topCountries.length === 0">
                <td colspan="3" class="table-empty">暂无零售国家排名数据。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">世界银行</div>
            <h2>国家趋势明细</h2>
          </div>
          <button class="ghost-button" type="button" @click="loadWorldBankTrend">刷新趋势</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>国家</strong>
            <span>{{ worldBankTrend?.countryName || analysisForm.countryIso3 }}</span>
            <span>{{ formatNumber(worldBankTrend?.points?.length, 0) }} 个年度点</span>
          </div>
          <div class="summary-item">
            <strong>最新点位</strong>
            <span>{{ worldBankLatestPoint ? `${worldBankLatestPoint.year}` : "-" }}</span>
            <span>{{ worldBankLatestPoint ? formatAmount(worldBankLatestPoint.value) : "-" }}</span>
          </div>
        </div>
        <div class="table-shell" style="margin-top: 14px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>年份</th>
                <th>数值</th>
                <th>同比增长</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in worldBankPointsPreview" :key="item.year">
                <td>{{ item.year }}</td>
                <td>{{ formatAmount(item.value) }}</td>
                <td>{{ formatPercent(item.yearOnYearGrowthRatio) }}</td>
              </tr>
              <tr v-if="worldBankPointsPreview.length === 0">
                <td colspan="3" class="table-empty">暂无世行趋势点。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>

    <div class="panel-grid panel-grid-wide">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">FRED</div>
            <h2>宏观序列明细</h2>
          </div>
          <button class="ghost-button" type="button" @click="loadFredSeries">刷新 FRED</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>序列 ID</strong>
            <span>{{ fredSeries?.seriesId || analysisForm.seriesId }}</span>
            <span>{{ formatNumber(fredSeries?.points?.length, 0) }} points</span>
          </div>
          <div class="summary-item">
            <strong>最新点位</strong>
            <span>{{ fredLatestPoint?.date || "-" }}</span>
            <span>{{ fredLatestPoint ? formatAmount(fredLatestPoint.value) : "-" }}</span>
          </div>
        </div>
        <div class="table-shell" style="margin-top: 14px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>数值</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in fredPointsPreview" :key="item.date">
                <td>{{ item.date }}</td>
                <td>{{ formatAmount(item.value) }}</td>
              </tr>
              <tr v-if="fredPointsPreview.length === 0">
                <td colspan="2" class="table-empty">暂无 FRED 点位。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">原始数据</div>
            <h2>摘要 JSON</h2>
          </div>
        </div>
        <div class="raw-box">{{ rawPayload }}</div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import StatCard from "@/components/StatCard.vue";
import { realDataApi } from "@/api/realData";
import { usePageRefresh } from "@/composables/pageRefresh";

const importing = ref(false);
const loadingSummary = ref(false);
const latestImport = ref(null);
const importHistory = ref([]);
const retailOverview = ref(null);
const worldBankTrend = ref(null);
const fredSeries = ref(null);
const summary = ref(null);

const importFeedback = reactive({ type: "info", text: "请先登录，然后执行真实数据导入。" });
const summaryFeedback = reactive({ type: "info", text: "导入完成后，刷新摘要以生成答辩展示内容。" });
const importForm = reactive({
  processedDir: "data/processed",
  batchSize: 5000,
  truncateBeforeImport: true
});
const analysisForm = reactive({
  countryIso3: "CHN",
  seriesId: "PCE",
  topCountries: 10
});

const importSummary = computed(() => ({
  batch: latestImport.value?.importBatchId || "-",
  meta: latestImport.value
    ? `${latestImport.value.importStatus} / ${formatDateTime(latestImport.value.importedAt)}`
    : "最新导入结果会显示在这里"
}));

const summaryStats = computed(() => ({
  retailRecords: formatNumber(retailOverview.value?.totalRecords || 0, 0),
  retailMeta: `总金额 ${formatAmount(retailOverview.value?.totalAmount)}`,
  worldBankPoints: formatNumber(worldBankTrend.value?.points?.length || 0, 0),
  worldBankMeta: worldBankTrend.value?.countryName || "世行趋势尚未加载",
  fredPoints: formatNumber(fredSeries.value?.points?.length || 0, 0),
  fredMeta: fredSeries.value?.seriesId || "FRED 序列尚未加载"
}));

const topCountries = computed(() => retailOverview.value?.topCountries || []);
const conclusions = computed(() => summary.value?.conclusions || []);
const worldBankSortedPoints = computed(() => [...(worldBankTrend.value?.points || [])].sort((a, b) => Number(a.year) - Number(b.year)));
const worldBankLatestPoint = computed(() => worldBankSortedPoints.value[worldBankSortedPoints.value.length - 1] || null);
const worldBankPointsPreview = computed(() => [...worldBankSortedPoints.value].reverse().slice(0, 8));
const fredPointsPreview = computed(() => (fredSeries.value?.points || []).slice(-8).reverse());
const fredLatestPoint = computed(() => {
  const points = fredSeries.value?.points || [];
  return points.length ? points[points.length - 1] : null;
});
const retailRangeText = computed(() => {
  if (!retailOverview.value?.earliestInvoiceTime || !retailOverview.value?.latestInvoiceTime) {
    return "时间范围暂不可用";
  }
  return `${formatDateTime(retailOverview.value.earliestInvoiceTime)} -> ${formatDateTime(retailOverview.value.latestInvoiceTime)}`;
});

const retailConclusion = computed(() => {
  const first = topCountries.value[0];
  if (!first) {
    return "零售交易结构数据暂不可用，请先导入真实数据并刷新摘要。";
  }
  return `交易量最高的国家为 ${first.country || "未知国家"}，共有 ${formatNumber(first.recordCount, 0)} 条记录，总金额为 ${formatAmount(first.totalAmount)}。`;
});

const countryConclusion = computed(() => {
  const points = worldBankSortedPoints.value;
  if (points.length < 2) {
    return "当前国家趋势点位不足，暂时无法形成稳定趋势结论。";
  }
  const first = points[0];
  const last = points[points.length - 1];
  return `${worldBankTrend.value?.countryName || analysisForm.countryIso3} 在 ${first.year} 至 ${last.year} 间共有 ${formatNumber(points.length, 0)} 个年度点位，可支撑答辩中的国家趋势说明。`;
});

const recommendedRules = computed(() => {
  const retailAverage = Number(retailOverview.value?.averageAmount || 0);
  const worldBankPointCount = Number(worldBankTrend.value?.points?.length || 0);
  const fredPointCount = Number(fredSeries.value?.points?.length || 0);
  return [
    {
      key: "family-threshold",
      title: "月度家庭支出阈值",
      desc: `可参考导入零售数据的平均金额 ${formatAmount(retailAverage)}，设置家庭月度支出监控阈值。`,
      query: {
        autofill: "1",
        ruleName: "月度家庭支出预警",
        ruleType: "THRESHOLD",
        metricType: "FAMILY_EXPENSE",
        timeScope: "MONTH",
        operatorType: "GT",
        thresholdValue: String(Math.max(1000, Math.round(retailAverage || 1000))),
        priority: "10",
        messageTemplate: "家庭月度支出超过真实数据参考阈值。"
      }
    },
    {
      key: "family-trend",
      title: "家庭支出趋势异常",
      desc: `可使用 ${Math.max(2, Math.min(6, worldBankPointCount || 2))} 个月作为趋势异常检测基线。`,
      query: {
        autofill: "1",
        ruleName: "家庭支出趋势异常提醒",
        ruleType: "TREND_ANOMALY",
        metricType: "FAMILY_EXPENSE",
        timeScope: "MONTH",
        operatorType: "GT",
        thresholdValue: "1.10",
        thresholdJson: `{"baselineMonths":${Math.max(2, Math.min(6, worldBankPointCount || 2))}}`,
        priority: "8",
        messageTemplate: "家庭支出趋势超过月度基线。"
      }
    },
    {
      key: "family-consecutive",
      title: "连续月份超阈",
      desc: `可使用连续 ${fredPointCount > 0 ? 3 : 2} 个月作为重复超阈的预警窗口。`,
      query: {
        autofill: "1",
        ruleName: "连续超阈提醒",
        ruleType: "CONSECUTIVE_THRESHOLD",
        metricType: "FAMILY_EXPENSE",
        timeScope: "MONTH",
        operatorType: "GT",
        thresholdValue: "1.00",
        thresholdJson: `{"consecutiveMonths":${fredPointCount > 0 ? 3 : 2}}`,
        priority: "9",
        messageTemplate: "家庭支出已连续多月超过阈值。"
      }
    }
  ];
});

const rawPayload = computed(() => JSON.stringify(summary.value || { message: "等待加载" }, null, 2));

function applyImportPreset(batchSize, truncateBeforeImport) {
  importForm.batchSize = batchSize;
  importForm.truncateBeforeImport = truncateBeforeImport;
}

async function loadHistory() {
  importHistory.value = await realDataApi.getImportHistory();
  latestImport.value = importHistory.value[0] || latestImport.value;
}

async function runImport() {
  importing.value = true;
  importFeedback.type = "info";
  importFeedback.text = "正在执行真实数据导入...";
  try {
    latestImport.value = await realDataApi.importData(importForm);
    await loadHistory();
    importFeedback.type = "success";
    importFeedback.text = "导入完成，现在可以刷新答辩摘要。";
  } catch (error) {
    importFeedback.type = "error";
    importFeedback.text = `导入失败：${error.message}`;
  } finally {
    importing.value = false;
  }
}

async function loadRetailOverview() {
  retailOverview.value = await realDataApi.getRetailOverview({ topCountries: analysisForm.topCountries });
}

async function loadWorldBankTrend() {
  worldBankTrend.value = await realDataApi.getWorldBankTrend({ countryIso3: analysisForm.countryIso3 });
}

async function loadFredSeries() {
  fredSeries.value = await realDataApi.getFredSeries({ seriesId: analysisForm.seriesId });
}

async function loadAnalysisBundle() {
  loadingSummary.value = true;
  summaryFeedback.type = "info";
  summaryFeedback.text = "正在加载分析摘要...";
  try {
    const [summaryResult, retailResult, worldBankResult, fredResult] = await Promise.all([
      realDataApi.getDefenseSummary(analysisForm),
      realDataApi.getRetailOverview({ topCountries: analysisForm.topCountries }),
      realDataApi.getWorldBankTrend({ countryIso3: analysisForm.countryIso3 }),
      realDataApi.getFredSeries({ seriesId: analysisForm.seriesId })
    ]);
    summary.value = summaryResult;
    retailOverview.value = retailResult;
    worldBankTrend.value = worldBankResult;
    fredSeries.value = fredResult;
    summaryFeedback.type = "success";
    summaryFeedback.text = "分析摘要刷新成功。";
  } catch (error) {
    summaryFeedback.type = "error";
    summaryFeedback.text = `摘要加载失败：${error.message}`;
  } finally {
    loadingSummary.value = false;
  }
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

onMounted(async () => {
  try {
    await Promise.all([loadHistory(), loadAnalysisBundle()]);
  } catch (error) {
    importFeedback.type = "error";
    importFeedback.text = `初始化加载失败：${error.message}`;
  }
});

usePageRefresh(async () => {
  await Promise.all([loadHistory(), loadAnalysisBundle()]);
});
</script>
