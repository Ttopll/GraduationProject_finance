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
        &#36134;&#25143;&#12289;&#20998;&#31867;&#12289;&#39044;&#31639;&#21644;&#20132;&#26131;&#37117;&#24517;&#39035;&#24402;&#23646;&#21040;&#26576;&#20010;&#23478;&#24237;&#19979;&#12290;&#35831;&#20808;&#21069;&#24448;&#8220;&#29992;&#25143;&#19982;&#23478;&#24237;&#8221;&#39029;&#38754;&#21019;&#24314;&#23478;&#24237;&#25110;&#21152;&#20837;&#23478;&#24237;&#12290;
      </div>
    </article>

    <div class="stats-grid">
      <StatCard label="&#24403;&#21069;&#23478;&#24237;" :value="familyId || '-'" meta="&#24403;&#21069;&#39029;&#38754;&#25152;&#26377;&#35831;&#27714;&#37117;&#32465;&#23450; familyId" />
      <StatCard label="&#36134;&#25143;&#25968;" :value="accounts.length" meta="&#29616;&#37329;&#12289;&#38134;&#34892;&#21345;&#12289;&#20449;&#29992;&#21345;&#31561;&#36164;&#37329;&#36134;&#25143;" />
      <StatCard label="&#20998;&#31867;&#25968;" :value="categories.length" meta="&#25910;&#20837;&#19982;&#25903;&#20986;&#20998;&#31867;&#32500;&#24230;" />
      <StatCard label="&#20132;&#26131;&#25968;" :value="transactionTotal" :meta="transactionMeta" />
    </div>

    <AdminTableCard kicker="&#36134;&#25143;" title="&#36134;&#25143;&#31649;&#29702;">
      <template #actions>
        <button class="primary-button" type="button" @click="openAccountCreate">&#26032;&#22686;&#36134;&#25143;</button>
        <button class="ghost-button" type="button" @click="loadAccounts">&#21047;&#26032;</button>
      </template>
      <template #feedback>
        <div v-if="accountFeedback" class="feedback-box info">{{ accountFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#36134;&#25143;&#20449;&#24687;</th>
              <th>&#31867;&#22411;</th>
              <th>&#25152;&#23646;&#25104;&#21592;</th>
              <th>&#24403;&#21069;&#20313;&#39069;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in accounts" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.accountName }}</div>
                <div class="secondary-cell">{{ item.institutionName || "\u672a\u586b\u5199\u673a\u6784" }} / {{ item.accountNoMask || "\u672a\u586b\u5199\u5c3e\u53f7" }}</div>
              </td>
              <td>{{ accountTypeLabel(item.accountType) }}</td>
              <td>{{ ownerName(item.ownerMemberId) }}</td>
              <td>{{ formatAmount(item.currentBalance) }}</td>
              <td><span class="status-badge" :class="item.status === 1 ? 'is-success' : 'is-muted'">{{ item.status === 1 ? "\u542f\u7528" : "\u505c\u7528" }}</span></td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openAccountEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="toggleAccount(item)">{{ item.status === 1 ? "\u505c\u7528" : "\u542f\u7528" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteAccount(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="accounts.length === 0"><td colspan="6" class="table-empty">&#24403;&#21069;&#23478;&#24237;&#19979;&#26242;&#26080;&#36134;&#25143;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#20998;&#31867;" title="&#20998;&#31867;&#31649;&#29702;">
      <template #actions>
        <button class="primary-button" type="button" @click="openCategoryCreate">&#26032;&#22686;&#20998;&#31867;</button>
        <button class="ghost-button" type="button" @click="loadCategories">&#21047;&#26032;</button>
      </template>
      <template #feedback>
        <div v-if="categoryFeedback" class="feedback-box info">{{ categoryFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#20998;&#31867;&#21517;&#31216;</th>
              <th>&#31867;&#22411;</th>
              <th>&#33539;&#22260;</th>
              <th>&#25490;&#24207;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in categories" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.categoryName }}</div>
                <div class="secondary-cell">ID {{ item.id }} / &#29238;&#20998;&#31867; {{ item.parentId ?? "-" }}</div>
              </td>
              <td>{{ categoryTypeLabel(item.categoryType) }}</td>
              <td>{{ scopeTypeLabel(item.scopeType) }}</td>
              <td>{{ item.sortOrder ?? "-" }}</td>
              <td><span class="status-badge" :class="item.enabled === 1 ? 'is-success' : 'is-muted'">{{ item.enabled === 1 ? "\u542f\u7528" : "\u505c\u7528" }}</span></td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openCategoryEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="toggleCategory(item)">{{ item.enabled === 1 ? "\u505c\u7528" : "\u542f\u7528" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteCategory(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="categories.length === 0"><td colspan="6" class="table-empty">&#24403;&#21069;&#23478;&#24237;&#19979;&#26242;&#26080;&#20998;&#31867;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#39044;&#31639;" title="&#39044;&#31639;&#31649;&#29702;">
      <template #actions>
        <button class="primary-button" type="button" @click="openBudgetCreate">&#26032;&#22686;&#39044;&#31639;</button>
        <button class="ghost-button" type="button" @click="loadBudgets">&#21047;&#26032;</button>
      </template>
      <template #feedback>
        <div v-if="budgetFeedback" class="feedback-box info">{{ budgetFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#39044;&#31639;&#21517;&#31216;</th>
              <th>&#20851;&#32852;&#20998;&#31867;</th>
              <th>&#21608;&#26399;</th>
              <th>&#37329;&#39069;</th>
              <th>&#39044;&#35686;&#27604;&#20363;</th>
              <th>&#29366;&#24577;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in budgets" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.budgetName }}</div>
                <div class="secondary-cell">{{ item.startDate || "-" }} &#33267; {{ item.endDate || "\u957f\u671f\u6709\u6548" }}</div>
              </td>
              <td>{{ categoryName(item.categoryId) }}</td>
              <td>{{ budgetPeriodLabel(item.periodType) }}</td>
              <td>{{ formatAmount(item.amount) }}</td>
              <td>{{ item.alertRatio ?? "-" }}</td>
              <td><span class="status-badge" :class="item.enabled === 1 ? 'is-success' : 'is-muted'">{{ item.enabled === 1 ? "\u542f\u7528" : "\u505c\u7528" }}</span></td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openBudgetEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button small" type="button" @click="toggleBudget(item)">{{ item.enabled === 1 ? "\u505c\u7528" : "\u542f\u7528" }}</button>
                  <button class="ghost-button danger small" type="button" @click="deleteBudget(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="budgets.length === 0"><td colspan="7" class="table-empty">&#24403;&#21069;&#23478;&#24237;&#19979;&#26242;&#26080;&#39044;&#31639;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <AdminTableCard kicker="&#20132;&#26131;" title="&#20132;&#26131;&#31649;&#29702;">
      <template #actions>
        <button class="primary-button" type="button" @click="openTransactionCreate">&#26032;&#22686;&#20132;&#26131;</button>
        <button class="ghost-button" type="button" @click="loadTransactions">&#21047;&#26032;</button>
      </template>
      <template #filters>
        <FilterBar>
          <label class="field-inline">
            <span>&#20132;&#26131;&#31867;&#22411;</span>
            <select v-model="transactionFilter.transactionType" class="field-input">
              <option value="">&#20840;&#37096;</option>
              <option value="EXPENSE">&#25903;&#20986;</option>
              <option value="INCOME">&#25910;&#20837;</option>
              <option value="TRANSFER">&#36716;&#36134;</option>
            </select>
          </label>
          <label class="field-inline">
            <span>&#24320;&#22987;&#26102;&#38388;</span>
            <input v-model="transactionFilter.startTime" class="field-input" type="datetime-local" />
          </label>
          <label class="field-inline">
            <span>&#32467;&#26463;&#26102;&#38388;</span>
            <input v-model="transactionFilter.endTime" class="field-input" type="datetime-local" />
          </label>
          <button class="ghost-button" type="button" @click="loadTransactions">&#26597;&#35810;</button>
          <button class="ghost-button" type="button" @click="resetTransactionFilter">&#37325;&#32622;</button>
        </FilterBar>
      </template>
      <template #feedback>
        <div v-if="transactionFeedback" class="feedback-box info">{{ transactionFeedback }}</div>
      </template>
      <div class="table-shell">
        <table class="admin-table">
          <thead>
            <tr>
              <th>&#20132;&#26131;&#20449;&#24687;</th>
              <th>&#36134;&#25143;</th>
              <th>&#20998;&#31867;</th>
              <th>&#31867;&#22411;</th>
              <th>&#37329;&#39069;</th>
              <th>&#26102;&#38388;</th>
              <th>&#25805;&#20316;</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in transactionItems" :key="item.id">
              <td>
                <div class="primary-cell">{{ item.merchantName || item.counterpartyName || "\u624b\u5de5\u8bb0\u5f55" }}</div>
                <div class="secondary-cell">{{ item.note || item.sourcePlatform || "-" }}</div>
              </td>
              <td>{{ accountName(item.accountId) }}</td>
              <td>{{ categoryName(item.categoryId) }}</td>
              <td>{{ transactionTypeLabel(item.transactionType) }}</td>
              <td>{{ formatAmount(item.amount) }}</td>
              <td>{{ formatDateTime(item.transactionTime) }}</td>
              <td>
                <div class="row-actions row-actions-left">
                  <button class="ghost-button small" type="button" @click="openTransactionEdit(item)">&#32534;&#36753;</button>
                  <button class="ghost-button danger small" type="button" @click="deleteTransaction(item.id)">&#21024;&#38500;</button>
                </div>
              </td>
            </tr>
            <tr v-if="transactionItems.length === 0"><td colspan="7" class="table-empty">&#24403;&#21069;&#31579;&#36873;&#26465;&#20214;&#19979;&#26242;&#26080;&#20132;&#26131;&#25968;&#25454;&#12290;</td></tr>
          </tbody>
        </table>
      </div>
    </AdminTableCard>

    <div class="panel-grid panel-grid-wide">
      <AdminTableCard kicker="&#39044;&#31639;&#20351;&#29992;&#24773;&#20917;" title="&#39044;&#31639;&#25191;&#34892;&#27010;&#35272;" :compact="true">
        <template #actions>
          <button class="ghost-button" type="button" @click="loadUsageAndMonthly">&#21047;&#26032;&#25351;&#26631;</button>
        </template>
        <div class="summary-grid">
          <div v-for="item in budgetUsage" :key="item.budgetId" class="summary-item">
            <strong>{{ item.budgetName }}</strong>
            <span>{{ formatAmount(item.spentAmount) }} / {{ formatAmount(item.budgetAmount) }}</span>
            <span :class="item.exceeded ? 'summary-danger' : item.alertTriggered ? 'summary-warn' : 'summary-normal'">
              {{ item.exceeded ? "\u5df2\u8d85\u652f" : item.alertTriggered ? "\u8fbe\u5230\u9884\u8b66" : "\u6b63\u5e38" }}
            </span>
          </div>
          <div v-if="budgetUsage.length === 0" class="empty-text">&#26242;&#26080;&#39044;&#31639;&#20351;&#29992;&#24773;&#20917;&#12290;</div>
        </div>
      </AdminTableCard>

      <AdminTableCard kicker="&#26376;&#24230;&#27719;&#24635;" title="&#36817;&#26376;&#25910;&#25903;&#36208;&#21183;" :compact="true">
        <div class="summary-grid">
          <div v-for="item in monthlySummary" :key="item.month" class="summary-item">
            <strong>{{ item.month }}</strong>
            <span>&#25910;&#20837; {{ formatAmount(item.income) }}</span>
            <span>&#25903;&#20986; {{ formatAmount(item.expense) }}</span>
          </div>
          <div v-if="monthlySummary.length === 0" class="empty-text">&#26242;&#26080;&#26376;&#24230;&#27719;&#24635;&#25968;&#25454;&#12290;</div>
        </div>
      </AdminTableCard>
    </div>

    <CrudModal v-model="showAccountModal" :title="accountForm.id ? '\u7f16\u8f91\u8d26\u6237' : '\u65b0\u589e\u8d26\u6237'">
      <div class="form-grid">
        <label class="field-block"><span>&#36134;&#25143;&#21517;&#31216;</span><input v-model.trim="accountForm.accountName" class="field-input" type="text" /></label>
        <label class="field-block">
          <span>&#36134;&#25143;&#31867;&#22411;</span>
          <select v-model="accountForm.accountType" class="field-input">
            <option value="CASH">&#29616;&#37329;</option>
            <option value="BANK">&#38134;&#34892;&#21345;</option>
            <option value="CREDIT">&#20449;&#29992;&#21345;</option>
            <option value="ALIPAY">&#25903;&#20184;&#23453;</option>
            <option value="WECHAT">&#24494;&#20449;</option>
          </select>
        </label>
        <label class="field-block">
          <span>&#25152;&#23646;&#25104;&#21592;</span>
          <select v-model.number="accountForm.ownerMemberId" class="field-input">
            <option :value="null">&#24403;&#21069;&#40664;&#35748;&#25104;&#21592;</option>
            <option v-for="item in ownerOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-block"><span>&#26426;&#26500;&#21517;&#31216;</span><input v-model.trim="accountForm.institutionName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#36134;&#21495;&#23614;&#21495;</span><input v-model.trim="accountForm.accountNoMask" class="field-input" type="text" /></label>
        <label v-if="!accountForm.id" class="field-block"><span>&#24403;&#21069;&#20313;&#39069;</span><input v-model.number="accountForm.currentBalance" class="field-input" type="number" step="0.01" /></label>
        <label class="field-block"><span>&#20449;&#29992;&#39069;&#24230;</span><input v-model.number="accountForm.creditLimit" class="field-input" type="number" step="0.01" /></label>
        <label class="field-block"><span>&#36134;&#21333;&#26085;</span><input v-model.number="accountForm.billingDay" class="field-input" type="number" min="1" max="31" /></label>
        <label class="field-block"><span>&#36824;&#27454;&#26085;</span><input v-model.number="accountForm.repaymentDay" class="field-input" type="number" min="1" max="31" /></label>
        <label class="field-block"><span>&#26159;&#21542;&#20849;&#20139;</span><select v-model.number="accountForm.isShared" class="field-input"><option :value="1">&#20849;&#20139;</option><option :value="0">&#19981;&#20849;&#20139;</option></select></label>
        <label class="field-block field-block-full"><span>&#22791;&#27880;</span><input v-model.trim="accountForm.remark" class="field-input" type="text" /></label>
      </div>
      <div class="feedback-box info">{{ accountFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitAccount">{{ accountForm.id ? "\u4fdd\u5b58\u8d26\u6237" : "\u521b\u5efa\u8d26\u6237" }}</button></div>
    </CrudModal>

    <CrudModal v-model="showCategoryModal" :title="categoryForm.id ? '\u7f16\u8f91\u5206\u7c7b' : '\u65b0\u589e\u5206\u7c7b'">
      <div class="form-grid">
        <label class="field-block"><span>&#20998;&#31867;&#21517;&#31216;</span><input v-model.trim="categoryForm.categoryName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#20998;&#31867;&#31867;&#22411;</span><select v-model="categoryForm.categoryType" class="field-input"><option value="EXPENSE">&#25903;&#20986;</option><option value="INCOME">&#25910;&#20837;</option></select></label>
        <label class="field-block"><span>&#36866;&#29992;&#33539;&#22260;</span><select v-model="categoryForm.scopeType" class="field-input"><option value="FAMILY">&#23478;&#24237;</option><option value="PERSONAL">&#20010;&#20154;</option></select></label>
        <label class="field-block"><span>&#22270;&#26631;&#32534;&#30721;</span><input v-model.trim="categoryForm.iconCode" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#25490;&#24207;&#20540;</span><input v-model.number="categoryForm.sortOrder" class="field-input" type="number" /></label>
        <label class="field-block"><span>&#29238;&#20998;&#31867; ID</span><input v-model.number="categoryForm.parentId" class="field-input" type="number" min="1" /></label>
      </div>
      <div class="feedback-box info">{{ categoryFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitCategory">{{ categoryForm.id ? "\u4fdd\u5b58\u5206\u7c7b" : "\u521b\u5efa\u5206\u7c7b" }}</button></div>
    </CrudModal>

    <CrudModal v-model="showBudgetModal" :title="budgetForm.id ? '\u7f16\u8f91\u9884\u7b97' : '\u65b0\u589e\u9884\u7b97'">
      <div class="form-grid">
        <label class="field-block"><span>&#39044;&#31639;&#21517;&#31216;</span><input v-model.trim="budgetForm.budgetName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#20851;&#32852;&#20998;&#31867;</span><select v-model.number="budgetForm.categoryId" class="field-input"><option :value="null">&#35831;&#36873;&#25321;</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option></select></label>
        <label class="field-block"><span>&#39044;&#31639;&#21608;&#26399;</span><select v-model="budgetForm.periodType" class="field-input"><option value="MONTH">&#26376;&#24230;</option><option value="YEAR">&#24180;&#24230;</option></select></label>
        <label class="field-block"><span>&#39044;&#31639;&#37329;&#39069;</span><input v-model.number="budgetForm.amount" class="field-input" type="number" min="0.01" step="0.01" /></label>
        <label class="field-block"><span>&#39044;&#35686;&#27604;&#20363;</span><input v-model.number="budgetForm.alertRatio" class="field-input" type="number" min="0" max="1" step="0.01" /></label>
        <label class="field-block"><span>&#24320;&#22987;&#26085;&#26399;</span><input v-model="budgetForm.startDate" class="field-input" type="date" /></label>
        <label class="field-block"><span>&#32467;&#26463;&#26085;&#26399;</span><input v-model="budgetForm.endDate" class="field-input" type="date" /></label>
        <label class="field-block field-block-full"><span>&#22791;&#27880;</span><input v-model.trim="budgetForm.remark" class="field-input" type="text" /></label>
      </div>
      <div class="feedback-box info">{{ budgetFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitBudget">{{ budgetForm.id ? "\u4fdd\u5b58\u9884\u7b97" : "\u521b\u5efa\u9884\u7b97" }}</button></div>
    </CrudModal>

    <CrudModal v-model="showTransactionModal" :title="transactionForm.id ? '\u7f16\u8f91\u4ea4\u6613' : '\u65b0\u589e\u4ea4\u6613'">
      <div class="form-grid">
        <label class="field-block"><span>&#36134;&#25143;</span><select v-model.number="transactionForm.accountId" class="field-input"><option :value="null">&#35831;&#36873;&#25321;</option><option v-for="item in accounts" :key="item.id" :value="item.id">{{ item.accountName }}</option></select></label>
        <label class="field-block"><span>&#20998;&#31867;</span><select v-model.number="transactionForm.categoryId" class="field-input"><option :value="null">&#35831;&#36873;&#25321;</option><option v-for="item in categories" :key="item.id" :value="item.id">{{ item.categoryName }}</option></select></label>
        <label class="field-block"><span>&#20132;&#26131;&#31867;&#22411;</span><select v-model="transactionForm.transactionType" class="field-input"><option value="EXPENSE">&#25903;&#20986;</option><option value="INCOME">&#25910;&#20837;</option><option value="TRANSFER">&#36716;&#36134;</option></select></label>
        <label class="field-block"><span>&#37329;&#39069;</span><input v-model.number="transactionForm.amount" class="field-input" type="number" min="0.01" step="0.01" /></label>
        <label class="field-block"><span>&#20132;&#26131;&#26102;&#38388;</span><input v-model="transactionForm.transactionTime" class="field-input" type="datetime-local" /></label>
        <label class="field-block"><span>&#21830;&#25143;</span><input v-model.trim="transactionForm.merchantName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#23545;&#26041;&#25143;&#21517;</span><input v-model.trim="transactionForm.counterpartyName" class="field-input" type="text" /></label>
        <label class="field-block"><span>&#26469;&#28304;&#24179;&#21488;</span><input v-model.trim="transactionForm.sourcePlatform" class="field-input" type="text" /></label>
        <label class="field-block field-block-full"><span>&#22791;&#27880;</span><input v-model.trim="transactionForm.note" class="field-input" type="text" /></label>
      </div>
      <div class="feedback-box info">{{ transactionFormTip }}</div>
      <div class="button-row"><button class="primary-button" type="button" @click="submitTransaction">{{ transactionForm.id ? "\u4fdd\u5b58\u4ea4\u6613" : "\u521b\u5efa\u4ea4\u6613" }}</button></div>
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
import { accountsApi } from "@/api/accounts";
import { categoriesApi } from "@/api/categories";
import { budgetsApi } from "@/api/budgets";
import { transactionsApi } from "@/api/transactions";
import { usePageRefresh } from "@/composables/pageRefresh";

const route = useRoute();
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
    label: `${item.familyName || "\u5f53\u524d\u5bb6\u5ead"} / ${item.roleCode || "MEMBER"} / ${item.familyMemberId}`
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
  periodType: "MONTH",
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

const transactionMeta = computed(() => `\u5f53\u524d\u9875 ${transactionItems.value.length} \u6761 / \u603b\u6570 ${transactionTotal.value}`);
const accountFormTip = computed(() => "\u5efa\u8bae\u586b\u5199\u8d26\u6237\u540d\u79f0\u3001\u8d26\u6237\u7c7b\u578b\u548c\u57fa\u672c\u4fe1\u606f\uff0c\u4fe1\u7528\u5361\u573a\u666f\u53ef\u518d\u8865\u5145\u8d26\u5355\u65e5\u4e0e\u8fd8\u6b3e\u65e5\u3002");
const categoryFormTip = computed(() => "\u5bb6\u5ead\u7ef4\u5ea6\u7684\u6536\u652f\u5206\u7c7b\u5efa\u8bae\u8bbe\u7f6e\u4e3a FAMILY\uff0c\u65b9\u4fbf\u9884\u7b97\u4e0e\u89c4\u5219\u6a21\u5757\u76f4\u63a5\u4f7f\u7528\u3002");
const budgetFormTip = computed(() => "\u9884\u7b97\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0\uff0c\u4e14\u9700\u8981\u7ed1\u5b9a\u5230\u4e00\u4e2a\u6709\u6548\u5206\u7c7b\u4e0a\u3002");
const transactionFormTip = computed(() => "\u4ea4\u6613\u8bb0\u5f55\u5efa\u8bae\u586b\u5199\u8d26\u6237\u3001\u4ea4\u6613\u7c7b\u578b\u3001\u91d1\u989d\u548c\u53d1\u751f\u65f6\u95f4\uff0c\u4fbf\u4e8e\u540e\u7eed\u5206\u6790\u7edf\u8ba1\u3002");

function ensureFamilyId() {
  if (!familyId.value) {
    throw new Error("\u5f53\u524d\u4f1a\u8bdd\u6ca1\u6709\u53ef\u7528\u7684\u5bb6\u5ead\u4e0a\u4e0b\u6587\u3002");
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
    periodType: "MONTH",
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
  Object.assign(transactionFilter, { transactionType: "", startTime: "", endTime: "" });
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

async function refreshAll() {
  if (!familyId.value) {
    accountFeedback.value = "\u5f53\u524d\u8d26\u53f7\u8fd8\u6ca1\u6709\u5bb6\u5ead\u4e0a\u4e0b\u6587\uff0c\u8bf7\u5148\u5728\u201c\u7528\u6237\u4e0e\u5bb6\u5ead\u201d\u4e2d\u521b\u5efa\u5bb6\u5ead\u6216\u52a0\u5165\u5bb6\u5ead\u3002";
    return;
  }
  await Promise.all([loadAccounts(), loadCategories(), loadBudgets(), loadTransactions(), loadUsageAndMonthly()]);
  applyFocusHint();
}

function applyFocusHint() {
  const focus = String(route.query.focus || "");
  if (focus === "budget") {
    budgetFeedback.value = "已从财务分析进入预算处理，请优先检查超支或接近预警线的预算。";
  }
  if (focus === "transaction") {
    transactionFeedback.value = "已从财务分析进入收支处理，请核对支出分类、交易金额和异常消费记录。";
    transactionFilter.transactionType = "EXPENSE";
  }
  if (focus === "category") {
    categoryFeedback.value = "已进入分类维护，请检查支出分类是否完整，便于后续统计分析。";
  }
}

async function submitAccount() {
  try {
    validateAccountForm();
    if (accountForm.id) {
      await accountsApi.update(accountForm.id, buildAccountUpdatePayload());
      accountFeedback.value = "\u8d26\u6237\u5df2\u66f4\u65b0\u3002";
    } else {
      await accountsApi.create({ familyId: ensureFamilyId(), ...buildAccountCreatePayload() });
      accountFeedback.value = "\u8d26\u6237\u5df2\u521b\u5efa\u3002";
    }
    showAccountModal.value = false;
    resetAccountForm();
    await loadAccounts();
  } catch (error) {
    accountFeedback.value = `\u8d26\u6237\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
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
    accountFeedback.value = `\u8d26\u6237\u72b6\u6001\u5207\u6362\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteAccount(id) {
  try {
    await accountsApi.remove(id);
    await loadAccounts();
  } catch (error) {
    accountFeedback.value = `\u8d26\u6237\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

async function submitCategory() {
  try {
    validateCategoryForm();
    if (categoryForm.id) {
      await categoriesApi.update(categoryForm.id, buildCategoryPayload());
      categoryFeedback.value = "\u5206\u7c7b\u5df2\u66f4\u65b0\u3002";
    } else {
      await categoriesApi.create({ familyId: ensureFamilyId(), ...buildCategoryPayload() });
      categoryFeedback.value = "\u5206\u7c7b\u5df2\u521b\u5efa\u3002";
    }
    showCategoryModal.value = false;
    resetCategoryForm();
    await loadCategories();
  } catch (error) {
    categoryFeedback.value = `\u5206\u7c7b\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
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
    categoryFeedback.value = `\u5206\u7c7b\u72b6\u6001\u5207\u6362\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteCategory(id) {
  try {
    await categoriesApi.remove(id);
    await loadCategories();
  } catch (error) {
    categoryFeedback.value = `\u5206\u7c7b\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

async function submitBudget() {
  try {
    validateBudgetForm();
    if (budgetForm.id) {
      await budgetsApi.update(budgetForm.id, buildBudgetPayload());
      budgetFeedback.value = "\u9884\u7b97\u5df2\u66f4\u65b0\u3002";
    } else {
      await budgetsApi.create({ familyId: ensureFamilyId(), ...buildBudgetPayload() });
      budgetFeedback.value = "\u9884\u7b97\u5df2\u521b\u5efa\u3002";
    }
    showBudgetModal.value = false;
    resetBudgetForm();
    await Promise.all([loadBudgets(), loadUsageAndMonthly()]);
  } catch (error) {
    budgetFeedback.value = `\u9884\u7b97\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
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
    budgetFeedback.value = `\u9884\u7b97\u72b6\u6001\u5207\u6362\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteBudget(id) {
  try {
    await budgetsApi.remove(id);
    await Promise.all([loadBudgets(), loadUsageAndMonthly()]);
  } catch (error) {
    budgetFeedback.value = `\u9884\u7b97\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

async function submitTransaction() {
  try {
    validateTransactionForm();
    if (transactionForm.id) {
      await transactionsApi.update(transactionForm.id, buildTransactionPayload());
      transactionFeedback.value = "\u4ea4\u6613\u5df2\u66f4\u65b0\u3002";
    } else {
      await transactionsApi.create({ familyId: ensureFamilyId(), ...buildTransactionPayload() });
      transactionFeedback.value = "\u4ea4\u6613\u5df2\u521b\u5efa\u3002";
    }
    showTransactionModal.value = false;
    resetTransactionForm();
    await Promise.all([loadTransactions(), loadUsageAndMonthly()]);
  } catch (error) {
    transactionFeedback.value = `\u4ea4\u6613\u64cd\u4f5c\u5931\u8d25\uff1a${error.message}`;
  }
}

async function deleteTransaction(id) {
  try {
    await transactionsApi.remove(id);
    await Promise.all([loadTransactions(), loadUsageAndMonthly()]);
  } catch (error) {
    transactionFeedback.value = `\u4ea4\u6613\u5220\u9664\u5931\u8d25\uff1a${error.message}`;
  }
}

function validateAccountForm() {
  if (!accountForm.accountName.trim()) {
    throw new Error("\u8bf7\u586b\u5199\u8d26\u6237\u540d\u79f0\u3002");
  }
  if (accountForm.billingDay && (accountForm.billingDay < 1 || accountForm.billingDay > 31)) {
    throw new Error("\u8d26\u5355\u65e5\u5fc5\u987b\u5728 1-31 \u4e4b\u95f4\u3002");
  }
  if (accountForm.repaymentDay && (accountForm.repaymentDay < 1 || accountForm.repaymentDay > 31)) {
    throw new Error("\u8fd8\u6b3e\u65e5\u5fc5\u987b\u5728 1-31 \u4e4b\u95f4\u3002");
  }
}

function validateCategoryForm() {
  if (!categoryForm.categoryName.trim()) {
    throw new Error("\u8bf7\u586b\u5199\u5206\u7c7b\u540d\u79f0\u3002");
  }
}

function validateBudgetForm() {
  if (!budgetForm.budgetName.trim()) {
    throw new Error("\u8bf7\u586b\u5199\u9884\u7b97\u540d\u79f0\u3002");
  }
  if (!budgetForm.categoryId) {
    throw new Error("\u8bf7\u9009\u62e9\u5173\u8054\u5206\u7c7b\u3002");
  }
  if (!budgetForm.amount || Number(budgetForm.amount) <= 0) {
    throw new Error("\u9884\u7b97\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0\u3002");
  }
}

function validateTransactionForm() {
  if (!transactionForm.accountId) {
    throw new Error("\u8bf7\u9009\u62e9\u8d26\u6237\u3002");
  }
  if (!transactionForm.amount || Number(transactionForm.amount) <= 0) {
    throw new Error("\u4ea4\u6613\u91d1\u989d\u5fc5\u987b\u5927\u4e8e 0\u3002");
  }
  if (!transactionForm.transactionTime) {
    throw new Error("\u8bf7\u9009\u62e9\u4ea4\u6613\u65f6\u95f4\u3002");
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
    return "\u5bb6\u5ead\u5171\u4eab";
  }
  return ownerOptions.value.find((item) => item.value === ownerMemberId)?.label || `\u6210\u5458 #${ownerMemberId}`;
}

function transactionTypeLabel(value) {
  return { EXPENSE: "\u652f\u51fa", INCOME: "\u6536\u5165", TRANSFER: "\u8f6c\u8d26" }[value] || value || "-";
}

function accountTypeLabel(value) {
  return { CASH: "\u73b0\u91d1", BANK: "\u94f6\u884c\u5361", CREDIT: "\u4fe1\u7528\u5361", ALIPAY: "\u652f\u4ed8\u5b9d", WECHAT: "\u5fae\u4fe1" }[value] || value || "-";
}

function categoryTypeLabel(value) {
  return { EXPENSE: "\u652f\u51fa", INCOME: "\u6536\u5165" }[value] || value || "-";
}

function scopeTypeLabel(value) {
  return { FAMILY: "\u5bb6\u5ead", PERSONAL: "\u4e2a\u4eba" }[value] || value || "-";
}

function budgetPeriodLabel(value) {
  return { MONTH: "\\u6708\\u5ea6", YEAR: "\\u5e74\\u5ea6" }[value] || value || "-";
}

onMounted(async () => {
  try {
    await refreshAll();
  } catch (error) {
    accountFeedback.value = `\u4e1a\u52a1\u6570\u636e\u521d\u59cb\u52a0\u8f7d\u5931\u8d25\uff1a${error.message}`;
  }
});

usePageRefresh(refreshAll);
</script>
