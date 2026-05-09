const { request } = require("../../utils/api");
const session = require("../../utils/session");

const TREND_MONTHS = [3, 6, 12];
const TREND_LABELS = ["近 3 个月", "近 6 个月", "近 12 个月"];

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function percent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function ratioWidth(value) {
  const ratio = Math.max(0, Number(value || 0));
  return `${Math.min(Math.round(ratio * 100), 100)}%`;
}

function normalizeOverview(overview) {
  const data = overview || {};
  return {
    ...data,
    totalIncomeText: money(data.totalIncome),
    totalExpenseText: money(data.totalExpense),
    netCashFlowText: money(data.netCashFlow),
    savingsRateText: percent(data.savingsRate),
    incomeTransactionCount: data.incomeTransactionCount || 0,
    expenseTransactionCount: data.expenseTransactionCount || 0
  };
}

function normalizeHealthFactor(item) {
  const score = Number(item.factorScore || 0);
  const maxScore = Number(item.maxScore || 1);
  const ratio = maxScore > 0 ? score / maxScore : 0;
  return {
    ...item,
    progressWidth: `${Math.min(Math.round(ratio * 100), 100)}%`,
    progressClass: ratio >= 0.8 ? "progress-normal" : ratio >= 0.5 ? "progress-warn" : "progress-danger"
  };
}

function normalizeTrendItem(item) {
  return {
    ...item,
    incomeText: money(item.income),
    expenseText: money(item.expense),
    netAmountText: money(item.netAmount)
  };
}

function normalizeExpenseItem(item) {
  return {
    ...item,
    amountText: money(item.amount),
    ratioText: percent(item.ratio),
    progressWidth: ratioWidth(item.ratio)
  };
}

function normalizeBudgetItem(item) {
  const exceeded = Boolean(item.exceeded);
  const warning = !exceeded && Boolean(item.alertTriggered);
  return {
    ...item,
    budgetAmountText: money(item.budgetAmount),
    spentAmountText: money(item.spentAmount),
    remainingAmountText: money(item.remainingAmount),
    usageRatioText: percent(item.usageRatio),
    statusText: exceeded ? "已超支" : warning ? "接近上限" : "正常",
    statusClass: exceeded ? "status-danger" : warning ? "status-warn" : "status-normal",
    progressClass: exceeded ? "progress-danger" : warning ? "progress-warn" : "progress-normal",
    progressWidth: ratioWidth(item.usageRatio)
  };
}

function trendText(value) {
  return {
    UP: "上升",
    DOWN: "下降",
    STABLE: "稳定",
    NO_DATA: "暂无"
  }[value] || value || "-";
}

function normalizeTrendInsight(item) {
  const data = item || {};
  return {
    ...data,
    incomeTrendText: trendText(data.incomeTrend),
    expenseTrendText: trendText(data.expenseTrend),
    savingsTrendText: trendText(data.savingsTrend),
    averageIncomeText: money(data.averageIncome),
    averageExpenseText: money(data.averageExpense),
    averageNetAmountText: money(data.averageNetAmount),
    latestNetAmountText: money(data.latestNetAmount),
    suggestions: data.suggestions || []
  };
}

Page({
  data: {
    selectedMonth: currentMonth(),
    trendIndex: 1,
    trendLabels: TREND_LABELS,
    overview: normalizeOverview({}),
    healthScore: { score: "-", levelLabel: "暂无评分" },
    healthFactors: [],
    monthlyReport: {},
    monthlyTrend: [],
    trendInsight: normalizeTrendInsight({}),
    expenseStructure: [],
    budgetProgress: [],
    actionItems: [],
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/finance-analysis/finance-analysis")) {
      return;
    }
    this.loadPage();
  },

  async loadPage() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    const trendMonths = TREND_MONTHS[this.data.trendIndex] || 6;
    this.setData({ feedback: "正在加载财务分析..." });
    try {
      const data = await request(`/api/financial-analysis/dashboard?familyId=${familyId}&month=${this.data.selectedMonth}&trendMonths=${trendMonths}`);
      const healthScore = data.healthScore || {};
      this.setData({
        overview: normalizeOverview(data.overview),
        healthScore: {
          score: healthScore.score || "-",
          levelLabel: healthScore.levelLabel || "暂无评分"
        },
        healthFactors: (healthScore.factors || []).map(normalizeHealthFactor),
        monthlyReport: data.monthlyReport || {},
        monthlyTrend: (data.monthlyTrend || []).map(normalizeTrendItem),
        trendInsight: normalizeTrendInsight(data.trendInsight),
        expenseStructure: (data.expenseStructure || []).map(normalizeExpenseItem),
        budgetProgress: (data.budgetProgress || []).map(normalizeBudgetItem),
        actionItems: this.buildActionItems(data),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `财务分析加载失败：${error.message}` });
    }
  },

  onMonthChange(e) {
    this.setData({ selectedMonth: e.detail.value });
    this.loadPage();
  },

  onTrendChange(e) {
    this.setData({ trendIndex: Number(e.detail.value) });
    this.loadPage();
  },

  buildActionItems(data) {
    const overview = data.overview || {};
    const healthScore = data.healthScore || {};
    const budgetProgress = data.budgetProgress || [];
    const expenseStructure = data.expenseStructure || [];
    const monthlyReport = data.monthlyReport || {};
    const items = [];
    const savingsRate = Number(overview.savingsRate || 0);
    const riskBudgets = budgetProgress.filter((item) => item.alertTriggered || item.exceeded);
    const topExpense = expenseStructure[0] || null;

    if ((healthScore.score || 0) < 70) {
      items.push({
        title: "优先查看理财建议",
        desc: `当前健康评分 ${healthScore.score || "-"}，建议先查看系统生成的改善步骤。`,
        action: "advice",
        tag: "重点"
      });
    }
    if (riskBudgets.length > 0) {
      items.push({
        title: "处理预算风险",
        desc: `当前有 ${riskBudgets.length} 个预算接近上限或已超支，建议查看预算并设置消费提醒。`,
        action: "budget",
        tag: "预算"
      });
    }
    if (savingsRate < 0.1) {
      items.push({
        title: "补充消费提醒",
        desc: "本月结余率偏低，可给家庭总支出或重点分类设置自动提醒。",
        action: "alert",
        tag: "提醒"
      });
    }
    if (topExpense && Number(topExpense.ratio || 0) >= 0.35) {
      items.push({
        title: "检查最大支出分类",
        desc: `${topExpense.categoryName || "某个分类"}占本月支出较高，可查看流水确认是否正常。`,
        action: "transactions",
        tag: "流水"
      });
    }
    if (monthlyReport.assetDebtConclusion) {
      items.push({
        title: "核对资产负债",
        desc: monthlyReport.assetDebtConclusion,
        action: "assets",
        tag: "资产"
      });
    }
    items.push({
      title: "新增一笔流水",
      desc: "如果本月数据不完整，先补录收入或支出，分析结果会更准确。",
      action: "addTransaction",
      tag: "补录"
    });
    return items.slice(0, 5);
  },

  handleAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action === "advice") {
      wx.navigateTo({ url: "/pages/finance-advice/finance-advice" });
      return;
    }
    if (action === "budget") {
      wx.navigateTo({ url: "/pages/budgets/budgets" });
      return;
    }
    if (action === "alert") {
      wx.navigateTo({ url: "/pages/spending-alerts/spending-alerts" });
      return;
    }
    if (action === "transactions") {
      wx.switchTab({ url: "/pages/transactions/transactions" });
      return;
    }
    if (action === "assets") {
      wx.navigateTo({ url: "/pages/assets-overview/assets-overview" });
      return;
    }
    wx.navigateTo({ url: "/pages/transaction-form/transaction-form" });
  },

  goBudgetSummary() {
    wx.navigateTo({ url: "/pages/budgets/budgets" });
  },

  goSpendingAlerts() {
    wx.navigateTo({ url: "/pages/spending-alerts/spending-alerts" });
  },

  goAssetsOverview() {
    wx.navigateTo({ url: "/pages/assets-overview/assets-overview" });
  },

  goFinanceAdvice() {
    wx.navigateTo({ url: "/pages/finance-advice/finance-advice" });
  },

  goAddTransaction() {
    wx.navigateTo({ url: "/pages/transaction-form/transaction-form" });
  },

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  }
});
