const { request } = require("../../utils/api");
const session = require("../../utils/session");

function money(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function nowText() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
}

function debtTypeText(type) {
  const labels = {
    MORTGAGE: "房贷",
    CAR_LOAN: "车贷",
    CREDIT_CARD: "信用卡",
    CONSUMER_LOAN: "消费贷",
    PRIVATE_LOAN: "私人借款",
    OTHER: "其他债务"
  };
  return labels[type] || type || "债务";
}

Page({
  data: {
    debtId: null,
    debt: null,
    accounts: [],
    accountLabels: ["不选择账户"],
    accountIndex: 0,
    form: {
      amount: "",
      principalPaid: "",
      interestPaid: "0",
      repaymentTime: nowText(),
      note: ""
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.debtId) {
      this.setData({ debtId: Number(options.debtId) });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/debt-repayment/debt-repayment")) {
      return;
    }
    this.loadPage();
  },

  async loadPage() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId || !this.data.debtId) {
      this.setData({ feedback: "缺少家庭或债务信息，无法记录还款。" });
      return;
    }
    this.setData({ feedback: "正在加载债务..." });
    try {
      const [debts, accounts] = await Promise.all([
        request(`/api/debts?familyId=${familyId}`),
        request(`/api/accounts?familyId=${familyId}`)
      ]);
      const debt = (debts || []).find((item) => Number(item.id) === Number(this.data.debtId));
      if (!debt) {
        this.setData({ feedback: "没有找到这笔债务。" });
        return;
      }
      const usableAccounts = (accounts || []).filter((item) => Number(item.status) === 1);
      this.setData({
        debt: {
          ...debt,
          currentBalanceText: money(debt.currentBalance),
          debtTypeText: debtTypeText(debt.debtType)
        },
        accounts: usableAccounts,
        accountLabels: ["不选择账户"].concat(usableAccounts.map((item) => `${item.accountName} / ${money(item.currentBalance)}`)),
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

  onAccountChange(e) {
    this.setData({ accountIndex: Number(e.detail.value) });
  },

  fillFullRepayment() {
    if (!this.data.debt) {
      return;
    }
    const amount = money(this.data.debt.currentBalance);
    this.setData({
      "form.amount": amount,
      "form.principalPaid": amount,
      "form.interestPaid": "0"
    });
  },

  goAssetsOverview() {
    wx.navigateTo({ url: "/pages/assets-overview/assets-overview" });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const form = this.data.form;
    const amount = Number(form.amount || 0);
    const principalPaid = Number(form.principalPaid || 0);
    const interestPaid = Number(form.interestPaid || 0);
    if (!familyId || !this.data.debtId) {
      this.setData({ feedback: "缺少家庭或债务信息。" });
      return;
    }
    if (amount <= 0 || principalPaid < 0 || interestPaid < 0 || Math.abs(amount - principalPaid - interestPaid) > 0.001) {
      this.setData({ feedback: "还款总额必须大于 0，且等于本金加利息。" });
      return;
    }
    this.setData({ submitting: true, feedback: "正在提交还款..." });
    const selectedAccount = this.data.accountIndex > 0 ? this.data.accounts[this.data.accountIndex - 1] : null;
    try {
      await request(`/api/debts/${this.data.debtId}/repayments`, "POST", {
        familyId,
        payAccountId: selectedAccount ? selectedAccount.id : null,
        createdByMemberId: session.getCurrentMemberId(),
        amount,
        principalPaid,
        interestPaid,
        repaymentTime: form.repaymentTime || nowText(),
        note: form.note || null
      });
      wx.showToast({ title: "已记录", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `还款提交失败：${error.message}` });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
