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
    expenseStructure: [],
    budgetProgress: [],
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
        expenseStructure: (data.expenseStructure || []).map(normalizeExpenseItem),
        budgetProgress: (data.budgetProgress || []).map(normalizeBudgetItem),
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

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  }
});
