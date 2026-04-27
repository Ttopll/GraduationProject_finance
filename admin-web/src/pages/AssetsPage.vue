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
        &#36164;&#20135;&#19982;&#36127;&#20538;&#37117;&#20381;&#36182;&#24403;&#21069;&#23478;&#24237;&#19978;&#19979;&#25991;&#12290;&#35831;&#20808;&#22312;&#8220;&#29992;&#25143;&#19982;&#23478;&#24237;&#8221;&#39029;&#23436;&#25104;&#23478;&#24237;&#21019;&#24314;&#25110;&#21152;&#20837;&#12290;
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="familyId || '-'" meta="&#22266;&#23450;&#36164;&#20135;&#12289;&#20538;&#21153;&#21644;&#20928;&#36164;&#20135;&#37117;&#32465;&#23450; familyId" />
      <StatCard label="&#20928;&#36164;&#20135;" :value="formatAmount(overview.netAssetValue)" :meta="overviewMeta" />
      <StatCard label="&#22266;&#23450;&#36164;&#20135;&#25968;" :value="assets.length" :meta="formatAmount(overview.totalFixedAssetValue)" />
      <StatCard label="&#20538;&#21153;&#25968;" :value="debts.length" :meta="formatAmount(overview.totalDebtBalance)" />
    </div>

    <AdminTableCard kicker="&#20928;&#36164;&#20135;" title="&#36164;&#20135;&#36127;&#20538;&#27010;&#35272;">
      <template #actions>
        <button class="ghost-button" type="button" @click="refreshAll">&#21047;&#26032;</button>
        <button class="ghost-button" type="button" @click="checkReminders">&#26816;&#26597;&#20538;&#21153;&#25552;&#37266;</button>
      </template>
      <template #feedback>
        <div v-if="pageFeedback" class="feedback-box info">{{ pageFeedback }}</div>
      </template>
      <div class="summary-grid">
        <div class="summary-item">
          <strong>&#36134;&#25143;&#24635;&#20313;&#39069;</strong>
          <span>{{ formatAmount(overview.totalAccountBalance) }}</span>
          <span>{{ overview.accountCount || 0 }} &#20010;&#36134;&#25143;</span>
        </div>
        <div class="summary-item">
          <strong>&#22266;&#23450;&#36164;&#20135;&#24635;&#20540;</strong>
          <span>{{ formatAmount(overview.totalFixedAssetValue) }}</span>
          <span>{{ overview.fixedAssetCount || 0 }} &#39033;&#36164;&#20135;</span>
        </div>
        <div class="summary-item">
          <strong>&#20538;&#21153;&#20313;&#39069;</strong>
          <span>{{ formatAmount(overview.totalDebtBalance) }}</span>
          <span>{{ overview.debtCount || 0 }} &#26465;&#20538;&#21153;</span>
        </div>
        <div class="summary-item">
          <strong>&#24635;&#36164;&#20135;</strong>
          <span>{{ formatAmount(overview.totalAssetValue) }}</span>
          <span :class="netAssetClass">{{ netAssetLabel }}</span>
        </div>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#22266;&#23450;&#36164;&#20135;" title="&#22266;&#23450;&#36164;&#20135;&#31649;&#29702;">
      <template #actions>
        <button class="primary-button" type="button" @click="openAssetCreate">&#26032;&#22686;&#36164;&#20135;</button>
        <button class="ghost-button" type="button" @click="loadAssets">&#21047;&#26032;</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline field-inline-short">
            <span>&#36164;&#20135;&#31867;&#22411;</span>
            <select v-model="assetFilter.assetType" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="HOUSE">&#25151;&#20135;</option>
              <option value="CAR">&#36710;&#36742;</option>
              <option value="EQUITY">&#26435;&#30410;</option>
              <option value="DEPOSIT">&#23450;&#23384;</option>
              <option value="OTHER">&#20854;&#20182;</option>
            </select>
          </label>
          <label class="field-inline field-inline-short">
            <span>&#29366;&#24577;</span>
            <select v-model="assetFilter.status" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="1">&#21551;&#29992;</option>
              <option value="0">&#20572;&#29992;</option>
            </select>
          </label>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="assetFeedback" class="feedback-box info">{{ assetFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#36164;&#20135;&#20449;&#24687;</th>
              <th>&#31867;&#22411;</th>
              <th>&#25152;&#23646;&#25104;&#21592;</th>
              <th>&#20080;&#20837;&#37329;&#39069;</th>
              <th>&#20272;&#20540;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredAssets" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.assetName }}</div>
                <div class="secondary-cell">{{ item.remark || "\u65e0\u5907\u6ce8" }}</div>
              </td>
              <td>{{ assetTypeLabel(item.assetType) }}</td>
              <td>{{ ownerName(item.ownerMemberId) }}</td>
              <td>{{ formatAmount(item.purchaseAmount) }}</td>
              <td>{{ formatAmount(item.effectiveValue) }}</td>
              <td><span class="status-badge" :class="item.status === 1 ? 'is-success' : 'is-muted'">{{ item.status === 1 ? "\u542f\u7528" : "\u505c\u7528" }}</span></td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openAssetEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="toggleAsset(item)">{{ item.status === 1 ? "\u505c\u7528" : "\u542f\u7528" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteAsset(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredAssets.length === 0"><td colspan="7" class="table-empty">&#24403;&#21069;&#31579;&#36873;&#26465;&#20214;&#19979;&#26242;&#26080;&#22266;&#23450;&#36164;&#20135;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#20538;&#21153;" title="&#20538;&#21153;&#31649;&#29702;">
      <template #actions>
        <button class="primary-button" type="button" @click="openDebtCreate">&#26032;&#22686;&#20538;&#21153;</button>
        <button class="ghost-button" type="button" @click="loadDebts">&#21047;&#26032;</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline field-inline-short">
            <span>&#20538;&#21153;&#31867;&#22411;</span>
            <select v-model="debtFilter.debtType" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="MORTGAGE">&#25151;&#36151;</option>
              <option value="CAR_LOAN">&#36710;&#36151;</option>
              <option value="CREDIT_CARD">&#20449;&#29992;&#21345;</option>
              <option value="CONSUMER_LOAN">&#28040;&#36153;&#36151;</option>
              <option value="PRIVATE_LOAN">&#31169;&#20154;&#20511;&#27454;</option>
              <option value="OTHER">&#20854;&#20182;</option>
            </select>
          </label>
          <label class="field-inline field-inline-short">
            <span>&#29366;&#24577;</span>
            <select v-model="debtFilter.status" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="ACTIVE">&#26410;&#32467;&#28165;</option>
              <option value="CLEARED">&#24050;&#32467;&#28165;</option>
            </select>
          </label>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="debtFeedback" class="feedback-box info">{{ debtFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#20538;&#21153;&#20449;&#24687;</th>
              <th>&#31867;&#22411;</th>
              <th>&#20538;&#21153;&#20154;</th>
              <th>&#26412;&#37329;</th>
              <th>&#24403;&#21069;&#20313;&#39069;</th>
              <th>&#21040;&#26399;&#26085;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredDebts" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.debtName }}</div>
                <div class="secondary-cell">{{ item.lenderName || "\u672a\u586b\u5199\u503a\u6743\u65b9" }} / {{ item.remark || "\u65e0\u5907\u6ce8" }}</div>
              </td>
              <td>{{ debtTypeLabel(item.debtType) }}</td>
              <td>{{ ownerName(item.debtorMemberId) }}</td>
              <td>{{ formatAmount(item.principalAmount) }}</td>
              <td>{{ formatAmount(item.currentBalance) }}</td>
              <td>{{ item.dueDate || "-" }}</td>
              <td><span class="status-badge" :class="item.status === 'ACTIVE' ? 'is-warn' : 'is-muted'">{{ debtStatusLabel(item.status) }}</span></td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openDebtEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="openRepayment(item)">&#36824;&#27454;</button>
                  <button class="ghost-button small" type="button" @click="clearDebt(item.id)">&#32467;&#28165;</button>
                  <button class="ghost-button danger small" type="button" @click="deleteDebt(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredDebts.length === 0"><td colspan="8" class="table-empty">&#24403;&#21069;&#31579;&#36873;&#26465;&#20214;&#19979;&#26242;&#26080;&#20538;&#21153;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#36824;&#27454;&#35760;&#24405;" title="&#26368;&#36817;&#36824;&#27454;&#26126;&#32454;" :compact="true">
        <template #actions>
          <button class="ghost-button" type="button" @click="loadRepaymentsForCurrent">&#21047;&#26032;</button>
        </template>
        <div class="table-list compact-table">
          <div v-for="item in repaymentItems" :key="item.id" class="table-row-four">
            <strong>{{ currentDebtName }}</strong>
            <span>{{ formatAmount(item.amount) }}</span>
            <span>{{ formatDateTime(item.repaymentTime) }}</span>
            <span>{{ item.note || "\u65e0\u5907\u6ce8" }}</span>
          </div>
          <div v-if="repaymentItems.length === 0" class="empty-text">&#35831;&#20808;&#28857;&#20987;&#26576;&#26465;&#20538;&#21153;&#30340;&#8220;&#36824;&#27454;&#8221;&#65292;&#25110;&#24403;&#21069;&#26242;&#26080;&#36824;&#27454;&#35760;&#24405;&#12290;</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#25552;&#37266;" title="&#20538;&#21153;&#21040;&#26399;&#25552;&#37266;" :compact="true">
        <div class="conclusion-list">
          <li v-for="item in reminderDetails" :key="item">{{ item }}</li>
          <li v-if="reminderDetails.length === 0">&#26242;&#26080;&#21040;&#26399;&#25552;&#37266;&#32467;&#26524;&#12290;</li>
        </div>
      </AdminTableCard>
    </div>

    <CrudModal v-model="showAssetModal" :title="assetForm.id ? '\u7f16\u8f91\u56fa\u5b9a\u8d44\u4ea7' : '\u65b0\u589e\u56fa\u5b9a\u8d44\u4ea7'">
      <div class="form-grid">
        <label class="field-block"><span>&#36164;&#20135;&#21517;&#31216;</span><input v-model.trim="assetForm.assetName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#36164;&#20135;&#31867;&#22411;</span><select v-model="assetForm.assetType" class="field-input"><option value="HOUSE">&#25151;&#20135;</option><option value="CAR">&#36710;&#36742;</option><option value="EQUITY">&#26435;&#30410;</option><option value="DEPOSIT">&#23450;&#23384;</option><option value="OTHER">&#20854;&#20182;</option></select></label>
        <label class="field-block"><span>&#25152;&#23646;&#25104;&#21592;</span><select v-model.number="assetForm.ownerMemberId" class="field-input"><option :value="null">&#23478;&#24237;&#32479;&#19968;&#36164;&#20135;</option><option v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
        <label class="field-block"><span>&#20080;&#20837;&#37329;&#39069;</span><input v-model.number="assetForm.purchaseAmount" class="field-input" type="number" min="0.01" step="0.01" /></label>
        <label class="field-block"><span>&#20080;&#20837;&#26085;&#26399;</span><input v-model="assetForm.purchaseDate" class="field-input" type="date" /></label>
        <label class="field-block"><span>&#26368;&#26032;&#20272;&#20540;</span><input v-model.number="assetForm.valuationAmount" class="field-input" type="number" min="0" step="0.01" /></label>
        <label class="field-block"><span>&#20272;&#20540;&#26085;&#26399;</span><input v-model="assetForm.valuationDate" class="field-input" type="date" /></label>
        <label class="field-block field-block-full"><span>&#22791;&#27880;</span><input v-model.trim="assetForm.remark" class="field-input" type="text" /></label>
      </div>
      <div class="feedback-box info">{{ assetFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitAsset">{{ assetForm.id ? "\u4fdd\u5b58\u8d44\u4ea7" : "\u521b\u5efa\u8d44\u4ea7" }}</button></div>
    </CrudModal>

    <CrudModal v-model="showDebtModal" :title="debtForm.id ? '\u7f16\u8f91\u503a\u52a1' : '\u65b0\u589e\u503a\u52a1'">
      <div class="form-grid">
        <label class="field-block"><span>&#20538;&#21153;&#21517;&#31216;</span><input v-model.trim="debtForm.debtName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#20538;&#21153;&#31867;&#22411;</span><select v-model="debtForm.debtType" class="field-input"><option value="MORTGAGE">&#25151;&#36151;</option><option value="CAR_LOAN">&#36710;&#36151;</option><option value="CREDIT_CARD">&#20449;&#29992;&#21345;</option><option value="CONSUMER_LOAN">&#28040;&#36153;&#36151;</option><option value="PRIVATE_LOAN">&#31169;&#20154;&#20511;&#27454;</option><option value="OTHER">&#20854;&#20182;</option></select></label>
        <label class="field-block"><span>&#20538;&#21153;&#20154;</span><select v-model.number="debtForm.debtorMemberId" class="field-input"><option :value="null">&#24403;&#21069;&#40664;&#35748;&#25104;&#21592;</option><option v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
        <label class="field-block"><span>&#20538;&#26435;&#26041;</span><input v-model.trim="debtForm.lenderName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#26412;&#37329;</span><input v-model.number="debtForm.principalAmount" class="field-input" type="number" min="0.01" step="0.01" /></label>
        <label class="field-block"><span>&#24180;&#21033;&#29575;</span><input v-model.number="debtForm.annualRate" class="field-input" type="number" min="0" step="0.01" /></label>
        <label class="field-block"><span>&#36134;&#21333;&#26085;</span><input v-model.number="debtForm.billingDay" class="field-input" type="number" min="1" max="31" /></label>
        <label class="field-block"><span>&#36824;&#27454;&#26085;</span><input v-model.number="debtForm.repaymentDay" class="field-input" type="number" min="1" max="31" /></label>
        <label class="field-block"><span>&#21040;&#26399;&#26085;</span><input v-model="debtForm.dueDate" class="field-input" type="date" /></label>
        <label class="field-block field-block-full"><span>&#22791;&#27880;</span><input v-model.trim="debtForm.remark" class="field-input" type="text" /></label>
      </div>
      <div class="feedback-box info">{{ debtFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitDebt">{{ debtForm.id ? "\u4fdd\u5b58\u503a\u52a1" : "\u521b\u5efa\u503a\u52a1" }}</button></div>
    </CrudModal>

    <CrudModal v-model="showRepaymentModal" :title="`\u4e3a ${currentDebtName} \u65b0\u589e\u8fd8\u6b3e`">
      <div class="form-grid">
        <label class="field-block"><span>&#25171;&#27454;&#36134;&#25143;</span><select v-model.number="repaymentForm.payAccountId" class="field-input"><option :value="null">&#19981;&#32465;&#23450;&#36134;&#25143;</option><option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.accountName }}</option></select></label>
        <label class="field-block"><span>&#36824;&#27454;&#37329;&#39069;</span><input v-model.number="repaymentForm.amount" class="field-input" type="number" min="0.01" step="0.01" /></label>
        <label class="field-block"><span>&#26412;&#37329;&#20551;&#35774;</span><input v-model.number="repaymentForm.principalPaid" class="field-input" type="number" min="0" step="0.01" /></label>
        <label class="field-block"><span>&#21033;&#24687;&#20551;&#35774;</span><input v-model.number="repaymentForm.interestPaid" class="field-input" type="number" min="0" step="0.01" /></label>
        <label class="field-block"><span>&#36824;&#27454;&#26102;&#38388;</span><input v-model="repaymentForm.repaymentTime" class="field-input" type="datetime-local" /></label>
        <label class="field-block field-block-full"><span>&#22791;&#27880;</span><input v-model.trim="repaymentForm.note" class="field-input" type="text" /></label>
      </div>
      <div class="feedback-box info">{{ repaymentFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitRepayment">&#25552;&#20132;&#36824;&#27454;</button></div>
    </CrudModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import StatCard from "@/components/StatCard.vue";
import CrudModal from "@/components/CrudModal.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import FilterBar from "@/components/FilterBar.vue";
import { authStore } from "@/stores/auth";
import { accountsApi } from "@/api/accounts";
import { fixedAssetsApi } from "@/api/fixedAssets";
import { debtsApi } from "@/api/debts";
import { usePageRefresh } from "@/composables/pageRefresh";

const familyId = computed(() => authStore.currentFamilyId);
const ownerOptions = computed(() => authStore.memberships
  .filter((item) => item.familyId === familyId.value && item.familyMemberId)
  .map((item) => ({
    value: item.familyMemberId,
    label: `${item.familyName || "\u5f53\u524d\u5bb6\u5ead"} / ${item.roleCode || "MEMBER"} / ${item.familyMemberId}`
  })));

const accounts = ref([]);
const assets = ref([]);
const debts = ref([]);
const repaymentItems = ref([]);
const selectedDebt = ref(null);
const reminderDetails = ref([]);
const pageFeedback = ref("");
const assetFeedback = ref("");
const debtFeedback = ref("");
const assetFilter = reactive({
  assetType: "",
  status: ""
});
const debtFilter = reactive({
  debtType: "",
  status: ""
});
const overview = reactive({
  totalAccountBalance: 0,
  totalFixedAssetValue: 0,
  totalDebtBalance: 0,
  totalAssetValue: 0,
  netAssetValue: 0,
  accountCount: 0,
  fixedAssetCount: 0,
  debtCount: 0
});

const showAssetModal = ref(false);
const showDebtModal = ref(false);
const showRepaymentModal = ref(false);

const assetForm = reactive({
  id: null,
  ownerMemberId: null,
  assetName: "",
  assetType: "HOUSE",
  purchaseAmount: 0,
  purchaseDate: "",
  valuationAmount: null,
  valuationDate: "",
  remark: ""
});

const debtForm = reactive({
  id: null,
  debtorMemberId: null,
  debtName: "",
  debtType: "MORTGAGE",
  lenderName: "",
  principalAmount: 0,
  annualRate: 0,
  billingDay: null,
  repaymentDay: null,
  dueDate: "",
  remark: ""
});

const repaymentForm = reactive({
  debtId: null,
  payAccountId: null,
  amount: 0,
  principalPaid: 0,
  interestPaid: 0,
  repaymentTime: currentDateTimeLocal(),
  note: ""
});

const overviewMeta = computed(() => `\u603b\u8d44\u4ea7 ${formatAmount(overview.totalAssetValue)} / \u603b\u8d1f\u503a ${formatAmount(overview.totalDebtBalance)}`);
const netAssetClass = computed(() => Number(overview.netAssetValue || 0) >= 0 ? "summary-normal" : "summary-danger");
const netAssetLabel = computed(() => Number(overview.netAssetValue || 0) >= 0 ? "\u51c0\u8d44\u4ea7\u4e3a\u6b63" : "\u51c0\u8d44\u4ea7\u4e3a\u8d1f");
const currentDebtName = computed(() => selectedDebt.value?.debtName || "\u5f53\u524d\u503a\u52a1");
const filteredAssets = computed(() => assets.value.filter((item) => {
  if (assetFilter.assetType && item.assetType !== assetFilter.assetType) {
    return false;
  }
  if (assetFilter.status !== "" && Number(item.status) !== Number(assetFilter.status)) {
    return false;
  }
  return true;
}));
const filteredDebts = computed(() => debts.value.filter((item) => {
  if (debtFilter.debtType && item.debtType !== debtFilter.debtType) {
    return false;
  }
  if (debtFilter.status && item.status !== debtFilter.status) {
    return false;
  }
  return true;
}));
const assetFormTip = computed(() => "\u56fa\u5b9a\u8d44\u4ea7\u5efa\u8bae\u81f3\u5c11\u7ef4\u62a4\u8d44\u4ea7\u540d\u79f0\u3001\u7c7b\u578b\u3001\u8d2d\u5165\u91d1\u989d\u4e0e\u6700\u65b0\u4f30\u503c\uff0c\u65b9\u4fbf\u540e\u7eed\u51c0\u8d44\u4ea7\u53e3\u5f84\u5c55\u793a\u3002");
const debtFormTip = computed(() => "\u503a\u52a1\u53f0\u8d26\u9700\u8981\u4fdd\u8bc1\u672c\u91d1\u548c\u8fd8\u6b3e\u5468\u671f\u4fe1\u606f\u5b8c\u6574\uff0c\u4fbf\u4e8e\u540e\u7eed\u89c4\u5219\u63d0\u9192\u4e0e\u8d44\u4ea7\u8d1f\u503a\u5206\u6790\u3002");
const repaymentFormTip = computed(() => "\u8fd8\u6b3e\u91d1\u989d\u5e94\u8be5\u5927\u4e8e 0\uff0c\u53ef\u4ee5\u540c\u65f6\u5206\u62c6\u4e3a\u672c\u91d1\u548c\u5229\u606f\u90e8\u5206\uff0c\u7528\u4e8e\u540e\u7eed\u660e\u7ec6\u8bb0\u5f55\u3002");

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("\u5f53\u524d\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u5bb6\u5ead\u4e0a\u4e0b\u6587\u3002");
  }
  return familyId.value;
}

function currentMemberId() {
  return authStore.memberships.find((item) => item.familyId === familyId.value)?.familyMemberId || null;
}

function resetAssetForm() {
  Object.assign(assetForm, {
    id: null,
    ownerMemberId: currentMemberId(),
    assetName: "",
    assetType: "HOUSE",
    purchaseAmount: 0,
    purchaseDate: "",
    valuationAmount: null,
    valuationDate: "",
    remark: ""
  });
}

function resetDebtForm() {
  Object.assign(debtForm, {
    id: null,
    debtorMemberId: currentMemberId(),
    debtName: "",
    debtType: "MORTGAGE",
    lenderName: "",
    principalAmount: 0,
    annualRate: 0,
    billingDay: null,
    repaymentDay: null,
    dueDate: "",
    remark: ""
  });
}

function resetRepaymentForm(debtId = null) {
  Object.assign(repaymentForm, {
    debtId,
    payAccountId: null,
    amount: 0,
    principalPaid: 0,
    interestPaid: 0,
    repaymentTime: currentDateTimeLocal(),
    note: ""
  });
}

function openAssetCreate() {
  resetAssetForm();
  showAssetModal.value = true;
}

function openAssetEdit(item) {
  Object.assign(assetForm, {
    id: item.id,
    ownerMemberId: item.ownerMemberId,
    assetName: item.assetName,
    assetType: item.assetType,
    purchaseAmount: item.purchaseAmount || 0,
    purchaseDate: item.purchaseDate || "",
    valuationAmount: item.valuationAmount,
    valuationDate: item.valuationDate || "",
    remark: item.remark || ""
  });
  showAssetModal.value = true;
}

function openDebtCreate() {
  resetDebtForm();
  showDebtModal.value = true;
}

function openDebtEdit(item) {
  Object.assign(debtForm, {
    id: item.id,
    debtorMemberId: item.debtorMemberId,
    debtName: item.debtName,
    debtType: item.debtType,
    lenderName: item.lenderName || "",
    principalAmount: item.principalAmount || 0,
    annualRate: item.annualRate || 0,
    billingDay: item.billingDay,
    repaymentDay: item.repaymentDay,
    dueDate: item.dueDate || "",
    remark: item.remark || ""
  });
  showDebtModal.value = true;
}

async function openRepayment(item) {
  selectedDebt.value = item;
  resetRepaymentForm(item.id);
  showRepaymentModal.value = true;
  await loadRepaymentsForCurrent();
}

async function loadAccounts() {
  accounts.value = await accountsApi.listByFamily(ensureFamilyId());
}

async function loadOverview() {
  const response = await fixedAssetsApi.overview(ensureFamilyId());
  Object.assign(overview, response || {});
}

async function loadAssets() {
  assets.value = await fixedAssetsApi.listByFamily(ensureFamilyId());
}

async function loadDebts() {
  debts.value = await debtsApi.listByFamily(ensureFamilyId());
}

async function loadRepaymentsForCurrent() {
  if (!selectedDebt.value?.id) {
    repaymentItems.value = [];
    return;
  }
  repaymentItems.value = await debtsApi.repaymentList(selectedDebt.value.id);
}

async function checkReminders() {
  try {
    const result = await debtsApi.checkReminders(ensureFamilyId(), 7);
    reminderDetails.value = result.details || [];
    pageFeedback.value = `\u5df2\u68c0\u67e5 ${result.reminderCount || 0} \u6761\u503a\u52a1\u63d0\u9192\u3002`;
  } catch (error) {
    pageFeedback.value = `\u503a\u52a1\u63d0\u9192\u68c0\u67e5\u5931\u8d25\uff1a${error.message}`;
  }
}

async function refreshAll() {
  if (!familyId.value) {
    pageFeedback.value = "\u5f53\u524d\u8d26\u53f7\u8fd8\u6ca1\u6709\u5bb6\u5ead\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u5728\u201c\u7528\u6237\u4e0e\u5bb6\u5ead\u201d\u4e2d\u521b\u5efa\u5bb6\u5ead\u6216\u52a0\u5165\u5bb6\u5ead\u3002";
    return;
  }
  await Promise.all([loadAccounts(), loadOverview(), loadAssets(), loadDebts(), loadRepaymentsForCurrent()]);
}

async function submitAsset() {
  try {
    validateAssetForm();
    if (assetForm.id) {
      await fixedAssetsApi.update(assetForm.id, buildAssetPayload());
      assetFeedback.value = "\u56fa\u5b9a\u8d44\u4ea7\u5df2\u66f4\u65b0\u3002";
    } else {
      await fixedAssetsApi.create({ familyId: ensureFamilyId(), ...buildAssetPayload() });
      assetFeedback.value = "\u56fa\u5b9a\u8d44\u4ea7\u5df2\u521b\u5efa\u3002";
    }
    showAssetModal.value = false;
    resetAssetForm();
    await Promise.all([loadOverview(), loadAssets()]);
  } catch (error) {
    assetFeedback.value = `\u56fa\u5b9a\u8d44\u4ea7\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

async function toggleAsset(item) {
  try {
    if (item.status === 1) {
      await fixedAssetsApi.disable(item.id);
    } else {
      await fixedAssetsApi.enable(item.id);
    }
    await Promise.all([loadOverview(), loadAssets()]);
  } catch (error) {
    assetFeedback.value = `\u8d44\u4ea7\u72b6\u6001\u5207\u6362\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteAsset(id) {
  try {
    await fixedAssetsApi.remove(id);
    await Promise.all([loadOverview(), loadAssets()]);
  } catch (error) {
    assetFeedback.value = `\u8d44\u4ea7\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

async function submitDebt() {
  try {
    validateDebtForm();
    if (debtForm.id) {
      await debtsApi.update(debtForm.id, buildDebtPayload());
      debtFeedback.value = "\u503a\u52a1\u5df2\u66f4\u65b0\u3002";
    } else {
      await debtsApi.create({ familyId: ensureFamilyId(), ...buildDebtPayload() });
      debtFeedback.value = "\u503a\u52a1\u5df2\u521b\u5efa\u3002";
    }
    showDebtModal.value = false;
    resetDebtForm();
    await Promise.all([loadOverview(), loadDebts()]);
  } catch (error) {
    debtFeedback.value = `\u503a\u52a1\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

async function clearDebt(id) {
  try {
    await debtsApi.clear(id);
    debtFeedback.value = "\u503a\u52a1\u5df2\u7ed3\u6e05\u3002";
    await Promise.all([loadOverview(), loadDebts(), loadRepaymentsForCurrent()]);
  } catch (error) {
    debtFeedback.value = `\u503a\u52a1\u7ed3\u6e05\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteDebt(id) {
  try {
    await debtsApi.remove(id);
    if (selectedDebt.value?.id === id) {
      selectedDebt.value = null;
      repaymentItems.value = [];
    }
    await Promise.all([loadOverview(), loadDebts()]);
  } catch (error) {
    debtFeedback.value = `\u503a\u52a1\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

async function submitRepayment() {
  try {
    validateRepaymentForm();
    await debtsApi.repay(requiredNumber(repaymentForm.debtId), buildRepaymentPayload());
    showRepaymentModal.value = false;
    debtFeedback.value = "\u8fd8\u6b3e\u8bb0\u5f55\u5df2\u63d0\u4ea4\u3002";
    await Promise.all([loadOverview(), loadDebts(), loadRepaymentsForCurrent()]);
  } catch (error) {
    debtFeedback.value = `\u8fd8\u6b3e\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

function validateAssetForm() {
  if (!assetForm.assetName.trim()) {
    throw new Error("\u8bf7\u586b\u5199\u8d44\u4ea7\u540d\u79f0\u3002");
  }
  if (!assetForm.purchaseAmount || Number(assetForm.purchaseAmount) <= 0) {
    throw new Error("\u8bf7\u586b\u5199\u5927\u4e8e 0 \u7684\u8d2d\u5165\u91d1\u989d\u3002");
  }
}

function validateDebtForm() {
  if (!debtForm.debtName.trim()) {
    throw new Error("\u8bf7\u586b\u5199\u503a\u52a1\u540d\u79f0\u3002");
  }
  if (!debtForm.principalAmount || Number(debtForm.principalAmount) <= 0) {
    throw new Error("\u503a\u52a1\u672c\u91d1\u5fc5\u987b\u5927\u4e8e 0\u3002");
  }
}

function validateRepaymentForm() {
  if (!repaymentForm.debtId) {
    throw new Error("\u5f53\u524d\u6ca1\u6709\u9009\u4e2d\u503a\u52a1\u3002");
  }
  if (!repaymentForm.amount || Number(repaymentForm.amount) <= 0) {
    throw new Error("\u8fd8\u6b3e\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0\u3002");
  }
}

function buildAssetPayload() {
  return {
    ownerMemberId: nullableNumber(assetForm.ownerMemberId),
    assetName: assetForm.assetName,
    assetType: assetForm.assetType,
    purchaseAmount: assetForm.purchaseAmount,
    purchaseDate: assetForm.purchaseDate || null,
    valuationAmount: nullableDecimal(assetForm.valuationAmount),
    valuationDate: assetForm.valuationDate || null,
    remark: assetForm.remark || null
  };
}

function buildDebtPayload() {
  return {
    debtorMemberId: nullableNumber(debtForm.debtorMemberId),
    debtName: debtForm.debtName,
    debtType: debtForm.debtType,
    lenderName: debtForm.lenderName || null,
    principalAmount: debtForm.principalAmount,
    annualRate: nullableDecimal(debtForm.annualRate),
    billingDay: nullableNumber(debtForm.billingDay),
    repaymentDay: nullableNumber(debtForm.repaymentDay),
    dueDate: debtForm.dueDate || null,
    remark: debtForm.remark || null
  };
}

function buildRepaymentPayload() {
  return {
    familyId: ensureFamilyId(),
    payAccountId: nullableNumber(repaymentForm.payAccountId),
    createdByMemberId: currentMemberId(),
    amount: repaymentForm.amount,
    principalPaid: nullableDecimal(repaymentForm.principalPaid),
    interestPaid: nullableDecimal(repaymentForm.interestPaid),
    repaymentTime: toApiDateTime(repaymentForm.repaymentTime),
    note: repaymentForm.note || null
  };
}

function requiredNumber(value) {
  if (value === null || value === undefined || value === "") {
    throw new Error("\u5fc5\u586b\u9009\u62e9\u9879\u4e0d\u80fd\u4e3a\u7a7a\u3002");
  }
  return Number(value);
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(value);
}

function nullableDecimal(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(value);
}

function toApiDateTime(value) {
  if (!value) {
    return "";
  }
  return value.length === 16 ? `${value}:00` : value;
}

function currentDateTimeLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
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

function ownerName(memberId) {
  if (!memberId) {
    return "\u5bb6\u5ead\u7edf\u4e00";
  }
  return ownerOptions.value.find((item) => item.value === memberId)?.label || `\u6210\u5458 #${memberId}`;
}

function assetTypeLabel(value) {
  return {
    HOUSE: "\u623f\u4ea7",
    CAR: "\u8f66\u8f86",
    EQUITY: "\u6743\u76ca",
    DEPOSIT: "\u5b9a\u5b58",
    OTHER: "\u5176\u4ed6"
  }[value] || value || "-";
}

function debtTypeLabel(value) {
  return {
    MORTGAGE: "\u623f\u8d37",
    CAR_LOAN: "\u8f66\u8d37",
    CREDIT_CARD: "\u4fe1\u7528\u5361",
    CONSUMER_LOAN: "\u6d88\u8d39\u8d37",
    PRIVATE_LOAN: "\u79c1\u4eba\u501f\u6b3e",
    OTHER: "\u5176\u4ed6"
  }[value] || value || "-";
}

function debtStatusLabel(value) {
  return {
    ACTIVE: "\u672a\u7ed3\u6e05",
    CLEARED: "\u5df2\u7ed3\u6e05"
  }[value] || value || "-";
}

onMounted(async () => {
  try {
    await refreshAll();
  } catch (error) {
    pageFeedback.value = `\u8d44\u4ea7\u8d1f\u503a\u521d\u59cb\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
});

usePageRefresh(refreshAll);
</script>
