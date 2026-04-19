const { request } = require("../../utils/api");

Page({
  data: {
    username: "",
    password: "",
    loading: false,
    error: ""
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  async submitLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      this.setData({ error: "请输入用户名和密码" });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const loginRes = await request("/api/auth/login", "POST", { username, password }, false);
      wx.setStorageSync("accessToken", loginRes.accessToken || "");
      wx.setStorageSync("loginUser", loginRes.user || {});
      wx.showToast({ title: "登录成功", icon: "success" });
      wx.redirectTo({ url: "/pages/retail/retail" });
    } catch (err) {
      this.setData({ error: `登录失败: ${err.message}` });
    } finally {
      this.setData({ loading: false });
    }
  }
});
