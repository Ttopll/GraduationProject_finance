import { request } from "@/utils/http";

export const fixedAssetsApi = {
  listByFamily(familyId, status = "") {
    return request("/api/fixed-assets", {
      params: { familyId, status }
    });
  },
  overview(familyId) {
    return request("/api/fixed-assets/overview", {
      params: { familyId }
    });
  },
  create(payload) {
    return request("/api/fixed-assets", {
      method: "POST",
      body: payload
    });
  },
  update(assetId, payload) {
    return request(`/api/fixed-assets/${assetId}`, {
      method: "PUT",
      body: payload
    });
  },
  enable(assetId) {
    return request(`/api/fixed-assets/${assetId}/enable`, {
      method: "POST"
    });
  },
  disable(assetId) {
    return request(`/api/fixed-assets/${assetId}/disable`, {
      method: "POST"
    });
  },
  remove(assetId) {
    return request(`/api/fixed-assets/${assetId}`, {
      method: "DELETE"
    });
  }
};
