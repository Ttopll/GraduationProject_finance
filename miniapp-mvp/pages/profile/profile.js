const { request } = require("../../utils/api");
const session = require("../../utils/session");

Page({
  data: {
    user: null,
    memberships: [],
    currentMembership: null,
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/profile/profile")) {
      return;
    }
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({ feedback: "正在加载个人信息..." });
    try {
      const me = await request("/api/auth/me");
      wx.setStorageSync("loginUser", me.user || null);
      wx.setStorageSync("memberships", me.memberships || []);
      session.normalizeCurrentFamily();
      const familyId = session.getCurrentFamilyId();
      const memberships = me.memberships || [];
      const currentMembership = memberships.find((item) => item.familyId === familyId) || null;
      this.setData({
        user: me.user || null,
        memberships,
        currentMembership,
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `个人信息加载失败: ${error.message}` });
    }
  },

  goFamilyInfo() {
    wx.navigateTo({ url: "/pages/family/family" });
  },

  goFinancialProfile() {
    wx.navigateTo({ url: "/pages/financial-profile/financial-profile" });
  },

  goCategories() {
    wx.navigateTo({ url: "/pages/categories/categories" });
  },

  goDataBackup() {
    wx.navigateTo({ url: "/pages/data-backup/data-backup" });
  },

  logout() {
    session.clearSession();
    wx.reLaunch({ url: "/pages/login/login" });
  }
});
