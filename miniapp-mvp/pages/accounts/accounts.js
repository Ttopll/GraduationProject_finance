const { request } = require("../../utils/api");
const session = require("../../utils/session");

function accountTypeLabel(value) {
  return {
    CASH: "Cash",
    BANK: "Bank Card",
    CREDIT: "Credit Card",
    ALIPAY: "Alipay",
    WECHAT: "WeChat"
  }[value] || value || "-";
}

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

Page({
  data: {
    accounts: [],
    stats: {
      total: 0,
      active: 0,
      disabled: 0,
      totalBalance: "0.00"
    },
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/accounts/accounts")) {
      return;
    }
    this.loadAccounts();
  },

  async loadAccounts() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({
        accounts: [],
        stats: { total: 0, active: 0, disabled: 0, totalBalance: "0.00" },
        feedback: "No family context."
      });
      return;
    }
    this.setData({ feedback: "Loading accounts..." });
    try {
      const accounts = await request(`/api/accounts?familyId=${familyId}`);
      const decorated = (accounts || []).map((item) => ({
        ...item,
        currentBalanceText: money(item.currentBalance),
        accountTypeLabel: accountTypeLabel(item.accountType)
      }));
      const stats = decorated.reduce((acc, item) => {
        acc.total += 1;
        if (Number(item.status) === 1) {
          acc.active += 1;
        } else {
          acc.disabled += 1;
        }
        acc.totalBalanceNumber += Number(item.currentBalance || 0);
        return acc;
      }, { total: 0, active: 0, disabled: 0, totalBalanceNumber: 0 });
      this.setData({
        accounts: decorated,
        stats: {
          total: stats.total,
          active: stats.active,
          disabled: stats.disabled,
          totalBalance: money(stats.totalBalanceNumber)
        },
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `Accounts load failed: ${error.message}` });
    }
  },

  onPullDownRefresh() {
    this.loadAccounts().finally(() => wx.stopPullDownRefresh());
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/account-form/account-form" });
  },

  openAccount(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/account-form/account-form?accountId=${id}` });
  }
});
