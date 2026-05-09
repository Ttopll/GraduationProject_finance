const { request } = require("../../utils/api");
const session = require("../../utils/session");

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function operatorText(value) {
  return {
    GT: "大于",
    GTE: "不低于",
    LT: "小于",
    LTE: "不高于",
    EQ: "等于"
  }[value] || value || "-";
}

function normalizeRule(item, categories) {
  const category = categories.find((target) => Number(target.id) === Number(item.categoryId));
  const metricText = item.metricType === "CATEGORY_EXPENSE"
    ? `${category ? category.categoryName : "分类"}支出`
    : "家庭总支出";
  const ruleTypeText = {
    THRESHOLD: "单月超额",
    CONSECUTIVE_THRESHOLD: "连续超额",
    TREND_ANOMALY: "异常增长"
  }[item.ruleType] || item.ruleType || "-";
  const scopeText = item.timeScope === "YEAR" ? "每年" : "每月";
  return {
    ...item,
    metricText,
    ruleTypeText,
    conditionText: `${scopeText}${metricText}${operatorText(item.operatorType)} ${item.thresholdValue}`
  };
}

Page({
  data: {
    month: currentMonth(),
    items: [],
    stats: {
      total: 0,
      enabled: 0,
      riskBudget: 0,
      unread: 0
    },
    evaluating: false,
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/spending-alerts/spending-alerts")) {
      return;
    }
    this.loadPage();
  },

  onMonthChange(e) {
    this.setData({ month: e.detail.value });
  },

  async loadPage() {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    if (!familyId) {
      this.setData({ items: [], feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载消费提醒设置..." });
    try {
      const [rules, categories, budgetUsage, notifications] = await Promise.all([
        request(`/api/rules?familyId=${familyId}`),
        request(`/api/categories?familyId=${familyId}`).catch(() => []),
        request(`/api/budgets/usage?familyId=${familyId}`).catch(() => []),
        request(`/api/notifications/search?familyId=${familyId}&targetMemberId=${memberId || ""}&page=0&size=50`).catch(() => ({ items: [] }))
      ]);
      const items = (rules || []).map((item) => normalizeRule(item, categories || []));
      const notificationItems = notifications.items || [];
      this.setData({
        items,
        stats: {
          total: items.length,
          enabled: items.filter((item) => Number(item.enabled) === 1).length,
          riskBudget: (budgetUsage || []).filter((item) => item.alertTriggered || item.exceeded).length,
          unread: notificationItems.filter((item) => Number(item.readStatus) !== 1).length
        },
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `消费提醒加载失败：${error.message}` });
    }
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/spending-alert-form/spending-alert-form" });
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/spending-alert-form/spending-alert-form?ruleId=${id}` });
  },

  goNotifications() {
    wx.switchTab({ url: "/pages/notifications/notifications" });
  },

  async toggleEnabled(e) {
    const id = e.currentTarget.dataset.id;
    const enabled = Number(e.currentTarget.dataset.enabled) === 1;
    if (!id) {
      return;
    }
    try {
      await request(`/api/rules/${id}/${enabled ? "disable" : "enable"}`, "POST");
      await this.loadPage();
    } catch (error) {
      this.setData({ feedback: `提醒状态切换失败：${error.message}。如提示无权限，请使用家庭创建者账号操作。` });
    }
  },

  async evaluateRules() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      return;
    }
    this.setData({ evaluating: true, feedback: "正在检查本月消费提醒..." });
    try {
      const result = await request(`/api/rules/evaluate?familyId=${familyId}&month=${this.data.month}`, "POST");
      this.setData({
        feedback: `检查完成：命中 ${result.triggeredRuleCount || 0} 条规则，生成 ${result.generatedNotificationCount || 0} 条提醒。`
      });
      await this.loadPage();
    } catch (error) {
      this.setData({ feedback: `消费提醒检查失败：${error.message}。如提示无权限，请使用家庭创建者账号操作。` });
    } finally {
      this.setData({ evaluating: false });
    }
  },

  onPullDownRefresh() {
    this.loadPage().finally(() => wx.stopPullDownRefresh());
  }
});
