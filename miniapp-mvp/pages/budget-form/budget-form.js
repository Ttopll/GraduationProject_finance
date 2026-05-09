const { request } = require("../../utils/api");
const session = require("../../utils/session");

const PERIOD_TYPES = ["MONTH", "YEAR"];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

Page({
  data: {
    budgetId: null,
    isEditMode: false,
    categories: [],
    categoryIndex: 0,
    periodIndex: 0,
    enabled: 1,
    usageHint: "",
    form: {
      categoryId: null,
      budgetName: "",
      periodType: "MONTH",
      amount: "",
      alertRatio: "0.80",
      startDate: todayDate(),
      endDate: "",
      remark: ""
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.budgetId) {
      this.setData({
        budgetId: Number(options.budgetId),
        isEditMode: true
      });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/budget-form/budget-form")) {
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
    this.setData({ feedback: "正在加载预算表单..." });
    try {
      const categories = await request(`/api/categories?familyId=${familyId}`);
      const expenseCategories = (categories || []).filter((item) => item.categoryType === "EXPENSE" && Number(item.enabled) === 1);
      const firstCategory = expenseCategories[0] || null;
      this.setData({
        categories: expenseCategories,
        categoryIndex: 0,
        "form.categoryId": firstCategory ? firstCategory.id : null,
        feedback: expenseCategories.length ? "" : "暂无支出分类，请先在后台或分类管理中创建。"
      });
      if (this.data.isEditMode && this.data.budgetId) {
        await this.loadBudget();
      }
    } catch (error) {
      this.setData({ feedback: `预算表单加载失败: ${error.message}` });
    }
  },

  async loadBudget() {
    const familyId = session.getCurrentFamilyId();
    try {
      const [budgets, usage] = await Promise.all([
        request(`/api/budgets?familyId=${familyId}`),
        request(`/api/budgets/usage?familyId=${familyId}`).catch(() => [])
      ]);
      const budget = (budgets || []).find((item) => Number(item.id) === Number(this.data.budgetId));
      if (!budget) {
        this.setData({ feedback: "当前家庭中没有找到这个预算。" });
        return;
      }
      const categoryIndex = Math.max(this.data.categories.findIndex((item) => Number(item.id) === Number(budget.categoryId)), 0);
      const periodIndex = Math.max(PERIOD_TYPES.indexOf(budget.periodType), 0);
      const usageItem = (usage || []).find((item) => Number(item.budgetId) === Number(this.data.budgetId));
      this.setData({
        categoryIndex,
        periodIndex,
        enabled: Number(budget.enabled) === 1 ? 1 : 0,
        usageHint: usageItem
          ? `当前使用率: 已用 ${money(usageItem.spentAmount)} / 预算 ${money(usageItem.budgetAmount)} / 剩余 ${money(usageItem.remainingAmount)}.`
          : "",
        "form.categoryId": budget.categoryId,
        "form.budgetName": budget.budgetName || "",
        "form.periodType": budget.periodType || "MONTH",
        "form.amount": budget.amount || "",
        "form.alertRatio": budget.alertRatio || "0.80",
        "form.startDate": budget.startDate || todayDate(),
        "form.endDate": budget.endDate || "",
        "form.remark": budget.remark || "",
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `预算加载失败: ${error.message}` });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onCategoryChange(e) {
    const categoryIndex = Number(e.detail.value);
    const category = this.data.categories[categoryIndex];
    this.setData({
      categoryIndex,
      "form.categoryId": category ? category.id : null
    });
  },

  onPeriodChange(e) {
    const periodIndex = Number(e.detail.value);
    this.setData({
      periodIndex,
      "form.periodType": PERIOD_TYPES[periodIndex] || "MONTH"
    });
  },

  onStartDateChange(e) {
    this.setData({ "form.startDate": e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ "form.endDate": e.detail.value });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    const form = this.data.form;
    if (!familyId || !form.categoryId || !form.budgetName.trim() || !form.amount) {
      this.setData({ feedback: "请选择分类，并填写预算名称和金额。" });
      return;
    }
    const payload = {
      categoryId: Number(form.categoryId),
      budgetName: form.budgetName,
      periodType: form.periodType,
      amount: Number(form.amount),
      alertRatio: Number(form.alertRatio || 0.8),
      startDate: form.startDate,
      endDate: form.endDate || null,
      remark: form.remark || null
    };
    this.setData({ submitting: true, feedback: "正在保存预算..." });
    try {
      if (this.data.isEditMode && this.data.budgetId) {
        await request(`/api/budgets/${this.data.budgetId}`, "PUT", payload);
      } else {
        await request("/api/budgets", "POST", {
          familyId,
          createdByMemberId: memberId,
          ...payload
        });
      }
      wx.showToast({ title: this.data.isEditMode ? "已更新" : "已保存", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `预算保存失败: ${error.message}` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleEnabled() {
    if (!this.data.isEditMode || !this.data.budgetId) {
      return;
    }
    const disabled = Number(this.data.enabled) !== 1;
    try {
      const result = await request(`/api/budgets/${this.data.budgetId}/${disabled ? "enable" : "disable"}`, "POST");
      this.setData({
        enabled: Number(result.enabled) === 1 ? 1 : 0,
        feedback: disabled ? "已启用。" : "已停用。"
      });
    } catch (error) {
      this.setData({ feedback: `状态切换失败: ${error.message}` });
    }
  },

  async deleteBudget() {
    if (!this.data.isEditMode || !this.data.budgetId) {
      return;
    }
    wx.showModal({
      title: "删除预算",
      content: "确定删除这个预算吗？删除后将不再统计它的使用情况。",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/budgets/${this.data.budgetId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `删除 失败: ${error.message}` });
        }
      }
    });
  }
});
