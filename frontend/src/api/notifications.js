import { apiRequest, authHeaders } from "../config/api";

export function fetchNotificationsApi(token) {
  return apiRequest("/notifications", {
    headers: authHeaders(token),
    fallbackData: [],
  });
}

export function markNotificationRead(notificationId, token) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
}

export function markAllNotificationsRead(token) {
  return apiRequest("/notifications/read-all", {
    method: "PATCH",
    headers: authHeaders(token),
  });
}
