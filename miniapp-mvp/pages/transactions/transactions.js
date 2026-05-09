const { request } = require("../../utils/api");
const session = require("../../utils/session");

const TYPE_OPTIONS = ["", "EXPENSE", "INCOME", "TRANSFER"];

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function buildRiskMap(budgetUsage) {
  const map = new Map();
  (budgetUsage || []).forEach((item) => {
    if (!item.categoryId || (!item.alertTriggered && !item.exceeded)) {
      return;
    }
    const existing = map.get(item.categoryId);
    if (!existing || (item.exceeded && !existing.exceeded)) {
      map.set(item.categoryId, {
        exceeded: Boolean(item.exceeded),
        alertTriggered: Boolean(item.alertTriggered),
        budgetName: item.budgetName || "预算",
        usageRatioText: `${(Number(item.usageRatio || 0) * 100).toFixed(0)}%`
      });
    }
  });
  return map;
}

function decorateItems(items, accounts, categories, budgetUsage) {
  const accountMap = new Map((accounts || []).map((item) => [item.id, item.accountName]));
  const categoryMap = new Map((categories || []).map((item) => [item.id, item.categoryName]));
  const riskMap = buildRiskMap(budgetUsage);
  const typeMap = {
    EXPENSE: "支出",
    INCOME: "收入",
    TRANSFER: "转账"
  };
  return (items || []).map((item) => ({
    ...item,
    amountText: money(item.amount),
    transactionTimeText: item.transactionTime ? new Date(item.transactionTime).toLocaleString("zh-CN", { hour12: false }) : "-",
    typeLabel: typeMap[item.transactionType] || item.transactionType || "-",
    accountDisplayName: accountMap.get(item.accountId) || `账户 ${item.accountId || '-'}`,
    categoryDisplayName: item.categoryId ? (categoryMap.get(item.categoryId) || `分类 ${item.categoryId}`) : "-",
    budgetRisk: riskMap.get(item.categoryId) || null
  }));
}

Page({
  data: {
    items: [],
    typeIndex: 0,
    stats: {
      total: 0,
      expenseCount: 0,
      incomeCount: 0,
      transferCount: 0,
      riskyCount: 0
    },
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/transactions/transactions")) {
      return;
    }
    this.load收支流水();
  },

  onTypeChange(e) {
    this.setData({ typeIndex: Number(e.detail.value) });
    this.load收支流水();
  },

  async load收支流水() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({
        items: [],
        stats: { total: 0, expenseCount: 0, incomeCount: 0, transferCount: 0, riskyCount: 0 },
        feedback: "当前还没有选择家庭，请先创建或加入家庭。"
      });
      return;
    }
    this.setData({ feedback: "正在加载流水..." });
    const type = TYPE_OPTIONS[this.data.typeIndex] || "";
    const query = `/api/transaction-records/search?familyId=${familyId}&page=0&size=50${type ? `&transactionType=${type}` : ""}`;
    try {
      const [response, accounts, categories, budgetUsage] = await Promise.all([
        request(query),
        request(`/api/accounts?familyId=${familyId}`),
        request(`/api/categories?familyId=${familyId}`),
        request(`/api/budgets/usage?familyId=${familyId}`).catch(() => [])
      ]);
      const items = decorateItems(response.items || [], accounts, categories, budgetUsage);
      const stats = items.reduce((acc, item) => {
        acc.total += 1;
        if (item.transactionType === "EXPENSE") {
          acc.expenseCount += 1;
        } else if (item.transactionType === "INCOME") {
          acc.incomeCount += 1;
        } else if (item.transactionType === "TRANSFER") {
          acc.transferCount += 1;
        }
        if (item.budgetRisk) {
          acc.riskyCount += 1;
        }
        return acc;
      }, { total: 0, expenseCount: 0, incomeCount: 0, transferCount: 0, riskyCount: 0 });
      this.setData({ items, stats, feedback: "" });
    } catch (error) {
      this.setData({ feedback: `流水s load 失败: ${error.message}` });
    }
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/transaction-form/transaction-form" });
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/transaction-form/transaction-form?recordId=${id}` });
  },

  onPullDownRefresh() {
    this.load收支流水().finally(() => wx.stopPullDownRefresh());
  }
});
