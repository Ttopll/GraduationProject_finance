function buildUrl(path) {
  const app = getApp();
  return `${app.globalData.baseUrl}${path}`;
}

function request(path, method = "GET", data = null, auth = true) {
  const headers = { "content-type": "application/json" };
  const token = wx.getStorageSync("accessToken");
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(path),
      method,
      data,
      header: headers,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error(`HTTP ${res.statusCode}`));
      },
      fail: reject
    });
  });
}

module.exports = {
  request
};
