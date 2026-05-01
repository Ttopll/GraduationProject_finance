function getToken() {
  return wx.getStorageSync("accessToken") || "";
}

function setSession(loginResponse) {
  wx.setStorageSync("accessToken", loginResponse.accessToken || "");
  wx.setStorageSync("tokenType", loginResponse.tokenType || "Bearer");
  wx.setStorageSync("loginUser", loginResponse.user || null);
  wx.setStorageSync("memberships", loginResponse.memberships || []);
  normalizeCurrentFamily();
}

function clearSession() {
  wx.removeStorageSync("accessToken");
  wx.removeStorageSync("tokenType");
  wx.removeStorageSync("loginUser");
  wx.removeStorageSync("memberships");
  wx.removeStorageSync("selectedFamilyId");
}

function getUser() {
  return wx.getStorageSync("loginUser") || null;
}

function getMemberships() {
  return wx.getStorageSync("memberships") || [];
}

function normalizeCurrentFamily() {
  const memberships = getMemberships();
  const allowedIds = memberships.map((item) => item.familyId).filter(Boolean);
  if (allowedIds.length === 0) {
    wx.removeStorageSync("selectedFamilyId");
    return null;
  }
  const selected = wx.getStorageSync("selectedFamilyId");
  if (selected && allowedIds.includes(selected)) {
    return selected;
  }
  wx.setStorageSync("selectedFamilyId", allowedIds[0]);
  return allowedIds[0];
}

function getCurrentFamilyId() {
  const selected = wx.getStorageSync("selectedFamilyId");
  if (selected) {
    return selected;
  }
  return normalizeCurrentFamily();
}

function setCurrentFamilyId(familyId) {
  if (!familyId) {
    wx.removeStorageSync("selectedFamilyId");
    return;
  }
  wx.setStorageSync("selectedFamilyId", Number(familyId));
}

function getCurrentMembership() {
  const familyId = getCurrentFamilyId();
  return getMemberships().find((item) => item.familyId === familyId) || null;
}

function getCurrentMemberId() {
  return getCurrentMembership() ? getCurrentMembership().familyMemberId : null;
}

function isLoggedIn() {
  return Boolean(getToken());
}

function requireLogin(redirectUrl) {
  if (isLoggedIn()) {
    return true;
  }
  wx.reLaunch({
    url: "/pages/login/login" + (redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : "")
  });
  return false;
}

module.exports = {
  getToken,
  setSession,
  clearSession,
  getUser,
  getMemberships,
  getCurrentFamilyId,
  setCurrentFamilyId,
  getCurrentMembership,
  getCurrentMemberId,
  normalizeCurrentFamily,
  isLoggedIn,
  requireLogin
};
