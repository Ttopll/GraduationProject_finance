import { authStore } from "@/stores/auth";

const STORAGE_KEY = "finance-admin-auth";

function buildUrl(path, params) {
  const url = new URL(path, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

function ensureAuthState() {
  if (!authStore.initialized) {
    authStore.restore();
  }
  if (authStore.token) {
    return;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    authStore.token = parsed.token || "";
    authStore.tokenType = parsed.tokenType || "Bearer";
    authStore.expiresInSeconds = parsed.expiresInSeconds || 0;
    authStore.user = parsed.user || null;
    authStore.memberships = parsed.memberships || [];
    authStore.selectedFamilyId = parsed.selectedFamilyId || null;
    authStore.initialized = true;
    authStore.normalizeCurrentFamily();
  } catch (_error) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export async function request(path, options = {}) {
  const { method = "GET", body, params, auth = true, responseType = "json" } = options;
  const headers = {};
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    ensureAuthState();
  }

  if (auth && authStore.token) {
    headers.Authorization = `${authStore.tokenType || "Bearer"} ${authStore.token}`;
  }

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
  });

  if (response.status === 401) {
    authStore.logout();
    const text = await response.text();
    throw new Error(`HTTP 401: ${text || "Unauthorized"}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  if (responseType === "blob") {
    return response.blob();
  }

  if (responseType === "text") {
    return response.text();
  }

  return response.json();
}