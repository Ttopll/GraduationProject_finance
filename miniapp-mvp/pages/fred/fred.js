const { request } = require("../../utils/api");

Page({
  data: {
    seriesId: "PCE",
    loading: false,
    error: "",
    pointCount: 0,
    firstPoint: null,
    lastPoint: null
  },

  onSeriesInput(e) {
    this.setData({ seriesId: (e.detail.value || "").toUpperCase() });
  },

  onShow() {
    this.loadSeries();
  },

  async loadSeries() {
    const seriesId = (this.data.seriesId || "").trim().toUpperCase();
    if (!seriesId) {
      this.setData({ error: "请输入序列ID，如 PCE" });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const res = await request(`/api/real-data-analysis/fred-series?seriesId=${seriesId}`, "GET");
      const points = res.points || [];
      this.setData({
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
  }
});
