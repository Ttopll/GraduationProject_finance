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
      this.setData({ feedback: "No family context." });
      return;
    }
    this.setData({ feedback: "Loading budget form..." });
    try {
      const categories = await request(`/api/categories?familyId=${familyId}`);
      const expenseCategories = (categories || []).filter((item) => item.categoryType === "EXPENSE" && Number(item.enabled) === 1);
      const firstCategory = expenseCategories[0] || null;
      this.setData({
        categories: expenseCategories,
        categoryIndex: 0,
        "form.categoryId": firstCategory ? firstCategory.id : null,
        feedback: expenseCategories.length ? "" : "No expense categories. Create a category in admin first."
      });
      if (this.data.isEditMode && this.data.budgetId) {
        await this.loadBudget();
      }
    } catch (error) {
      this.setData({ feedback: `Budget form load failed: ${error.message}` });
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
        this.setData({ feedback: "Budget not found in current family." });
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
          ? `Current usage: Spent ${money(usageItem.spentAmount)} / Budget ${money(usageItem.budgetAmount)} / Remaining ${money(usageItem.remainingAmount)}.`
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
      this.setData({ feedback: `Budget load failed: ${error.message}` });
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
      this.setData({ feedback: "Please complete category, name and amount." });
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
    this.setData({ submitting: true, feedback: "Submitting budget..." });
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
      wx.showToast({ title: this.data.isEditMode ? "Updated" : "Saved", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `Budget submit failed: ${error.message}` });
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
        feedback: disabled ? "Enabled." : "Disabled."
      });
    } catch (error) {
      this.setData({ feedback: `Status change failed: ${error.message}` });
    }
  },

  async deleteBudget() {
    if (!this.data.isEditMode || !this.data.budgetId) {
      return;
    }
    wx.showModal({
      title: "Delete Budget",
      content: "Delete this budget plan? Usage statistics will no longer include it.",
      confirmText: "Delete",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/budgets/${this.data.budgetId}`, "DELETE");
          wx.showToast({ title: "Deleted", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `Delete failed: ${error.message}` });
        }
      }
    });
  }
});
