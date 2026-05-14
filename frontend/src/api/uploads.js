import { apiRequest, authHeaders } from "../config/api";

export function uploadImage(token, file) {
  const formData = new FormData();
  formData.append("image", file);

  return apiRequest("/uploads/images", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}
