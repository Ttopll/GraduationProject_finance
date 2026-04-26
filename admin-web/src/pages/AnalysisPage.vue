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
const importFeedback = reactive({ type: "info", text: "Login first, then run real-data import." });
const summaryFeedback = reactive({ type: "info", text: "After import, refresh the summary for defense output." });
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
    : "Latest import result will appear here"
}));

const summaryStats = computed(() => ({
  retailRecords: formatNumber(summary.value?.retailOverview?.totalRecords || 0, 0),
  retailMeta: `Total amount ${formatAmount(summary.value?.retailOverview?.totalAmount)}`,
  worldBankPoints: formatNumber(summary.value?.worldBankTrend?.points?.length || 0, 0),
  worldBankMeta: summary.value?.worldBankTrend?.countryName || "World Bank trend not loaded",
  fredPoints: formatNumber(summary.value?.fredSeries?.points?.length || 0, 0),
  fredMeta: summary.value?.fredSeries?.seriesId || "FRED series not loaded"
}));

const topCountries = computed(() => summary.value?.retailOverview?.topCountries || []);
const conclusions = computed(() => summary.value?.conclusions || []);

const retailConclusion = computed(() => {
  const first = topCountries.value[0];
  if (!first) {
    return "No retail structure data yet. Run import and refresh the summary first.";
  }
  return `Top transaction country is ${first.country || "Unknown"}, with ${formatNumber(first.recordCount, 0)} records and total amount ${formatAmount(first.totalAmount)}.`;
});

const countryConclusion = computed(() => {
  const points = summary.value?.worldBankTrend?.points || [];
  if (points.length < 2) {
    return "Not enough country trend points to produce a stable conclusion yet.";
  }
  const sorted = [...points].sort((left, right) => Number(left.year) - Number(right.year));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${summary.value?.worldBankTrend?.countryName || analysisForm.countryIso3} has ${formatNumber(points.length, 0)} yearly points from ${first.year} to ${last.year}, which is enough for a defense trend narrative.`;
});

const rawPayload = computed(() => JSON.stringify(summary.value || { message: "waiting" }, null, 2));

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
  importFeedback.text = "Running real-data import...";
  try {
    latestImport.value = await realDataApi.importData(importForm);
    await loadHistory();
    importFeedback.type = "success";
    importFeedback.text = "Import completed. You can refresh the defense summary now.";
  } catch (error) {
    importFeedback.type = "error";
    importFeedback.text = `Import failed: ${error.message}`;
  } finally {
    importing.value = false;
  }
}

async function loadSummary() {
  loadingSummary.value = true;
  summaryFeedback.type = "info";
  summaryFeedback.text = "Loading defense summary...";
  try {
    summary.value = await realDataApi.getDefenseSummary(analysisForm);
    summaryFeedback.type = "success";
    summaryFeedback.text = "Defense summary refreshed successfully.";
  } catch (error) {
    summaryFeedback.type = "error";
    summaryFeedback.text = `Summary load failed: ${error.message}`;
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
    importFeedback.text = `Import history load failed: ${error.message}`;
  }
});
</script>
