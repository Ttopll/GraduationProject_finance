const { request } = require("../../utils/api");
const session = require("../../utils/session");

Page({
  data: {
    username: "",
    password: "",
    loading: false,
    feedback: ""
  },

  onLoad(options) {
    this.redirectUrl = options.redirect ? decodeURIComponent(options.redirect) : "/pages/home/home";
    if (session.isLoggedIn()) {
      wx.reLaunch({ url: this.redirectUrl });
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  fillDemo() {
    this.setData({ username: "admin1", password: "12345678", feedback: "" });
  },

  async submitLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      this.setData({ feedback: "Please enter username and password." });
      return;
    }
    this.setData({ loading: true, feedback: "Signing in..." });
    try {
      const loginRes = await request("/api/auth/login", "POST", { username, password }, false);
      session.set登录状态(loginRes);
      this.setData({ feedback: "登录 成功. Redirecting..." });
      wx.reLaunch({ url: this.redirectUrl });
    } catch (error) {
      this.setData({ feedback: `登录 失败: ${error.message}` });
    } finally {
      this.setData({ loading: false });
    }
  }
});