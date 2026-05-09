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

function assetTypeText(type) {
  const labels = {
    HOUSE: "房产",
    CAR: "车辆",
    EQUITY: "权益资产",
    DEPOSIT: "定期存款",
    OTHER: "其他资产"
  };
  return labels[type] || type || "资产";
}

function debtTypeText(type) {
  const labels = {
    MORTGAGE: "房贷",
    CAR_LOAN: "车贷",
    CREDIT_CARD: "信用卡",
    CONSUMER_LOAN: "消费贷",
    PRIVATE_LOAN: "私人借款",
    OTHER: "其他债务"
  };
  return labels[type] || type || "债务";
}

function riskText(level) {
  const labels = {
    HIGH: "风险较高",
    MEDIUM: "需要关注",
    LOW: "相对稳定"
  };
  return labels[level] || "待评估";
}

function riskClass(level) {
  if (level === "HIGH") {
    return "status-danger";
  }
  if (level === "MEDIUM") {
    return "status-warn";
  }
  return "status-normal";
}

function normalizeOverview(data) {
  const overview = data || {};
  return {
    ...overview,
    totalAssetValueText: money(overview.totalAssetValue),
    netAssetValueText: money(overview.netAssetValue),
    debtToAssetRatioText: percent(overview.debtToAssetRatio),
    riskText: riskText(overview.riskLevel),
    riskClass: riskClass(overview.riskLevel),
    dueDebtCount: overview.dueDebtCount || 0,
    overdueDebtCount: overview.overdueDebtCount || 0,
    riskConclusion: overview.riskConclusion || "暂无诊断",
    diagnosisSuggestions: overview.diagnosisSuggestions || []
  };
}

function valuationStatusText(value) {
  return {
    APPRECIATED: "增值",
    DEPRECIATED: "贬值",
    UNCHANGED: "持平",
    NO_VALUATION: "未估值"
  }[value] || "未估值";
}

function dueStatusText(value) {
  return {
    OVERDUE: "已逾期",
    DUE_SOON: "7天内到期",
    DUE_THIS_MONTH: "30天内到期",
    NORMAL: "正常",
    NO_DUE_DATE: "未设置到期日",
    CLEARED: "已结清"
  }[value] || "正常";
}

function statusClassByDue(value) {
  if (value === "OVERDUE" || value === "DUE_SOON") {
    return "status-danger";
  }
  if (value === "DUE_THIS_MONTH" || value === "NO_DUE_DATE") {
    return "status-warn";
  }
  return "status-normal";
}

Page({
  data: {
    overview: normalizeOverview({}),
    accounts: [],
    fixedAssets: [],
    debts: [],
    actionItems: [],
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/assets-overview/assets-overview")) {
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
    this.setData({ feedback: "正在加载资产负债..." });
    try {
      const overview = await request(`/api/fixed-assets/overview?familyId=${familyId}`);
      this.setData({
        overview: normalizeOverview(overview),
        accounts: (overview.accounts || []).map((item) => ({
          ...item,
          currentBalanceText: money(item.currentBalance)
        })),
        fixedAssets: (overview.fixedAssets || []).map((item) => ({
          ...item,
          assetTypeText: assetTypeText(item.assetType),
          purchaseAmountText: money(item.purchaseAmount),
          effectiveValueText: money(item.effectiveValue),
          valueChangeText: money(item.valueChange),
          appreciationRateText: percent(item.appreciationRate),
          valuationStatusText: valuationStatusText(item.valuationStatus)
        })),
        debts: (overview.debts || []).map((item) => ({
          ...item,
          debtTypeText: debtTypeText(item.debtType),
          currentBalanceText: money(item.currentBalance),
          repaymentProgressText: percent(item.repaymentProgress),
          remainingRatioText: percent(item.remainingRatio),
          dueStatusText: dueStatusText(item.dueStatus),
          statusText: item.status === "ACTIVE" ? "待还" : "已结清",
          statusClass: statusClassByDue(item.dueStatus)
        })),
        actionItems: this.buildActionItems(overview),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `资产负债加载失败：${error.message}` });
    }
  },

  buildActionItems(overview) {
    const data = overview || {};
    const items = [];
    if (!data.fixedAssets || data.fixedAssets.length === 0) {
      items.push({ title: "补充固定资产", desc: "如果家庭有房产、车辆、定期存款等资产，建议先录入，净资产会更准确。", action: "asset" });
    }
    if (!data.debts || data.debts.length === 0) {
      items.push({ title: "补充债务信息", desc: "如果有房贷、车贷、信用卡或借款，录入后可以计算负债率和到期提醒。", action: "debt" });
    }
    if ((data.overdueDebtCount || 0) > 0 || (data.dueDebtCount || 0) > 0) {
      items.push({ title: "处理近期债务", desc: `当前有 ${data.dueDebtCount || 0} 条 30 天内到期债务，其中 ${data.overdueDebtCount || 0} 条逾期。`, action: "debtList" });
    }
    if (data.riskLevel === "HIGH" || data.riskLevel === "MEDIUM") {
      items.push({ title: "查看理财建议", desc: "资产负债存在需要关注的地方，建议生成本月理财建议并按步骤处理。", action: "advice" });
    }
    items.push({ title: "查看财务分析", desc: "结合收支、预算、资产负债和健康评分查看完整财务报表。", action: "analysis" });
    return items.slice(0, 4);
  },

  handleAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action === "asset") {
      this.goCreateAsset();
      return;
    }
    if (action === "debt" || action === "debtList") {
      this.goCreateDebt();
      return;
    }
    if (action === "advice") {
      wx.navigateTo({ url: "/pages/finance-advice/finance-advice" });
      return;
    }
    wx.navigateTo({ url: "/pages/finance-analysis/finance-analysis" });
  },

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  },

  goRepayment(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/debt-repayment/debt-repayment?debtId=${id}` });
  },

  goCreateAsset() {
    wx.navigateTo({ url: "/pages/fixed-asset-form/fixed-asset-form" });
  },

  goCreateDebt() {
    wx.navigateTo({ url: "/pages/debt-form/debt-form" });
  },

  goEditAsset(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/fixed-asset-form/fixed-asset-form?assetId=${id}` });
  },

  goEditDebt(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/debt-form/debt-form?debtId=${id}` });
  },

  goFinanceAdvice() {
    wx.navigateTo({ url: "/pages/finance-advice/finance-advice" });
  },

  goFinanceAnalysis() {
    wx.navigateTo({ url: "/pages/finance-analysis/finance-analysis" });
  }
});
