const { request } = require("../../utils/api");

Page({
  data: {
    countryIso3: "CHN",
    loading: false,
    error: "",
    countryName: "",
    pointCount: 0,
    firstPoint: null,
    lastPoint: null
  },

  onCountryInput(e) {
    this.setData({ countryIso3: (e.detail.value || "").toUpperCase() });
  },

  onShow() {
    this.loadTrend();
  },

  async loadTrend() {
    const iso3 = (this.data.countryIso3 || "").trim().toUpperCase();
    if (!iso3) {
      this.setData({ error: "请输入国家 ISO3，如 CHN" });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const res = await request(`/api/real-data-analysis/world-bank-trend?countryIso3=${iso3}`, "GET");
      const points = res.points || [];
      this.setData({
        countryName: res.countryName || "",
        pointCount: points.length,
        firstPoint: points.length > 0 ? points[0] : null,
        lastPoint: points.length > 0 ? points[points.length - 1] : null
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

  gotoFred() {
    wx.navigateTo({ url: "/pages/fred/fred" });
  }
});
