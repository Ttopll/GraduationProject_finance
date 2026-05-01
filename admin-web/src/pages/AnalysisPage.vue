<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="Import Batch" :value="importSummary.batch" :meta="importSummary.meta" />
      <StatCard label="Retail Records" :value="summaryStats.retailRecords" :meta="summaryStats.retailMeta" />
      <StatCard label="World Bank Points" :value="summaryStats.worldBankPoints" :meta="summaryStats.worldBankMeta" />
      <StatCard label="FRED Points" :value="summaryStats.fredPoints" :meta="summaryStats.fredMeta" />
    </div>

    <div class="panel-grid panel-grid-wide">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">Import</div>
            <h2>Real Data Import</h2>
          </div>
          <button class="primary-button" type="button" :disabled="importing" @click="runImport">
            {{ importing ? "Importing..." : "Run Import" }}
          </button>
        </div>
        <div class="form-grid">
          <label class="field-block">
            <span>Processed Directory</span>
            <input v-model.trim="importForm.processedDir" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>Batch Size</span>
            <input v-model.number="importForm.batchSize" class="field-input" type="number" min="1" />
          </label>
          <label class="field-toggle">
            <input v-model="importForm.truncateBeforeImport" type="checkbox" />
            <span>Truncate target tables before import</span>
          </label>
        </div>
        <div class="button-row">
          <button class="ghost-button" type="button" @click="applyImportPreset(1000, true)">Safe Batch</button>
          <button class="ghost-button" type="button" @click="applyImportPreset(5000, true)">Default Batch</button>
          <button class="ghost-button" type="button" @click="applyImportPreset(10000, false)">Incremental Batch</button>
        </div>
        <div :class="['feedback-box', importFeedback.type]">{{ importFeedback.text }}</div>
        <div class="two-column">
          <div class="sub-panel">
            <h3>Latest Import</h3>
            <dl class="detail-list">
              <div><dt>Batch</dt><dd>{{ latestImport?.importBatchId || '-' }}</dd></div>
              <div><dt>Status</dt><dd>{{ latestImport?.importStatus || 'Not started' }}</dd></div>
              <div><dt>Retail</dt><dd>{{ latestImport?.retailImported || 0 }}</dd></div>
              <div><dt>World Bank</dt><dd>{{ latestImport?.worldBankImported || 0 }}</dd></div>
              <div><dt>FRED</dt><dd>{{ latestImport?.fredImported || 0 }}</dd></div>
            </dl>
          </div>
          <div class="sub-panel">
            <h3>Import History</h3>
            <div class="history-list">
              <div v-for="item in importHistory" :key="item.id" class="history-item">
                <strong>Batch {{ item.id }}</strong>
                <span>{{ item.importStatus }}</span>
                <small>{{ formatDateTime(item.importedAt || item.createdAt) }}</small>
              </div>
              <div v-if="importHistory.length === 0" class="empty-text">No import history yet.</div>
            </div>
          </div>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">Defense</div>
            <h2>Defense Summary</h2>
          </div>
          <button class="primary-button" type="button" :disabled="loadingSummary" @click="loadAnalysisBundle">
            {{ loadingSummary ? "Loading..." : "Refresh Summary" }}
          </button>
        </div>
        <div class="form-grid">
          <label class="field-block">
            <span>Country ISO3</span>
            <input v-model.trim="analysisForm.countryIso3" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>FRED Series</span>
            <input v-model.trim="analysisForm.seriesId" class="field-input" type="text" />
          </label>
          <label class="field-block">
            <span>Top Countries</span>
            <input v-model.number="analysisForm.topCountries" class="field-input" type="number" min="1" max="50" />
          </label>
        </div>
        <div :class="['feedback-box', summaryFeedback.type]">{{ summaryFeedback.text }}</div>
        <div class="insight-grid">
          <div class="insight-card">
            <h3>Country Trend</h3>
            <p>{{ countryConclusion }}</p>
          </div>
          <div class="insight-card">
            <h3>Retail Structure</h3>
            <p>{{ retailConclusion }}</p>
          </div>
        </div>
        <div class="sub-panel">
          <h3>Summary Conclusions</h3>
          <ul class="conclusion-list">
            <li v-for="item in conclusions" :key="item">{{ item }}</li>
            <li v-if="conclusions.length === 0">No auto-generated conclusion yet.</li>
          </ul>
        </div>
        <div class="sub-panel">
          <h3>Recommended Rules</h3>
          <div class="mini-list">
            <div v-for="item in recommendedRules" :key="item.key" class="mini-list-item">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
              <RouterLink :to="{ name: 'rules', query: item.query }" class="quick-link">Open in Rules Page</RouterLink>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="panel-grid panel-grid-wide">
      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">Retail</div>
            <h2>Retail Overview</h2>
          </div>
          <button class="ghost-button" type="button" @click="loadRetailOverview">Refresh Retail</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Total Records</strong>
            <span>{{ formatNumber(retailOverview?.totalRecords, 0) }}</span>
            <span>{{ retailRangeText }}</span>
          </div>
          <div class="summary-item">
            <strong>Total Amount</strong>
            <span>{{ formatAmount(retailOverview?.totalAmount) }}</span>
            <span>Average {{ formatAmount(retailOverview?.averageAmount) }}</span>
          </div>
        </div>
        <div class="table-shell" style="margin-top: 14px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Records</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in topCountries" :key="item.country">
                <td>{{ item.country || "Unknown" }}</td>
                <td>{{ formatNumber(item.recordCount, 0) }}</td>
                <td>{{ formatAmount(item.totalAmount) }}</td>
              </tr>
              <tr v-if="topCountries.length === 0">
                <td colspan="3" class="table-empty">No retail country ranking data.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">World Bank</div>
            <h2>Country Trend Detail</h2>
          </div>
          <button class="ghost-button" type="button" @click="loadWorldBankTrend">Refresh Trend</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Country</strong>
            <span>{{ worldBankTrend?.countryName || analysisForm.countryIso3 }}</span>
            <span>{{ formatNumber(worldBankTrend?.points?.length, 0) }} yearly points</span>
          </div>
          <div class="summary-item">
            <strong>Latest Point</strong>
            <span>{{ worldBankLatestPoint ? `${worldBankLatestPoint.year}` : "-" }}</span>
            <span>{{ worldBankLatestPoint ? formatAmount(worldBankLatestPoint.value) : "-" }}</span>
          </div>
        </div>
        <div class="table-shell" style="margin-top: 14px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Value</th>
                <th>YoY Growth</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in worldBankPointsPreview" :key="item.year">
                <td>{{ item.year }}</td>
                <td>{{ formatAmount(item.value) }}</td>
                <td>{{ formatPercent(item.yearOnYearGrowthRatio) }}</td>
              </tr>
              <tr v-if="worldBankPointsPreview.length === 0">
                <td colspan="3" class="table-empty">No World Bank trend points.</td>
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
            <h2>Macro Series Detail</h2>
          </div>
          <button class="ghost-button" type="button" @click="loadFredSeries">Refresh FRED</button>
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <strong>Series ID</strong>
            <span>{{ fredSeries?.seriesId || analysisForm.seriesId }}</span>
            <span>{{ formatNumber(fredSeries?.points?.length, 0) }} points</span>
          </div>
          <div class="summary-item">
            <strong>Latest Point</strong>
            <span>{{ fredLatestPoint?.date || "-" }}</span>
            <span>{{ fredLatestPoint ? formatAmount(fredLatestPoint.value) : "-" }}</span>
          </div>
        </div>
        <div class="table-shell" style="margin-top: 14px;">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in fredPointsPreview" :key="item.date">
                <td>{{ item.date }}</td>
                <td>{{ formatAmount(item.value) }}</td>
              </tr>
              <tr v-if="fredPointsPreview.length === 0">
                <td colspan="2" class="table-empty">No FRED points loaded.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel-card">
        <div class="panel-head">
          <div>
            <div class="panel-kicker">Payload</div>
            <h2>Raw Summary JSON</h2>
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

const importFeedback = reactive({ type: "info", text: "Login first, then run the real-data import." });
const summaryFeedback = reactive({ type: "info", text: "After import, refresh the summary bundle for defense-ready output." });
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
  retailRecords: formatNumber(retailOverview.value?.totalRecords || 0, 0),
  retailMeta: `Total amount ${formatAmount(retailOverview.value?.totalAmount)}`,
  worldBankPoints: formatNumber(worldBankTrend.value?.points?.length || 0, 0),
  worldBankMeta: worldBankTrend.value?.countryName || "World Bank trend not loaded",
  fredPoints: formatNumber(fredSeries.value?.points?.length || 0, 0),
  fredMeta: fredSeries.value?.seriesId || "FRED series not loaded"
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
    return "Time range unavailable";
  }
  return `${formatDateTime(retailOverview.value.earliestInvoiceTime)} -> ${formatDateTime(retailOverview.value.latestInvoiceTime)}`;
});

const retailConclusion = computed(() => {
  const first = topCountries.value[0];
  if (!first) {
    return "Retail structure data is not available yet. Import real data and refresh the analysis bundle first.";
  }
  return `The top retail country is ${first.country || "Unknown"}, with ${formatNumber(first.recordCount, 0)} records and total amount ${formatAmount(first.totalAmount)}.`;
});

const countryConclusion = computed(() => {
  const points = worldBankSortedPoints.value;
  if (points.length < 2) {
    return "Current country trend points are insufficient for a stable country-level conclusion.";
  }
  const first = points[0];
  const last = points[points.length - 1];
  return `${worldBankTrend.value?.countryName || analysisForm.countryIso3} has ${formatNumber(points.length, 0)} yearly points from ${first.year} to ${last.year}, which is enough for a defense trend narrative.`;
});

const recommendedRules = computed(() => {
  const retailAverage = Number(retailOverview.value?.averageAmount || 0);
  const worldBankPointCount = Number(worldBankTrend.value?.points?.length || 0);
  const fredPointCount = Number(fredSeries.value?.points?.length || 0);
  return [
    {
      key: "family-threshold",
      title: "Monthly family expense threshold",
      desc: `Use imported retail average amount ${formatAmount(retailAverage)} as a starting threshold for monthly family expense monitoring.`,
      query: {
        autofill: "1",
        ruleName: "Monthly Family Expense Guard",
        ruleType: "THRESHOLD",
        metricType: "FAMILY_EXPENSE",
        timeScope: "MONTH",
        operatorType: "GT",
        thresholdValue: String(Math.max(1000, Math.round(retailAverage || 1000))),
        priority: "10",
        messageTemplate: "Monthly family expense exceeded the suggested threshold from real-data benchmark."
      }
    },
    {
      key: "family-trend",
      title: "Family expense trend anomaly",
      desc: `Use ${Math.max(2, Math.min(6, worldBankPointCount || 2))} baseline months for trend anomaly monitoring.`,
      query: {
        autofill: "1",
        ruleName: "Family Expense Trend Alert",
        ruleType: "TREND_ANOMALY",
        metricType: "FAMILY_EXPENSE",
        timeScope: "MONTH",
        operatorType: "GT",
        thresholdValue: "1.10",
        thresholdJson: `{"baselineMonths":${Math.max(2, Math.min(6, worldBankPointCount || 2))}}`,
        priority: "8",
        messageTemplate: "Family expense trend exceeded the expected monthly baseline."
      }
    },
    {
      key: "family-consecutive",
      title: "Consecutive monthly overrun",
      desc: `Use ${fredPointCount > 0 ? 3 : 2} consecutive months as a stable warning window for repeated overruns.`,
      query: {
        autofill: "1",
        ruleName: "Consecutive Overrun Alert",
        ruleType: "CONSECUTIVE_THRESHOLD",
        metricType: "FAMILY_EXPENSE",
        timeScope: "MONTH",
        operatorType: "GT",
        thresholdValue: "1.00",
        thresholdJson: `{"consecutiveMonths":${fredPointCount > 0 ? 3 : 2}}`,
        priority: "9",
        messageTemplate: "Family expense exceeded threshold for consecutive months."
      }
    }
  ];
});

const rawPayload = computed(() => JSON.stringify(summary.value || { message: "waiting for load" }, null, 2));

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
    importFeedback.text = "Import completed. You can now refresh the defense summary.";
  } catch (error) {
    importFeedback.type = "error";
    importFeedback.text = `Import failed: ${error.message}`;
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
  summaryFeedback.text = "Loading analysis bundle...";
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
    summaryFeedback.text = "Analysis bundle refreshed successfully.";
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
    importFeedback.text = `Initial load failed: ${error.message}`;
  }
});

usePageRefresh(async () => {
  await Promise.all([loadHistory(), loadAnalysisBundle()]);
});
</script>
