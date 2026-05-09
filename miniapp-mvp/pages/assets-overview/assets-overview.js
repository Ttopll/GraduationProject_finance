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

Page({
  data: {
    overview: normalizeOverview({}),
    accounts: [],
    fixedAssets: [],
    debts: [],
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
          effectiveValueText: money(item.effectiveValue)
        })),
        debts: (overview.debts || []).map((item) => ({
          ...item,
          debtTypeText: debtTypeText(item.debtType),
          currentBalanceText: money(item.currentBalance),
          statusText: item.status === "ACTIVE" ? "待还" : "已结清",
          statusClass: item.status === "ACTIVE" ? "status-warn" : "status-normal"
        })),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `资产负债加载失败：${error.message}` });
    }
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
  }
});
