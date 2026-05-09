const { request } = require("../../utils/api");
const session = require("../../utils/session");

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

Page({
  data: {
    accounts: [],
    categories: [],
    budgetUsage: [],
    categoryHint: "",
    budgetHint: "",
    recordId: null,
    isEditMode: false,
    originalCreatedByMemberId: null,
    selectedAccountName: "",
    selectedCategoryName: "",
    form: {
      accountId: null,
      categoryId: null,
      transactionType: "EXPENSE",
      amount: "",
      date: todayDate(),
      time: currentTime(),
      merchantName: "",
      note: "",
      sourcePlatform: "MINIAPP"
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.recordId) {
      this.setData({
        recordId: Number(options.recordId),
        isEditMode: true
      });
    }
  },

  updateBudgetHint(categoryId) {
    if (!categoryId) {
      this.setData({ budgetHint: "" });
      return;
    }
    const matched = (this.data.budgetUsage || []).find((item) => Number(item.categoryId) === Number(categoryId));
    if (!matched) {
      this.setData({ budgetHint: "这个分类当前没有设置预算。" });
      return;
    }
    const status = matched.exceeded ? "已超支" : matched.alertTriggered ? "接近上限" : "正常";
    this.setData({
      budgetHint: `预算“${matched.budgetName || "预算"}”${status}. 已用 ${money(matched.spentAmount)} / 预算 ${money(matched.budgetAmount)} / 剩余 ${money(matched.remainingAmount)}.`
    });
  },

  onShow() {
    if (!session.requireLogin("/pages/transaction-form/transaction-form")) {
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
    this.setData({ feedback: "正在加载表单...", categoryHint: "", budgetHint: "" });
    try {
      const [accounts, categories, budgetUsage] = await Promise.all([
        request(`/api/accounts?familyId=${familyId}`),
        request(`/api/categories?familyId=${familyId}`),
        request(`/api/budgets/usage?familyId=${familyId}`).catch(() => [])
      ]);
      const enabledCategories = categories.filter((item) => item.enabled === 1);
      const firstAccount = accounts[0] || null;
      this.setData({
        accounts,
        categories: enabledCategories,
        budgetUsage: budgetUsage || [],
        categoryHint: enabledCategories.length ? "" : "暂无可用分类，可以先不选分类保存。",
        selectedAccountName: firstAccount ? firstAccount.accountName : "",
        selectedCategoryName: "",
        "form.accountId": firstAccount ? firstAccount.id : null,
        feedback: ""
      });
      if (this.data.isEditMode && this.data.recordId) {
        await this.load流水Detail();
      }
    } catch (error) {
      this.setData({ feedback: `表单加载失败: ${error.message}` });
    }
  },

  async load流水Detail() {
    try {
      const detail = await request(`/api/transaction-records/${this.data.recordId}`);
      const account = this.data.accounts.find((item) => Number(item.id) === Number(detail.accountId));
      const category = this.data.categories.find((item) => Number(item.id) === Number(detail.categoryId));
      const transactionTime = detail.transactionTime ? new Date(detail.transactionTime) : new Date();
      const local = new Date(transactionTime.getTime() - transactionTime.getTimezoneOffset() * 60000);
      this.setData({
        originalCreatedByMemberId: detail.createdByMemberId || null,
        selectedAccountName: account ? account.accountName : "",
        selectedCategoryName: category ? category.categoryName : "",
        "form.accountId": detail.accountId || null,
        "form.categoryId": detail.categoryId || null,
        "form.transactionType": detail.transactionType || "EXPENSE",
        "form.amount": detail.amount || "",
        "form.date": local.toISOString().slice(0, 10),
        "form.time": local.toISOString().slice(11, 16),
        "form.merchantName": detail.merchantName || "",
        "form.note": detail.note || "",
        "form.sourcePlatform": detail.sourcePlatform || "MINIAPP",
        feedback: ""
      });
      this.updateBudgetHint(detail.categoryId);
    } catch (error) {
      this.setData({ feedback: `流水 detail load 失败: ${error.message}` });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onPickerChange(e) {
    const field = e.currentTarget.dataset.field;
    const items = field === "accountId" ? this.data.accounts : this.data.categories;
    const target = items[e.detail.value];
    if (!target) {
      return;
    }
    const patch = { [`form.${field}`]: target.id };
    if (field === "accountId") {
      patch.selectedAccountName = target.accountName || `账户 ${target.id}`;
    } else {
      patch.selectedCategoryName = target.categoryName || `分类 ${target.id}`;
    }
    this.setData(patch);
    if (field === "categoryId") {
      this.updateBudgetHint(target.id);
    }
  },

  onTypeChange(e) {
    const values = ["EXPENSE", "INCOME", "TRANSFER"];
    this.setData({ "form.transactionType": values[e.detail.value] });
  },

  onDateChange(e) {
    this.setData({ "form.date": e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ "form.time": e.detail.value });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    const form = this.data.form;
    if (!familyId || !form.accountId || !form.amount) {
      this.setData({ feedback: "请选择账户并填写金额。" });
      return;
    }
    this.setData({ submitting: true, feedback: "正在保存流水..." });
    try {
      const payload = {
        accountId: Number(form.accountId),
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        createdByMemberId: this.data.isEditMode ? this.data.originalCreatedByMemberId : memberId,
        transactionType: form.transactionType,
        amount: Number(form.amount),
        transactionTime: `${form.date}T${form.time}:00`,
        merchantName: form.merchantName || null,
        counterpartyName: null,
        sourcePlatform: form.sourcePlatform || "MINIAPP",
        externalTradeNo: null,
        note: form.note || null
      };
      if (this.data.isEditMode && this.data.recordId) {
        await request(`/api/transaction-records/${this.data.recordId}`, "PUT", payload);
      } else {
        await request("/api/transaction-records", "POST", {
          familyId,
          ...payload
        });
      }
      wx.showToast({ title: this.data.isEditMode ? "已更新" : "已保存", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `${this.data.isEditMode ? "保存修改" : "记录"} 失败: ${error.message}` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async deleteRecord() {
    if (!this.data.isEditMode || !this.data.recordId) {
      return;
    }
    wx.showModal({
      title: "删除 流水",
      content: "确定删除这笔流水吗？",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/transaction-records/${this.data.recordId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `删除 失败: ${error.message}` });
        }
      }
    });
  }
});
