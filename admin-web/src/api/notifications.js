import { request } from "@/utils/http";

export const notificationsApi = {
  search(params) {
    return request("/api/notifications/search", {
      params
    });
  },
  markRead(notificationId) {
    return request(`/api/notifications/${notificationId}/read`, {
      method: "POST"
    });
  },
  markAllRead(familyId, targetMemberId = "") {
    return request("/api/notifications/read-all", {
      method: "POST",
      params: { familyId, targetMemberId }
    });
  },
  deleteRead(familyId, targetMemberId = "") {
    return request("/api/notifications/read", {
      method: "DELETE",
      params: { familyId, targetMemberId }
    });
  },
  remove(notificationId) {
    return request(`/api/notifications/${notificationId}`, {
      method: "DELETE"
    });
  }
};
