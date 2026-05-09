const { request } = require("../../utils/api");
const session = require("../../utils/session");

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

function parseJson(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function typeText(type) {
  const labels = {
    SAVINGS: "储蓄管理",
    INVESTMENT: "投资配置",
    ALLOCATION: "资产配置",
    EMERGENCY_FUND: "应急资金",
    DEBT: "债务管理",
    CONSUMPTION: "消费结构",
    HEALTH_SCORE: "健康评分",
    HEALTH_FACTOR: "短板改善",
    EXECUTION_PATH: "执行路径",
    GOAL: "目标规划"
  };
  return labels[type] || type || "理财建议";
}

function splitSteps(content) {
  const words = ["先", "再", "随后", "最后", "建议", "优先", "按"];
  return String(content || "")
    .split(/[。；]/)
    .map((item) => item.trim())
    .filter((item) => item && words.some((word) => item.indexOf(word) >= 0))
    .slice(0, 4);
}

function normalizeAdvice(item) {
  const snapshot = parseJson(item.snapshotJson);
  const metrics = [];
  if (snapshot.healthScore !== undefined && snapshot.healthScore !== null) {
    metrics.push({ label: "健康评分", value: snapshot.healthScore, meta: snapshot.healthLevel || "评分结果" });
  }
  if (snapshot.savingsRate !== undefined && snapshot.savingsRate !== null) {
    metrics.push({ label: "储蓄率", value: percent(snapshot.savingsRate), meta: "收入结余比例" });
  }
  if (snapshot.investableSurplus !== undefined && snapshot.investableSurplus !== null) {
    metrics.push({ label: "可安排结余", value: money(snapshot.investableSurplus), meta: "可用于储蓄/还债/投资" });
  }
  if (snapshot.emergencyFundGap !== undefined && snapshot.emergencyFundGap !== null) {
    metrics.push({ label: "应急资金缺口", value: money(snapshot.emergencyFundGap), meta: `${snapshot.emergencyFundMonths || 3} 个月目标` });
  }
  if (snapshot.totalDebtBalance !== undefined && snapshot.totalDebtBalance !== null) {
    metrics.push({ label: "债务余额", value: money(snapshot.totalDebtBalance), meta: "当前未还债务" });
  }
  if (snapshot.debtToAssetRatio !== undefined && snapshot.debtToAssetRatio !== null) {
    metrics.push({ label: "负债率", value: percent(snapshot.debtToAssetRatio), meta: "负债占总资产" });
  }
  const reasons = [];
  if (snapshot.totalIncome !== undefined && snapshot.totalIncome !== null) {
    reasons.push(`收入 ${money(snapshot.totalIncome)}`);
  }
  if (snapshot.totalExpense !== undefined && snapshot.totalExpense !== null) {
    reasons.push(`支出 ${money(snapshot.totalExpense)}`);
  }
  if (snapshot.topExpenseCategory) {
    reasons.push(`最大支出 ${snapshot.topExpenseCategory}`);
  }
  const allocationItems = [];
  if (snapshot.allocationEmergencyFundPercent !== undefined && snapshot.allocationEmergencyFundPercent !== null) {
    allocationItems.push({
      label: "应急资金",
      percent: `${snapshot.allocationEmergencyFundPercent}%`,
      amount: money(snapshot.allocationEmergencyFundAmount),
      desc: "先保证短期安全垫"
    });
    allocationItems.push({
      label: "债务处理",
      percent: `${snapshot.allocationDebtRepaymentPercent}%`,
      amount: money(snapshot.allocationDebtRepaymentAmount),
      desc: "优先处理高息或短期债务"
    });
    allocationItems.push({
      label: "稳健储蓄",
      percent: `${snapshot.allocationStableSavingPercent}%`,
      amount: money(snapshot.allocationStableSavingAmount),
      desc: "用于低风险储蓄和现金管理"
    });
    allocationItems.push({
      label: "长期投资",
      percent: `${snapshot.allocationLongTermInvestmentPercent}%`,
      amount: money(snapshot.allocationLongTermInvestmentAmount),
      desc: "按风险偏好逐步配置"
    });
  }
  return {
    ...item,
    typeText: typeText(item.adviceType),
    levelText: item.suggestionLevel === "HIGH" ? "重点建议" : "普通建议",
    levelClass: item.suggestionLevel === "HIGH" ? "status-warn" : "status-normal",
    generatedAtText: item.generatedAt ? String(item.generatedAt).replace("T", " ").slice(0, 16) : "-",
    metrics: metrics.slice(0, 6),
    allocationItems,
    steps: splitSteps(item.content),
    reasonText: reasons.join(" / ")
  };
}

Page({
  data: {
    advices: [],
    stats: {
      total: 0,
      high: 0,
      unread: 0,
      healthScore: "-",
      healthLevel: "暂无评分"
    },
    feedback: "",
    generating: false
  },

  onShow() {
    if (!session.requireLogin("/pages/finance-advice/finance-advice")) {
      return;
    }
    this.loadPage();
  },

  async loadPage() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。", advices: [] });
      return;
    }
    this.setData({ feedback: "正在加载理财建议..." });
    try {
      const month = this.currentMonth();
      const [advices, analysis] = await Promise.all([
        request(`/api/financial-advices?familyId=${familyId}`),
        request(`/api/financial-analysis/dashboard?familyId=${familyId}&month=${month}&trendMonths=6`).catch(() => null)
      ]);
      const normalized = (advices || []).map(normalizeAdvice);
      const stats = normalized.reduce((acc, item) => {
        acc.total += 1;
        if (item.suggestionLevel === "HIGH") {
          acc.high += 1;
        }
        if (item.status !== "READ") {
          acc.unread += 1;
        }
        return acc;
      }, { total: 0, high: 0, unread: 0, healthScore: "-", healthLevel: "暂无评分" });
      if (analysis && analysis.healthScore) {
        stats.healthScore = analysis.healthScore.score || "-";
        stats.healthLevel = analysis.healthScore.levelLabel || "暂无评分";
      }
      this.setData({ advices: normalized, stats, feedback: "" });
    } catch (error) {
      this.setData({ feedback: `理财建议加载失败：${error.message}` });
    }
  },

  async generateAdvice() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    wx.showModal({
      title: "生成本月建议",
      content: "系统会根据本月收支、预算、资产负债和家庭画像生成理财建议。确定继续吗？",
      confirmText: "生成",
      confirmColor: "#2c5f93",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ generating: true, feedback: "正在生成理财建议..." });
        try {
          const result = await request(`/api/financial-advices/generate?familyId=${familyId}&month=${this.currentMonth()}`, "POST");
          wx.showToast({ title: `生成${result.generatedCount || 0}条`, icon: "success" });
          await this.loadPage();
        } catch (error) {
          this.setData({ feedback: `生成建议失败：${error.message}。如果提示无权限，请使用家庭创建者账号操作。` });
        } finally {
          this.setData({ generating: false });
        }
      }
    });
  },

  async toggleRead(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    if (!id) {
      return;
    }
    try {
      if (status === "READ") {
        await request(`/api/financial-advices/${id}/unread`, "POST");
      } else {
        await request(`/api/financial-advices/${id}/read`, "POST");
      }
      await this.loadPage();
    } catch (error) {
      this.setData({ feedback: `建议状态更新失败：${error.message}` });
    }
  },

  goFinancialProfile() {
    wx.navigateTo({ url: "/pages/financial-profile/financial-profile" });
  },

  goAssetsOverview() {
    wx.navigateTo({ url: "/pages/assets-overview/assets-overview" });
  },

  goFinanceAnalysis() {
    wx.navigateTo({ url: "/pages/finance-analysis/finance-analysis" });
  },

  goSpendingAlerts() {
    wx.navigateTo({ url: "/pages/spending-alerts/spending-alerts" });
  },

  currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  },

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  }
});
