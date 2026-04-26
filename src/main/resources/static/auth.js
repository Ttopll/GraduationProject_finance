const STORAGE_TOKEN_KEY = "finance_admin_token";
const STORAGE_SESSION_KEY = "finance_admin_session";

function byId(id) {
  return document.getElementById(id);
}

function currentPage() {
  return document.body?.querySelector("[data-page]")?.dataset?.page || "";
}

async function api(path, options = {}) {
  const { method = "GET", body = null, auth = false } = options;
  const token = localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : null
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function setStatus(message, tone = "") {
  const node = byId("authStatus");
  if (!node) {
    return;
  }
  node.textContent = message;
  node.className = `status-box${tone ? ` is-${tone}` : ""}`;
}

function saveSession(session) {
  const accessToken = session?.accessToken || "";
  if (accessToken) {
    localStorage.setItem(STORAGE_TOKEN_KEY, accessToken);
  }
  localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify({
    user: session?.user || null,
    memberships: session?.memberships || []
  }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_SESSION_KEY);
}

function goAdmin() {
  window.location.href = "/admin-mvp.html";
}

function goLogin(prefill = {}) {
  const query = new URLSearchParams();
  if (prefill.username) {
    query.set("username", prefill.username);
  }
  if (prefill.password) {
    query.set("password", prefill.password);
  }
  const suffix = query.toString();
  window.location.href = suffix ? `/login.html?${suffix}` : "/login.html";
}

function fillDemoAccount() {
  const username = byId("loginUsername");
  const password = byId("loginPassword");
  if (!username || !password) {
    return;
  }
  username.value = "demo_owner";
  password.value = "Demo123456";
  setStatus("已填充演示账号，可以直接尝试登录。", "warning");
}

function fillRegisterTemplate() {
  const suffix = Date.now().toString().slice(-6);
  byId("registerUsername").value = `user_${suffix}`;
  byId("registerPassword").value = "12345678";
  byId("registerNickname").value = `demo_${suffix}`;
  byId("registerRealName").value = "demo user";
  byId("registerPhone").value = `139${suffix.padStart(8, "0").slice(0, 8)}`;
  byId("registerEmail").value = `user_${suffix}@example.com`;
  setStatus("已填充一组示例注册信息，可直接提交。", "warning");
}

function hydrateLoginFromQuery() {
  const search = new URLSearchParams(window.location.search);
  const username = search.get("username") || "";
  const password = search.get("password") || "";
  if (byId("loginUsername") && username) {
    byId("loginUsername").value = username;
  }
  if (byId("loginPassword") && password) {
    byId("loginPassword").value = password;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = (byId("loginUsername")?.value || "").trim();
  const password = byId("loginPassword")?.value || "";

  if (!username || !password) {
    setStatus("请输入用户名和密码。", "error");
    return;
  }

  try {
    setStatus("登录中...");
    const response = await api("/api/auth/login", {
      method: "POST",
      body: { username, password }
    });
    saveSession(response);
    setStatus("登录成功，正在进入管理员后台。", "success");
    setTimeout(goAdmin, 300);
  } catch (error) {
    setStatus(`登录失败：${error.message}`, "error");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const payload = {
    username: (byId("registerUsername")?.value || "").trim(),
    password: byId("registerPassword")?.value || "",
    nickname: (byId("registerNickname")?.value || "").trim(),
    realName: (byId("registerRealName")?.value || "").trim(),
    phone: (byId("registerPhone")?.value || "").trim(),
    email: (byId("registerEmail")?.value || "").trim(),
    userType: "USER"
  };

  if (!payload.username || !payload.password || !payload.nickname) {
    setStatus("请至少填写用户名、密码和昵称。", "error");
    return;
  }

  if (payload.password.length < 6) {
    setStatus("密码长度至少 6 位。", "error");
    return;
  }

  try {
    setStatus("注册中...");
    await api("/api/users", {
      method: "POST",
      body: payload
    });
    setStatus("注册成功，正在返回登录页。", "success");
    setTimeout(() => goLogin({
      username: payload.username,
      password: payload.password
    }), 400);
  } catch (error) {
    setStatus(`注册失败：${error.message}`, "error");
  }
}

function bindCommonActions() {
  const enterAdminBtn = byId("enterAdminBtn");
  const logoutBtn = byId("logoutBtn");
  if (enterAdminBtn) {
    enterAdminBtn.addEventListener("click", goAdmin);
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      setStatus("已清除当前登录信息。", "warning");
    });
  }
}

function initLoginPage() {
  hydrateLoginFromQuery();
  byId("loginForm")?.addEventListener("submit", handleLogin);
  byId("fillDemoBtn")?.addEventListener("click", fillDemoAccount);

  if (localStorage.getItem(STORAGE_TOKEN_KEY)) {
    setStatus("检测到已有登录态，可以直接进入管理员后台。", "success");
  } else {
    setStatus("请输入用户名和密码。");
  }
}

function initRegisterPage() {
  byId("registerForm")?.addEventListener("submit", handleRegister);
  byId("fillRegisterTemplateBtn")?.addEventListener("click", fillRegisterTemplate);
  setStatus("请填写注册信息。");
}

function init() {
  bindCommonActions();
  const page = currentPage();
  if (page === "login") {
    initLoginPage();
    return;
  }
  if (page === "register") {
    initRegisterPage();
  }
}

document.addEventListener("DOMContentLoaded", init);
