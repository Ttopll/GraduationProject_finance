const { request } = require("../../utils/api");
const session = require("../../utils/session");

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

Page({
  data: {
    user: null,
    memberships: [],
    familyOptions: [],
    familyIndex: 0,
    selectedFamilyId: null,
    currentFamilyLabel: "",
    summary: {
      accountCount: 0,
      totalBalance: 0,
      netAssetValue: 0,
      unreadCount: 0,
      transactionCount: 0,
      riskBudgetCount: 0,
      ruleAlertCount: 0,
      budgetAlertCount: 0
    },
    monthlySummary: [],
    riskBudgets: [],
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/home/home")) {
      return;
    }
    this.loadPage();
  },

  async loadPage() {
    this.setData({ feedback: "Loading home..." });
    try {
      const me = await request("/api/auth/me");
      wx.setStorageSync("loginUser", me.user || null);
      wx.setStorageSync("memberships", me.memberships || []);
      const memberships = me.memberships || [];
      const familyOptions = memberships.map((item) => `${item.familyName || `Family ${item.familyId}`} / ${item.roleCode || "MEMBER"}`);
      const familyId = session.normalizeCurrentFamily();
      if (!familyId) {
        this.setData({
          user: me.user || null,
          memberships,
          familyOptions,
          selectedFamilyId: null,
          currentFamilyLabel: "",
          feedback: "No family context. Create or join a family in admin first."
        });
        return;
      }
      const familyIndex = Math.max(memberships.findIndex((item) => item.familyId === familyId), 0);
      const [accounts, notifications, monthlySummary, overview, transactions, budgetUsage] = await Promise.all([
        request(`/api/accounts?familyId=${familyId}`),
        request(`/api/notifications/search?familyId=${familyId}&page=0&size=20`),
        request(`/api/transaction-records/family/${familyId}/monthly-summary?months=6`),
        request(`/api/fixed-assets/overview?familyId=${familyId}`).catch(() => ({ totalAccountBalance: 0, netAssetValue: 0 })),
        request(`/api/transaction-records/search?familyId=${familyId}&page=0&size=1`),
        request(`/api/budgets/usage?familyId=${familyId}`).catch(() => [])
      ]);
      const notificationItems = notifications.items || [];
      const riskBudgets = (budgetUsage || [])
        .filter((item) => item.alertTriggered || item.exceeded)
        .slice(0, 3)
        .map((item) => ({
          ...item,
          spentAmountText: money(item.spentAmount),
          budgetAmountText: money(item.budgetAmount)
        }));
      this.setData({
        user: me.user || null,
        memberships,
        familyOptions,
        familyIndex,
        selectedFamilyId: familyId,
        currentFamilyLabel: familyOptions[familyIndex] || `Family ${familyId}`,
        monthlySummary: monthlySummary || [],
        summary: {
          accountCount: accounts.length,
          totalBalance: Number(overview.totalAccountBalance || 0).toFixed(2),
          netAssetValue: Number(overview.netAssetValue || 0).toFixed(2),
          unreadCount: notificationItems.filter((item) => Number(item.readStatus) !== 1).length,
          transactionCount: transactions.totalElements || 0,
          riskBudgetCount: riskBudgets.length,
          ruleAlertCount: notificationItems.filter((item) => String(item.sourceType || "").trim().toUpperCase() === "RULE").length,
          budgetAlertCount: notificationItems.filter((item) => String(item.sourceType || "").trim().toUpperCase() === "BUDGET").length
        },
        riskBudgets,
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `Home load failed: ${error.message}` });
    }
  },

  onFamilyChange(e) {
    const familyIndex = Number(e.detail.value);
    const membership = this.data.memberships[familyIndex];
    if (!membership) {
      return;
    }
    session.setCurrentFamilyId(membership.familyId);
    this.setData({
      familyIndex,
      selectedFamilyId: membership.familyId,
      currentFamilyLabel: this.data.familyOptions[familyIndex] || `Family ${membership.familyId}`
    });
    this.loadPage();
  },

  goAccounts() {
    wx.switchTab({ url: "/pages/accounts/accounts" });
  },

  goTransactions() {
    wx.switchTab({ url: "/pages/transactions/transactions" });
  },

  goNotifications() {
    wx.switchTab({ url: "/pages/notifications/notifications" });
  },

  goProfile() {
    wx.switchTab({ url: "/pages/profile/profile" });
  },

  goFamilyInfo() {
    wx.navigateTo({ url: "/pages/family/family" });
  },

  goBudgetSummary() {
    wx.navigateTo({ url: "/pages/budgets/budgets" });
  },

  goAddTransaction() {
    wx.navigateTo({ url: "/pages/transaction-form/transaction-form" });
  },

  logout() {
    session.clearSession();
    wx.reLaunch({ url: "/pages/login/login" });
  }
});
