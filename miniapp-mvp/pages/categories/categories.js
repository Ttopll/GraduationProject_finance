const { request } = require("../../utils/api");
const session = require("../../utils/session");

function normalizeCategory(item) {
  return {
    ...item,
    typeText: item.categoryType === "INCOME" ? "收入" : "支出",
    scopeText: item.scopeType === "PERSONAL" ? "个人" : "家庭"
  };
}

function filterItems(items, typeFilter) {
  if (!typeFilter) {
    return items;
  }
  return items.filter((item) => item.categoryType === typeFilter);
}

Page({
  data: {
    items: [],
    filteredItems: [],
    typeFilter: "",
    stats: {
      total: 0,
      expense: 0,
      income: 0,
      disabled: 0
    },
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/categories/categories")) {
      return;
    }
    this.loadCategories();
  },

  async loadCategories() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ items: [], filteredItems: [], feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载分类..." });
    try {
      const response = await request(`/api/categories?familyId=${familyId}`);
      const items = (response || []).map(normalizeCategory);
      const stats = items.reduce((acc, item) => {
        acc.total += 1;
        if (item.categoryType === "INCOME") {
          acc.income += 1;
        } else {
          acc.expense += 1;
        }
        if (Number(item.enabled) !== 1) {
          acc.disabled += 1;
        }
        return acc;
      }, { total: 0, expense: 0, income: 0, disabled: 0 });
      this.setData({
        items,
        filteredItems: filterItems(items, this.data.typeFilter),
        stats,
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `分类加载失败：${error.message}` });
    }
  },

  changeType(e) {
    const typeFilter = e.currentTarget.dataset.type || "";
    this.setData({
      typeFilter,
      filteredItems: filterItems(this.data.items, typeFilter)
    });
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/category-form/category-form" });
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    wx.navigateTo({ url: `/pages/category-form/category-form?categoryId=${id}` });
  },

  async toggleEnabled(e) {
    const id = e.currentTarget.dataset.id;
    const enabled = Number(e.currentTarget.dataset.enabled) === 1;
    if (!id) {
      return;
    }
    try {
      await request(`/api/categories/${id}/${enabled ? "disable" : "enable"}`, "POST");
      await this.loadCategories();
    } catch (error) {
      this.setData({ feedback: `分类状态切换失败：${error.message}。如果提示无权限，请使用家庭创建者账号操作。` });
    }
  },

  onPullDownRefresh() {
    this.loadCategories().finally(() => wx.stopPullDownRefresh());
  }
});
