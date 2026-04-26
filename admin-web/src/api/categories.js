import { request } from "@/utils/http";

export const categoriesApi = {
  listByFamily(familyId) {
    return request("/api/categories", {
      params: { familyId }
    });
  },
  create(payload) {
    return request("/api/categories", {
      method: "POST",
      body: payload
    });
  },
  update(categoryId, payload) {
    return request(`/api/categories/${categoryId}`, {
      method: "PUT",
      body: payload
    });
  },
  enable(categoryId) {
    return request(`/api/categories/${categoryId}/enable`, {
      method: "POST"
    });
  },
  disable(categoryId) {
    return request(`/api/categories/${categoryId}/disable`, {
      method: "POST"
    });
  },
  remove(categoryId) {
    return request(`/api/categories/${categoryId}`, {
      method: "DELETE"
    });
  }
};
