import { request } from "@/utils/http";

export const authApi = {
  login(payload) {
    return request("/api/auth/login", {
      method: "POST",
      body: payload,
      auth: false
    });
  },
  me() {
    return request("/api/auth/me");
  }
};
