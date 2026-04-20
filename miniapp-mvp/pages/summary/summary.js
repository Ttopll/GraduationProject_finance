const { request } = require("../../utils/api");

Page({
  data: {
    countryIso3: "CHN",
    seriesId: "PCE",
    loading: false,
    importing: false,
    error: "",
    summary: null,
    conclusions: [],
    importResult: null
  },

  onCountryInput(e) {
    this.setData({ countryIso3: (e.detail.value || "").toUpperCase() });
  },

  onSeriesInput(e) {
    this.setData({ seriesId: (e.detail.value || "").toUpperCase() });
  },

  onShow() {
    this.loadSummary();
  },

  async loadSummary() {
    const iso3 = (this.data.countryIso3 || "").trim().toUpperCase();
    const seriesId = (this.data.seriesId || "").trim().toUpperCase();
    this.setData({ loading: true, error: "" });
    try {
      const res = await request(`/api/real-data-analysis/defense-summary?countryIso3=${iso3}&seriesId=${seriesId}&topCountries=10`, "GET");
      this.setData({
        summary: res,
        conclusions: res.conclusions || []
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

  async importData() {
    this.setData({ importing: true, error: "" });
    try {
      const res = await request(
        "/api/real-data-analysis/import?processedDir=data/processed&truncateBeforeImport=true&batchSize=5000",
        "POST"
      );
      this.setData({ importResult: res });
      wx.showToast({ title: "导入成功", icon: "success" });
      await this.loadSummary();
    } catch (err) {
      if ((err.message || "").includes("401")) {
        wx.removeStorageSync("accessToken");
        wx.redirectTo({ url: "/pages/login/login" });
        return;
      }
      this.setData({ error: `导入失败: ${err.message}` });
    } finally {
      this.setData({ importing: false });
    }
  }
});
