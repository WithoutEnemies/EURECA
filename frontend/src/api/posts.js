import { apiRequest, authHeaders } from "../config/api";

export function fetchFeedPosts(token, mode = "for-you") {
  const path =
    token && mode === "following"
      ? "/posts/me/following"
      : token
        ? "/posts/me/feed"
        : "/posts";

  return apiRequest(path, {
    headers: authHeaders(token),
    fallbackData: [],
  });
}

export function fetchTrendsApi() {
  return apiRequest("/posts/trends", {
    fallbackData: [],
  });
}

export function togglePostLike(postId, token, liked) {
  return apiRequest(`/posts/${postId}/like`, {
    method: liked ? "DELETE" : "POST",
    headers: authHeaders(token),
  });
}

export function registerPostView(postId) {
  return apiRequest(`/posts/${postId}/view`, {
    method: "POST",
  });
}

export function createPost(token, payload) {
  return apiRequest("/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
}

export function deletePostApi(postId, token) {
  return apiRequest(`/posts/${postId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export function reportPostApi(postId, token, reason) {
  return apiRequest(`/posts/${postId}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ reason }),
  });
}
