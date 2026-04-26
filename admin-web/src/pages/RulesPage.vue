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
        &#35268;&#21017;&#23450;&#20041;&#21644;&#36890;&#30693;&#26597;&#35810;&#37117;&#20381;&#36182;&#23478;&#24237;&#33539;&#22260;&#12290;&#35831;&#20808;&#21069;&#24448;&#8220;&#29992;&#25143;&#19982;&#23478;&#24237;&#8221;&#39029;&#38754;&#21019;&#24314;&#23478;&#24237;&#25110;&#36890;&#36807;&#36992;&#35831;&#30721;&#21152;&#20837;&#23478;&#24237;&#12290;
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="familyId || '-'" meta="&#35268;&#21017;&#21644;&#36890;&#30693;&#37117;&#20351;&#29992;&#24403;&#21069; familyId" />
      <StatCard label="&#35268;&#21017;&#25968;" :value="rules.length" meta="&#24403;&#21069;&#23478;&#24237;&#30340;&#39044;&#35686;&#35268;&#21017;&#23450;&#20041;" />
      <StatCard label="&#26410;&#35835;&#36890;&#30693;" :value="unreadCount" :meta="notificationMeta" />
      <StatCard label="&#26368;&#36817;&#35780;&#20272;" :value="evaluationSummary" :meta="evaluationMeta" />
    </div>

    <AdminTableCard kicker="&#35268;&#21017;" title="&#35268;&#21017;&#31649;&#29702;">
      <template #actions>
        <label class="field-inline field-inline-short">
          <span>&#35780;&#20272;&#26376;&#20221;</span>
          <input v-model="evaluationMonth" class="field-input" type="month" />
        </label>
        <button class="ghost-button" type="button" @click="evaluateRules">&#25191;&#34892;&#35780;&#20272;</button>
        <button class="primary-button" type="button" @click="openRuleCreate">&#26032;&#22686;&#35268;&#21017;</button>
        <button class="ghost-button" type="button" @click="loadRules">&#21047;&#26032;</button>
      </template>
      <template #feedback>
        <div v-if="ruleFeedback" class="feedback-box info">{{ ruleFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#35268;&#21017;&#20449;&#24687;</th>
              <th>&#25351;&#26631;&#26465;&#20214;</th>
              <th>&#26102;&#38388;&#33539;&#22260;</th>
              <th>&#20851;&#32852;&#20998;&#31867;</th>
              <th>&#20248;&#20808;&#32423;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rules" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.ruleName }}</div>
                <div class="secondary-cell">
                  {{ ruleTypeLabel(item.ruleType) }} / {{ actionTypeLabel(item.actionType) }} / {{ item.messageTemplate || "-" }}
                </div>
              </td>
              <td>{{ metricTypeLabel(item.metricType) }} {{ operatorTypeLabel(item.operatorType) }} {{ item.thresholdValue }}</td>
              <td>{{ timeScopeLabel(item.timeScope) }}</td>
              <td>{{ categoryName(item.categoryId) }}</td>
              <td>{{ item.priority ?? "-" }}</td>
              <td>
                <span class="status-badge" :class="item.enabled === 1 ? 'is-success' : 'is-muted'">
                  {{ item.enabled === 1 ? "&#21551;&#29992;" : "&#20572;&#29992;" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openRuleEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="toggleRule(item)">
                    {{ item.enabled === 1 ? "&#20572;&#29992;" : "&#21551;&#29992;" }}
                  </button>
                  <button class="ghost-button danger small" type="button" @click="deleteRule(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="rules.length === 0">
              <td colspan="7" class="table-empty">&#24403;&#21069;&#23478;&#24237;&#19979;&#26242;&#26080;&#35268;&#21017;&#25968;&#25454;&#12290;</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#36890;&#30693;" title="&#36890;&#30693;&#20013;&#24515;">
      <template #actions>
        <button class="ghost-button" type="button" @click="loadNotifications">&#26597;&#35810;</button>
        <button class="ghost-button" type="button" @click="markAllRead">&#20840;&#37096;&#35774;&#20026;&#24050;&#35835;</button>
        <button class="ghost-button danger" type="button" @click="deleteReadNotifications">&#21024;&#38500;&#24050;&#35835;</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline field-inline-short">
            <span>&#35835;&#21462;&#29366;&#24577;</span>
            <select v-model="notificationFilter.readStatus" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="0">&#26410;&#35835;</option>
              <option value="1">&#24050;&#35835;</option>
            </select>
          </label>
          <label class="field-inline field-inline-short">
            <span>&#25104;&#21592; ID</span>
            <input v-model.number="notificationFilter.targetMemberId" class="field-input" type="number" min="1" />
          </label>
          <label class="field-inline">
            <span>&#26469;&#28304;&#31867;&#22411;</span>
            <input v-model.trim="notificationFilter.sourceType" class="field-input" type="text" placeholder="&#21487;&#36873;" />
          </label>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="notificationFeedback" class="feedback-box info">{{ notificationFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#36890;&#30693;&#20869;&#23481;</th>
              <th>&#31561;&#32423;</th>
              <th>&#26469;&#28304;</th>
              <th>&#29366;&#24577;</th>
              <th>&#21019;&#24314;&#26102;&#38388;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in notifications" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.title }}</div>
                <div class="secondary-cell">{{ item.content || "-" }}</div>
              </td>
              <td>{{ item.levelCode || "-" }}</td>
              <td>{{ item.sourceType || "-" }}</td>
              <td>
                <span class="status-badge" :class="item.readStatus === 1 ? 'is-muted' : 'is-warn'">
                  {{ item.readStatus === 1 ? "&#24050;&#35835;" : "&#26410;&#35835;" }}
                </span>
              </td>
              <td>{{ formatDateTime(item.createdAt || item.sentAt) }}</td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="markRead(item.id)">&#35774;&#20026;&#24050;&#35835;</button>
                  <button class="ghost-button danger small" type="button" @click="deleteNotification(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="notifications.length === 0">
              <td colspan="6" class="table-empty">&#24403;&#21069;&#31579;&#36873;&#26465;&#20214;&#19979;&#26242;&#26080;&#36890;&#30693;&#25968;&#25454;&#12290;</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <CrudModal v-model="showRuleModal" :title="ruleForm.id ? '\u7f16\u8f91\u89c4\u5219' : '\u65b0\u589e\u89c4\u5219'">
      <div class="form-grid rule-form-grid">
        <label class="field-block">
          <span>&#35268;&#21017;&#21517;&#31216;</span>
          <input v-model.trim="ruleForm.ruleName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>&#35268;&#21017;&#31867;&#22411;</span>
          <select v-model="ruleForm.ruleType" class="field-input" @change="syncRuleConstraints">
            <option value="THRESHOLD">&#21333;&#28857;&#38408;&#20540;</option>
            <option value="CONSECUTIVE_THRESHOLD">&#36830;&#32493;&#36229;&#38408;</option>
            <option value="TREND_ANOMALY">&#36235;&#21183;&#24322;&#24120;</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#25351;&#26631;&#31867;&#22411;</span>
          <select v-model="ruleForm.metricType" class="field-input" @change="syncRuleConstraints">
            <option value="FAMILY_EXPENSE">&#23478;&#24237;&#24635;&#25903;&#20986;</option>
            <option value="CATEGORY_EXPENSE">&#20998;&#31867;&#25903;&#20986;</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#26102;&#38388;&#33539;&#22260;</span>
          <select v-model="ruleForm.timeScope" class="field-input" @change="syncRuleConstraints">
            <option value="MONTH">&#26376;&#24230;</option>
            <option value="YEAR">&#24180;&#24230;</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#27604;&#36739;&#31526;</span>
          <select v-model="ruleForm.operatorType" class="field-input" @change="syncRuleConstraints">
            <option value="GT">&gt;</option>
            <option value="GTE">&gt;=</option>
            <option value="LT">&lt;</option>
            <option value="LTE">&lt;=</option>
            <option value="EQ">=</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#38408;&#20540;</span>
          <input v-model.number="ruleForm.thresholdValue" class="field-input" type="number" min="0.01" step="0.01" />
        </label>
        <label class="field-block">
          <span>&#20851;&#32852;&#20998;&#31867;</span>
          <select v-model.number="ruleForm.categoryId" class="field-input" :disabled="ruleForm.metricType !== 'CATEGORY_EXPENSE'">
            <option :value="null">{{ ruleForm.metricType === 'CATEGORY_EXPENSE' ? '\u8bf7\u9009\u62e9\u5206\u7c7b' : '\u5f53\u524d\u4e0d\u9700\u8981' }}</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#21160;&#20316;&#31867;&#22411;</span>
          <input class="field-input" type="text" value="&#36890;&#30693; / NOTIFY" disabled />
        </label>
        <label class="field-block">
          <span>&#20248;&#20808;&#32423;</span>
          <input v-model.number="ruleForm.priority" class="field-input" type="number" min="1" />
        </label>
        <label class="field-block field-block-full">
          <span>&#25552;&#31034;&#27169;&#26495;</span>
          <input v-model.trim="ruleForm.messageTemplate" class="field-input" type="text" />
        </label>
        <label class="field-block field-block-full">
          <span>thresholdJson</span>
          <input v-model.trim="ruleForm.thresholdJson" class="field-input" type="text" :placeholder="thresholdJsonPlaceholder" />
        </label>
      </div>
      <div class="button-row">
        <button class="ghost-button small" type="button" @click="applyThresholdPreset('threshold')">&#28165;&#31354; thresholdJson</button>
        <button class="ghost-button small" type="button" @click="applyThresholdPreset('consecutive')">&#22635;&#20837;&#36830;&#32493;&#36229;&#38408;&#27169;&#26495;</button>
        <button class="ghost-button small" type="button" @click="applyThresholdPreset('trend')">&#22635;&#20837;&#36235;&#21183;&#24322;&#24120;&#27169;&#26495;</button>
      </div>
      <div class="feedback-box info">{{ thresholdHint }}</div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitRule">{{ ruleForm.id ? '\u4fdd\u5b58\u89c4\u5219' : '\u521b\u5efa\u89c4\u5219' }}</button>
      </div>
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
import { categoriesApi } from "@/api/categories";
import { rulesApi } from "@/api/rules";
import { notificationsApi } from "@/api/notifications";

const familyId = computed(() => authStore.currentFamilyId);
const categories = ref([]);
const rules = ref([]);
const notifications = ref([]);
const lastEvaluation = ref(null);
const ruleFeedback = ref("");
const notificationFeedback = ref("");
const showRuleModal = ref(false);
const evaluationMonth = ref(currentMonth());

const ruleForm = reactive({
  id: null,
  categoryId: null,
  ruleName: "",
  ruleType: "THRESHOLD",
  metricType: "FAMILY_EXPENSE",
  timeScope: "MONTH",
  operatorType: "GT",
  thresholdValue: 1000,
  thresholdJson: "",
  actionType: "NOTIFY",
  messageTemplate: "\u7ba1\u7406\u7aef\u89e6\u53d1\u7684\u89c4\u5219\u901a\u77e5",
  priority: 10
});

const notificationFilter = reactive({
  targetMemberId: null,
  readStatus: "",
  sourceType: ""
});

const unreadCount = computed(() => notifications.value.filter((item) => Number(item.readStatus) !== 1).length);
const notificationMeta = computed(() => `\u5f53\u524d\u9875 ${notifications.value.length} \u6761\u901a\u77e5`);
const evaluationSummary = computed(() => lastEvaluation.value ? `\u547d\u4e2d ${lastEvaluation.value.triggeredRuleCount || 0} \u6761` : "\u672a\u6267\u884c");
const evaluationMeta = computed(() => lastEvaluation.value
  ? `\u751f\u6210 ${lastEvaluation.value.generatedNotificationCount || 0} \u6761\u901a\u77e5 / \u6708\u4efd ${lastEvaluation.value.month || "-"}`
  : "\u6267\u884c\u8bc4\u4f30\u540e\u751f\u6210\u89c4\u5219\u7ed3\u679c");
const thresholdJsonPlaceholder = computed(() => {
  if (ruleForm.ruleType === "CONSECUTIVE_THRESHOLD") {
    return '{"consecutiveMonths":2}';
  }
  if (ruleForm.ruleType === "TREND_ANOMALY") {
    return '{"baselineMonths":2}';
  }
  return "THRESHOLD \u7c7b\u578b\u65f6\u8bf7\u4fdd\u6301\u4e3a\u7a7a";
});
const thresholdHint = computed(() => {
  if (ruleForm.ruleType === "CONSECUTIVE_THRESHOLD") {
    return "\u8fde\u7eed\u8d85\u9608\u89c4\u5219\u9700\u8981 thresholdJson = {\"consecutiveMonths\":2}\uff0c\u4e14\u65f6\u95f4\u8303\u56f4\u5fc5\u987b\u4e3a\u6708\u5ea6\u3002";
  }
  if (ruleForm.ruleType === "TREND_ANOMALY") {
    return "\u8d8b\u52bf\u5f02\u5e38\u89c4\u5219\u9700\u8981 thresholdJson = {\"baselineMonths\":2}\uff0c\u4e14\u65f6\u95f4\u8303\u56f4\u5fc5\u987b\u4e3a\u6708\u5ea6\u3001\u6bd4\u8f83\u7b26\u5efa\u8bae\u7528 > \u6216 >=\u3002";
  }
  return "\u5355\u70b9\u9608\u503c\u89c4\u5219\u4e0d\u9700\u8981 thresholdJson\uff0c\u7559\u7a7a\u5373\u53ef\u3002";
});

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("\u5f53\u524d\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u5bb6\u5ead\u4e0a\u4e0b\u6587\u3002");
  }
  return familyId.value;
}

function resetRuleForm() {
  Object.assign(ruleForm, {
    id: null,
    categoryId: null,
    ruleName: "",
    ruleType: "THRESHOLD",
    metricType: "FAMILY_EXPENSE",
    timeScope: "MONTH",
    operatorType: "GT",
    thresholdValue: 1000,
    thresholdJson: "",
    actionType: "NOTIFY",
    messageTemplate: "\u7ba1\u7406\u7aef\u89e6\u53d1\u7684\u89c4\u5219\u901a\u77e5",
    priority: 10
  });
}

function syncRuleConstraints() {
  if (ruleForm.metricType !== "CATEGORY_EXPENSE") {
    ruleForm.categoryId = null;
  }
  if (ruleForm.ruleType === "THRESHOLD") {
    ruleForm.thresholdJson = "";
    return;
  }
  ruleForm.timeScope = "MONTH";
  if (ruleForm.ruleType === "CONSECUTIVE_THRESHOLD") {
    ruleForm.thresholdJson = '{"consecutiveMonths":2}';
    return;
  }
  if (ruleForm.ruleType === "TREND_ANOMALY") {
    if (!["GT", "GTE"].includes(ruleForm.operatorType)) {
      ruleForm.operatorType = "GT";
    }
    ruleForm.thresholdJson = '{"baselineMonths":2}';
  }
}

function applyThresholdPreset(mode) {
  if (mode === "threshold") {
    ruleForm.ruleType = "THRESHOLD";
    ruleForm.thresholdJson = "";
    return;
  }
  if (mode === "consecutive") {
    ruleForm.ruleType = "CONSECUTIVE_THRESHOLD";
    ruleForm.thresholdJson = '{"consecutiveMonths":2}';
    ruleForm.timeScope = "MONTH";
    return;
  }
  if (mode === "trend") {
    ruleForm.ruleType = "TREND_ANOMALY";
    ruleForm.thresholdJson = '{"baselineMonths":2}';
    ruleForm.timeScope = "MONTH";
    ruleForm.operatorType = "GT";
  }
}

function openRuleCreate() {
  resetRuleForm();
  showRuleModal.value = true;
}

function openRuleEdit(item) {
  Object.assign(ruleForm, {
    ...item,
    thresholdJson: item.thresholdJson || "",
    actionType: "NOTIFY"
  });
  syncRuleConstraints();
  showRuleModal.value = true;
}

async function loadCategories() {
  categories.value = await categoriesApi.listByFamily(ensureFamilyId());
}

async function loadRules() {
  rules.value = await rulesApi.listByFamily(ensureFamilyId());
}

async function loadNotifications() {
  const response = await notificationsApi.search({
    familyId: ensureFamilyId(),
    targetMemberId: nullableNumber(notificationFilter.targetMemberId),
    readStatus: notificationFilter.readStatus === "" ? "" : Number(notificationFilter.readStatus),
    sourceType: notificationFilter.sourceType || "",
    page: 0,
    size: 20
  });
  notifications.value = response.items || [];
}

async function submitRule() {
  try {
    syncRuleConstraints();
    if (ruleForm.metricType === "CATEGORY_EXPENSE" && !ruleForm.categoryId) {
      throw new Error("\u5206\u7c7b\u652f\u51fa\u89c4\u5219\u5fc5\u987b\u9009\u62e9\u5206\u7c7b\u3002");
    }
    if (ruleForm.id) {
      await rulesApi.update(ruleForm.id, buildRulePayload());
      ruleFeedback.value = "\u89c4\u5219\u5df2\u66f4\u65b0\u3002";
    } else {
      await rulesApi.create({ familyId: ensureFamilyId(), ...buildRulePayload() });
      ruleFeedback.value = "\u89c4\u5219\u5df2\u521b\u5efa\u3002";
    }
    showRuleModal.value = false;
    resetRuleForm();
    await loadRules();
  } catch (error) {
    ruleFeedback.value = `\u89c4\u5219\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

async function toggleRule(item) {
  try {
    if (item.enabled === 1) {
      await rulesApi.disable(item.id);
    } else {
      await rulesApi.enable(item.id);
    }
    await loadRules();
  } catch (error) {
    ruleFeedback.value = `\u89c4\u5219\u72b6\u6001\u5207\u6362\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteRule(id) {
  try {
    await rulesApi.remove(id);
    await loadRules();
  } catch (error) {
    ruleFeedback.value = `\u89c4\u5219\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

async function evaluateRules() {
  try {
    lastEvaluation.value = await rulesApi.evaluate(ensureFamilyId(), evaluationMonth.value);
    ruleFeedback.value = `\u89c4\u5219\u8bc4\u4f30\u5b8c\u6210\uff0c\u751f\u6210 ${lastEvaluation.value.generatedNotificationCount || 0} \u6761\u901a\u77e5\u3002`;
    await loadNotifications();
  } catch (error) {
    ruleFeedback.value = `\u89c4\u5219\u8bc4\u4f30\u5931\u8d25\uff1a${error.message}`;
  }
}

async function markRead(notificationId) {
  try {
    await notificationsApi.markRead(notificationId);
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `\u901a\u77e5\u5df2\u8bfb\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

async function markAllRead() {
  try {
    const result = await notificationsApi.markAllRead(ensureFamilyId(), nullableNumber(notificationFilter.targetMemberId));
    notificationFeedback.value = `\u5df2\u6279\u91cf\u8bbe\u4e3a\u5df2\u8bfb ${result.affectedCount || 0} \u6761\u3002`;
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `\u6279\u91cf\u5df2\u8bfb\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteReadNotifications() {
  try {
    const result = await notificationsApi.deleteRead(ensureFamilyId(), nullableNumber(notificationFilter.targetMemberId));
    notificationFeedback.value = `\u5df2\u5220\u9664 ${result.affectedCount || 0} \u6761\u5df2\u8bfb\u901a\u77e5\u3002`;
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `\u5220\u9664\u5df2\u8bfb\u901a\u77e5\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteNotification(notificationId) {
  try {
    await notificationsApi.remove(notificationId);
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `\u901a\u77e5\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

function buildRulePayload() {
  return {
    categoryId: nullableNumber(ruleForm.categoryId),
    createdByMemberId: null,
    ruleName: ruleForm.ruleName,
    ruleType: ruleForm.ruleType,
    metricType: ruleForm.metricType,
    timeScope: ruleForm.timeScope,
    operatorType: ruleForm.operatorType,
    thresholdValue: ruleForm.thresholdValue,
    thresholdJson: ruleForm.thresholdJson || null,
    actionType: "NOTIFY",
    messageTemplate: ruleForm.messageTemplate,
    priority: nullableNumber(ruleForm.priority)
  };
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return Number(value);
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function categoryName(categoryId) {
  if (!categoryId) {
    return "\u4e0d\u9650\u5206\u7c7b";
  }
  return categories.value.find((item) => item.id === categoryId)?.categoryName || `#${categoryId}`;
}

function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function ruleTypeLabel(value) {
  return {
    THRESHOLD: "\u5355\u70b9\u9608\u503c",
    CONSECUTIVE_THRESHOLD: "\u8fde\u7eed\u8d85\u9608",
    TREND_ANOMALY: "\u8d8b\u52bf\u5f02\u5e38"
  }[value] || value || "-";
}

function metricTypeLabel(value) {
  return {
    FAMILY_EXPENSE: "\u5bb6\u5ead\u603b\u652f\u51fa",
    CATEGORY_EXPENSE: "\u5206\u7c7b\u652f\u51fa"
  }[value] || value || "-";
}

function timeScopeLabel(value) {
  return {
    MONTH: "\u6708\u5ea6",
    YEAR: "\u5e74\u5ea6"
  }[value] || value || "-";
}

function operatorTypeLabel(value) {
  return {
    GT: ">",
    GTE: ">=",
    LT: "<",
    LTE: "<=",
    EQ: "="
  }[value] || value || "-";
}

function actionTypeLabel(value) {
  return {
    NOTIFY: "\u901a\u77e5"
  }[value] || value || "-";
}

onMounted(async () => {
  if (!familyId.value) {
    ruleFeedback.value = "\u5f53\u524d\u8d26\u53f7\u8fd8\u6ca1\u6709\u5bb6\u5ead\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u5728\u201c\u7528\u6237\u4e0e\u5bb6\u5ead\u201d\u4e2d\u521b\u5efa\u5bb6\u5ead\u6216\u52a0\u5165\u5bb6\u5ead\u3002";
    return;
  }
  try {
    await Promise.all([loadCategories(), loadRules(), loadNotifications()]);
  } catch (error) {
    ruleFeedback.value = `\u89c4\u5219\u6a21\u5757\u521d\u59cb\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
});
</script>
