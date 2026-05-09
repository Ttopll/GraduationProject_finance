const { request } = require("../../utils/api");
const session = require("../../utils/session");

const ACCOUNT_TYPES = ["CASH", "BANK", "CREDIT", "ALIPAY", "WECHAT"];
const ACCOUNT_TYPE_LABELS = ["Cash", "Bank Card", "Credit Card", "Alipay", "WeChat"];

function indexOfType(value) {
  const index = ACCOUNT_TYPES.indexOf(value);
  return index >= 0 ? index : 1;
}

Page({
  data: {
    accountId: null,
    isEditMode: false,
    typeIndex: 1,
    status: 1,
    form: {
      accountName: "",
      accountType: "BANK",
      institutionName: "",
      accountNoMask: "",
      currentBalance: "0",
      creditLimit: "0",
      billingDay: "",
      repaymentDay: "",
      isShared: 1,
      remark: ""
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.accountId) {
      this.setData({
        accountId: Number(options.accountId),
        isEditMode: true
      });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/account-form/account-form")) {
      return;
    }
    if (this.data.isEditMode) {
      this.loadAccounts();
    }
  },

  async loadAccounts() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载账户..." });
    try {
      const accounts = await request(`/api/accounts?familyId=${familyId}`);
      const account = (accounts || []).find((item) => Number(item.id) === Number(this.data.accountId));
      if (!account) {
        this.setData({ feedback: "账户 not found in current family." });
        return;
      }
      this.setData({
        typeIndex: indexOfType(account.accountType),
        "form.accountName": account.accountName || "",
        "form.accountType": account.accountType || "BANK",
        "form.institutionName": account.institutionName || "",
        "form.accountNoMask": account.accountNoMask || "",
        "form.currentBalance": account.currentBalance || "0",
        "form.creditLimit": account.creditLimit || "0",
        "form.billingDay": account.billingDay || "",
        "form.repaymentDay": account.repaymentDay || "",
        "form.isShared": account.isShared === 0 ? 0 : 1,
        "form.remark": account.remark || "",
        status: Number(account.status) === 1 ? 1 : 0,
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `账户加载失败: ${error.message}` });
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
      "form.accountType": ACCOUNT_TYPES[typeIndex] || "BANK"
    });
  },

  onSharedChange(e) {
    this.setData({ "form.isShared": e.detail.value ? 1 : 0 });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const form = this.data.form;
    if (!familyId || !form.accountName.trim()) {
      this.setData({ feedback: "Please enter account name." });
      return;
    }
    this.setData({ submitting: true, feedback: "保存ting account..." });
    const payload = {
      ownerMemberId: null,
      accountName: form.accountName,
      accountType: form.accountType,
      institutionName: form.institutionName || null,
      accountNoMask: form.accountNoMask || null,
      creditLimit: Number(form.creditLimit || 0),
      billingDay: form.billingDay ? Number(form.billingDay) : null,
      repaymentDay: form.repaymentDay ? Number(form.repaymentDay) : null,
      isShared: Number(form.isShared),
      remark: form.remark || null
    };
    try {
      if (this.data.isEditMode && this.data.accountId) {
        await request(`/api/accounts/${this.data.accountId}`, "PUT", payload);
      } else {
        await request("/api/accounts", "POST", {
          familyId,
          currentBalance: Number(form.currentBalance || 0),
          ...payload
        });
      }
      wx.showToast({ title: this.data.isEditMode ? "已更新" : "已保存", icon: "成功" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `账户 submit 失败: ${error.message}` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async toggleStatus() {
    if (!this.data.isEditMode || !this.data.accountId) {
      return;
    }
    const disabled = Number(this.data.status) !== 1;
    try {
      const result = await request(`/api/accounts/${this.data.accountId}/${disabled ? "enable" : "disable"}`, "POST");
      this.setData({
        status: Number(result.status) === 1 ? 1 : 0,
        feedback: disabled ? "启用d." : "停用."
      });
    } catch (error) {
      this.setData({ feedback: `状态切换失败: ${error.message}` });
    }
  },

  async deleteAccount() {
    if (!this.data.isEditMode || !this.data.accountId) {
      return;
    }
    wx.showModal({
      title: "删除 账户",
      content: "删除 this account? Related transactions may prevent deletion.",
      confirmText: "删除",
      confirmColor: "#d64545",
      成功: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await request(`/api/accounts/${this.data.accountId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "成功" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `删除 失败: ${error.message}` });
        }
      }
    });
  }
});
