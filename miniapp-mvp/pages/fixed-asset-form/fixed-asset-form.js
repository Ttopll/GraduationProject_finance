const { request } = require("../../utils/api");
const session = require("../../utils/session");

const ASSET_TYPES = ["HOUSE", "CAR", "EQUITY", "DEPOSIT", "OTHER"];
const ASSET_TYPE_LABELS = ["房产", "车辆", "权益资产", "定期存款", "其他资产"];

Page({
  data: {
    assetId: null,
    isEditMode: false,
    assetTypeIndex: 0,
    assetTypeLabels: ASSET_TYPE_LABELS,
    form: {
      assetName: "",
      assetType: "HOUSE",
      purchaseAmount: "",
      purchaseDate: "",
      valuationAmount: "",
      valuationDate: "",
      remark: ""
    },
    feedback: "",
    submitting: false
  },

  onLoad(options) {
    if (options && options.assetId) {
      this.setData({
        assetId: Number(options.assetId),
        isEditMode: true
      });
    }
  },

  onShow() {
    if (!session.requireLogin("/pages/fixed-asset-form/fixed-asset-form")) {
      return;
    }
    if (this.data.isEditMode) {
      this.loadAsset();
    }
  },

  async loadAsset() {
    if (!this.data.assetId) {
      return;
    }
    this.setData({ feedback: "正在加载资产..." });
    try {
      const asset = await request(`/api/fixed-assets/${this.data.assetId}`);
      const assetTypeIndex = Math.max(ASSET_TYPES.indexOf(asset.assetType), 0);
      this.setData({
        assetTypeIndex,
        "form.assetName": asset.assetName || "",
        "form.assetType": asset.assetType || "HOUSE",
        "form.purchaseAmount": asset.purchaseAmount || "",
        "form.purchaseDate": asset.purchaseDate || "",
        "form.valuationAmount": asset.valuationAmount === null || asset.valuationAmount === undefined ? "" : asset.valuationAmount,
        "form.valuationDate": asset.valuationDate || "",
        "form.remark": asset.remark || "",
        feedback: ""
      });
    } catch (error) {
      this.setData({ feedback: `资产加载失败：${error.message}` });
    }
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onAssetTypeChange(e) {
    const assetTypeIndex = Number(e.detail.value);
    this.setData({
      assetTypeIndex,
      "form.assetType": ASSET_TYPES[assetTypeIndex] || "HOUSE"
    });
  },

  onPurchaseDateChange(e) {
    this.setData({ "form.purchaseDate": e.detail.value });
  },

  onValuationDateChange(e) {
    this.setData({ "form.valuationDate": e.detail.value });
  },

  goAssetsOverview() {
    wx.navigateTo({ url: "/pages/assets-overview/assets-overview" });
  },

  async submitForm() {
    const familyId = session.getCurrentFamilyId();
    const form = this.data.form;
    const purchaseAmount = Number(form.purchaseAmount || 0);
    const valuationAmount = form.valuationAmount === "" ? null : Number(form.valuationAmount);
    if (!familyId || !form.assetName.trim() || purchaseAmount <= 0) {
      this.setData({ feedback: "请填写资产名称和买入金额。" });
      return;
    }
    if (form.valuationDate && valuationAmount === null) {
      this.setData({ feedback: "填写估值日期时，也需要填写最新估值。" });
      return;
    }
    this.setData({ submitting: true, feedback: "正在保存资产..." });
    const payload = {
      ownerMemberId: null,
      assetName: form.assetName,
      assetType: form.assetType,
      purchaseAmount,
      purchaseDate: form.purchaseDate || null,
      valuationAmount,
      valuationDate: valuationAmount === null ? null : (form.valuationDate || null),
      remark: form.remark || null
    };
    try {
      if (this.data.isEditMode && this.data.assetId) {
        await request(`/api/fixed-assets/${this.data.assetId}`, "PUT", payload);
      } else {
        await request("/api/fixed-assets", "POST", {
          familyId,
          ...payload
        });
      }
      wx.showToast({ title: "已保存", icon: "success" });
      wx.navigateBack();
    } catch (error) {
      this.setData({ feedback: `资产保存失败：${error.message}` });
    } finally {
      this.setData({ submitting: false });
    }
  },

  deleteAsset() {
    if (!this.data.isEditMode || !this.data.assetId) {
      return;
    }
    wx.showModal({
      title: "删除资产",
      content: "确定删除这个固定资产吗？删除后资产看板将不再统计它。",
      confirmText: "删除",
      confirmColor: "#d64545",
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ feedback: "正在删除资产..." });
        try {
          await request(`/api/fixed-assets/${this.data.assetId}`, "DELETE");
          wx.showToast({ title: "已删除", icon: "success" });
          wx.navigateBack();
        } catch (error) {
          this.setData({ feedback: `资产删除失败：${error.message}` });
        }
      }
    });
  }
});
