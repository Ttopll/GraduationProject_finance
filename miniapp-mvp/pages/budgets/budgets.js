const { request } = require("../../utils/api");
const session = require("../../utils/session");

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function ratio(value) {
  const num = Number(value || 0);
  return `${(num * 100).toFixed(0)}%`;
}

function normalizeUsageItem(item) {
  const exceeded = Boolean(item.exceeded);
  const warning = !exceeded && Boolean(item.alertTriggered);
  const statusText = exceeded ? "已超支" : warning ? "接近上限" : "正常";
  const statusClass = exceeded ? "status-danger" : warning ? "status-warn" : "status-normal";
  const progressClass = exceeded ? "progress-danger" : warning ? "progress-warn" : "progress-normal";
  const ratioNumber = Math.max(0, Number(item.usageRatio || 0));
  const progressWidth = `${Math.min(ratioNumber * 100, 100)}%`;
  return {
    ...item,
    budgetAmountText: money(item.budgetAmount),
    spentAmountText: money(item.spentAmount),
    remainingAmountText: money(item.remainingAmount),
    usageRatioText: ratio(item.usageRatio),
    statusText,
    statusClass,
    progressClass,
    progressWidth
  };
}

function normalizeMonthItem(item) {
  const net = Number(item.netAmount || 0);
  return {
    ...item,
    incomeText: money(item.income),
    expenseText: money(item.expense),
    netAmountText: money(item.netAmount),
    netClass: net < 0 ? "amount-expense" : net > 0 ? "amount-income" : "amount-transfer"
  };
}

function normalizeRiskItem(item, rules) {
  const matchedRules = (rules || []).filter((rule) => {
    if (Number(rule.enabled) !== 1) {
      return false;
    }
    if (rule.metricType === "FAMILY_EXPENSE") {
      return true;
    }
    if (rule.metricType === "CATEGORY_EXPENSE") {
      return Number(rule.categoryId) === Number(item.categoryId);
    }
    return false;
  });
  return {
    budgetId: item.budgetId,
    budgetName: item.budgetName,
    categoryName: item.categoryName || "-",
    month: item.month || "-",
    usageRatioText: ratio(item.usageRatio),
    statusText: item.statusText,
    statusClass: item.statusClass,
    spentAmountText: item.spentAmountText,
    budgetAmountText: item.budgetAmountText,
    coverageCount: matchedRules.length,
    coverageText: matchedRules.length > 0 ? `${matchedRules.length} rules matched` : "No enabled rule matched"
  };
}

Page({
  data: {
    budgetUsage: [],
    monthlySummary: [],
    riskyBudgets: [],
    coverageRows: [],
    stats: {
      total: 0,
      warningCount: 0,
      exceededCount: 0,
      normalCount: 0
    },
    notificationStats: {
      budgetCount: 0,
      budgetUnread: 0,
      ruleCount: 0,
      ruleUnread: 0
    },
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/budgets/budgets")) {
      return;
    }
    this.loadBudgetSummary();
  },

  async loadBudgetSummary() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({
        budgetUsage: [],
        monthlySummary: [],
        riskyBudgets: [],
        coverageRows: [],
        stats: { total: 0, warningCount: 0, exceededCount: 0, normalCount: 0 },
        notificationStats: { budgetCount: 0, budgetUnread: 0, ruleCount: 0, ruleUnread: 0 },
        feedback: "当前还没有选择家庭，请先创建或加入家庭。"
      });
      return;
    }
    this.setData({ feedback: "正在加载预算..." });
    try {
      const [budgetUsage, monthlySummary, rules, notifications] = await Promise.all([
        request(`/api/budgets/usage?familyId=${familyId}`),
        request(`/api/transaction-records/family/${familyId}/monthly-summary?months=6`),
        request(`/api/rules?familyId=${familyId}`),
        request(`/api/notifications/search?familyId=${familyId}&targetMemberId=${session.getCurrentMemberId() || ""}&page=0&size=50`)
      ]);
      const normalizedUsage = (budgetUsage || []).map(normalizeUsageItem);
      const riskyBudgets = normalizedUsage.filter((item) => item.statusText !== "正常");
      const coverageRows = riskyBudgets.map((item) => normalizeRiskItem(item, rules || []));
      const notificationItems = notifications.items || [];
      const notificationStats = notificationItems.reduce((acc, item) => {
        const sourceType = String(item.sourceType || "").trim().toUpperCase();
        const unread = Number(item.readStatus) !== 1;
        if (sourceType === "BUDGET") {
          acc.budgetCount += 1;
          if (unread) {
            acc.budgetUnread += 1;
          }
        } else if (sourceType === "RULE") {
          acc.ruleCount += 1;
          if (unread) {
            acc.ruleUnread += 1;
          }
        }
        return acc;
      }, { budgetCount: 0, budgetUnread: 0, ruleCount: 0, ruleUnread: 0 });
      const stats = normalizedUsage.reduce((acc, item) => {
        acc.total += 1;
        if (item.statusText === "已超支") {
          acc.exceededCount += 1;
        } else if (item.statusText === "接近上限") {
          acc.warningCount += 1;
        } else {
          acc.normalCount += 1;
        }
        return acc;
      }, { total: 0, warningCount: 0, exceededCount: 0, normalCount: 0 });
      this.setData({
        budgetUsage: normalizedUsage,
        riskyBudgets,
        coverageRows,
        monthlySummary: (monthlySummary || []).map(normalizeMonthItem),
        stats,
        notificationStats,
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `预算汇总加载失败: ${error.message}` });
    }
  },

  onPullDownRefresh() {
    this.loadBudgetSummary().finally(() => wx.stopPullDownRefresh());
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/budget-form/budget-form" });
  },

  openBudget(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/budget-form/budget-form?budgetId=${id}` });
  }
});
