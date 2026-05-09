const { request } = require("../../utils/api");
const session = require("../../utils/session");

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

function normalizeExportLog(item) {
  const exportType = String(item.exportType || "").trim().toUpperCase();
  const status = String(item.status || "").trim().toUpperCase();
  const typeText = exportType === "BUDGETS" ? "预算备份" : "流水备份";
  return {
    ...item,
    typeText,
    displayName: item.fileName || `${typeText} #${item.id}`,
    statusText: status === "COMPLETED" ? "已完成" : status === "FAILED" ? "失败" : "处理中",
    statusClass: status === "COMPLETED" ? "status-normal" : status === "FAILED" ? "status-danger" : "status-warn",
    timeText: formatDateTime(item.completedAt || item.createdAt)
  };
}

function buildStats(items) {
  const latest = items[0] || null;
  return {
    total: items.length,
    transactions: items.filter((item) => String(item.exportType || "").trim().toUpperCase() === "TRANSACTIONS").length,
    budgets: items.filter((item) => String(item.exportType || "").trim().toUpperCase() === "BUDGETS").length,
    latestStatus: latest ? latest.statusText : "-",
    latestTime: latest ? latest.timeText : "暂无记录"
  };
}

Page({
  data: {
    month: currentMonth(),
    items: [],
    stats: {
      total: 0,
      transactions: 0,
      budgets: 0,
      latestStatus: "-",
      latestTime: "暂无记录"
    },
    exportingType: "",
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/data-backup/data-backup")) {
      return;
    }
    this.loadPage();
  },

  onMonthChange(e) {
    this.setData({ month: e.detail.value });
  },

  async loadPage() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ items: [], feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载备份记录..." });
    try {
      const response = await request(`/api/data-exports?familyId=${familyId}`);
      const items = (response || []).map(normalizeExportLog);
      this.setData({
        items,
        stats: buildStats(items),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `备份记录加载失败：${error.message}` });
    }
  },

  async runExport(type) {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，无法生成备份。" });
      return;
    }
    const path = type === "budgets" ? "/api/data-exports/budgets" : "/api/data-exports/transactions";
    const typeText = type === "budgets" ? "预算" : "流水";
    this.setData({ exportingType: type, feedback: `正在生成${typeText}备份...` });
    try {
      const suffix = `familyId=${familyId}&requestedByMemberId=${memberId || ""}&month=${this.data.month || ""}`;
      const response = await request(`${path}?${suffix}`, "POST");
      const rowCount = response && response.rowCount !== undefined ? response.rowCount : 0;
      this.setData({ feedback: `${typeText}备份已生成，共 ${rowCount} 行。` });
      await this.loadPage();
    } catch (error) {
      this.setData({ feedback: `${typeText}备份生成失败：${error.message}` });
    } finally {
      this.setData({ exportingType: "" });
    }
  },

  exportTransactions() {
    this.runExport("transactions");
  },

  exportBudgets() {
    this.runExport("budgets");
  },

  copyDownloadUrl(e) {
    const id = e.currentTarget.dataset.id;
    const app = getApp();
    const url = `${app.globalData.baseUrl}/api/data-exports/${id}/download`;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({ title: "已复制", icon: "success" });
      }
    });
  },

  deleteExport(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除备份记录",
      content: "确定删除这条备份记录吗？对应的导出文件也会被清理。",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/data-exports/${id}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          await this.loadPage();
        } catch (error) {
          this.setData({ feedback: `删除备份记录失败：${error.message}` });
        }
      }
    });
  },

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  }
});
