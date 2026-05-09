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
      this.setData({ feedback: "请输入用户名和密码。" });
      return;
    }
    this.setData({ loading: true, feedback: "正在登录..." });
    try {
      const loginRes = await request("/api/auth/login", "POST", { username, password }, false);
      session.setSession(loginRes);
      this.setData({ feedback: "登录成功，正在进入首页..." });
      wx.reLaunch({ url: this.redirectUrl });
    } catch (error) {
      this.setData({ feedback: `登录失败: ${error.message}` });
    } finally {
      this.setData({ loading: false });
    }
  }
});
