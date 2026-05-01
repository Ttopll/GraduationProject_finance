<template>
  <section class="page-section">
    <article v-if="!familyId" class="panel-card">
      <div class="panel-head">
        <div>
          <div class="panel-kicker">家庭上下文缺失</div>
          <h2>请先创建或加入家庭</h2>
        </div>
      </div>
      <div class="feedback-box info">
        规则定义、预算联动和通知查询都依赖当前家庭。请先前往“用户与家庭”页面创建家庭或通过邀请码加入家庭。
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="当前家庭" :value="familyId || '-'" meta="当前页面所有规则评估、预算联动和通知查询都绑定到 familyId" />
      <StatCard label="启用规则" :value="enabledRuleCount" :meta="`总规则 ${rules.length} 条`" />
      <StatCard label="风险预算" :value="riskyBudgetCount" :meta="riskMeta" />
      <StatCard label="未读通知" :value="unreadCount" :meta="notificationMeta" />
    </div>

    <div class="panel-grid panel-grid-wide linkage-grid">
      <AdminTableCard kicker="联动总览" title="预算风险 -> 规则命中 -> 通知落地" :compact="true">
        <template #actions>
          <label class="field-inline field-inline-short">
            <span>评估月份</span>
            <input v-model="evaluationMonth" class="field-input" type="month" />
          </label>
          <button class="ghost-button" type="button" @click="refreshLinkage">刷新联动</button>
          <button class="primary-button" type="button" @click="evaluateRules">执行评估</button>
        </template>
        <div class="summary-grid linkage-summary-grid">
          <div class="summary-item">
            <strong>风险预算数</strong>
            <span>{{ riskyBudgetCount }} 条达到预警或超支</span>
            <span :class="riskyBudgetCount > 0 ? 'summary-warn' : 'summary-normal'">
              {{ riskyBudgetCount > 0 ? '建议立即核对规则覆盖' : '当前预算执行稳定' }}
            </span>
          </div>
          <div class="summary-item">
            <strong>规则覆盖数</strong>
            <span>{{ coveredRiskCount }} / {{ riskyBudgetCount }}</span>
            <span :class="uncoveredRiskCount > 0 ? 'summary-danger' : 'summary-normal'">
              {{ uncoveredRiskCount > 0 ? `仍有 ${uncoveredRiskCount} 条风险未被规则覆盖` : '风险预算均有对应规则' }}
            </span>
          </div>
          <div class="summary-item">
            <strong>最近评估结果</strong>
            <span>{{ evaluationSummary }}</span>
            <span>{{ evaluationMeta }}</span>
          </div>
          <div class="summary-item">
            <strong>通知落地结果</strong>
            <span>预算通知 {{ budgetNotificationCount }} 条</span>
            <span>规则通知 {{ ruleNotificationCount }} 条</span>
          </div>
        </div>
        <template #feedback>
          <div v-if="ruleFeedback" class="feedback-box info">{{ ruleFeedback }}</div>
        </template>
      </AdminTableCard>

      <AdminTableCard kicker="预算风险" title="高风险预算清单" :compact="true">
        <div class="risk-list">
          <div v-for="item in riskyBudgetItems" :key="item.budgetId" class="risk-item">
            <div class="risk-item-head">
              <div>
                <strong>{{ item.budgetName }}</strong>
                <span>{{ item.categoryName || '未绑定分类' }} / {{ item.month }}</span>
              </div>
              <span class="status-badge" :class="item.exceeded ? 'is-warn' : 'is-success'">
                {{ item.exceeded ? '已超支' : '达到预警' }}
              </span>
            </div>
            <div class="risk-item-body">
              <span>已用 {{ formatPercent(item.usageRatio) }} / 支出 {{ formatAmount(item.spentAmount) }} / 预算 {{ formatAmount(item.budgetAmount) }}</span>
              <span :class="riskCoverage(item).covered ? 'summary-normal' : 'summary-danger'">
                {{ riskCoverage(item).label }}
              </span>
            </div>
          </div>
          <div v-if="riskyBudgetItems.length === 0" class="empty-text">当前月份暂无达到预警线的预算。</div>
        </div>
      </AdminTableCard>
    </div>

    <div class="panel-grid panel-grid-wide linkage-grid">
      <AdminTableCard kicker="规则覆盖" title="风险预算与规则映射" :compact="true">
        <div class="table-shell">
          <table class="admin-table">
            <thead>
              <tr>
                <th>风险预算</th>
                <th>预算状态</th>
                <th>匹配规则</th>
                <th>覆盖情况</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in riskyBudgetItems" :key="`coverage-${item.budgetId}`">
                <td>
                  <div class="primary-cell">{{ item.budgetName }}</div>
                  <div class="secondary-cell">{{ item.categoryName || '-' }} / {{ item.month }}</div>
                </td>
                <td>
                  <div>{{ formatAmount(item.spentAmount) }} / {{ formatAmount(item.budgetAmount) }}</div>
                  <div class="secondary-cell">{{ formatPercent(item.usageRatio) }} / {{ item.exceeded ? '已超支' : '达到预警' }}</div>
                </td>
                <td>
                  <div v-if="matchedRules(item).length > 0" class="tag-list">
                    <span v-for="rule in matchedRules(item)" :key="rule.id" class="status-badge is-success">
                      {{ rule.ruleName }}
                    </span>
                  </div>
                  <div v-else class="secondary-cell">暂无匹配规则</div>
                </td>
                <td>
                  <span class="status-badge" :class="riskCoverage(item).covered ? 'is-success' : 'is-warn'">
                    {{ riskCoverage(item).covered ? '已覆盖' : '待补规则' }}
                  </span>
                </td>
              </tr>
              <tr v-if="riskyBudgetItems.length === 0">
                <td colspan="4" class="table-empty">暂无风险预算，当前不需要联动覆盖分析。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="通知来源" title="通知来源分布与最近记录" :compact="true">
        <template #feedback>
          <div v-if="notificationFeedback" class="feedback-box info">{{ notificationFeedback }}</div>
        </template>
        <div class="summary-grid linkage-summary-grid">
          <div class="summary-item">
            <strong>预算来源通知</strong>
            <span>{{ budgetNotificationCount }} 条</span>
            <span>{{ budgetUnreadCount }} 条未读</span>
          </div>
          <div class="summary-item">
            <strong>规则来源通知</strong>
            <span>{{ ruleNotificationCount }} 条</span>
            <span>{{ ruleUnreadCount }} 条未读</span>
          </div>
        </div>
        <div class="mini-list">
          <div v-for="item in notificationSourceSummary" :key="item.source" class="mini-list-item">
            <strong>{{ sourceTypeLabel(item.source) }}</strong>
            <span>总数 {{ item.count }} / 未读 {{ item.unread }}</span>
          </div>
          <div v-if="notificationSourceSummary.length === 0" class="empty-text">当前没有可统计的通知来源。</div>
        </div>
        <div class="mini-list recent-list">
          <div v-for="item in recentImportantNotifications" :key="item.id" class="mini-list-item">
            <strong>{{ item.title }}</strong>
            <span>{{ sourceTypeLabel(item.sourceType) }} / {{ formatDateTime(item.createdAt || item.sentAt) }}</span>
          </div>
          <div v-if="recentImportantNotifications.length === 0" class="empty-text">当前没有最近通知记录。</div>
        </div>
      </AdminTableCard>
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
              <th>时间范围</th>
              <th>关联分类</th>
              <th>优先级</th>
              <th>状态</th>
              <th>操作</th>
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
                  {{ item.enabled === 1 ? "启用" : "停用" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openRuleEdit(item)">编辑</button>
                  <button class="ghost-button small" type="button" @click="toggleRule(item)">
                    {{ item.enabled === 1 ? "停用" : "启用" }}
                  </button>
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
            <input v-model.trim="notificationFilter.sourceType" class="field-input" type="text" placeholder="可选，如 RULE / BUDGET" />
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
                <div class="secondary-cell">{{ item.content || "-" }}</div>
              </td>
              <td>{{ item.levelCode || "-" }}</td>
              <td>{{ sourceTypeLabel(item.sourceType) }}</td>
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
          <span>规则类型</span>
          <select v-model="ruleForm.ruleType" class="field-input" @change="syncRuleConstraints">
            <option value="THRESHOLD">单点阈值</option>
            <option value="CONSECUTIVE_THRESHOLD">连续超阈</option>
            <option value="TREND_ANOMALY">趋势异常</option>
          </select>
        </label>
        <label class="field-block">
          <span>指标类型</span>
          <select v-model="ruleForm.metricType" class="field-input" @change="syncRuleConstraints">
            <option value="FAMILY_EXPENSE">家庭总支出</option>
            <option value="CATEGORY_EXPENSE">分类支出</option>
          </select>
        </label>
        <label class="field-block">
          <span>时间范围</span>
          <select v-model="ruleForm.timeScope" class="field-input" @change="syncRuleConstraints">
            <option value="MONTH">月度</option>
            <option value="YEAR">年度</option>
          </select>
        </label>
        <label class="field-block">
          <span>比较符</span>
          <select v-model="ruleForm.operatorType" class="field-input" @change="syncRuleConstraints">
            <option value="GT">&gt;</option>
            <option value="GTE">&gt;=</option>
            <option value="LT">&lt;</option>
            <option value="LTE">&lt;=</option>
            <option value="EQ">=</option>
          </select>
        </label>
        <label class="field-block">
          <span>阈值</span>
          <input v-model.number="ruleForm.thresholdValue" class="field-input" type="number" min="0.01" step="0.01" />
        </label>
        <label class="field-block">
          <span>关联分类</span>
          <select v-model.number="ruleForm.categoryId" class="field-input" :disabled="ruleForm.metricType !== 'CATEGORY_EXPENSE'">
            <option :value="null">{{ ruleForm.metricType === 'CATEGORY_EXPENSE' ? '请选择分类' : '当前不需要' }}</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>动作类型</span>
          <input class="field-input" type="text" value="通知 / NOTIFY" disabled />
        </label>
        <label class="field-block">
          <span>优先级</span>
          <input v-model.number="ruleForm.priority" class="field-input" type="number" min="1" />
        </label>
        <label class="field-block field-block-full">
          <span>提示模板</span>
          <input v-model.trim="ruleForm.messageTemplate" class="field-input" type="text" />
        </label>
        <label class="field-block field-block-full">
          <span>thresholdJson</span>
          <input v-model.trim="ruleForm.thresholdJson" class="field-input" type="text" :placeholder="thresholdJsonPlaceholder" />
        </label>
      </div>
      <div class="button-row">
        <button class="ghost-button small" type="button" @click="applyThresholdPreset('threshold')">清空 thresholdJson</button>
        <button class="ghost-button small" type="button" @click="applyThresholdPreset('consecutive')">填入连续超阈模板</button>
        <button class="ghost-button small" type="button" @click="applyThresholdPreset('trend')">填入趋势异常模板</button>
      </div>
      <div class="feedback-box info">{{ thresholdHint }}</div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitRule">{{ ruleForm.id ? "保存规则" : "创建规则" }}</button>
      </div>
    </CrudModal>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import StatCard from "@/components/StatCard.vue";
import CrudModal from "@/components/CrudModal.vue";
import AdminTableCard from "@/components/AdminTableCard.vue";
import FilterBar from "@/components/FilterBar.vue";
import { authStore } from "@/stores/auth";
import { categoriesApi } from "@/api/categories";
import { budgetsApi } from "@/api/budgets";
import { rulesApi } from "@/api/rules";
import { notificationsApi } from "@/api/notifications";
import { usePageRefresh } from "@/composables/pageRefresh";

const route = useRoute();
const familyId = computed(() => authStore.currentFamilyId);
const categories = ref([]);
const budgetUsage = ref([]);
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
  messageTemplate: "管理端触发的规则通知",
  priority: 10
});

const notificationFilter = reactive({
  targetMemberId: null,
  readStatus: "",
  sourceType: ""
});

const enabledRuleCount = computed(() => rules.value.filter((item) => Number(item.enabled) === 1).length);
const unreadCount = computed(() => notifications.value.filter((item) => Number(item.readStatus) !== 1).length);
const riskyBudgetItems = computed(() => budgetUsage.value.filter((item) => item.alertTriggered || item.exceeded));
const riskyBudgetCount = computed(() => riskyBudgetItems.value.length);
const coveredRiskCount = computed(() => riskyBudgetItems.value.filter((item) => riskCoverage(item).covered).length);
const uncoveredRiskCount = computed(() => Math.max(riskyBudgetCount.value - coveredRiskCount.value, 0));
const riskMeta = computed(() => riskyBudgetCount.value > 0
  ? `已覆盖 ${coveredRiskCount.value} 条，待补 ${uncoveredRiskCount.value} 条`
  : "当前没有预算预警项");
const notificationMeta = computed(() => `当前页 ${notifications.value.length} 条 / 未读 ${unreadCount.value} 条`);
const evaluationSummary = computed(() => lastEvaluation.value ? `命中 ${lastEvaluation.value.triggeredRuleCount || 0} 条` : "未执行");
const evaluationMeta = computed(() => lastEvaluation.value
  ? `生成 ${lastEvaluation.value.generatedNotificationCount || 0} 条通知 / 月份 ${lastEvaluation.value.month || "-"}`
  : "执行评估后生成规则命中结果");
const budgetNotificationCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "BUDGET").length);
const ruleNotificationCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "RULE").length);
const budgetUnreadCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "BUDGET" && Number(item.readStatus) !== 1).length);
const ruleUnreadCount = computed(() => notifications.value.filter((item) => normalizeSourceType(item.sourceType) === "RULE" && Number(item.readStatus) !== 1).length);
const notificationSourceSummary = computed(() => {
  const summary = new Map();
  notifications.value.forEach((item) => {
    const source = normalizeSourceType(item.sourceType) || "OTHER";
    if (!summary.has(source)) {
      summary.set(source, { source, count: 0, unread: 0 });
    }
    const target = summary.get(source);
    target.count += 1;
    if (Number(item.readStatus) !== 1) {
      target.unread += 1;
    }
  });
  return Array.from(summary.values()).sort((a, b) => b.count - a.count);
});
const recentImportantNotifications = computed(() => notifications.value.slice(0, 5));
const thresholdJsonPlaceholder = computed(() => {
  if (ruleForm.ruleType === "CONSECUTIVE_THRESHOLD") {
    return '{"consecutiveMonths":2}';
  }
  if (ruleForm.ruleType === "TREND_ANOMALY") {
    return '{"baselineMonths":2}';
  }
  return "THRESHOLD 类型时请保持为空";
});
const thresholdHint = computed(() => {
  if (ruleForm.ruleType === "CONSECUTIVE_THRESHOLD") {
    return "连续超阈规则需要 thresholdJson = {\"consecutiveMonths\":2}，且时间范围必须为月度。";
  }
  if (ruleForm.ruleType === "TREND_ANOMALY") {
    return "趋势异常规则需要 thresholdJson = {\"baselineMonths\":2}，且时间范围必须为月度，比较符建议用 > 或 >=。";
  }
  return "单点阈值规则不需要 thresholdJson，留空即可。";
});

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
    ruleType: "THRESHOLD",
    metricType: "FAMILY_EXPENSE",
    timeScope: "MONTH",
    operatorType: "GT",
    thresholdValue: 1000,
    thresholdJson: "",
    actionType: "NOTIFY",
    messageTemplate: "管理端触发的规则通知",
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

function applyAutofillFromQuery() {
  if (route.query.autofill !== "1") {
    return;
  }
  resetRuleForm();
  ruleForm.ruleName = String(route.query.ruleName || ruleForm.ruleName);
  ruleForm.ruleType = String(route.query.ruleType || ruleForm.ruleType);
  ruleForm.metricType = String(route.query.metricType || ruleForm.metricType);
  ruleForm.timeScope = String(route.query.timeScope || ruleForm.timeScope);
  ruleForm.operatorType = String(route.query.operatorType || ruleForm.operatorType);
  ruleForm.thresholdValue = Number(route.query.thresholdValue || ruleForm.thresholdValue);
  ruleForm.thresholdJson = String(route.query.thresholdJson || "");
  ruleForm.priority = Number(route.query.priority || ruleForm.priority);
  ruleForm.messageTemplate = String(route.query.messageTemplate || ruleForm.messageTemplate);
  syncRuleConstraints();
  showRuleModal.value = true;
  ruleFeedback.value = "The rule form has been prefilled from the analysis recommendation.";
}

function openRuleEdit(item) {
  Object.assign(ruleForm, {
    ...item,
    thresholdJson: item.thresholdJson || "",
    actionType: "NOTIFY"
  });
  showRuleModal.value = true;
}

async function loadCategories() {
  categories.value = await categoriesApi.listByFamily(ensureFamilyId());
}

async function loadBudgetUsage() {
  budgetUsage.value = await budgetsApi.usage(ensureFamilyId(), evaluationMonth.value);
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

async function refreshLinkage() {
  await Promise.all([loadBudgetUsage(), loadRules(), loadNotifications()]);
}

async function submitRule() {
  try {
    syncRuleConstraints();
    if (ruleForm.metricType === "CATEGORY_EXPENSE" && !ruleForm.categoryId) {
      throw new Error("分类支出规则必须选择分类。");
    }
    if (ruleForm.id) {
      await rulesApi.update(ruleForm.id, buildRulePayload());
      ruleFeedback.value = "规则已更新。";
    } else {
      await rulesApi.create({ familyId: ensureFamilyId(), ...buildRulePayload() });
      ruleFeedback.value = "规则已创建。";
    }
    showRuleModal.value = false;
    resetRuleForm();
    await Promise.all([loadRules(), loadBudgetUsage()]);
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
    await Promise.all([loadRules(), loadBudgetUsage()]);
  } catch (error) {
    ruleFeedback.value = `规则删除失败：${error.message}`;
  }
}

async function evaluateRules() {
  try {
    lastEvaluation.value = await rulesApi.evaluate(ensureFamilyId(), evaluationMonth.value);
    ruleFeedback.value = `规则评估完成，生成 ${lastEvaluation.value.generatedNotificationCount || 0} 条通知。`;
    await Promise.all([loadBudgetUsage(), loadNotifications()]);
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

function matchedRules(usageItem) {
  return rules.value.filter((rule) => {
    if (Number(rule.enabled) !== 1) {
      return false;
    }
    if (!["MONTH", usageItem.month?.length === 7 ? "MONTH" : "YEAR"].includes(rule.timeScope)) {
      return false;
    }
    if (rule.metricType === "FAMILY_EXPENSE") {
      return true;
    }
    if (rule.metricType === "CATEGORY_EXPENSE") {
      return Number(rule.categoryId) === Number(usageItem.categoryId);
    }
    return false;
  });
}

function riskCoverage(usageItem) {
  const matched = matchedRules(usageItem);
  if (matched.length > 0) {
    return {
      covered: true,
      label: `已由 ${matched.length} 条规则覆盖`
    };
  }
  return {
    covered: false,
    label: "当前风险预算没有对应启用规则"
  };
}

function normalizeSourceType(value) {
  return String(value || "").trim().toUpperCase();
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

function formatAmount(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function categoryName(categoryId) {
  if (!categoryId) {
    return "不限分类";
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
    THRESHOLD: "单点阈值",
    CONSECUTIVE_THRESHOLD: "连续超阈",
    TREND_ANOMALY: "趋势异常"
  }[value] || value || "-";
}

function metricTypeLabel(value) {
  return {
    FAMILY_EXPENSE: "家庭总支出",
    CATEGORY_EXPENSE: "分类支出"
  }[value] || value || "-";
}

function timeScopeLabel(value) {
  return {
    MONTH: "月度",
    YEAR: "年度"
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
    NOTIFY: "通知"
  }[value] || value || "-";
}

function sourceTypeLabel(value) {
  return {
    RULE: "规则触发",
    BUDGET: "预算提醒",
    OTHER: "其他"
  }[normalizeSourceType(value)] || value || "-";
}

async function refreshAll() {
  if (!familyId.value) {
    ruleFeedback.value = "当前账号还没有家庭上下文，请先在“用户与家庭”中创建家庭或加入家庭。";
    notifications.value = [];
    rules.value = [];
    budgetUsage.value = [];
    return;
  }
  await Promise.all([loadCategories(), loadBudgetUsage(), loadRules(), loadNotifications()]);
}

onMounted(async () => {
  try {
    await refreshAll();
    applyAutofillFromQuery();
  } catch (error) {
    ruleFeedback.value = `规则模块初始加载失败：${error.message}`;
  }
});

usePageRefresh(refreshAll);
</script>
