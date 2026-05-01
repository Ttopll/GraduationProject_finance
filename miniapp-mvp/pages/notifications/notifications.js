const { request } = require("../../utils/api");
const session = require("../../utils/session");

Page({
  data: {
    items: [],
    unreadOnly: false,
    sourceType: "",
    stats: {
      total: 0,
      unread: 0,
      budgetCount: 0,
      ruleCount: 0
    },
    sourceSummary: [],
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/notifications/notifications")) {
      return;
    }
    this.loadNotifications();
  },

  onUnreadToggle(e) {
    this.setData({ unreadOnly: e.detail.value });
    this.loadNotifications();
  },

  onSourceChange(e) {
    this.setData({ sourceType: e.currentTarget.dataset.source || "" });
    this.loadNotifications();
  },

  async loadNotifications() {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    if (!familyId) {
      this.setData({ items: [], feedback: "No family context." });
      return;
    }
    this.setData({ feedback: "Loading alerts..." });
    const sourceSuffix = this.data.sourceType ? `&sourceType=${this.data.sourceType}` : "";
    const unreadSuffix = this.data.unreadOnly ? "&readStatus=0" : "";
    try {
      const response = await request(`/api/notifications/search?familyId=${familyId}&targetMemberId=${memberId || ""}&page=0&size=50${sourceSuffix}${unreadSuffix}`);
      const items = response.items || [];
      const stats = {
        total: items.length,
        unread: items.filter((item) => Number(item.readStatus) !== 1).length,
        budgetCount: items.filter((item) => String(item.sourceType || "").trim().toUpperCase() === "BUDGET").length,
        ruleCount: items.filter((item) => String(item.sourceType || "").trim().toUpperCase() === "RULE").length
      };
      const summaryMap = new Map();
      items.forEach((item) => {
        const key = String(item.sourceType || "OTHER").trim().toUpperCase() || "OTHER";
        if (!summaryMap.has(key)) {
          summaryMap.set(key, { source: key, count: 0, unread: 0 });
        }
        const target = summaryMap.get(key);
        target.count += 1;
        if (Number(item.readStatus) !== 1) {
          target.unread += 1;
        }
      });
      this.setData({
        items,
        stats,
        sourceSummary: Array.from(summaryMap.values()),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `Alerts load failed: ${error.message}` });
    }
  },

  async markRead(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await request(`/api/notifications/${id}/read`, "POST");
      this.loadNotifications();
    } catch (error) {
      this.setData({ feedback: `Mark read failed: ${error.message}` });
    }
  },

  async markAllRead() {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    if (!familyId) {
      return;
    }
    wx.showModal({
      title: "Mark All Read",
      content: "Mark all current notifications as read?",
      confirmText: "Confirm",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/notifications/read-all?familyId=${familyId}&targetMemberId=${memberId || ""}`, "POST");
          this.loadNotifications();
        } catch (error) {
          this.setData({ feedback: `Mark all read failed: ${error.message}` });
        }
      }
    });
  },

  openNotificationLink(e) {
    const sourceType = String(e.currentTarget.dataset.sourceType || "").trim().toUpperCase();
    if (sourceType === "BUDGET" || sourceType === "RULE") {
      wx.navigateTo({ url: "/pages/budgets/budgets" });
      return;
    }
    wx.switchTab({ url: "/pages/transactions/transactions" });
  },

  onPullDownRefresh() {
    this.loadNotifications().finally(() => wx.stopPullDownRefresh());
  }
});
