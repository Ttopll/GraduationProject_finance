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
            <span>数据目录</span>
            <input v-model.trim="importForm.processedDir" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>批次大小</span>
            <input v-model.number="importForm.batchSize" class="field-input" type="number" min="1" />
          </label>
          <label class="field-toggle">
            <input v-model="importForm.truncateBeforeImport" type="checkbox" />
            <span>导入前先清空目标表</span>
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
            <div class="panel-kicker">分析摘要</div>
            <h2>答辩展示摘要</h2>
          </div>
          <button class="primary-button" type="button" :disabled="loadingSummary" @click="loadSummary">
            {{ loadingSummary ? "加载中..." : "刷新摘要" }}
          </button>
        </div>
        <div class="form-grid">
          <label class="field-block">
            <span>国家代码</span>
            <input v-model.trim="analysisForm.countryIso3" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>宏观序列</span>
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
            <h3>国家趋势结论</h3>
            <p>{{ countryConclusion }}</p>
          </div>
          <div class="insight-card">
            <h3>交易结构结论</h3>
            <p>{{ retailConclusion }}</p>
          </div>
        </div>
        <div class="two-column">
          <div class="sub-panel">
            <h3>国家交易排名</h3>
            <div class="table-list">
              <div v-for="item in topCountries" :key="item.country" class="table-row">
                <strong>{{ item.country || '未知国家' }}</strong>
                <span>{{ formatNumber(item.recordCount, 0) }} 条记录</span>
                <span>{{ formatAmount(item.totalAmount) }}</span>
              </div>
              <div v-if="topCountries.length === 0" class="empty-text">暂无国家交易数据。</div>
            </div>
          </div>
          <div class="sub-panel">
            <h3>摘要结论</h3>
            <ul class="conclusion-list">
              <li v-for="item in conclusions" :key="item">{{ item }}</li>
              <li v-if="conclusions.length === 0">暂无自动生成结论。</li>
            </ul>
          </div>
        </div>
        <div class="raw-box">{{ rawPayload }}</div>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import StatCard from "@/components/StatCard.vue";
import { realDataApi } from "@/api/realData";

const importing = ref(false);
const loadingSummary = ref(false);
const latestImport = ref(null);
const importHistory = ref([]);
const summary = ref(null);
const importFeedback = reactive({ type: "info", text: "\u8bf7\u5148\u767b\u5f55\uff0c\u7136\u540e\u6267\u884c\u771f\u5b9e\u6570\u636e\u5bfc\u5165\u3002" });
const summaryFeedback = reactive({ type: "info", text: "\u5bfc\u5165\u5b8c\u6210\u540e\uff0c\u5237\u65b0\u6458\u8981\u4ee5\u751f\u6210\u7b54\u8fa9\u5c55\u793a\u5185\u5bb9\u3002" });
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
    : "\u6700\u65b0\u5bfc\u5165\u7ed3\u679c\u5c06\u663e\u793a\u5728\u8fd9\u91cc"
}));

const summaryStats = computed(() => ({
  retailRecords: formatNumber(summary.value?.retailOverview?.totalRecords || 0, 0),
  retailMeta: `\u603b\u91d1\u989d ${formatAmount(summary.value?.retailOverview?.totalAmount)}`,
  worldBankPoints: formatNumber(summary.value?.worldBankTrend?.points?.length || 0, 0),
  worldBankMeta: summary.value?.worldBankTrend?.countryName || "\u5c1a\u672a\u52a0\u8f7d\u4e16\u884c\u8d8b\u52bf",
  fredPoints: formatNumber(summary.value?.fredSeries?.points?.length || 0, 0),
  fredMeta: summary.value?.fredSeries?.seriesId || "\u5c1a\u672a\u52a0\u8f7d FRED \u5e8f\u5217"
}));

const topCountries = computed(() => summary.value?.retailOverview?.topCountries || []);
const conclusions = computed(() => summary.value?.conclusions || []);

const retailConclusion = computed(() => {
  const first = topCountries.value[0];
  if (!first) {
    return "\u5f53\u524d\u8fd8\u6ca1\u6709\u53ef\u7528\u7684\u4ea4\u6613\u7ed3\u6784\u6570\u636e\uff0c\u8bf7\u5148\u5bfc\u5165\u771f\u5b9e\u6570\u636e\u5e76\u5237\u65b0\u6458\u8981\u3002";
  }
  return `\u4ea4\u6613\u91cf\u6700\u9ad8\u7684\u56fd\u5bb6\u662f ${first.country || "\u672a\u77e5\u56fd\u5bb6"}\uff0c\u5171\u6709 ${formatNumber(first.recordCount, 0)} \u6761\u8bb0\u5f55\uff0c\u603b\u91d1\u989d\u4e3a ${formatAmount(first.totalAmount)}\u3002`;
});

const countryConclusion = computed(() => {
  const points = summary.value?.worldBankTrend?.points || [];
  if (points.length < 2) {
    return "\u5f53\u524d\u56fd\u5bb6\u8d8b\u52bf\u70b9\u4f4d\u4e0d\u8db3\uff0c\u6682\u65f6\u65e0\u6cd5\u5f97\u51fa\u7a33\u5b9a\u7684\u8d8b\u52bf\u7ed3\u8bba\u3002";
  }
  const sorted = [...points].sort((left, right) => Number(left.year) - Number(right.year));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${summary.value?.worldBankTrend?.countryName || analysisForm.countryIso3} \u5728 ${first.year} \u5230 ${last.year} \u4e4b\u95f4\u5171\u6709 ${formatNumber(points.length, 0)} \u4e2a\u5e74\u5ea6\u70b9\u4f4d\uff0c\u5df2\u80fd\u652f\u6491\u7b54\u8fa9\u4e2d\u7684\u56fd\u5bb6\u8d8b\u52bf\u53d9\u8ff0\u3002`;
});

const rawPayload = computed(() => JSON.stringify(summary.value || { message: "\u7b49\u5f85\u52a0\u8f7d" }, null, 2));

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
  importFeedback.text = "\u6b63\u5728\u6267\u884c\u771f\u5b9e\u6570\u636e\u5bfc\u5165...";
  try {
    latestImport.value = await realDataApi.importData(importForm);
    await loadHistory();
    importFeedback.type = "success";
    importFeedback.text = "\u5bfc\u5165\u5b8c\u6210\uff0c\u73b0\u5728\u53ef\u4ee5\u5237\u65b0\u7b54\u8fa9\u6458\u8981\u3002";
  } catch (error) {
    importFeedback.type = "error";
    importFeedback.text = `\u5bfc\u5165\u5931\u8d25\uff1a${error.message}`;
  } finally {
    importing.value = false;
  }
}

async function loadSummary() {
  loadingSummary.value = true;
  summaryFeedback.type = "info";
  summaryFeedback.text = "\u6b63\u5728\u52a0\u8f7d\u7b54\u8fa9\u6458\u8981...";
  try {
    summary.value = await realDataApi.getDefenseSummary(analysisForm);
    summaryFeedback.type = "success";
    summaryFeedback.text = "\u7b54\u8fa9\u6458\u8981\u5237\u65b0\u6210\u529f\u3002";
  } catch (error) {
    summaryFeedback.type = "error";
    summaryFeedback.text = `\u6458\u8981\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

onMounted(async () => {
  try {
    await loadHistory();
  } catch (error) {
    importFeedback.type = "error";
    importFeedback.text = `\u5bfc\u5165\u5386\u53f2\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
});
</script>
