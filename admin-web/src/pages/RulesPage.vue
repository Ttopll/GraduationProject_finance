<template>
  <section class="page-section">
    <div class="stats-grid">
      <StatCard label="当前家庭" :value="familyId || '-'" meta="规则和通知查询均绑定当前 familyId" />
      <StatCard label="规则数" :value="rules.length" meta="当前家庭的预警规则定义" />
      <StatCard label="未读通知" :value="unreadCount" :meta="notificationMeta" />
      <StatCard label="最近评估" :value="evaluationSummary" :meta="evaluationMeta" />
    </div>

    <AdminTableCard kicker="规则" title="规则管理">
      <template #actions>
        <label class="field-inline field-inline-short">
          <span>评估月份</span>
          <input v-model="evaluationMonth" class="field-input" type="month" />
        </label>
        <button class="ghost-button" type="button" @click="evaluateRules">执行评估</button>
        <button class="primary-button" type="button" @click="openRuleCreate">新增规则</button>
        <button class="ghost-button" type="button" @click="loadRules">刷新</button>
      </template>
      <template #feedback>
        <div v-if="ruleFeedback" class="feedback-box info">{{ ruleFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>规则信息</th>
              <th>指标条件</th>
              <th>统计范围</th>
              <th>分类</th>
              <th>优先级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rules" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.ruleName }}</div>
                <div class="secondary-cell">{{ item.ruleType }} / {{ item.actionType }} / {{ item.messageTemplate || "未填写消息模板" }}</div>
              </td>
              <td>{{ item.metricType }} {{ item.operatorType }} {{ item.thresholdValue }}</td>
              <td>{{ ruleScopeLabel(item.timeScope) }}</td>
              <td>{{ categoryName(item.categoryId) }}</td>
              <td>{{ item.priority ?? "-" }}</td>
              <td>
                <span class="status-badge" :class="item.enabled === 1 ? 'is-success' : 'is-muted'">
                  {{ item.enabled === 1 ? "启用" : "停用" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openRuleEdit(item)">编辑</button>
                  <button class="ghost-button small" type="button" @click="toggleRule(item)">{{ item.enabled === 1 ? "停用" : "启用" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteRule(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="rules.length === 0">
              <td colspan="7" class="table-empty">当前家庭下暂无规则数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="通知" title="通知中心">
      <template #actions>
        <button class="ghost-button" type="button" @click="loadNotifications">查询</button>
        <button class="ghost-button" type="button" @click="markAllRead">全部设为已读</button>
        <button class="ghost-button danger" type="button" @click="deleteReadNotifications">删除已读</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline field-inline-short">
            <span>读取状态</span>
            <select v-model="notificationFilter.readStatus" class="field-input">
              <option value="">全部</option>
              <option value="0">未读</option>
              <option value="1">已读</option>
            </select>
          </label>
          <label class="field-inline field-inline-short">
            <span>成员 ID</span>
            <input v-model.number="notificationFilter.targetMemberId" class="field-input" type="number" min="1" />
          </label>
          <label class="field-inline">
            <span>来源类型</span>
            <input v-model.trim="notificationFilter.sourceType" class="field-input" type="text" placeholder="可选" />
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
              <th>通知内容</th>
              <th>等级</th>
              <th>来源</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in notifications" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.title }}</div>
                <div class="secondary-cell">{{ item.content || "无正文内容" }}</div>
              </td>
              <td>{{ item.levelCode || "-" }}</td>
              <td>{{ item.sourceType || "-" }}</td>
              <td>
                <span class="status-badge" :class="item.readStatus === 1 ? 'is-muted' : 'is-warn'">
                  {{ item.readStatus === 1 ? "已读" : "未读" }}
                </span>
              </td>
              <td>{{ formatDateTime(item.createdAt || item.sentAt) }}</td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="markRead(item.id)">设为已读</button>
                  <button class="ghost-button danger small" type="button" @click="deleteNotification(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="notifications.length === 0">
              <td colspan="6" class="table-empty">当前筛选条件下暂无通知数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <CrudModal v-model="showRuleModal" :title="ruleForm.id ? '编辑规则' : '新增规则'">
      <div class="form-grid rule-form-grid">
        <label class="field-block">
          <span>规则名称</span>
          <input v-model.trim="ruleForm.ruleName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>关联分类</span>
          <select v-model.number="ruleForm.categoryId" class="field-input">
            <option :value="null">不限定分类</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>规则类型</span>
          <select v-model="ruleForm.ruleType" class="field-input">
            <option value="BUDGET">预算</option>
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
          </select>
        </label>
        <label class="field-block">
          <span>指标类型</span>
          <select v-model="ruleForm.metricType" class="field-input">
            <option value="AMOUNT">金额</option>
            <option value="USAGE_RATIO">使用率</option>
            <option value="COUNT">次数</option>
          </select>
        </label>
        <label class="field-block">
          <span>时间范围</span>
          <select v-model="ruleForm.timeScope" class="field-input">
            <option value="MONTHLY">月度</option>
            <option value="WEEKLY">周度</option>
            <option value="DAILY">日度</option>
          </select>
        </label>
        <label class="field-block">
          <span>比较符</span>
          <select v-model="ruleForm.operatorType" class="field-input">
            <option value=">">&gt;</option>
            <option value=">=">&gt;=</option>
            <option value="<">&lt;</option>
            <option value="<=">&lt;=</option>
          </select>
        </label>
        <label class="field-block">
          <span>阈值</span>
          <input v-model.number="ruleForm.thresholdValue" class="field-input" type="number" min="0.01" step="0.01" />
        </label>
        <label class="field-block">
          <span>动作类型</span>
          <select v-model="ruleForm.actionType" class="field-input">
            <option value="NOTIFY">通知</option>
            <option value="ALERT">预警</option>
          </select>
        </label>
        <label class="field-block">
          <span>优先级</span>
          <input v-model.number="ruleForm.priority" class="field-input" type="number" min="1" />
        </label>
        <label class="field-block field-block-full">
          <span>消息模板</span>
          <input v-model.trim="ruleForm.messageTemplate" class="field-input" type="text" />
        </label>
        <label class="field-block field-block-full">
          <span>阈值 JSON</span>
          <input v-model.trim="ruleForm.thresholdJson" class="field-input" type="text" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitRule">{{ ruleForm.id ? "保存规则" : "创建规则" }}</button>
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
  ruleType: "BUDGET",
  metricType: "AMOUNT",
  timeScope: "MONTHLY",
  operatorType: ">",
  thresholdValue: 0,
  thresholdJson: "",
  actionType: "NOTIFY",
  messageTemplate: "预算预警由管理端触发",
  priority: 10
});

const notificationFilter = reactive({
  targetMemberId: null,
  readStatus: "",
  sourceType: ""
});

const unreadCount = computed(() => notifications.value.filter((item) => Number(item.readStatus) !== 1).length);
const notificationMeta = computed(() => `当前页 ${notifications.value.length} 条通知`);
const evaluationSummary = computed(() => lastEvaluation.value ? `${lastEvaluation.value.triggeredRuleCount || 0} 条命中` : "未执行");
const evaluationMeta = computed(() => lastEvaluation.value
  ? `${lastEvaluation.value.generatedNotificationCount || 0} 条通知 / 月份 ${lastEvaluation.value.month || "-"}`
  : "执行评估后会生成规则结果");

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("当前会话没有可用的家庭上下文。");
  }
  return familyId.value;
}

function resetRuleForm() {
  Object.assign(ruleForm, {
    id: null,
    categoryId: null,
    ruleName: "",
    ruleType: "BUDGET",
    metricType: "AMOUNT",
    timeScope: "MONTHLY",
    operatorType: ">",
    thresholdValue: 0,
    thresholdJson: "",
    actionType: "NOTIFY",
    messageTemplate: "预算预警由管理端触发",
    priority: 10
  });
}

function openRuleCreate() {
  resetRuleForm();
  showRuleModal.value = true;
}

function openRuleEdit(item) {
  Object.assign(ruleForm, { ...item, thresholdJson: item.thresholdJson || "" });
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
    if (ruleForm.id) {
      await rulesApi.update(ruleForm.id, buildRulePayload());
      ruleFeedback.value = "规则已更新。";
    } else {
      await rulesApi.create({ familyId: ensureFamilyId(), ...buildRulePayload() });
      ruleFeedback.value = "规则已创建。";
    }
    showRuleModal.value = false;
    resetRuleForm();
    await loadRules();
  } catch (error) {
    ruleFeedback.value = `规则操作失败：${error.message}`;
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
    ruleFeedback.value = `规则状态切换失败：${error.message}`;
  }
}

async function deleteRule(id) {
  try {
    await rulesApi.remove(id);
    await loadRules();
  } catch (error) {
    ruleFeedback.value = `规则删除失败：${error.message}`;
  }
}

async function evaluateRules() {
  try {
    lastEvaluation.value = await rulesApi.evaluate(ensureFamilyId(), evaluationMonth.value);
    ruleFeedback.value = `规则评估完成，生成 ${(lastEvaluation.value.generatedNotificationCount || 0)} 条通知。`;
    await loadNotifications();
  } catch (error) {
    ruleFeedback.value = `规则评估失败：${error.message}`;
  }
}

async function markRead(notificationId) {
  try {
    await notificationsApi.markRead(notificationId);
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `通知已读操作失败：${error.message}`;
  }
}

async function markAllRead() {
  try {
    const result = await notificationsApi.markAllRead(ensureFamilyId(), nullableNumber(notificationFilter.targetMemberId));
    notificationFeedback.value = `已批量设为已读 ${result.affectedCount || 0} 条。`;
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `批量已读失败：${error.message}`;
  }
}

async function deleteReadNotifications() {
  try {
    const result = await notificationsApi.deleteRead(ensureFamilyId(), nullableNumber(notificationFilter.targetMemberId));
    notificationFeedback.value = `已删除 ${result.affectedCount || 0} 条已读通知。`;
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `删除已读通知失败：${error.message}`;
  }
}

async function deleteNotification(notificationId) {
  try {
    await notificationsApi.remove(notificationId);
    await loadNotifications();
  } catch (error) {
    notificationFeedback.value = `通知删除失败：${error.message}`;
  }
}

function buildRulePayload() {
  return {
    categoryId: nullableNumber(ruleForm.categoryId),
    createdByMemberId: null,
    ruleName: ruleForm.ruleName,
    ruleType: normalizeRuleType(ruleForm.ruleType),
    metricType: normalizeMetricType(ruleForm.metricType),
    timeScope: normalizeTimeScope(ruleForm.timeScope),
    operatorType: ruleForm.operatorType,
    thresholdValue: ruleForm.thresholdValue,
    thresholdJson: ruleForm.thresholdJson || null,
    actionType: normalizeActionType(ruleForm.actionType),
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
    return "未限定";
  }
  return categories.value.find((item) => item.id === categoryId)?.categoryName || `#${categoryId}`;
}

function currentMonth() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function ruleScopeLabel(value) {
  if (value === "MONTHLY") {
    return "月度";
  }
  if (value === "WEEKLY") {
    return "周度";
  }
  if (value === "DAILY") {
    return "日度";
  }
  return value || "-";
}

function normalizeRuleType(value) {
  if (value === "预算") {
    return "BUDGET";
  }
  if (value === "支出") {
    return "EXPENSE";
  }
  if (value === "收入") {
    return "INCOME";
  }
  return value;
}

function normalizeMetricType(value) {
  if (value === "金额") {
    return "AMOUNT";
  }
  if (value === "使用率") {
    return "USAGE_RATIO";
  }
  if (value === "次数") {
    return "COUNT";
  }
  return value;
}

function normalizeTimeScope(value) {
  if (value === "月度") {
    return "MONTHLY";
  }
  if (value === "周度") {
    return "WEEKLY";
  }
  if (value === "日度") {
    return "DAILY";
  }
  return value;
}

function normalizeActionType(value) {
  if (value === "通知") {
    return "NOTIFY";
  }
  if (value === "预警") {
    return "ALERT";
  }
  return value;
}

onMounted(async () => {
  if (!familyId.value) {
    ruleFeedback.value = "当前会话没有家庭上下文，无法加载规则数据。";
    return;
  }
  try {
    await Promise.all([loadCategories(), loadRules(), loadNotifications()]);
  } catch (error) {
    ruleFeedback.value = `规则模块初始加载失败：${error.message}`;
  }
});
</script>
