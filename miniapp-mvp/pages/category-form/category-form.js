const { request } = require("../../utils/api");
const session = require("../../utils/session");

const CATEGORY_TYPES = ["EXPENSE", "INCOME"];
const TYPE_LABELS = ["支出", "收入"];
const SCOPE_TYPES = ["FAMILY", "PERSONAL"];
const SCOPE_LABELS = ["家庭", "个人"];

Page({
  data: {
    categoryId: null,
    isEditMode: false,
    typeIndex: 0,
    scopeIndex: 0,
    typeLabels: TYPE_LABELS,
    scopeLabels: SCOPE_LABELS,
    form: {
      categoryName: "",
      categoryType: "EXPENSE",
      scopeType: "FAMILY",
      iconCode: "",
      sortOrder: "0"
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.categoryId) {
      this.setData({
        categoryId: Number(options.categoryId),
        isEditMode: true
      });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/category-form/category-form")) {
      return;
    }
    if (this.data.isEditMode) {
      this.loadCategory();
    }
  },

  async loadCategory() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId || !this.data.categoryId) {
      return;
    }
    this.setData({ feedback: "正在加载分类..." });
    try {
      const categories = await request(`/api/categories?familyId=${familyId}`);
      const category = (categories || []).find((item) => Number(item.id) === Number(this.data.categoryId));
      if (!category) {
        this.setData({ feedback: "没有找到这个分类。" });
        return;
      }
      const typeIndex = Math.max(CATEGORY_TYPES.indexOf(category.categoryType || "EXPENSE"), 0);
      const scopeIndex = Math.max(SCOPE_TYPES.indexOf(category.scopeType || "FAMILY"), 0);
      this.setData({
        typeIndex,
        scopeIndex,
        "form.categoryName": category.categoryName || "",
        "form.categoryType": CATEGORY_TYPES[typeIndex] || "EXPENSE",
        "form.scopeType": SCOPE_TYPES[scopeIndex] || "FAMILY",
        "form.iconCode": category.iconCode || "",
        "form.sortOrder": String(category.sortOrder || 0),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `分类加载失败：${error.message}` });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onTypeChange(e) {
    const typeIndex = Number(e.detail.value);
    this.setData({
      typeIndex,
      "form.categoryType": CATEGORY_TYPES[typeIndex] || "EXPENSE"
    });
  },

  onScopeChange(e) {
    const scopeIndex = Number(e.detail.value);
    this.setData({
      scopeIndex,
      "form.scopeType": SCOPE_TYPES[scopeIndex] || "FAMILY"
    });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const form = this.data.form;
    if (!familyId || !form.categoryName.trim()) {
      this.setData({ feedback: "请填写分类名称。" });
      return;
    }
    const payload = {
      parentId: null,
      categoryName: form.categoryName,
      categoryType: form.categoryType,
      scopeType: form.scopeType,
      iconCode: form.iconCode || null,
      sortOrder: Number(form.sortOrder || 0)
    };
    this.setData({ submitting: true, feedback: "正在保存分类..." });
    try {
      if (this.data.isEditMode && this.data.categoryId) {
        await request(`/api/categories/${this.data.categoryId}`, "PUT", payload);
      } else {
        await request("/api/categories", "POST", {
          familyId,
          ...payload
        });
      }
      wx.showToast({ title: "已保存", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `分类保存失败：${error.message}。如果提示无权限，请使用家庭创建者账号操作。` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  deleteCategory() {
    if (!this.data.isEditMode || !this.data.categoryId) {
      return;
    }
    wx.showModal({
      title: "删除分类",
      content: "确定删除这个分类吗？如果已有预算或流水正在使用，可能无法删除。",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/categories/${this.data.categoryId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `分类删除失败：${error.message}。如果提示无权限，请使用家庭创建者账号操作。` });
        }
      }
    });
  }
});
