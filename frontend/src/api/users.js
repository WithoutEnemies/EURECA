import { apiRequest, authHeaders } from "../config/api";

export function fetchMeApi(token) {
  return apiRequest("/users/me", {
    headers: authHeaders(token),
  });
}

export function fetchUser(authorId) {
  return apiRequest(`/users/${authorId}`);
}

export function fetchUserFollowersApi(userId) {
  return apiRequest(`/users/${userId}/followers`, {
    fallbackData: [],
  });
}

export function fetchUserFollowingApi(userId) {
  return apiRequest(`/users/${userId}/following`, {
    fallbackData: [],
  });
}

export function fetchFollowSuggestionsApi(token) {
  return apiRequest("/users/me/suggestions", {
    headers: authHeaders(token),
    fallbackData: [],
  });
}

export function toggleUserFollowApi(token, userId, following) {
  return apiRequest(`/users/${userId}/follow`, {
    method: following ? "DELETE" : "POST",
    headers: authHeaders(token),
  });
}

export function activateEurecaPlus(token, plan) {
  return apiRequest("/users/me/eureca-plus", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ plan }),
  });
}

export function cancelEurecaPlus(token) {
  return apiRequest("/users/me/eureca-plus", {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
