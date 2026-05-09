const { request } = require("../../utils/api");
const session = require("../../utils/session");

const DEBT_TYPES = ["MORTGAGE", "CAR_LOAN", "CREDIT_CARD", "CONSUMER_LOAN", "PRIVATE_LOAN", "OTHER"];
const DEBT_TYPE_LABELS = ["房贷", "车贷", "信用卡", "消费贷", "私人借款", "其他债务"];

function nullableDay(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const day = Number(value);
  return day >= 1 && day <= 31 ? day : null;
}

Page({
  data: {
    debtId: null,
    isEditMode: false,
    debtTypeIndex: 0,
    debtTypeLabels: DEBT_TYPE_LABELS,
    form: {
      debtName: "",
      debtType: "MORTGAGE",
      lenderName: "",
      principalAmount: "",
      annualRate: "0",
      billingDay: "",
      repaymentDay: "",
      dueDate: "",
      remark: ""
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.debtId) {
      this.setData({
        debtId: Number(options.debtId),
        isEditMode: true
      });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/debt-form/debt-form")) {
      return;
    }
    if (this.data.isEditMode) {
      this.loadDebt();
    }
  },

  async loadDebt() {
    if (!this.data.debtId) {
      return;
    }
    this.setData({ feedback: "正在加载债务..." });
    try {
      const debt = await request(`/api/debts/${this.data.debtId}`);
      const debtTypeIndex = Math.max(DEBT_TYPES.indexOf(debt.debtType), 0);
      this.setData({
        debtTypeIndex,
        "form.debtName": debt.debtName || "",
        "form.debtType": debt.debtType || "MORTGAGE",
        "form.lenderName": debt.lenderName || "",
        "form.principalAmount": debt.principalAmount || "",
        "form.annualRate": debt.annualRate || "0",
        "form.billingDay": debt.billingDay || "",
        "form.repaymentDay": debt.repaymentDay || "",
        "form.dueDate": debt.dueDate || "",
        "form.remark": debt.remark || "",
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `债务加载失败：${error.message}` });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onDebtTypeChange(e) {
    const debtTypeIndex = Number(e.detail.value);
    this.setData({
      debtTypeIndex,
      "form.debtType": DEBT_TYPES[debtTypeIndex] || "MORTGAGE"
    });
  },

  onDueDateChange(e) {
    this.setData({ "form.dueDate": e.detail.value });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const memberId = session.getCurrentMemberId();
    const form = this.data.form;
    const principalAmount = Number(form.principalAmount || 0);
    if (!familyId || !form.debtName.trim() || principalAmount <= 0) {
      this.setData({ feedback: "请填写债务名称和本金。" });
      return;
    }
    this.setData({ submitting: true, feedback: "正在保存债务..." });
    const payload = {
      debtorMemberId: memberId,
      debtName: form.debtName,
      debtType: form.debtType,
      lenderName: form.lenderName || null,
      principalAmount,
      annualRate: Number(form.annualRate || 0),
      billingDay: nullableDay(form.billingDay),
      repaymentDay: nullableDay(form.repaymentDay),
      dueDate: form.dueDate || null,
      remark: form.remark || null
    };
    try {
      if (this.data.isEditMode && this.data.debtId) {
        await request(`/api/debts/${this.data.debtId}`, "PUT", payload);
      } else {
        await request("/api/debts", "POST", {
          familyId,
          ...payload
        });
      }
      wx.showToast({ title: "已保存", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `债务保存失败：${error.message}` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  clearDebt() {
    if (!this.data.isEditMode || !this.data.debtId) {
      return;
    }
    wx.showModal({
      title: "结清债务",
      content: "确定将这笔债务标记为已结清吗？结清后余额会变为 0。",
      confirmText: "结清",
      confirmColor: "#2c5f93",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ feedback: "正在结清债务..." });
        try {
          await request(`/api/debts/${this.data.debtId}/clear`, "POST");
          wx.showToast({ title: "已结清", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `债务结清失败：${error.message}` });
        }
      }
    });
  },

  deleteDebt() {
    if (!this.data.isEditMode || !this.data.debtId) {
      return;
    }
    wx.showModal({
      title: "删除债务",
      content: "确定删除这笔债务吗？相关还款记录会一并处理，删除后资产负债看板不再统计它。",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ feedback: "正在删除债务..." });
        try {
          await request(`/api/debts/${this.data.debtId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `债务删除失败：${error.message}` });
        }
      }
    });
  }
});
