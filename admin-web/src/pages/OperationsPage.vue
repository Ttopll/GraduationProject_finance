<template>
  <section class="page-section">
    <article v-if="!familyId" class="panel-card">
      <div class="panel-head">
        <div>
          <div class="panel-kicker">&#23478;&#24237;&#19978;&#19979;&#25991;&#32570;&#22833;</div>
          <h2>&#35831;&#20808;&#21019;&#24314;&#25110;&#21152;&#20837;&#23478;&#24237;</h2>
        </div>
      </div>
      <div class="feedback-box info">
        &#36134;&#21333;&#23548;&#20837;&#12289;&#24453;&#22788;&#29702;&#24402;&#31867;&#21644;&#25968;&#25454;&#23548;&#20986;&#37117;&#38656;&#35201;&#24403;&#21069;&#23478;&#24237;&#19978;&#19979;&#25991;&#12290;&#35831;&#20808;&#22312;&#8220;&#29992;&#25143;&#19982;&#23478;&#24237;&#8221;&#39029;&#23436;&#25104;&#23478;&#24237;&#37197;&#32622;&#12290;
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="familyId || '-'" meta="&#23548;&#20837;&#19982;&#23548;&#20986;&#37117;&#32465;&#23450; familyId" />
      <StatCard label="&#23548;&#20837;&#25209;&#27425;" :value="importBatches.length" :meta="latestImportMeta" />
      <StatCard label="&#24453;&#22788;&#29702;&#39033;" :value="pendingOpenCount" :meta="pendingMeta" />
      <StatCard label="&#23548;&#20986;&#35760;&#24405;" :value="exportLogs.length" :meta="latestExportMeta" />
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#23548;&#20837;" title="&#36134;&#21333;&#23548;&#20837;">
        <template #actions>
          <button class="ghost-button" type="button" @click="refreshAll">&#21047;&#26032;</button>
        </template>
        <template #feedback>
          <div v-if="importFeedback" class="feedback-box info">{{ importFeedback }}</div>
        </template>
        <div class="form-grid">
          <label class="field-block">
            <span>&#23548;&#20837;&#36134;&#25143;</span>
            <select v-model.number="uploadForm.accountId" class="field-input">
              <option :value="null">&#35831;&#20808;&#36873;&#25321;&#36134;&#25143;</option>
              <option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.accountName }}</option>
            </select>
          </label>
          <label class="field-block">
            <span>&#26469;&#28304;&#24179;&#21488;</span>
            <select v-model="uploadForm.sourcePlatform" class="field-input">
              <option value="CSV">CSV</option>
              <option value="ALIPAY">ALIPAY</option>
              <option value="WECHAT">WECHAT</option>
              <option value="BANK">BANK</option>
            </select>
          </label>
          <label class="field-block">
            <span>&#36873;&#25321;&#25991;&#20214;</span>
            <input class="field-input file-input" type="file" accept=".csv,text/csv" @change="handleFileChange" />
          </label>
        </div>
        <div class="button-row">
          <button class="primary-button" type="button" @click="uploadBillFile">&#19978;&#20256;&#24182;&#35299;&#26512;</button>
          <span class="empty-text">{{ selectedFileName }}</span>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#23548;&#20986;" title="&#25968;&#25454;&#23548;&#20986;">
        <template #feedback>
          <div v-if="exportFeedback" class="feedback-box info">{{ exportFeedback }}</div>
        </template>
        <div class="form-grid">
          <label class="field-block">
            <span>&#23548;&#20986;&#26376;&#20221;</span>
            <input v-model="exportMonth" class="field-input" type="month" />
          </label>
          <label class="field-block">
            <span>&#35831;&#27714;&#25104;&#21592;</span>
            <select v-model.number="exportMemberId" class="field-input">
              <option :value="null">&#24403;&#21069;&#40664;&#35748;&#25104;&#21592;</option>
              <option v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <div class="field-block">
            <span>&#24555;&#36895;&#23548;&#20986;</span>
            <div class="button-row button-row-tight">
              <button class="primary-button" type="button" @click="runExport('transactions')">&#23548;&#20986;&#20132;&#26131;</button>
              <button class="ghost-button" type="button" @click="runExport('budgets')">&#23548;&#20986;&#39044;&#31639;</button>
            </div>
          </div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#26679;&#20363;" title="&#23548;&#20837;&#26679;&#20363;&#25991;&#20214;" :compact="true">
        <div class="table-list compact-table">
          <div v-for="item in sampleFiles" :key="item.href" class="table-row-three">
            <strong>{{ item.label }}</strong>
            <span>{{ item.desc }}</span>
            <a class="ghost-button small" :href="item.href" target="_blank" rel="noreferrer">&#25171;&#24320;&#26679;&#20363;</a>
          </div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#23548;&#20986;&#25688;&#35201;" title="&#23548;&#20986;&#32467;&#26524;&#25688;&#35201;" :compact="true">
        <div class="summary-grid">
          <div class="summary-item">
            <strong>&#20132;&#26131;&#23548;&#20986;</strong>
            <span>{{ exportTransactionCount }} &#20221;</span>
            <span>{{ exportTransactionMeta }}</span>
          </div>
          <div class="summary-item">
            <strong>&#39044;&#31639;&#23548;&#20986;</strong>
            <span>{{ exportBudgetCount }} &#20221;</span>
            <span>{{ exportBudgetMeta }}</span>
          </div>
        </div>
      </AdminTableCard>
    </div>

    <AdminTableCard kicker="&#24453;&#22788;&#29702;" title="&#26410;&#21305;&#37197;&#36134;&#21333;&#24402;&#31867;">
      <template #actions>
        <button class="primary-button" type="button" @click="openBatchResolve" :disabled="selectedPendingIds.length === 0">&#25209;&#37327;&#24402;&#31867;</button>
        <button class="ghost-button" type="button" @click="toggleSelectOpenPending">{{ allOpenSelected ? "&#21462;&#28040;&#20840;&#36873;" : "&#20840;&#36873;&#26410;&#35299;&#20915;" }}</button>
        <button class="ghost-button" type="button" @click="loadPendingItems">&#21047;&#26032;</button>
      </template>
      <template #filters>
        <FilterBar>
          <span class="selection-chip">&#24050;&#36873; {{ selectedPendingIds.length }} &#26465;</span>
          <label class="field-inline field-inline-short">
            <span>&#29366;&#24577;</span>
            <select v-model="pendingStatus" class="field-input" @change="loadPendingItems">
              <option value="">&#20840;&#37096;</option>
              <option value="PENDING">PENDING</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </label>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="pendingFeedback" class="feedback-box info">{{ pendingFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#36873;&#20013;</th>
              <th>&#20132;&#26131;&#20449;&#24687;</th>
              <th>&#21407;&#22987;&#20998;&#31867;</th>
              <th>&#31867;&#22411;</th>
              <th>&#37329;&#39069;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pendingItems" :key="item.id">
              <td><input type="checkbox" :checked="selectedPendingIds.includes(item.id)" :disabled="item.status === 'RESOLVED'" @change="togglePendingSelection(item.id)" /></td>
              <td>
                <div class="primary-cell">{{ item.merchantName || item.externalTradeNo || "\u5f85\u8bc6\u522b\u8d26\u5355" }}</div>
                <div class="secondary-cell">{{ formatDateTime(item.transactionTime) }} / {{ item.note || item.rawLine || "-" }}</div>
              </td>
              <td>{{ item.rawCategoryName || "-" }}</td>
              <td>{{ item.transactionType || "-" }}</td>
              <td>{{ formatAmount(item.amount) }}</td>
              <td><span class="status-badge" :class="item.status === 'RESOLVED' ? 'is-success' : 'is-warn'">{{ item.status }}</span></td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openResolveModal(item)" :disabled="item.status === 'RESOLVED'">&#24402;&#31867;</button>
                </div>
              </td>
            </tr>
            <tr v-if="pendingItems.length === 0"><td colspan="7" class="table-empty">&#24403;&#21069;&#27809;&#26377;&#24453;&#22788;&#29702;&#36134;&#21333;&#39033;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#25209;&#27425;&#19982;&#35760;&#24405;" title="&#23548;&#20837;&#25209;&#27425;&#19982;&#23548;&#20986;&#35760;&#24405;">
      <div class="panel-grid panel-grid-wide operations-grid">
        <div class="table-shell">
          <table class="admin-table">
            <thead>
              <tr>
                <th>&#23548;&#20837;&#25209;&#27425;</th>
                <th>&#26469;&#28304;</th>
                <th>&#23548;&#20837;&#32467;&#26524;</th>
                <th>&#26102;&#38388;</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in importBatches" :key="item.id">
                <td>
                  <div class="primary-cell">#{{ item.id }} / {{ item.originalFileName }}</div>
                  <div class="secondary-cell">{{ item.errorSummary || "\u65e0\u9519\u8bef\u6458\u8981" }}</div>
                </td>
                <td>{{ item.sourcePlatform }}</td>
                <td>{{ item.successCount || 0 }} / {{ item.totalCount || 0 }} ，&#26410;&#21305;&#37197; {{ item.unmatchedCount || 0 }}</td>
                <td>{{ formatDateTime(item.importedAt) }}</td>
              </tr>
              <tr v-if="importBatches.length === 0"><td colspan="4" class="table-empty">&#26242;&#26080;&#23548;&#20837;&#25209;&#27425;&#35760;&#24405;&#12290;</td></tr>
            </tbody>
          </table>
        </div>

        <div class="table-shell">
          <table class="admin-table">
            <thead>
              <tr>
                <th>&#23548;&#20986;&#25991;&#20214;</th>
                <th>&#31867;&#22411;</th>
                <th>&#29366;&#24577;</th>
                <th>&#25805;&#20316;</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in exportLogs" :key="item.id">
                <td>
                  <div class="primary-cell">{{ item.fileName || `export-${item.id}.csv` }}</div>
                  <div class="secondary-cell">{{ formatDateTime(item.completedAt || item.createdAt) }}</div>
                </td>
                <td>{{ item.exportType || "-" }}</td>
                <td><span class="status-badge" :class="item.status === 'COMPLETED' ? 'is-success' : 'is-warn'">{{ item.status || "-" }}</span></td>
                <td>
                  <div class="row-actions row-actions-left">
                    <button class="ghost-button small" type="button" @click="downloadExport(item)">&#19979;&#36733;</button>
                    <button class="ghost-button danger small" type="button" @click="deleteExport(item.id)">&#21024;&#38500;</button>
                  </div>
                </td>
              </tr>
              <tr v-if="exportLogs.length === 0"><td colspan="4" class="table-empty">&#26242;&#26080;&#23548;&#20986;&#35760;&#24405;&#12290;</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminTableCard>

    <CrudModal v-model="showResolveModal" :title="resolveModalTitle">
      <div class="form-grid">
        <label class="field-block">
          <span>&#30446;&#26631;&#20998;&#31867;</span>
          <select v-model.number="resolveForm.categoryId" class="field-input">
            <option :value="null">&#35831;&#36873;&#25321;&#20998;&#31867;</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#22788;&#29702;&#25104;&#21592;</span>
          <select v-model.number="resolveForm.resolvedByMemberId" class="field-input">
            <option :value="null">&#24403;&#21069;&#40664;&#35748;&#25104;&#21592;</option>
            <option v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#35299;&#26512;&#35268;&#21017;&#20248;&#20808;&#32423;</span>
          <input v-model.number="resolveForm.priority" class="field-input" type="number" min="1" />
        </label>
        <label class="field-toggle field-block-full">
          <input v-model="resolveForm.createParseRule" type="checkbox" />
          <span>&#21516;&#26102;&#29983;&#25104;&#36134;&#21333;&#35299;&#26512;&#35268;&#21017;</span>
        </label>
      </div>
      <div class="feedback-box info">{{ resolveTip }}</div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitResolve">&#25552;&#20132;&#24402;&#31867;</button>
      </div>
    </CrudModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import StatCard from "@/components/StatCard.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import CrudModal from "@/components/CrudModal.vue";
import FilterBar from "@/components/FilterBar.vue";
import { authStore } from "@/stores/auth";
import { accountsApi } from "@/api/accounts";
import { categoriesApi } from "@/api/categories";
import { billImportsApi } from "@/api/billImports";
import { dataExportsApi } from "@/api/dataExports";
import { usePageRefresh } from "@/composables/pageRefresh";

const familyId = computed(() => authStore.currentFamilyId);
const ownerOptions = computed(() => authStore.memberships
  .filter((item) => item.familyId === familyId.value && item.familyMemberId)
  .map((item) => ({
    value: item.familyMemberId,
    label: `${item.familyName || "\u5f53\u524d\u5bb6\u5ead"} / ${item.roleCode || "MEMBER"} / ${item.familyMemberId}`
  })));

const accounts = ref([]);
const categories = ref([]);
const importBatches = ref([]);
const pendingItems = ref([]);
const exportLogs = ref([]);
const selectedFile = ref(null);
const importFeedback = ref("");
const pendingFeedback = ref("");
const exportFeedback = ref("");
const pendingStatus = ref("PENDING");
const exportMonth = ref(currentMonth());
const exportMemberId = ref(null);
const showResolveModal = ref(false);
const selectedPendingIds = ref([]);

const uploadForm = reactive({
  accountId: null,
  sourcePlatform: "CSV"
});

const resolveForm = reactive({
  pendingItemId: null,
  categoryId: null,
  resolvedByMemberId: null,
  createParseRule: true,
  priority: 10
});

const latestImportMeta = computed(() => {
  const item = importBatches.value[0];
  return item ? `${item.importStatus || "-"} / ${formatDateTime(item.importedAt)}` : "\u6682\u65e0\u5bfc\u5165\u6279\u6b21";
});
const pendingOpenCount = computed(() => pendingItems.value.filter((item) => item.status !== "RESOLVED").length);
const pendingMeta = computed(() => `${pendingItems.value.length} \u6761\u5f53\u524d\u7b5b\u9009\u7ed3\u679c`);
const latestExportMeta = computed(() => {
  const item = exportLogs.value[0];
  return item ? `${item.exportType || "-"} / ${formatDateTime(item.completedAt || item.createdAt)}` : "\u6682\u65e0\u5bfc\u51fa\u8bb0\u5f55";
});
const exportTransactionCount = computed(() => exportLogs.value.filter((item) => item.exportType === "TRANSACTIONS").length);
const exportBudgetCount = computed(() => exportLogs.value.filter((item) => item.exportType === "BUDGETS").length);
const exportTransactionMeta = computed(() => {
  const latest = exportLogs.value.find((item) => item.exportType === "TRANSACTIONS");
  return latest ? formatDateTime(latest.completedAt || latest.createdAt) : "\u6682\u65e0\u4ea4\u6613\u5bfc\u51fa";
});
const exportBudgetMeta = computed(() => {
  const latest = exportLogs.value.find((item) => item.exportType === "BUDGETS");
  return latest ? formatDateTime(latest.completedAt || latest.createdAt) : "\u6682\u65e0\u9884\u7b97\u5bfc\u51fa";
});
const allOpenSelected = computed(() => {
  const openIds = pendingItems.value.filter((item) => item.status !== "RESOLVED").map((item) => item.id);
  return openIds.length > 0 && openIds.every((id) => selectedPendingIds.value.includes(id));
});
const selectedFileName = computed(() => selectedFile.value?.name || "\u8fd8\u672a\u9009\u62e9 CSV \u6587\u4ef6");
const resolveTip = computed(() => "\u5bf9\u4e8e\u672a\u5339\u914d\u5206\u7c7b\u7684\u8d26\u5355\u9879\uff0c\u53ef\u4ee5\u5728\u8fd9\u91cc\u5b8c\u6210\u5f52\u7c7b\uff0c\u5e76\u9009\u62e9\u662f\u5426\u540c\u65f6\u751f\u6210\u89e3\u6790\u89c4\u5219\u3002");
const resolveModalTitle = computed(() => {
  if (selectedPendingIds.value.length > 1) {
    return `\u6279\u91cf\u5f52\u7c7b ${selectedPendingIds.value.length} \u6761\u5f85\u5904\u7406\u9879`;
  }
  return `\u5f85\u5904\u7406\u9879 #${resolveForm.pendingItemId || ""} \u5f52\u7c7b`;
});
const sampleFiles = [
  {
    label: "\u6837\u4f8b\u8d26\u5355 Round 1",
    desc: "\u9996\u8f6e\u5bfc\u5165\u6d4b\u8bd5\uff0c\u542b\u672a\u5339\u914d\u5546\u6237",
    href: "/demo/samples/bill_import_sample_round1.csv"
  },
  {
    label: "\u6837\u4f8b\u8d26\u5355 Round 2",
    desc: "\u7b2c\u4e8c\u8f6e\u5bfc\u5165\u6d4b\u8bd5\uff0c\u7528\u4e8e\u9a8c\u8bc1\u89e3\u6790\u89c4\u5219",
    href: "/demo/samples/bill_import_sample_round2.csv"
  }
];

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("\u5f53\u524d\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u5bb6\u5ead\u4e0a\u4e0b\u6587\u3002");
  }
  return familyId.value;
}

function currentMemberId() {
  return authStore.memberships.find((item) => item.familyId === familyId.value)?.familyMemberId || null;
}

function handleFileChange(event) {
  selectedFile.value = event.target.files?.[0] || null;
}

function resetResolveForm() {
  Object.assign(resolveForm, {
    pendingItemId: null,
    categoryId: null,
    resolvedByMemberId: currentMemberId(),
    createParseRule: true,
    priority: 10
  });
}

function togglePendingSelection(pendingItemId) {
  if (selectedPendingIds.value.includes(pendingItemId)) {
    selectedPendingIds.value = selectedPendingIds.value.filter((id) => id !== pendingItemId);
    return;
  }
  selectedPendingIds.value = [...selectedPendingIds.value, pendingItemId];
}

function toggleSelectOpenPending() {
  const openIds = pendingItems.value.filter((item) => item.status !== "RESOLVED").map((item) => item.id);
  selectedPendingIds.value = allOpenSelected.value ? [] : openIds;
}

function openResolveModal(item) {
  selectedPendingIds.value = [item.id];
  Object.assign(resolveForm, {
    pendingItemId: item.id,
    categoryId: item.resolvedCategoryId || null,
    resolvedByMemberId: currentMemberId(),
    createParseRule: true,
    priority: 10
  });
  showResolveModal.value = true;
}

function openBatchResolve() {
  if (selectedPendingIds.value.length === 0) {
    pendingFeedback.value = "\u8bf7\u5148\u9009\u4e2d\u81f3\u5c11\u4e00\u6761\u5f85\u5904\u7406\u9879\u3002";
    return;
  }
  resetResolveForm();
  showResolveModal.value = true;
}

async function loadAccounts() {
  accounts.value = await accountsApi.listByFamily(ensureFamilyId());
  if (!uploadForm.accountId && accounts.value[0]) {
    uploadForm.accountId = accounts.value[0].id;
  }
}

async function loadCategories() {
  categories.value = await categoriesApi.listByFamily(ensureFamilyId());
}

async function loadImportBatches() {
  importBatches.value = await billImportsApi.list(ensureFamilyId());
}

async function loadPendingItems() {
  pendingItems.value = await billImportsApi.pendingItems(ensureFamilyId(), pendingStatus.value);
  const existingIds = new Set(pendingItems.value.map((item) => item.id));
  selectedPendingIds.value = selectedPendingIds.value.filter((id) => existingIds.has(id));
}

async function loadExportLogs() {
  exportLogs.value = await dataExportsApi.list(ensureFamilyId());
}

async function refreshAll() {
  if (!familyId.value) {
    importFeedback.value = "\u5f53\u524d\u8d26\u53f7\u8fd8\u6ca1\u6709\u5bb6\u5ead\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u5728\u201c\u7528\u6237\u4e0e\u5bb6\u5ead\u201d\u4e2d\u521b\u5efa\u5bb6\u5ead\u6216\u52a0\u5165\u5bb6\u5ead\u3002";
    return;
  }
  await Promise.all([loadAccounts(), loadCategories(), loadImportBatches(), loadPendingItems(), loadExportLogs()]);
}

async function uploadBillFile() {
  try {
    if (!uploadForm.accountId) {
      throw new Error("\u8bf7\u5148\u9009\u62e9\u5bfc\u5165\u8d26\u6237\u3002");
    }
    if (!selectedFile.value) {
      throw new Error("\u8bf7\u5148\u9009\u62e9 CSV \u6587\u4ef6\u3002");
    }
    const formData = new FormData();
    formData.append("file", selectedFile.value);
    const response = await billImportsApi.upload(formData, {
      familyId: ensureFamilyId(),
      uploadedByMemberId: currentMemberId(),
      accountId: uploadForm.accountId,
      sourcePlatform: uploadForm.sourcePlatform
    });
    importFeedback.value = `\u5bfc\u5165\u6210\u529f\uff1a\u6210\u529f ${response.importedCount || 0} \u6761\uff0c\u5931\u8d25 ${response.failedCount || 0} \u6761\uff0c\u672a\u5339\u914d ${response.unmatchedCount || 0} \u6761\u3002`;
    selectedFile.value = null;
    await Promise.all([loadImportBatches(), loadPendingItems()]);
  } catch (error) {
    importFeedback.value = `\u8d26\u5355\u5bfc\u5165\u5931\u8d25\uff1a${error.message}`;
  }
}

async function submitResolve() {
  try {
    const targetIds = selectedPendingIds.value.length > 0
      ? selectedPendingIds.value
      : resolveForm.pendingItemId
        ? [resolveForm.pendingItemId]
        : [];
    if (targetIds.length === 0 || !resolveForm.categoryId) {
      throw new Error("\u8bf7\u5148\u9009\u62e9\u76ee\u6807\u5206\u7c7b\u3002");
    }
    for (const pendingItemId of targetIds) {
      await billImportsApi.resolve(pendingItemId, {
        categoryId: Number(resolveForm.categoryId),
        resolvedByMemberId: resolveForm.resolvedByMemberId || currentMemberId(),
        createParseRule: resolveForm.createParseRule,
        priority: resolveForm.priority
      });
    }
    pendingFeedback.value = targetIds.length > 1
      ? `\u5df2\u6279\u91cf\u5f52\u7c7b ${targetIds.length} \u6761\u5f85\u5904\u7406\u9879\u3002`
      : "\u5f85\u5904\u7406\u9879\u5df2\u5b8c\u6210\u5f52\u7c7b\u3002";
    showResolveModal.value = false;
    selectedPendingIds.value = [];
    resetResolveForm();
    await loadPendingItems();
  } catch (error) {
    pendingFeedback.value = `\u5f52\u7c7b\u5904\u7406\u5931\u8d25\uff1a${error.message}`;
  }
}

async function runExport(type) {
  try {
    const memberId = exportMemberId.value || currentMemberId();
    const response = type === "transactions"
      ? await dataExportsApi.exportTransactions(ensureFamilyId(), memberId, exportMonth.value)
      : await dataExportsApi.exportBudgets(ensureFamilyId(), memberId, exportMonth.value);
    exportFeedback.value = `${type === "transactions" ? "\u4ea4\u6613" : "\u9884\u7b97"}\u5bfc\u51fa\u5df2\u751f\u6210\uff0c\u5171 ${response.rowCount || 0} \u884c\u3002`;
    await loadExportLogs();
  } catch (error) {
    exportFeedback.value = `\u5bfc\u51fa\u5931\u8d25\uff1a${error.message}`;
  }
}

async function downloadExport(item) {
  try {
    const blob = await dataExportsApi.download(item.id);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.fileName || `export-${item.id}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    exportFeedback.value = `\u4e0b\u8f7d\u5bfc\u51fa\u6587\u4ef6\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteExport(exportId) {
  try {
    await dataExportsApi.remove(exportId);
    await loadExportLogs();
  } catch (error) {
    exportFeedback.value = `\u5220\u9664\u5bfc\u51fa\u8bb0\u5f55\u5931\u8d25\uff1a${error.message}`;
  }
}

function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function formatAmount(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

onMounted(async () => {
  resetResolveForm();
  try {
    await refreshAll();
  } catch (error) {
    importFeedback.value = `\u6570\u636e\u4f5c\u4e1a\u521d\u59cb\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
});

usePageRefresh(refreshAll);
</script>
