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
      this.setData({ family: null, members: [], feedback: "No family context." });
      return;
    }
    this.setData({ feedback: "Loading family info..." });
    try {
      const [family, members] = await Promise.all([
        request(`/api/families/${familyId}`),
        request(`/api/families/${familyId}/members`)
      ]);
      this.setData({ family, members: members || [], feedback: "" });
    } catch (error) {
      this.setData({ feedback: `Family load failed: ${error.message}` });
    }
  },

  onPullDownRefresh() {
    this.loadFamily().finally(() => wx.stopPullDownRefresh());
  }
});