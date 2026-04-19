const { request } = require("../../utils/api");

Page({
  data: {
    loading: false,
    error: "",
    summary: null,
    topCountries: []
  },

  onShow() {
    this.loadRetailOverview();
  },

  async loadRetailOverview() {
    this.setData({ loading: true, error: "" });
    try {
      const res = await request("/api/real-data-analysis/retail-overview?topCountries=5", "GET");
      this.setData({
        summary: {
          totalRecords: res.totalRecords,
          totalAmount: res.totalAmount,
          averageAmount: res.averageAmount,
          earliestInvoiceTime: res.earliestInvoiceTime,
          latestInvoiceTime: res.latestInvoiceTime
        },
        topCountries: res.topCountries || []
      });
    } catch (err) {
      if ((err.message || "").includes("401")) {
        wx.removeStorageSync("accessToken");
        wx.redirectTo({ url: "/pages/login/login" });
        return;
      }
      this.setData({ error: `加载失败: ${err.message}` });
    } finally {
      this.setData({ loading: false });
    }
  },

  gotoWorldBank() {
    wx.navigateTo({ url: "/pages/worldbank/worldbank" });
  },

  logout() {
    wx.removeStorageSync("accessToken");
    wx.redirectTo({ url: "/pages/login/login" });
  }
});
