<template>
  <section class="page-section">
    <article v-if="!familyId" class="panel-card">
      <div class="panel-head">
        <div>
          <div class="panel-kicker">家庭上下文缺失</div>
          <h2>请先创建或加入家庭</h2>
        </div>
      </div>
      <div class="feedback-box info">当前账号还没有家庭上下文，账户、分类、预算和交易都必须归属到某个家庭下。请先进入“用户与家庭”页面创建家庭或通过邀请码加入家庭。</div>
    </article>

    <div class="stats-grid">
      <StatCard label="当前家庭" :value="familyId || '-'" meta="当前页面所有业务请求均绑定 familyId" />
      <StatCard label="账户数" :value="accounts.length" meta="现金、银行卡、信用卡等资金账户" />
      <StatCard label="分类数" :value="categories.length" meta="收入与支出分类维度" />
      <StatCard label="交易数" :value="transactionTotal" :meta="transactionMeta" />
    </div>

    <AdminTableCard kicker="账户" title="账户管理">
      <template #actions>
        <button class="primary-button" type="button" @click="openAccountCreate">新增账户</button>
        <button class="ghost-button" type="button" @click="loadAccounts">刷新</button>
      </template>
      <template #feedback>
        <div v-if="accountFeedback" class="feedback-box info">{{ accountFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>账户信息</th>
              <th>类型</th>
              <th>所属成员</th>
              <th>当前余额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in accounts" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.accountName }}</div>
                <div class="secondary-cell">{{ item.institutionName || "未填写机构" }} / {{ item.accountNoMask || "未填写尾号" }}</div>
              </td>
              <td>{{ item.accountType }}</td>
              <td>{{ ownerName(item.ownerMemberId) }}</td>
              <td>{{ formatAmount(item.currentBalance) }}</td>
              <td>
                <span class="status-badge" :class="item.status === 1 ? 'is-success' : 'is-muted'">
                  {{ item.status === 1 ? "启用" : "停用" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openAccountEdit(item)">编辑</button>
                  <button class="ghost-button small" type="button" @click="toggleAccount(item)">{{ item.status === 1 ? "停用" : "启用" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteAccount(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="accounts.length === 0">
              <td colspan="6" class="table-empty">当前家庭下暂无账户数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="分类" title="分类管理">
      <template #actions>
        <button class="primary-button" type="button" @click="openCategoryCreate">新增分类</button>
        <button class="ghost-button" type="button" @click="loadCategories">刷新</button>
      </template>
      <template #feedback>
        <div v-if="categoryFeedback" class="feedback-box info">{{ categoryFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>分类名称</th>
              <th>类型</th>
              <th>范围</th>
              <th>排序</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in categories" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.categoryName }}</div>
                <div class="secondary-cell">ID {{ item.id }} / 父分类 {{ item.parentId ?? "-" }}</div>
              </td>
              <td>{{ item.categoryType }}</td>
              <td>{{ item.scopeType || "-" }}</td>
              <td>{{ item.sortOrder ?? "-" }}</td>
              <td>
                <span class="status-badge" :class="item.enabled === 1 ? 'is-success' : 'is-muted'">
                  {{ item.enabled === 1 ? "启用" : "停用" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openCategoryEdit(item)">编辑</button>
                  <button class="ghost-button small" type="button" @click="toggleCategory(item)">{{ item.enabled === 1 ? "停用" : "启用" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteCategory(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="categories.length === 0">
              <td colspan="6" class="table-empty">当前家庭下暂无分类数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="预算" title="预算管理">
      <template #actions>
        <button class="primary-button" type="button" @click="openBudgetCreate">新增预算</button>
        <button class="ghost-button" type="button" @click="loadBudgets">刷新</button>
      </template>
      <template #feedback>
        <div v-if="budgetFeedback" class="feedback-box info">{{ budgetFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>预算名称</th>
              <th>预算分类</th>
              <th>周期</th>
              <th>金额</th>
              <th>预警比例</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in budgets" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.budgetName }}</div>
                <div class="secondary-cell">{{ item.startDate || "-" }} 至 {{ item.endDate || "长期有效" }}</div>
              </td>
              <td>{{ categoryName(item.categoryId) }}</td>
              <td>{{ item.periodType }}</td>
              <td>{{ formatAmount(item.amount) }}</td>
              <td>{{ item.alertRatio ?? "-" }}</td>
              <td>
                <span class="status-badge" :class="item.enabled === 1 ? 'is-success' : 'is-muted'">
                  {{ item.enabled === 1 ? "启用" : "停用" }}
                </span>
              </td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openBudgetEdit(item)">编辑</button>
                  <button class="ghost-button small" type="button" @click="toggleBudget(item)">{{ item.enabled === 1 ? "停用" : "启用" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteBudget(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="budgets.length === 0">
              <td colspan="7" class="table-empty">当前家庭下暂无预算数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="交易" title="交易管理">
      <template #actions>
        <button class="primary-button" type="button" @click="openTransactionCreate">新增交易</button>
        <button class="ghost-button" type="button" @click="loadTransactions">刷新</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline">
            <span>交易类型</span>
            <select v-model="transactionFilter.transactionType" class="field-input">
              <option value="">全部</option>
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
              <option value="TRANSFER">转账</option>
            </select>
          </label>
          <label class="field-inline">
            <span>开始时间</span>
            <input v-model="transactionFilter.startTime" class="field-input" type="datetime-local" />
          </label>
          <label class="field-inline">
            <span>结束时间</span>
            <input v-model="transactionFilter.endTime" class="field-input" type="datetime-local" />
          </label>
          <button class="ghost-button" type="button" @click="loadTransactions">查询</button>
          <button class="ghost-button" type="button" @click="resetTransactionFilter">重置</button>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="transactionFeedback" class="feedback-box info">{{ transactionFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>交易信息</th>
              <th>账户</th>
              <th>分类</th>
              <th>类型</th>
              <th>金额</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in transactionItems" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.merchantName || item.counterpartyName || "手工记录" }}</div>
                <div class="secondary-cell">{{ item.note || item.sourcePlatform || "-" }}</div>
              </td>
              <td>{{ accountName(item.accountId) }}</td>
              <td>{{ categoryName(item.categoryId) }}</td>
              <td>{{ transactionTypeLabel(item.transactionType) }}</td>
              <td>{{ formatAmount(item.amount) }}</td>
              <td>{{ formatDateTime(item.transactionTime) }}</td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openTransactionEdit(item)">编辑</button>
                  <button class="ghost-button danger small" type="button" @click="deleteTransaction(item.id)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="transactionItems.length === 0">
              <td colspan="7" class="table-empty">当前筛选条件下暂无交易数据。</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="预算使用情况" title="预算执行概览" :compact="true">
        <template #actions>
          <button class="ghost-button" type="button" @click="loadUsageAndMonthly">刷新指标</button>
        </template>
        <div class="summary-grid">
          <div v-for="item in budgetUsage" :key="item.budgetId" class="summary-item">
            <strong>{{ item.budgetName }}</strong>
            <span>{{ formatAmount(item.spentAmount) }} / {{ formatAmount(item.budgetAmount) }}</span>
            <span :class="item.exceeded ? 'summary-danger' : item.alertTriggered ? 'summary-warn' : 'summary-normal'">
              {{ item.exceeded ? "已超支" : item.alertTriggered ? "达到预警" : "正常" }}
            </span>
          </div>
          <div v-if="budgetUsage.length === 0" class="empty-text">暂无预算使用情况。</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="月度汇总" title="近月收支走势" :compact="true">
        <div class="summary-grid">
          <div v-for="item in monthlySummary" :key="item.month" class="summary-item">
            <strong>{{ item.month }}</strong>
            <span>收入 {{ formatAmount(item.income) }}</span>
            <span>支出 {{ formatAmount(item.expense) }}</span>
          </div>
          <div v-if="monthlySummary.length === 0" class="empty-text">暂无月度汇总数据。</div>
        </div>
      </AdminTableCard>
    </div>

    <CrudModal v-model="showAccountModal" :title="accountForm.id ? '编辑账户' : '新增账户'">
      <div class="form-grid">
        <label class="field-block">
          <span>账户名称</span>
          <input v-model.trim="accountForm.accountName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>账户类型</span>
          <select v-model="accountForm.accountType" class="field-input">
            <option value="CASH">CASH</option>
            <option value="BANK">BANK</option>
            <option value="CREDIT">CREDIT</option>
            <option value="ALIPAY">ALIPAY</option>
            <option value="WECHAT">WECHAT</option>
          </select>
        </label>
        <label class="field-block">
          <span>所属成员</span>
          <select v-model.number="accountForm.ownerMemberId" class="field-input">
            <option :value="null">当前默认成员</option>
            <option v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>机构名称</span>
          <input v-model.trim="accountForm.institutionName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>账号尾号</span>
          <input v-model.trim="accountForm.accountNoMask" class="field-input" type="text" />
        </label>
        <label v-if="!accountForm.id" class="field-block">
          <span>当前余额</span>
          <input v-model.number="accountForm.currentBalance" class="field-input" type="number" step="0.01" />
        </label>
        <label class="field-block">
          <span>信用额度</span>
          <input v-model.number="accountForm.creditLimit" class="field-input" type="number" step="0.01" />
        </label>
        <label class="field-block">
          <span>账单日</span>
          <input v-model.number="accountForm.billingDay" class="field-input" type="number" min="1" max="31" />
        </label>
        <label class="field-block">
          <span>还款日</span>
          <input v-model.number="accountForm.repaymentDay" class="field-input" type="number" min="1" max="31" />
        </label>
        <label class="field-block">
          <span>是否共享</span>
          <select v-model.number="accountForm.isShared" class="field-input">
            <option :value="1">共享</option>
            <option :value="0">不共享</option>
          </select>
        </label>
        <label class="field-block field-block-full">
          <span>备注</span>
          <input v-model.trim="accountForm.remark" class="field-input" type="text" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitAccount">{{ accountForm.id ? "保存账户" : "创建账户" }}</button>
      </div>
    </CrudModal>

    <CrudModal v-model="showCategoryModal" :title="categoryForm.id ? '编辑分类' : '新增分类'">
      <div class="form-grid">
        <label class="field-block">
          <span>分类名称</span>
          <input v-model.trim="categoryForm.categoryName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>分类类型</span>
          <select v-model="categoryForm.categoryType" class="field-input">
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
          </select>
        </label>
        <label class="field-block">
          <span>适用范围</span>
          <select v-model="categoryForm.scopeType" class="field-input">
            <option value="FAMILY">家庭</option>
            <option value="PERSONAL">个人</option>
          </select>
        </label>
        <label class="field-block">
          <span>图标编码</span>
          <input v-model.trim="categoryForm.iconCode" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>排序值</span>
          <input v-model.number="categoryForm.sortOrder" class="field-input" type="number" />
        </label>
        <label class="field-block">
          <span>父分类 ID</span>
          <input v-model.number="categoryForm.parentId" class="field-input" type="number" min="1" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitCategory">{{ categoryForm.id ? "保存分类" : "创建分类" }}</button>
      </div>
    </CrudModal>

    <CrudModal v-model="showBudgetModal" :title="budgetForm.id ? '编辑预算' : '新增预算'">
      <div class="form-grid">
        <label class="field-block">
          <span>预算名称</span>
          <input v-model.trim="budgetForm.budgetName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>关联分类</span>
          <select v-model.number="budgetForm.categoryId" class="field-input">
            <option :value="null">请选择</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>预算周期</span>
          <select v-model="budgetForm.periodType" class="field-input">
            <option value="MONTHLY">月度</option>
            <option value="WEEKLY">周度</option>
            <option value="YEARLY">年度</option>
          </select>
        </label>
        <label class="field-block">
          <span>预算金额</span>
          <input v-model.number="budgetForm.amount" class="field-input" type="number" min="0.01" step="0.01" />
        </label>
        <label class="field-block">
          <span>预警比例</span>
          <input v-model.number="budgetForm.alertRatio" class="field-input" type="number" min="0" max="1" step="0.01" />
        </label>
        <label class="field-block">
          <span>开始日期</span>
          <input v-model="budgetForm.startDate" class="field-input" type="date" />
        </label>
        <label class="field-block">
          <span>结束日期</span>
          <input v-model="budgetForm.endDate" class="field-input" type="date" />
        </label>
        <label class="field-block field-block-full">
          <span>备注</span>
          <input v-model.trim="budgetForm.remark" class="field-input" type="text" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitBudget">{{ budgetForm.id ? "保存预算" : "创建预算" }}</button>
      </div>
    </CrudModal>

    <CrudModal v-model="showTransactionModal" :title="transactionForm.id ? '编辑交易' : '新增交易'">
      <div class="form-grid">
        <label class="field-block">
          <span>账户</span>
          <select v-model.number="transactionForm.accountId" class="field-input">
            <option :value="null">请选择</option>
            <option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.accountName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>分类</span>
          <select v-model.number="transactionForm.categoryId" class="field-input">
            <option :value="null">请选择</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option>
          </select>
        </label>
        <label class="field-block">
          <span>交易类型</span>
          <select v-model="transactionForm.transactionType" class="field-input">
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
            <option value="TRANSFER">转账</option>
          </select>
        </label>
        <label class="field-block">
          <span>金额</span>
          <input v-model.number="transactionForm.amount" class="field-input" type="number" min="0.01" step="0.01" />
        </label>
        <label class="field-block">
          <span>交易时间</span>
          <input v-model="transactionForm.transactionTime" class="field-input" type="datetime-local" />
        </label>
        <label class="field-block">
          <span>商户</span>
          <input v-model.trim="transactionForm.merchantName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>对方户名</span>
          <input v-model.trim="transactionForm.counterpartyName" class="field-input" type="text" />
        </label>
        <label class="field-block">
          <span>来源平台</span>
          <input v-model.trim="transactionForm.sourcePlatform" class="field-input" type="text" />
        </label>
        <label class="field-block field-block-full">
          <span>备注</span>
          <input v-model.trim="transactionForm.note" class="field-input" type="text" />
        </label>
      </div>
      <div class="button-row">
        <button class="primary-button" type="button" @click="submitTransaction">{{ transactionForm.id ? "保存交易" : "创建交易" }}</button>
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
import { accountsApi } from "@/api/accounts";
import { categoriesApi } from "@/api/categories";
import { budgetsApi } from "@/api/budgets";
import { transactionsApi } from "@/api/transactions";

const familyId = computed(() => authStore.currentFamilyId);
const accounts = ref([]);
const categories = ref([]);
const budgets = ref([]);
const budgetUsage = ref([]);
const monthlySummary = ref([]);
const transactionItems = ref([]);
const transactionTotal = ref(0);
const accountFeedback = ref("");
const categoryFeedback = ref("");
const budgetFeedback = ref("");
const transactionFeedback = ref("");
const showAccountModal = ref(false);
const showCategoryModal = ref(false);
const showBudgetModal = ref(false);
const showTransactionModal = ref(false);

const ownerOptions = computed(() => authStore.memberships
  .filter((item) => item.familyId === familyId.value && item.familyMemberId)
  .map((item) => ({
    value: item.familyMemberId,
    label: `${item.familyName || "当前家庭"} / ${item.roleCode || "MEMBER"} / ${item.familyMemberId}`
  })));

const accountForm = reactive({
  id: null,
  ownerMemberId: null,
  accountName: "",
  accountType: "BANK",
  institutionName: "",
  accountNoMask: "",
  currentBalance: 0,
  creditLimit: 0,
  billingDay: null,
  repaymentDay: null,
  isShared: 1,
  remark: ""
});

const categoryForm = reactive({
  id: null,
  parentId: null,
  categoryName: "",
  categoryType: "EXPENSE",
  scopeType: "FAMILY",
  iconCode: "",
  sortOrder: 10
});

const budgetForm = reactive({
  id: null,
  categoryId: null,
  budgetName: "",
  periodType: "MONTHLY",
  amount: 0,
  alertRatio: 0.8,
  startDate: todayDate(),
  endDate: "",
  remark: ""
});

const transactionForm = reactive({
  id: null,
  accountId: null,
  categoryId: null,
  transactionType: "EXPENSE",
  amount: 0,
  transactionTime: currentDateTimeLocal(),
  merchantName: "",
  counterpartyName: "",
  sourcePlatform: "MANUAL",
  note: ""
});

const transactionFilter = reactive({
  transactionType: "",
  startTime: "",
  endTime: ""
});

const transactionMeta = computed(() => `当前页 ${transactionItems.value.length} 条 / 总数 ${transactionTotal.value}`);

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("当前会话没有可用的家庭上下文。");
  }
  return familyId.value;
}

function resetAccountForm() {
  Object.assign(accountForm, {
    id: null,
    ownerMemberId: currentMemberId(),
    accountName: "",
    accountType: "BANK",
    institutionName: "",
    accountNoMask: "",
    currentBalance: 0,
    creditLimit: 0,
    billingDay: null,
    repaymentDay: null,
    isShared: 1,
    remark: ""
  });
}

function resetCategoryForm() {
  Object.assign(categoryForm, {
    id: null,
    parentId: null,
    categoryName: "",
    categoryType: "EXPENSE",
    scopeType: "FAMILY",
    iconCode: "",
    sortOrder: 10
  });
}

function resetBudgetForm() {
  Object.assign(budgetForm, {
    id: null,
    categoryId: null,
    budgetName: "",
    periodType: "MONTHLY",
    amount: 0,
    alertRatio: 0.8,
    startDate: todayDate(),
    endDate: "",
    remark: ""
  });
}

function resetTransactionForm() {
  Object.assign(transactionForm, {
    id: null,
    accountId: null,
    categoryId: null,
    transactionType: "EXPENSE",
    amount: 0,
    transactionTime: currentDateTimeLocal(),
    merchantName: "",
    counterpartyName: "",
    sourcePlatform: "MANUAL",
    note: ""
  });
}

function resetTransactionFilter() {
  Object.assign(transactionFilter, {
    transactionType: "",
    startTime: "",
    endTime: ""
  });
  loadTransactions();
}

function openAccountCreate() {
  resetAccountForm();
  showAccountModal.value = true;
}

function openAccountEdit(item) {
  Object.assign(accountForm, {
    id: item.id,
    ownerMemberId: item.ownerMemberId,
    accountName: item.accountName,
    accountType: item.accountType,
    institutionName: item.institutionName || "",
    accountNoMask: item.accountNoMask || "",
    currentBalance: item.currentBalance || 0,
    creditLimit: item.creditLimit || 0,
    billingDay: item.billingDay,
    repaymentDay: item.repaymentDay,
    isShared: item.isShared ?? 1,
    remark: item.remark || ""
  });
  showAccountModal.value = true;
}

function openCategoryCreate() {
  resetCategoryForm();
  showCategoryModal.value = true;
}

function openCategoryEdit(item) {
  Object.assign(categoryForm, { ...item });
  showCategoryModal.value = true;
}

function openBudgetCreate() {
  resetBudgetForm();
  showBudgetModal.value = true;
}

function openBudgetEdit(item) {
  Object.assign(budgetForm, {
    ...item,
    startDate: item.startDate || todayDate(),
    endDate: item.endDate || ""
  });
  showBudgetModal.value = true;
}

function openTransactionCreate() {
  resetTransactionForm();
  showTransactionModal.value = true;
}

function openTransactionEdit(item) {
  Object.assign(transactionForm, {
    ...item,
    transactionTime: toDateTimeLocal(item.transactionTime)
  });
  showTransactionModal.value = true;
}

async function loadAccounts() {
  accounts.value = await accountsApi.listByFamily(ensureFamilyId());
}

async function loadCategories() {
  categories.value = await categoriesApi.listByFamily(ensureFamilyId());
}

async function loadBudgets() {
  budgets.value = await budgetsApi.listByFamily(ensureFamilyId());
}

async function loadTransactions() {
  const response = await transactionsApi.search({
    familyId: ensureFamilyId(),
    transactionType: transactionFilter.transactionType || "",
    startTime: toApiDateTime(transactionFilter.startTime),
    endTime: toApiDateTime(transactionFilter.endTime),
    page: 0,
    size: 20
  });
  transactionItems.value = response.items || [];
  transactionTotal.value = response.totalElements || 0;
}

async function loadUsageAndMonthly() {
  budgetUsage.value = await budgetsApi.usage(ensureFamilyId());
  monthlySummary.value = await transactionsApi.monthlySummary(ensureFamilyId(), 6);
}

async function submitAccount() {
  try {
    if (accountForm.id) {
      await accountsApi.update(accountForm.id, buildAccountUpdatePayload());
      accountFeedback.value = "账户已更新。";
    } else {
      await accountsApi.create({ familyId: ensureFamilyId(), ...buildAccountCreatePayload() });
      accountFeedback.value = "账户已创建。";
    }
    showAccountModal.value = false;
    resetAccountForm();
    await loadAccounts();
  } catch (error) {
    accountFeedback.value = `账户操作失败：${error.message}`;
  }
}

async function toggleAccount(item) {
  try {
    if (item.status === 1) {
      await accountsApi.disable(item.id);
    } else {
      await accountsApi.enable(item.id);
    }
    await loadAccounts();
  } catch (error) {
    accountFeedback.value = `账户状态切换失败：${error.message}`;
  }
}

async function deleteAccount(id) {
  try {
    await accountsApi.remove(id);
    await loadAccounts();
  } catch (error) {
    accountFeedback.value = `账户删除失败：${error.message}`;
  }
}

async function submitCategory() {
  try {
    if (categoryForm.id) {
      await categoriesApi.update(categoryForm.id, buildCategoryPayload());
      categoryFeedback.value = "分类已更新。";
    } else {
      await categoriesApi.create({ familyId: ensureFamilyId(), ...buildCategoryPayload() });
      categoryFeedback.value = "分类已创建。";
    }
    showCategoryModal.value = false;
    resetCategoryForm();
    await loadCategories();
  } catch (error) {
    categoryFeedback.value = `分类操作失败：${error.message}`;
  }
}

async function toggleCategory(item) {
  try {
    if (item.enabled === 1) {
      await categoriesApi.disable(item.id);
    } else {
      await categoriesApi.enable(item.id);
    }
    await loadCategories();
  } catch (error) {
    categoryFeedback.value = `分类状态切换失败：${error.message}`;
  }
}

async function deleteCategory(id) {
  try {
    await categoriesApi.remove(id);
    await loadCategories();
  } catch (error) {
    categoryFeedback.value = `分类删除失败：${error.message}`;
  }
}

async function submitBudget() {
  try {
    if (budgetForm.id) {
      await budgetsApi.update(budgetForm.id, buildBudgetPayload());
      budgetFeedback.value = "预算已更新。";
    } else {
      await budgetsApi.create({ familyId: ensureFamilyId(), ...buildBudgetPayload() });
      budgetFeedback.value = "预算已创建。";
    }
    showBudgetModal.value = false;
    resetBudgetForm();
    await Promise.all([loadBudgets(), loadUsageAndMonthly()]);
  } catch (error) {
    budgetFeedback.value = `预算操作失败：${error.message}`;
  }
}

async function toggleBudget(item) {
  try {
    if (item.enabled === 1) {
      await budgetsApi.disable(item.id);
    } else {
      await budgetsApi.enable(item.id);
    }
    await Promise.all([loadBudgets(), loadUsageAndMonthly()]);
  } catch (error) {
    budgetFeedback.value = `预算状态切换失败：${error.message}`;
  }
}

async function deleteBudget(id) {
  try {
    await budgetsApi.remove(id);
    await Promise.all([loadBudgets(), loadUsageAndMonthly()]);
  } catch (error) {
    budgetFeedback.value = `预算删除失败：${error.message}`;
  }
}

async function submitTransaction() {
  try {
    if (transactionForm.id) {
      await transactionsApi.update(transactionForm.id, buildTransactionPayload());
      transactionFeedback.value = "交易已更新。";
    } else {
      await transactionsApi.create({ familyId: ensureFamilyId(), ...buildTransactionPayload() });
      transactionFeedback.value = "交易已创建。";
    }
    showTransactionModal.value = false;
    resetTransactionForm();
    await Promise.all([loadTransactions(), loadUsageAndMonthly()]);
  } catch (error) {
    transactionFeedback.value = `交易操作失败：${error.message}`;
  }
}

async function deleteTransaction(id) {
  try {
    await transactionsApi.remove(id);
    await Promise.all([loadTransactions(), loadUsageAndMonthly()]);
  } catch (error) {
    transactionFeedback.value = `交易删除失败：${error.message}`;
  }
}

function buildAccountCreatePayload() {
  return {
    ownerMemberId: nullableNumber(accountForm.ownerMemberId),
    accountName: accountForm.accountName,
    accountType: accountForm.accountType,
    institutionName: accountForm.institutionName || null,
    accountNoMask: accountForm.accountNoMask || null,
    currentBalance: accountForm.currentBalance,
    creditLimit: accountForm.creditLimit,
    billingDay: nullableNumber(accountForm.billingDay),
    repaymentDay: nullableNumber(accountForm.repaymentDay),
    isShared: nullableNumber(accountForm.isShared),
    remark: accountForm.remark || null
  };
}

function buildAccountUpdatePayload() {
  return {
    ownerMemberId: nullableNumber(accountForm.ownerMemberId),
    accountName: accountForm.accountName,
    accountType: accountForm.accountType,
    institutionName: accountForm.institutionName || null,
    accountNoMask: accountForm.accountNoMask || null,
    creditLimit: accountForm.creditLimit,
    billingDay: nullableNumber(accountForm.billingDay),
    repaymentDay: nullableNumber(accountForm.repaymentDay),
    isShared: nullableNumber(accountForm.isShared),
    remark: accountForm.remark || null
  };
}

function buildCategoryPayload() {
  return {
    parentId: nullableNumber(categoryForm.parentId),
    categoryName: categoryForm.categoryName,
    categoryType: categoryForm.categoryType,
    scopeType: categoryForm.scopeType,
    iconCode: categoryForm.iconCode || null,
    sortOrder: nullableNumber(categoryForm.sortOrder)
  };
}

function buildBudgetPayload() {
  return {
    categoryId: requiredNumber(budgetForm.categoryId),
    budgetName: budgetForm.budgetName,
    periodType: budgetForm.periodType,
    amount: budgetForm.amount,
    alertRatio: budgetForm.alertRatio,
    startDate: budgetForm.startDate,
    endDate: budgetForm.endDate || null,
    remark: budgetForm.remark || null
  };
}

function buildTransactionPayload() {
  return {
    accountId: requiredNumber(transactionForm.accountId),
    targetAccountId: null,
    categoryId: nullableNumber(transactionForm.categoryId),
    createdByMemberId: currentMemberId(),
    transactionType: transactionForm.transactionType,
    amount: transactionForm.amount,
    transactionTime: toApiDateTime(transactionForm.transactionTime),
    merchantName: transactionForm.merchantName || null,
    counterpartyName: transactionForm.counterpartyName || null,
    sourcePlatform: transactionForm.sourcePlatform || null,
    externalTradeNo: null,
    note: transactionForm.note || null
  };
}

function currentMemberId() {
  return authStore.memberships.find((item) => item.familyId === familyId.value)?.familyMemberId || null;
}

function requiredNumber(value) {
  if (value === null || value === undefined || value === "") {
    throw new Error("必填选择项不能为空。");
  }
  return Number(value);
}

function nullableNumber(value) {
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

function toDateTimeLocal(value) {
  if (!value) {
    return currentDateTimeLocal();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return currentDateTimeLocal();
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function currentDateTimeLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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

function categoryName(categoryId) {
  if (!categoryId) {
    return "-";
  }
  return categories.value.find((item) => item.id === categoryId)?.categoryName || `#${categoryId}`;
}

function accountName(accountId) {
  if (!accountId) {
    return "-";
  }
  return accounts.value.find((item) => item.id === accountId)?.accountName || `#${accountId}`;
}

function ownerName(ownerMemberId) {
  if (!ownerMemberId) {
    return "家庭共享";
  }
  return ownerOptions.value.find((item) => item.value === ownerMemberId)?.label || `成员 #${ownerMemberId}`;
}

function transactionTypeLabel(value) {
  if (value === "EXPENSE") {
    return "支出";
  }
  if (value === "INCOME") {
    return "收入";
  }
  if (value === "TRANSFER") {
    return "转账";
  }
  return value || "-";
}

onMounted(async () => {
  if (!familyId.value) {
    accountFeedback.value = "当前账号还没有家庭上下文，请先在“用户与家庭”中创建家庭或加入家庭。";
    return;
  }
  try {
    await Promise.all([loadAccounts(), loadCategories(), loadBudgets(), loadTransactions(), loadUsageAndMonthly()]);
  } catch (error) {
    accountFeedback.value = `业务数据初始加载失败：${error.message}`;
  }
});
</script>
