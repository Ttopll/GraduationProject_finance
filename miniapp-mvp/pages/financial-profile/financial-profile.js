const { request } = require("../../utils/api");
const session = require("../../utils/session");

const RISK_TYPES = ["LOW", "MEDIUM", "HIGH"];
const RISK_LABELS = ["稳健型", "平衡型", "进取型"];
const GOAL_TYPES = ["HOUSE", "CAR", "EDUCATION", "RETIREMENT", "TRAVEL", "OTHER"];
const GOAL_LABELS = ["购房准备", "购车准备", "教育储备", "养老储备", "旅行计划", "家庭储蓄"];

function parseJson(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

Page({
  data: {
    riskIndex: 0,
    goalIndex: 5,
    riskLabels: RISK_LABELS,
    goalLabels: GOAL_LABELS,
    form: {
      riskPreference: "LOW",
      savingsTargetRatePercent: "20",
      emergencyFundMonths: "3",
      goalType: "OTHER",
      goalAmount: "0",
      targetYear: String(new Date().getFullYear() + 3)
    },
    feedback: "",
    submitting: false
  },

  onShow() {
    if (!session.requireLogin("/pages/financial-profile/financial-profile")) {
      return;
    }
    this.loadProfile();
  },

  async loadProfile() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载理财画像..." });
    try {
      const profile = await request(`/api/family-financial-profile?familyId=${familyId}`);
      const preference = parseJson(profile.investmentPreferenceJson);
      const riskIndex = Math.max(RISK_TYPES.indexOf(profile.riskPreference || "LOW"), 0);
      const goalIndex = Math.max(GOAL_TYPES.indexOf(preference.goalType || "OTHER"), 0);
      this.setData({
        riskIndex,
        goalIndex,
        "form.riskPreference": RISK_TYPES[riskIndex] || "LOW",
        "form.savingsTargetRatePercent": String(Math.round(Number(profile.savingsTargetRate || 0.2) * 100)),
        "form.emergencyFundMonths": String(profile.emergencyFundMonths || 3),
        "form.goalType": GOAL_TYPES[goalIndex] || "OTHER",
        "form.goalAmount": String(preference.goalAmount || 0),
        "form.targetYear": String(preference.targetYear || new Date().getFullYear() + 3),
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `理财画像加载失败：${error.message}` });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onRiskChange(e) {
    const riskIndex = Number(e.detail.value);
    this.setData({
      riskIndex,
      "form.riskPreference": RISK_TYPES[riskIndex] || "LOW"
    });
  },

  onGoalChange(e) {
    const goalIndex = Number(e.detail.value);
    this.setData({
      goalIndex,
      "form.goalType": GOAL_TYPES[goalIndex] || "OTHER"
    });
  },

  async saveProfile() {
    const familyId = session.getCurrentFamilyId();
    const form = this.data.form;
    const savingsTargetRate = Number(form.savingsTargetRatePercent || 0) / 100;
    const emergencyFundMonths = Number(form.emergencyFundMonths || 0);
    if (!familyId) {
      this.setData({ feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    if (savingsTargetRate < 0 || savingsTargetRate > 1 || emergencyFundMonths <= 0) {
      this.setData({ feedback: "目标储蓄率需在 0-100 之间，应急资金月数必须大于 0。" });
      return;
    }
    this.setData({ submitting: true, feedback: "正在保存理财画像..." });
    try {
      await request("/api/family-financial-profile", "PUT", {
        familyId,
        riskPreference: form.riskPreference,
        savingsTargetRate,
        emergencyFundMonths,
        investmentPreferenceJson: JSON.stringify({
          goalType: form.goalType,
          goalAmount: Number(form.goalAmount || 0),
          targetYear: Number(form.targetYear || 0)
        })
      });
      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({ feedback: "理财画像已保存，可返回理财建议页重新生成建议。" });
    } catch (error) {
      this.setData({ feedback: `理财画像保存失败：${error.message}。如果提示无权限，请使用家庭创建者账号操作。` });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
