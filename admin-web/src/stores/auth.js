import { reactive } from "vue";
import { authApi } from "@/api/auth";

const STORAGE_KEY = "finance-admin-auth";

export const authStore = reactive({
  token: "",
  tokenType: "Bearer",
  expiresInSeconds: 0,
  user: null,
  memberships: [],
  initialized: false,
  restore() {
    if (this.initialized) {
      return;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.token = parsed.token || "";
        this.tokenType = parsed.tokenType || "Bearer";
        this.expiresInSeconds = parsed.expiresInSeconds || 0;
        this.user = parsed.user || null;
        this.memberships = parsed.memberships || [];
      } catch (_error) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    this.initialized = true;
  },
  persist() {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: this.token,
        tokenType: this.tokenType,
        expiresInSeconds: this.expiresInSeconds,
        user: this.user,
        memberships: this.memberships
      })
    );
  },
  setSession(payload) {
    this.token = payload.accessToken || "";
    this.tokenType = payload.tokenType || "Bearer";
    this.expiresInSeconds = payload.expiresInSeconds || 0;
    this.user = payload.user || null;
    this.memberships = payload.memberships || [];
    this.initialized = true;
    this.persist();
  },
  async login(form) {
    const response = await authApi.login(form);
    this.setSession(response);
    return response;
  },
  async fetchMe() {
    const response = await authApi.me();
    this.user = response.user || null;
    this.memberships = response.memberships || [];
    this.persist();
    return response;
  },
  logout() {
    this.token = "";
    this.tokenType = "Bearer";
    this.expiresInSeconds = 0;
    this.user = null;
    this.memberships = [];
    this.initialized = true;
    window.localStorage.removeItem(STORAGE_KEY);
  },
  get currentFamilyId() {
    return this.memberships[0]?.familyId || null;
  }
});
