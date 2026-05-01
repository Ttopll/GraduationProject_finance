function buildUrl(path) {
  const app = getApp();
  return `${app.globalData.baseUrl}${path}`;
}

function normalizeFailMessage(error) {
  if (!error) {
    return "Request failed";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error.errMsg) {
    return error.errMsg;
  }
  if (error.message) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch (_) {
    return "Request failed";
  }
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
        const message = res.data && (res.data.message || res.data.error || res.data.path)
          ? (res.data.message || res.data.error || res.data.path)
          : `HTTP ${res.statusCode}`;
        reject(new Error(`HTTP ${res.statusCode}: ${message}`));
      },
      fail: (error) => {
        reject(new Error(normalizeFailMessage(error)));
      }
    });
  });
}

module.exports = {
  request
};