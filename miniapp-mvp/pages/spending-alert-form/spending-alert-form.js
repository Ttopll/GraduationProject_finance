const { request } = require("../../utils/api");
const session = require("../../utils/session");

const RULE_TYPES = ["THRESHOLD", "CONSECUTIVE_THRESHOLD", "TREND_ANOMALY"];
const RULE_TYPE_LABELS = ["单月超额", "连续超额", "异常增长"];
const METRIC_TYPES = ["FAMILY_EXPENSE", "CATEGORY_EXPENSE"];
const METRIC_LABELS = ["家庭总支出", "某个分类支出"];
const OPERATORS = ["GT", "GTE"];
const OPERATOR_LABELS = ["大于", "不低于"];
const TIME_SCOPES = ["MONTH", "YEAR"];
const TIME_SCOPE_LABELS = ["每月", "每年"];

function defaultForm() {
  return {
    categoryId: null,
    ruleName: "本月总支出超额提醒",
    ruleType: "THRESHOLD",
    metricType: "FAMILY_EXPENSE",
    timeScope: "MONTH",
    operatorType: "GT",
    thresholdValue: "3000",
    thresholdJson: "",
    actionType: "NOTIFY",
    messageTemplate: "家庭支出达到提醒条件，请及时查看。",
    priority: "10"
  };
}

function hintForRule(ruleType) {
  if (ruleType === "CONSECUTIVE_THRESHOLD") {
    return "连续超额会检查连续几个月是否都达到金额条件，适合发现长期支出偏高。";
  }
  if (ruleType === "TREND_ANOMALY") {
    return "异常增长会把本月支出和前几个月对比，适合发现突然变高的消费。";
  }
  return "单月超额会检查当前月份是否达到金额条件，适合最常见的消费提醒。";
}

Page({
  data: {
    ruleId: null,
    isEditMode: false,
    enabled: 1,
    categories: [],
    categoryIndex: 0,
    ruleTypeIndex: 0,
    metricIndex: 0,
    operatorIndex: 0,
    timeScopeIndex: 0,
    advancedMonths: "2",
    ruleTypeLabels: RULE_TYPE_LABELS,
    metricLabels: METRIC_LABELS,
    operatorLabels: OPERATOR_LABELS,
    timeScopeLabels: TIME_SCOPE_LABELS,
    ruleHint: hintForRule("THRESHOLD"),
    form: defaultForm(),
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.ruleId) {
      this.setData({
        ruleId: Number(options.ruleId),
        isEditMode: true
      });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/spending-alert-form/spending-alert-form")) {
      return;
    }
    this.loadOptions();
  },

  async loadOptions() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载提醒表单..." });
    try {
      const categories = await request(`/api/categories?familyId=${familyId}`).catch(() => []);
      const expenseCategories = (categories || []).filter((item) => item.categoryType === "EXPENSE" && Number(item.enabled) === 1);
      this.setData({
        categories: expenseCategories,
        feedback: ""
      });
      if (this.data.isEditMode && this.data.ruleId) {
        await this.loadRule();
      }
    } catch (error) {
      this.setData({ feedback: `提醒表单加载失败：${error.message}` });
    }
  },

  async loadRule() {
    const familyId = session.getCurrentFamilyId();
    try {
      const rules = await request(`/api/rules?familyId=${familyId}`);
      const rule = (rules || []).find((item) => Number(item.id) === Number(this.data.ruleId));
      if (!rule) {
        this.setData({ feedback: "没有找到这条提醒设置。" });
        return;
      }
      const ruleTypeIndex = Math.max(RULE_TYPES.indexOf(rule.ruleType), 0);
      const metricIndex = Math.max(METRIC_TYPES.indexOf(rule.metricType), 0);
      const operatorIndex = Math.max(OPERATORS.indexOf(rule.operatorType), 0);
      const timeScopeIndex = Math.max(TIME_SCOPES.indexOf(rule.timeScope), 0);
      const categoryIndex = Math.max(this.data.categories.findIndex((item) => Number(item.id) === Number(rule.categoryId)), 0);
      const advancedMonths = this.parseAdvancedMonths(rule.ruleType, rule.thresholdJson);
      this.setData({
        ruleTypeIndex,
        metricIndex,
        operatorIndex,
        timeScopeIndex,
        categoryIndex,
        advancedMonths,
        enabled: Number(rule.enabled) === 1 ? 1 : 0,
        ruleHint: hintForRule(rule.ruleType),
        form: {
          categoryId: rule.categoryId || null,
          ruleName: rule.ruleName || "",
          ruleType: RULE_TYPES[ruleTypeIndex] || "THRESHOLD",
          metricType: METRIC_TYPES[metricIndex] || "FAMILY_EXPENSE",
          timeScope: TIME_SCOPES[timeScopeIndex] || "MONTH",
          operatorType: OPERATORS[operatorIndex] || "GT",
          thresholdValue: String(rule.thresholdValue || ""),
          thresholdJson: rule.thresholdJson || "",
          actionType: "NOTIFY",
          messageTemplate: rule.messageTemplate || "",
          priority: String(rule.priority || 10)
        },
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `提醒详情加载失败：${error.message}` });
    }
  },

  parseAdvancedMonths(ruleType, thresholdJson) {
    const text = String(thresholdJson || "");
    const match = text.match(/(consecutiveMonths|baselineMonths)"?\s*:\s*(\d+)/);
    if (match && match[2]) {
      return match[2];
    }
    return ruleType === "THRESHOLD" ? "2" : "2";
  },

  buildThresholdJson() {
    const months = Math.max(2, Number(this.data.advancedMonths || 2));
    if (this.data.form.ruleType === "CONSECUTIVE_THRESHOLD") {
      return `{"consecutiveMonths":${months}}`;
    }
    if (this.data.form.ruleType === "TREND_ANOMALY") {
      return `{"baselineMonths":${months}}`;
    }
    return null;
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onAdvancedMonthsInput(e) {
    this.setData({ advancedMonths: e.detail.value });
  },

  onRuleTypeChange(e) {
    const ruleTypeIndex = Number(e.detail.value);
    const ruleType = RULE_TYPES[ruleTypeIndex] || "THRESHOLD";
    const patch = {
      ruleTypeIndex,
      "form.ruleType": ruleType,
      "form.timeScope": ruleType === "THRESHOLD" ? this.data.form.timeScope : "MONTH",
      timeScopeIndex: ruleType === "THRESHOLD" ? this.data.timeScopeIndex : 0,
      ruleHint: hintForRule(ruleType)
    };
    this.setData(patch);
  },

  onMetricChange(e) {
    const metricIndex = Number(e.detail.value);
    const metricType = METRIC_TYPES[metricIndex] || "FAMILY_EXPENSE";
    const firstCategory = this.data.categories[0] || null;
    this.setData({
      metricIndex,
      "form.metricType": metricType,
      "form.categoryId": metricType === "CATEGORY_EXPENSE" && firstCategory ? firstCategory.id : null,
      categoryIndex: 0
    });
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    const category = this.data.categories[categoryIndex];
    this.setData({
      categoryIndex,
      "form.categoryId": category ? category.id : null
    });
  },

  onOperatorChange(e) {
    const operatorIndex = Number(e.detail.value);
    this.setData({
      operatorIndex,
      "form.operatorType": OPERATORS[operatorIndex] || "GT"
    });
  },

  onTimeScopeChange(e) {
    const timeScopeIndex = Number(e.detail.value);
    this.setData({
      timeScopeIndex,
      "form.timeScope": TIME_SCOPES[timeScopeIndex] || "MONTH"
    });
  },

  goCategories() {
    wx.navigateTo({ url: "/pages/categories/categories" });
  },

  buildPayload() {
    const form = this.data.form;
    return {
      categoryId: form.metricType === "CATEGORY_EXPENSE" ? Number(form.categoryId) : null,
      createdByMemberId: null,
      ruleName: form.ruleName.trim(),
      ruleType: form.ruleType,
      metricType: form.metricType,
      timeScope: form.ruleType === "THRESHOLD" ? form.timeScope : "MONTH",
      operatorType: form.operatorType,
      thresholdValue: Number(form.thresholdValue),
      thresholdJson: this.buildThresholdJson(),
      actionType: "NOTIFY",
      messageTemplate: form.messageTemplate.trim(),
      priority: Number(form.priority || 10)
    };
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const form = this.data.form;
    if (!familyId || !form.ruleName.trim() || !form.thresholdValue || !form.messageTemplate.trim()) {
      this.setData({ feedback: "请填写提醒名称、提醒金额和提醒内容。" });
      return;
    }
    if (form.metricType === "CATEGORY_EXPENSE" && !form.categoryId) {
      this.setData({ feedback: "分类支出提醒需要先选择一个支出分类。" });
      return;
    }
    this.setData({ submitting: true, feedback: "正在保存提醒设置..." });
    try {
      const payload = this.buildPayload();
      if (this.data.isEditMode && this.data.ruleId) {
        await request(`/api/rules/${this.data.ruleId}`, "PUT", payload);
      } else {
        await request("/api/rules", "POST", { familyId, ...payload });
      }
      wx.showToast({ title: "已保存", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `提醒保存失败：${error.message}。如提示无权限，请使用家庭创建者账号操作。` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleEnabled() {
    if (!this.data.isEditMode || !this.data.ruleId) {
      return;
    }
    const disabled = Number(this.data.enabled) !== 1;
    try {
      const result = await request(`/api/rules/${this.data.ruleId}/${disabled ? "enable" : "disable"}`, "POST");
      this.setData({
        enabled: Number(result.enabled) === 1 ? 1 : 0,
        feedback: disabled ? "已启用。" : "已停用。"
      });
    } catch (error) {
      this.setData({ feedback: `状态切换失败：${error.message}。如提示无权限，请使用家庭创建者账号操作。` });
    }
  },

  deleteRule() {
    if (!this.data.isEditMode || !this.data.ruleId) {
      return;
    }
    wx.showModal({
      title: "删除提醒设置",
      content: "确定删除这条消费提醒设置吗？删除后系统不会再按这条条件自动提醒。",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/rules/${this.data.ruleId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `删除失败：${error.message}。如提示无权限，请使用家庭创建者账号操作。` });
        }
      }
    });
  }
});
