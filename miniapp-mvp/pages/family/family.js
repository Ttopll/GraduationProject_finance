const { request } = require("../../utils/api");
const session = require("../../utils/session");

Page({
  data: {
    family: null,
    members: [],
    feedback: ""
  },

  onShow() {
    if (!session.requireLogin("/pages/family/family")) {
      return;
    }
    this.loadFamily();
  },

  async loadFamily() {
    const familyId = session.getCurrentFamilyId();
    if (!familyId) {
      this.setData({ family: null, members: [], feedback: "当前还没有选择家庭，请先创建或加入家庭。" });
      return;
    }
    this.setData({ feedback: "正在加载家庭信息..." });
    try {
      const [family, members] = await Promise.all([
        request(`/api/families/${familyId}`),
        request(`/api/families/${familyId}/members`)
      ]);
      this.setData({ family, members: members || [], feedback: "" });
    } catch (error) {
      this.setData({ feedback: `家庭信息加载失败: ${error.message}` });
    }
  },

  onPullDownRefresh() {
    this.loadFamily().finally(() => wx.stopPullDownRefresh());
  }
});